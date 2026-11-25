// A motion story's half of the audit that needs no browser: what a build says
// about the pages that tell one (an element with `data-story`,
// docs/motion-story.md § The check). `agentic-cms seo` runs it over every
// prerendered page, so a site without a story is told nothing.
//   - story-words: the story has a heading and text in the prerendered HTML;
//   - story-canvas: its canvases are hidden from a screen reader;
//   - story-weight: the scripts that open a WebGL context, compressed;
//   - story-scripts: no other page's HTML loads one of them.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/** The script of a story, compressed (docs/motion-story.md § The budget). */
export const SCRIPT_KB = 60;
/** The least text a story has in its HTML: a heading and a sentence. */
const LEAST_WORDS = 12;

const STORY = /<([a-z][a-z0-9-]*)(?=[^>]*\sdata-story(?=[\s=>/]))[^>]*>/i;
const CONTEXT = /["'`](?:experimental-)?webgl2?["'`]/;
const VOID_TEXT = /<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi;

/** The story element of a page's HTML, its opening tag to its closing one; null when the page tells none. */
export function storyOf(html) {
  const open = html.match(STORY);
  if (!open) return null;
  const tags = new RegExp(`<(/?)${open[1]}\\b[^>]*>`, "gi");
  tags.lastIndex = open.index;
  let depth = 0;
  for (let tag; (tag = tags.exec(html)); ) {
    depth += tag[1] ? -1 : 1;
    if (!depth) return html.slice(open.index, tags.lastIndex);
  }
  return html.slice(open.index);
}

const textOf = (html) => html.replace(VOID_TEXT, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const scriptsIn = (html) => [...html.matchAll(/<script\b[^>]*\ssrc="([^"?]+)/g)].map((m) => m[1]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

/** The scripts of a build that open a WebGL context: [{ url, kb }], compressed. */
export function engineScripts(root) {
  const dir = path.join(root, ".next/static");
  return walk(dir).filter((file) => file.endsWith(".js")).map((file) => ({ url: `/_next/static/${path.relative(dir, file).split(path.sep).join("/")}`, source: fs.readFileSync(file) }))
    .filter(({ source }) => CONTEXT.test(source)).map(({ url, source }) => ({ url, kb: zlib.gzipSync(source).length / 1024 }));
}

/** What is wrong inside the story's own HTML: [{ rule, msg }]. */
function markupFindings(story) {
  const out = [], words = textOf(story).split(" ").filter(Boolean).length;
  if (!/<h[1-6]\b/i.test(story) || words < LEAST_WORDS) out.push({ rule: "story-words", msg: `the story has ${/<h[1-6]\b/i.test(story) ? `${words} words` : "no heading"} in its HTML: every word is in the page's content file and rendered on the server, and the scene only finds it` });
  const seen = [...story.matchAll(/<canvas\b[^>]*>/gi)].filter(([tag]) => !/\saria-hidden="true"/.test(tag)).length;
  if (seen) out.push({ rule: "story-canvas", msg: `${seen} of its <canvas> ${seen === 1 ? "has" : "have"} no aria-hidden="true": the words beside it say what it shows` });
  return out;
}

/** The findings of every page that tells a story, and of the pages that load its scripts without telling one: [{ route, rule, msg }]; [] when no page does. */
export function storyFindings(root, pages) {
  const told = pages.map(({ route, html }) => ({ route, html, story: storyOf(html) }));
  if (!told.some(({ story }) => story)) return [];
  const engine = engineScripts(root), urls = new Set(engine.map(({ url }) => url)), kb = engine.reduce((sum, script) => sum + script.kb, 0);
  const out = told.filter(({ story }) => story).flatMap(({ route, story }) => markupFindings(story).map((finding) => ({ route, ...finding })));
  if (kb > SCRIPT_KB) out.push({ route: told.find(({ story }) => story).route, rule: "story-weight", msg: `the story's scripts are ${kb.toFixed(0)} KB compressed (at most ${SCRIPT_KB}): ${engine.map((s) => `${path.basename(s.url)} ${s.kb.toFixed(0)} KB`).join(", ")}` });
  for (const { route, html } of told.filter(({ story }) => !story)) {
    const loaded = scriptsIn(html).find((src) => urls.has(src));
    if (loaded) out.push({ route, rule: "story-scripts", msg: `loads the story's engine (${path.basename(loaded)}) and tells no story: import it on the story's page alone, on demand (import("./story") in an effect)` });
  }
  return out;
}
