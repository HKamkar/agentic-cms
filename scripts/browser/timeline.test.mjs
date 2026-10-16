// The lab's timeline in two engines at two widths, on a page made of two
// studies exactly as a route renders them (LabStudy, server-rendered) with
// the timeline mounted on each the way LabTimeline's ref does: a SMIL
// loop served from public/ and a CSS loop that is not, each with masks,
// clip paths, gradients or <use> targets in every copy. What a person does
// with it — play, pause, drag, tap, arrow keys, resume, replay — and what
// must hold: playing, every copy near the screen runs on its own clock
// within a frame of the others and every copy far off it is stopped;
// paused, the pixels still and every copy on the same frame; the studies
// independent, reduced motion honoured, ids unique, the originals
// downloadable. WebKit is Playwright's build, not Safari.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { chromePath } from "../lib/browser.mjs";
// The package's components are TypeScript in this checkout: the hook first, the imports after it.
import "../lib/load-ts.mjs";

const { createElement: h } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { LAB_API, LabStudy, mountTimeline, timelineControlsHtml } = await import("agentic-cms/lab");
const { chromium, webkit } = await import("playwright-core");

const A = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><clipPath id="frame"><rect width="64" height="64"/></clipPath><linearGradient id="tone"><stop offset="0" stop-color="#e4572e"/><stop offset="1" stop-color="#17bebb"/></linearGradient></defs><g clip-path="url(#frame)"><circle id="dot" cx="16" cy="24" r="10" fill="url(#tone)"><animate attributeName="cx" values="16;48;16" dur="1.6s" repeatCount="indefinite"/></circle><use href="#dot" y="18"/></g></svg>`;
const B = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><style>@keyframes b-slide { from { transform: translateX(0); } to { transform: translateX(40px); } } .b-slide { animation: b-slide 2.4s linear infinite; } @media (prefers-reduced-motion: reduce) { .b-slide { animation: none; } }</style><defs><mask id="hole"><rect width="80" height="40" fill="#fff"/><circle cx="40" cy="20" r="6" fill="#000"/></mask></defs><rect class="b-slide" width="40" height="40" fill="#3a86ff" mask="url(#hole)"/></svg>`;
const GROUNDS = [
  { label: "light", Frame: ({ children }) => h("div", { style: { background: "#fff", color: "#000", padding: "8px" } }, children) },
  { label: "dark", Frame: ({ children }) => h("div", { style: { background: "#111", color: "#eee", padding: "8px" } }, children) },
];
const MOUNT = `for (const root of document.querySelectorAll("[data-lab-timeline]")) (${String(mountTimeline)})(root, { duration: Number(root.querySelector("[data-lab-time]").max) });`;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "timeline-"));
  fs.mkdirSync(path.join(root, "public/images/study"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/images/study/a.svg"), A);
  fs.mkdirSync(path.join(root, ".parity/lab"), { recursive: true });
  fs.writeFileSync(path.join(root, ".parity/lab/b.svg"), B);
  const body = renderToStaticMarkup(h("main", null,
    h(LabStudy, { root, file: "public/images/study/a.svg", label: "Study A", sizes: [32, 200], grounds: GROUNDS }),
    h(LabStudy, { root, file: ".parity/lab/b.svg", label: "Study B", sizes: [160], grounds: GROUNDS })));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>timeline</title><style>body { margin: 16px; font: 14px system-ui; }</style></head><body>${body}<script>${MOUNT}</script></body></html>`;
  const server = http.createServer((req, res) => {
    if (req.url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(html); }
    const file = path.join(root, "public", decodeURIComponent(req.url));
    if (!file.startsWith(path.join(root, "public")) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": "image/svg+xml" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => { server.close(); fs.rmSync(root, { recursive: true, force: true }); } })));
}

/** One study's timeline as the page holds it: every copy's clock, whether it runs and whether it is far off screen (beyond the half screen around it the timeline watches), the CSS animations, the controls. */
const read = (page, label) => page.evaluate((label) => {
  const root = document.querySelector(`[data-lab-timeline][aria-label="${label}: timeline"]`);
  const far = (el) => { const r = el.getBoundingClientRect(); return r.bottom < -innerHeight / 2 || r.top > innerHeight * 1.5 || r.right < -innerWidth / 2 || r.left > innerWidth * 1.5; };
  const svgs = [...root.querySelectorAll("svg")];
  const animations = root.getAnimations({ subtree: true });
  return {
    svg: svgs.map((s) => s.getCurrentTime()),
    svgRuns: svgs.map((s) => !s.animationsPaused()),
    svgFar: svgs.map(far),
    css: animations.map((a) => a.currentTime),
    cssRuns: animations.map((a) => a.playState === "running"),
    cssFar: animations.map((a) => far(a.effect.target.closest("svg"))),
    cx: [...root.querySelectorAll("circle")].map((c) => c.cx.animVal.value),
    button: root.querySelector("[data-lab-play]").textContent,
    readout: root.querySelector("[data-lab-readout]").textContent,
    value: Number(root.querySelector("[data-lab-time]").value),
  };
}, label);
const timeline = (page, label) => page.locator(`[data-lab-timeline][aria-label="${label}: timeline"]`);
const same = (list) => list.every((v) => Math.abs(v - list[0]) < 1e-6);
/** Playing: every copy near the screen runs, within a frame (`frame`, in the clock's unit) of the others, and every copy far off it is stopped. The running copies' time. */
function running(times, runs, far, frame) {
  assert.deepEqual(runs, far.map((f) => !f), "the copies near the screen run, those far off it are stopped");
  const near = times.filter((_, i) => runs[i]);
  assert.ok(near.length && near.every((t) => Math.abs(t - near[0]) < frame), `within a frame of each other: ${near}`);
  return near[0];
}

const ENGINES = [
  { name: "Chromium", launch: () => chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] }), skip: chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`" },
  { name: "WebKit", launch: () => webkit.launch(), skip: fs.existsSync(webkit.executablePath()) ? false : "no WebKit: run `pnpm exec playwright-core install webkit`" },
];
const WIDTHS = [{ name: "desktop", viewport: { width: 1280, height: 900 } }, { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }];

for (const engine of ENGINES) {
  for (const width of WIDTHS) {
    test(`timeline, ${engine.name} at ${width.name} width: synced copies, frozen pixels, precise seeking by key, drag or tap, resume, replay, independent studies, unique ids, downloads`, { skip: engine.skip, timeout: 60000 }, async () => {
      const site = await fixture();
      const browser = await engine.launch();
      try {
        const context = await browser.newContext({ viewport: width.viewport, isMobile: width.isMobile, hasTouch: width.hasTouch, reducedMotion: "no-preference", acceptDownloads: true });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        await page.goto(site.url, { waitUntil: "load" });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no sideways scroll");
        const ids = await page.evaluate(() => [...document.querySelectorAll("[id]")].map((e) => e.id));
        assert.equal(new Set(ids).size, ids.length, "every id on the page is unique");
        assert.equal(ids.length, 3 * 3 * 2 + 1 * 2 * 2, "three per copy of A, one per copy of B");

        await page.waitForTimeout(400);
        let a = await read(page, "Study A"), b = await read(page, "Study B");
        assert.equal(a.button, "Pause");
        assert.ok(a.svg.length === 6 && running(a.svg, a.svgRuns, a.svgFar, 0.02) > 0.1, `A plays from one start: ${a.svg}`);
        const bAt = b.css.length === 4 && running(b.css, b.cssRuns, b.cssFar, 20);
        assert.ok(bAt > 100, `B plays from one start: ${b.css}`);

        // Pause: the frame stays, to the pixel — where, playing, it moved.
        const shot = () => timeline(page, "Study A").locator("[data-ground]").first().screenshot();
        const moving = await shot();
        await page.waitForTimeout(250);
        assert.ok(!moving.equals(await shot()), "playing, the pixels move");
        await timeline(page, "Study A").locator("[data-lab-play]").click();
        const still = await shot();
        await page.waitForTimeout(400);
        assert.ok(still.equals(await shot()), "the paused frame does not move");
        const paused = await read(page, "Study A");
        assert.equal(paused.button, "Play");
        assert.ok(same(paused.svg) && same(paused.cx), "every copy on one frame");
        b = await read(page, "Study B");
        const bLater = running(b.css, b.cssRuns, b.cssFar, 20);
        assert.ok(b.button === "Pause" && Math.abs(bLater - bAt) > 1, `B plays on (past a cycle's end, under load): the studies are independent: ${bAt} → ${bLater}`);

        // The keyboard: Home, then seven hundredths.
        const slider = timeline(page, "Study A").locator("[data-lab-time]");
        await slider.focus();
        await page.keyboard.press("Home");
        for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight");
        a = await read(page, "Study A");
        assert.equal(a.readout, "0.07 s / 1.60 s");
        assert.ok(same(a.svg) && Math.abs(a.svg[0] - 0.07) < 1e-6, `every copy at 0.07 s: ${a.svg}`);
        assert.ok(a.cx.every((cx) => Math.abs(cx - 18.8) < 0.01), `the dot where 0.07 s puts it: ${a.cx}`);
        const ring = await slider.evaluate((el) => ({ visible: el.matches(":focus-visible"), style: getComputedStyle(el).outlineStyle }));
        assert.deepEqual(ring, { visible: true, style: "solid" }, "a visible focus ring");
        assert.equal(await slider.getAttribute("aria-valuetext"), "0.07 of 1.60 seconds");

        // A drag, or a tap on a phone: the frame follows the finger and stays.
        const box = await slider.boundingBox();
        const y = box.y + box.height / 2;
        if (width.hasTouch) await page.touchscreen.tap(box.x + box.width * 0.75, y);
        else { await page.mouse.move(box.x + box.width * 0.2, y); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.75, y, { steps: 6 }); await page.mouse.up(); }
        a = await read(page, "Study A");
        assert.ok(a.value > 0.9 && a.value < 1.5 && same(a.svg) && Math.abs(a.svg[0] - a.value) < 1e-6, `seeked near 1.2 s and held: ${a.value}, ${a.svg}`);
        assert.equal(a.button, "Play");

        // Resume from there; replay from zero.
        const from = a.value;
        await timeline(page, "Study A").locator("[data-lab-play]").click();
        await page.waitForTimeout(300);
        a = await read(page, "Study A");
        const ahead = (running(a.svg, a.svgRuns, a.svgFar, 0.02) - from + 1.6) % 1.6;
        assert.ok(ahead > 0.1 && ahead < 0.8, `resumed from ${from}, not from 0: ${a.svg}`);
        await timeline(page, "Study A").locator("[data-lab-replay]").click();
        a = await read(page, "Study A");
        assert.ok(a.svg[0] < 0.2 && a.button === "Pause", `replay starts at 0: ${a.svg[0]}`);

        // The originals: the served file, and a file that is not served, byte for byte.
        for (const [study, text] of [["public-images-study-a-svg-study-a", A], ["parity-lab-b-svg-study-b", B]]) {
          const [download] = await Promise.all([page.waitForEvent("download"), page.locator(`[data-study="${study}"] [data-lab-download]`).click()]);
          assert.equal(fs.readFileSync(await download.path(), "utf8"), text, `${study}: downloaded as the file`);
        }
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
        site.close();
      }
    });
  }

  test(`timeline, ${engine.name}, reduced motion: every study waits on its first frame, the scene's own reduced-motion rule stands, an explicit Play still plays`, { skip: engine.skip, timeout: 60000 }, async () => {
    const site = await fixture();
    const browser = await engine.launch();
    try {
      const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" })).newPage();
      await page.goto(site.url, { waitUntil: "load" });
      await page.waitForTimeout(400);
      const [a, b] = [await read(page, "Study A"), await read(page, "Study B")];
      assert.deepEqual([a.button, a.svg.every((t) => t === 0), b.button, b.css.length], ["Play", true, "Play", 0], "nothing moves; B's CSS loop is off by its own rule");
      await timeline(page, "Study A").locator("[data-lab-play]").click();
      await page.waitForTimeout(300);
      assert.ok((await read(page, "Study A")).svg[0] > 0.1, "a Play the reader asks for plays");
    } finally {
      await browser.close();
      site.close();
    }
  });
}

