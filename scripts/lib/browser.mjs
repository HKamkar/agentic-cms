// The browser the harness and the one-shot commands share: Chromium through
// playwright-core (the package's one optional peer), a static server for the
// site's production build, and the waits that make a page deterministic
// before it is photographed or measured. Everything here was the harness's
// (scripts/visual-parity.mjs) and keeps its behaviour; the header of that
// script and docs/visual-parity.md say why each wait exists.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

let playwright;
/** playwright-core, or exit 2 naming what to install. */
export async function requireBrowser() {
  playwright ??= await import("playwright-core").catch(() => {
    console.error("agentic-cms: install playwright-core (an optional peer of agentic-cms: pnpm add -D playwright-core) and a Chromium build (`pnpm exec playwright-core install chromium` puts one under ~/.cache/ms-playwright; or CHROME_PATH)");
    process.exit(2);
  });
  return playwright;
}

// Where Playwright keeps its browsers on each platform, and the executable
// inside a Chromium build there.
const CACHE_DIRS = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), ".cache/ms-playwright"), path.join(os.homedir(), "Library/Caches/ms-playwright"), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ms-playwright")].filter(Boolean);
const EXECUTABLES = ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-win/chrome.exe", "chrome-win64/chrome.exe"];

/** CHROME_PATH, else the newest Chromium build in Playwright's cache, else playwright-core's own path; null when none exists. */
export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const cache of CACHE_DIRS) {
    if (!fs.existsSync(cache)) continue;
    const builds = fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(a.slice(9)) - Number(b.slice(9)));
    for (const build of builds.reverse()) {
      const exe = EXECUTABLES.map((e) => path.join(cache, build, e)).find((e) => fs.existsSync(e));
      if (exe) return exe;
    }
  }
  try { const exe = playwright?.chromium.executablePath(); return exe && fs.existsSync(exe) ? exe : null; } catch { return null; }
}

// Playwright's browser cache also holds an ffmpeg build (for its video
// recording): a small one — JPEG in, VP8 WebM out — that stands in for a
// system ffmpeg when `lab render` writes a .webm and none is installed.
const FFMPEG_EXECUTABLES = ["ffmpeg-linux", "ffmpeg-linux-arm64", "ffmpeg-mac", "ffmpeg-mac-arm64", "ffmpeg-win64.exe"];

