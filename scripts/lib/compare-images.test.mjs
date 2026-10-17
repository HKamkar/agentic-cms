import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { causeLine, changedBoxes, changedOutside, compareCapture, compareSameSize, explainShift, judgeRetakes, judged, mergeBands, retakeRefusal, rowDiff } from "./compare-images.mjs";
import { sameSeed } from "./storage-seed.mjs";

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
  assert.deepEqual(report.summary, { ok: 1, changed: 2, size: 1, missing: 1, flaky: 0, unstable: 0, exit: 1 });
  for (const file of report.files.filter((f) => f.status !== "ok")) assert.match(causeLine(file.cause), /^cause: \S/, `${file.name} carries a cause`);
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

test("a page one capture left out by --sample is not judged; a page missing for another reason still is", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compare-sample-"));
  const write = async (label, name) => { fs.mkdirSync(path.join(dir, label), { recursive: true }); const img = image(page(20)); await sharp(img.data, { raw: img.info }).png().toFile(path.join(dir, label, name)); };
  // the before capture sampled one post of two; the after capture, of a build with a third post, sampled one of three
  for (const name of ["home@40.png", "blog-post__a@40.png"]) await write("a", name);
  for (const name of ["home@40.png", "blog-post__a@40.png", "blog-post__b@40.png", "about@40.png"]) await write("b", name);
  fs.writeFileSync(path.join(dir, "a", "meta.json"), JSON.stringify({ scheme: "light", sample: { n: 1, skipped: ["/blog-post/b"] } }));
  fs.writeFileSync(path.join(dir, "b", "meta.json"), JSON.stringify({ scheme: "light", sample: { n: 1, skipped: ["/blog-post/c"] } }));
  const report = await compareCapture(path.join(dir, "a"), path.join(dir, "b"), { before: "a", after: "b", diffDir: path.join(dir, "a-vs-b"), threshold: 0.02, thresholdMid: 20 });
  assert.deepEqual(report.files.map((f) => [f.name, f.status]), [["about@40.png", "MISSING"], ["blog-post__a@40.png", "ok"], ["home@40.png", "ok"]]);
  assert.deepEqual(report.sampledOut, ["/blog-post/b", "/blog-post/c"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("explainShift names the first section whose height moved, a fraction of a pixel included; a top that moved alone points above it", () => {
  const before = [{ id: "hero", section: "hero", top: 0, height: 812.5 }, { id: null, section: "cards", top: 812.5, height: 400 }, { id: null, section: "cards", top: 1212.5, height: 400 }];
  const grown = [{ id: "hero", section: "hero", top: 0, height: 813.25 }, { id: null, section: "cards", top: 813.25, height: 400 }, { id: null, section: "cards", top: 1213.25, height: 400 }];
  assert.deepEqual(explainShift(before, grown), { section: "hero", id: "hero", moved: "height", top: [0, 0], height: [812.5, 813.25], delta: 0.75, fractional: true });
  assert.equal(causeLine(explainShift(before, grown)), "cause: hero height 812.500 → 813.250 (+0.750 px, fractional: every row below re-antialiased)");
  const second = structuredClone(before); second[2].height = 440;
  assert.deepEqual([explainShift(before, second).section, explainShift(before, second).delta, explainShift(before, second).fractional], ["cards", 40, false], "the second of two sections of one type, matched by occurrence");
  const pushed = before.map((s) => ({ ...s, top: s.top + 12 }));
  assert.equal(explainShift(before, pushed).moved, "top");
  assert.match(causeLine(explainShift(before, pushed)), /^cause: hero top 0\.000 → 12\.000, something above it changed \(\+12\.000 px\)$/);
  assert.equal(explainShift(before, structuredClone(before)), null);
  assert.equal(explainShift(before, before.map((s) => ({ ...s, height: s.height + 0.004 }))), null, "within 0.01 px is layout noise");
});

test("compareCapture gives a changed page shot its cause from both captures' geometry; a side without geometry says so, a menu shot says what it is", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compare-cause-"));
  const write = async (label, name, rows) => { fs.mkdirSync(path.join(dir, label), { recursive: true }); const img = image(rows); await sharp(img.data, { raw: img.info }).png().toFile(path.join(dir, label, name)); };
  const before = page(100), after = [...before]; after[60] = [250, 250, 250];
  for (const name of ["home@40.png", "about@40.png", "home@40--menu.png"]) { await write("a", name, before); await write("b", name, after); }
  const geo = (h) => JSON.stringify([{ id: "hero", section: "hero", top: 0, height: h }]);
  fs.writeFileSync(path.join(dir, "a", "home@40.sections.json"), geo(50));
  fs.writeFileSync(path.join(dir, "b", "home@40.sections.json"), geo(50.5));
  fs.writeFileSync(path.join(dir, "a", "about@40.sections.json"), geo(50));
  const report = await compareCapture(path.join(dir, "a"), path.join(dir, "b"), { before: "a", after: "b", diffDir: path.join(dir, "a-vs-b"), threshold: 0.02, thresholdMid: 20 });
  const byName = Object.fromEntries(report.files.map((f) => [f.name, f]));
  assert.equal(byName["home@40.png"].cause.delta, 0.5);
  assert.deepEqual(byName["about@40.png"].cause, { kind: "geometry", lacking: ["after"] }, "the after capture has no geometry for it");
  assert.equal(causeLine(byName["about@40.png"].cause), "cause: unknown, no section geometry in the after capture; recapture it to have the section named");
  assert.equal(byName["home@40--menu.png"].cause.kind, "frame", "a menu shot has no geometry by kind, and says what it shows");
  assert.match(causeLine(byName["home@40--menu.png"].cause), /^cause: the open menu, a viewport shot, row 60: no section geometry/);
  assert.ok(!report.files.some((f) => f.name.endsWith(".sections.json")), "geometry annotates, it is not judged");
  assert.deepEqual(report.geometry, { before: true, after: true });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("every line that is not ok carries a cause: an image still loading is FLAKY, a change inside one section names it, a missing file says why, an inventory names its first difference", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compare-every-cause-"));
  const write = async (label, name, rows) => { fs.mkdirSync(path.join(dir, label), { recursive: true }); const img = image(rows); await sharp(img.data, { raw: img.info }).png().toFile(path.join(dir, label, name)); };
  const json = (label, name, value) => fs.writeFileSync(path.join(dir, label, name), JSON.stringify(value));
  const before = page(100), after = [...before]; after[70] = [250, 250, 250];
  const geo = [{ id: "hero", section: "hero", top: 0, height: 50 }, { id: null, section: "cards", top: 50, height: 50 }];
  // blank: the after side's shot was taken with an image still loading; inside: one section's content changed, nothing moved
  for (const name of ["blank@40.png", "inside@40.png", "home@40--s01-500.png", "home@40--s01-settled.png", "home@1440--state-cta-hover.png"]) { await write("a", name, before); await write("b", name, after); }
  for (const label of ["a", "b"]) for (const shot of ["blank@40", "inside@40"]) json(label, `${shot}.sections.json`, geo);
  json("b", "blank@40.unloaded.json", [{ src: "/images/x.webp", top: 64, left: 0, width: 40, height: 20 }]);
  await write("a", "gone@40.png", before);
  await write("a", "inside@80.png", before);
  await write("a", "home@40--s02-500.png", before);
  await write("a", "home@1440--state-post-faq-open.png", before);
  json("b", "capture.json", { skipped: [{ state: "post-faq-open", page: "/blog-post/a", file: "home@1440--state-post-faq-open.png", reason: "no target" }] });
  json("a", "home@40.animations.json", [{ type: "CSSAnimation", name: "fade", target: { tag: "h1", top: 10 } }]);
  json("b", "home@40.animations.json", []);
  json("a", "home@40.settle.json", [{ step: 0, waited: 2000 }, { step: 1, waited: 2000 }]);
  json("b", "home@40.settle.json", [{ step: 0, waited: 2000 }, { step: 1, waited: 2600 }]);
  // a mid-flight threshold under the 1 % this one row changes, so the mid-flight frame differs too
  const report = await compareCapture(path.join(dir, "a"), path.join(dir, "b"), { before: "a", after: "b", diffDir: path.join(dir, "a-vs-b"), threshold: 0.02, thresholdMid: 0.5 });
  const byName = Object.fromEntries(report.files.map((f) => [f.name, f]));
  const lineOf = (name) => causeLine(byName[name].cause);
  for (const file of report.files) assert.ok(file.status === "ok" || /^cause: \S/.test(causeLine(file.cause)), `${file.name} (${file.status}) carries a cause`);
  assert.equal(byName["blank@40.png"].status, "FLAKY");
  assert.match(byName["blank@40.png"].line, /^FLAKY {4}blank@40\.png/);
  assert.equal(lineOf("blank@40.png"), "cause: image not loaded on after at y=64 (/images/x.webp, 40x20): the shot is not evidence; retake the page with --fresh");
  assert.equal(lineOf("inside@40.png"), "cause: no section moved; the change at row 70 is inside cards: its content changed in place");
  assert.match(lineOf("home@40--s01-500.png"), /^cause: scroll step 1, 500 ms after it \(mid-flight\), row 70: no section geometry/);
  assert.match(lineOf("home@40--s01-settled.png"), /^cause: scroll step 1, settled, row 70: no section geometry for this kind of shot; the diff image shows where$/, "no claim that a settled frame cannot move: only a retake tells");
  assert.match(lineOf("home@1440--state-cta-hover.png"), /^cause: the cta-hover state's box/);
  assert.equal(lineOf("gone@40.png"), "cause: only in the before capture: the after capture has no gone page (one added or removed, or a capture of other pages)");
  assert.equal(lineOf("inside@80.png"), "cause: only in the before capture: the after capture took inside at 40 only");
  assert.match(lineOf("home@40--s02-500.png"), /^cause: only in the before capture: the after capture's home@40 has a different number of scroll steps/);
  assert.equal(lineOf("home@1440--state-post-faq-open.png"), "cause: only in the before capture: the after capture found no target for the post-faq-open state on /blog-post/a, and skipped it");
  assert.equal(lineOf("home@40.animations.json"), "cause: 1 animation only before, 0 only after; the first: CSSAnimation fade on h1 at top 10 (before)");
  assert.equal(lineOf("home@40.settle.json"), "cause: step 1 waited 2000 → 2600 ms");
  assert.equal(report.summary.flaky, 1);
  assert.equal(report.summary.exit, 1, "a flaky shot proves nothing: the compare does not pass it");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("judgeRetakes: a take of the after build that matches a take of the before build means the difference does not reproduce; none matching, it does", () => {
  const base = image(page(100));
  const moved = page(100); moved[60] = [250, 250, 250];
  const other = page(100); other[20] = [250, 250, 250];
  const [jittered, changed] = [image(moved), image(other)];
  const judge = (takes) => judgeRetakes({ before: base, after: jittered, ...takes }, { threshold: 0.02 }).matched;
  assert.equal(judge({ retakeAfter: image(page(100)) }), "after", "the after side's retake is the before shot: its first take jittered");
  assert.equal(judge({ retakeBefore: image(moved) }), "before", "the before side's retake is the after shot");
  assert.equal(judge({ retakeBefore: changed, retakeAfter: image(other) }), "both", "the two retakes agree with each other");
  assert.equal(judge({ retakeBefore: image(page(100)), retakeAfter: image(moved) }), null, "each side reproduces its own shot: the difference is real");
  assert.equal(judge({ retakeAfter: image(page(101)) }), null, "a retake of another height matches nothing");
  assert.equal(judge({}), null, "no retake, no verdict");
  assert.equal(judgeRetakes({ before: base, after: jittered, retakeAfter: image(page(100), { tint: 10 }) }, { threshold: 0.02 }).matched, "after", "within the tolerance is a match");
});

test("compareCapture with retakes: a difference no retake reproduces is FLAKY with its cause, one each retake reproduces stays with the sides named, and a shot no retake holds is unretaken", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compare-retakes-"));
  const write = async (label, name, rows) => { fs.mkdirSync(path.join(dir, label), { recursive: true }); const img = image(rows); await sharp(img.data, { raw: img.info }).png().toFile(path.join(dir, label, name)); };
  const before = page(100), lower = [...before], real = [...before];
  lower[70] = [250, 250, 250]; // one row a pixel off on the after side's first take
  real[30] = [5, 250, 5];
  const geo = JSON.stringify([{ id: "hero", section: "hero", top: 0, height: 50 }, { id: null, section: "links", top: 50, height: 50 }]);
  for (const name of ["post@40.png", "about@40.png", "home@40.png", "home@40--state-cta-hover.png"]) await write("a", name, before);
  await write("b", "post@40.png", lower);
  for (const name of ["about@40.png", "home@40.png", "home@40--state-cta-hover.png"]) await write("b", name, real);
  for (const label of ["a", "b"]) for (const shot of ["post@40", "about@40", "home@40"]) fs.writeFileSync(path.join(dir, label, `${shot}.sections.json`), geo);
  // the retakes: the post's after retake is the before shot again; about reproduces on each side; home and the state were not retaken
  await write("ra", "post@40.png", before);
  await write("rb", "post@40.png", before);
  await write("rb", "about@40.png", before);
  await write("ra", "about@40.png", real);
  const compare = (retakes) => compareCapture(path.join(dir, "a"), path.join(dir, "b"), { before: "a", after: "b", diffDir: path.join(dir, "a-vs-b"), threshold: 0.02, thresholdMid: 20, retakes });
  const bare = await compare(null);
  assert.deepEqual(bare.files.filter((f) => f.status !== "ok").map((f) => [f.name, f.status]), [["about@40.png", "CHANGED"], ["home@40--state-cta-hover.png", "CHANGED"], ["home@40.png", "CHANGED"], ["post@40.png", "CHANGED"]]);
  assert.deepEqual(bare.unretaken, ["about@40.png", "home@40.png", "post@40.png"], "a bare compare retakes nothing; a state's box is not a shot a retake takes");
  assert.equal(bare.retakes, null);
  const report = await compare({ before: path.join(dir, "rb"), after: path.join(dir, "ra") });
  const byName = Object.fromEntries(report.files.map((f) => [f.name, f]));
  assert.equal(byName["post@40.png"].status, "FLAKY");
  assert.match(byName["post@40.png"].line, /^FLAKY {4}post@40\.png +1\.000% \(40 px\) rows 70-70$/);
  assert.deepEqual(byName["post@40.png"].cause, { kind: "jitter", matched: "after" });
  assert.equal(causeLine(byName["post@40.png"].cause), "cause: the difference does not reproduce — a fresh retake of the after side matches the before shot: the first after shot jittered, the capture's doing, not the build's");
  assert.equal(byName["about@40.png"].status, "CHANGED");
  assert.equal(causeLine(byName["about@40.png"].cause), "cause: no section moved; the change at row 30 is inside hero: its content changed in place; reproduced on a fresh retake of each side");
  assert.deepEqual(report.unretaken, ["home@40.png"], "home has no retake on either side");
  assert.deepEqual(report.retakes, { before: "rb", after: "ra" });
  assert.deepEqual(report.summary, { ok: 0, changed: 3, size: 0, missing: 0, flaky: 1, unstable: 0, exit: 1 }, "a FLAKY line still proves nothing: the compare does not pass it");
  assert.equal(causeLine({ kind: "jitter", matched: "both" }), "cause: the difference does not reproduce — fresh retakes of both sides match each other: the first shots jittered, the capture's doing, not the build's");
  assert.match(causeLine({ kind: "in-place", section: null, rows: [3, 4], retake: ["after"] }), /; reproduced on a fresh retake of the after side$/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("retakeRefusal: a retake is a fresh take of its side's build, in its scheme, mode and seed", () => {
  const side = { scheme: "light", motion: false, states: false, build: "b1", sha: "a".repeat(40), seed: { storage: { consent: "{now}" }, at: "x" } };
  const retake = { ...side, fresh: true, seed: { storage: { consent: "{now}" }, at: "y" } };
  const refusal = (changes) => retakeRefusal(side, { ...retake, ...changes }, { sameSeed });
  assert.equal(refusal({}), null, "the same build and seed, taken fresh; when {now} was replaced does not count");
  assert.match(refusal({ fresh: undefined }), /may have copied shots from the shot cache: a retake is captured with --no-cache/);
  assert.match(refusal({ build: "b2" }), /another build \(build id b2, the side's b1\)/);
  assert.match(refusal({ sha: "b".repeat(40) }), /another commit \(bbbbbbb, the side's aaaaaaa\)/);
  assert.match(refusal({ scheme: "dark" }), /captured in dark, the side in light/);
  assert.match(refusal({ motion: true }), /another mode/);
  assert.match(refusal({ seed: null }), /seeded differently/);
});

// A square of `size` px in a page of 100 rows, a fixed ground otherwise: what a moving part of a frame looks like.
const withSquare = (x, y, size = 6, colour = [250, 250, 250]) => { const img = image(page(100)); for (let r = y; r < y + size; r++) for (let c = x; c < x + size; c++) img.data.set(colour, (r * W + c) * 3); return img; };

test("changedBoxes outlines each band of changed rows as wide as its changed pixels, grown by the margin within the image; changedOutside counts what lies beyond", () => {
  const base = image(page(100));
  const twice = withSquare(2, 10); twice.data.set([250, 250, 250], (60 * W + 30) * 3);
  assert.deepEqual(changedBoxes(base, twice, { margin: 0 }), [[2, 10, 7, 15], [30, 60, 30, 60]], "two bands, each its own box");
  assert.deepEqual(changedBoxes(base, twice, { margin: 4 }), [[0, 6, 11, 19], [26, 56, 34, 64]], "grown, and kept inside the image");
  assert.deepEqual(changedBoxes(base, image(page(100))), [], "nothing differs, no box");
  assert.equal(changedOutside(base, twice, [[0, 0, 39, 20]]), 1, "the square is inside, the lone pixel is not");
  assert.equal(changedOutside(base, twice, []), 37, "no box: every changed pixel");
});

test("judgeRetakes: a difference that lies where each build's own retake moves too is unstable; one that also reaches beyond it reproduces, with how much", () => {
  // a part that lands somewhere else on every take (a canvas drawn every frame), and a heading that changed for real
  const takes = { before: withSquare(2, 10), retakeBefore: withSquare(20, 12), after: withSquare(10, 30), retakeAfter: withSquare(28, 26) };
  const unstable = judgeRetakes(takes, { threshold: 0.02 });
  assert.equal(unstable.matched, null);
  assert.equal(unstable.unstable, true, "every pixel that differs between the sides lies where a side differs from itself");
  assert.equal(unstable.outside, 0);
  assert.equal(unstable.noise.length, 2, "one region per side's pair of takes");
  const changed = structuredClone(takes.after); for (let c = 0; c < W; c++) changed.data.set([1, 2, 3], (80 * W + c) * 3);
  const real = judgeRetakes({ ...takes, after: changed, retakeAfter: (() => { const r = withSquare(28, 26); for (let c = 0; c < W; c++) r.data.set([1, 2, 3], (80 * W + c) * 3); return r; })() }, { threshold: 0.02 });
  assert.deepEqual([real.matched, real.unstable, real.outside], [null, false, W], "the changed row is outside every region the takes moved in");
  const still = judgeRetakes({ before: image(page(100)), after: withSquare(2, 10), retakeBefore: image(page(100)), retakeAfter: withSquare(2, 10) }, { threshold: 0.02 });
  assert.deepEqual([still.matched, still.unstable, still.outside, still.noise], [null, false, null, []], "neither build moves on its own: the difference reproduces, all of it");
});

test("compareCapture with retakes: a motion frame whose difference lies where it moves between two takes of one build is UNSTABLE, with the region; a change beyond it stays CHANGED", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compare-unstable-"));
  const write = async (label, name, img) => { fs.mkdirSync(path.join(dir, label), { recursive: true }); await sharp(img.data, { raw: img.info }).png().toFile(path.join(dir, label, name)); };
  const frame = "home@40--s00-settled.png", real = "home@40--s01-settled.png";
  const banded = (img) => { const out = structuredClone(img); for (let c = 0; c < W; c++) out.data.set([1, 2, 3], (80 * W + c) * 3); return out; };
  await write("a", frame, withSquare(2, 10)); await write("ra", frame, withSquare(20, 12));
  await write("b", frame, withSquare(10, 30)); await write("rb", frame, withSquare(28, 26));
  await write("a", real, withSquare(2, 10)); await write("ra", real, withSquare(20, 12));
  await write("b", real, banded(withSquare(10, 30))); await write("rb", real, banded(withSquare(28, 26)));
  const report = await compareCapture(path.join(dir, "a"), path.join(dir, "b"), { before: "a", after: "b", diffDir: path.join(dir, "a-vs-b"), threshold: 0.02, thresholdMid: 20, retakes: { before: path.join(dir, "ra"), after: path.join(dir, "rb") } });
  const byName = Object.fromEntries(report.files.map((f) => [f.name, f]));
  assert.equal(byName[frame].status, "UNSTABLE");
  assert.match(byName[frame].line, /^UNSTABLE home@40--s00-settled\.png +[\d.]+% \(\d+ px\) rows /);
  assert.match(causeLine(byName[frame].cause), /^cause: unstable — scroll step 0, settled: the shot also differs between two takes of one build at rows \d+-\d+, x \d+-\d+ \(and 1 more region\), and every changed pixel lies there: that region is no evidence either way, and outside it the two sides are identical$/);
  assert.equal(byName[real].status, "CHANGED");
  assert.match(causeLine(byName[real].cause), /^cause: scroll step 1, settled, rows \d+-\d+: no section geometry for this kind of shot; the diff image shows where; reproduced on a fresh retake of each side, 40 pixels of it outside where the shot also differs between two takes of one build$/);
  assert.deepEqual(report.summary, { ok: 0, changed: 1, size: 0, missing: 0, flaky: 0, unstable: 1, exit: 1 }, "an UNSTABLE frame proves nothing either way: the compare does not pass it");
  fs.rmSync(dir, { recursive: true, force: true });
});
