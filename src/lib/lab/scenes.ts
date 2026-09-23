// The lab's scenes, one implementation for the command line (scripts/lab.mjs,
// through the package) and for the route inside the site (LabScenes): the
// scratch folder, the files under it and under extra folders as ids, an SVG
// file's size and duration off its root, its text as inline markup, and what
// its text says about it — whether it animates, whether it paints in the
// page's ink. Plain TypeScript, no React, loadable by the kit's scripts.
import fs from "node:fs";
import path from "node:path";

export const LAB_DIR = ".parity/lab";
/** Lowercase letters, digits and hyphens: a file name, a URL segment, a CSS name prefix. */
export const isSceneName = (name: string): boolean => /^[a-z0-9][a-z0-9-]*$/.test(name);
/** The comment a template starts with. */
export const LAB_COMMENT = /<!--\s*agentic-cms lab:[\s\S]*?-->\s*/g;

export type SceneMeta = { width: number; height: number; viewBox: string | null; duration: number };

const attrs = (tag: string): Record<string, string> => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
const walkSvg = (p: string): string[] => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).sort().flatMap((f) => walkSvg(path.join(p, f))) : p.endsWith(".svg") ? [p] : []);
const relative = (root: string, file: string): string => path.relative(root, file).split(path.sep).join("/");

/** Every scene as id → file: the lab's own by name, `extra` files and folders (walked for .svg) by their path under root without the extension. A missing extra path throws. */
export function listScenes(root: string, { extra = [] }: { extra?: string[] } = {}): Map<string, string> {
  const scenes = new Map<string, string>();
  const lab = path.join(root, LAB_DIR);
  if (fs.existsSync(lab)) for (const f of fs.readdirSync(lab).sort()) if (f.endsWith(".svg")) scenes.set(f.slice(0, -4), path.join(lab, f));
  for (const p of extra) {
    const full = path.resolve(root, p);
    if (!fs.existsSync(full)) throw new Error(`${p}: no such file or folder`);
    for (const file of walkSvg(full)) scenes.set(relative(root, file).replace(/\.svg$/, ""), file);
  }
  return scenes;
}

/** The root's size and duration: width/height from the attributes, else the viewBox; data-duration in seconds (0 when absent). */
export function sceneMeta(svg: string): SceneMeta {
  const root = svg.match(/<svg\b[^>]*>/)?.[0];
  if (!root) throw new Error("not an SVG: no <svg> root");
  const a = attrs(root);
  const box = a.viewBox?.trim().split(/[\s,]+/).map(Number);
  const width = Number.parseFloat(a.width) || (box?.[2] ?? 0);
  const height = Number.parseFloat(a.height) || (box?.[3] ?? 0);
  return { width, height, viewBox: a.viewBox ?? null, duration: Number(a["data-duration"]) || 0 };
}

/** An SVG file's text as inline markup: the XML prolog and the comments dropped. */
export const svgMarkup = (text: string): string => text.replace(/^<\?xml[^>]*>\s*/, "").replace(/<!--[\s\S]*?-->\s*/g, "");

/** Whether a scene's text animates: a SMIL element, or a keyframes or animation declaration in its styles. */
export const animates = (svg: string): boolean => /<(animate|animateTransform|animateMotion|set)\b/.test(svg) || /@keyframes|\banimation(-[a-z-]+)?\s*:/.test(svg);

/** Whether a scene paints with the page's colours — currentColor or a var(--color-*) token — which a file of it carries for one scheme only. */
export const followsTheme = (svg: string): boolean => /currentColor|var\(\s*--color-/.test(svg.replace(LAB_COMMENT, ""));

/** The root <svg> of a scene's markup tagged with a class (and sized, when asked), so a page can address it. */
export function tagRoot(markup: string, className: string, size?: { width: number; height: number }): string {
  const root = markup.match(/<svg\b[^>]*>/)?.[0];
  if (!root) throw new Error("not an SVG: no <svg> root");
  let tagged = /\sclass="/.test(root) ? root.replace(/\sclass="/, ` class="${className} `) : root.replace(/^<svg\b/, `<svg class="${className}"`);
  if (size) tagged = tagged.replace(/\s(width|height)="[^"]*"/g, "").replace(/^<svg\b/, `<svg width="${size.width}" height="${size.height}"`);
  return markup.replace(root, tagged);
}

