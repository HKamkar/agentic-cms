// The routes the kit writes, rendered by the example site's own dev server:
// the lab's (lab route → /lab-demo), the design round's (demo new →
// /hero-demo, and demo new waiting on a server that already runs), serve
// started and stopped on free ports, urls telling this checkout's next dev
// from another server on its port, a route that ships an inline loop the way a section does
// (readInlineSvg + InlineAnimation), the harness's own preparation of a
// page that is still hydrating, the seed reaching the design routes, and
// consent (agentic-cms/consent) on the example with a Google tag id set. One file, so the servers never run on the
// checkout at once; each test writes only what it removes again.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { chromePath } from "../lib/browser.mjs";
import { freePort, processAlive, readDevLock } from "../lib/dev-server.mjs";
import { isUp } from "../lib/hosts.mjs";
import { devServer } from "./dev-server.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BIN = path.join(ROOT, "bin/agentic-cms.mjs");
const skip = chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`";
const lab = (...args) => spawnSync(process.execPath, [BIN, "lab", ...args], { cwd: ROOT, encoding: "utf8" });
const demo = (...args) => spawnSync(process.execPath, [BIN, "demo", ...args], { cwd: ROOT, encoding: "utf8" });
/** A command that must not block this process's event loop while it runs (the dev server's output is read here). */
const runAsync = (args) => new Promise((resolve) => {
  const child = spawn(process.execPath, [BIN, ...args], { cwd: ROOT });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("exit", (status) => resolve({ status, stdout, stderr }));
});

// The dev server's HMR socket fails its handshake under this harness; every other console error counts (a hydration mismatch is one).
const notHmr = (line) => !/WebSocket|_next\/hmr/.test(line);

test("lab route: the example site renders /lab-demo with every scene on the grounds, the procedure first, a timeline per animated scene that seeks every copy — and hydrates without a console error", { skip, timeout: 180000 }, async () => {
  const labDir = path.join(ROOT, ".parity/lab");
  const hadLab = fs.existsSync(labDir);
  const routeDir = path.join(ROOT, "src/app/lab-demo");
  assert.ok(!fs.existsSync(routeDir), "no lab-demo route in the checkout before the test");
  fs.mkdirSync(labDir, { recursive: true });
  const scene = path.join(labDir, "route-test-spin.svg");
  assert.equal(lab("new", "route-test-spin", "--kind", "loop").status, 0);
  assert.equal(lab("route", "--no-wait", "--no-public").status, 0);
  let server, browser;
  try {
    server = await devServer();
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, reducedMotion: "no-preference" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" && notHmr(m.text())) errors.push(m.text().slice(0, 200)); });
    await page.goto(`${server.url}/lab-demo`, { waitUntil: "load", timeout: 120000 });
    await page.waitForSelector('[data-scene="route-test-spin"]', { timeout: 60000 });
    // Hydration, and the timeline's first frames: a mismatch is logged by then.
    const scene = '[data-scene="route-test-spin"]';
    await page.waitForFunction((s) => document.querySelector(`${s} [data-lab-play]`)?.textContent === "Pause", scene, { timeout: 30000 });
    await page.waitForTimeout(1000);
    assert.deepEqual(errors, [], "no console error through hydration");
    assert.match(await page.textContent(`${scene} [data-lab-readout]`), /^\d\.\d\d s \/ 2\.00 s$/, "the readout ticks over the scene's cycle");
    const seen = await page.evaluate(() => ({
      h1: document.querySelector("[data-lab] h1")?.textContent,
      grounds: [...document.querySelectorAll('[data-scene="route-test-spin"] [data-ground]')].map((g) => g.dataset.ground),
      copies: document.querySelectorAll('[data-scene="route-test-spin"] svg.lab-scene').length,
      chrome: !!document.querySelector("header nav, nav"),
      timeline: document.querySelector('[data-scene="route-test-spin"] [data-lab-timeline]')?.getAttribute("aria-label"),
      max: document.querySelector('[data-scene="route-test-spin"] [data-lab-time]')?.max,
      ids: [...document.querySelectorAll("[id]")].map((e) => e.id),
    }));
    assert.equal(seen.h1, "The lab, on this site's theme");
    assert.deepEqual(seen.grounds, ["the page", "white card"]);
    assert.equal(seen.copies, 6, "24, 40 and 64 px on each of the two grounds");
    assert.ok(seen.chrome, "inside the site's chrome");
    assert.deepEqual([seen.timeline, seen.max], ["route-test-spin: timeline", "2"]);
    assert.equal(new Set(seen.ids).size, seen.ids.length, "every id on the page is unique");
    await page.fill(`${scene} [data-lab-time]`, "0.5");
    await page.waitForTimeout(200);
    const cx = await page.$$eval('[data-scene="route-test-spin"] svg.lab-scene circle', (dots) => dots.map((d) => d.cx.animVal.value));
    assert.deepEqual(cx, [32, 32, 32, 32, 32, 32], "every copy paused at 0.5 s");
    assert.equal(await page.textContent(`${scene} [data-lab-play]`), "Play", "a seek pauses, and the button says so");
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
  const made = demo("new", "hero", "--section", "home-hero", "--no-wait", "--no-public", "--json");
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

test("demo new against the running dev server: it waits until its route answers, then prints its URLs — the route answers 200 before the command exits", { skip, timeout: 240000 }, async () => {
  const routeDir = path.join(ROOT, "src/app/wait-demo");
  assert.ok(!fs.existsSync(routeDir) && !fs.existsSync(path.join(ROOT, "src/components/home/HeroA.tsx")), "no wait demo in the checkout before the test");
  let server;
  try {
    server = await devServer();
    const made = await runAsync(["demo", "new", "wait", "--section", "home-hero", "--url", server.url, "--no-public", "--json"]);
    assert.equal(made.status, 0, made.stderr);
    const report = JSON.parse(made.stdout);
    assert.deepEqual([report.ready, report.status], [true, 200], "the route answered before the command exited");
    assert.deepEqual(report.urls[0], { where: "localhost", url: `http://localhost:${server.port}/wait-demo` });
    const again = await fetch(`${server.url}/wait-demo`, { signal: AbortSignal.timeout(15000) });
    assert.equal(again.status, 200, "compiled already: the owner's first look is no cold compile");
    assert.match(await again.text(), /data-candidate="now"/);
  } finally {
    await server?.stop();
    const cleaned = demo("clean", "wait", "--json");
    assert.equal(cleaned.status, 0, cleaned.stderr);
    assert.ok(!fs.existsSync(routeDir) && !fs.existsSync(path.join(ROOT, "src/components/home/HeroA.tsx")), "nothing of the round left in the checkout");
  }
});

