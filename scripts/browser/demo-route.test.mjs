// The round's route on the example site's own dev server: `demo new` for
// the home hero, /hero-demo shows the candidates in the section's frame
// with the page's copy inside the site's chrome, the current version last;
// `demo clean` leaves nothing.
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
const demo = (...args) => spawnSync(process.execPath, [BIN, "demo", ...args], { cwd: ROOT, encoding: "utf8" });

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
