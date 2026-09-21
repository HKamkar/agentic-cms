// The lab's pure parts, for `agentic-cms lab`: the scratch folder and its
// scenes (one SVG file each), the three templates a scene starts from, the
// site's tokens read from the @theme block of src/app/globals.css, and the
// text transforms a render applies to a scene (tokens resolved to one scheme,
// the animation stripped for a still). Nothing here touches a browser; the
// server is lab-server.mjs, the page lab-page.mjs, the render lab-render.mjs.
import fs from "node:fs";
import path from "node:path";
import { relative } from "./page-command.mjs";

export const LAB_DIR = ".parity/lab";
export const KINDS = ["icon", "mark", "loop"];
/** Lowercase letters, digits and hyphens: a file name, a URL segment, a CSS name prefix. */
export const isSceneName = (name) => /^[a-z0-9][a-z0-9-]*$/.test(name);
export const LAB_COMMENT = /<!--\s*agentic-cms lab:[\s\S]*?-->\s*/g;

// The templates carry only the kit's own contracts — Icon's 24 grid and
// stroke, the 64 grid of the icon families, the reduced-motion rule — drawn
// as the wireframe's crossed box in currentColor: no colour, no font, no
// easing of any site.
const TEMPLATES = {
  icon: () => `<!-- agentic-cms lab: icon on the Icon component's contract: 24 grid, stroke 1.6 in currentColor, round caps, flat shapes and one paint (icons add file:<name>) -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18"/>
  <path d="M3 3l18 18M21 3L3 21"/>
</svg>
`,
  mark: () => `<!-- agentic-cms lab: mark on the 64 grid; currentColor and the var() tokens follow the page inline, and a render to .svg resolves them for an <img> (no double hyphen in a comment: XML forbids it) -->
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="0.5" y="0.5" width="63" height="63" fill="var(--color-fill, none)" stroke="currentColor"/>
  <path d="M0 0L64 64M64 0L0 64" stroke="currentColor"/>
</svg>
`,
  loop: (name) => `<!-- agentic-cms lab: loop; transform and opacity only, the reduced-motion rule in every CSS loop, SMIL (<animate>) for what ships as an <img>, data-duration one cycle in seconds -->
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" data-duration="2">
  <style>
    @keyframes ${name}-turn { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .${name}-turn { animation: ${name}-turn 2s linear infinite; transform-box: fill-box; transform-origin: center; }
    @media (prefers-reduced-motion: reduce) { .${name}-turn { animation: none; } }
  </style>
  <rect class="${name}-turn" x="16" y="16" width="32" height="32" fill="none" stroke="currentColor"/>
  <circle cx="8" cy="32" r="3" fill="currentColor">
    <animate attributeName="cx" values="8;56;8" dur="2s" repeatCount="indefinite"/>
  </circle>
</svg>
`,
};

/** The SVG text a scene of that kind starts from. */
export function sceneTemplate(kind, name) {
  if (!TEMPLATES[kind]) throw new Error(`${kind} is not a kind of scene (${KINDS.join(", ")})`);
  if (!isSceneName(name)) throw new Error(`${name}: a scene name is lowercase letters, digits and hyphens`);
  return TEMPLATES[kind](name);
}

const walkSvg = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).sort().flatMap((f) => walkSvg(path.join(p, f))) : p.endsWith(".svg") ? [p] : []);

/** Every scene as id → file: the lab's own by name, `extra` files and folders (walked for .svg) by their path under root without the extension. A missing extra path throws. */
export function listScenes(root, { extra = [] } = {}) {
  const scenes = new Map();
  const lab = path.join(root, LAB_DIR);
  if (fs.existsSync(lab)) for (const f of fs.readdirSync(lab).sort()) if (f.endsWith(".svg")) scenes.set(f.slice(0, -4), path.join(lab, f));
  for (const p of extra) {
    const full = path.resolve(root, p);
    if (!fs.existsSync(full)) throw new Error(`${p}: no such file or folder`);
    for (const file of walkSvg(full)) scenes.set(relative(root, file).replace(/\.svg$/, ""), file);
  }
  return scenes;
}

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));

/** The root's size and duration: width/height from the attributes, else the viewBox; data-duration in seconds (0 when absent). */
export function sceneMeta(svg) {
  const root = svg.match(/<svg\b[^>]*>/)?.[0];
  if (!root) throw new Error("not an SVG: no <svg> root");
  const a = attrs(root);
  const box = a.viewBox?.trim().split(/[\s,]+/).map(Number);
  const width = Number.parseFloat(a.width) || (box?.[2] ?? 0);
  const height = Number.parseFloat(a.height) || (box?.[3] ?? 0);
  return { width, height, viewBox: a.viewBox ?? null, duration: Number(a["data-duration"]) || 0 };
}

/** The colour and font tokens of a globals.css: every --color-* and --font-* declared in its @theme block, values verbatim (light-dark() included), resets to `initial` skipped. */
export function readThemeTokens(css) {
  const start = css.search(/@theme\b[^{]*\{/);
  if (start === -1) return {};
  const open = css.indexOf("{", start);
  let depth = 0, end = css.length;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) { end = i; break; }
  }
  const block = css.slice(open + 1, end).replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = {};
  for (const m of block.matchAll(/(--(?:color|font)-[\w-]+)\s*:\s*([^;]+);/g)) if (m[2].trim() !== "initial") tokens[m[1]] = m[2].trim();
  return tokens;
}

// Without a globals.css the page runs on the system colours, never on a hex
// of the kit's: the lab shows a site's tokens or none.
const SYSTEM_TOKENS = { "--color-paper": "Canvas", "--color-ink": "CanvasText", "--color-fill": "ButtonFace", "--color-muted": "GrayText", "--font-sans": "system-ui, sans-serif", "--font-label": "ui-monospace, monospace" };

