"use client";

import { useEffect, useState } from "react";
import BriefSections from "@/components/BriefSections";
import SparkLogo from "@/components/SparkLogo";
import { formatShareAttribution } from "@/lib/share";
import type { BriefMode } from "@/lib/sections";

type ShareData = {
  id: string;
  idea: string;
  stack: "nextjs" | "none" | "mobile";
  output: string;
  author: string | null;
  generatedAt: string;
};

export default function SharedBriefClient({ id }: { id: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/shares/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "This share link was not found."
              : "Failed to load share.",
          );
        }
        const json = (await res.json()) as ShareData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load share.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const mode: BriefMode = data?.output.includes("## Decisions locked in")
    ? "refine"
    : "generate";

  const attribution = data
    ? formatShareAttribution({
        author: data.author ?? undefined,
        generatedAt: data.generatedAt,
      })
    : "";

  return (
    <div className="spark-shell">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 md:max-w-3xl md:px-10 md:py-14">
        <header className="flex items-center justify-between gap-6">
          <SparkLogo />
          <a
            href="/"
            className="text-sm text-[var(--quiet)] transition-colors hover:text-[var(--accent-soft)]"
          >
            Create your own
          </a>
        </header>

        {loading ? (
          <p className="text-sm text-[var(--quiet)]">Loading shared brief…</p>
        ) : null}

        {error ? (
          <div
            className="bg-[rgba(80,30,30,0.35)] px-4 py-3 text-sm text-[var(--danger)]"
            style={{ boxShadow: "inset 0 0 0 1px rgba(232,160,160,0.25)" }}
          >
            {error}
          </div>
        ) : null}

        {data ? (
          <>
            <p className="text-[11px] text-[var(--quiet)]">{attribution}</p>
            <p className="text-sm text-[var(--muted)]">
              <span className="text-[var(--quiet)]">Idea</span>
              <span className="mt-1 block text-[var(--ink)]">{data.idea}</span>
            </p>
            <section className="draft-panel">
              <BriefSections mode={mode} markdown={data.output} loading={false} />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
