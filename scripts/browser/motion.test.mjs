// The play-once layer of agentic-cms/ix in two engines, on a page made of the
// real components as a server renders them (Reveal, RevealGroup, Sequence,
// part()), the example's src/styles/motion.css, motionScript() at the top of
// <body>, and every root armed the way useMotionRoot's ref arms it when React
// hydrates (armMotionRoot, run as a string). What must hold: a root plays
// once — scrolled away and back, or hovered, it does not play again; a loop
// runs only while its root is on screen; under a lab timeline a root plays at
// once, wherever it is on the page; with reduced motion, from the start or
// turned on mid-visit, and without scripts, nothing is hidden. Then the
// harness on the same page, through the bin (Chromium): a static probe finds
// nothing armed, a --motion probe lists the parts below the fold as pending,
// and a --motion capture records the parts it saw play. WebKit is
// Playwright's build, not Safari.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { chromePath } from "../lib/browser.mjs";
import { addPage, fixtureSite } from "../fixtures/site.mjs";
// The package's components are TypeScript in this checkout: the hook first, the imports after it.
import "../lib/load-ts.mjs";

const { createElement: h } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { Reveal } = await import("../../src/lib/ix/Reveal.ts");
const { RevealGroup } = await import("../../src/lib/ix/RevealGroup.ts");
const { Sequence } = await import("../../src/lib/ix/Sequence.ts");
const { part } = await import("../../src/lib/ix/parts.ts");
const { motionScript } = await import("../../src/lib/ix/motionScript.ts");
const { armMotionRoot } = await import("../../src/lib/ix/useMotionRoot.ts");
const { mountTimeline, timelineControlsHtml } = await import("../../src/lib/lab/timeline.ts");
const { chromium, webkit } = await import("playwright-core");

const BIN = path.resolve(import.meta.dirname, "../../bin/agentic-cms.mjs");
const MOTION_CSS = fs.readFileSync(path.resolve(import.meta.dirname, "../../src/styles/motion.css"), "utf8");
const ARM = `{ const arm = (${String(armMotionRoot)}); for (const root of document.querySelectorAll("[data-motion-root]")) arm(root); }`;

/** A drawing whose parts do every kind of thing once, and two loops. */
const diagram = (id) => h(Sequence, { as: "svg", id, width: 240, height: 120, viewBox: "0 0 240 120", settle: 2600 },
  h("path", { ...part("draw", 400), d: "M10 60 H230", stroke: "currentColor", fill: "none" }),
  h("rect", { ...part("grow", 200), x: 10, y: 80, width: 200, height: 10 }),
  h("circle", { ...part("dim", 100), cx: 40, cy: 30, r: 10 }),
  h("circle", { ...part("pop", 300), cx: 80, cy: 30, r: 10 }),
  h("circle", { ...part("pulse"), cx: 120, cy: 30, r: 10, fill: "none", stroke: "currentColor" }),
  h("path", { ...part("flow"), d: "M140 30 H230", stroke: "currentColor", fill: "none", strokeWidth: 4 }));

const page = (body, script = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>motion</title>
<style>body { margin: 0; font: 16px/1.4 sans-serif; } section { padding: 2rem; } .gap { height: 180vh; } li { width: 200px; height: 48px; border: 2px solid; }</style>
<style>${MOTION_CSS}</style></head><body><script>${motionScript()}</script>${body}<script>${ARM}${script}</script></body></html>`;

const LAYER = page(renderToStaticMarkup(h("main", null,
  h("section", { id: "first" },
    h(Reveal, { as: "h1", id: "title", intro: true }, "A first screen"),
    h(Reveal, { as: "p", id: "lede", effect: "fade", delay: 100 }, "Its lede.")),
  h("div", { className: "gap" }),
  h("section", { id: "cards" }, h(RevealGroup, { as: "ul", id: "group", effect: "pop", step: 60 }, ["one", "two", "three"].map((t) => h("li", { key: t }, t)))),
  h("div", { className: "gap" }),
  h("section", { id: "drawing" }, diagram("diagram")),
  h("div", { className: "gap" }),
  h("section", { id: "end" }, h(Reveal, { as: "p", id: "end-copy" }, "The end.")))));

// A drawing far down the page, inside a lab timeline: armed (its ref runs) before the timeline mounts, as a child's does.
const TIMELINE = page(`<div class="gap"></div><div data-lab-timeline><div data-lab-controls>${timelineControlsHtml()}</div>${renderToStaticMarkup(diagram("driven"))}</div>`,
  `window.timeline = (${String(mountTimeline)})(document.querySelector("[data-lab-timeline]"));`);

function serve(pages) {
  const server = http.createServer((req, res) => { res.writeHead(pages[req.url] ? 200 : 404, { "content-type": "text/html; charset=utf-8" }); res.end(pages[req.url] ?? ""); });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

const ENGINES = [
  { name: "Chromium", launch: () => chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] }), skip: chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`" },
  { name: "WebKit", launch: () => webkit.launch(), skip: fs.existsSync(webkit.executablePath()) ? false : "no WebKit: run `pnpm exec playwright-core install webkit`" },
];

