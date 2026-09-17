#!/usr/bin/env node
// Visual regression for refactors: renders every prerendered page of the
// production build at several widths, with animations frozen, and compares
// the screenshots pixel by pixel with a stored capture.
//
//   pnpm build && node scripts/visual-parity.mjs capture before
//   ...change things...
//   pnpm build && node scripts/visual-parity.mjs capture after
//   node scripts/visual-parity.mjs compare before after     # exit 1 on any difference
//
// Captures live in .parity/visual/<label>/; a compare writes diff images (red
// = changed pixels) to .parity/visual/<before>-vs-<after>/. Options:
//   --widths 1920,1440,1100,992,767,390   --pages /,/about   --threshold 0.02 (% of pixels)
//   --url http://host:port   (compare against a running server instead of the build)
//   --scheme dark            (render with prefers-color-scheme: dark; the default is light)
// A capture with --pages is partial; pass --pages to the compare as well so
// it judges only the pages captured (a quick check of one page against the
// full baseline while a rewrite is in progress). Scroll anchoring is off
// during a capture, so a lazy image loading above the viewport cannot move
// the scroll position (and the text under it) by a fraction of a pixel.
//
// Rendering is made deterministic: reduced motion (the Fx/OnView reveals snap
// to their end state), CSS animations and transitions disabled, loops stopped,
// self-hosted fonts. Scroll-linked transforms (Motion useScroll) are captured
// at the top of the page after one scroll-through, so a full-page shot shows
// every section in its revealed state. The waits around that scroll-through
// are counted in the renderer's animation frames, not in milliseconds, and
// the page is only scrolled once its reveals prove it hydrated, and only
// photographed once the footer's hairlines prove the scroll-through ran its
// sequences: a loaded machine (a build, another capture) then slows a
// capture, or fails it, instead of photographing a reveal before it ran; a
// page whose renderer stalls outright is reloaded once. The mobile menu is
// captured open on the home page below the collapse breakpoint.
//
// That freeze hides the motion system, so there is a second mode for it:
//   node scripts/visual-parity.mjs capture before --motion
// plays the animations for real: with every image loaded up front (so none
// lands mid-capture and moves the content), the page is scrolled one viewport
// at a time and the viewport is photographed 150, 500 and 2000ms after each
// step,
// while the reveals, sequences and scroll-linked transforms run. Infinite
// loops (a spinner, a marquee) are paused at their first frame so their phase
// does not depend on load timing. The 2000ms frame is the settled state of
// that scroll position (every reveal and spring has finished) and is compared
// strictly; the 150 and 500ms frames catch a moving element mid-flight and
// jitter by a few frames between runs (up to ~14% of a viewport for a
// large card), so they are compared with the looser --threshold-mid (default
// 20%): a missing or wrong animation shows up as far more than that, and the
// diff images show where. Alongside the frames, every animation that starts
// during the scroll-through is recorded with its timing and target
// (<page>.animations.json) and compared exactly. Motion mode covers every page
// of the build and its first post at 1440 and 390 by default.
//
// A third mode photographs interaction states the other two never reach:
//   node scripts/visual-parity.mjs capture before --states
// hovers the CTA, a nav link, a footer link and a blog card, focuses a form
// field, checks a checkbox and opens the first FAQ — on the first page file
// that carries a contact-form section, the first that carries a faq section,
// and the build's first post — then shoots the element's box (with a margin)
// after a short wait. In the wireframe only the checked box and the two open FAQs
// change anything (hover and focus draw nothing); the hover and focus rows stay
// so a design that adds those states is photographed without a new list.
// Elements are located by role and text (the three labels and the pages come
// from the site's config and page files through src/kit.ts), never by class,
// so the same list works before and after a markup rewrite. Every capture records its mode and scheme in meta.json;
// compare refuses two captures whose scheme differs.
import "./lib/load-ts.mjs";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import sharp from "sharp";

// playwright-core is the package's one optional peer: a site installs it (and a Chromium build) when it wants the harness.
const { chromium } = await import("playwright-core").catch(() => {
  console.error("visual-parity: install playwright-core (an optional peer of content-engine-kit) and a Chromium build (~/.cache/ms-playwright, or CHROME_PATH)");
  process.exit(2);
});

