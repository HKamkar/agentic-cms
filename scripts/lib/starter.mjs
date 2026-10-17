// What `agentic-cms init` lays out in the example's content's place, for a
// site of its own name (docs/roadmap-0.8.2.md D8): templates/starter/ — one
// home page and the blog index with their copy marked as placeholder, the
// collections empty, the wireframe's neutral pictures, the config with the
// site's name — its {{tokens}} filled in; the example's files under content/
// that are none of its content (the door, the templates, the editorial plan);
// a voice file and a logo written for the name. None of the example's posts,
// reviews, use cases, FAQs, author, catalogue pages or pictures: the example
// stays in the kit's own repository. The placeholder marker and the reserved
// domain the starter stands on are lib/placeholders.mjs.
import fs from "node:fs";
import path from "node:path";

/** The starter's tree in the kit, its paths the site's. */
export const STARTER = "templates/starter";
/** The example's files under content/ that are none of its content, which a new site takes as they are. */
export const SHARED_CONTENT = ["content/README.md", "content/_templates", "content/blog/_template.md", "content/editorial"];
/** The blank the site's voice file is written from. */
const VOICE_TEMPLATE = "content/_templates/VOICE.md";
const VOICE_START = "<!-- voice-rules:start -->";
const TEXT = /\.(?:md|ya?ml|json|ts|tsx|svg)$/;
const TOKEN = /\{\{(\w+)\}\}/g;

/** A name, a URL or an address init cannot use: exit 2, nothing written. */
export class StarterError extends Error {}

/** A site's own files: its copy, its pictures, its brand and its forms — never overwritten, --force included. */
export const isSiteOwn = (file) => /^(?:content|public)\//.test(file) || file === "src/config/site.ts" || file === "src/config/forms.ts";

/** A folder's name as a brand: its words capitalised (my-site → My Site). */
export const nameOfFolder = (folder) => folder.split(/[-_.\s]+/).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
/** A name as a DNS label and a file name: lowercase ASCII letters, digits and single hyphens. */
export const slugOf = (name) => name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * The site init lays out: { name, slug, url, email, domain, today }. The name
 * defaults to the folder's; without --url and --email, the address stands on
 * a reserved domain (<slug>.example), which the content lint marks. Throws a
 * StarterError for an empty name, a URL that is not an origin, or an address
 * that is not one.
 */
export function siteIdentity(target, { name, url, email, now = new Date() } = {}) {
  const siteName = (name ?? nameOfFolder(path.basename(path.resolve(target)))).trim();
  if (!siteName) throw new StarterError("--name is empty: give the site's name, as it is spelled");
  const slug = slugOf(siteName) || slugOf(path.basename(path.resolve(target))) || "site";
  const origin = url === undefined ? `https://${slug}.example` : originOf(url);
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StarterError(`--email ${email}: not an e-mail address`);
  return { name: siteName, slug, url: origin, email: email ?? `hello@${slug}.example`, domain: new URL(origin).host, today: now.toISOString().slice(0, 10) };
}

/** A URL as the site's origin, `https://host` without a trailing slash; a path, a query or another scheme is refused. */
function originOf(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new StarterError(`--url ${url}: not a URL; give the site's origin, https://<host>`); }
  if (!/^https?:$/.test(parsed.protocol) || parsed.pathname.replace(/\/+$/, "") || parsed.search || parsed.hash) throw new StarterError(`--url ${url}: give the site's origin alone, https://<host>, without a path`);
  return parsed.origin;
}

