// The routes the kit writes, rendered by the example site's own dev server:
// the lab's (lab route → /lab-demo) and the design round's (demo new →
// /hero-demo). One file, so the two servers never run on the checkout at
// once; each test writes only what it removes again.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { chromePath } from "../lib/browser.mjs";
import { devServer } from "./dev-server.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BIN = path.join(ROOT, "bin/agentic-cms.mjs");
const skip = chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`";
const lab = (...args) => spawnSync(process.execPath, [BIN, "lab", ...args], { cwd: ROOT, encoding: "utf8" });
const demo = (...args) => spawnSync(process.execPath, [BIN, "demo", ...args], { cwd: ROOT, encoding: "utf8" });

test("lab route: the example site renders /lab-demo with every scene on the grounds, the procedure first, one scrubber that seeks", { skip, timeout: 180000 }, async () => {
  const labDir = path.join(ROOT, ".parity/lab");
  const hadLab = fs.existsSync(labDir);
  const routeDir = path.join(ROOT, "src/app/lab-demo");
  assert.ok(!fs.existsSync(routeDir), "no lab-demo route in the checkout before the test");
  fs.mkdirSync(labDir, { recursive: true });
  const scene = path.join(labDir, "route-test-spin.svg");
  assert.equal(lab("new", "route-test-spin", "--kind", "loop").status, 0);
  assert.equal(lab("route").status, 0);
  let server, browser;
  try {
    server = await devServer();
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, reducedMotion: "no-preference" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${server.url}/lab-demo`, { waitUntil: "load", timeout: 120000 });
    await page.waitForSelector('[data-scene="route-test-spin"]', { timeout: 60000 });
    const seen = await page.evaluate(() => ({
      h1: document.querySelector("[data-lab] h1")?.textContent,
      grounds: [...document.querySelectorAll('[data-scene="route-test-spin"] [data-ground]')].map((g) => g.dataset.ground),
      copies: document.querySelectorAll('[data-scene="route-test-spin"] svg.lab-scene').length,
      chrome: !!document.querySelector("header nav, nav"),
      scrubber: !!document.getElementById("lab-time"),
      duration: window.lab?.duration(),
    }));
    assert.equal(seen.h1, "The lab, on this site's theme");
    assert.deepEqual(seen.grounds, ["the page", "white card"]);
    assert.equal(seen.copies, 6, "24, 40 and 64 px on each of the two grounds");
    assert.ok(seen.chrome, "inside the site's chrome");
    assert.ok(seen.scrubber && seen.duration === 2);
    await page.fill("#lab-time", "0.5");
    await page.$eval("#lab-time", (el) => el.dispatchEvent(new Event("input", { bubbles: true })));
    await page.waitForTimeout(200);
    const cx = await page.$$eval('[data-scene="route-test-spin"] svg.lab-scene circle', (dots) => dots.map((d) => d.cx.animVal.value));
    assert.deepEqual(cx, [32, 32, 32, 32, 32, 32], "every copy paused at 0.5 s");
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server?.stop();
    if (hadLab) {
      fs.rmSync(scene, { force: true });
      fs.rmSync(routeDir, { recursive: true, force: true });
      const validator = path.join(ROOT, ".next/dev/types/validator.ts");
      if (fs.existsSync(validator) && fs.readFileSync(validator, "utf8").includes("src/app/lab-demo")) fs.rmSync(validator);
    } else assert.equal(lab("clean").status, 0);
    assert.ok(!fs.existsSync(routeDir) && !fs.existsSync(scene), "nothing of the test left in the checkout");
  }
});

test("demo new: /hero-demo on the example site — A, B and the current hero with the home page's copy, in the site's chrome", { skip, timeout: 180000 }, async () => {
  const routeDir = path.join(ROOT, "src/app/hero-demo");
  assert.ok(!fs.existsSync(routeDir) && !fs.existsSync(path.join(ROOT, "src/components/home/HeroA.tsx")), "no hero demo in the checkout before the test");
  const made = demo("new", "hero", "--section", "home-hero", "--json");
  assert.equal(made.status, 0, made.stderr);
  let server, browser;
  try {
    server = await devServer();
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${server.url}/hero-demo`, { waitUntil: "load", timeout: 120000 });
    await page.waitForSelector('[data-candidate="now"]', { timeout: 60000 });
    const seen = await page.evaluate(() => ({
      blocks: [...document.querySelectorAll("[data-candidate]")].map((b) => b.dataset.candidate),
      sections: document.querySelectorAll("[data-candidate] section#home-hero").length,
      headings: [...document.querySelectorAll("[data-candidate] h1")].map((h) => h.textContent),
      chrome: !!document.querySelector("nav") && !!document.querySelector("footer"),
      mains: document.querySelectorAll("main").length,
      notes: [...document.querySelectorAll("[data-candidate] p")].slice(0, 1).map((p) => p.textContent),
    }));
    assert.deepEqual(seen.blocks, ["A", "B", "now"], "lettered, the current version last");
    assert.equal(seen.sections, 3, "each in the section's real frame");
    assert.equal(new Set(seen.headings).size, 1, "the page's real copy in every one");
    assert.ok(seen.chrome && seen.mains === 1, "inside the site's own layout");
    assert.match(seen.notes[0], /^A what differs, in one line/);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server?.stop();
    const cleaned = demo("clean", "hero", "--json");
    assert.equal(cleaned.status, 0, cleaned.stderr);
    assert.ok(!fs.existsSync(routeDir) && !fs.existsSync(path.join(ROOT, "src/components/home/HeroA.tsx")) && !fs.existsSync(path.join(ROOT, "src/components/home/HeroB.tsx")), "nothing of the round left in the checkout");
  }
});