const { kit } = await import("@/kit");
const { site } = kit;
const BLOG = site.links.blog;
const ROOT = process.cwd();
const OUT = path.join(ROOT, ".parity/visual");
const DEFAULT_WIDTHS = [1920, 1440, 1280, 1100, 992, 800, 767, 390];
const MENU_WIDTHS = [767, 390];
const FREEZE_CSS = `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`;
// A lazy image that loads above the viewport makes scroll anchoring nudge
// scrollY by the image's growth, which depends on the placeholder box the
// markup gave it; the frames would then differ by sub-pixel text offsets.
const NO_ANCHORING_CSS = `html { overflow-anchor: none !important; }`;

const args = process.argv.slice(2);
const [command, ...labels] = args.filter((a) => !a.startsWith("--") && !isOptionValue(a));
const option = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
function isOptionValue(a) { const i = args.indexOf(a); return i > 0 && ["--widths", "--pages", "--threshold", "--threshold-mid", "--url", "--scheme"].includes(args[i - 1]); }
const motion = args.includes("--motion");
// The theme follows prefers-color-scheme (and a stored choice, absent in a fresh browser context), so a scheme is a capture option.
const scheme = option("--scheme", "light");
if (!["light", "dark"].includes(scheme)) { console.error(`--scheme must be light or dark, not ${scheme}`); process.exit(2); }
const states = args.includes("--states");
const MOTION_WIDTHS = [1440, 390];
const MOTION_FRAMES_MS = [150, 500, 2000];
const widths = option("--widths", (motion ? MOTION_WIDTHS : DEFAULT_WIDTHS).join(",")).split(",").map(Number);
const threshold = Number(option("--threshold", "0.02"));
const thresholdMid = Number(option("--threshold-mid", "20"));
const onlyPages = option("--pages", "")?.split(",").filter(Boolean);

// ---- static server for the production build --------------------------------
const TYPES = { ".html": "text/html; charset=utf-8", ".rsc": "text/x-component", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain" };
function serveBuild() {
  const app = path.join(ROOT, ".next/server/app");
  if (!fs.existsSync(app)) throw new Error("no production build: run `pnpm build` first (or pass --url)");
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const route = p === "/" ? "index" : p.replace(/\/$/, "");
    // the client router prefetches links as RSC payloads; answer them so it stops asking
    const ext = req.headers.rsc === "1" ? ".rsc" : ".html";
    const candidates = [p.startsWith("/_next/static/") && path.join(ROOT, ".next/static", p.slice(14)), path.join(ROOT, "public", p), path.join(app, `${route}${ext}`)];
    const file = candidates.find((f) => f && fs.existsSync(f) && fs.statSync(f).isFile());
    if (!file) { res.writeHead(404); return res.end(); }
    const body = fs.readFileSync(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "content-encoding": "gzip", "cache-control": "no-store" });
    res.end(zlib.gzipSync(body));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

function listPages() {
  const app = path.join(ROOT, ".next/server/app");
  const pages = [];
  const walk = (dir) => { for (const f of fs.readdirSync(dir)) { const full = path.join(dir, f); if (fs.statSync(full).isDirectory()) walk(full); else if (f.endsWith(".html") && !f.startsWith("_global")) pages.push("/" + path.relative(app, full).replace(/\.html$/, "").replace(/^index$/, "")); } };
  walk(app);
  return pages.sort();
}

/** The build's own routes: every page that is not a post and not the 404, and the first post. */
const pageRoutes = () => listPages().filter((route) => !route.startsWith("/blog-post/") && route !== "/_not-found");
const firstPost = () => listPages().find((route) => route.startsWith("/blog-post/"));
const motionPages = () => {
  const post = firstPost();
  return post ? [...pageRoutes(), post] : pageRoutes();
};

// ---- capture ---------------------------------------------------------------
function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = path.join(os.homedir(), ".cache/ms-playwright");
  const builds = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort() : [];
  const exe = builds.length && path.join(cache, builds.at(-1), "chrome-linux64/chrome");
  if (exe && fs.existsSync(exe)) return exe;
  return chromium.executablePath();
}

