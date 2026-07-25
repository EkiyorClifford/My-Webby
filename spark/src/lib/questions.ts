/** Pull bullet questions from the "Open questions for the founder" section. */
export function extractOpenQuestions(markdown: string): string[] {
  const match = markdown.match(
    /##\s*Open questions for the founder\s*\n([\s\S]*?)(?=\n##\s|$)/i,
  );
  if (!match) return [];

  const block = match[1];
  const bullets = [...block.matchAll(/^\s*[-*]\s+(.+)$/gm)].map((m) =>
    m[1].replace(/\*\*/g, "").trim(),
  );

  if (bullets.length) return bullets.slice(0, 6);

  const numbered = [...block.matchAll(/^\s*\d+[.)]\s+(.+)$/gm)].map((m) =>
    m[1].replace(/\*\*/g, "").trim(),
  );
  return numbered.slice(0, 6);
}
