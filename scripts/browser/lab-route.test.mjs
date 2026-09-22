// The route the kit writes (lab route → src/app/lab-demo/page.tsx), rendered
// by the example site's own dev server: the scenes on the grounds, the
// procedure, the scrubber. Runs in this checkout, so it only writes what it
// removes again — the route, and the lab folder when there was none.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { chromePath } from "../lib/browser.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BIN = path.join(ROOT, "bin/agentic-cms.mjs");
const NEXT = path.join(ROOT, "node_modules/next/dist/bin/next");
const skip = chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`";
const lab = (...args) => spawnSync(process.execPath, [BIN, "lab", ...args], { cwd: ROOT, encoding: "utf8" });
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

/** next dev on a free port, resolved once it is ready; { url, stop }. */
async function devServer() {
  const port = await freePort();
  const child = spawn(process.execPath, [NEXT, "dev", "-p", String(port), "-H", "127.0.0.1"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`next dev not ready in 120s:\n${log.slice(-800)}`)), 120000);
    const onData = (chunk) => { log += chunk; if (/Ready in/.test(log)) { clearTimeout(timer); resolve(); } };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`next dev exited ${code}:\n${log.slice(-800)}`)); });
  });
  return { url: `http://127.0.0.1:${port}`, stop: () => { try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); } } };
}

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
