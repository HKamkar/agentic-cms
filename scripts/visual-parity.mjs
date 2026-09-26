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
// is the harness itself: the page list of the build (photographed from a
// copy of it, lib/snapshot.mjs, so the tree is free while it runs), the
// motion frames and the animation inventory, the interaction states located
// by role and text through the site's src/kit.ts, and the pixel compare.
import "./lib/load-ts.mjs";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { FREEZE_CSS, HOLD_SMIL, NO_ANCHORING_CSS, PAUSE_LOOPS, SMIL_INVENTORY, capturePages, fontsReady, imagesReady, launch, listPages, onceMore, revealed, routeName, serveStatic, settle, withPage } from "./lib/browser.mjs";
import { compareCapture } from "./lib/compare-images.mjs";
import { buildRef } from "./lib/ref-build.mjs";
import { SNAPSHOTS, snapshotBuild, treeState } from "./lib/snapshot.mjs";
import { SPECS } from "./lib/specs.mjs";

const { subcommand, positionals: labels, flags } = parseOrExit(SPECS["visual-parity"], process.argv.slice(2));

// The site's config and page files are needed by --states alone (the labels
// and pages the states look for); a static or motion capture reads the build.
const loadKit = async () => (await import("@/kit")).kit;
const ROOT = process.cwd();
const OUT = path.join(ROOT, ".parity/visual");
const DEFAULT_WIDTHS = [1920, 1440, 1280, 1100, 992, 800, 767, 390];
const MENU_WIDTHS = [767, 390];

const motion = Boolean(flags.motion);
// The theme follows prefers-color-scheme (and a stored choice, absent in a fresh browser context), so a scheme is a capture option.
const scheme = flags.scheme ?? "light";
const states = Boolean(flags.states);
if (motion && states) { console.error("visual-parity capture: --motion and --states are two captures, not one"); process.exit(2); }
const MOTION_WIDTHS = [1440, 390];
const MOTION_FRAMES_MS = [150, 500];
const widths = (flags.widths ?? (motion ? MOTION_WIDTHS : DEFAULT_WIDTHS).join(",")).split(",").map(Number);
const threshold = flags.threshold ?? 0.02;
const thresholdMid = flags["threshold-mid"] ?? 20;
const onlyPages = (flags.pages ?? "").split(",").filter(Boolean);
const settleMs = flags.settle ?? 2000;
if (subcommand === "capture" && flags.settle !== undefined && flags.settle !== 2000 && !motion) { console.error("visual-parity capture: --settle is for the settled frame of a --motion capture"); process.exit(2); }
if ([flags.url, flags.build, flags.ref].filter(Boolean).length > 1) { console.error("visual-parity capture: --url, --build and --ref are three sources of one build; pass one"); process.exit(2); }
const say = (line) => (flags.json ? process.stderr.write(line) : process.stdout.write(line));

/** The build's own routes: every page that is not a post, not the 404 and not a demo route, and the first post. */
const pageRoutes = (root = ROOT) => capturePages(listPages(root)).filter((route) => !route.startsWith("/blog-post/") && route !== "/_not-found");
const firstPost = (root = ROOT) => listPages(root).find((route) => route.startsWith("/blog-post/"));
const motionPages = (root = ROOT) => {
  const post = firstPost(root);
  return post ? [...pageRoutes(root), post] : pageRoutes(root);
};

// ---- capture ---------------------------------------------------------------
// Every CSS transition, CSS animation and Web Animation (Motion's reveals and
// sequences run on WAAPI) that starts while the page is scrolled through,
// with its timing and the target's layout position on the page (offset
// geometry, which transforms do not move, since the element is already
// mid-flight when the event arrives). Compared as data, so it is immune to
// frame jitter: a missing, extra or retimed animation is a diff even when the
// screenshots happen to agree. The inline SMIL loops, which the browser does
// not report as animations, join them from SMIL_INVENTORY.
const byPlace = (a, b) => (a.target?.top ?? 0) - (b.target?.top ?? 0) || JSON.stringify(a).localeCompare(JSON.stringify(b));
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
    return records.filter((r) => r.iterations !== Infinity);
  };
}