// Every wait that runs inside the page is raced against a deadline kept on
// this side: once in ~130 page loads on this VM a renderer stopped running
// its timers and animation frames altogether (cause unknown; the page was
// alive and idle) and a page-side promise then never settles. Such a page is
// reloaded once (`onceMore`); a second stall fails the capture, and no shot
// is ever taken of a stalled page.
class Stall extends Error {}
async function inPage(page, what, ms, fn, arg) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Stall(`${what} did not settle in ${ms / 1000}s on ${page.url()}`)), ms); });
  try { return await Promise.race([page.evaluate(fn, arg), deadline]); } finally { clearTimeout(timer); }
}
async function onceMore(what, fn) {
  try { return await fn(); } catch (error) {
    if (!(error instanceof Stall) && error.name !== "TimeoutError") throw error;
    console.error(`\n${error.message}; reloading ${what} once`);
    return fn();
  }
}

// A font request that never completes would block the run forever; after
// the grace period the shot is taken anyway (and a fallback face shows up
// as a diff).
const fontsReady = (page) => inPage(page, "fonts", 8000, () => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]));

// Hydration leaves no trace in the markup, but its result does: under reduced
// motion every reveal (ix/Fx) snaps to its end state as soon as React has
// mounted and read the preference, so the start-state classes all compute to
// opacity 1 — and by then every scroll-into-view observer exists. Waiting for
// that, rather than a fixed pause, is what makes the scroll-through below
// mean something; a page that never gets there fails the capture instead of
// yielding a shot of its unhydrated markup.
const FX_START_STATE = /\bix-(main-)?init--(slideIn\w+|growIn|fadeIn)\b/;
const revealed = (page) => page.waitForFunction((pattern) => [...document.querySelectorAll('[class*="ix-init--"], [class*="ix-main-init--"]')].filter((el) => new RegExp(pattern).test(el.getAttribute("class") ?? "")).every((el) => getComputedStyle(el).opacity === "1"), FX_START_STATE.source, { timeout: 15000 });

