// lab render against a throwaway site with one loop scene, run through the
// bin the way an agent runs it: a still, a frame sequence, a resolved .svg,
// and — when an ffmpeg exists — a WebM.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { chromePath, ffmpegPath } from "../lib/browser.mjs";
import { LAB_DIR, sceneTemplate } from "../lib/lab.mjs";

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
