// Pulls question/answer pairs out of a post body so the page can emit FAQPage
// JSON-LD without duplicating the FAQ in frontmatter. Convention: an H2 whose
// text contains "frequently asked" or "faq" — or the heading the post's
// language names (`faqHeading` in the site's config) — followed by H3
// questions, each answered by the paragraphs up to the next heading.

export type FaqItem = { question: string; answer: string };

/** The H2 that starts a post's FAQ: one whose text contains `heading` (a language's, `Häufige Fragen`), or without one "frequently asked" or "faq". */
export function faqHeading(heading?: string): RegExp {
  return heading ? new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : /frequently asked|faq/i;
}

// A bracket ends the text and the URL a match may span: scanning from every "![" or "](" to the next closing one,
// past further openers, was quadratic on a run of them.
const stripInline = (s: string) =>
  s
    .replace(/!\[[^\][]*\]\([^)[]*\)/g, "")
    .replace(/\[([^\][]+)\]\([^)[]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();

export function extractFaq(markdown: string, heading: RegExp = faqHeading()): FaqItem[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^##\s+/.test(l) && heading.test(l));
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