// A scroll-into-view sequence (ix/OnView) reaches its end state through a
// chain that runs on the renderer's main thread: the IntersectionObserver
// delivers "in view" in a frame, React commits it and runs the effect, and
// Motion writes the sequence's final keyframe (controls.complete() under
// reduced motion) on its next frame. The waits of the scroll-through are
// therefore counted in animation frames: a starved renderer slows the chain
// and the frames alike, so the next scroll step can never overtake the
// previous step's trigger. A wall-clock wait let it — with a step's "entered"
// and "left" deliveries in one React batch the effect never ran, and the
// footer hairlines or the contact FAQ's top glow were photographed at their
// start state on a loaded machine.
const STEP_FRAMES = 8;
const frames = (page, count) => inPage(page, `${count} animation frames`, 10000, (count) => new Promise((resolve) => { let seen = 0; const tick = () => (++seen >= count ? resolve() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), count);

async function settle(page) {
  // one pass through the page triggers every scroll reveal and every lazy image; back to the top for the shot
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 600) { await page.evaluate((y) => window.scrollTo(0, y), y); await frames(page, STEP_FRAMES); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await frames(page, STEP_FRAMES);
  await sequencesRan(page);
  await imagesReady(page);
  await page.waitForTimeout(400);
}

// The footer's hairlines are on every page and only a scroll-into-view
// sequence draws them (ui/FooterLines: width 0% → 100%), so their state after
// the scroll-through is the proof that the pass did its job — on a page
// without reveals (the 404), where revealed() has nothing to wait for, it is
// the only one. A shot is never taken of a page that fails it.
async function sequencesRan(page) {
  const undrawn = await page.evaluate(() => [...document.querySelectorAll("[data-ix^='footer-line-']")].filter((el) => el.style.width !== "100%").map((el) => el.dataset.ix));
  if (undrawn.length) throw new Error(`${page.url()}: ${undrawn.join(", ")} not drawn after the scroll-through — the page's scroll-into-view sequences did not run`);
}

// Every image must have arrived before the shots: a lazy image that lands
// mid-capture grows its box, and the compositor may keep text rasterised at
// the old sub-pixel offset — a diff that depends on the placeholder box the
// markup gave the image, not on anything a visitor can see. Lazy images are
// switched to eager so they load without scrolling (a scroll would fire the
// reveals the motion capture is there to photograph).
const imagesReady = (page) => inPage(page, "images", 8000, () => { for (const i of document.images) i.loading = "eager"; return Promise.race([Promise.all([...document.images].map((i) => i.complete || new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 5000))]); });

// Infinite CSS/WAAPI loops would be photographed at a phase that depends on
// load timing; hold them at their first frame. Finite animations keep playing.
const PAUSE_LOOPS = () => { for (const a of document.getAnimations()) { if (a.effect?.getTiming().iterations === Infinity && a.playState !== "paused") { a.pause(); a.currentTime = 0; } } };

// Every CSS transition, CSS animation and Web Animation (Motion's reveals and
// sequences run on WAAPI) that starts while the page is scrolled through,
// with its timing and the target's layout position on the page (offset
// geometry, which transforms do not move, since the element is already
// mid-flight when the event arrives). Compared as data, so it is immune to
// frame jitter: a missing, extra or retimed animation is a diff even when the
// screenshots happen to agree.
async function recordAnimations(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("DOM.getDocument", { depth: 0 });
  await cdp.send("Animation.enable");
  const seen = new Set();
  const records = [];
  cdp.on("Animation.animationStarted", async ({ animation }) => {
    if (seen.has(animation.id)) return;
    seen.add(animation.id);
    const src = animation.source ?? {};
    let target = null;
    try {
      const { object } = await cdp.send("DOM.resolveNode", { backendNodeId: src.backendNodeId });
      const { result } = await cdp.send("Runtime.callFunctionOn", { objectId: object.objectId, returnByValue: true, functionDeclaration: "function () { let top = 0, left = 0; for (let e = this; e; e = e.offsetParent) { top += e.offsetTop; left += e.offsetLeft; } return { tag: this.tagName.toLowerCase(), top, left, w: this.offsetWidth, h: this.offsetHeight }; }" });
      target = result.value;
    } catch { target = null; }
    records.push({ type: animation.type, name: animation.name || undefined, duration: src.duration, delay: src.delay, iterations: src.iterations, easing: src.easing, keyframes: src.keyframesRule?.keyframes?.map((k) => `${k.offset}:${k.easing}`).join(" "), target });
  });
  return async () => {
    await page.waitForTimeout(200);
    await cdp.detach().catch(() => {});
    const key = (r) => JSON.stringify(r);
    return records.filter((r) => r.iterations !== Infinity).sort((a, b) => (a.target?.top ?? 0) - (b.target?.top ?? 0) || key(a).localeCompare(key(b)));
  };
}

async function captureMotion(page, dir, name) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = 900;
  let count = 0;
  const finishRecording = await recordAnimations(page);
  for (let y = 0, i = 0; y < height; y += step, i++) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    const t0 = Date.now();
    for (const ms of MOTION_FRAMES_MS) {
      await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
      await page.evaluate(PAUSE_LOOPS);
      await page.screenshot({ path: path.join(dir, `${name}--s${String(i).padStart(2, "0")}-${ms}.png`), fullPage: false });
      count++;
    }
  }
  const animations = await finishRecording();
  fs.writeFileSync(path.join(dir, `${name}.animations.json`), JSON.stringify(animations, null, 1));
  return count;
}

// The first disclosure toggle on the page (FAQ), whatever element carries it.
const faqToggle = (p) => p.getByRole("main").locator("[aria-expanded]").first();

/** The route of the first page file (folder order) with a section of that type, looking inside group wrappers; undefined when none has one. */
function pageWith(type) {
  const holds = (sections) => sections.some((section) => section.type === type || (section.type === "group" && holds(section.sections)));
  return kit.content.getPages().find((entry) => holds(entry.data.sections))?.data.seo.path;
}

// The three labels a hover state looks for, read from the site's own config: the
// CTA, a nav entry that is a page of its own rather than an anchor, and the
// second footer quick link.
const CTA_LABEL = site.cta.label;
const NAV_LABEL = (site.nav.find((item) => item.href !== "/" && !item.href.includes("#")) ?? site.nav[1]).label;
const FOOTER_LABEL = site.footer.quickLinks[1].label;

