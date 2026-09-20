#!/usr/bin/env node
// Visual regression for refactors: renders every prerendered page of the
// production build at several widths, with animations frozen, and compares
// the screenshots pixel by pixel with a stored capture.
//
//   pnpm build && pnpm kit visual-parity capture before
//   ...change things...
//   pnpm build && pnpm kit visual-parity capture after
//   pnpm kit visual-parity compare before after     # exit 1 on any difference
//
// The contract — the three modes (static, --motion, --states), what each
// writes under .parity/visual/<label>/, how a compare reads, and the traps
// of a long run — is docs/visual-parity.md; the flags are the spec in
// lib/specs.mjs (docs/commands.md). The waits that make a page
// deterministic, and why each exists, are lib/browser.mjs. What stays here
// is the harness itself: the page list of the build, the motion frames and
// the animation inventory, the interaction states located by role and text
// through the site's src/kit.ts, and the pixel compare.
import "./lib/load-ts.mjs";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseOrExit } from "./lib/args.mjs";
import { FREEZE_CSS, NO_ANCHORING_CSS, PAUSE_LOOPS, fontsReady, imagesReady, launch, listPages, onceMore, revealed, serveStatic, settle, withPage } from "./lib/browser.mjs";
import { SPECS } from "./lib/specs.mjs";

const { subcommand, positionals: labels, flags } = parseOrExit(SPECS["visual-parity"], process.argv.slice(2));

const { kit } = await import("@/kit");
const { site } = kit;
const BLOG = site.links.blog;
const ROOT = process.cwd();
const OUT = path.join(ROOT, ".parity/visual");
const DEFAULT_WIDTHS = [1920, 1440, 1280, 1100, 992, 800, 767, 390];
const MENU_WIDTHS = [767, 390];

const motion = Boolean(flags.motion);
// The theme follows prefers-color-scheme (and a stored choice, absent in a fresh browser context), so a scheme is a capture option.
const scheme = flags.scheme ?? "light";
if (!["light", "dark"].includes(scheme)) { console.error(`visual-parity capture: --scheme must be light or dark, not ${scheme}`); process.exit(2); }
const states = Boolean(flags.states);
if (motion && states) { console.error("visual-parity capture: --motion and --states are two captures, not one"); process.exit(2); }
const MOTION_WIDTHS = [1440, 390];
const MOTION_FRAMES_MS = [150, 500, 2000];
const widths = (flags.widths ?? (motion ? MOTION_WIDTHS : DEFAULT_WIDTHS).join(",")).split(",").map(Number);
const threshold = flags.threshold ?? 0.02;
const thresholdMid = flags["threshold-mid"] ?? 20;
const onlyPages = (flags.pages ?? "").split(",").filter(Boolean);

/** The build's own routes: every page that is not a post and not the 404, and the first post. */
const pageRoutes = () => listPages(ROOT).filter((route) => !route.startsWith("/blog-post/") && route !== "/_not-found");
const firstPost = () => listPages(ROOT).find((route) => route.startsWith("/blog-post/"));
const motionPages = () => {
  const post = firstPost();
  return post ? [...pageRoutes(), post] : pageRoutes();
};

// ---- capture ---------------------------------------------------------------
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
  const pages = onlyPages.length ? onlyPages : motion ? motionPages() : listPages(ROOT);
  const { context, close } = await launch({ scheme, motion });
  let count = 0;
  if (states) {
    count = await captureStates(context, baseUrl, dir);
    await close();
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
  await close();
  console.log(`\n${label}: ${count} screenshots in .parity/visual/${label}`);
}

// ---- compare ---------------------------------------------------------------
async function compare(before, after) {
  const a = path.join(OUT, before), b = path.join(OUT, after), diffDir = path.join(OUT, `${before}-vs-${after}`);
  for (const [label, dir] of [[before, a], [after, b]]) if (!fs.existsSync(dir)) { console.error(`visual-parity compare: no capture ${label} under .parity/visual/ — run agentic-cms visual-parity capture ${label} first`); process.exit(2); }
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

if (subcommand === "capture") {
  const server = flags.url ? null : await serveStatic({ root: ROOT });
  try { await capture(labels[0], flags.url || server.url); } finally { server?.close(); }
} else {
  await compare(labels[0], labels[1]);
}