// A section whose sequence runs longer than the settled frame's default
// declares it: data-settle="2600" on any element, read while that element is
// in the viewport at a step, so the settled frame waits for the longest one.
const DECLARED_SETTLE = () => [...document.querySelectorAll("[data-settle]")].map((el) => ({ el, rect: el.getBoundingClientRect(), settle: Number(el.dataset.settle) })).filter(({ rect, settle }) => settle > 0 && rect.bottom > 0 && rect.top < innerHeight).map(({ el, rect, settle }) => ({ tag: el.tagName.toLowerCase(), id: el.id || null, top: Math.round(rect.top + scrollY), settle }));

async function captureMotion(page, dir, name) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = 900;
  let count = 0;
  const steps = [];
  const finishRecording = await recordAnimations(page);
  for (let y = 0, i = 0; y < height; y += step, i++) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    const t0 = Date.now();
    const declared = await page.evaluate(DECLARED_SETTLE);
    const settled = Math.max(settleMs, ...declared.map((d) => d.settle));
    for (const [ms, tag] of [...MOTION_FRAMES_MS.map((ms) => [ms, String(ms)]), [settled, "settled"]]) {
      await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
      await page.evaluate(PAUSE_LOOPS);
      // a SMIL clock is set to the frame's own time since the step (the settled frame to its data-rest), never to when the shot happened to run
      await page.evaluate(HOLD_SMIL, { at: ms / 1000, rest: tag === "settled" });
      await page.screenshot({ path: path.join(dir, `${name}--s${String(i).padStart(2, "0")}-${tag}.png`), fullPage: false });
      count++;
    }
    steps.push({ step: i, y, waited: settled, declared });
  }
  const animations = [...await finishRecording(), ...await page.evaluate(SMIL_INVENTORY)].sort(byPlace);
  fs.writeFileSync(path.join(dir, `${name}.animations.json`), JSON.stringify(animations, null, 1));
  fs.writeFileSync(path.join(dir, `${name}.settle.json`), JSON.stringify(steps, null, 1));
  return count;
}

// The first disclosure toggle on the page (FAQ), whatever element carries it.
const faqToggle = (p) => p.getByRole("main").locator("[aria-expanded]").first();

/** The route of the first page file (folder order) with a section of that type, looking inside group wrappers; undefined when none has one. */
function pageWith(kit, type) {
  const holds = (sections) => sections.some((section) => section.type === type || (section.type === "group" && holds(section.sections)));
  return kit.content.getPages().find((entry) => holds(entry.data.sections))?.data.seo.path;
}

// Interaction states. `act` performs the interaction and returns the element
// whose box is photographed; the page is prepared like a static capture
// (motion frozen), so the box shows the settled end state of the transition.
// The three labels a hover state looks for come from the site's own config
// (the CTA, a nav entry that is a page of its own rather than an anchor, the
// second footer quick link); `post` is the build's first post route, `form`
// and `faq` the first pages that show a form and a FAQ; a build without one
// of them drops those rows.
const STATES = ({ site, post, form, faq }) => [
  { page: "/", width: 1440, name: "cta-hover", act: async (p) => { const l = p.getByRole("link", { name: site.cta.label }).first(); await l.hover(); return l; } },
  { page: "/", width: 1440, name: "nav-link-hover", act: async (p) => { const l = p.getByRole("navigation").getByRole("link", { name: (site.nav.find((item) => item.href !== "/" && !item.href.includes("#")) ?? site.nav[1]).label }).first(); await l.hover(); return l; } },
  { page: "/", width: 1440, name: "footer-link-hover", act: async (p) => { const l = p.getByRole("contentinfo").getByRole("link", { name: site.footer.quickLinks[1].label }); await l.hover(); return l; } },
  { page: site.links.blog, width: 1440, name: "card-hover", act: async (p) => { const l = p.getByRole("main").locator("a:has(img[alt]:not([alt='']))").first(); await l.hover(); return l; } },
  { page: form, width: 1440, name: "field-focus", act: async (p) => { const l = p.getByRole("textbox").first(); await l.focus(); return l; } },
  { page: form, width: 1440, name: "checkbox-checked", act: async (p) => { const l = p.locator("label:has(input[type=checkbox])").first(); await l.click(); return l; } },
  { page: faq, width: 1440, name: "faq-open", act: async (p) => { const b = faqToggle(p); await b.click(); return b.locator("xpath=ancestor::section[1]"); } },
  { page: post, width: 1440, name: "post-faq-open", act: async (p) => { const b = faqToggle(p); await b.scrollIntoViewIfNeeded(); await b.click(); return b.locator("xpath=ancestor::div[1]"); } },
].filter((state) => state.page);

