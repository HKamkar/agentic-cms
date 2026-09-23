// lab render against a throwaway site with one loop scene, run through the
// bin the way an agent runs it: a still, a frame sequence, a resolved .svg,
// and — when an ffmpeg exists — a WebM; and the scene page of lab serve in
// Chromium at a phone's width: the enlarged view, the replay, the still.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { chromePath, ffmpegPath, launch } from "../lib/browser.mjs";
// The lab's modules reach the package (TypeScript in this checkout): the hook first, the import after it.
import "../lib/load-ts.mjs";

const { LAB_DIR, sceneTemplate } = await import("../lib/lab.mjs");
const { startLabServer } = await import("../lib/lab-server.mjs");

const BIN = path.resolve(import.meta.dirname, "../../bin/agentic-cms.mjs");
const skip = chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`";
const run = (root, args) => spawnSync(process.execPath, [BIN, "lab", ...args], { cwd: root, encoding: "utf8" });
const json = (root, args) => { const r = run(root, args); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
const GLOBALS = `@theme static {\n  --color-paper: light-dark(#ffffff, #121212);\n  --color-ink: light-dark(#000000, #f2f2f2);\n  --color-fill: light-dark(#e5e5e5, #2a2a2a);\n}`;

function labSite() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-lab-"));
  fs.mkdirSync(path.join(root, "src/app"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/app/globals.css"), GLOBALS);
  fs.mkdirSync(path.join(root, LAB_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, LAB_DIR, "spin.svg"), sceneTemplate("loop", "spin"));
  return root;
}

test("lab render: a still with alpha at the scene's size, another at --at 0.5 with different pixels at --scale 2, the scene copied beside them", { skip }, async () => {
  const root = labSite();
  try {
    const still = json(root, ["render", "spin", "--out", "out/spin.webp", "--json"]);
    assert.deepEqual([still.file, still.source, still.still, still.format, still.width, still.height, still.frames, still.fps, still.background], ["out/spin.webp", "out/spin.svg", null, "webp", 64, 64, 1, null, "transparent"]);
    assert.deepEqual(still.console, []);
    assert.equal(still.note, null, "out/ is not what a page embeds");
    const meta = await sharp(path.join(root, still.file)).metadata();
    assert.deepEqual([meta.width, meta.height, meta.hasAlpha], [64, 64, true]);
    assert.equal(fs.readFileSync(path.join(root, "out/spin.svg"), "utf8"), sceneTemplate("loop", "spin"), "the source beside the raster is the scene itself");
    const half = json(root, ["render", "spin", "--out", "out/half.webp", "--at", "0.5", "--scale", "2", "--json"]);
    assert.deepEqual([half.width, half.height], [128, 128]);
    const a = await sharp(path.join(root, still.file)).raw().toBuffer();
    const b = await sharp(path.join(root, half.file)).resize(64, 64, { kernel: "nearest" }).raw().toBuffer();
    assert.notEqual(Buffer.compare(a, b), 0, "the frame at 0.5 s differs from the one at 0");
    const paper = json(root, ["render", "spin", "--out", "out/paper.png", "--background", "paper", "--scheme", "dark", "--no-source", "--json"]);
    assert.equal(paper.source, null);
    const { data } = await sharp(path.join(root, paper.file)).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([data[0], data[1], data[2]], [0x12, 0x12, 0x12], "the dark paper under the drawing");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("lab render: --animate writes an animated WebP over the scene's cycle with its still beside it; --frames truncates", { skip }, async () => {
  const root = labSite();
  try {
    const loop = json(root, ["render", "spin", "--out", "out/loop.webp", "--animate", "--fps", "10", "--json"]);
    assert.deepEqual([loop.frames, loop.fps, loop.duration, loop.still, loop.source], [20, 10, 2, "out/loop-still.webp", "out/loop.svg"]);
    const meta = await sharp(path.join(root, loop.file), { animated: true }).metadata();
    assert.deepEqual([meta.pages, meta.loop, meta.delay[0], meta.delay.length, meta.width, meta.pageHeight], [20, 0, 100, 20, 64, 64]);
    const still = await sharp(path.join(root, loop.still)).metadata();
    assert.deepEqual([still.width, still.height, still.pages ?? 1], [64, 64, 1]);
    const three = json(root, ["render", "spin", "--out", "out/three.webp", "--frames", "3", "--fps", "10", "--lossy", "--json"]);
    assert.equal(three.frames, 3);
    assert.equal((await sharp(path.join(root, three.file), { animated: true }).metadata()).pages, 3);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("lab render: a .svg for the dark scheme resolves currentColor and the tokens, keeps the animation and writes the still beside it — no browser needed", async () => {
  const root = labSite();
  try {
    const out = json(root, ["render", "spin", "--out", "public/images/home/spin.svg", "--scheme", "dark", "--json"]);
    assert.deepEqual([out.file, out.still, out.source, out.format, out.width], ["public/images/home/spin.svg", "public/images/home/spin-still.svg", null, "svg", 64]);
    const svg = fs.readFileSync(path.join(root, out.file), "utf8");
    assert.match(svg, /^<!-- rendered by agentic-cms lab from \.parity\/lab\/spin\.svg/);
    assert.doesNotMatch(svg, /currentColor|var\(|data-duration|agentic-cms lab:/);
    assert.match(svg, /stroke="#f2f2f2"[\s\S]*<animate /);
    assert.match(out.note, /carries the dark scheme's; an <img> of it will not follow the site's theme/);
    assert.equal(json(root, ["render", "spin", "--out", "src/config/icons/spin.svg", "--json"]).note, null, "Icon data follows the theme: no note");
    const still = fs.readFileSync(path.join(root, out.still), "utf8");
    assert.doesNotMatch(still, /<animate|@keyframes|animation:/);
    assert.equal(run(root, ["render", "spin", "--out", ".parity/lab/spin.svg"]).status, 2, "never over the scene itself");
    assert.match(run(root, ["render", "nope", "--out", "x.svg"]).stderr, /nope: no such scene/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("lab render: a .webm through the ffmpeg at hand (Playwright's build writes VP8 on the paper)", { skip: skip || (ffmpegPath() ? false : "no ffmpeg on PATH or in Playwright's cache") }, () => {
  const root = labSite();
  try {
    const video = json(root, ["render", "spin", "--out", "out/loop.webm", "--animate", "--fps", "10", "--background", "paper", "--json"]);
    assert.deepEqual([video.format, video.frames, video.still], ["webm", 20, "out/loop-still.webp"]);
    assert.equal(fs.readFileSync(path.join(root, video.file)).subarray(0, 4).toString("hex"), "1a45dfa3", "an EBML (WebM) file");
    assert.ok(video.bytes > 1000, `${video.bytes} bytes`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("lab serve's scene page at a phone's width: no sideways scroll, the enlarged frame at the scene's ratio, a replay that restarts everything under one new URL, a still with nothing running", { skip }, async () => {
  const root = labSite();
  const server = await startLabServer({ root });
  const { context, close } = await launch({ motion: true, width: 390, height: 844 });
  try {
    const page = await context.newPage();
    await page.goto(`${server.url}/scene/spin`, { waitUntil: "load" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "fits the phone");
    const big = page.locator('iframe[title="spin light enlarged"]');
    const box = await big.boundingBox();
    assert.ok(box.width > 200 && Math.abs(box.height - box.width) <= 1, `a square scene, enlarged: ${box.width}×${box.height}`);
    const inner = await big.contentFrame().locator("svg.lab-scene").boundingBox();
    assert.ok(Math.abs(inner.width - box.width) <= 1, "the drawing fills the frame");

    const scrub = page.locator("[data-lab-timeline] [data-lab-time]");
    await scrub.fill("1");
    assert.equal(await page.locator("[data-lab-play]").textContent(), "Play", "the range paused it at 1 s");
    await page.locator("[data-lab-replay]").click();
    assert.equal(await page.locator("[data-lab-play]").textContent(), "Pause", "playing again");
    const sources = await page.locator("img.lab-img").evaluateAll((imgs) => imgs.map((img) => new URL(img.src).pathname + new URL(img.src).search));
    assert.ok(sources.length >= 2 && sources.every((src) => src === "/files/spin.svg?replay=1"), `one new URL for every copy: ${sources}`);
    const times = await page.evaluate(() => [...document.querySelectorAll("iframe.lab-frame")].map((f) => f.contentWindow.lab.time()));
    assert.ok(times.every((t) => t < 0.9 && Math.abs(t - times[0]) < 1e-6), `every frame restarted from 0, on one clock: ${times}`);

    await page.getByRole("link", { name: "still" }).click();
    await page.waitForURL(/\?still=1$/);
    assert.equal(await page.locator("[data-lab-timeline]").count(), 0);
    const frames = page.frames().filter((f) => f !== page.mainFrame());
    assert.ok(frames.length >= 8, `every size, both schemes, enlarged: ${frames.length} frames`);
    for (const frame of frames) {
      assert.deepEqual(await frame.evaluate(() => [document.getAnimations().length, document.querySelectorAll("animate").length]), [0, 0], frame.url());
    }
    assert.ok(await page.locator("img.lab-img").evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0 && img.src.endsWith("?still=1"))));
  } finally {
    await close();
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