// A timeline wrapped around a whole section, as a demo route may: the section's own reveal (a Web Animation the way the
// reveal library runs one, on an element outside the SVG) must keep its clock while the timeline holds the SVG's frame.
// Its clock is the page's (document.timeline), which moves a frame at a time: a loaded runner may draw the reveal's
// first frame late or few frames in a span of wall time, so the test reads the reveal against that clock, never the wall's;
// and the reveal lasts as long as the test may run, so no runner is slow enough to see it end.
for (const engine of ENGINES) {
  test(`timeline, ${engine.name}: a timeline around a section drives its SVG and leaves the section's reveal running`, { skip: engine.skip, timeout: 60000 }, async () => {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>scope</title></head><body>
<div data-lab-timeline>${String.raw`<div data-lab-controls>`}<button data-lab-play>Play</button><button data-lab-replay>Replay</button><input type="range" data-lab-time min="0" max="1.6" step="0.01" value="0"><span data-lab-readout></span></div>
<section><h2 id="reveal">A heading the section reveals</h2>${A}</section></div>
<script>document.getElementById("reveal").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 60000, fill: "both" });
window.timeline = (${String(mountTimeline)})(document.querySelector("[data-lab-timeline]"), { autoplay: false });</script></body></html>`;
    const server = http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const browser = await engine.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const reveal = () => page.evaluate(() => { const a = document.getElementById("reveal").getAnimations()[0]; return { time: a.currentTime, start: a.startTime, state: a.playState, clock: document.timeline.currentTime }; });
      // Started: its start time resolved on a frame the page drew. Then the seek, between the two readings.
      await page.evaluate(() => document.getElementById("reveal").getAnimations()[0].ready.then(() => null));
      const before = await reveal();
      await page.evaluate(() => window.timeline.seek(0.8));
      const svg = await page.evaluate(() => document.querySelector("svg").getCurrentTime());
      assert.ok(Math.abs(svg - 0.8) < 1e-6, `the SVG held at 0.8 s: ${svg}`);
      await page.waitForFunction((from) => document.timeline.currentTime > from + 100, before.clock);
      const after = await reveal();
      assert.equal(after.state, "running", "the reveal was not paused");
      assert.equal(after.start, before.start, "the reveal was not sought: its start time stands");
      // To the engine's rounding: WebKit gives both times in whole milliseconds.
      const ran = after.time - before.time, passed = after.clock - before.clock;
      assert.ok(Math.abs(ran - passed) < 2, `the reveal kept its own clock: ${before.time} → ${after.time} ms while the page's moved ${passed} ms`);
      const cycle = await page.evaluate(() => window.timeline.duration());
      assert.ok(Math.abs(cycle - 1.6) < 1e-5, `the cycle is the SVG's, not the reveal's minute: ${cycle}`);
    } finally { await browser.close(); server.close(); }
  });
}

