// Reuse of unchanged shots. A page's shots are a function of the files it
// loads from the build (its HTML, chunks, stylesheets, fonts and images), of
// the harness that takes them, the browser and the capture's settings. After
// each page-width (or state) the harness records the build files the page
// requested and their digests (.parity/shot-cache/); a later capture of any build — a --ref
// baseline, the working tree — whose files for that page are the same bytes
// copies those shots instead of taking them again. Two builds of one source
// differ only in the build id, so it is masked before a file is digested. A
// file outside the build (a third-party script, an analytics beacon) is not an
// input: reuse is only as good as the promise that the build is the page.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// its own folder: .parity/shots is where `agentic-cms shot` writes the pictures a person asked for
export const CACHE_DIR = ".parity/shot-cache";
/** Entries kept per page-width: the baseline's, the change's and two earlier states, so alternating proofs keep hitting. */
export const KEEP = 4;
const MASK = "\0BUILD_ID\0";

const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
const masked = (text, buildId) => (buildId ? text.split(buildId).join(MASK) : text);

/** A served path's digest in this build (build id masked), null when the build has no such file; memoised for the run. */
export function digester(resolve, buildId) {
  const memo = new Map();
  return (servedPath) => {
    if (!memo.has(servedPath)) {
      const file = resolve(servedPath);
      // latin1 maps every byte to one character and back, so a binary file survives the mask unchanged
      memo.set(servedPath, file && fs.existsSync(file) ? sha(Buffer.from(masked(fs.readFileSync(file).toString("latin1"), buildId), "latin1")) : null);
    }
    return memo.get(servedPath);
  };
}

/** The key of everything but the page's files that decides its pixels: the harness's sources, the browser, the settings. */
export const settingsKey = ({ harness, browser, settings }) => sha(JSON.stringify({ harness, browser, settings })).slice(0, 16);

/** The digest of every harness source file that decides a shot; a change to any of them retires the whole cache. */
export const harnessDigest = (files) => sha(files.map((file) => `${path.basename(file)}\n${fs.readFileSync(file, "utf8")}`).join("\0"));

/** The recorded dependencies of a shot: each served path (build id masked) with its digest, sorted. */
export function recordDeps(servedPaths, digestOf, buildId) {
  return Object.fromEntries([...new Set(servedPaths)].sort().map((p) => [masked(p, buildId), digestOf(p)]));
}

const entriesOf = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).map((d) => path.join(dir, d)).filter((d) => fs.existsSync(path.join(d, "deps.json"))) : []);

/** The stored entry of `name` whose every recorded file has the same digest in this build, or null. */
export function lookup(root, key, name, digestOf, buildId) {
  const unmask = (p) => (buildId ? p.split(MASK).join(buildId) : p);
  for (const entry of entriesOf(path.join(root, CACHE_DIR, key, name))) {
    const { deps, files } = JSON.parse(fs.readFileSync(path.join(entry, "deps.json"), "utf8"));
    if (Object.entries(deps).every(([p, digest]) => digestOf(unmask(p)) === digest) && files.every((f) => fs.existsSync(path.join(entry, f)))) return { dir: entry, files };
  }
  return null;
}

/** Copies an entry's shots into a capture directory; the number of shots copied. */
export function reuse(entry, into) {
  for (const file of entry.files) fs.copyFileSync(path.join(entry.dir, file), path.join(into, file));
  fs.utimesSync(path.join(entry.dir, "deps.json"), new Date(), new Date());
  return entry.files.length;
}

/** Stores the shots `files` (in `from`) of `name` under their dependencies, and keeps the KEEP most recent entries of it. */
export function store(root, key, name, deps, from, files) {
  const base = path.join(root, CACHE_DIR, key, name);
  const entry = path.join(base, sha(JSON.stringify(deps)).slice(0, 16));
  fs.rmSync(entry, { recursive: true, force: true });
  fs.mkdirSync(entry, { recursive: true });
  for (const file of files) fs.copyFileSync(path.join(from, file), path.join(entry, file));
  fs.writeFileSync(path.join(entry, "deps.json"), JSON.stringify({ deps, files }));
  const byAge = entriesOf(base).map((d) => [d, fs.statSync(path.join(d, "deps.json")).mtimeMs]).sort((a, b) => b[1] - a[1]);
  for (const [stale] of byAge.slice(KEEP)) fs.rmSync(stale, { recursive: true, force: true });
}

/** The files of a capture directory that belong to one page-width or state: `<name>.…` and `<name>--…`. */
export const filesOf = (dir, name) => fs.readdirSync(dir).filter((f) => f.startsWith(`${name}.`) || f.startsWith(`${name}--`)).sort();

/**
 * One capture's use of the cache. take(name, dir, run) copies the shots of a page-width (or state) into `dir`
 * when every build file they loaded is unchanged, and returns how many PNGs that was; otherwise it runs
 * run(watch) — watch(page), called before the page loads, records the build files the page requests — and stores
 * what the run wrote. Request events are the record: measured on a warm browser context, where most files come
 * from the browser's cache, every build file a page used was still requested (the favicon alone was not, and it
 * is not in the page). A prefetch (an RSC request) is left out: the router fetches it, the page does not show it.
 * With `fresh`, nothing is reused and everything is stored.
 */
export function createShotCache({ root, key, resolve, buildId, origin, fresh = false }) {
  const digestOf = digester(resolve, buildId);
  const counts = { reused: 0, taken: 0 };
  const take = async (name, dir, run) => {
    const hit = fresh ? null : lookup(root, key, name, digestOf, buildId);
    if (hit) { counts.reused++; reuse(hit, dir); return hit.files.filter((f) => f.endsWith(".png")).length; }
    const served = [];
    const watch = (page) => page.on("request", (request) => { const url = new URL(request.url()); if (url.origin === origin && !request.headers().rsc) served.push(decodeURIComponent(url.pathname)); });
    const result = await run(watch);
    counts.taken++;
    store(root, key, name, recordDeps(served, digestOf, buildId), dir, filesOf(dir, name));
    return result;
  };
  return { take, counts };
}

/** No cache (a served --url site: its files are not ours to digest): every shot is taken. */
export const noShotCache = () => ({ take: (name, dir, run) => run(undefined), counts: null });
