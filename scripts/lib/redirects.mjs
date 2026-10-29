// The change a site laid out before 0.9.0 needs for its redirects to be
// content (docs/roadmap-0.9.0.md job 9): an empty content/redirects.yaml,
// the starter's, and its Next config's redirects() returning redirectsFor()
// from agentic-cms/content, placed as the template has it. What the 0.9.0
// migration of `agentic-cms upgrade` applies; each edit is idempotent, and a
// config the edit cannot place (its own redirects(), no config object it
// can find) is a manual step that says what to write.
import path from "node:path";

/** The collection's file, as the engine reads it. */
export const REDIRECTS_FILE = "content/redirects.yaml";
/** The starter's empty list, which a site without the file takes. */
const STARTER_REDIRECTS = "templates/starter/content/redirects.yaml";
/** The Next configs a site may have, in the order Next looks for them. */
export const NEXT_CONFIGS = ["next.config.ts", "next.config.mts", "next.config.mjs", "next.config.js", "next.config.cjs"];

const IMPORT = 'import { redirectsFor } from "agentic-cms/content";';
const REQUIRE = 'const { redirectsFor } = require("agentic-cms/content");';
const KEY = (indent) => [
  `${indent}// content/redirects.yaml, read when Next loads this file at build time:`,
  `${indent}// an indexed URL that moved answers 308 to where it went (docs/redirects.md).`,
  `${indent}redirects: async () => redirectsFor(),`,
];
/** The line that opens the config object: `const nextConfig[: NextConfig] = {`, `export default {`, `module.exports = {`. */
const OPENS = /^(?:(?:export\s+)?const\s+\w+(?:\s*:\s*NextConfig)?\s*=|export\s+default|module\.exports\s*=)\s*\{\s*$/m;

/**
 * A Next config's text with redirects() returning redirectsFor():
 * { text } — the text unchanged when it already calls redirectsFor() — or
 * { manual } naming what to write by hand when it has redirects of its own
 * or no config object on a line of its own.
 */
export function withRedirects(text) {
  if (/\bredirectsFor\s*\(/.test(text)) return { text };
  const fix = "return [...redirectsFor(), ...the site's own] from it, with import { redirectsFor } from \"agentic-cms/content\" (docs/redirects.md)";
  if (/^\s*(?:async\s+)?redirects\s*(?:\(|:)/m.test(text)) return { manual: `it has a redirects() of its own: ${fix}` };
  const opens = text.match(OPENS);
  if (!opens) return { manual: `no config object the edit can find (const nextConfig = {, export default {): add redirects: async () => redirectsFor() to it, with ${IMPORT}` };
  const at = opens.index + opens[0].length + 1;
  const indent = text.slice(at).match(/^([ \t]+)\S/)?.[1] ?? "  ";
  const keyed = `${text.slice(0, at)}${KEY(indent).join("\n")}\n${text.slice(at)}`;
  return { text: withLoad(keyed, /^module\.exports\s*=/m.test(text) ? REQUIRE : IMPORT) };
}

/** The import (or the require) after the last one at the top, else first. */
function withLoad(text, line) {
  const lines = text.split("\n");
  const loads = lines.map((l, i) => (/^import\s|^const\s+\{?[\w\s,{}]*\}?\s*=\s*require\(/.test(l) ? i : -1)).filter((i) => i !== -1);
  const after = loads.length ? loads.at(-1) + 1 : 0;
  return [...lines.slice(0, after), line, ...lines.slice(after)].join("\n");
}

/**
 * The edits a site needs, against its root (`fs` and the kit's root
 * injected): { edits: [{ file, text }], manual: [{ file, step }] } — the
 * starter's empty content/redirects.yaml when the site has none, its Next
 * config with redirects() (the first of NEXT_CONFIGS it has; a site with
 * none is told to take the template's). Nothing when it has both.
 */
export function redirectEdits(root, { fs, kitRoot }) {
  const edits = [];
  const manual = [];
  if (!fs.existsSync(path.join(root, REDIRECTS_FILE))) edits.push({ file: REDIRECTS_FILE, text: fs.readFileSync(path.join(kitRoot, STARTER_REDIRECTS), "utf8") });
  const config = NEXT_CONFIGS.find((file) => fs.existsSync(path.join(root, file)));
  if (!config) manual.push({ file: "next.config.ts", step: "no Next config: take node_modules/agentic-cms/templates/site/next.config.ts, which serves content/redirects.yaml" });
  else {
    const before = fs.readFileSync(path.join(root, config), "utf8");
    const after = withRedirects(before);
    if (after.manual) manual.push({ file: config, step: after.manual });
    else if (after.text !== before) edits.push({ file: config, text: after.text });
  }
  return { edits, manual };
}