/** FFMPEG_PATH, else ffmpeg on PATH, else Playwright's bundled build: { file, bundled }; null when none exists. */
export function ffmpegPath({ env = process.env, caches = CACHE_DIRS } = {}) {
  if (env.FFMPEG_PATH) return { file: env.FFMPEG_PATH, bundled: false };
  for (const dir of (env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const exe = ["ffmpeg", "ffmpeg.exe"].map((n) => path.join(dir, n)).find((f) => fs.existsSync(f));
    if (exe) return { file: exe, bundled: false };
  }
  for (const cache of caches) {
    if (!cache || !fs.existsSync(cache)) continue;
    const builds = fs.readdirSync(cache).filter((d) => /^ffmpeg-\d+$/.test(d)).sort((a, b) => Number(b.slice(7)) - Number(a.slice(7)));
    for (const build of builds) {
      const exe = FFMPEG_EXECUTABLES.map((e) => path.join(cache, build, e)).find((e) => fs.existsSync(e));
      if (exe) return { file: exe, bundled: true };
    }
  }
  return null;
}

/** A browser and a context prepared for a capture: no sandbox, no font hinting, the scheme and the motion preference as asked. */
export async function launch({ scheme = "light", motion = false, width = 1440, height = 900, scale = 1 } = {}) {
  const { chromium } = await requireBrowser();
  const executablePath = chromePath();
  if (!executablePath) {
    console.error("agentic-cms: no Chromium build found — set CHROME_PATH, or run `pnpm exec playwright-core install chromium` (it lands under ~/.cache/ms-playwright)");
    process.exit(2);
  }
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--font-render-hinting=none"] });
  const context = await browser.newContext({ reducedMotion: motion ? "no-preference" : "reduce", colorScheme: scheme, deviceScaleFactor: scale, viewport: { width, height } });
  return { browser, context, close: () => browser.close() };
}

// ---- a static server for the production build --------------------------------
export const TYPES = { ".html": "text/html; charset=utf-8", ".rsc": "text/x-component", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain" };

// A capture loads the same chunks, stylesheets and images for every page at
// every width: each file is compressed once (kept while its size and mtime
// hold), and everything but a page and its payload may stay in the browser's
// cache for the run — the files of one build do not change under it.
function gzipped(cache, file) {
  const { size, mtimeMs } = fs.statSync(file);
  const hit = cache.get(file);
  if (hit && hit.size === size && hit.mtimeMs === mtimeMs) return hit.body;
  const body = zlib.gzipSync(fs.readFileSync(file));
  cache.set(file, { size, mtimeMs, body });
  return body;
}

// Next 16's router prefetches a link one segment at a time (Next-Router-Segment-Prefetch: /_tree, then the
// page's own segments), and the build keeps each under <page>.segments/<segment>.segment.rsc. The whole payload
// is no answer to that: a router given it asked again at every frame, some 660 requests in one scroll-through of
// a real page. A segment the build lacks is answered 204, nothing to prefetch.
const segmentFile = (app, route, segment) => (segment.includes("..") ? null : path.join(app, `${route}.segments`, `${segment}.segment.rsc`));

/** Serves <root>/.next (the prerendered pages, their RSC payloads and prefetch segments, the static chunks) and <root>/public on 127.0.0.1; { url, close }. */
export function serveStatic({ root = process.cwd(), requireBuild = true } = {}) {
  const app = path.join(root, ".next/server/app");
  if (requireBuild && !fs.existsSync(app)) throw new Error("no production build: run `pnpm build` first (or pass --url)");
  const cache = new Map();
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const route = p === "/" ? "index" : p.replace(/\/$/, "");
    // the client router prefetches links as RSC payloads; answer them so it stops asking
    const ext = req.headers.rsc === "1" ? ".rsc" : ".html";
    const segment = req.headers["next-router-segment-prefetch"];
    const candidates = segment ? [segmentFile(app, route, segment)] : [p.startsWith("/_next/static/") && path.join(root, ".next/static", p.slice(14)), path.join(root, "public", p), path.join(app, `${route}${ext}`)];
    const file = candidates.find((f) => f && fs.existsSync(f) && fs.statSync(f).isFile());
    if (!file) { res.writeHead(segment ? 204 : 404); return res.end(); }
    const page = file.startsWith(app + path.sep);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "content-encoding": "gzip", "cache-control": page ? "no-store" : "max-age=3600" });
    res.end(gzipped(cache, file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

/** A design round's throwaway route (src/app/<name>-demo, the lab's /lab-demo): never production, so never photographed unless asked for by name. */
export const DEMO_ROUTE = /^\/[a-z0-9][a-z0-9-]*-demo(\/|$)/;

/** The pages a capture photographs: the routes asked for, as given; else every route of the build but the demo routes. */
export const capturePages = (routes, only = []) => (only.length ? only : routes.filter((route) => !DEMO_ROUTE.test(route)));

/** Every route the build prerendered (from .next/server/app/**\/*.html), sorted; "/" for the index. */
export function listPages(root = process.cwd()) {
  const app = path.join(root, ".next/server/app");
  const pages = [];
  const walk = (dir) => { for (const f of fs.readdirSync(dir)) { const full = path.join(dir, f); if (fs.statSync(full).isDirectory()) walk(full); else if (f.endsWith(".html") && !f.startsWith("_global")) pages.push("/" + path.relative(app, full).replace(/\.html$/, "").replace(/^index$/, "")); } };
  walk(app);
  return pages.sort();
}

// ---- making a page deterministic ---------------------------------------------
export const FREEZE_CSS = `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`;
// A lazy image that loads above the viewport makes scroll anchoring nudge
// scrollY by the image's growth, which depends on the placeholder box the
// markup gave it; the frames would then differ by sub-pixel text offsets.
export const NO_ANCHORING_CSS = `html { overflow-anchor: none !important; }`;

// Every wait that runs inside the page is raced against a deadline kept on
// this side: once in ~130 page loads a renderer stopped running its timers and
// animation frames altogether (cause unknown; the page was alive and idle) and
// a page-side promise then never settles. Such a page is reloaded once
// (`onceMore`); a second stall fails the capture, and no shot is ever taken of
// a stalled page.
export class Stall extends Error {}
export async function inPage(page, what, ms, fn, arg) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Stall(`${what} did not settle in ${ms / 1000}s on ${page.url()}`)), ms); });
  try { return await Promise.race([page.evaluate(fn, arg), deadline]); } finally { clearTimeout(timer); }
}
export async function onceMore(what, fn) {
  try { return await fn(); } catch (error) {
    if (!(error instanceof Stall) && error.name !== "TimeoutError") throw error;
    console.error(`\n${error.message}; reloading ${what} once`);
    return fn();
  }
}

