// Pulls question/answer pairs out of a post body so the page can emit FAQPage
// JSON-LD without duplicating the FAQ in frontmatter. Convention: an H2 whose
// text contains "frequently asked" or "faq", followed by H3 questions, each
// answered by the paragraphs up to the next heading.

export type FaqItem = { question: string; answer: string };

const stripInline = (s: string) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();

export function extractFaq(markdown: string): FaqItem[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^##\s+/.test(l) && /frequently asked|faq/i.test(l));
  if (start < 0) return [];

  const items: FaqItem[] = [];
  let current: FaqItem | null = null;
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    const q = line.match(/^###\s+(.+)/);
    if (q) {
      current = { question: stripInline(q[1]), answer: "" };
      items.push(current);
      continue;
    }
    if (current && line.trim()) {
      current.answer += (current.answer ? " " : "") + stripInline(line);
    }
  }
  return items.filter((i) => i.question && i.answer);
}
