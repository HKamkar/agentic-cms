// The screenshot harness on the fixture site, through the bin: a static
// capture and its capture.json, a motion capture with the settled frame and
// a section's data-settle, and a compare of two builds of different heights.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { chromePath } from "../lib/browser.mjs";
import { fixtureSite } from "../fixtures/site.mjs";

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
    assert.deepEqual(files(root, "a"), ["about@390.png", "about@800.png", "capture.json", "home@390--menu.png", "home@390.png", "home@800.png", "meta.json"]);
    assert.equal(summary.files, 5, "the shots; meta.json and capture.json are not counted");
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
    assert.ok(fs.existsSync(path.join(root, ".parity/visual/before-vs-after", home.crops.before)) && fs.existsSync(path.join(root, ".parity/visual/before-vs-after", home.crops.after)));
    assert.equal(report.files.find((f) => f.name === "about@800.png").status, "ok");
    assert.deepEqual(report.summary, { ok: 1, changed: 0, size: 1, missing: 0, exit: 1 });
    assert.ok(fs.existsSync(path.join(root, ".parity/visual/before-vs-after/report.json")));
    assert.match(r.stderr, /1 file\(s\) differ/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
