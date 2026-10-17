// The pixel and row comparison behind `visual-parity compare`, pure so it is
// tested without a browser: two raw images (sharp's { data, info }) of the
// same size are compared pixel by pixel with a tolerance and yield the
// changed rows as bands; two of different heights are compared row by row
// from the top and from the bottom, so a taller page tells whether one
// section grew and pushed everything below it down intact (shift), the page
// simply gained or lost rows at the end (insert, remove), or nothing below a
// row lines up any more (reflow — an antialiasing flip, a chrome change).
// compareCapture() runs both over two capture directories and returns the
// report `--json` prints; given fresh retakes of the shots that differ
// (`proof` takes them), it also tells a difference that reproduces from one
// that does not (judgeRetakes).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { routeName } from "./browser.mjs";

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

/** The pixels of two same-size images that differ by more than the tolerance: one memcmp per row, the pixel loop only on a miss. */
function changedCount(a, b, { tolerance = TOLERANCE } = {}) {
  const { width, height, channels } = a.info;
  const stride = width * channels;
  let changed = 0;
  for (let y = 0; y < height; y++) {
    const ra = a.data.subarray(y * stride, (y + 1) * stride), rb = b.data.subarray(y * stride, (y + 1) * stride);
    if (Buffer.compare(ra, rb) === 0) continue;
    for (let x = 0; x < stride; x += channels) if (differ(ra, rb, x, x, tolerance)) changed++;
  }
  return changed;
}

/** Whether two shots are one within the threshold: the same size, and at most `threshold` percent of their pixels changed. */
const alike = (x, y, threshold) => Boolean(x && y) && x.info.width === y.info.width && x.info.height === y.info.height && (100 * changedCount(x, y)) / (x.info.width * x.info.height) <= threshold;

/**
 * A shot that differs, judged against fresh retakes of it (null for a side not retaken). A real change never renders
 * the before build's pixels, so when a take of the after build matches a take of the before build the difference does
 * not reproduce: { matched: "after" } (the after side's retake is the before shot, so its first take jittered),
 * "before" (the before side's retake is the after shot) or "both" (the two retakes agree). Otherwise it reproduces:
 * { matched: null }.
 */
export function judgeRetakes({ before, after, retakeBefore = null, retakeAfter = null }, { threshold }) {
  if (alike(retakeAfter, before, threshold)) return { matched: "after" };
  if (alike(retakeBefore, after, threshold)) return { matched: "before" };
  if (alike(retakeBefore, retakeAfter, threshold)) return { matched: "both" };
  return { matched: null };
}

/**
 * The first section, in document order, whose height (else top) differs by more than 0.01 px between two captures'
 * geometry (<page>@<width>.sections.json): { section, id, moved: "height" | "top", top, height, delta, fractional }, or
 * null. Sections are matched by id, else by type and occurrence. A fractional delta is the usual cause of a reflow: every
 * row below the section moves by a fraction of a pixel and re-antialiases.
 */
export function explainShift(before, after) {
  const keyed = (list) => { const seen = new Map(); return list.map((s) => { const base = s.id ?? s.section; const n = seen.get(base) ?? 0; seen.set(base, n + 1); return [`${base}#${n}`, s]; }); };
  const byKey = new Map(keyed(after));
  for (const [key, b] of keyed(before)) {
    const a = byKey.get(key);
    if (!a) continue;
    const dh = a.height - b.height, dt = a.top - b.top;
    if (Math.abs(dh) <= 0.01 && Math.abs(dt) <= 0.01) continue;
    const moved = Math.abs(dh) > 0.01 ? "height" : "top";
    const delta = Math.round((moved === "height" ? dh : dt) * 1000) / 1000;
    return { section: b.section, id: b.id, moved, top: [b.top, a.top], height: [b.height, a.height], delta, fractional: Math.abs(delta - Math.round(delta)) > 0.001 };
  }
  return null;
}

const sectionName = (s) => (s.id && s.id !== s.section ? `${s.section} #${s.id}` : s.section);
const rowsOf = ([a, b]) => (a === b ? `row ${a}` : `rows ${a}-${b}`);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The section of a page's geometry whose box holds a row (CSS px: captures run at a device scale of 1), or null. */
export const sectionAt = (geometry, row) => geometry.find((s) => row >= s.top && row < s.top + s.height) ?? null;

