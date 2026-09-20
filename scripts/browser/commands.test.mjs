// shot, probe and sheet against the fixture site, run through the bin the way
// an agent runs them; each prints JSON, so the assertions read numbers.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { chromePath } from "../lib/browser.mjs";
import { fixtureSite } from "../fixtures/site.mjs";

const BIN = path.resolve(import.meta.dirname, "../../bin/agentic-cms.mjs");
const skip = chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`";
const run = (root, args) => spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: "utf8" });
const json = (root, args) => { const r = run(root, args); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };

test("shot: a full page, then an element by heading on a transparent ground, trimmed and resized, with its box", { skip }, async () => {
  const root = fixtureSite();
  try {
    const page = json(root, ["shot", "/", "--width", "800", "--json"]);
    assert.equal(page.route, "/");
    assert.equal(page.target, null);
    assert.equal(page.out, ".parity/shots/home@800.png");
    const full = await sharp(path.join(root, page.out)).metadata();
    assert.equal(full.width, 800);
    assert.ok(full.height > 900, "a full-page shot is taller than the viewport");

    const section = json(root, ["shot", "/", "--heading", "fits the stack", "--scale", "2", "--transparent", "--trim", "--resize", "600", "--out", "out/stack.webp", "--json"]);
    assert.equal(section.target.by, "heading");
    assert.equal(section.target.tag, "section");
    assert.equal(section.target.id, "second");
    assert.ok(section.target.box.width > 0 && section.target.pageBox.y > section.target.box.y - 1);
    assert.equal(section.image.transparent, true);
    assert.equal(section.image.resized, 600);
    const meta = await sharp(path.join(root, "out/stack.webp")).metadata();
    assert.equal(meta.width, 600);
    assert.equal(meta.hasAlpha, true);
    const { data, info } = await sharp(path.join(root, "out/stack.webp")).raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    for (let i = 3; i < data.length; i += info.channels) if (data[i] === 0) transparent++;
    assert.ok(transparent > 0, "the ground is transparent");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("shot: a target that is not on the page exits 1 and says so", { skip }, () => {
  const root = fixtureSite();
  try {
    const r = run(root, ["shot", "/", "--select", "#nope"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /#nope: no element matches on \//);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("probe: box, computed styles, the stacking chain, every reveal settled under reduced motion, no console errors", { skip }, () => {
  const root = fixtureSite();
  try {
    const out = json(root, ["probe", "/", "--select", ".card", "--all", "--props", "border-width", "--width", "1000"]);
    assert.equal(out.width, 1000);
    assert.equal(out.elements.length, 4);
    const first = out.elements[0];
    assert.equal(first.tag, "div");
    assert.deepEqual(first.classes, ["card", "ix-init--fadeIn"]);
    assert.equal(first.box.width, 204, "200 px plus the 2 px borders");
    assert.equal(first.computed.opacity, "1");
    assert.equal(first.computed["border-width"], "2px");
    assert.ok(Array.isArray(first.stacking));
    assert.equal(out.reveals.total, 4);
    assert.deepEqual(out.reveals.pending, []);
    assert.deepEqual(out.console, []);
    assert.ok(out.scrollHeight > 2000);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("probe: under --motion a fresh page has its reveals pending, and a timeline shows one playing", { skip }, () => {
  const root = fixtureSite();
  try {
    const out = json(root, ["probe", "/", "--heading", "the end", "--motion", "--timeline", "1200", "--every", "200"]);
    assert.equal(out.motion, true);
    assert.equal(out.elements[0].id, "third");
    const samples = out.elements[0].timeline;
    assert.ok(samples.length >= 5, `samples: ${samples.length}`);
    assert.ok(samples.every((s) => typeof s.t === "number" && "opacity" in s && "transform" in s && "top" in s));
    assert.ok(out.reveals.pending.length >= 1, "a reveal above the fold is still pending on a fresh page");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("probe: no match exits 1", { skip }, () => {
  const root = fixtureSite();
  try {
    const r = run(root, ["probe", "/", "--select", ".nothing"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /\.nothing: no element matches/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("sheet: a spec renders to a picture with its rows, and img: cells come from the served site", { skip }, async () => {
  const root = fixtureSite();
  try {
    fs.writeFileSync(path.join(root, "marks.yaml"), `name: marks
background: "#000220"
color: "#fff"
rows:
  - label: now
    size: 48
    cells:
      - { label: mark, img: /images/mark.svg }
  - label: alternate
    note: a circle
    size: 48
    cells:
      - { label: disc, svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>' }
      - { label: file, file: public/images/mark.svg }
`);
    const out = json(root, ["sheet", "marks.yaml", "--json"]);
    assert.equal(out.file, ".parity/sheets/marks.png");
    assert.deepEqual(out.rows.map((r) => [r.id, r.label, r.cells]), [["A", "now", 1], ["B", "alternate", 2]]);
    const meta = await sharp(path.join(root, out.file)).metadata();
    assert.equal(meta.width, 2400, "1200 px at scale 2");
    assert.ok(meta.height > 200);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("sheet: a spec error exits 2 and names the field", { skip }, () => {
  const root = fixtureSite();
  try {
    fs.writeFileSync(path.join(root, "bad.yaml"), "name: bad\nrows:\n  - label: a\n    cells:\n      - label: x\n");
    const r = run(root, ["sheet", "bad.yaml"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /rows\[0\]\.cells\[0\]: a cell needs one of file, svg, html, img/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the bin lists the three commands and their help", () => {
  const list = execFileSync(process.execPath, [BIN, "--help"], { encoding: "utf8" });
  for (const name of ["shot", "probe", "sheet"]) assert.match(list, new RegExp(`^  ${name} `, "m"));
  assert.match(execFileSync(process.execPath, [BIN, "shot", "--help"], { encoding: "utf8" }), /--transparent/);
});
