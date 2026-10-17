// What a site must replace before it deploys, and what of the kit's example it
// must never keep (docs/roadmap-0.8.2.md D9). The starter `init` lays out
// marks its copy with PLACEHOLDER, inside each string, so a reader finds it by
// file and field and a writer removes it with the copy it replaces; its
// address stands on a domain reserved for examples (RFC 2606 and 6761:
// `.example`, `.test`, `.invalid`, `localhost`, example.com) until the site
// has its own. The content lint WARNs on both, FAILs on them in a
// production build (`lint --production`, which a site's `pnpm build` passes)
// and FAILs on the example's brand in a site at any time; `assemble` refuses a
// package while a placeholder remains; `demo new` says so before a round. The
// kit's own repository, where the example is the example, is exempt from the
// brand and the domain rules: it is told by its package name.
import fs from "node:fs";
import path from "node:path";

/** The marker a placeholder string carries, as it is written in the starter's files. */
export const PLACEHOLDER = "(placeholder)";
/** The kit's package name: a root whose package.json carries it is the kit's own repository. */
export const KIT_NAME = "agentic-cms";
/** In the environment of one run (a CI build that deploys nothing), placeholders stay warnings in a production build. */
export const PLACEHOLDERS_ENV = "AGENTIC_CMS_PLACEHOLDERS";

const MARKER = /\(placeholder\)/i;
/** What sits under content/ but is no collection a build reads: the door, the voice rules, the editorial plan. */
export const NOT_CONTENT = new Set(["README.md", "VOICE.md", "editorial"]);
/** The example's brand: its name as the example spells it, as a word (ACME, an acronym, is not it); its domain and its author, the one asset named after it, in any case. */
const BRAND_WORD = /(?<![A-Za-z0-9])Acme(?![A-Za-z0-9])/;
const BRAND_MARKS = /acme\.example|acme-editorial/i;
const TEXT = /\.(?:md|mdx|ya?ml|json|txt|ts|tsx|mjs|js|svg)$/i;

/** Whether a string is placeholder copy. */
export const hasPlaceholder = (text) => MARKER.test(text);