const JITTERED = {
  after: "a fresh retake of the after side matches the before shot: the first after shot jittered",
  before: "a fresh retake of the before side matches the after shot: the before shot jittered",
  both: "fresh retakes of both sides match each other: the first shots jittered",
};

/**
 * The cause as the line the compare prints under a file's line: a section that moved (explainShift), else by kind —
 * an image still loading on a side (`unloaded`), a difference a fresh retake did not reproduce (`jitter`), a change
 * inside one section that moved nothing (`in-place`), a side without geometry (`geometry`), a shot with no geometry by
 * kind (`frame`: the menu, a motion frame, a state), a file one side lacks (`missing`), an inventory or a settle record
 * that differs. A cause whose difference a retake reproduced names the sides retaken (`retake`).
 */
export function causeLine(cause) {
  const line = causeText(cause);
  return cause.retake ? `${line}; reproduced on a fresh retake of ${cause.retake.length > 1 ? "each side" : `the ${cause.retake[0]} side`}` : line;
}

function causeText(cause) {
  if (cause.kind === "jitter") return `cause: the difference does not reproduce — ${JITTERED[cause.matched]}, the capture's doing, not the build's`;
  if (cause.kind === "unloaded") { const [first] = cause.images; return `cause: image not loaded on ${cause.side} at y=${first.top} (${first.src}, ${first.width}x${first.height}${cause.images.length > 1 ? `, and ${plural(cause.images.length - 1, "more")}` : ""}): the shot is not evidence; retake the page with --fresh`; }
  if (cause.kind === "in-place") return `cause: no section moved; the change at ${rowsOf(cause.rows)} is ${cause.section ? `inside ${sectionName(cause.section)}: its content changed in place` : "outside every measured section"}`;
  if (cause.kind === "geometry") return `cause: unknown, no section geometry in the ${cause.lacking.join(" and the ")} capture; recapture it to have the section named`;
  if (cause.kind === "frame") return `cause: ${cause.what}${cause.rows ? `, ${rowsOf(cause.rows)}` : ""}: no section geometry for this kind of shot; the diff image shows where`;
  if (cause.kind === "missing") return `cause: only in the ${cause.side} capture: ${cause.reason}`;
  if (cause.kind === "inventory") return `cause: ${plural(cause.onlyBefore, "animation")} only before, ${cause.onlyAfter} only after${cause.first ? `; the first: ${cause.first}` : ""}`;
  if (cause.kind === "settle") return `cause: ${cause.step === null ? "the steps differ in number" : `step ${cause.step} waited ${cause.waited[0]} → ${cause.waited[1]} ms`}`;
  const d = `${cause.delta > 0 ? "+" : ""}${cause.delta.toFixed(3)} px`;
  const what = cause.moved === "height" ? `height ${cause.height[0].toFixed(3)} → ${cause.height[1].toFixed(3)}` : `top ${cause.top[0].toFixed(3)} → ${cause.top[1].toFixed(3)}, something above it changed`;
  return `cause: ${sectionName(cause)} ${what} (${d}${cause.fractional ? ", fractional: every row below re-antialiased" : ""})`;
}

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } };
/** A full-page static shot: <page>@<width>.png, the files with geometry beside them (not a menu, motion or state shot). */
const PAGE_SHOT = /^[^@]+@\d+\.png$/;

const STEP_FRAME = /--s(\d+)-(\w+)\.png$/;
const STATE_SHOT = /--state-([\w-]+)\.png$/;

/** What a shot without geometry shows: the open menu, a motion frame (and whether its timing can move it), a state's box. */
function frameCause(name, rows) {
  const step = STEP_FRAME.exec(name), state = STATE_SHOT.exec(name);
  const what = step ? `scroll step ${Number(step[1])}, ${step[2] === "settled" ? "settled (a settled frame never jitters: the difference is real)" : `${step[2]} ms after it (mid-flight: re-run once with --fresh, and identical then means accepted)`}` : state ? `the ${state[1]} state's box` : name.includes("--menu") ? "the open menu, a viewport shot" : "a shot";
  return { kind: "frame", what, rows };
}

/**
 * The cause of a shot's difference, never null: a page shot's from its geometry on both sides — the section that
 * moved, else the one whose box holds the first changed row — or the side that lacks geometry; any other shot's
 * from what it is. `rows` is the first band of changed rows, on the before side.
 */