// A font request that never completes would block the run forever; after
// the grace period the shot is taken anyway (and a fallback face shows up
// as a diff).
export const fontsReady = (page) => inPage(page, "fonts", 8000, () => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]));

// Hydration leaves no trace in the markup, but its result does: under reduced
// motion every reveal (ix/Fx) snaps to its end state as soon as React has
// mounted and read the preference, so the start-state classes all compute to
// opacity 1 — and by then every scroll-into-view observer exists. Waiting for
// that, rather than a fixed pause, is what makes the scroll-through below
// mean something; a page that never gets there fails the capture instead of
// yielding a shot of its unhydrated markup.
export const FX_START_STATE = /\bix-(main-)?init--(slideIn\w+|growIn|fadeIn)\b/;
export const revealed = (page) => page.waitForFunction((pattern) => [...document.querySelectorAll('[class*="ix-init--"], [class*="ix-main-init--"]')].filter((el) => new RegExp(pattern).test(el.getAttribute("class") ?? "")).every((el) => getComputedStyle(el).opacity === "1"), FX_START_STATE.source, { timeout: 15000 });

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
export const STEP_FRAMES = 8;
export const frames = (page, count) => inPage(page, `${count} animation frames`, 10000, (count) => new Promise((resolve) => { let seen = 0; const tick = () => (++seen >= count ? resolve() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), count);

// The scroll-through only has to reach every scroll-into-view observer, not
// to paint: while it runs every element is hidden — visibility, so layout,
// the observers and the page's scripts are untouched — and a heavy page's
// frames cost its layout alone (measured on a real site: 1.2–2× faster at
// desktop widths, the shot pixel-identical). The style goes before the page
// is scrolled back to the top.
const PAINTLESS = "agentic-cms-paintless";
const hidePaint = (id) => { const style = document.createElement("style"); style.id = id; style.textContent = "*, *::before, *::after { visibility: hidden !important; }"; document.head.append(style); };

/** One pass through the page triggers every scroll reveal and every lazy image; back to the top for the shot. */
export async function settle(page) {
  // The height is read again at every step: lazy images take their box as they load, so a page grows while
  // it is scrolled through, and a height read once at the start stops the pass short of the footer.
  const height = () => page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(hidePaint, PAINTLESS);
  for (let y = 0; y <= (await height()); y += 600) { await page.evaluate((y) => window.scrollTo(0, y), y); await frames(page, STEP_FRAMES); }
  await page.evaluate((id) => { document.getElementById(id)?.remove(); window.scrollTo(0, 0); }, PAINTLESS);
  await frames(page, STEP_FRAMES);
  await sequencesRan(page);
  await imagesReady(page);
  // what arrived is decoded and painted: counted in frames, like every other wait here, where it was 400 ms
  await frames(page, STEP_FRAMES);
}

// A site's footer hairlines (data-ix="footer-line-*", drawn only by a
// scroll-into-view sequence, width 0% → 100%) are the proof that the pass did
// its job — on a page without reveals (the 404), where revealed() has nothing
// to wait for, they are the only one. A shot is never taken of a page that
// fails it; a site without such lines has nothing to check here.
export async function sequencesRan(page) {
  const undrawn = await page.evaluate(() => [...document.querySelectorAll("[data-ix^='footer-line-']")].filter((el) => el.style.width !== "100%").map((el) => el.dataset.ix));
  if (undrawn.length) throw new Error(`${page.url()}: ${undrawn.join(", ")} not drawn after the scroll-through — the page's scroll-into-view sequences did not run`);
}

// React hydrates the server's HTML by comparing each element with its client
// props, and in development it reports an attribute that is on the element
// and in neither ("A tree hydrated but some attributes of the server rendered
// HTML didn't match the client properties"). imagesReady sets `loading` on
// images, so it first waits until React owns every image it will own: each
// <img> carries React's fiber key, or sits inside markup React inserted as a
// string (dangerouslySetInnerHTML), which React never hydrates. A page that is
// not a Next app (the lab's, a sheet, a plain HTML site) passes at once; one
// that never gets there falls through after 10 s rather than hang the run.
// Before this, a motion capture or `probe --motion` against a slow hydrate
// (`next dev`) switched the images first and React blamed the site.
export const hydrated = (page) => inPage(page, "hydration", 15000, () => new Promise((resolve) => {
  const reactKey = (el, prefix) => Object.keys(el).find((k) => k.startsWith(prefix));
  const inserted = (img) => { for (let e = img.parentElement; e; e = e.parentElement) { const props = reactKey(e, "__reactProps$"); if (props) return Boolean(e[props]?.dangerouslySetInnerHTML); } return false; };
  const next = Boolean(window.__next_f || window.__NEXT_DATA__ || document.getElementById("__next"));
  const done = () => !next || [...document.images].every((img) => reactKey(img, "__reactFiber$") || inserted(img));
  const deadline = setTimeout(() => resolve(false), 10000);
  const tick = () => { if (!done()) return requestAnimationFrame(tick); clearTimeout(deadline); resolve(true); };
  tick();
}));

// Every image must have arrived before the shots: a lazy image that lands
// mid-capture grows its box, and the compositor may keep text rasterised at
// the old sub-pixel offset — a diff that depends on the placeholder box the
// markup gave the image, not on anything a visitor can see. Lazy images are
// switched to eager so they load without scrolling (a scroll would fire the
// reveals the motion capture is there to photograph) — once the page has
// hydrated (above), so the switch is never React's to report.
export async function imagesReady(page) {
  await hydrated(page);
  return inPage(page, "images", 8000, () => { for (const i of document.images) i.loading = "eager"; return Promise.race([Promise.all([...document.images].map((i) => i.complete || new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 5000))]); });
}

// Infinite CSS/WAAPI loops would be photographed at a phase that depends on
// load timing; hold them at their first frame. Finite animations keep playing.
export const PAUSE_LOOPS = () => { for (const a of document.getAnimations()) { if (a.effect?.getTiming().iterations === Infinity && a.playState !== "paused") { a.pause(); a.currentTime = 0; } } };

// SMIL is not in document.getAnimations(): neither FREEZE_CSS nor PAUSE_LOOPS
// reaches an inline <svg>'s <animate>, whose clock would be photographed at a
// time that depends on load timing. Each outermost inline svg that animates
// is paused and set here: at its data-rest (seconds; the frame a
// reduced-motion reader sees) when `rest` and it declares one, else `at`
// seconds into its cycle (data-duration). An animated SVG in an <img> is its
// own document, out of reach — it is photographed as it runs. (In-page
// functions travel as source, so each spells its selector out.)
export const HOLD_SMIL = ({ at = 0, rest = false } = {}) => {
  let held = 0;
  for (const svg of document.querySelectorAll("svg")) {
    if (svg.parentElement?.closest("svg") || !svg.querySelector("animate, animateTransform, animateMotion, set")) continue;
    const duration = Number(svg.dataset.duration) || 0;
    svg.pauseAnimations();
    svg.setCurrentTime(rest && svg.dataset.rest !== undefined ? Number(svg.dataset.rest) : duration ? at % duration : at);
    held++;
  }
  return held;
};

// The sections of a page and where they sit, for the compare to name the one
// behind a shift: every [data-section] (else the header, main's children and
// the footer) with its top and height as layout gives them — fractions
// included, since a section a quarter pixel taller moves every row below it
// by a quarter pixel and re-antialiases the rest of the page.
export const SECTIONS = () => {
  const marked = [...document.querySelectorAll("[data-section]")];
  const round = (n) => Math.round(n * 1000) / 1000;
  return (marked.length ? marked : [...document.querySelectorAll("header, main > *, footer")]).map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.id || null, section: el.dataset.section ?? el.tagName.toLowerCase(), top: round(r.top + scrollY), height: round(r.height) };
  });
};

