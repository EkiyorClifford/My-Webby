"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearHistory,
  loadHistory,
  saveHistoryItem,
  type HistoryItem,
} from "@/lib/history";
import type { StackPreference } from "@/lib/prompt";
import { extractOpenQuestions } from "@/lib/questions";
import {
  buildSharePageUrl,
  decodeShare,
  formatShareAttribution,
} from "@/lib/share";
import SparkLogo from "@/components/SparkLogo";
import BriefSections from "@/components/BriefSections";
import ExampleChip, { type ExampleIdea } from "@/components/ExampleChip";
import { minutesCeil, readGenerateError } from "@/lib/api-errors";
import { splitRefineOutput } from "@/lib/changes";
import type { BriefMode } from "@/lib/sections";

const EXAMPLES: ExampleIdea[] = [
  {
    label: "Marketplace",
    idea: "A marketplace that connects landlords directly with tenants in Lagos: listings, approvals, inspections, and rent reminders without agency middlemen.",
    preview:
      "Two-sided supply/demand match, trust/payment flow, and a narrow starting niche instead of 'everything marketplace.'",
  },
  {
    label: "Booking app",
    idea: "A spa and nail booking platform where customers book paid appointments online and the admin manages availability, walk-ins, services, and daily revenue.",
    preview:
      "Live availability, paid appointments, and an ops dashboard for staff, not just a pretty calendar.",
  },
  {
    label: "SaaS tool",
    idea: "A lightweight SaaS for freelancers to send proposals, collect deposits, track project milestones, and auto-generate simple invoices.",
    preview:
      "One clear job-to-be-done, a paid core loop, and a thin first workflow instead of a full suite.",
  },
  {
    label: "Local ops",
    idea: "A real-time outage reporting app where users pin electricity blackouts on a map and neighborhoods see live disruption heatmaps.",
    preview:
      "Geo reports, a live map layer, and a neighborhood signal, scoped for one operational truth.",
  },
];