// Every animationstart, by its element and its keyframes, from the first frame.
const COUNT_STARTS = `window.starts = []; addEventListener("animationstart", (e) => window.starts.push((e.target.id || e.target.getAttribute("data-part")) + ":" + e.animationName), true);`;
/** In the page: each part's state — its kind, opacity, transform, stroke offset, whether an animation of it is in effect and runs — and its root's attributes. */
const PARTS = (selector) => [...document.querySelectorAll(`${selector} [data-part], ${selector}[data-part]`)].map((el) => {
  const style = getComputedStyle(el);
  const root = el.closest("[data-motion-root]");
  const animations = el.getAnimations();
  return { kind: el.getAttribute("data-part"), opacity: style.opacity, transform: style.transform, dashoffset: style.strokeDashoffset, animations: animations.length, running: animations.some((a) => a.playState === "running"), play: root.hasAttribute("data-play"), visible: root.hasAttribute("data-visible") };
});
const parts = (p, selector) => p.evaluate(PARTS, selector);
const played = (p, id) => p.waitForFunction((id) => document.getElementById(id).hasAttribute("data-play"), id, { timeout: 5000 });
/** Waits until no animation that ends is still in effect: every entrance has run to its rest. */
const entrancesDone = (p) => p.waitForFunction(() => document.getAnimations().every((a) => a.effect.getTiming().iterations === Infinity), null, { timeout: 8000 });
const to = (p, id) => p.evaluate((id) => document.getElementById(id).scrollIntoView({ block: "center" }), id);
/** Every part at its rest: no animation, the opacity its own (a dimmed part's --dim), no start pose. */
function atRest(list, what) {
  for (const p of list) {
    assert.equal(p.animations, 0, `${what}: no ${p.kind} animation`);
    assert.equal(p.opacity, p.kind === "dim" ? "0.16" : "1", `${what}: ${p.kind}'s opacity`);
    if (p.kind === "grow") assert.equal(p.transform, "none", `${what}: grow is not scaled`);
    if (p.kind === "draw") assert.match(p.dashoffset, /^0(px)?$/, `${what}: draw is drawn`);
  }
}

