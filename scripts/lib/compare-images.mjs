// The pixel and row comparison behind `visual-parity compare`, pure so it is
// tested without a browser: two raw images (sharp's { data, info }) of the
// same size are compared pixel by pixel with a tolerance and yield the
// changed rows as bands; two of different heights are compared row by row
// from the top and from the bottom, so a taller page tells whether one
// section grew and pushed everything below it down intact (shift), the page
// simply gained or lost rows at the end (insert, remove), or nothing below a
// row lines up any more (reflow — an antialiasing flip, a chrome change).
// compareCapture() runs both over two capture directories and returns the
// report `--json` prints.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const TOLERANCE = 24;
const MID_FLIGHT = /--s\d+-(150|500)\.png$/;
const CROP_MARGIN = 40;

/** Runs of row indexes with at most `gap` untouched rows between them, as inclusive [start, end] pairs. */
export function mergeBands(rows, gap = 2) {
  const bands = [];
  for (const row of rows) {
    const last = bands.at(-1);
    if (last && row - last[1] - 1 <= gap) last[1] = row;
    else bands.push([row, row]);
  }
  return bands;
}

const differ = (a, b, i, j, tolerance) => Math.abs(a[i] - b[j]) > tolerance || Math.abs(a[i + 1] - b[j + 1]) > tolerance || Math.abs(a[i + 2] - b[j + 2]) > tolerance;

/** Whether row ia of a and row ib of b are the same within the tolerance: one memcmp, and the pixel loop only on a miss. */
function sameRow(a, b, ia, ib, tolerance) {
  const { width, channels } = a.info;
  const stride = width * channels;
  const ra = a.data.subarray(ia * stride, (ia + 1) * stride), rb = b.data.subarray(ib * stride, (ib + 1) * stride);
  if (Buffer.compare(ra, rb) === 0) return true;
  for (let x = 0; x < stride; x += channels) if (differ(ra, rb, x, x, tolerance)) return false;
  return true;
}

/** Same-size compare: the changed pixel count and share, the changed rows as bands, and a diff image (RGB: red where changed, the before dimmed elsewhere). */
export function compareSameSize(a, b, { tolerance = TOLERANCE } = {}) {
  const { width, height, channels } = a.info;
  const diff = Buffer.alloc(width * height * 3);
  const rows = [];
  let changed = 0;
  for (let y = 0; y < height; y++) {
    let rowChanged = false;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels, o = (y * width + x) * 3;
      if (differ(a.data, b.data, i, i, tolerance)) { changed++; rowChanged = true; diff[o] = 255; diff[o + 1] = 0; diff[o + 2] = 0; } else { diff[o] = a.data[i] >> 2; diff[o + 1] = a.data[i + 1] >> 2; diff[o + 2] = a.data[i + 2] >> 2; }
    }
    if (rowChanged) rows.push(y);
  }
  return { changed, pct: (100 * changed) / (width * height), bands: mergeBands(rows), diff };
}

/** Different-height compare: the first differing row from the top, the identical tail from the bottom, the band between them on both sides, and the verdict. */
export function rowDiff(a, b, { tolerance = TOLERANCE } = {}) {
  const hA = a.info.height, hB = b.info.height, delta = hB - hA;
  if (a.info.width !== b.info.width) return { verdict: "width", head: 0, tail: 0, delta, band: null };
  const min = Math.min(hA, hB);
  let head = 0;
  while (head < min && sameRow(a, b, head, head, tolerance)) head++;
  let tail = 0;
  while (tail < min - head && sameRow(a, b, hA - 1 - tail, hB - 1 - tail, tolerance)) tail++;
  const band = { before: [head, hA - tail], after: [head, hB - tail] };
  const verdict = head + tail === min ? (delta > 0 ? "insert" : "remove") : tail > 0 ? "shift" : "reflow";
  return { verdict, head, tail, delta, band };
}

const decode = (file) => sharp(file).raw().toBuffer({ resolveWithObject: true });
const meta = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")); } catch { return {}; } };
const size = (img) => `${img.info.width}x${img.info.height}`;
const status = (ok, label) => (ok ? "ok      " : `${label.padEnd(8)}`);

async function crop(img, from, to, file) {
  const top = Math.max(0, from - CROP_MARGIN), bottom = Math.min(img.info.height, to + CROP_MARGIN);
  if (bottom <= top) return;
  const stride = img.info.width * img.info.channels;
  await sharp(img.data.subarray(top * stride, bottom * stride), { raw: { width: img.info.width, height: bottom - top, channels: img.info.channels } }).png().toFile(file);
}

