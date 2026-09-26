// The screenshot harness on the fixture site, through the bin: a static
// capture and its capture.json, a motion capture with the settled frame and
// a section's data-settle, a capture that photographs its snapshot of the
// build while the tree changes, and a compare of two builds of different
// heights.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { chromePath } from "../lib/browser.mjs";
import { LOOP_PAGE, addPage, fixtureSite } from "../fixtures/site.mjs";

const BIN = path.resolve(import.meta.dirname, "../../bin/agentic-cms.mjs");
const skip = chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`";
const run = (root, args) => spawnSync(process.execPath, [BIN, "visual-parity", ...args], { cwd: root, encoding: "utf8" });
const files = (root, label) => fs.readdirSync(path.join(root, ".parity/visual", label)).sort();

test("a static capture writes the shots, the menu, meta.json and capture.json last; --json prints the summary", { skip }, () => {
  const root = fixtureSite();
  try {
    const r = run(root, ["capture", "a", "--widths", "800,390", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const summary = JSON.parse(r.stdout);
    assert.deepEqual(summary.pages, ["/", "/about"]);
    assert.deepEqual(summary.widths, [800, 390]);
    assert.equal(summary.meta.scheme, "light");
    assert.deepEqual(files(root, "a"), ["about@390.png", "about@390.sections.json", "about@800.png", "about@800.sections.json", "capture.json", "home@390--menu.png", "home@390.png", "home@390.sections.json", "home@800.png", "home@800.sections.json", "meta.json"]);
    assert.equal(summary.files, 9, "the shots and their section geometry; meta.json and capture.json are not counted");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/a/home@800.sections.json"), "utf8")).map((s) => s.section), ["hero", "second", "third"]);
    assert.match(r.stderr, /a: 5 screenshots/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a motion capture takes the mid-flight frames and a settled frame that waits for a section's data-settle, and records it", { skip }, () => {
  const root = fixtureSite();
  try {
    const r = run(root, ["capture", "m", "--motion", "--widths", "800", "--pages", "/"]);
    assert.equal(r.status, 0, r.stderr);
    const names = files(root, "m");
    assert.ok(names.includes("home@800--s00-150.png") && names.includes("home@800--s00-500.png") && names.includes("home@800--s00-settled.png"), names.join(" "));
    assert.ok(names.includes("home@800.animations.json") && names.includes("home@800.settle.json"));
    const steps = JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/m/home@800.settle.json"), "utf8"));
    const long = steps.find((s) => s.declared.some((d) => d.id === "second"));
    assert.ok(long, "a step had the data-settle section in view");
    assert.equal(long.waited, 2600);
    assert.equal(long.declared.find((d) => d.id === "second").settle, 2600);
    assert.ok(steps.some((s) => s.waited === 2000), "a step without a declaration waited the default");
    const meta = JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/m/meta.json"), "utf8"));
    assert.deepEqual(meta.frames, [150, 500, "settled"]);
    assert.equal(meta.settle, 2000);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("--settle without --motion, and two build sources at once, are usage errors", { skip }, () => {
  const root = fixtureSite();
  try {
    assert.equal(run(root, ["capture", "x", "--settle", "3000"]).status, 2);
    assert.equal(run(root, ["capture", "x", "--build", "--url", "http://127.0.0.1:1"]).status, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a capture photographs its snapshot of the build: an edit to public/ after the snapshot line changes nothing, and the copy goes when it finishes", { skip }, async () => {
  const root = fixtureSite();
  try {
    const args = ["--widths", "800", "--pages", "/"];
    assert.equal(run(root, ["capture", "a", ...args]).status, 0);
    const mark = path.join(root, "public/images/mark.svg");
    const original = fs.readFileSync(mark, "utf8");
    const edited = original.replace(/<rect[^>]*\/>/, '<circle cx="32" cy="32" r="6" fill="currentColor"/>');
    assert.notEqual(edited, original);
    // b: the edit lands the moment the snapshot line is printed, before the browser has even started
    const child = spawn(process.execPath, [BIN, "visual-parity", "capture", "b", ...args], { cwd: root });
    let out = "";
    const status = await new Promise((resolve) => {
      child.stdout.on("data", (chunk) => { out += chunk; if (/^snapshot: /m.test(out) && fs.readFileSync(mark, "utf8") === original) fs.writeFileSync(mark, edited); });
      child.on("close", resolve);
    });
    assert.equal(status, 0);
    assert.match(out, /^snapshot: \d+ files, [\d.]+ MB of the build \(not a git checkout\) — building or editing from here on does not change this capture$/m);
    assert.equal(fs.readFileSync(mark, "utf8"), edited, "the edit landed while b ran");
    assert.equal(run(root, ["compare", "a", "b"]).status, 0, "b photographed its snapshot, not the edited tree");
    assert.ok(!fs.existsSync(path.join(root, ".parity/snapshots/b")), "the snapshot is removed when the capture finishes");
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/b/meta.json"), "utf8")).tree, null, "the fixture is not a git checkout");
    assert.equal(run(root, ["capture", "c", ...args]).status, 0);
    assert.equal(run(root, ["compare", "a", "c"]).status, 1, "a capture after the edit sees it");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("an inline SMIL loop is held: two static captures agree, two motion captures agree frame for frame, and the inventory lists it", { skip }, () => {
  const root = fixtureSite();
  try {
    addPage(root, "/loop", LOOP_PAGE);
    const args = ["--widths", "800", "--pages", "/loop"];
    for (const label of ["s1", "s2"]) assert.equal(run(root, ["capture", label, ...args]).status, 0);
    assert.equal(run(root, ["compare", "s1", "s2"]).status, 0, "static: the loop at its data-rest in both");
    for (const label of ["m1", "m2"]) assert.equal(run(root, ["capture", label, "--motion", ...args]).status, 0);
    const r = run(root, ["compare", "m1", "m2", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    for (const frame of ["loop@800--s00-150.png", "loop@800--s00-500.png", "loop@800--s00-settled.png"]) {
      const entry = report.files.find((f) => f.name === frame);
      assert.equal(entry?.changedPixels, 0, `${frame}: the SMIL clock set to the frame's own time`);
    }
    const inventory = JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/m1/loop@800.animations.json"), "utf8"));
    const smil = inventory.filter((a) => a.type === "smil");
    assert.equal(smil.length, 1);
    assert.equal(smil[0].duration, 2);
    assert.equal(smil[0].rest, 1.2);
    assert.deepEqual([smil[0].target.w, smil[0].target.h], [200, 100]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("compare names the section behind a sub-pixel shift: a hero half a pixel taller, every row below re-antialiased", { skip }, () => {
  const root = fixtureSite();
  try {
    const page = path.join(root, ".next/server/app/index.html");
    const html = fs.readFileSync(page, "utf8");
    fs.writeFileSync(page, html.replace('<section id="hero" data-section="hero">', '<section id="hero" data-section="hero" style="min-height: 0">'));
    assert.equal(run(root, ["capture", "before", "--widths", "800", "--pages", "/"]).status, 0);
    fs.writeFileSync(page, html.replace('<section id="hero" data-section="hero">', '<section id="hero" data-section="hero" style="min-height: 0; padding-bottom: calc(2rem + 0.5px)">'));
    assert.equal(run(root, ["capture", "after", "--widths", "800", "--pages", "/"]).status, 0);
    const r = run(root, ["compare", "before", "after", "--pages", "/", "--json"]);
    assert.equal(r.status, 1);
    const home = JSON.parse(r.stdout).files.find((f) => f.name === "home@800.png");
    assert.deepEqual([home.cause.section, home.cause.moved, home.cause.delta, home.cause.fractional], ["hero", "height", 0.5, true]);
    assert.match(r.stderr, /cause: hero height [\d.]+ → [\d.]+ \(\+0\.500 px, fractional: every row below re-antialiased\)/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("compare: a page whose section changed and grew is a SIZE line with the row, the tail, the band and the verdict, crops and report.json", { skip }, () => {
  const root = fixtureSite();
  try {
    // the hero at its content height on both sides, so the 40 px block grows the page by exactly 40 rows
    const page = path.join(root, ".next/server/app/index.html");
    fs.writeFileSync(page, fs.readFileSync(page, "utf8").replace('<section id="hero" data-section="hero">', '<section id="hero" data-section="hero" style="min-height: 0">'));
    assert.equal(run(root, ["capture", "before", "--widths", "800", "--pages", "/,/about"]).status, 0);
    fs.writeFileSync(page, fs.readFileSync(page, "utf8").replace("<h1>A fixture page</h1>", "<h1>A fixture page, changed</h1>").replace("for the browser tests.</p>", 'for the browser tests.</p><div style="height: 40px"></div>'));
    assert.equal(run(root, ["capture", "after", "--widths", "800", "--pages", "/,/about"]).status, 0);
    const r = run(root, ["compare", "before", "after", "--json"]);
    assert.equal(r.status, 1);
    const report = JSON.parse(r.stdout);
    const home = report.files.find((f) => f.name === "home@800.png");
    assert.equal(home.status, "SIZE");
    assert.equal(home.verdict, "shift");
    assert.equal(home.delta, 40);
    assert.ok(home.head > 0 && home.tail > 0, `head ${home.head}, tail ${home.tail}`);
    assert.match(home.line, /^SIZE {5}home@800\.png +800x\d+ -> 800x\d+ \(\+40\) {2}same to row \d+, tail \d+ rows, band \d+-\d+ -> \d+-\d+: shift$/);
    assert.deepEqual([home.cause.section, home.cause.moved, home.cause.delta, home.cause.fractional], ["hero", "height", 40, false], "the hero, by the 40 px block");
    assert.match(r.stderr, /\n {9}cause: hero height [\d.]+ → [\d.]+ \(\+40\.000 px\)\n/);
    assert.ok(fs.existsSync(path.join(root, ".parity/visual/before-vs-after", home.crops.before)) && fs.existsSync(path.join(root, ".parity/visual/before-vs-after", home.crops.after)));
    assert.equal(report.files.find((f) => f.name === "about@800.png").status, "ok");
    assert.deepEqual(report.summary, { ok: 1, changed: 0, size: 1, missing: 0, exit: 1 });
    assert.ok(fs.existsSync(path.join(root, ".parity/visual/before-vs-after/report.json")));
    assert.match(r.stderr, /1 file\(s\) differ/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