async function captureStates(context, baseUrl, dir, root) {
  let count = 0;
  const kit = await loadKit();
  for (const state of STATES({ site: kit.site, post: firstPost(root), form: pageWith(kit, "contact-form"), faq: pageWith(kit, "faq") })) {
    const name = `${routeName(state.page)}@${state.width}--state-${state.name}`;
    await onceMore(name, () => withPage(context, state.width, baseUrl + state.page, async (page) => {
      await page.addStyleTag({ content: FREEZE_CSS });
      await fontsReady(page);
      await revealed(page);
      await settle(page);
      await page.evaluate(HOLD_SMIL, { rest: true });
      const target = await state.act(page);
      await page.waitForTimeout(800);
      const box = await target.boundingBox();
      const scrollY = await page.evaluate(() => window.scrollY);
      const pad = 24;
      await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y + scrollY - pad), width: box.width + 2 * pad, height: box.height + 2 * pad } });
    }));
    count++;
    say(`${state.name} `);
  }
  return count;
}

async function capture(label, baseUrl, { root = ROOT, baseline = null, tree } = {}) {
  const started = Date.now();
  const dir = path.join(OUT, label);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const meta = { scheme, motion, states, ...(motion ? { settle: settleMs, frames: [...MOTION_FRAMES_MS, "settled"] } : {}), ...(baseline ? { ref: baseline.ref, sha: baseline.sha, ...(baseline.demos?.length ? { demosRemoved: baseline.demos } : {}) } : {}), ...(tree !== undefined ? { tree } : {}) };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta));
  const pages = states ? [] : onlyPages.length ? onlyPages : motion ? motionPages(root) : capturePages(listPages(root));
  const { context, close } = await launch({ scheme, motion });
  let count = 0;
  const finish = () => {
    const files = fs.readdirSync(dir).filter((f) => f !== "meta.json").sort();
    const summary = { label, dir: `.parity/visual/${label}`, pages: states ? null : pages, widths: states ? null : widths, files: files.length, seconds: Math.round((Date.now() - started) / 100) / 10, meta };
    // written last: its presence is the sign that the capture finished (the directory is wiped at the start)
    fs.writeFileSync(path.join(dir, "capture.json"), JSON.stringify(summary, null, 1));
    if (flags.json) console.log(JSON.stringify(summary, null, 1));
    return summary;
  };
  if (states) {
    count = await captureStates(context, baseUrl, dir, root);
    await close();
    say(`\n${label}: ${count} state screenshots in .parity/visual/${label}\n`);
    finish();
    return;
  }
  for (const pagePath of pages) {
    for (const width of widths) {
      const name = `${routeName(pagePath)}@${width}`;
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
        await page.evaluate(HOLD_SMIL, { rest: true });
        await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
        if (pagePath !== "/" || !MENU_WIDTHS.includes(width)) return 1;
        await page.locator(".w-nav-button, [aria-controls='w-nav-overlay-0'], header button[aria-expanded]").first().click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(dir, `${name}--menu.png`), fullPage: false });
        return 2;
      }));
    }
    say(`${pagePath} `);
  }
  await close();
  say(`\n${label}: ${count} screenshots in .parity/visual/${label}\n`);
  finish();
}

