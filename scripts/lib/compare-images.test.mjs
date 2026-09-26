import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { compareCapture, compareSameSize, judged, mergeBands, rowDiff } from "./compare-images.mjs";

// A synthetic page: width w, every row a colour by index (so rows differ from each other), 3 channels.
const W = 40;
const rowColour = (i) => [(i * 7) % 256, (i * 13) % 256, (i * 29) % 256];
function image(rows, { channels = 3, tint = 0 } = {}) {
  const data = Buffer.alloc(W * rows.length * channels);
  rows.forEach((colour, y) => { for (let x = 0; x < W; x++) for (let c = 0; c < channels; c++) data[(y * W + x) * channels + c] = c < 3 ? Math.min(255, colour[c] + tint) : 255; });
  return { data, info: { width: W, height: rows.length, channels } };
}
const page = (h) => Array.from({ length: h }, (_, i) => rowColour(i));

test("mergeBands joins runs of rows with at most `gap` untouched rows between them, inclusive ranges", () => {
  assert.deepEqual(mergeBands([3, 4, 5, 8, 9, 20, 21, 22, 30]), [[3, 9], [20, 22], [30, 30]]);
  assert.deepEqual(mergeBands([], 2), []);
  assert.deepEqual(mergeBands([1, 3, 5], 0), [[1, 1], [3, 3], [5, 5]]);
  assert.deepEqual(mergeBands([1, 3, 5], 1), [[1, 5]]);
});

test("compareSameSize: identical, a tint within tolerance, and a changed band with its rows and a diff image", () => {
  const a = image(page(100));
  assert.deepEqual(compareSameSize(a, image(page(100))).changed, 0);
  assert.equal(compareSameSize(a, image(page(100), { tint: 10 })).changed, 0, "a +10 tint is within the 24 tolerance");
  const rows = page(100); rows[40] = [250, 250, 250]; rows[41] = [250, 250, 250]; rows[44] = [250, 250, 250];
  const result = compareSameSize(a, image(rows));
  assert.equal(result.changed, 3 * W);
  assert.equal(result.pct, (100 * 3 * W) / (100 * W));
  assert.deepEqual(result.bands, [[40, 44]]);
  assert.equal(result.diff.length, W * 100 * 3);
  assert.deepEqual([...result.diff.subarray(40 * W * 3, 40 * W * 3 + 3)], [255, 0, 0], "a changed pixel is painted red");
});

test("rowDiff: a section that changed and grew is a shift, with the band on both sides and the rows below intact", () => {
  const before = page(200);
  const after = [...before.slice(0, 120), ...Array.from({ length: 50 }, () => [1, 2, 3]), ...before.slice(130)];
  const r = rowDiff(image(before), image(after));
  assert.equal(r.verdict, "shift");
  assert.equal(r.head, 120);
  assert.equal(r.tail, 70);
  assert.equal(r.delta, 40);
  assert.deepEqual(r.band, { before: [120, 130], after: [120, 170] });
});

test("rowDiff: rows inserted mid-page with nothing else touched is an insert with an empty band on the before side", () => {
  const before = page(200);
  const r = rowDiff(image(before), image([...before.slice(0, 120), ...Array.from({ length: 40 }, () => [1, 2, 3]), ...before.slice(120)]));
  assert.equal(r.verdict, "insert");
  assert.deepEqual(r.band, { before: [120, 120], after: [120, 160] });
});

test("rowDiff: rows appended is an insert, rows cut is a remove, nothing in common below the head is a reflow, a width change is width", () => {
  const before = page(200);
  assert.equal(rowDiff(image(before), image([...before, ...page(10)])).verdict, "insert");
  assert.equal(rowDiff(image(before), image(before.slice(0, 150))).verdict, "remove");
  const reflow = rowDiff(image(before), image([...before.slice(0, 50), ...page(160).map(([r, g, b]) => [b, r, g])]));
  assert.equal(reflow.verdict, "reflow");
  assert.equal(reflow.head, 50);
  assert.equal(reflow.tail, 0);
  const wide = { data: Buffer.alloc(41 * 10 * 3), info: { width: 41, height: 10, channels: 3 } };
  assert.equal(rowDiff(image(page(10)), wide).verdict, "width");
});