async function compareJson(name, fa, fb, diffDir) {
  const [ja, jb] = [fa, fb].map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  const same = JSON.stringify(ja) === JSON.stringify(jb);
  const entry = { name, kind: name.endsWith(".animations.json") ? "animations" : "settle", status: same ? "ok" : "CHANGED", before: ja.length, after: jb.length };
  if (!same) {
    const ka = new Set(ja.map((r) => JSON.stringify(r))), kb = new Set(jb.map((r) => JSON.stringify(r)));
    entry.onlyBefore = ja.filter((r) => !kb.has(JSON.stringify(r)));
    entry.onlyAfter = jb.filter((r) => !ka.has(JSON.stringify(r)));
    fs.writeFileSync(path.join(diffDir, name), JSON.stringify({ onlyBefore: entry.onlyBefore, onlyAfter: entry.onlyAfter }, null, 1));
  }
  entry.line = `${status(same, "CHANGED")} ${name.padEnd(70)} ${ja.length} -> ${jb.length} ${entry.kind === "animations" ? "animations" : "steps"}`;
  return entry;
}

async function compareImage(name, fa, fb, diffDir, { threshold, thresholdMid }) {
  const [ia, ib] = await Promise.all([decode(fa), decode(fb)]);
  const midFlight = MID_FLIGHT.test(name);
  if (ia.info.width !== ib.info.width || ia.info.height !== ib.info.height) {
    const r = rowDiff(ia, ib);
    const entry = { name, kind: midFlight ? "motion" : "static", status: "SIZE", before: { width: ia.info.width, height: ia.info.height }, after: { width: ib.info.width, height: ib.info.height }, ...r };
    const sign = r.delta > 0 ? "+" : "";
    if (r.verdict === "width") entry.line = `SIZE     ${name.padEnd(70)} ${size(ia)} -> ${size(ib)}: width`;
    else {
      entry.line = `SIZE     ${name.padEnd(70)} ${size(ia)} -> ${size(ib)} (${sign}${r.delta})  same to row ${r.head}, tail ${r.tail} rows, band ${r.band.before.join("-")} -> ${r.band.after.join("-")}: ${r.verdict}`;
      const stem = name.replace(/\.png$/, "");
      await crop(ia, r.band.before[0], r.band.before[1], path.join(diffDir, `${stem}.before.png`));
      await crop(ib, r.band.after[0], r.band.after[1], path.join(diffDir, `${stem}.after.png`));
      entry.crops = { before: `${stem}.before.png`, after: `${stem}.after.png` };
    }
    return entry;
  }
  const { changed, pct, bands, diff } = compareSameSize(ia, ib);
  const ok = pct <= (midFlight ? thresholdMid : threshold);
  const entry = { name, kind: midFlight ? "motion" : /--state-/.test(name) ? "state" : "static", status: ok ? "ok" : "CHANGED", width: ia.info.width, height: ia.info.height, changedPixels: changed, changedPct: Math.round(pct * 1000) / 1000, midFlight };
  if (!ok) {
    entry.bands = bands;
    entry.diff = name;
    await sharp(diff, { raw: { width: ia.info.width, height: ia.info.height, channels: 3 } }).png().toFile(path.join(diffDir, name));
  }
  const where = ok ? "" : ` rows ${bands.slice(0, 6).map((b) => b.join("-")).join(", ")}${bands.length > 6 ? ` +${bands.length - 6}` : ""}`;
  entry.line = `${status(ok, "CHANGED")} ${name.padEnd(70)} ${pct.toFixed(3)}% (${changed} px)${where}${midFlight ? "  mid-flight" : ""}`;
  return entry;
}

/** The report of two capture directories: one entry per file (with its printed line), the summary, the baseline the after capture names. */
export async function compareCapture(a, b, { before, after, diffDir, threshold, thresholdMid, pages = [] }) {
  fs.rmSync(diffDir, { recursive: true, force: true });
  fs.mkdirSync(diffDir, { recursive: true });
  // with --pages the "after" capture is partial: judge only what it contains
  const isResult = (f) => f.endsWith(".png") || f.endsWith(".animations.json") || f.endsWith(".settle.json");
  const names = [...new Set([...(pages.length ? [] : fs.readdirSync(a)), ...fs.readdirSync(b)].filter(isResult))].sort();
  const files = [];
  for (const name of names) {
    const fa = path.join(a, name), fb = path.join(b, name);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) { const where = fs.existsSync(fa) ? "before" : "after"; files.push({ name, status: "MISSING", in: where, line: `MISSING  ${name} (only in ${where})` }); continue; }
    files.push(name.endsWith(".json") ? await compareJson(name, fa, fb, diffDir) : await compareImage(name, fa, fb, diffDir, { threshold, thresholdMid }));
  }
  const count = (s) => files.filter((f) => f.status === s).length;
  const summary = { ok: count("ok"), changed: count("CHANGED"), size: count("SIZE"), missing: count("MISSING") };
  summary.exit = files.length - summary.ok ? 1 : 0;
  const mb = meta(b);
  return { before, after, scheme: mb.scheme ?? meta(a).scheme ?? null, threshold, thresholdMid, pages: pages.length ? pages : null, baseline: mb.ref || mb.sha ? { ref: mb.ref ?? null, sha: mb.sha ?? null } : null, summary, files };
}