export default function SparkApp() {
  const [idea, setIdea] = useState("");
  const [stack, setStack] = useState<StackPreference>("none");
  const [output, setOutput] = useState("");
  const [briefMode, setBriefMode] = useState<BriefMode>("generate");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [shareNote, setShareNote] = useState("");
  /** UI-only guidance: shown once after the first generate in a session. */
  const [showScopingNote, setShowScopingNote] = useState(false);
  const [scopingNoteUsed, setScopingNoteUsed] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [shareAuthor, setShareAuthor] = useState("");
  const [shareNamePromptOpen, setShareNamePromptOpen] = useState(false);
  const [viewAttribution, setViewAttribution] = useState<string | null>(null);
  /** UI-only refine delta — never included in copy/download/share. */
  const [changeSummary, setChangeSummary] = useState<string[]>([]);
  const [rateLimitMsg, setRateLimitMsg] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownLeftSec, setCooldownLeftSec] = useState(0);

  const questions = useMemo(
    () => (output && !loading ? extractOpenQuestions(output) : []),
    [output, loading],
  );

  const inCooldown = cooldownUntil !== null && Date.now() < cooldownUntil;

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownLeftSec(0);
      return;
    }
    function tick() {
      const left = Math.max(0, Math.ceil((cooldownUntil! - Date.now()) / 1000));
      setCooldownLeftSec(left);
      if (left <= 0) {
        setCooldownUntil(null);
        setRateLimitMsg("");
      }
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  function applyRateLimit(retryAfterSeconds: number) {
    const minutes = minutesCeil(retryAfterSeconds);
    setRateLimitMsg(
      `You've hit the free limit for now. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
    setCooldownUntil(Date.now() + retryAfterSeconds * 1000);
    setError("");
  }

  useEffect(() => {
    setHistory(loadHistory());

    const hash = window.location.hash;
    if (!hash.startsWith("#s=")) return;
    const payload = decodeShare(hash.slice(3));
    if (!payload) return;
    setIdea(payload.idea);
    setStack(payload.stack || "none");
    setOutput(payload.output);
    setGeneratedAt(payload.generatedAt || null);
    if (payload.author) setShareAuthor(payload.author);
    setViewAttribution(formatShareAttribution(payload));
    if (payload.answers?.length) {
      const map: Record<number, string> = {};
      payload.answers.forEach((a, i) => {
        map[i] = a.answer;
      });
      setAnswers(map);
    }
    setStatus("Loaded shared brief");
  }, []);

  async function generate() {
    if (inCooldown) return;
    setError("");
    setRateLimitMsg("");
    setStatus("");
    setShareNote("");
    setOutput("");
    setAnswers({});
    setShareNamePromptOpen(false);
    setViewAttribution(null);
    setChangeSummary([]);
    setBriefMode("generate");
    setLoading(true);

    try {
      let text = "";
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, stack, mode: "generate" }),
      });
      if (!res.ok) {
        const err = await readGenerateError(res);
        if (err.kind === "rate_limited") {
          applyRateLimit(err.retryAfterSeconds);
          return;
        }
        throw new Error(err.message);
      }
      if (!res.body) throw new Error("No response stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setOutput(text);
      }

      const stamped = new Date().toISOString();
      setGeneratedAt(stamped);
      setHistory(saveHistoryItem({ idea, stack, output: text }));
      setStatus("Brief ready. Answer the founder questions below to refine");
      if (!scopingNoteUsed) {
        setShowScopingNote(true);
        setScopingNoteUsed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function refine() {
    const qa = questions
      .map((question, i) => ({
        question: question.raw,
        answer: (answers[i] || "").trim(),
      }))
      .filter((a) => a.answer);

    if (!qa.length) {
      setError("Answer at least one question before refining.");
      return;
    }
    if (inCooldown) return;

    setError("");
    setRateLimitMsg("");
    setStatus("");
    setShareNote("");
    setShowScopingNote(false);
    const previousBrief = output;
    setBriefMode("refine");
    setOutput("");
    setChangeSummary([]);
    setLoading(true);

    try {
      let text = "";
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          stack,
          mode: "refine",
          previousBrief,
          answers: qa,
        }),
      });
      if (!res.ok) {
        const err = await readGenerateError(res);
        if (err.kind === "rate_limited") {
          applyRateLimit(err.retryAfterSeconds);
          return;
        }
        throw new Error(err.message);
      }
      if (!res.body) throw new Error("No response stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const { changes, brief } = splitRefineOutput(text);
        setChangeSummary(changes);
        setOutput(brief);
      }

      const finalSplit = splitRefineOutput(text);
      setChangeSummary(finalSplit.changes);
      setOutput(finalSplit.brief);
      setGeneratedAt(new Date().toISOString());
      setHistory(
        saveHistoryItem({ idea, stack, output: finalSplit.brief }),
      );
      setStatus("Refined brief ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyBrief() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setStatus("Brief copied");
  }

  function downloadBrief() {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spark-mvp-brief.md";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Markdown downloaded");
  }

  async function copyShareLink() {
    if (!output) return;

    // First click: reveal optional name field; second click creates + copies.
    if (!shareNamePromptOpen) {
      setShareNamePromptOpen(true);
      setStatus("Optional: add a name for the shared link, then copy again");
      return;
    }

    // Read from the live input to avoid any stale state timing issues.
    const inputEl = document.getElementById(
      "share-author",
    ) as HTMLInputElement | null;
    const author = (inputEl?.value ?? shareAuthor).trim();
    if (author && author !== shareAuthor) setShareAuthor(author);

    const qa = questions.map((question, i) => ({
      question: question.raw,
      answer: (answers[i] || "").trim(),
    }));
    const stamped = generatedAt || new Date().toISOString();

    try {
      setStatus("Creating share link…");
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          stack,
          output,
          answers: qa.filter((a) => a.answer),
          author: author || undefined,
          generatedAt: stamped,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        id?: string;
        url?: string;
        author?: string | null;
        error?: string;
      } | null;
      if (!res.ok || !data?.id || !data.url) {
        throw new Error(data?.error || "Could not create share link.");
      }

      // Round-trip verify: name must survive encode → store → fetch.
      const verify = await fetch(`/api/shares/${data.id}`, { cache: "no-store" });
      const stored = (await verify.json().catch(() => null)) as {
        author?: string | null;
      } | null;
      console.info("[spark share]", {
        enteredAuthor: author || null,
        responseAuthor: data.author ?? null,
        storedAuthor: stored?.author ?? null,
        url: data.url,
        urlLength: data.url.length,
      });
      if (author && stored?.author !== author) {
        throw new Error(
          "Share saved but author did not round-trip. Try again.",
        );
      }

      const url = data.url.startsWith("http")
        ? data.url
        : buildSharePageUrl(data.id);
      setShareNote("");
      await navigator.clipboard.writeText(url);
      setViewAttribution(
        formatShareAttribution({
          author: author || undefined,
          generatedAt: stamped,
        }),
      );
      setStatus(
        author
          ? `Share link copied (${author})`
          : "Share link copied",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed.");
      setStatus("");
    }
  }

  function restoreHistory(item: HistoryItem) {
    setIdea(item.idea);
    setStack(item.stack);
    setOutput(item.output);
    setAnswers({});
    setGeneratedAt(null);
    setShareNamePromptOpen(false);
    setViewAttribution(null);
    setChangeSummary([]);
    setBriefMode("generate");
    setError("");
    setStatus("Restored from history");
  }

  return (
    <div className="spark-shell">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-10 md:max-w-3xl md:px-10 md:py-14">
        <header className="flex items-center justify-between gap-6">
          <SparkLogo />
          <a
            href="https://ekiyorclifford.netlify.app/"
            className="text-sm text-[var(--quiet)] transition-colors hover:text-[var(--accent-soft)]"
            target="_blank"
            rel="noreferrer"
          >
            Ekiyor Clifford
          </a>
        </header>

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-end md:gap-10">
          <h1 className="font-display text-[2.65rem] font-medium leading-[1.05] tracking-tight text-[var(--ink)] md:text-5xl">
            Idea to a brief{" "}
            <em className="italic text-[var(--accent-soft)]">you can build.</em>
          </h1>
          <p className="max-w-sm text-[0.95rem] leading-relaxed text-[var(--muted)] md:pb-1">
            Paste a rough product idea. Spark streams a scoped MVP plan, then
            lets you answer the hard questions and refine the cut.
          </p>
        </section>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="text-sm text-[var(--quiet)]">Try</span>
          {EXAMPLES.map((ex, i) => (
            <span key={ex.label} className="inline-flex items-baseline gap-4">
              {i > 0 ? (
                <span className="text-[var(--quiet)]" aria-hidden>
                  /
                </span>
              ) : null}
              <ExampleChip
                example={ex}
                disabled={loading || inCooldown}
                onSelect={setIdea}
              />
            </span>
          ))}
        </div>

        <section className="draft-panel space-y-5">
          <div className="space-y-2">
            <label htmlFor="idea" className="text-sm text-[var(--ink)]">
              Your idea
            </label>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={7}
              placeholder={EXAMPLES[0].idea}
              className="w-full resize-y border-0 bg-transparent px-0 py-1 text-[0.95rem] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--quiet)] focus:ring-0"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--line)] pt-4">
            <span className="text-sm text-[var(--quiet)]">Stack</span>
            {(
              [
                ["none", "No preference"],
                ["nextjs", "Prefer Next.js"],
                ["mobile", "Mobile-first"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={loading}
                onClick={() => setStack(value)}
                className={`text-sm transition-colors disabled:opacity-40 ${
                  stack === value
                    ? "text-[var(--accent-soft)]"
                    : "text-[var(--quiet)] hover:text-[var(--ink)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              type="button"
              onClick={generate}
              disabled={loading || inCooldown || idea.trim().length < 8}
              className="spark-action bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[#1a1510]"
            >
              {loading
                ? "Working…"
                : inCooldown
                  ? `Try again in ${Math.max(1, Math.ceil(cooldownLeftSec / 60))}m`
                  : "Generate MVP brief"}
            </button>
            <span className="text-xs tabular-nums text-[var(--quiet)]">
              {idea.trim().length}/4000
            </span>
          </div>
          {rateLimitMsg ? (
            <p className="text-sm text-[var(--accent-soft)]">
              {rateLimitMsg}
              {inCooldown && cooldownLeftSec > 0 ? (
                <span className="ml-2 text-xs tabular-nums text-[var(--quiet)]">
                  ({Math.floor(cooldownLeftSec / 60)}:
                  {String(cooldownLeftSec % 60).padStart(2, "0")} left)
                </span>
              ) : null}
            </p>
          ) : null}
        </section>

        {history.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--quiet)]">Recent in this browser</p>
              <button
                type="button"
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                }}
                className="text-sm text-[var(--quiet)] transition-colors hover:text-[var(--ink)]"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {history.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={loading}
                  onClick={() => restoreHistory(item)}
                  className="bg-[var(--surface)] px-3 py-2.5 text-left text-xs text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(242,235,224,0.08)" }}
                >
                  <span className="text-[var(--quiet)]">
                    {new Date(item.createdAt).toLocaleString()} · {item.stack}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-[var(--ink)]/90">
                    {item.idea}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {error ? (
          <div
            className="bg-[rgba(80,30,30,0.35)] px-4 py-3 text-sm text-[var(--danger)]"
            style={{ boxShadow: "inset 0 0 0 1px rgba(232,160,160,0.25)" }}
          >
            {error}
          </div>
        ) : null}

        {status ? (
          <p className="text-sm text-[var(--accent)]">{status}</p>
        ) : null}

        {(loading || output) && (
          <section className="draft-panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg text-[var(--ink)]">Brief</p>
              <div className="flex flex-wrap gap-3">
                {loading ? (
                  <span className="text-sm text-[var(--accent)]">streaming…</span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={copyBrief}
                      className="text-sm text-[var(--quiet)] transition-colors hover:text-[var(--ink)]"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={downloadBrief}
                      className="text-sm text-[var(--quiet)] transition-colors hover:text-[var(--ink)]"
                    >
                      Download .md
                    </button>
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="text-sm text-[var(--quiet)] transition-colors hover:text-[var(--ink)]"
                    >
                      {shareNamePromptOpen
                        ? "Copy share link now"
                        : "Copy share link"}
                    </button>
                  </>
                )}
              </div>
            </div>
            {viewAttribution ? (
              <p className="mb-3 text-[11px] text-[var(--quiet)]">
                {viewAttribution}
              </p>
            ) : null}
            {shareNamePromptOpen && !loading ? (
              <div className="mb-3">
                <label
                  htmlFor="share-author"
                  className="mb-1.5 block text-[11px] text-[var(--quiet)]"
                >
                  Your name or company for the shared link (optional)
                </label>
                <input
                  id="share-author"
                  type="text"
                  value={shareAuthor}
                  onChange={(e) => setShareAuthor(e.target.value)}
                  placeholder="e.g. Ekiyor / Acme Labs"
                  maxLength={60}
                  className="w-full max-w-md border-0 border-b border-[var(--line)] bg-transparent px-0 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--quiet)] focus:border-[var(--accent-deep)]"
                />
              </div>
            ) : null}
            {showScopingNote && !loading ? (
              <p className="mb-4 max-w-2xl text-[11px] leading-relaxed text-[var(--quiet)]">
                This is a scoping document, not a technical spec. Hand it to a
                developer, or paste it into your coding AI (Cursor, Claude, GPT)
                as context before you start building.
              </p>
            ) : null}
            {shareNote ? (
              <p className="mb-3 text-xs text-[var(--accent-soft)]">{shareNote}</p>
            ) : null}
            {(briefMode === "refine" &&
              (changeSummary.length > 0 || loading)) && (
              <div className="mb-5 bg-[var(--surface-raised)] px-4 py-3">
                <p className="text-sm text-[var(--accent)]">What changed</p>
                {changeSummary.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                    {changeSummary.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-[var(--quiet)]">
                    summarizing updates…
                  </p>
                )}
              </div>
            )}
            <BriefSections
              mode={briefMode}
              markdown={output}
              loading={loading}
            />
          </section>
        )}

        {!loading && questions.length > 0 ? (
          <section className="draft-panel space-y-4">
            <div>
              <h2 className="font-display text-xl font-medium text-[var(--ink)]">
                Answer the founder questions
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Round two. Your answers rewrite the MVP cut.
              </p>
            </div>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div
                  key={`${i}-${q.text.slice(0, 24)}`}
                  className="space-y-2 border-t border-[var(--line)] pt-3"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    {q.tag ? (
                      <span className="text-xs text-[var(--accent)]">
                        {q.tag}
                      </span>
                    ) : null}
                    <label
                      htmlFor={`q-${i}`}
                      className="text-sm text-[var(--ink)]"
                    >
                      {q.text}
                    </label>
                  </div>
                  <textarea
                    id={`q-${i}`}
                    rows={2}
                    value={answers[i] || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                    }
                    placeholder="Your answer…"
                    className="w-full resize-y border-0 bg-transparent px-0 py-1 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--quiet)]"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={refine}
              disabled={loading || inCooldown}
              className="spark-action bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[#1a1510]"
            >
              Refine brief with my answers
            </button>
          </section>
        ) : null}

        <footer className="mt-auto pt-8 text-sm text-[var(--quiet)]">
          Next.js + Groq · idea to scoped MVP
        </footer>
      </div>
    </div>
  );
}
