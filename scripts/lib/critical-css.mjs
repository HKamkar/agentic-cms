// Critical CSS behind `agentic-cms critical-css`. A prerendered page cannot
// paint until every stylesheet it links has arrived: the HTML, then the CSS,
// then the first frame — a round trip that slow connections pay in full
// (about half a second on a throttled phone, measured on a site of the kit,
// 2026-10-03). Each page gets the rules its own HTML uses inlined in a
// <style>, and its stylesheets load without blocking the paint
// (media="print" until they have arrived, a <noscript> fallback for pages
// without scripts); the files stay whole and cached for the next page.
//
// Beasties does the inlining. Two of its gaps are closed here, both found on
// a real site: fonts named through CSS variables (next/font does that) leave
// it no font-family to follow, so every @font-face of the page's stylesheets
// goes in, its url()s resolved against the stylesheet they came from; and it
// cannot evaluate Tailwind's arbitrary variants (`[&_svg]:size-4` is
// `.\[\&_svg\]\:size-4 svg`), which it would drop, so those rules are kept,
// with every rule keyed on a data- or aria- attribute: a script sets those
// states after the HTML was written (a theme before the first paint), so the
// built HTML cannot show they are needed.
import fs from "node:fs";
import path from "node:path";
import Beasties from "beasties";
import { packageDir } from "./assemble.mjs";

/** The attribute on the inlined <style>: a page that carries it is done, and a second run leaves it alone. */
export const MARK = "data-critical";
/**
 * Rules kept whole whatever the page's HTML holds: selectors Beasties cannot evaluate (Tailwind's arbitrary
 * variants, `.\[\&_svg\]\:size-4 svg`), and states a script sets after the HTML was written (`[data-theme=dark]`,
 * set before the first paint; `[data-scrolled]`, `[aria-expanded=true]`), which the built HTML cannot show.
 */
const ALWAYS = [/\\&/, /\[data-/, /\[aria-/];

const posix = (p) => p.split(path.sep).join("/");
const walk = (dir, base = dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => { const full = path.join(dir, e.name); return e.isDirectory() ? walk(full, base) : [posix(path.relative(base, full))]; }) : []);

/** The folders of prerendered pages: the build's, and the standalone package's copy (what a Node host serves) when there is one. */
export function pageDirs(root) {
  const dirs = [path.join(root, ".next/server/app"), path.join(packageDir(root), ".next/server/app")];
  return dirs.filter((dir, i) => fs.existsSync(dir) && dirs.indexOf(dir) === i);
}

/** The prerendered pages under a folder, as paths relative to it. */
export const pagesIn = (dir) => walk(dir).filter((f) => f.endsWith(".html"));

/** The page's own stylesheets, read from the build: [{ href, css }]. */
export function stylesheets(html, root) {
  return [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].flatMap(([tag]) => {
    const href = /\bhref="(\/_next\/[^"?#]+)/.exec(tag)?.[1];
    const file = href && path.join(root, ".next", href.slice("/_next/".length));
    return file && fs.existsSync(file) ? [{ href, css: fs.readFileSync(file, "utf8") }] : [];
  });
}

/** Every @font-face of the sheets, its url()s resolved against the sheet it came from so they hold inside the page. */
export function fontFaces(sheets) {
  const resolve = (href) => (_, url) => {
    const bare = url.trim().replace(/^["']|["']$/g, "");
    return /^(data:|https?:|\/)/.test(bare) ? `url(${bare})` : `url(${new URL(bare, `http://site${href}`).pathname})`;
  };
  return sheets.flatMap(({ href, css }) => (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).map((face) => face.replace(/url\(([^)]+)\)/g, resolve(href)))).join("");
}

/** The stylesheets a page still waits for before it paints: links outside <noscript> without media="print". */
export function blocking(html) {
  const live = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
  return [...live.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].filter(([tag]) => !/\bmedia="print"/.test(tag)).map(([tag]) => /\bhref="([^"]+)"/.exec(tag)?.[1] ?? tag);
}

/** The page with its critical CSS inlined; `skipped` when it is done already or links no stylesheet of the build. */
export async function inlineCritical(html, root) {
  if (html.includes(`<style ${MARK}`)) return { html, skipped: "done" };
  const sheets = stylesheets(html, root);
  if (!sheets.length) return { html, skipped: "no stylesheet" };
  const beasties = new Beasties({
    path: path.join(root, ".next"), publicPath: "/_next/", preload: "media", noscriptFallback: true, pruneSource: false,
    inlineFonts: false, preloadFonts: false, reduceInlineStyles: false, mergeStylesheets: true, compress: true, allowRules: ALWAYS, logLevel: "silent",
  });
  const before = new Set([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map(([tag]) => tag));
  const out = await beasties.process(html);
  const added = [...out.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map(([tag]) => tag).find((tag) => !before.has(tag));
  if (!added) return { html, skipped: "nothing to inline" };
  const marked = added.replace(/^<style\b([^>]*)>/, `<style ${MARK}$1>${fontFaces(sheets)}`);
  return { html: out.replace(added, marked), inlined: Buffer.byteLength(marked) };
}