/** A time in SMIL or CSS ("2s", "150ms", "1.5") in seconds; NaN when it is not one. */
const seconds = (value: string): number => {
  const m = value.trim().match(/^(-?\d*\.?\d+)(ms|s)?$/);
  return m ? Number(m[1]) / (m[2] === "ms" ? 1000 : 1) : Number.NaN;
};

/** One cycle in seconds, read from a scene's source rather than restated: its data-duration, else the longest begin + dur of its SMIL and delay + duration of its CSS animations; 0 when it declares none. */
export function sceneDuration(svg: string): number {
  const declared = sceneMeta(svg).duration;
  if (declared) return declared;
  let max = 0;
  for (const tag of svg.match(/<(?:animate|animateTransform|animateMotion|set)\b[^>]*>/g) ?? []) {
    const a = attrs(tag);
    const dur = seconds(a.dur ?? "");
    const begin = seconds((a.begin ?? "0").split(";")[0]);
    if (dur > 0) max = Math.max(max, (Number.isFinite(begin) ? begin : 0) + dur);
  }
  for (const block of svg.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) ?? []) {
    for (const [, longhand, value] of block.matchAll(/animation(-duration)?\s*:\s*([^;}]+)/g)) {
      for (const part of value.split(",")) {
        const times = part.split(/\s+/).map(seconds).filter(Number.isFinite);
        if (times.length) max = Math.max(max, longhand ? times[0] : times[0] + (times[1] ?? 0));
      }
    }
  }
  return max;
}

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A copy of a scene whose ids are its own: every id becomes `<prefix>-<id>`, and every reference follows — url(#…), href and xlink:href "#…", a SMIL begin/end on an element, an ARIA id list, a #… selector in its styles — so copies of one scene on one page never resolve each other's masks, clip paths, gradients or <use> targets. */
export function namespaceIds(markup: string, prefix: string): string {
  const ids = new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  if (!ids.size) return markup;
  const name = (id: string) => (ids.has(id) ? `${prefix}-${id}` : id);
  const syncbase = new RegExp(`(^|[;\\s])(${[...ids].map(escapeRe).join("|")})\\.(?=begin|end|repeat|click|mouse|focus|activate)`, "g");
  return markup
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, (block) => block.replace(/#([A-Za-z_][\w-]*)/g, (m, id) => (ids.has(id) ? `#${name(id)}` : m)))
    .replace(/(\sid=")([^"]+)"/g, (m, head, id) => `${head}${name(id)}"`)
    .replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (m, quote, id) => `url(${quote}#${name(id)}${quote})`)
    .replace(/(\s(?:xlink:)?href=")#([^"]+)"/g, (m, head, id) => `${head}#${name(id)}"`)
    .replace(/(\s(?:begin|end)=")([^"]*)"/g, (m, head, value) => `${head}${value.replace(syncbase, (s: string, lead: string, id: string) => `${lead}${name(id)}.`)}"`)
    .replace(/(\saria-(?:labelledby|describedby)=")([^"]*)"/g, (m, head, list) => `${head}${list.split(/\s+/).map(name).join(" ")}"`);
}

/** The text of an SVG the site's repository owns — a file under its root, outside node_modules — for inline use; throws on a path outside, and on markup that carries code (a script, an event handler, a javascript: URL), which a drawing never needs. */
export function readTrustedSvg(root: string, file: string): string {
  const full = path.resolve(root, file);
  const rel = path.relative(path.resolve(root), full);
  if (!full.endsWith(".svg")) throw new Error(`${file}: not an .svg file`);
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep).includes("node_modules")) throw new Error(`${file}: only an SVG the site's repository owns is put inline — a file under its root, outside node_modules`);
  const text = fs.readFileSync(full, "utf8");
  const code = text.match(/<script\b|\son[a-z]+\s*=|javascript:/i);
  if (code) throw new Error(`${file}: carries code (${code[0].trim()}); a drawing is put inline only without a script, an event handler or a javascript: URL`);
  return text;
}