// The inline SMIL loops of a page, for the animation inventory: one entry per
// outermost animated svg with its cycle (data-duration, else its longest
// animation), its rest and its box on the page, so a loop removed or retimed
// is a difference even when the frames agree.
export const SMIL_INVENTORY = () => [...document.querySelectorAll("svg")].filter((svg) => !svg.parentElement?.closest("svg") && svg.querySelector("animate, animateTransform, animateMotion, set")).map((svg) => {
  let duration = Number(svg.dataset.duration) || 0;
  if (!duration) for (const a of svg.querySelectorAll("animate, animateTransform, animateMotion, set")) { try { const d = a.getSimpleDuration(); if (Number.isFinite(d)) duration = Math.max(duration, d); } catch { /* an indefinite duration */ } }
  const r = svg.getBoundingClientRect();
  return { type: "smil", duration, rest: svg.dataset.rest === undefined ? null : Number(svg.dataset.rest), target: { tag: "svg", top: Math.round(r.top + scrollY), left: Math.round(r.left + scrollX), w: Math.round(r.width), h: Math.round(r.height) } };
});

// The harness's screenshots go through the DevTools protocol with the encoding
// set for speed: the same pixels as Playwright's page.screenshot() — its
// full-page size (the largest of the body's and the root's scroll, offset
// and client boxes), its clip trimmed to the page and never rounded, its
// viewport shot at the visual viewport, the caret hidden as it hides it —
// in about half the time on a tall page, the PNG larger. The caret is hidden
// on the editable elements alone, inline, as Playwright does: a stylesheet
// on every element restyles the whole page before the shot, and a layer
// under a 3D transform came out rastered differently (measured on a real
// site's motion frame).
const PAGE_SIZE = () => { const b = document.body, d = document.documentElement; return { width: Math.max(b.scrollWidth, d.scrollWidth, b.offsetWidth, d.offsetWidth, b.clientWidth, d.clientWidth), height: Math.max(b.scrollHeight, d.scrollHeight, b.offsetHeight, d.offsetHeight, b.clientHeight, d.clientHeight) }; };
const trimTo = (clip, size) => { const x = Math.max(0, Math.min(clip.x, size.width)), y = Math.max(0, Math.min(clip.y, size.height)); return { x, y, width: Math.max(0, Math.min(clip.x + clip.width, size.width)) - x, height: Math.max(0, Math.min(clip.y + clip.height, size.height)) - y }; };
const HIDE_CARET = () => {
  const roots = [];
  const walk = (root) => { roots.push(root); for (const el of root.querySelectorAll("*")) if (el.shadowRoot) walk(el.shadowRoot); };
  walk(document);
  const saved = [];
  for (const root of roots) for (const el of root.querySelectorAll("input,textarea,[contenteditable]")) { saved.push([el, el.style.getPropertyValue("caret-color"), el.style.getPropertyPriority("caret-color")]); el.style.setProperty("caret-color", "transparent", "important"); }
  window.__agenticCmsCaret = saved;
  return document.fonts.ready.then(() => {});
};
const SHOW_CARET = () => { for (const [el, value, priority] of window.__agenticCmsCaret ?? []) el.style.setProperty("caret-color", value, priority); delete window.__agenticCmsCaret; };