function causeOf(name, fa, fb, rows) {
  if (!PAGE_SHOT.test(name)) return frameCause(name, rows);
  const [ga, gb] = [fa, fb].map((f) => readJson(f.replace(/\.png$/, ".sections.json")));
  if (!ga || !gb) return { kind: "geometry", lacking: [...(ga ? [] : ["before"]), ...(gb ? [] : ["after"])] };
  return explainShift(ga, gb) ?? { kind: "in-place", section: sectionAt(ga, rows[0]), rows };
}

/** A side's shot taken with an image still loading after a reload (<page>@<width>.unloaded.json): that cause, else null. */
function unloadedCause(fa, fb) {
  for (const [side, f] of [["before", fa], ["after", fb]]) {
    const images = readJson(f.replace(/\.png$/, ".unloaded.json"));
    if (images?.length) return { kind: "unloaded", side, images };
  }
  return null;
}

const decode = (file) => sharp(file).raw().toBuffer({ resolveWithObject: true });
const meta = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")); } catch { return {}; } };
const size = (img) => `${img.info.width}x${img.info.height}`;
const status = (ok, label) => (ok ? "ok      " : `${label.padEnd(8)}`);
/** The shots a retake takes again: a page shot, the open menu, a motion frame; never a state's box (a --states capture has no --pages). */
const RETAKEN = /@\d+(--menu|--s\d+-\w+)?\.png$/;

/** A shot's fresh retakes, decoded, by side: { before?, after? }, from the retake captures that hold it. */
async function retakesOf(name, retakes) {
  const takes = {};
  for (const side of ["before", "after"]) {
    const file = retakes?.[side] ? path.join(retakes[side], name) : null;
    if (file && fs.existsSync(file)) takes[side] = await decode(file);
  }
  return takes;
}

/**
 * A judged difference's status and cause: FLAKY when a side's shot had an image still loading, or when a fresh retake
 * of it shows the difference does not reproduce (judgeRetakes); else the label with its cause, which names the sides
 * whose retakes reproduced it.
 */
async function verdict(label, name, fa, fb, rows, { images, retakes, threshold }) {
  const unloaded = unloadedCause(fa, fb);
  if (unloaded) return { status: "FLAKY", cause: unloaded };
  const cause = causeOf(name, fa, fb, rows);
  const takes = RETAKEN.test(name) ? await retakesOf(name, retakes) : {};
  const sides = Object.keys(takes);
  if (!sides.length) return { status: label, cause };
  const { matched } = judgeRetakes({ before: images[0], after: images[1], retakeBefore: takes.before, retakeAfter: takes.after }, { threshold });
  return matched ? { status: "FLAKY", cause: { kind: "jitter", matched } } : { status: label, cause: { ...cause, retake: sides } };
}

async function crop(img, from, to, file) {
  const top = Math.max(0, from - CROP_MARGIN), bottom = Math.min(img.info.height, to + CROP_MARGIN);
  if (bottom <= top) return;
  const stride = img.info.width * img.info.channels;
  await sharp(img.data.subarray(top * stride, bottom * stride), { raw: { width: img.info.width, height: bottom - top, channels: img.info.channels } }).png().toFile(file);
}

/** An inventory's difference: how many entries each side alone has, and the first of them by its type, name, element and place. */
function inventoryCause({ onlyBefore, onlyAfter }) {
  const [first, side] = onlyBefore.length ? [onlyBefore[0], "before"] : [onlyAfter[0], "after"];
  const what = first && [first.type, first.name, first.target ? `on ${first.target.tag} at top ${first.target.top}` : null].filter(Boolean).join(" ");
  return { kind: "inventory", onlyBefore: onlyBefore.length, onlyAfter: onlyAfter.length, first: first ? `${what} (${side})` : null };
}

/** A settle record's difference: the first step whose wait differs, or null when the steps differ in number. */
function settleCause(ja, jb) {
  if (ja.length !== jb.length) return { kind: "settle", step: null };
  const i = ja.findIndex((step, n) => JSON.stringify(step) !== JSON.stringify(jb[n]));
  return { kind: "settle", step: ja[i].step ?? i, waited: [ja[i].waited, jb[i].waited] };
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
    entry.cause = entry.kind === "animations" ? inventoryCause(entry) : settleCause(ja, jb);
  }
  entry.line = `${status(same, "CHANGED")} ${name.padEnd(70)} ${ja.length} -> ${jb.length} ${entry.kind === "animations" ? "animations" : "steps"}`;
  return entry;
}

