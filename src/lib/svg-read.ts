// Reading an SVG the site owns, for inline use: the one file-system step
// before svg.ts's string work, kept apart so a client bundle never pulls in
// node:fs. Server code and build time only.
import fs from "node:fs";
import path from "node:path";

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