/** A PNG of the page into `file`: the whole page (`fullPage`), a box of it in page coordinates (`fullPage` and `clip`), or the viewport. */
export async function snap(page, file, { fullPage = false, clip = null } = {}) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const viewport = page.viewportSize();
    let area, beyond = false;
    if (fullPage) {
      const size = await page.evaluate(PAGE_SIZE);
      area = clip ? trimTo(clip, size) : { x: 0, y: 0, ...size };
      beyond = !(size.width <= viewport.width && size.height <= viewport.height);
    } else {
      const { visualViewport } = await cdp.send("Page.getLayoutMetrics");
      area = { x: visualViewport.pageX, y: visualViewport.pageY, width: viewport.width, height: viewport.height };
    }
    await page.evaluate(HIDE_CARET);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { ...area, scale: 1 }, captureBeyondViewport: beyond, optimizeForSpeed: true });
    await page.evaluate(SHOW_CARET);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
  } finally { await cdp.detach().catch(() => {}); }
}

// One page per shot, opened, prepared, photographed and closed here so that a
// stalled page can simply be reloaded (`onceMore`) — the closing is in the
// finally so a failed attempt does not leave its page behind.
export async function withPage(context, width, url, shoot, { height = 900 } = {}) {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width, height });
    await page.goto(url, { waitUntil: "load" });
    return await shoot(page);
  } finally { await page.close(); }
}