async function compareImage(name, fa, fb, diffDir, { threshold, thresholdMid, retakes }) {
  const [ia, ib] = await Promise.all([decode(fa), decode(fb)]);
  const midFlight = MID_FLIGHT.test(name);
  const judging = { images: [ia, ib], retakes, threshold: midFlight ? thresholdMid : threshold };
  if (ia.info.width !== ib.info.width || ia.info.height !== ib.info.height) {
    const r = rowDiff(ia, ib);
    const judged = await verdict("SIZE", name, fa, fb, r.band ? [r.band.before[0], Math.max(r.band.before[0], r.band.before[1] - 1)] : [0, 0], judging);
    const entry = { name, kind: midFlight ? "motion" : "static", ...judged, before: { width: ia.info.width, height: ia.info.height }, after: { width: ib.info.width, height: ib.info.height }, ...r };
    const sign = r.delta > 0 ? "+" : "";
    const head = `${status(false, entry.status)} ${name.padEnd(70)} ${size(ia)} -> ${size(ib)}`;
    if (r.verdict === "width") entry.line = `${head}: width`;
    else {
      entry.line = `${head} (${sign}${r.delta})  same to row ${r.head}, tail ${r.tail} rows, band ${r.band.before.join("-")} -> ${r.band.after.join("-")}: ${r.verdict}`;
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
    Object.assign(entry, await verdict("CHANGED", name, fa, fb, bands[0], judging));
    entry.bands = bands;
    entry.diff = name;
    await sharp(diff, { raw: { width: ia.info.width, height: ia.info.height, channels: 3 } }).png().toFile(path.join(diffDir, name));
  }
  const where = ok ? "" : ` rows ${bands.slice(0, 6).map((b) => b.join("-")).join(", ")}${bands.length > 6 ? ` +${bands.length - 6}` : ""}`;
  entry.line = `${status(ok, entry.status)} ${name.padEnd(70)} ${pct.toFixed(3)}% (${changed} px)${where}${midFlight ? "  mid-flight" : ""}`;
  return entry;
}

/** "<page>@<width>" of a capture's file name, the shot it belongs to. */
export const shotOf = (name) => /^[^@]+@\d+/.exec(name)?.[0] ?? name;

/**
 * Why a file is in one capture alone: a state the other capture skipped for want of its target (its capture.json),
 * a page the other did not take at all or not at that width, a motion step past the other's end (its page got
 * shorter or taller), or — when none of those — that it is simply absent there.
 */
export function missingCause(name, side, sides) {
  const other = side === "before" ? "after" : "before";
  const { dir, files } = sides[other];
  const skipped = readJson(path.join(dir, "capture.json"))?.skipped?.find((s) => s.file === name);
  if (skipped) return { kind: "missing", side, reason: `the ${other} capture found no target for the ${skipped.state} state on ${skipped.page}, and skipped it` };
  const page = name.slice(0, name.indexOf("@"));
  const widths = [...new Set(files.filter((f) => f.startsWith(`${page}@`)).map((f) => /@(\d+)/.exec(f)[1]))];
  if (!widths.length) return { kind: "missing", side, reason: `the ${other} capture has no ${page} page (one added or removed, or a capture of other pages)` };
  if (!widths.includes(/@(\d+)/.exec(name)[1])) return { kind: "missing", side, reason: `the ${other} capture took ${page} at ${widths.join(", ")} only` };
  if (STEP_FRAME.test(name)) return { kind: "missing", side, reason: `the ${other} capture's ${shotOf(name)} has a different number of scroll steps: the page's height changed` };
  return { kind: "missing", side, reason: `the ${other} capture has the page-width but not this file` };
}

/**
 * The files a compare judges. Without pages, every file of both captures. With --pages (a partial capture on one side or
 * both), only the named pages' files — a full capture against a partial one is not a page of MISSING lines — and of the
 * before capture only the page-widths the after capture took, so a frame lost at a width it did take is still MISSING.
 */
export function judged(before, after, pages = []) {
  if (!pages.length) return [...new Set([...before, ...after])];
  const wanted = new Set(pages.map(routeName));
  const named = (f) => wanted.has(f.slice(0, f.indexOf("@")));
  const kept = after.filter(named);
  const shots = new Set(kept.map(shotOf));
  return [...new Set([...kept, ...before.filter((f) => named(f) && shots.has(shotOf(f)))])];
}

/**
 * The report of two capture directories: one entry per file (with its printed line), the summary, the baseline the after
 * capture names, each side's seed. `retakes` ({ before, after }: directories of fresh retakes, either null) judges each
 * shot that differs against its retakes; `unretaken` lists the shots that differ and no retake judged.
 */
export async function compareCapture(a, b, { before, after, diffDir, threshold, thresholdMid, pages = [], retakes = null }) {
  fs.rmSync(diffDir, { recursive: true, force: true });
  fs.mkdirSync(diffDir, { recursive: true });
  const isResult = (f) => f.endsWith(".png") || f.endsWith(".animations.json") || f.endsWith(".settle.json");
  // a page either capture left out by --sample is not missing from the other: it was not photographed on purpose
  const sampledOut = [...new Set([...(meta(a).sample?.skipped ?? []), ...(meta(b).sample?.skipped ?? [])])].sort();
  const unsampled = new Set(sampledOut.map(routeName));
  const names = judged(fs.readdirSync(a).filter(isResult), fs.readdirSync(b).filter(isResult), pages).filter((f) => !unsampled.has(f.slice(0, f.indexOf("@")))).sort();
  const files = [];
  const sides = { before: { dir: a, files: fs.readdirSync(a) }, after: { dir: b, files: fs.readdirSync(b) } };
  for (const name of names) {
    const fa = path.join(a, name), fb = path.join(b, name);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) { const where = fs.existsSync(fa) ? "before" : "after"; files.push({ name, status: "MISSING", in: where, line: `MISSING  ${name} (only in ${where})`, cause: missingCause(name, where, sides) }); continue; }
    files.push(name.endsWith(".json") ? await compareJson(name, fa, fb, diffDir) : await compareImage(name, fa, fb, diffDir, { threshold, thresholdMid, retakes }));
  }
  const count = (s) => files.filter((f) => f.status === s).length;
  const summary = { ok: count("ok"), changed: count("CHANGED"), size: count("SIZE"), missing: count("MISSING"), flaky: count("FLAKY") };
  summary.exit = files.length - summary.ok ? 1 : 0;
  const unretaken = files.filter((f) => (f.status === "CHANGED" || f.status === "SIZE") && RETAKEN.test(f.name) && !f.cause?.retake).map((f) => f.name);
  const mb = meta(b);
  const geometry = (dir) => fs.readdirSync(dir).some((f) => f.endsWith(".sections.json"));
  const retakeLabels = retakes ? { before: retakes.before ? path.basename(retakes.before) : null, after: retakes.after ? path.basename(retakes.after) : null } : null;
  return { before, after, scheme: mb.scheme ?? meta(a).scheme ?? null, threshold, thresholdMid, pages: pages.length ? pages : null, sampledOut: sampledOut.length ? sampledOut : null, baseline: mb.ref || mb.sha ? { ref: mb.ref ?? null, sha: mb.sha ?? null } : null, seed: { before: meta(a).seed ?? null, after: mb.seed ?? null }, geometry: { before: geometry(a), after: geometry(b) }, retakes: retakeLabels, unretaken, summary, files };
}

/**
 * Why a capture cannot stand as a retake of a side (both as their meta.json records them), or null when it can: a
 * retake takes every shot itself (a shot copied from the shot cache is the first take again) of the same build (its
 * build id and its sha, where each records one), in the same scheme, mode and seed — `sameSeed` judges the seeds.
 */
export function retakeRefusal(side, retake, { sameSeed }) {
  if (!retake.fresh) return "it may have copied shots from the shot cache: a retake is captured with --no-cache";
  if (retake.scheme !== side.scheme) return `it was captured in ${retake.scheme ?? "?"}, the side in ${side.scheme ?? "?"}`;
  if (Boolean(retake.motion) !== Boolean(side.motion) || Boolean(retake.states) !== Boolean(side.states)) return "it is a capture of another mode (static, --motion, --states)";
  if ((retake.build ?? null) !== (side.build ?? null)) return `it photographed another build (build id ${retake.build ?? "none"}, the side's ${side.build ?? "none"})`;
  if (retake.sha && side.sha && retake.sha !== side.sha) return `it photographed another commit (${retake.sha.slice(0, 7)}, the side's ${side.sha.slice(0, 7)})`;
  if (!sameSeed(side.seed, retake.seed)) return "it was seeded differently";
  return null;
}