// A timeline over two copies four screens apart and a part that slides in from far off screen, in both engines:
// playing, the frames set no animation's time; the copy far below is stopped until it is scrolled to, then joins the
// timeline's time; the sliding part, watched through its parent, never stops; paused, both copies hold one frame.
const LOOP = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40" data-duration="2"><style>@keyframes loop-slide { to { transform: translateX(40px); } } .loop-slide { animation: loop-slide 2s linear infinite; }</style><rect class="loop-slide" width="40" height="40" fill="#3a86ff"/><circle cx="10" cy="20" r="6"><animate attributeName="cx" values="10;70;10" dur="2s" repeatCount="indefinite"/></circle></svg>`;
const COUNT_WRITES = `window.writes = 0;
const setTime = SVGSVGElement.prototype.setCurrentTime;
SVGSVGElement.prototype.setCurrentTime = function (t) { window.writes += 1; return setTime.call(this, t); };
const current = Object.getOwnPropertyDescriptor(Animation.prototype, "currentTime");
Object.defineProperty(Animation.prototype, "currentTime", { configurable: true, get: current.get, set(v) { window.writes += 1; current.set.call(this, v); } });`;
for (const engine of ENGINES) {
  test(`timeline, ${engine.name}: playing, nothing sets an animation's time within a cycle; a copy far off screen waits and joins on the way back; a part that leaves the screen by its own motion runs on; paused, one frame`, { skip: engine.skip, timeout: 60000 }, async () => {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>off screen</title><style>@keyframes slide-in { from { transform: translateX(-300vw); } to { transform: none; } } .slide { animation: slide-in 2s linear infinite; }</style></head><body>
<div data-lab-timeline><div data-lab-controls>${timelineControlsHtml({ duration: 2 })}</div>
<div id="top">${LOOP}</div><div class="lane"><div data-lab-drive class="slide">→</div></div><div style="height: 400vh"></div><div id="bottom">${LOOP}</div></div>
<script>${COUNT_WRITES}
window.timeline = (${String(mountTimeline)})(document.querySelector("[data-lab-timeline]"), { duration: 2 });</script></body></html>`;
    const server = http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const browser = await engine.launch();
    try {
      const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" })).newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
      await page.waitForTimeout(300);
      const state = () => page.evaluate(() => {
        const [top, bottom] = [...document.querySelectorAll("svg")];
        const css = (svg) => svg.querySelector("rect").getAnimations()[0];
        return {
          runs: [top, bottom].map((s) => !s.animationsPaused()), css: [top, bottom].map((s) => css(s).playState),
          svg: [top, bottom].map((s) => s.getCurrentTime()), rect: [top, bottom].map((s) => css(s).currentTime),
          slide: document.querySelector(".slide").getAnimations()[0].playState, writes: window.writes, time: window.timeline.time(),
        };
      });
      let s = await state();
      assert.deepEqual([s.runs, s.css, s.slide], [[true, false], ["running", "paused"], "running"], "the copy on screen runs, the one four screens down is stopped, the part far off screen by its own motion runs on");
      const writes = s.writes;
      await page.waitForTimeout(500);
      s = await state();
      assert.equal(s.writes, writes, "playing, the frames set no animation's time");
      assert.ok(s.time > 0.6 && s.time < 1.4, `the timeline's time ran on: ${s.time}`);

      await page.evaluate(() => document.getElementById("bottom").scrollIntoView({ block: "center" }));
      await page.waitForTimeout(250);
      s = await state();
      assert.deepEqual([s.runs, s.css], [[false, true], ["paused", "running"]], "scrolled: the copy below runs, the one now far above is stopped");
      assert.ok(Math.abs(s.svg[1] - s.time) < 0.05 && Math.abs(s.rect[1] / 1000 - s.time) < 0.05, `the copy that came back joined the timeline's time: ${s.svg[1]}, ${s.rect[1]} ms, ${s.time}`);

      await page.evaluate(() => window.timeline.pause());
      s = await state();
      assert.deepEqual(s.runs, [false, false]);
      // SMIL keeps its time as a float: the SVG and the CSS clock agree to its precision, each copy to the last digit.
      assert.ok(same(s.svg) && same(s.rect) && Math.abs(s.svg[0] - s.rect[0] / 1000) < 1e-5, `paused, both copies on one frame: ${s.svg}, ${s.rect}`);
    } finally { await browser.close(); server.close(); }
  });
}

