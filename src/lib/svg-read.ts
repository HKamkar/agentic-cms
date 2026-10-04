// Reading an SVG the site owns, for inline use: the one file-system step
// before svg.ts's string work, kept apart so a client bundle never pulls in
// node:fs. Server code and build time only.
import fs from "node:fs";
import path from "node:path";
import { svgMarkup } from "./svg.ts";

// The character references a URL can be spelled with: numeric ones, and the named ones for ':' and for the tab and
// newline the URL parser drops.
const NAMED: Record<string, string> = { colon: ":", tab: "\t", newline: "\n" };
const codePoint = (n: number): string => (n > 0x10ffff ? "" : String.fromCodePoint(n));
const decoded = (text: string): string =>
  text.replace(/&#x([0-9a-f]+);?|&#(\d+);?|&(colon|tab|newline);/gi, (m, hex?: string, dec?: string, name?: string) => (hex ? codePoint(parseInt(hex, 16)) : dec ? codePoint(Number(dec)) : NAMED[(name ?? "").toLowerCase()]));

/** The code `markup` carries as a browser reads it, or null: a script; an event handler, after whitespace, a `/` or a quote (each ends an attribute name); a javascript: URL however its value spells it. */
function codeIn(markup: string): string | null {
  const tag = markup.match(/<script\b|[\s/"']on[a-z]+\s*=/i);
  if (tag) return tag[0].replace(/^[\s/"']/, "").trim();
  return /javascript:/i.test(decoded(markup).replace(/[\t\n\r]/g, "")) ? "javascript:" : null;
}

/** The text of an SVG the site's repository owns — a file under its root, outside node_modules — for inline use; throws on a path outside, and on markup that carries code (a script, an event handler, a javascript: URL), which a drawing never needs, as written or once its comments are dropped. A guard against a drawing that brings code by accident, not a sanitizer for an SVG from outside the repository. */
export function readTrustedSvg(root: string, file: string): string {
  const full = path.resolve(root, file);
  const rel = path.relative(path.resolve(root), full);
  if (!full.endsWith(".svg")) throw new Error(`${file}: not an .svg file`);
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep).includes("node_modules")) throw new Error(`${file}: only an SVG the site's repository owns is put inline — a file under its root, outside node_modules`);
  const text = fs.readFileSync(full, "utf8");
  // Checked as written and as it goes inline: dropping the comments must not join a script or a handler together.
  const code = codeIn(text) ?? codeIn(svgMarkup(text));
  if (code) throw new Error(`${file}: carries code (${code}); a drawing is put inline only without a script, an event handler or a javascript: URL`);
  return text;
}
