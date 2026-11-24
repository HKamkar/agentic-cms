// What a site's agent files must keep, however the site edits them. A rule
// or a skill marks a block required with REQUIRED at the end of its last
// line: a list item or a paragraph (the engines, each rule's tier line, the
// lint that ends a skill). The site may edit the rest of the file —
// `init --agent-files --check` calls it modified, and passes — but a marked
// block's words must stay, in their order: re-wrapped, re-indented, without
// the marker, in another case, its list marker the site's own, the site's
// words before or after them, never gone. A site's thin rule carries the
// kit's required blocks in its kit block (lib/agent-files.mjs), copied
// whole by requiredSources().
export const REQUIRED = "<!-- required -->";

const HEADING = /^#{1,6}\s/;
/** A line that starts a block of its own: a list item or a heading. */
const opensBlock = (line) => /^\s*(?:[-*+]|\d+[.)])\s/.test(line) || HEADING.test(line);
/** A line a block never reaches back across: a blank line, a heading, a code fence. */
const endsBlock = (line) => !line.trim() || HEADING.test(line) || /^\s*(?:```|~~~)/.test(line);
/** A text as the comparison reads it: the markers out, every run of whitespace one space. */
const flat = (text) => text.replaceAll(REQUIRED, " ").replace(/\s+/g, " ").trim();
/** A block's words as the site must keep them: its text without the list marker it opens with (a site writes its own, or its own words before the kit's), in any case. */
const words = (text) => text.replace(/^(?:[-*+]|\d+[.)])\s+/, "").toLowerCase();

/** Each block marked required as the lines it spans: [{ start, end }], 0-based, `end` the marked line. */
function requiredSpans(lines) {
  const spans = [];
  lines.forEach((line, at) => {
    if (!line.trimEnd().endsWith(REQUIRED)) return;
    let start = at;
    while (start > 0 && !opensBlock(lines[start]) && !endsBlock(lines[start - 1])) start--;
    spans.push({ start, end: at });
  });
  return spans;
}

/** The blocks of a text marked required, as the comparison reads them: [{ line, text }], `line` the block's first line (1-based). */
export function requiredBlocks(text) {
  const lines = text.split("\n");
  return requiredSpans(lines).map(({ start, end }) => ({ line: start + 1, text: flat(lines.slice(start, end + 1).join("\n")) }));
}

/** The blocks of a text marked required as the text has them, markers and all: one string per block. */
export function requiredSources(text) {
  const lines = text.split("\n");
  return requiredSpans(lines).map(({ start, end }) => lines.slice(start, end + 1).join("\n"));
}

/** The kit's required blocks whose words the site's text lacks: [{ line, text }], `line` where the kit's text has it. */
export function requiredGone(siteText, kitText) {
  const site = flat(siteText).toLowerCase();
  return requiredBlocks(kitText).filter(({ text }) => !site.includes(words(text)));
}