// ---- compare ---------------------------------------------------------------
async function compare(before, after) {
  const a = path.join(OUT, before), b = path.join(OUT, after), diffDir = path.join(OUT, `${before}-vs-${after}`);
  for (const [label, dir] of [[before, a], [after, b]]) if (!fs.existsSync(dir)) { console.error(`visual-parity compare: no capture ${label} under .parity/visual/ — run agentic-cms visual-parity capture ${label} first`); process.exit(2); }
  const meta = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")); } catch { return {}; } };
  if (meta(a).scheme !== meta(b).scheme) { console.error(`${before} was captured with --scheme ${meta(a).scheme ?? "?"} and ${after} with --scheme ${meta(b).scheme ?? "?"}: compare captures of one scheme`); process.exit(2); }
  const report = await compareCapture(a, b, { before, after, diffDir, threshold, thresholdMid, pages: onlyPages });
  const out = flags.json ? console.error : console.log;
  if (report.baseline) out(`baseline: ${report.baseline.ref ?? ""} ${report.baseline.sha ?? ""}`.trim());
  for (const file of report.files) out(file.line);
  const failures = report.files.length - report.summary.ok;
  out(failures ? `\n${failures} file(s) differ; diffs in .parity/visual/${before}-vs-${after}` : "\nidentical within threshold");
  fs.writeFileSync(path.join(diffDir, "report.json"), JSON.stringify(report, null, 1));
  if (flags.json) console.log(JSON.stringify(report, null, 1));
  process.exit(report.summary.exit);
}

if (subcommand === "capture") {
  let root = ROOT;
  let baseline = null;
  if (flags.build) {
    fs.mkdirSync(path.join(ROOT, ".parity"), { recursive: true });
    const log = path.join(ROOT, ".parity", `${labels[0]}.build.log`);
    say(`building (log: .parity/${labels[0]}.build.log)\n`);
    const build = spawnSync("pnpm", ["build"], { cwd: ROOT, stdio: ["ignore", fs.openSync(log, "w"), fs.openSync(log, "a")], shell: process.platform === "win32" });
    if (build.status !== 0) { console.error(`visual-parity capture: the build failed — the last lines of .parity/${labels[0]}.build.log:\n${fs.readFileSync(log, "utf8").trim().split("\n").slice(-20).join("\n")}`); process.exit(1); }
  }
  if (flags.ref) {
    const exec = (command, args, options) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32", ...options });
    try { ({ dir: root, ...baseline } = buildRef(flags.ref, { root: ROOT, exec, exists: fs.existsSync, rm: (p) => fs.rmSync(p, { recursive: true, force: true }), log: (line) => console.error(line) })); baseline.ref = flags.ref; } catch (error) { console.error(`visual-parity capture: ${error.message}`); process.exit(2); }
  }
  // The local build is photographed from a copy, so the tree is free while the capture runs; a --ref worktree and a served site are already apart from it.
  const snapshotDir = path.join(ROOT, SNAPSHOTS, labels[0]);
  fs.rmSync(snapshotDir, { recursive: true, force: true }); // a copy a capture that died left behind
  let tree;
  if (!flags.url && !flags.ref) {
    let snapshot;
    try { snapshot = snapshotBuild(ROOT, snapshotDir); } catch (error) { console.error(`visual-parity capture: ${error.message}`); process.exit(2); }
    tree = treeState(ROOT, (command, args, options) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], ...options }));
    root = snapshotDir;
    const of = tree ? `HEAD ${tree.head.slice(0, 7)}${tree.dirty ? ", modified" : ""}` : "not a git checkout";
    say(`snapshot: ${snapshot.files} files, ${(snapshot.bytes / 1048576).toFixed(1)} MB of the build (${of}) — building or editing from here on does not change this capture\n`);
  }
  const server = flags.url ? null : await serveStatic({ root });
  try { await capture(labels[0], flags.url || server.url, { root, baseline, tree }); } finally { server?.close(); fs.rmSync(snapshotDir, { recursive: true, force: true }); }
} else {
  await compare(labels[0], labels[1]);
}