test("serve on free ports: next dev and the lab started, the table printed once the root answers, and a Ctrl-C stops both — the ports are free again", { skip, timeout: 240000 }, async (t) => {
  const lock = readDevLock(ROOT, fs);
  if (lock && processAlive(lock.pid)) { t.skip(`this checkout's next dev runs (pid ${lock.pid}): serve would reuse it`); return; }
  const [port, labPort] = [await freePort(), await freePort()];
  const child = spawn(process.execPath, [BIN, "serve", "--port", String(port), "--lab-port", String(labPort), "--lab", "--no-public"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let out = "", err = "";
  child.stdout.on("data", (chunk) => { out += chunk; });
  child.stderr.on("data", (chunk) => { err += chunk; });
  const exited = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal })));
  try {
    const started = Date.now();
    while (!/^hand over the page itself/m.test(out)) {
      assert.equal(child.exitCode, null, `serve exited early:\n${out}\n${err}`);
      assert.ok(Date.now() - started < 180000, `no table in 180 s:\n${out}\n${err}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.match(out, new RegExp(`^serve: next dev on port ${port}; the lab on port ${labPort}$`, "m"));
    assert.match(out, new RegExp(`^ {2}/ +200 +http://localhost:${port}/`, "m"), "the root answered");
    assert.match(out, new RegExp(`^ {2}/ +http://localhost:${labPort}/`, "m"), "the lab's index");
    assert.ok(await isUp(port) && await isUp(labPort));
  } finally {
    child.kill("SIGINT");
    const ended = await exited;
    assert.deepEqual(ended, { code: 0, signal: null }, err);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  assert.deepEqual([await isUp(port), await isUp(labPort)], [false, false], "next dev's whole process group and the lab stopped");
});

test("urls on the example: a port another server holds answers, but not as this clone's next dev, with no restart named; this checkout's own next dev, found by its lock, is running", { skip, timeout: 240000 }, async (t) => {
  const lock = readDevLock(ROOT, fs);
  if (lock && processAlive(lock.pid)) { t.skip(`this checkout's next dev runs (pid ${lock.pid}): the test's own would not start`); return; }
  const labPort = await freePort();
  const urls = async (port, ...flags) => {
    const ran = await runAsync(["urls", "--port", String(port), "--lab-port", String(labPort), "--no-public", ...flags]);
    assert.ok([0, 1].includes(ran.status), ran.stderr);
    return ran.stdout;
  };
  // Another checkout's server, as far as this checkout can tell: something answers on the port, and no lock here names it.
  const other = http.createServer((req, res) => res.end("another checkout"));
  await new Promise((resolve) => other.listen(0, resolve));
  const otherPort = other.address().port;
  let server;
  try {
    const held = JSON.parse(await urls(otherPort, "--json"));
    assert.deepEqual([held.dev.up, held.dev.own, held.dev.ownPort], [true, false, null]);
    const text = await urls(otherPort);
    assert.match(text, new RegExp(`^dev server, port ${otherPort}: answers, but not as this clone's next dev \\(\\.next/dev/lock names none on it\\)`, "m"));
    assert.doesNotMatch(text, /restart/);

    server = await devServer();
    const started = Date.now();
    while (readDevLock(ROOT, fs)?.port !== server.port) {
      assert.ok(Date.now() - started < 15000, "next dev wrote no lock naming its port in 15 s");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const own = JSON.parse(await urls(server.port, "--json"));
    assert.deepEqual([own.dev.up, own.dev.own, own.dev.ownPort], [true, true, server.port]);
    assert.match(await urls(server.port), new RegExp(`^dev server, port ${server.port}: running$`, "m"));
    assert.match(await urls(otherPort), new RegExp(`^dev server, port ${otherPort}: answers, but not as this clone's next dev \\(\\.next/dev/lock names none on it\\); this clone's next dev runs on port ${server.port} \\(pnpm urls --port ${server.port}\\)$`, "m"));
  } finally {
    await server?.stop();
    await new Promise((resolve) => other.close(resolve));
  }
});

// A section's inline loop, the way a site ships one: the SVG read at build (readInlineSvg, agentic-cms/content) and
// played by InlineAnimation (agentic-cms/ix), below the fold; and a copy under a lab timeline at the top, as a design
// round's route wraps one. Removed by demo clean (the route, the round's pictures).
const LOOP = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100" data-duration="2" data-rest="1.5"><defs><clipPath id="frame"><rect width="200" height="100"/></clipPath></defs><g clip-path="url(#frame)"><circle cx="20" cy="50" r="15"><animate attributeName="cx" values="20;180;20" dur="2s" repeatCount="indefinite"/></circle></g></svg>`;
const INLINE_ROUTE = `import { readInlineSvg } from "agentic-cms/content";
import { InlineAnimation } from "agentic-cms/ix";
import { LabTimeline } from "agentic-cms/lab";

export const metadata = { robots: { index: false } };

export default function InlineTestDemo() {
  const markup = readInlineSvg("public/images/inline-test-demo/loop.svg", { prefix: "inline-test" });
  const timed = readInlineSvg("public/images/inline-test-demo/loop.svg", { prefix: "inline-timed" });
  return (
    <>
      <LabTimeline label="inline" autoplay={false}><InlineAnimation markup={timed} className="inline-test-timed" /></LabTimeline>
      <div style={{ height: "2400px" }} />
      <InlineAnimation markup={markup} className="inline-test-box" />
      <div style={{ height: "2400px" }} />
    </>
  );
}
`;

test("InlineAnimation on the example site: waits on its first frame until in view, plays in view, pauses off screen, rests under reduced motion; under a lab timeline the clock is the timeline's", { skip, timeout: 180000 }, async () => {
  const routeDir = path.join(ROOT, "src/app/inline-test-demo");
  const assets = path.join(ROOT, "public/images/inline-test-demo");
  assert.ok(!fs.existsSync(routeDir) && !fs.existsSync(assets), "no inline-test demo in the checkout before the test");
  fs.mkdirSync(routeDir, { recursive: true });
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(routeDir, "page.tsx"), INLINE_ROUTE);
  fs.writeFileSync(path.join(assets, "loop.svg"), LOOP);
  let server, browser;
  try {
    server = await devServer();
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] });
    const clock = (page) => page.evaluate(() => { const svg = document.querySelector(".inline-test-box svg"); return { paused: svg.animationsPaused(), time: svg.getCurrentTime(), fills: getComputedStyle(svg).width === getComputedStyle(svg.parentElement).width, clip: svg.querySelector("clipPath").id }; });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${server.url}/inline-test-demo`, { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => document.querySelector(".inline-test-box svg")?.animationsPaused(), null, { timeout: 60000 });
    await page.waitForTimeout(500);
    const waiting = await clock(page);
    assert.deepEqual([waiting.paused, waiting.time], [true, 0], "below the fold: on its first frame");
    assert.ok(waiting.fills, "the svg fills its box from its own style");
    assert.equal(waiting.clip, "inline-test-frame", "its ids are its own");
    await page.locator(".inline-test-box").scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const playing = await clock(page);
    assert.equal(playing.paused, false, "in view: it plays");
    assert.ok(playing.time > 0.2 && playing.time < 1.5, `from the start of the cycle: ${playing.time}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const away = await clock(page);
    assert.equal(away.paused, true, "off screen: paused");
    // Under the timeline (autoplay off) the copy at the top stays where the timeline holds it, in view, after a seek and a scroll.
    const timed = () => page.evaluate(() => { const svg = document.querySelector(".inline-test-timed svg"); return { paused: svg.animationsPaused(), time: Math.round(svg.getCurrentTime() * 1000) / 1000 }; });
    assert.deepEqual(await timed(), { paused: true, time: 0 }, "in view, held on the timeline's first frame");
    await page.evaluate(() => { const range = document.querySelector('[aria-label="inline: timeline"] [data-lab-time]'); range.value = "0.8"; range.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.locator(".inline-test-box").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    assert.deepEqual(await timed(), { paused: true, time: 0.8 }, "seeked by the timeline, and a scroll away and back does not move it");
    const reduced = await browser.newPage({ viewport: { width: 1100, height: 900 }, reducedMotion: "reduce" });
    await reduced.goto(`${server.url}/inline-test-demo`, { waitUntil: "load", timeout: 120000 });
    await reduced.waitForFunction(() => Math.abs((document.querySelector(".inline-test-box svg")?.getCurrentTime() ?? 0) - 1.5) < 1e-3, null, { timeout: 60000 });
    await reduced.locator(".inline-test-box").scrollIntoViewIfNeeded();
    await reduced.waitForTimeout(500);
    const resting = await clock(reduced);
    assert.deepEqual([resting.paused, Math.round(resting.time * 1000) / 1000], [true, 1.5], "reduced motion: its data-rest frame, still");
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server?.stop();
    const cleaned = demo("clean", "inline-test", "--json");
    assert.equal(cleaned.status, 0, cleaned.stderr);
    assert.ok(!fs.existsSync(routeDir) && !fs.existsSync(assets), "nothing of the test left in the checkout");
  }
});

// probe --motion (and a --motion capture) prepares a page while it may still be hydrating: next dev hydrates slowly. The
// harness used to switch every image to loading="eager" before React had hydrated them, and React reported the attribute
// as a hydration mismatch — the site's error, as far as anyone reading the console could tell.
test("probe --motion on the example's dev server never trips React's hydration check: the images are touched only once the page has hydrated", { skip, timeout: 240000 }, async () => {
  const { execFile } = await import("node:child_process");
  const probe = (url, route, width) => new Promise((resolve) => execFile(process.execPath, [BIN, "probe", route, "--url", url, "--select", "body", "--width", String(width), "--motion"], { cwd: ROOT, encoding: "utf8", timeout: 150000 }, (error, stdout, stderr) => resolve({ status: error ? error.code ?? 1 : 0, stdout, stderr })));
  let server;
  try {
    server = await devServer();
    for (const [route, width] of [["/", 1440], ["/", 390], ["/blog", 1440]]) {
      const r = await probe(server.url, route, width);
      assert.equal(r.status, 0, r.stderr);
      const mismatches = JSON.parse(r.stdout).console.filter((line) => /hydrated but some attributes/.test(line.text));
      assert.deepEqual(mismatches, [], `${route} at ${width}`);
    }
  } finally { server?.stop(); }
});

// What an agent photographs while designing — a round's demo route, the lab route — is a page of the dev server in
// the site's own layout, so whatever the site shows until a choice is stored shows there too. shot and probe seed it
// like a capture: here the example's one stored choice, its theme, which its first inline script reads.
test("a seed reaches the design routes on the dev server: /hero-demo (demo new) and /lab-demo (lab route) read it before their first script, --no-storage does not", { skip, timeout: 240000 }, async () => {
  const { execFile } = await import("node:child_process");
  const probe = (url, route, ...args) => new Promise((resolve) => execFile(process.execPath, [BIN, "probe", route, "--url", url, "--select", "html", "--props", "color-scheme", ...args], { cwd: ROOT, encoding: "utf8", timeout: 150000 }, (error, stdout, stderr) => resolve({ status: error ? error.code ?? 1 : 0, stdout, stderr })));
  const labDir = path.join(ROOT, ".parity/lab");
  const hadLab = fs.existsSync(labDir);
  const labRoute = path.join(ROOT, "src/app/lab-demo"), heroRoute = path.join(ROOT, "src/app/hero-demo");
  assert.ok(!fs.existsSync(labRoute) && !fs.existsSync(heroRoute), "no design route in the checkout before the test");
  fs.mkdirSync(labDir, { recursive: true });
  const scene = path.join(labDir, "seed-test-mark.svg");
  assert.equal(lab("new", "seed-test-mark", "--kind", "mark").status, 0);
  assert.equal(lab("route", "--no-wait", "--no-public").status, 0);
  assert.equal(demo("new", "hero", "--section", "home-hero", "--no-wait", "--no-public").status, 0);
  let server;
  try {
    server = await devServer();
    for (const route of ["/hero-demo", "/lab-demo"]) {
      await fetch(server.url + route); // compiled once before the probes, which wait 30 s for a page
      const seeded = await probe(server.url, route, "--storage", "theme=dark");
      assert.equal(seeded.status, 0, seeded.stderr);
      const out = JSON.parse(seeded.stdout);
      assert.equal(out.seed.storage.theme, "dark");
      assert.match(out.seed.storage.consent, /"analytics":"denied"/, "the example's own seed (src/config/harness.ts) under the flag");
      assert.equal(out.elements[0].computed["color-scheme"], "dark", `${route}: the stored theme applied before the first paint`);
      const first = await probe(server.url, route, "--no-storage");
      assert.equal(first.status, 0, first.stderr);
      assert.equal(JSON.parse(first.stdout).seed, null);
      assert.equal(JSON.parse(first.stdout).elements[0].computed["color-scheme"], "light dark", `${route}: a first visit follows the system`);
    }
  } finally {
    server?.stop();
    assert.equal(demo("clean", "hero").status, 0);
    if (hadLab) {
      fs.rmSync(scene, { force: true });
      fs.rmSync(labRoute, { recursive: true, force: true });
      const validator = path.join(ROOT, ".next/dev/types/validator.ts");
      if (fs.existsSync(validator) && /src\/app\/(lab|hero)-demo/.test(fs.readFileSync(validator, "utf8"))) fs.rmSync(validator);
    } else assert.equal(lab("clean").status, 0);
    assert.ok(!fs.existsSync(labRoute) && !fs.existsSync(heroRoute) && !fs.existsSync(scene), "nothing of the test left in the checkout");
  }
});

// Consent on the example's dev server as a visitor meets it, with a tag id set (GOOGLE_TAG_ID). Every request to
// Google is intercepted and recorded, gtag.js answered with an empty script, so nothing leaves the machine; the
// dataLayer is read as gtag.js reads it. Development renders twice (StrictMode), which the tag must survive.
const TAG = "G-TEST000000";
const GOOGLE = /^https:\/\/([a-z0-9-]+\.)*(googletagmanager|google-analytics|doubleclick|google)\.(com|net)\//;
const GTAG_JS = /googletagmanager\.com\/gtag\/js\?id=G-TEST000000$/;

/** A browser context whose requests to Google are recorded and answered here. */
async function consentContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const google = [];
  await context.route(GOOGLE, (route) => { google.push(route.request().url()); return route.fulfill({ status: 200, contentType: "text/javascript", body: "" }); });
  return { context, google };
}

