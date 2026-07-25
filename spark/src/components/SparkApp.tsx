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
import { buildShareUrl, decodeShare } from "@/lib/share";

const EXAMPLES: Array<{ label: string; idea: string }> = [
  {
    label: "Marketplace",
    idea: "A marketplace that connects landlords directly with tenants in Lagos — listings, approvals, inspections, and rent reminders without agency middlemen.",
  },
  {
    label: "Booking app",
    idea: "A spa and nail booking platform where customers book paid appointments online and the admin manages availability, walk-ins, services, and daily revenue.",
  },
  {
    label: "SaaS tool",
    idea: "A lightweight SaaS for freelancers to send proposals, collect deposits, track project milestones, and auto-generate simple invoices.",
  },
  {
    label: "Local ops",
    idea: "A real-time outage reporting app where users pin electricity blackouts on a map and neighborhoods see live disruption heatmaps.",
  },
];

function renderMarkdown(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/^## (.+)$/gm, '<h2 class="mt-6 mb-2 text-lg font-semibold text-zinc-100">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="mt-4 mb-1 text-base font-medium text-zinc-200">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-100">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-zinc-300">$1</li>')
    .replace(/^(?!<[hl]|<li)(.+)$/gm, '<p class="my-2 text-zinc-400 leading-relaxed">$1</p>')
    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="my-2 space-y-1">$1</ul>')
    .replace(/<\/ul>\s*<ul class="my-2 space-y-1">/g, "");
}

