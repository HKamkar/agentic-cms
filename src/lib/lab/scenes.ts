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