/** A starter file's text with its tokens filled in: each value escaped for the double-quoted string it sits in (TypeScript, YAML and JSON read the same escapes). */
export function fill(text, identity, file = "") {
  return text.replace(TOKEN, (_, key) => {
    if (!(key in identity)) throw new StarterError(`${file}: {{${key}}} is no token of the starter (${Object.keys(identity).join(", ")}) — a kit bug to report`);
    return JSON.stringify(String(identity[key])).slice(1, -1);
  });
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The name inside the voice block's `\b(?:…)\b`: escaped, and without the non-word characters at its ends, which no word boundary sits beside (Co. → Co). */
const nameInRegex = (name) => escapeRegex(name.replace(/^[^A-Za-z0-9_]+|[^A-Za-z0-9_]+$/g, "") || name);

/**
 * The site's content/VOICE.md, from the blank: the brand's name where the
 * blank says <the brand> — in the prose as it is, in the rules block as YAML
 * (its name) and inside the regular expressions (subject, stack) escaped
 * (nameInRegex) —
 * and the blank's opening note replaced by what a new site does with it.
 */
export function voiceFile(blank, name) {
  const at = blank.indexOf(VOICE_START);
  if (at === -1 || !/^<!-- Copy this file[\s\S]*?-->\n/m.test(blank)) throw new StarterError(`${VOICE_TEMPLATE}: its opening note or its ${VOICE_START} marker is not where the starter expects them — a kit bug to report`);
  const prose = blank.slice(0, at).replace(/^<!-- Copy this file[\s\S]*?-->\n/m, NOTE).replaceAll("<the brand>", name);
  const block = blank.slice(at).replace(/^( *name:) <the brand>$/m, `$1 ${JSON.stringify(name)}`).replaceAll("<the brand>", JSON.stringify(nameInRegex(name)).slice(1, -1));
  return prose + block;
}
const NOTE = `<!-- agentic-cms init wrote this file from content/_templates/VOICE.md
with the site's name in it. The block at the end is the generic starting
point and already applies (pnpm content:lint reads it); write the sections
above it for this site, add its own rules to the block, keep the headings
(the editorial plugin's skills read them by name), and delete this note. -->
`;

/** The Markdown files that describe the example's own pages, so carry the markers starterMarkdown() reads. */
export const EXAMPLE_MARKED = ["STANDARD.md"];

/**
 * A Markdown file as a site from the starter reads it: each passage on the
 * example's own pages — between `<!-- example:start -->` and
 * `<!-- example:end -->`, on lines of their own or inside one — removed with
 * what it holds, and `<!-- starter: … -->` unwrapped in its place (the
 * --light-only markers' scheme). Throws a StarterError, before anything is
 * written, for a file that should carry markers and does not, or a marker
 * left over: a kit change that moved one, to report.
 */
export function starterMarkdown(text, file) {
  if (text.includes("example:start") !== text.includes("example:end")) throw new StarterError(`${file}: an example:start without its example:end, or the reverse — a kit bug to report`);
  if (EXAMPLE_MARKED.includes(file) && !text.includes("<!-- example:start -->")) throw new StarterError(`${file}: no <!-- example:start --> marker — init cannot find the passages on the example's own pages (a kit bug to report)`);
  const out = text
    .replace(/^<!-- example:start -->\n[\s\S]*?^<!-- example:end -->\n/gm, "")
    .replace(/<!-- example:start -->[\s\S]*?<!-- example:end -->/g, "")
    .replace(/<!-- starter: ([\s\S]*?)\s*-->/g, "$1");
  if (/example:(?:start|end)|<!-- starter:/.test(out)) throw new StarterError(`${file}: a starter marker is still there after the edits — a kit bug to report`);
  return out;
}

const xml = (text) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

/** The neutral logo placeholder, the wireframe's: the site's name in a hairline box, its title the name (what reads it aloud). */
export function logoSvg(name) {
  const size = Math.min(36, Math.max(12, Math.floor(360 / Math.max(1, [...name].length))));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80" role="img" aria-label="${xml(name)}">
<title>${xml(name)}</title>
<rect x="0.5" y="0.5" width="239" height="79" fill="none" stroke="#8c8c8c"/>
<text x="120" y="40" fill="#8c8c8c" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="${size}" font-weight="600" text-anchor="middle" dominant-baseline="central">${xml(name)}</text>
</svg>
`;
}

const walk = (dir, base = dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")])) : []);
const filesOf = (kitRoot, entry) => (fs.statSync(path.join(kitRoot, entry)).isFile() ? [entry] : walk(path.join(kitRoot, entry)).map((rel) => `${entry}/${rel}`));

/** The starter's files for one site, by the path each lands at: a text with its tokens filled in, or a picture's bytes. */
export function starterFiles(kitRoot, identity) {
  const files = new Map();
  for (const file of SHARED_CONTENT.flatMap((entry) => filesOf(kitRoot, entry))) files.set(file, fs.readFileSync(path.join(kitRoot, file)));
  for (const file of walk(path.join(kitRoot, STARTER))) {
    const bytes = fs.readFileSync(path.join(kitRoot, STARTER, file));
    files.set(file, TEXT.test(file) ? fill(bytes.toString("utf8"), identity, `${STARTER}/${file}`) : bytes);
  }
  files.set("content/VOICE.md", voiceFile(fs.readFileSync(path.join(kitRoot, VOICE_TEMPLATE), "utf8"), identity.name));
  files.set(`public/images/brand/${identity.slug}-logo.svg`, logoSvg(identity.name));
  return files;
}