/** The host of an absolute URL, an e-mail address or a bare domain with its path (example.com/blog); null for anything else. */
const hostOf = (value) => value.match(/^https?:\/\/([^/:?#\s]+)/i)?.[1] ?? value.match(/^[^\s@]+@([^\s@>]+)$/)?.[1] ?? value.match(/^((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]\S*)?$/i)?.[1] ?? null;
/** Whether a URL, an address or a domain is one reserved for examples, which never resolves: a stand-in until the site has its own. */
export function onReservedDomain(value) {
  const host = hostOf(String(value).trim())?.toLowerCase();
  return Boolean(host && (/(?:^|\.)(?:example|test|invalid|localhost)$/.test(host) || /(?:^|\.)example\.(?:com|net|org)$/.test(host)));
}

/** Whether a root is the kit's own repository: its package.json is the kit's. */
export function isKit(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).name === KIT_NAME; } catch { return false; }
}

/** Whether placeholders stay warnings in this run's production build. */
export const placeholdersAllowed = (env = process.env) => env[PLACEHOLDERS_ENV] === "warn";

/**
 * The example's brand in a text: its domain or its author's key wherever they
 * are, its name as a word unless the site itself carries that name. The match,
 * or null.
 */
export function exampleBrandIn(text, { siteName = "" } = {}) {
  const mark = text.match(BRAND_MARKS);
  if (mark) return mark[0];
  if (BRAND_WORD.test(siteName)) return null;
  return text.match(BRAND_WORD)?.[0] ?? null;
}

const walk = (dir, base = dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")])) : []);

/**
 * Where a site keeps what the brand rule reads: every text file under
 * content/ (templates included), the config under src/config/, and under
 * public/ every file by its name and every SVG by its text. Paths are
 * root-relative.
 */
export function brandSources(root) {
  const under = (dir) => walk(path.join(root, dir)).map((rel) => `${dir}/${rel}`);
  return {
    texts: [...under("content"), ...under("src/config"), ...under("public").filter((file) => file.endsWith(".svg"))].filter((file) => TEXT.test(file)),
    names: under("public"),
  };
}

/** The example's brand left in a site: [{ file, path, found }], `path` a line (`line 3`) or empty for a file's own name. */
export function exampleBrandLeftovers(root, { siteName = "" } = {}) {
  const { texts, names } = brandSources(root);
  const out = [];
  for (const file of names) {
    const found = exampleBrandIn(file, { siteName });
    if (found) out.push({ file, path: "", found });
  }
  for (const file of texts) {
    fs.readFileSync(path.join(root, file), "utf8").split("\n").forEach((line, index) => {
      const found = exampleBrandIn(line, { siteName });
      if (found) out.push({ file, path: `line ${index + 1}`, found });
    });
  }
  return out;
}

/**
 * A file's comment lines, which no placeholder is: `#` in YAML and in a
 * Markdown file's frontmatter (in its body a `#` starts a heading, which is
 * copy), `//` and a block comment's lines in code.
 */
function commentsOf(file) {
  if (/\.ya?ml$/.test(file)) return (line) => /^\s*#/.test(line);
  if (/\.(?:ts|tsx|mjs|js)$/.test(file)) return (line) => /^\s*(?:\/\/|\/?\*)/.test(line);
  if (!/\.mdx?$/.test(file)) return () => false;
  let fences = 0;
  return (line) => { if (/^---\s*$/.test(line) && fences < 2) { fences += 1; return false; } return fences === 1 && /^\s*#/.test(line); };
}
/** A field path as the content engine prints it: sections[2].cards[0].text. */
const fieldPath = (segments) => segments.map((s, i) => (typeof s === "number" ? `[${s}]` : i ? `.${s}` : s)).join("");

/**
 * The fields of a parsed content file that still hold the starter's copy or
 * the example's brand: { placeholders, brand }, each a list of field paths (a
 * placeholder address counts outside the kit).
 */
export function copyNotes(value, { kit = false, siteName = "" } = {}) {
  const notes = { placeholders: [], brand: [] };
  const visit = (node, segments) => {
    if (typeof node === "string") {
      if (hasPlaceholder(node) || (!kit && onReservedDomain(node))) notes.placeholders.push(fieldPath(segments));
      if (!kit && exampleBrandIn(node, { siteName })) notes.brand.push(fieldPath(segments));
    } else if (Array.isArray(node)) node.forEach((item, i) => visit(item, [...segments, i]));
    else if (node && typeof node === "object") for (const [key, item] of Object.entries(node)) visit(item, [...segments, key]);
  };
  visit(value, []);
  return notes;
}

/** A field's or a line's name in a TypeScript config line: the key before the colon (`tagline`), else nothing. */
const keyOf = (line) => line.match(/^\s*["']?([\w$-]+)["']?\s*:/)?.[1];

/**
 * The placeholders in a site's files by line: every content file a build
 * reads (none whose name starts with _, none of NOT_CONTENT; `content: false`
 * leaves them to a reader that has the entries, the content lint), the
 * config under src/config/, and a reserved domain in src/config/site.ts
 * outside the kit; a comment is never one. [{ file, path, value, domain }],
 * `domain` true for an address.
 */
export function placeholderLines(root, { content = true } = {}) {
  const kit = isKit(root);
  const read = (dir) => walk(path.join(root, dir)).filter((rel) => !rel.split("/").some((part) => part.startsWith("_"))).map((rel) => `${dir}/${rel}`);
  const files = [...(content ? read("content").filter((file) => !NOT_CONTENT.has(file.split("/")[1])) : []), ...read("src/config")].filter((file) => TEXT.test(file));
  const out = [];
  for (const file of files) {
    const comment = commentsOf(file);
    fs.readFileSync(path.join(root, file), "utf8").split("\n").forEach((line, index) => {
      if (comment(line)) return;
      const at = `line ${index + 1}${keyOf(line) ? ` (${keyOf(line)})` : ""}`;
      if (hasPlaceholder(line)) out.push({ file, path: at, value: line.trim(), domain: false });
      else if (!kit && file === "src/config/site.ts" && reservedIn(line)) out.push({ file, path: at, value: reservedIn(line), domain: true });
    });
  }
  return out;
}

/** A URL or an address on a reserved domain inside a line of code, or null. */
function reservedIn(line) {
  for (const [value] of line.matchAll(/https?:\/\/[^\s"'`]+|[\w.+-]+@[\w.-]+/g)) if (onReservedDomain(value)) return value;
  return null;
}

/** How a placeholder is replaced, said once for every message. */
export const REPLACE = "write the site's own (/editorial:new-page, or by hand)";