// Interaction states. `act` performs the interaction and returns the element
// whose box is photographed; the page is prepared like a static capture
// (motion frozen), so the box shows the settled end state of the transition.
// `post` is the build's first post route, `form` and `faq` the first pages that
// show a form and a FAQ; a build without one of them drops those rows.
const STATES = ({ post, form, faq }) => [
  { page: "/", width: 1440, name: "cta-hover", act: async (p) => { const l = p.getByRole("link", { name: CTA_LABEL }).first(); await l.hover(); return l; } },
  { page: "/", width: 1440, name: "nav-link-hover", act: async (p) => { const l = p.getByRole("navigation").getByRole("link", { name: NAV_LABEL }).first(); await l.hover(); return l; } },
  { page: "/", width: 1440, name: "footer-link-hover", act: async (p) => { const l = p.getByRole("contentinfo").getByRole("link", { name: FOOTER_LABEL }); await l.hover(); return l; } },
  { page: BLOG, width: 1440, name: "card-hover", act: async (p) => { const l = p.getByRole("main").locator("a:has(img[alt]:not([alt='']))").first(); await l.hover(); return l; } },
  { page: form, width: 1440, name: "field-focus", act: async (p) => { const l = p.getByRole("textbox").first(); await l.focus(); return l; } },
  { page: form, width: 1440, name: "checkbox-checked", act: async (p) => { const l = p.locator("label:has(input[type=checkbox])").first(); await l.click(); return l; } },
  { page: faq, width: 1440, name: "faq-open", act: async (p) => { const b = faqToggle(p); await b.click(); return b.locator("xpath=ancestor::section[1]"); } },
  { page: post, width: 1440, name: "post-faq-open", act: async (p) => { const b = faqToggle(p); await b.scrollIntoViewIfNeeded(); await b.click(); return b.locator("xpath=ancestor::div[1]"); } },
].filter((state) => state.page);

// One page per shot, opened, prepared, photographed and closed here so that a
// stalled page can simply be reloaded (`onceMore`) — the closing is in the
// finally so a failed attempt does not leave its page behind.
async function withPage(context, width, url, shoot) {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url, { waitUntil: "load" });
    return await shoot(page);
  } finally { await page.close(); }
}

async function captureStates(context, baseUrl, dir) {
  let count = 0;
  for (const state of STATES({ post: firstPost(), form: pageWith("contact-form"), faq: pageWith("faq") })) {
    const name = `${state.page === "/" ? "home" : state.page.slice(1).replace(/\//g, "__")}@${state.width}--state-${state.name}`;
    await onceMore(name, () => withPage(context, state.width, baseUrl + state.page, async (page) => {
      await page.addStyleTag({ content: FREEZE_CSS });
      await fontsReady(page);
      await revealed(page);
      await settle(page);
      const target = await state.act(page);
      await page.waitForTimeout(800);
      const box = await target.boundingBox();
      const scrollY = await page.evaluate(() => window.scrollY);
      const pad = 24;
      await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y + scrollY - pad), width: box.width + 2 * pad, height: box.height + 2 * pad } });
    }));
    count++;
    process.stdout.write(`${state.name} `);
  }
  return count;
}

async function capture(label, baseUrl) {
  const dir = path.join(OUT, label);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ scheme, motion, states }));
  const pages = onlyPages?.length ? onlyPages : motion ? motionPages() : listPages();
  const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox", "--font-render-hinting=none"] });
  const context = await browser.newContext({ reducedMotion: motion ? "no-preference" : "reduce", colorScheme: scheme, deviceScaleFactor: 1, viewport: { width: 1440, height: 900 } });
  let count = 0;
  if (states) {
    count = await captureStates(context, baseUrl, dir);
    await browser.close();
    console.log(`\n${label}: ${count} state screenshots in .parity/visual/${label}`);
    return;
  }
  for (const pagePath of pages) {
    for (const width of widths) {
      const name = `${pagePath === "/" ? "home" : pagePath.slice(1).replace(/\//g, "__")}@${width}`;
      count += await onceMore(name, () => withPage(context, width, baseUrl + pagePath, async (page) => {
        await fontsReady(page);
        await page.addStyleTag({ content: NO_ANCHORING_CSS });
        if (motion) {
          await imagesReady(page);
          await page.waitForTimeout(600);
          await page.evaluate(PAUSE_LOOPS);
          return captureMotion(page, dir, name);
        }
        await page.addStyleTag({ content: FREEZE_CSS });
        await revealed(page);
        await settle(page);
        await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
        if (pagePath !== "/" || !MENU_WIDTHS.includes(width)) return 1;
        await page.locator(".w-nav-button, [aria-controls='w-nav-overlay-0'], header button[aria-expanded]").first().click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(dir, `${name}--menu.png`), fullPage: false });
        return 2;
      }));
    }
    process.stdout.write(`${pagePath} `);
  }
  await browser.close();
  console.log(`\n${label}: ${count} screenshots in .parity/visual/${label}`);
}