test("compareCapture: two capture directories give the report, the lines and the crops", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compare-"));
  const write = async (label, name, rows) => { fs.mkdirSync(path.join(dir, label), { recursive: true }); const img = image(rows); await sharp(img.data, { raw: img.info }).png().toFile(path.join(dir, label, name)); };
  const before = page(300);
  await write("a", "home@40.png", before);
  await write("b", "home@40.png", before);
  await write("a", "about@40.png", before);
  await write("b", "about@40.png", [...before.slice(0, 100), ...Array.from({ length: 40 }, () => [9, 9, 9]), ...before.slice(110)]);
  const changed = [...before]; changed[10] = [200, 200, 200];
  await write("a", "blog@40.png", before);
  await write("b", "blog@40.png", changed);
  await write("a", "only@40.png", before);
  fs.writeFileSync(path.join(dir, "a", "home@40.animations.json"), JSON.stringify([{ name: "x" }]));
  fs.writeFileSync(path.join(dir, "b", "home@40.animations.json"), JSON.stringify([{ name: "x" }, { name: "y" }]));
  fs.writeFileSync(path.join(dir, "a", "meta.json"), JSON.stringify({ scheme: "light" }));
  fs.writeFileSync(path.join(dir, "b", "meta.json"), JSON.stringify({ scheme: "light", ref: "main", sha: "abc123" }));
  const report = await compareCapture(path.join(dir, "a"), path.join(dir, "b"), { before: "a", after: "b", diffDir: path.join(dir, "a-vs-b"), threshold: 0.02, thresholdMid: 20 });
  const byName = Object.fromEntries(report.files.map((f) => [f.name, f]));
  assert.equal(byName["home@40.png"].status, "ok");
  assert.equal(byName["about@40.png"].status, "SIZE");
  assert.equal(byName["about@40.png"].verdict, "shift");
  assert.equal(byName["about@40.png"].head, 100);
  assert.equal(byName["about@40.png"].delta, 30);
  assert.ok(fs.existsSync(path.join(dir, "a-vs-b", "about@40.before.png")) && fs.existsSync(path.join(dir, "a-vs-b", "about@40.after.png")), "the band's crops are written");
  assert.equal(byName["blog@40.png"].status, "CHANGED");
  assert.deepEqual(byName["blog@40.png"].bands, [[10, 10]]);
  assert.ok(fs.existsSync(path.join(dir, "a-vs-b", "blog@40.png")), "a diff image for the changed file");
  assert.equal(byName["only@40.png"].status, "MISSING");
  assert.equal(byName["only@40.png"].in, "before");
  assert.equal(byName["home@40.animations.json"].status, "CHANGED");
  assert.deepEqual(byName["home@40.animations.json"].onlyAfter, [{ name: "y" }]);
  assert.deepEqual(report.summary, { ok: 1, changed: 2, size: 1, missing: 1, exit: 1 });
  assert.equal(report.baseline.sha, "abc123");
  assert.match(report.files.find((f) => f.name === "about@40.png").line, /^SIZE {5}about@40\.png +40x300 -> 40x330 \(\+30\) {2}same to row 100, tail 190 rows, band 100-110 -> 100-140: shift$/);
  assert.match(byName["blog@40.png"].line, /^CHANGED {2}blog@40\.png +0\.333% \(40 px\) rows 10-10$/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--pages judges the named pages on both sides: the other pages of a full capture are not MISSING, a frame lost at a width the after capture took is", () => {
  const before = ["home@40.png", "home@40--s01-500.png", "home@80.png", "about@40.png", "blog__a@40.png", "home@40.animations.json"];
  const after = ["home@40.png", "about@40.png", "blog__a@40.png", "blog__b@40.png", "home@40.animations.json"];
  assert.deepEqual(judged(before, after, ["/"]).sort(), ["home@40--s01-500.png", "home@40.animations.json", "home@40.png"], "home@80: a width the after capture did not take");
  assert.deepEqual(judged(before, after, ["/blog/a", "/about"]).sort(), ["about@40.png", "blog__a@40.png"]);
  assert.deepEqual(judged(["about@40.png"], ["home@40.png", "about@40.png", "x@40.png"], ["/about"]), ["about@40.png"], "a partial before, a full after: one page, nothing MISSING");
  assert.equal(judged(before, after).length, 7, "without --pages: every file of both, once");
});

test("compareCapture with --pages reports only the named page, a lost frame of it as MISSING", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compare-pages-"));
  const write = async (label, name) => { fs.mkdirSync(path.join(dir, label), { recursive: true }); const img = image(page(20)); await sharp(img.data, { raw: img.info }).png().toFile(path.join(dir, label, name)); };
  for (const name of ["home@40.png", "home@40--s01-500.png"]) await write("a", name);
  for (const name of ["home@40.png", "about@40.png", "blog@40.png"]) await write("b", name);
  const report = await compareCapture(path.join(dir, "a"), path.join(dir, "b"), { before: "a", after: "b", diffDir: path.join(dir, "a-vs-b"), threshold: 0.02, thresholdMid: 20, pages: ["/"] });
  assert.deepEqual(report.files.map((f) => [f.name, f.status]), [["home@40--s01-500.png", "MISSING"], ["home@40.png", "ok"]]);
  assert.deepEqual(report.pages, ["/"]);
  fs.rmSync(dir, { recursive: true, force: true });
});