/** The page's dataLayer in words: "consent default", "set ads_data_redaction", "consent update granted", "js", "config". */
const sent = (page) => page.evaluate(() => (window.dataLayer ?? []).map((entry) => {
  const [command, what, value] = Array.from(entry);
  return command === "consent" ? `consent ${what}${what === "update" ? ` ${value.analytics_storage}` : ""}` : command === "set" ? `set ${what}` : String(command);
}));
const before = (list, a, b) => list.indexOf(a) !== -1 && list.indexOf(a) < list.indexOf(b);
const settle = (page) => page.waitForTimeout(800);

test("consent on the example: nothing reaches Google before a choice or after a refusal; a grant, here or in another tab, sends the choice before the tag's config", { skip, timeout: 300000 }, async (t) => {
  let server, browser;
  try {
    server = await devServer(ROOT, { env: { GOOGLE_TAG_ID: TAG } });
    const html = await (await fetch(`${server.url}/`)).text(); // compiles the page once before the browser waits on it
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] });

    await t.test("a first visit: the banner, the default first on the dataLayer, no request to Google and no link to it; the default is an inline script parsed before the page's flight data", async () => {
      assert.ok(html.includes('id="consent-default"') && html.indexOf('id="consent-default"') < html.indexOf("self.__next_f"), "inline, before the flight data hydration reads");
      assert.ok(!html.includes("__next_s"), "not next/script's beforeInteractive queue");
      const { context, google } = await consentContext(browser);
      const page = await context.newPage();
      await page.goto(`${server.url}/`, { waitUntil: "load", timeout: 120000 });
      await page.getByRole("dialog").waitFor({ timeout: 60000 });
      await settle(page);
      assert.deepEqual(google, []);
      assert.equal(await page.locator('link[href*="google"]').count(), 0);
      assert.deepEqual(await sent(page), ["consent default", "set ads_data_redaction"]);
      await context.close();
    });

    await t.test("Allow loads the tag once, the update before its config; Decline from Cookie settings then switches it off, clears the cookies and hands focus back", async () => {
      const { context, google } = await consentContext(browser);
      const page = await context.newPage();
      await page.goto(`${server.url}/`, { waitUntil: "load" });
      await page.getByRole("button", { name: "Allow" }).click();
      await page.waitForFunction(() => document.querySelectorAll("script[data-gtag]").length > 0);
      await settle(page);
      assert.equal(google.filter((url) => GTAG_JS.test(url)).length, 1, "one tag, however often React mounted it");
      const granted = await sent(page);
      assert.ok(before(granted, "consent update granted", "config"), granted.join(", "));
      assert.equal(await page.getByRole("dialog").count(), 0);
      await context.addCookies([{ name: "_ga", value: "GA1.1.1", domain: "127.0.0.1", path: "/" }]);
      await page.getByRole("button", { name: "Cookie settings" }).click();
      await page.getByRole("dialog").waitFor();
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Decline", "a reopened banner takes focus");
      await page.getByRole("button", { name: "Decline" }).click();
      assert.equal(await page.evaluate((tag) => window[`ga-disable-${tag}`], TAG), true);
      assert.equal((await sent(page)).at(-1), "consent update denied");
      assert.deepEqual((await context.cookies()).filter((c) => c.name.startsWith("_ga")), []);
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Cookie settings", "focus back where the visitor was");
      await context.close();
    });

    await t.test("Decline: nothing reaches Google, on this page or the next, and the refusal is stored", async () => {
      const { context, google } = await consentContext(browser);
      const page = await context.newPage();
      await page.goto(`${server.url}/`, { waitUntil: "load" });
      await page.getByRole("button", { name: "Decline" }).click();
      await settle(page);
      await page.reload({ waitUntil: "load" });
      await settle(page);
      assert.deepEqual(google, []);
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("consent")).analytics), "denied");
      await context.close();
    });

    await t.test("a returning visitor who allowed: no banner, the stored choice replayed before the tag's config", async () => {
      const { context, google } = await consentContext(browser);
      await context.addInitScript(() => localStorage.setItem("consent", JSON.stringify({ analytics: "granted", at: new Date().toISOString(), version: 1 })));
      const page = await context.newPage();
      await page.goto(`${server.url}/`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelectorAll("script[data-gtag]").length > 0);
      await settle(page);
      const replayed = await sent(page);
      assert.deepEqual(replayed.slice(0, 3), ["consent default", "set ads_data_redaction", "consent update granted"], "the inline script's replay, before anything else");
      assert.ok(before(replayed, "consent update granted", "config"));
      assert.equal(google.filter((url) => GTAG_JS.test(url)).length, 1);
      assert.equal(await page.getByRole("dialog").count(), 0);
      await context.close();
    });

    await t.test("two tabs: a grant in one sends the update before the config in the other; a storage cleared there is a refusal here", async () => {
      const { context } = await consentContext(browser);
      const [here, there] = [await context.newPage(), await context.newPage()];
      for (const page of [here, there]) { await page.goto(`${server.url}/`, { waitUntil: "load" }); await page.getByRole("dialog").waitFor(); }
      await there.getByRole("button", { name: "Allow" }).click();
      await here.waitForFunction(() => document.querySelectorAll("script[data-gtag]").length > 0);
      const followed = await sent(here);
      assert.ok(before(followed, "consent update granted", "config"), followed.join(", "));
      await here.getByRole("dialog").waitFor({ state: "detached" });
      await there.evaluate(() => localStorage.clear());
      await here.waitForFunction((tag) => window[`ga-disable-${tag}`] === true, TAG);
      assert.equal((await sent(here)).at(-1), "consent update denied");
      await context.close();
    });
  } finally {
    await browser?.close();
    server?.stop();
  }
});