for (const engine of ENGINES) {
  test(`play-once layer, ${engine.name}: a root plays once — not again when scrolled away and back, nor on hover — and the intro plays from the first frame`, { skip: engine.skip, timeout: 60000 }, async () => {
    const site = await serve({ "/": LAYER });
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });
      await context.addInitScript(COUNT_STARTS);
      const p = await context.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(String(e)));
      await p.goto(`${site.base}/`, { waitUntil: "load" });
      assert.equal(await p.evaluate(() => document.documentElement.getAttribute("data-motion")), "on", "motionScript armed the page");
      await played(p, "lede");
      const cards = await parts(p, "#group");
      assert.deepEqual(cards.map((c) => [c.play, c.opacity, c.animations]), [[false, "0", 0], [false, "0", 0], [false, "0", 0]], "below the fold: armed, hidden, waiting");

      await to(p, "group");
      await played(p, "group");
      await entrancesDone(p);
      atRest(await parts(p, "#group"), "after the cards played");
      const starts = await p.evaluate(() => window.starts);
      assert.deepEqual(starts.filter((s) => s.endsWith("motion-pop")).length, 3, `each card entered once: ${starts}`);
      assert.deepEqual(starts.filter((s) => s.startsWith("title:")), ["title:motion-rise"], "the intro played, once");

      await to(p, "end-copy");
      await played(p, "end-copy");
      const last = await p.evaluate(() => ({ top: document.getElementById("end-copy").getBoundingClientRect().top, line: innerHeight * 0.88, bottom: scrollY + innerHeight >= document.documentElement.scrollHeight - 1 }));
      assert.ok(last.bottom && last.top > last.line, `the page's last root never gets 12 % into the viewport (${last.top} below ${last.line}) and plays once it shows`);
      await p.waitForFunction(() => document.getElementById("group").getBoundingClientRect().bottom < 0, null, { timeout: 5000 });
      await to(p, "group");
      await p.waitForTimeout(400);
      await p.hover("#group li");
      await p.waitForTimeout(400);
      await entrancesDone(p);
      const again = await p.evaluate(() => window.starts);
      assert.equal(again.filter((s) => s.endsWith("motion-pop")).length, 3, `scrolled away and back, then hovered: nothing played again: ${again}`);
      assert.deepEqual((await parts(p, "#group")).map((c) => c.play), [true, true, true], "the root keeps data-play");
      atRest(await parts(p, "#group"), "back on the cards");
      assert.deepEqual(errors, []);
    } finally { await browser.close(); site.close(); }
  });

  test(`play-once layer, ${engine.name}: a loop runs only while its root is on screen; the drawing's parts end at their rest`, { skip: engine.skip, timeout: 60000 }, async () => {
    const site = await serve({ "/": LAYER });
    const browser = await engine.launch();
    try {
      const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" })).newPage();
      await p.goto(`${site.base}/`, { waitUntil: "load" });
      await to(p, "diagram");
      await played(p, "diagram");
      await entrancesDone(p);
      const loops = (list) => list.filter((x) => ["pulse", "flow"].includes(x.kind)).map((x) => [x.kind, x.visible, x.running]);
      let drawing = await parts(p, "#diagram");
      assert.deepEqual(loops(drawing), [["pulse", true, true], ["flow", true, true]], "on screen: the loops run");
      atRest(drawing.filter((x) => !["pulse", "flow"].includes(x.kind)), "the drawing after it played");
      assert.ok(await p.evaluate(() => Number(document.querySelector('#diagram [data-part="draw"]').style.getPropertyValue("--len")) >= 220), "the draw's length was measured");

      await to(p, "end-copy");
      await p.waitForFunction(() => !document.getElementById("diagram").hasAttribute("data-visible"), null, { timeout: 5000 });
      drawing = await parts(p, "#diagram");
      assert.deepEqual(loops(drawing), [["pulse", false, false], ["flow", false, false]], "off screen: the loops stop");
      assert.ok(drawing.every((x) => x.animations === 0), "nothing of the drawing animates off screen");

      await to(p, "diagram");
      await p.waitForFunction(() => document.getElementById("diagram").hasAttribute("data-visible"), null, { timeout: 5000 });
      assert.deepEqual(loops(await parts(p, "#diagram")), [["pulse", true, true], ["flow", true, true]], "back on screen: they run again");
    } finally { await browser.close(); site.close(); }
  });

  test(`play-once layer, ${engine.name}: under a lab timeline a root plays at once, far below the fold, and the timeline measures it`, { skip: engine.skip, timeout: 60000 }, async () => {
    const site = await serve({ "/": TIMELINE });
    const browser = await engine.launch();
    try {
      const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" })).newPage();
      await p.goto(`${site.base}/`, { waitUntil: "load" });
      const state = await p.evaluate(() => ({ top: document.getElementById("driven").getBoundingClientRect().top, play: document.getElementById("driven").hasAttribute("data-play"), animated: [...document.querySelectorAll("#driven [data-part]")].map((el) => [el.getAttribute("data-part"), el.getAnimations().length > 0]), cycle: window.timeline.duration() }));
      assert.ok(state.top > 800, `the drawing is below the fold: ${state.top}`);
      assert.equal(state.play, true, "played at once, without being seen");
      assert.deepEqual(state.animated, [["draw", true], ["grow", true], ["dim", true], ["pop", true], ["pulse", true], ["flow", true]], "every part is on the timeline's clock, the loops with them");
      assert.ok(state.cycle >= 1.4 - 1e-6, `the cycle covers the last entrance (the draw: 400 ms + 1 s): ${state.cycle}`);
    } finally { await browser.close(); site.close(); }
  });

  test(`play-once layer, ${engine.name}: nothing is hidden with reduced motion, from the start or turned on mid-visit, nor without scripts`, { skip: engine.skip, timeout: 60000 }, async () => {
    const site = await serve({ "/": LAYER });
    const browser = await engine.launch();
    try {
      const reduced = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })).newPage();
      await reduced.goto(`${site.base}/`, { waitUntil: "load" });
      assert.equal(await reduced.evaluate(() => document.documentElement.getAttribute("data-motion")), null, "not armed");
      atRest(await parts(reduced, "main"), "reduced motion, on load");
      await to(reduced, "diagram");
      await reduced.waitForTimeout(300);
      atRest(await parts(reduced, "main"), "reduced motion, scrolled");

      const switched = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" })).newPage();
      await switched.goto(`${site.base}/`, { waitUntil: "load" });
      await played(switched, "lede");
      assert.equal((await parts(switched, "#group"))[0].opacity, "0", "armed below the fold");
      await switched.emulateMedia({ reducedMotion: "reduce" });
      atRest(await parts(switched, "main"), "reduced motion turned on mid-visit");

      const noScript = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference", javaScriptEnabled: false })).newPage();
      await noScript.goto(`${site.base}/`, { waitUntil: "load" });
      atRest(await parts(noScript, "main"), "without scripts");
    } finally { await browser.close(); site.close(); }
  });
}