/** The tokens as a :root block with `color-scheme: light dark`, so light-dark() values follow the color-scheme of any element. */
export function tokensCss(tokens) {
  const own = Object.keys(tokens).length ? tokens : SYSTEM_TOKENS;
  return `:root {\n  color-scheme: light dark;\n${Object.entries(own).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`;
}

/** The site's tokens (src/app/globals.css under root), or {} without one. */
export function siteTokens(root) {
  const file = path.join(root, "src/app/globals.css");
  return fs.existsSync(file) ? readThemeTokens(fs.readFileSync(file, "utf8")) : {};
}

/** The scene as a standalone file for one scheme: var(--color-*) and currentColor replaced by the given hex values, light-dark() reduced to that side, the lab comment and data-duration dropped. */
export function resolveTokens(svg, { colors = {}, current, scheme = "light" }) {
  const side = scheme === "dark" ? 2 : 1;
  return svg
    .replace(LAB_COMMENT, "")
    .replace(/\s+data-duration="[^"]*"/, "")
    .replace(/light-dark\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g, (m, light, dark) => (side === 2 ? dark : light))
    .replace(/var\(\s*(--color-[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (m, name, fallback) => colors[name] ?? fallback?.trim() ?? m)
    .replace(/currentColor/g, current ?? colors["--color-ink"] ?? "currentColor");
}

/** The scene with its animation removed — SMIL elements gone, @keyframes and animation declarations dropped from its styles — for the still of a loop. */
export function stripAnimation(svg) {
  return svg
    .replace(/<(animate|animateTransform|animateMotion|set|mpath)\b[^>]*\/>\s*/g, "")
    .replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*>[\s\S]*?<\/\1>\s*/g, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, (block) => block
      .replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}\s*/g, "")
      .replace(/\banimation(?:-[a-z-]+)?\s*:[^;}]*;?\s*/g, ""));
}

/** "24,40,64" → [24, 40, 64]; throws on anything that is not a positive whole pixel. */
export function parseSizes(text) {
  if (!text?.trim()) return [];
  return text.split(",").map((s) => {
    const n = Number(s.trim());
    if (!Number.isInteger(n) || n < 1) throw new Error(`${s.trim()} is not a size in whole pixels`);
    return n;
  });
}

const FORMATS = { ".svg": "svg", ".webp": "webp", ".png": "png", ".jpg": "jpg", ".jpeg": "jpg", ".webm": "webm", ".mp4": "mp4" };
const RASTERS = ["webp", "png", "jpg", "webm", "mp4"];
/** Whether a scene paints with the page's colours — currentColor or a var(--color-*) token — which a file of it carries for one scheme only. */
export const followsTheme = (svg) => /currentColor|var\(\s*--color-/.test(svg.replace(LAB_COMMENT, ""));

/** Whether a scene's text animates: a SMIL element, or a keyframes or animation declaration in its styles. */
export const animates = (svg) => /<(animate|animateTransform|animateMotion|set)\b/.test(svg) || /@keyframes|\banimation(-[a-z-]+)?\s*:/.test(svg);

/** What a render writes for --out and the flags: the format, whether it is a frame sequence and its times, the ground, the still and the source it writes beside the file. `duration` is the scene's, already resolved. */
export function renderPlan(out, { at = 0, animate = false, frames = 0, fps = 30, background = "transparent", poster = true, source = true } = {}, { duration = 0, animated: sceneAnimates = false } = {}) {
  const format = FORMATS[path.extname(out).toLowerCase()];
  if (!format) throw new Error(`${path.extname(out) || "no extension"}: a render writes .svg, .webp, .png, .jpg, .webm or .mp4`);
  if (!(fps > 0)) throw new Error(`--fps must be above 0, not ${fps}`);
  const video = format === "webm" || format === "mp4";
  const sequence = video || (format === "webp" && (animate || frames > 0));
  const span = duration > 0 ? duration : 1;
  const count = sequence ? (frames > 0 ? Math.round(frames) : Math.max(1, Math.round(span * fps))) : 1;
  const times = Array.from({ length: count }, (_, i) => at + (sequence ? i / fps : 0));
  const ground = format === "jpg" ? "paper" : background;
  const base = out.replace(/\.[^.]+$/, "");
  const still = poster && (sequence || (format === "svg" && sceneAnimates)) ? `${base}-still.${format === "svg" ? "svg" : "webp"}` : null;
  return { format, sequence, video, times, fps, delay: Math.round(1000 / fps), background: ground, still, source: source && RASTERS.includes(format) ? `${base}.svg` : null };
}

/** The colour tokens as one scheme's values: light-dark() reduced to that side, var() chains followed, anything else verbatim. { colors: { "--color-ink": "#000000", … }, current, paper } */
export function resolveTokenColors(tokens, scheme = "light") {
  const side = scheme === "dark" ? 2 : 1;
  const colors = {};
  const resolve = (name, depth = 0) => {
    const value = tokens[name];
    if (value === undefined || depth > 8) return undefined;
    const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (ref) return resolve(ref[1], depth + 1);
    return value.replace(/light-dark\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g, (m, light, dark) => (side === 2 ? dark : light)).trim();
  };
  for (const name of Object.keys(tokens)) if (name.startsWith("--color-")) { const v = resolve(name); if (v !== undefined) colors[name] = v; }
  return { colors, current: colors["--color-ink"] ?? "currentColor", paper: colors["--color-paper"] ?? "#ffffff" };
}