// Play-once motion the way a site's layer plays it: three parts under data-lab-drive whose backwards-filled entrance runs
// only once an IntersectionObserver sets data-play on their root — after the timeline has mounted with nothing to drive.
// Linear, so a part's opacity is its progress. The same page without a timeline, and the lab's bare page (LAB_API) with a
// short entrance that ends before anything asks for it. The cycle each engine measured, for the other to match.
const ONCE_CSS = `@keyframes once-in { from { opacity: 0; } } [data-play] .part { animation: once-in 0.8s linear backwards; } [data-play] .part:nth-child(2) { animation-delay: 0.4s; } [data-play] .part:nth-child(3) { animation-delay: 0.8s; }`;
const ARM = `new IntersectionObserver((entries, io) => { for (const e of entries) if (e.isIntersecting) { e.target.setAttribute("data-play", ""); io.unobserve(e.target); } }).observe(document.getElementById("parts"));`;
const PARTS = `<div id="parts" data-lab-drive><p class="part">one</p><p class="part">two</p><p class="part">three</p></div>`;
const onceHtml = (timeline) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>play once</title><style>${ONCE_CSS}</style></head><body>
${timeline ? `<div data-lab-timeline><div data-lab-controls>${timelineControlsHtml()}</div>${PARTS}</div>` : PARTS}
<script>${timeline ? `window.timeline = (${String(mountTimeline)})(document.querySelector("[data-lab-timeline]"));` : ""}
${ARM}</script></body></html>`;
const BARE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>bare</title><style>@keyframes flash { from { opacity: 0; } } .flash { animation: flash 0.3s linear; }</style></head><body><p class="flash">x</p><script>${LAB_API}</script></body></html>`;
const spans = new Map();
for (const engine of ENGINES) {
  test(`timeline, ${engine.name}: a backwards play-once entrance armed by an observer after the timeline mounted is found, measured, scrubbable after it ends and replayed; a page without a timeline keeps its backwards fill; lab render's clock keeps an entrance that already ended`, { skip: engine.skip, timeout: 60000 }, async () => {
    const pages = { "/": onceHtml(true), "/plain": onceHtml(false), "/bare": BARE };
    const server = http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(pages[req.url] ?? ""); });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`${base}/`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("[data-lab-play]").textContent === "Pause", null, { timeout: 5000 });
      const parts = () => page.evaluate(() => {
        const list = [...document.querySelectorAll(".part")];
        return { opacity: list.map((el) => Number(getComputedStyle(el).opacity)), fill: list.map((el) => el.getAnimations()[0]?.effect.getTiming().fill), states: list.map((el) => el.getAnimations()[0]?.playState), times: list.map((el) => el.getAnimations()[0]?.currentTime), driven: document.querySelector("[data-lab-timeline]").getAnimations({ subtree: true }).length, disabled: document.querySelector("[data-lab-time]").disabled };
      });
      const cycle = await page.evaluate(() => window.timeline.duration());
      assert.ok(Math.abs(cycle - 1.6) < 1e-6, `the cycle measured once the entrance armed: ${cycle}`);
      spans.set(engine.name, cycle);
      if (spans.size === ENGINES.length) assert.equal(new Set(spans.values()).size, 1, `the same cycle in every engine: ${[...spans]}`);
      let s = await parts();
      assert.deepEqual([s.fill, s.disabled], [["both", "both", "both"], false], "under the timeline the fill is pinned to both, and the controls are on");

      // Past the first part's end (0.8 s), pause: it ended on its own clock and is still driven.
      await page.waitForFunction(() => window.timeline.time() > 0.95 && window.timeline.time() < 1.5, null, { timeout: 5000 });
      await page.locator("[data-lab-play]").click();
      s = await parts();
      assert.equal(s.driven, 3, "every part still on the timeline after the first one ended");
      const seek = (t) => page.evaluate((t) => { const range = document.querySelector("[data-lab-time]"); range.value = String(t); range.dispatchEvent(new Event("input", { bubbles: true })); }, t);
      const near = (list, want) => list.every((v, i) => Math.abs(v - want[i]) < 0.02);
      await seek(0.2);
      s = await parts();
      assert.ok(near(s.opacity, [0.25, 0, 0]) && near(s.times, [200, 200, 200]), `scrubbed back to 0.2 s, the ended part moves again: ${s.opacity}, ${s.times}`);
      await seek(0.6);
      s = await parts();
      assert.ok(near(s.opacity, [0.75, 0.25, 0]), `0.6 s: ${s.opacity}`);
      await seek(1.6);
      s = await parts();
      assert.ok(near(s.opacity, [1, 1, 1]), `the end: ${s.opacity}`);

      await page.locator("[data-lab-replay]").click();
      s = await parts();
      assert.deepEqual(s.states, ["running", "running", "running"], "Replay plays the entrance again");
      assert.ok(s.times.every((t) => t < 300) && s.opacity[2] === 0, `from its start: ${s.times}, ${s.opacity}`);
      assert.equal(await page.locator("[data-lab-play]").textContent(), "Pause");

      const plain = await context.newPage();
      await plain.goto(`${base}/plain`, { waitUntil: "load" });
      await plain.waitForFunction(() => document.querySelectorAll(".part").length === document.querySelectorAll("[data-play] .part").length, null, { timeout: 5000 });
      const fills = await plain.evaluate(() => [...document.querySelectorAll(".part")].map((el) => el.getAnimations()[0]?.effect.getTiming().fill));
      assert.deepEqual(fills, ["backwards", "backwards", "backwards"], "no timeline: the page's own fill");
      await plain.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 5000 });

      const bare = await context.newPage();
      await bare.goto(`${base}/bare`, { waitUntil: "load" });
      await bare.waitForTimeout(600);
      const flash = await bare.evaluate(() => { const d = window.lab.duration(); window.lab.seek(0.15); return { d, opacity: Number(getComputedStyle(document.querySelector(".flash")).opacity) }; });
      assert.ok(Math.abs(flash.d - 0.3) < 1e-6 && Math.abs(flash.opacity - 0.5) < 0.02, `the ended entrance is still the page's: ${flash.d} s, opacity ${flash.opacity} at 0.15 s`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); server.close(); }
  });
}
