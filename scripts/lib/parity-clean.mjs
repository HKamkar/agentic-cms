// What `visual-parity clean` removes from .parity/visual/: the captures past
// the newest `keep` (by the time each finished — capture.json is written
// last), and every compare (<a>-vs-<b>) whose before or after capture is
// removed or gone. A capture without capture.json is either running or dead:
// under a day old it is kept (removing a running capture's directory breaks
// it), older it goes. Nothing is removed outside .parity/, whatever a
// directory's name.
import fs from "node:fs";
import path from "node:path";

export const VISUAL = ".parity/visual";
export const CACHE = ".parity/shot-cache";
const DAY = 24 * 60 * 60 * 1000;

const mtime = (file) => { try { return fs.statSync(file).mtimeMs; } catch { return null; } };
const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);

/** The entries of .parity/visual/: captures ({ name, kind: "capture", finished, started, bytes }) and compares ({ name, kind: "compare", before, after, bytes }). */
export function readEntries(root) {
  const dir = path.join(root, VISUAL);
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const captures = new Set(names.filter((name) => fs.existsSync(path.join(dir, name, "meta.json")) || fs.existsSync(path.join(dir, name, "capture.json"))));
  return names.map((name) => {
    const full = path.join(dir, name);
    if (captures.has(name)) return { name, kind: "capture", finished: mtime(path.join(full, "capture.json")), started: mtime(path.join(full, "meta.json")) ?? mtime(full), bytes: size(full) };
    const pair = splitCompare(name, captures);
    return { name, kind: "compare", before: pair?.[0] ?? null, after: pair?.[1] ?? null, bytes: size(full) };
  });
}

/** A compare directory's two labels, preferring the split whose sides are captures that exist ("a-vs-b-vs-c" is ambiguous otherwise). */
function splitCompare(name, captures) {
  const parts = name.split("-vs-");
  if (parts.length < 2) return null;
  const splits = parts.slice(1).map((_, i) => [parts.slice(0, i + 1).join("-vs-"), parts.slice(i + 1).join("-vs-")]);
  return splits.find(([a, b]) => captures.has(a) && captures.has(b)) ?? splits[0];
}

/** Which entries go: { remove: [names], keep: [names] }. `all` removes every finished capture; unfinished ones follow the one-day rule either way. */
export function planClean(entries, { keep = 10, all = false, now = Date.now() } = {}) {
  const captures = entries.filter((e) => e.kind === "capture");
  const finished = captures.filter((e) => e.finished !== null).sort((a, b) => b.finished - a.finished);
  const gone = new Set([...(all ? finished : finished.slice(keep)).map((e) => e.name), ...captures.filter((e) => e.finished === null && now - e.started > DAY).map((e) => e.name)]);
  const kept = new Set(captures.map((e) => e.name).filter((name) => !gone.has(name)));
  // a compare is kept while both of its captures are: it is the reading of two captures that are still there
  for (const e of entries.filter((entry) => entry.kind === "compare")) (kept.has(e.before) && kept.has(e.after) ? kept : gone).add(e.name);
  const order = entries.map((e) => e.name);
  return { remove: order.filter((name) => gone.has(name)), keep: order.filter((name) => kept.has(name)) };
}

/** Removes `names` from .parity/visual/ (and the shot cache with `cache`), refusing any path outside .parity/; the bytes freed. */
export function removeEntries(root, names, { cache = false } = {}) {
  const parity = path.resolve(root, ".parity") + path.sep;
  const inside = (target) => { const full = path.resolve(root, target); if (!full.startsWith(parity)) throw new Error(`refusing to remove ${full}: not under .parity/`); return full; };
  let bytes = 0;
  for (const name of names) {
    const full = inside(path.join(VISUAL, name));
    if (path.dirname(full) !== path.resolve(root, VISUAL)) throw new Error(`refusing to remove ${full}: not a directory of ${VISUAL}`);
    if (!fs.existsSync(full)) continue;
    bytes += size(full);
    fs.rmSync(full, { recursive: true, force: true });
  }
  if (cache && fs.existsSync(inside(CACHE))) { bytes += size(inside(CACHE)); fs.rmSync(inside(CACHE), { recursive: true, force: true }); }
  return bytes;
}