const skip = ENGINES[0].skip;
const bin = (root, args) => { const r = spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return r; };

test("the harness on the layer: a static probe finds nothing armed, a --motion probe lists the parts below the fold as pending, a --motion capture records the parts it saw play", { skip, timeout: 120000 }, () => {
  const root = fixtureSite();
  addPage(root, "/motion", LAYER);
  try {
    const still = JSON.parse(bin(root, ["probe", "/motion", "--select", "#group li", "--all"]).stdout);
    assert.equal(still.reveals.total, 12, "the layer's parts count as reveals: the two Reveals of the first screen, three cards, six parts of the drawing, the end");
    assert.deepEqual(still.reveals.pending, [], "reduced motion: nothing armed");
    assert.deepEqual(still.elements.map((e) => e.computed.opacity), ["1", "1", "1"]);

    const moving = JSON.parse(bin(root, ["probe", "/motion", "--select", "#title", "--motion"]).stdout);
    const pending = moving.reveals.pending.map((r) => r.id || r.part);
    assert.deepEqual(pending, ["pop", "pop", "pop", "draw", "grow", "dim", "pop", "pulse", "flow", "end-copy"], "every part whose root has not been seen, with its kind; the first screen's played");
    assert.ok(moving.reveals.pending.every((r) => typeof r.part === "string" && r.pageTop > 800));

    bin(root, ["visual-parity", "capture", "m", "--motion", "--widths", "800", "--pages", "/motion"]);
    const inventory = JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/m/motion@800.animations.json"), "utf8"));
    const names = inventory.map((a) => a.name);
    for (const name of ["motion-pop", "motion-draw", "motion-grow", "motion-dim", "motion-rise"]) assert.ok(names.includes(name), `the capture saw ${name} play: ${names}`);
    assert.equal(names.filter((n) => n === "motion-pop").length, 4, "each card and the drawing's pop, once");
    const settle = JSON.parse(fs.readFileSync(path.join(root, ".parity/visual/m/motion@800.settle.json"), "utf8"));
    assert.ok(settle.some((s) => s.declared.some((d) => d.id === "diagram" && d.settle === 2600)), "the Sequence's settle is the harness's data-settle");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
