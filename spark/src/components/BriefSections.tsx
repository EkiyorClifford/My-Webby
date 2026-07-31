"use client";

import {
  parseSectionBodies,
  sectionsForMode,
  type BriefMode,
} from "@/lib/sections";

function renderBodyHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(
      /^### (.+)$/gm,
      '<h3 class="mt-3 mb-1 text-base font-medium text-[var(--ink)]">$1</h3>',
    )
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-[var(--ink)]">$1</strong>',
    )
    .replace(
      /^\s*Done when:\s*(.+)$/gim,
      '<p class="ml-6 mb-2 text-xs text-[var(--accent)]">Done when: $1</p>',
    )
    .replace(
      /^- (.+)$/gm,
      '<li class="ml-4 list-disc text-[var(--muted)]">$1</li>',
    )
    .replace(
      /^(?!<[hl]|<li|<[pP])(.+)$/gm,
      '<p class="my-2 text-[var(--muted)] leading-relaxed">$1</p>',
    )
    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="my-2 space-y-1">$1</ul>')
    .replace(/<\/ul>\s*<ul class="my-2 space-y-1">/g, "");
}

type BriefSectionsProps = {
  mode: BriefMode;
  markdown: string;
  loading: boolean;
};

export default function BriefSections({
  mode,
  markdown,
  loading,
}: BriefSectionsProps) {
  const sections = sectionsForMode(mode);
  const bodies = parseSectionBodies(markdown, sections);

  return (
    <div className="space-y-6 text-sm">
      {sections.map((section) => {
        const body = bodies[section.id] || "";
        const waiting = loading && !body;

        return (
          <section key={section.id} className="min-h-[3.5rem]">
            <h2 className="font-display text-lg font-medium text-[var(--ink)]">
              {section.label}
            </h2>
            {body ? (
              <div
                className="prose-spark mt-1"
                dangerouslySetInnerHTML={{ __html: renderBodyHtml(body) }}
              />
            ) : (
              <p className="mt-2 text-xs text-[var(--quiet)]">
                {waiting ? "waiting for content…" : "·"}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
