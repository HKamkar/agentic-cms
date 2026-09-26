// The standalone package behind `agentic-cms assemble`. `next build` with
// output: "standalone" traces server.js and the node_modules it needs into
// .next/standalone/ and leaves public/ and .next/static out: the host copies
// them in. They are copied into the package's own folders, never as them —
// once the trace has put a public file the server reads into
// .next/standalone/public, a copy that names that folder as its target
// (cp -R public .next/standalone/public) lands at public/public, and every
// other image is a 404 on the deployed server. checkPackage() then proves the
// package complete: every file of both sources there with the same bytes, and
// no copy nested inside the folder it should fill.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const STANDALONE = ".next/standalone";
/** The two trees a standalone server serves but the trace leaves out, as [source, folder in the package]. */
export const PARTS = [["public", "public"], [".next/static", ".next/static"]];

/** The package folder: .next/standalone, or the app's folder inside it when the trace root lies above the site (relativeAppDir). */
export function packageDir(root) {
  let relative = "";
  try { relative = JSON.parse(fs.readFileSync(path.join(root, ".next/required-server-files.json"), "utf8")).relativeAppDir ?? ""; } catch { /* no manifest: the package is the folder itself */ }
  return path.join(root, STANDALONE, relative);
}

/** Whether root holds a standalone build: the package's server.js. */
export const hasPackage = (root) => fs.existsSync(path.join(packageDir(root), "server.js"));

const posix = (p) => p.split(path.sep).join("/");
const walk = (dir, base = dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => { const full = path.join(dir, e.name); return e.isDirectory() ? walk(full, base) : [posix(path.relative(base, full))]; }) : []);
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const same = (a, b) => fs.statSync(a).size === fs.statSync(b).size && digest(a) === digest(b);

/** The copy nested inside a part's folder (public/public, .next/static/static), unless the source itself has such a folder. */
function nestedCopy(root, pkg, [from, to]) {
  const name = path.basename(to);
  const nest = path.join(pkg, to, name);
  return fs.existsSync(nest) && !fs.existsSync(path.join(root, from, name)) ? nest : null;
}

/** Removes a nested copy an earlier hand-made copy left, then copies each source's contents into its folder, merged with what the trace put there; { removed, copied: [{ from, files }] }. */
export function copyInto(root) {
  const pkg = packageDir(root);
  const removed = [];
  const copied = [];
  for (const part of PARTS) {
    const nest = nestedCopy(root, pkg, part);
    if (nest) { fs.rmSync(nest, { recursive: true, force: true }); removed.push(posix(path.relative(root, nest))); }
    const [from, to] = part;
    if (!fs.existsSync(path.join(root, from))) continue;
    fs.cpSync(path.join(root, from), path.join(pkg, to), { recursive: true, force: true });
    copied.push({ from, files: walk(path.join(root, from)).length });
  }
  return { removed, copied };
}

/** The package against its sources: { package, parts: [{ from, files, bytes }], missing, differ, nested, extra }, every path site-relative. */
export function checkPackage(root) {
  const pkg = packageDir(root);
  const rel = (p) => posix(path.relative(root, p));
  const report = { package: rel(pkg), parts: [], missing: [], differ: [], nested: [], extra: [] };
  for (const part of PARTS) {
    const [from, to] = part;
    const nest = nestedCopy(root, pkg, part);
    if (nest) report.nested.push(rel(nest));
    const source = path.join(root, from), target = path.join(pkg, to);
    if (!fs.existsSync(source)) continue;
    const files = walk(source);
    let bytes = 0;
    for (const file of files) {
      const a = path.join(source, file), b = path.join(target, file);
      bytes += fs.statSync(a).size;
      if (!fs.existsSync(b)) report.missing.push(rel(b));
      else if (!same(a, b)) report.differ.push(rel(b));
    }
    const known = new Set(files);
    const inNest = (file) => nest && path.join(target, file).startsWith(nest + path.sep);
    for (const file of walk(target)) if (!known.has(file) && !inNest(file)) report.extra.push(rel(path.join(target, file)));
    report.parts.push({ from, files: files.length, bytes });
  }
  return report;
}

/** Whether a report passes: nothing missing, different or nested. */
export const complete = (report) => !report.missing.length && !report.differ.length && !report.nested.length;