export default function SparkApp() {
  const [idea, setIdea] = useState("");
  const [stack, setStack] = useState<StackPreference>("none");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [shareNote, setShareNote] = useState("");

  const questions = useMemo(
    () => (output && !loading ? extractOpenQuestions(output) : []),
    [output, loading],
  );

  useEffect(() => {
    setHistory(loadHistory());

    const hash = window.location.hash;
    if (!hash.startsWith("#s=")) return;
    const payload = decodeShare(hash.slice(3));
    if (!payload) return;
    setIdea(payload.idea);
    setStack(payload.stack || "none");
    setOutput(payload.output);
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
    setError("");
    setStatus("");
    setShareNote("");
    setOutput("");
    setAnswers({});
    setLoading(true);

    try {
      let text = "";
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, stack, mode: "generate" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `Request failed (${res.status})`);
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

      setHistory(saveHistoryItem({ idea, stack, output: text }));
      setStatus("Brief ready — answer the founder questions below to refine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function refine() {
    const qa = questions
      .map((question, i) => ({
        question,
        answer: (answers[i] || "").trim(),
      }))
      .filter((a) => a.answer);

    if (!qa.length) {
      setError("Answer at least one question before refining.");
      return;
    }

    setError("");
    setStatus("");
    setShareNote("");
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
          previousBrief: output,
          answers: qa,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      if (!res.body) throw new Error("No response stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setOutput("");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setOutput(text);
      }

      setHistory(saveHistoryItem({ idea, stack, output: text }));
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
    const qa = questions.map((question, i) => ({
      question,
      answer: (answers[i] || "").trim(),
    }));
    const url = buildShareUrl({
      v: 1,
      idea,
      stack,
      output,
      answers: qa.filter((a) => a.answer),
    });
    if (url.length > 12000) {
      setShareNote("Share link is very long — copy may fail in some apps. Prefer Download Markdown.");
    } else {
      setShareNote("");
    }
    await navigator.clipboard.writeText(url);
    window.history.replaceState(null, "", url);
    setStatus("Share link copied");
  }

  function restoreHistory(item: HistoryItem) {
    setIdea(item.idea);
    setStack(item.stack);
    setOutput(item.output);
    setAnswers({});
    setError("");
    setStatus("Restored from history");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12 md:py-16">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-500">
          Spark
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-zinc-100 md:text-4xl">
          Idea → MVP spec you can refine
        </h1>
        <p className="max-w-2xl text-zinc-400">
          Paste a product idea, pick a stack preference, get a streamed brief —
          then answer founder questions to tighten the plan.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              disabled={loading}
              onClick={() => setIdea(ex.idea)}
              className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-emerald-800 hover:text-emerald-400 disabled:opacity-40"
            >
              {ex.label}
            </button>
          ))}
        </div>

        <label htmlFor="idea" className="font-mono text-xs text-zinc-500">
          Your idea
        </label>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={7}
          placeholder={EXAMPLES[0].idea}
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none ring-emerald-700/40 placeholder:text-zinc-600 focus:ring-2"
        />

        <div className="space-y-2">
          <p className="font-mono text-xs text-zinc-500">Stack preference</p>
          <div className="flex flex-wrap gap-2">
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
                className={`rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-40 ${
                  stack === value
                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-400"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={loading || idea.trim().length < 20}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Working…" : "Generate MVP brief"}
          </button>
          <span className="font-mono text-xs text-zinc-600">
            {idea.trim().length}/4000
          </span>
        </div>
      </section>

      {history.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
              Recent (this browser)
            </p>
            <button
              type="button"
              onClick={() => {
                clearHistory();
                setHistory([]);
              }}
              className="font-mono text-xs text-zinc-600 hover:text-zinc-300"
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
                className="rounded-lg border border-zinc-900 bg-zinc-950/60 px-3 py-2 text-left text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-40"
              >
                <span className="text-zinc-500">
                  {new Date(item.createdAt).toLocaleString()} · {item.stack}
                </span>
                <span className="mt-1 block line-clamp-2 text-zinc-300">
                  {item.idea}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {status ? (
        <p className="font-mono text-xs text-emerald-500">{status}</p>
      ) : null}

      {(loading || output) && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 md:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
              Brief
            </p>
            <div className="flex flex-wrap gap-2">
              {loading ? (
                <span className="font-mono text-xs text-emerald-500">
                  streaming…
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={copyBrief}
                    className="rounded border border-zinc-800 px-2 py-1 font-mono text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={downloadBrief}
                    className="rounded border border-zinc-800 px-2 py-1 font-mono text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Download .md
                  </button>
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="rounded border border-zinc-800 px-2 py-1 font-mono text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Copy share link
                  </button>
                </>
              )}
            </div>
          </div>
          {shareNote ? (
            <p className="mb-3 font-mono text-xs text-amber-500">{shareNote}</p>
          ) : null}
          {output ? (
            <div
              className="prose-spark text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
            />
          ) : (
            <p className="font-mono text-sm text-zinc-600">Waiting for tokens…</p>
          )}
        </section>
      )}

      {!loading && questions.length > 0 ? (
        <section className="space-y-4 rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-5 md:p-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-500">
              Round 2
            </p>
            <h2 className="mt-2 text-lg font-medium text-zinc-100">
              Answer the founder questions
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Fill in what you know — Spark will rewrite a tighter MVP plan.
            </p>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={`${i}-${q.slice(0, 24)}`} className="space-y-2">
                <label
                  htmlFor={`q-${i}`}
                  className="block text-sm text-zinc-300"
                >
                  {i + 1}. {q}
                </label>
                <textarea
                  id={`q-${i}`}
                  rows={2}
                  value={answers[i] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                  placeholder="Your answer…"
                  className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none ring-emerald-700/40 placeholder:text-zinc-600 focus:ring-2"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={refine}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-500 disabled:opacity-40"
          >
            Refine brief with my answers
          </button>
        </section>
      ) : null}

      <footer className="mt-auto border-t border-zinc-900 pt-6 font-mono text-xs text-zinc-600">
        Built by{" "}
        <a
          href="https://ekiyorclifford.netlify.app/"
          className="text-emerald-500 hover:text-emerald-400"
          target="_blank"
          rel="noreferrer"
        >
          Ekiyor Clifford
        </a>{" "}
        · Next.js + Groq streaming API
      </footer>
    </div>
  );
}
