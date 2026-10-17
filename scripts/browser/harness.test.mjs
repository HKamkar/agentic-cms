// The screenshot harness on the fixture site, through the bin: a static
// capture and its capture.json, the site's profile as a capture's defaults,
// a motion capture with the settled frame and
// a section's data-settle, a capture that photographs its snapshot of the
// build while the tree changes, and a compare of two builds of different
// heights.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { chromePath } from "../lib/browser.mjs";
import { CANVAS_PAGE, LAZY_PAGE, LOOP_PAGE, SPIN_PAGE, addPage, fixtureSite } from "../fixtures/site.mjs";

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
    assert.equal(summary.meta.thirdParty, "hold", "other origins' scripts held by default on a build the harness serves");
    assert.deepEqual(files(root, "a"), ["about@390.png", "about@390.sections.json", "about@800.png", "about@800.sections.json", "capture.json", "home@390--menu.png", "home@390.png", "home@390.sections.json", "home@800.png", "home@800.sections.json", "meta.json"]);
    assert.equal(summary.files, 9, "the shots and their section geometry; meta.json and capture.json are not counted");
    assert.equal(summary.timings.taken, 4, "one timing per page-width");
    assert.ok(summary.timings.seconds > 0 && summary.timings.slowest.length === 4 && summary.timings.slowest[0].name.includes("@"), "the slowest page-widths, named");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/a/home@800.sections.json"), "utf8")).map((s) => s.section), ["hero", "second", "third"]);
    assert.match(r.stderr, /a: 5 screenshots/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the site's profile names a capture's widths and scheme, a flag still wins, the menu is shot at each profile width where its button shows, and the widths a flag named keep the shot cache", { skip }, () => {
  const root = fixtureSite();
  try {
    // the menu button hides from 700 px up, as a site's does above its menu breakpoint
    const home = path.join(root, ".next/server/app/index.html");
    fs.writeFileSync(home, fs.readFileSync(home, "utf8").replace("</head>", "<style>@media (min-width: 700px) { header button { display: none; } }</style></head>"));
    assert.equal(run(root, ["capture", "w", "--widths", "800,390", "--scheme", "dark"]).status, 0, "before the profile: its widths as a flag");
    fs.mkdirSync(path.join(root, "src/config"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/config/harness.ts"), "export const harness = { widths: [800, 390], schemes: [\"dark\", \"light\"] };\n");
    const profiled = run(root, ["capture", "p", "--json"]);
    assert.equal(profiled.status, 0, profiled.stderr);
    const summary = JSON.parse(profiled.stdout);
    assert.deepEqual(summary.widths, [800, 390], "the profile's widths");
    assert.equal(summary.meta.scheme, "dark", "the profile's first scheme");
    assert.deepEqual(files(root, "p").filter((f) => f.includes("--menu")), ["home@390--menu.png"], "no menu where its button does not show");
    assert.deepEqual(summary.reused, { shots: 3, of: 4 }, "the same widths reuse the cache: only the home page at 800, where the menu is now tried, is taken again");
    const flagged = JSON.parse(run(root, ["capture", "f", "--widths", "390", "--scheme", "light", "--json"]).stdout);
    assert.deepEqual([flagged.widths, flagged.meta.scheme], [[390], "light"], "the flags win");
    fs.writeFileSync(path.join(root, "src/config/harness.ts"), "export const harness = { widths: [390.5] };\n");
    const broken = run(root, ["capture", "x"]);
    assert.equal(broken.status, 2);
    assert.match(broken.stderr, /visual-parity capture: src\/config\/harness\.ts: harness\.widths is a list of whole viewport widths/);
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
    // b: the edit lands the moment the snapshot line is printed, before the browser has even started; --fresh, or b
    // would copy a's shots (its snapshot's files are a's) and finish before the edit could matter
    const child = spawn(process.execPath, [BIN, "visual-parity", "capture", "b", ...args, "--fresh"], { cwd: root });
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

test("an unchanged page-width is copied from .parity/shot-cache, a changed one taken again, and --fresh takes them all", { skip }, () => {
  const root = fixtureSite();
  const capture = (label, ...more) => { const r = run(root, ["capture", label, "--widths", "800", "--json", ...more]); assert.equal(r.status, 0, r.stderr); return { summary: JSON.parse(r.stdout), stdout: r.stdout, stderr: r.stderr }; };
  try {
    assert.deepEqual(capture("a").summary.reused, { shots: 0, of: 2 }, "the first capture has nothing to reuse");
    const b = capture("b");
    assert.deepEqual(b.summary.reused, { shots: 2, of: 2 });
    assert.equal(b.summary.timings.taken, 0, "nothing was taken, so nothing was timed");
    assert.match(b.stderr, /b: 2 screenshots in \.parity\/visual\/b \(2 of 2 page-widths reused from \.parity\/shot-cache/);
    assert.deepEqual(files(root, "b").filter((f) => f !== "capture.json"), files(root, "a").filter((f) => f !== "capture.json"));
    assert.equal(run(root, ["compare", "a", "b"]).status, 0);
    const mark = path.join(root, "public/images/mark.svg");
    fs.writeFileSync(mark, fs.readFileSync(mark, "utf8").replace(/<rect[^>]*\/>/, '<circle cx="32" cy="32" r="6" fill="currentColor"/>'));
    const c = capture("c");
    assert.deepEqual(c.summary.reused, { shots: 1, of: 2 }, "about is reused; home, which shows the mark, is taken again");
    assert.deepEqual(c.summary.timings.slowest.map((t) => t.name), ["home@800"]);
    const report = JSON.parse(run(root, ["compare", "a", "c", "--json"]).stdout);
    assert.deepEqual(report.files.filter((f) => f.status !== "ok").map((f) => f.name), ["home@800.png"]);
    assert.deepEqual(capture("d", "--fresh").summary.reused, { shots: 0, of: 2 });
    assert.deepEqual(capture("e", "--third-party", "allow").summary.reused, { shots: 0, of: 2 }, "held and allowed shots are never mixed");
    assert.ok(fs.readdirSync(path.join(root, ".parity/shot-cache")).length > 0);
    assert.ok(!fs.existsSync(path.join(root, ".parity/shots")), "the cache keeps out of the folder `agentic-cms shot` writes to");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("--jobs: one browser and three take the same shots, and the summary says how many worked; --jobs 0 or 1.5 is a usage error", { skip }, () => {
  const root = fixtureSite();
  try {
    for (const jobs of ["1", "3"]) {
      const r = run(root, ["capture", `j${jobs}`, "--widths", "800,390", "--jobs", jobs, "--fresh", "--json"]);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(JSON.parse(r.stdout).jobs, Number(jobs));
      assert.match(r.stderr, new RegExp(`j${jobs}: 5 screenshots`), "every shot counted, whichever browser took it");
    }
    assert.deepEqual(files(root, "j3").filter((f) => f !== "capture.json"), files(root, "j1").filter((f) => f !== "capture.json"));
    assert.equal(run(root, ["compare", "j1", "j3"]).status, 0);
    for (const bad of ["0", "1.5"]) {
      const r = run(root, ["capture", "x", "--jobs", bad]);
      assert.equal(r.status, 2);
      assert.match(r.stderr, /--jobs takes a whole number of browsers, 1 or more/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("--sample 1 photographs one page of each template, lists the rest, and the compare leaves them out; with --motion or --pages it is a usage error", { skip }, () => {
  const root = fixtureSite();
  try {
    for (const slug of ["a", "b"]) addPage(root, `/blog-post/${slug}`, fs.readFileSync(path.join(root, ".next/server/app/about.html"), "utf8"));
    const routes = { "/": null, "/about": null, "/blog-post/a": "/blog-post/[slug]", "/blog-post/b": "/blog-post/[slug]" };
    fs.writeFileSync(path.join(root, ".next/prerender-manifest.json"), JSON.stringify({ routes: Object.fromEntries(Object.entries(routes).map(([route, srcRoute]) => [route, { srcRoute }])) }));
    const r = run(root, ["capture", "s", "--sample", "1", "--widths", "800", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).pages, ["/", "/about", "/blog-post/a"], "read from the snapshot, which carries the manifest");
    assert.match(r.stderr, /sample: the first 1 of each template's pages; 1 left out \(\/blog-post\/b\)/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/s/meta.json"), "utf8")).sample, { n: 1, skipped: ["/blog-post/b"] });
    assert.equal(run(root, ["capture", "all", "--widths", "800"]).status, 0);
    const compared = run(root, ["compare", "all", "s"]);
    assert.equal(compared.status, 0, compared.stdout);
    assert.match(compared.stdout, /sampled: 1 page\(s\) left out by --sample on one side or both, not judged/);
    for (const bad of [["--motion"], ["--pages", "/"], ["--states"]]) assert.equal(run(root, ["capture", "x", "--sample", "1", ...bad]).status, 2, bad.join(" "));
    assert.match(run(root, ["capture", "x", "--sample", "0"]).stderr, /--sample takes a whole number of pages per template/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("an inline SMIL loop is held: two static captures agree, two motion captures agree frame for frame, and the inventory lists it", { skip }, () => {
  const root = fixtureSite();
  try {
    addPage(root, "/loop", LOOP_PAGE);
    const args = ["--widths", "800", "--pages", "/loop"];
    // --fresh: the second of each pair takes its shots again, which is what is being proved deterministic
    for (const label of ["s1", "s2"]) assert.equal(run(root, ["capture", label, ...args, "--fresh"]).status, 0);
    assert.equal(run(root, ["compare", "s1", "s2"]).status, 0, "static: the loop at its data-rest in both");
    for (const label of ["m1", "m2"]) assert.equal(run(root, ["capture", label, "--motion", ...args, "--fresh"]).status, 0);
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

test("an infinite CSS loop never enters the animation inventory, however often its observer restarts it: three motion captures list the same finite animations", { skip }, () => {
  const root = fixtureSite();
  try {
    addPage(root, "/spin", SPIN_PAGE);
    const inventories = ["l1", "l2", "l3"].map((label) => {
      assert.equal(run(root, ["capture", label, "--motion", "--widths", "800", "--pages", "/spin", "--fresh"]).status, 0);
      return JSON.parse(fs.readFileSync(path.join(root, ".parity/visual", label, "spin@800.animations.json"), "utf8"));
    });
    assert.deepEqual(inventories[0].filter((a) => a.name === "spin"), [], "no loop, whatever CDP sends for its iterations");
    assert.ok(inventories[0].length > 0 && inventories[0].every((a) => a.name === "fade" && a.iterations === 1), "the fades are still recorded, with their count");
    assert.deepEqual(inventories[1], inventories[0], "the same inventory on a second capture");
    assert.deepEqual(inventories[2], inventories[0], "and a third");
    const r = run(root, ["compare", "l1", "l2", "--pages", "/spin", "--json"]);
    assert.equal(JSON.parse(r.stdout).files.find((f) => f.name === "spin@800.animations.json")?.status, "ok", r.stderr);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a settled frame with a loop the harness cannot hold differs between two captures of one build: without retakes it is CHANGED and unretaken, with them UNSTABLE where the loop runs; a change beyond that region is still CHANGED", { skip, timeout: 240000 }, () => {
  const root = fixtureSite();
  try {
    addPage(root, "/canvas", CANVAS_PAGE);
    const args = ["--motion", "--widths", "800", "--pages", "/canvas"];
    const capture = (label, ...more) => { const r = run(root, ["capture", label, ...args, ...more]); assert.equal(r.status, 0, r.stderr); };
    const settled = "canvas@800--s00-settled.png";
    capture("one", "--fresh");
    capture("two", "--fresh");
    const bare = run(root, ["compare", "one", "two", "--json"]);
    assert.equal(bare.status, 1, "one build, two captures: the settled frame differs");
    const unjudged = JSON.parse(bare.stdout);
    assert.equal(unjudged.files.find((f) => f.name === settled).status, "CHANGED");
    assert.deepEqual(unjudged.unretaken, [settled]);
    assert.match(bare.stderr, /^ {9}cause: scroll step 0, settled, rows \d+-\d+: no section geometry for this kind of shot; the diff image shows where$/m, "no claim that a settled frame never moves");
    assert.doesNotMatch(bare.stderr, /never jitters/);
    capture("one-retake", "--no-cache");
    capture("two-retake", "--no-cache");
    const judged = run(root, ["compare", "one", "two", "--retake-before", "one-retake", "--retake-after", "two-retake", "--json"]);
    assert.equal(judged.status, 1, "an UNSTABLE frame is not a pass");
    const report = JSON.parse(judged.stdout);
    const frame = report.files.find((f) => f.name === settled);
    assert.equal(frame.status, "UNSTABLE", frame.line);
    assert.ok(frame.cause.noise.every(([, y0, , y1]) => y0 >= 0 && y1 <= 300 + 16), "the region is the canvas's rows, grown by the margin");
    assert.match(judged.stderr, /^UNSTABLE canvas@800--s00-settled\.png/m);
    assert.match(judged.stderr, /^ {9}cause: unstable — scroll step 0, settled: the shot also differs between two takes of one build at rows \d+-\d+, x \d+-\d+/m);
    assert.deepEqual([report.summary.unstable, report.summary.changed, report.unretaken], [1, 0, []]);
    // the heading below the canvas changes for real: the frame differs beyond the canvas's region too
    addPage(root, "/canvas", CANVAS_PAGE.replace("Below the canvas", "Below the canvas, retitled"));
    capture("three", "--fresh");
    capture("three-retake", "--no-cache");
    const changed = run(root, ["compare", "one", "three", "--retake-before", "one-retake", "--retake-after", "three-retake", "--json"]);
    const real = JSON.parse(changed.stdout).files.find((f) => f.name === settled);
    assert.equal(real.status, "CHANGED", real.line);
    assert.ok(real.cause.outside > 0, "the changed heading lies outside the region the canvas moves in");
    assert.match(changed.stderr, /; reproduced on a fresh retake of each side, \d+ pixels of it outside where the shot also differs between two takes of one build$/m);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// The fixture's /lazy page served by the test, which holds /images/late.svg back: `hold(n)` says whether the nth
// request for it (from 1) gets no answer. A capture of it runs as a child, so this process stays free to answer.
async function lazyServer(root, hold) {
  let asked = 0;
  const server = http.createServer((req, res) => {
    if (req.url === "/lazy") { res.writeHead(200, { "content-type": "text/html" }); return res.end(fs.readFileSync(path.join(root, ".next/server/app/lazy.html"))); }
    if (req.url === "/images/late.svg" && hold(++asked)) return; // never answered: the page closes the request
    const publicDir = path.join(root, "public");
    const file = path.resolve(publicDir, `.${new URL(req.url, "http://fixture").pathname}`);
    if (!file.startsWith(publicDir + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": "image/svg+xml" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, asked: () => asked, close: () => { server.closeAllConnections(); server.close(); } };
}
const runAsync = (root, args) => new Promise((resolve) => { let stderr = ""; const child = spawn(process.execPath, [BIN, "visual-parity", ...args], { cwd: root }); child.stderr.on("data", (d) => { stderr += d; }); child.on("exit", (status) => resolve({ status, stderr })); });

test("a lazy image that has not arrived is never photographed silently: the page is loaded again once, and a shot still without it is FLAKY with its cause", { skip, timeout: 120000 }, async () => {
  const root = fixtureSite();
  try {
    addPage(root, "/lazy", LAZY_PAGE);
    fs.copyFileSync(path.join(root, "public/images/mark.svg"), path.join(root, "public/images/late.svg"));
    const args = ["--widths", "800", "--pages", "/lazy"];
    assert.equal(run(root, ["capture", "ref", ...args]).status, 0, "the image served at once");
    const once = await lazyServer(root, (n) => n === 1);
    const retried = await runAsync(root, ["capture", "retried", "--url", once.url, ...args]);
    once.close();
    assert.equal(retried.status, 0, retried.stderr);
    assert.match(retried.stderr, /1 image\(s\) not loaded on .*\/lazy, the first .*\/images\/late\.svg at y=\d+; reloading lazy@800 once/);
    assert.equal(once.asked(), 2, "asked again after the reload, and answered");
    assert.ok(!fs.existsSync(path.join(root, ".parity/visual/retried/lazy@800.unloaded.json")));
    assert.equal(run(root, ["compare", "ref", "retried"]).status, 0, "the reload photographed the image");
    const never = await lazyServer(root, () => true);
    const flaky = await runAsync(root, ["capture", "flaky", "--url", never.url, ...args]);
    never.close();
    assert.equal(flaky.status, 0, "a second miss is recorded, not a failed run");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/flaky/lazy@800.unloaded.json"), "utf8")).map((i) => [i.src.replace(/^http:\/\/[^/]+/, ""), i.width, i.height]), [["/images/late.svg", 400, 400]]);
    const r = run(root, ["compare", "ref", "flaky"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^FLAKY {4}lazy@800\.png/m);
    assert.match(r.stdout, /^ {9}cause: image not loaded on after at y=\d+ \(.*\/images\/late\.svg, 400x400\): the shot is not evidence; retake the page with --fresh$/m);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a static shot that differs and does not reproduce is FLAKY: a retake --no-cache that matches the other side, judged by compare --retake-after; a retake of another build, or one that may come from the cache, is refused", { skip }, () => {
  const root = fixtureSite();
  try {
    const home = path.join(root, ".next/server/app/index.html");
    const html = fs.readFileSync(home, "utf8");
    fs.writeFileSync(path.join(root, ".next/BUILD_ID"), "build-1");
    const args = ["--widths", "800", "--pages", "/"];
    assert.equal(run(root, ["capture", "base", ...args]).status, 0);
    // the after side's first take, as a jittered one looks: the list's labels and its heading a pixel lower, about 0.06 % of the shot
    fs.writeFileSync(home, html.replace(/> (one|two)<\/li>/g, '><span style="position: relative; top: 1px">$1</span></li>').replace("<h2>Fits the stack</h2>", '<h2 style="position: relative; top: 1px">Fits the stack</h2>'));
    assert.equal(run(root, ["capture", "first", ...args]).status, 0);
    fs.writeFileSync(home, html);
    const cached = () => fs.readdirSync(path.join(root, ".parity/shot-cache")).flatMap((key) => fs.existsSync(path.join(root, ".parity/shot-cache", key, "home@800")) ? fs.readdirSync(path.join(root, ".parity/shot-cache", key, "home@800")) : []).length;
    const entries = cached();
    const retake = run(root, ["capture", "retake", ...args, "--no-cache", "--json"]);
    assert.equal(retake.status, 0, retake.stderr);
    assert.equal(JSON.parse(retake.stdout).reused, null, "nothing copied from the cache");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/retake/meta.json"), "utf8")).build, "build-1");
    assert.equal(cached(), entries, "and nothing stored in it");
    const bare = run(root, ["compare", "base", "first"]);
    assert.equal(bare.status, 1);
    assert.match(bare.stdout, /^CHANGED  home@800\.png/m);
    assert.match(bare.stdout, /^1 shot\(s\) differ and no retake judged them: a compare cannot take a shot\. `visual-parity proof` retakes each once on both sides/m);
    const judged = run(root, ["compare", "base", "first", "--retake-after", "retake", "--json"]);
    assert.equal(judged.status, 1, "a FLAKY line is not a pass");
    const entry = JSON.parse(judged.stdout).files.find((f) => f.name === "home@800.png");
    assert.equal(entry.status, "FLAKY");
    assert.match(judged.stderr, /^FLAKY {4}home@800\.png/m);
    assert.match(judged.stderr, /^ {9}cause: the difference does not reproduce — a fresh retake of the after side matches the before shot: the first after shot jittered, the capture's doing, not the build's$/m);
    assert.doesNotMatch(judged.stderr, /no retake judged them/);
    const cachedRetake = run(root, ["compare", "base", "first", "--retake-after", "base"]);
    assert.equal(cachedRetake.status, 2);
    assert.match(cachedRetake.stderr, /base cannot stand as a retake of first: it may have copied shots from the shot cache/);
    fs.writeFileSync(path.join(root, ".next/BUILD_ID"), "build-2");
    assert.equal(run(root, ["capture", "rebuilt", ...args, "--no-cache"]).status, 0);
    const rebuilt = run(root, ["compare", "base", "first", "--retake-after", "rebuilt"]);
    assert.equal(rebuilt.status, 2);
    assert.match(rebuilt.stderr, /rebuilt cannot stand as a retake of first: it photographed another build \(build id build-2, the side's build-1\)/);
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
    assert.deepEqual(report.summary, { ok: 1, changed: 0, size: 1, missing: 0, flaky: 0, unstable: 0, exit: 1 });
    assert.deepEqual(report.unretaken, ["home@800.png"], "a bare compare names the shot it could not retake");
    assert.ok(fs.existsSync(path.join(root, ".parity/visual/before-vs-after/report.json")));
    assert.match(r.stderr, /1 file\(s\) differ/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