/** A route's name in the files a command writes — the harness's shots, shot's picture: "/" → "home", "/blog/x" → "blog__x", a URL → its path the same way. */
export function routeName(target) {
  const route = /^https?:\/\//.test(target) ? new URL(target).pathname : target;
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/\/$/, "").replace(/\//g, "__") || "home";
}

// ---- the one-shot commands' helpers (shot, probe, sheet) -------------------------
/** A route of the build ("/about") against a base, or a URL as it is. */
export function resolveTarget(target, { base }) {
  if (/^https?:\/\//.test(target)) return target;
  if (!target.startsWith("/")) throw new Error(`${target}: a target is a route of the build (/about) or a URL (http://…)`);
  return base.replace(/\/$/, "") + target;
}

/** The static preparation of the harness (fonts, no anchoring, frozen, revealed, scrolled through, SMIL at its rest), or the motion one (images, loops held). */
export async function prepare(page, { motion = false } = {}) {
  await fontsReady(page);
  await page.addStyleTag({ content: NO_ANCHORING_CSS });
  if (motion) {
    await imagesReady(page);
    await page.waitForTimeout(600);
    await page.evaluate(PAUSE_LOOPS);
    return;
  }
  await page.addStyleTag({ content: FREEZE_CSS });
  await revealed(page);
  await settle(page);
  await page.evaluate(HOLD_SMIL, { rest: true });
}

/** The elements a command works on (a command takes .nth(index) or all): the matches of a selector, the sections (article, [data-section]) holding the headings that match a regex, or — with both — the selector's matches inside that section. */
export function findTarget(page, { select, heading }) {
  const section = heading ? page.locator("h1, h2, h3, h4").filter({ hasText: new RegExp(heading, "i") }).locator("xpath=ancestor-or-self::*[self::section or self::article or @data-section][1]") : null;
  if (select) return section ? section.first().locator(select) : page.locator(select);
  return section;
}

/** Collects console errors and warnings and page errors from now on; the returned function reads them. */
export function collectConsole(page) {
  const lines = [];
  page.on("console", (message) => { if (["error", "warning"].includes(message.type())) lines.push({ type: message.type(), text: message.text() }); });
  page.on("pageerror", (error) => lines.push({ type: "pageerror", text: String(error.message ?? error) }));
  return () => lines;
}

/** In the page: keeps only the element and its ancestors visible, clears their backgrounds, so a shot with omitBackground shows the element alone. */
export const ISOLATE = (el) => {
  const keep = new Set();
  for (let e = el; e; e = e.parentElement) keep.add(e);
  for (let e = el.parentElement; e; e = e.parentElement) {
    for (const child of e.children) if (!keep.has(child)) child.style.setProperty("visibility", "hidden", "important");
    e.style.setProperty("background", "transparent", "important");
    e.style.setProperty("box-shadow", "none", "important");
  }
};

/** The chain of stacking contexts above an element, nearest first, with the property that creates each (in-page function). */
export const STACKING = (el) => {
  const why = (e) => {
    const s = getComputedStyle(e);
    if (e === document.documentElement) return "root";
    if (s.position !== "static" && s.zIndex !== "auto") return `position: ${s.position}; z-index: ${s.zIndex}`;
    if (s.position === "fixed" || s.position === "sticky") return `position: ${s.position}`;
    if (Number(s.opacity) < 1) return `opacity: ${s.opacity}`;
    if (s.transform !== "none") return `transform: ${s.transform}`;
    if (s.filter !== "none") return `filter: ${s.filter}`;
    if (s.backdropFilter && s.backdropFilter !== "none") return `backdrop-filter: ${s.backdropFilter}`;
    if (s.isolation === "isolate") return "isolation: isolate";
    if (s.mixBlendMode !== "normal") return `mix-blend-mode: ${s.mixBlendMode}`;
    if (/transform|opacity|filter/.test(s.willChange)) return `will-change: ${s.willChange}`;
    if (/layout|paint|strict|content/.test(s.contain)) return `contain: ${s.contain}`;
    return null;
  };
  const chain = [];
  for (let e = el.parentElement; e; e = e.parentElement) {
    const reason = why(e);
    if (reason) chain.push({ tag: e.tagName.toLowerCase(), id: e.id || null, classes: [...e.classList], reason });
  }
  return chain;
};