// ---- compare ---------------------------------------------------------------
async function compare(before, after) {
  const a = path.join(OUT, before), b = path.join(OUT, after), diffDir = path.join(OUT, `${before}-vs-${after}`);
  const meta = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")); } catch { return {}; } };
  if (meta(a).scheme !== meta(b).scheme) { console.error(`${before} was captured with --scheme ${meta(a).scheme ?? "?"} and ${after} with --scheme ${meta(b).scheme ?? "?"}: compare captures of one scheme`); process.exit(2); }
  fs.rmSync(diffDir, { recursive: true, force: true });
  fs.mkdirSync(diffDir, { recursive: true });
  // with --pages the "after" capture is partial: judge only what it contains
  const names = new Set([...(onlyPages.length ? [] : fs.readdirSync(a)), ...fs.readdirSync(b)].filter((f) => f.endsWith(".png") || f.endsWith(".animations.json")));
  let failures = 0;
  for (const name of [...names].sort()) {
    const fa = path.join(a, name), fb = path.join(b, name);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) { console.log(`MISSING  ${name} (${fs.existsSync(fa) ? "after" : "before"})`); failures++; continue; }
    if (name.endsWith(".json")) {
      const [ja, jb] = [fa, fb].map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
      const same = JSON.stringify(ja) === JSON.stringify(jb);
      if (!same) { failures++; const ka = new Set(ja.map((r) => JSON.stringify(r))), kb = new Set(jb.map((r) => JSON.stringify(r))); fs.writeFileSync(path.join(diffDir, name), JSON.stringify({ onlyBefore: ja.filter((r) => !kb.has(JSON.stringify(r))), onlyAfter: jb.filter((r) => !ka.has(JSON.stringify(r))) }, null, 1)); }
      console.log(`${same ? "ok      " : "CHANGED "} ${name.padEnd(70)} ${ja.length} -> ${jb.length} animations`);
      continue;
    }
    const [ia, ib] = await Promise.all([sharp(fa).raw().toBuffer({ resolveWithObject: true }), sharp(fb).raw().toBuffer({ resolveWithObject: true })]);
    if (ia.info.width !== ib.info.width || ia.info.height !== ib.info.height) { console.log(`SIZE     ${name} ${ia.info.width}x${ia.info.height} -> ${ib.info.width}x${ib.info.height}`); failures++; continue; }
    const { width, height, channels } = ia.info;
    const diff = Buffer.alloc(width * height * 3);
    let changed = 0;
    for (let i = 0, o = 0; i < ia.data.length; i += channels, o += 3) {
      const d = Math.max(Math.abs(ia.data[i] - ib.data[i]), Math.abs(ia.data[i + 1] - ib.data[i + 1]), Math.abs(ia.data[i + 2] - ib.data[i + 2]));
      if (d > 24) { changed++; diff[o] = 255; diff[o + 1] = 0; diff[o + 2] = 0; } else { diff[o] = ia.data[i] >> 2; diff[o + 1] = ia.data[i + 1] >> 2; diff[o + 2] = ia.data[i + 2] >> 2; }
    }
    const pct = (100 * changed) / (width * height);
    const midFlight = /--s\d+-(150|500)\.png$/.test(name);
    const ok = pct <= (midFlight ? thresholdMid : threshold);
    if (!ok) { failures++; await sharp(diff, { raw: { width, height, channels: 3 } }).png().toFile(path.join(diffDir, name)); }
    console.log(`${ok ? "ok      " : "CHANGED "} ${name.padEnd(70)} ${pct.toFixed(3)}% (${changed} px)${midFlight ? "  mid-flight" : ""}`);
  }
  console.log(failures ? `\n${failures} image(s) differ; diffs in .parity/visual/${before}-vs-${after}` : "\nidentical within threshold");
  process.exit(failures ? 1 : 0);
}

if (command === "capture" && labels[0]) {
  const url = option("--url", "");
  const server = url ? null : await serveBuild();
  try { await capture(labels[0], url || server.url); } finally { server?.close(); }
} else if (command === "compare" && labels.length === 2) {
  await compare(labels[0], labels[1]);
} else {
  console.error("usage: visual-parity.mjs capture <label> [--motion | --states] [--scheme light|dark] [--url u] [--widths w,w] [--pages p,p] | compare <before> <after> [--threshold pct] [--threshold-mid pct]");
  process.exit(2);
}
