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
import os from "node:os";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { FREEZE_CSS, HOLD_SMIL, NO_ANCHORING_CSS, PAUSE_LOOPS, SECTIONS, SMIL_INVENTORY, Stall, UNLOADED_IMAGES, addStyle, capturePages, fontsReady, imagesReady, isLoop, launch, listPages, onceMore, revealed, routeName, sampleRoutes, servedFile, serveStatic, settle, snap, templatesOf, withPage } from "./lib/browser.mjs";
import { causeLine, compareCapture } from "./lib/compare-images.mjs";
import { buildRef } from "./lib/ref-build.mjs";
import { planClean, readEntries, removeEntries } from "./lib/parity-clean.mjs";
import { captureWidths, menuWidths, opensMenu, profileOrExit, proofSettings, schemeOf } from "./lib/profile.mjs";
import { forwarded, passesOf, plan, runProof } from "./lib/proof.mjs";
import { inPool } from "./lib/pool.mjs";
import { createShotCache, harnessDigest, noShotCache, shotKey } from "./lib/shot-cache.mjs";
import { SNAPSHOTS, buildId, snapshotBuild, treeState } from "./lib/snapshot.mjs";
import { SPECS } from "./lib/specs.mjs";
import { statesFor } from "./lib/states.mjs";
import { SITE_SEED, sameSeed, seedLine, seedOrExit, seedRecord } from "./lib/storage-seed.mjs";

const { subcommand, positionals: labels, flags } = parseOrExit(SPECS["visual-parity"], process.argv.slice(2));

// The site's config and page files are needed by --states alone (the labels
// and pages the states look for); a static or motion capture reads the build.
const loadKit = async () => (await import("@/kit")).kit;
const ROOT = process.cwd();
const OUT = path.join(ROOT, ".parity/visual");
// The site's profile (src/config/harness.ts, lib/profile.mjs): its widths, schemes and proof settings are the
// defaults a flag overrides for one run; read from the tree, so a --ref baseline is captured like the tree.
const profile = subcommand === "capture" || subcommand === "proof" ? await profileOrExit(`visual-parity ${subcommand}`) : null;

const motion = Boolean(flags.motion);
// The theme follows prefers-color-scheme (and a stored choice, absent in a fresh browser context), so a scheme is a capture option.
const scheme = schemeOf(flags.scheme, profile);
const states = Boolean(flags.states);
if (subcommand === "capture" && motion && states) { console.error("visual-parity capture: --motion and --states are two captures, not one"); process.exit(2); }
const MOTION_FRAMES_MS = [150, 500];
const widths = captureWidths({ flag: flags.widths, motion, profile });
// The home page's menu is opened at these widths wherever its button shows: the site's own widths below its menu breakpoint.
const MENU_WIDTHS = menuWidths(profile);
const menuAt = (pagePath, width) => opensMenu({ pagePath, width, menuWidths: MENU_WIDTHS, motion, states });
const MENU_BUTTON = ".w-nav-button, [aria-controls='w-nav-overlay-0'], header button[aria-expanded]";
const threshold = flags.threshold ?? 0.02;
const thresholdMid = flags["threshold-mid"] ?? 20;
const onlyPages = (flags.pages ?? "").split(",").filter(Boolean);
// Browsers at work at once, each with its own page-widths. A static or --states shot shares nothing with the
// next but the build, so every core but one works (four at most: past that the renderers compete for the same
// cores); --motion frames are timed in milliseconds, and two browsers keep a loaded machine from moving them.
const JOBS = flags.jobs ?? Math.max(1, Math.min(motion ? 2 : 4, os.availableParallelism() - 1));
if (!Number.isInteger(JOBS) || JOBS < 1) { console.error("visual-parity capture: --jobs takes a whole number of browsers, 1 or more"); process.exit(2); }
if (subcommand === "capture" && flags.sample !== undefined) {
  if (!Number.isInteger(flags.sample) || flags.sample < 1) { console.error("visual-parity capture: --sample takes a whole number of pages per template, 1 or more"); process.exit(2); }
  if (motion || states || onlyPages.length) { console.error("visual-parity capture: --sample is for a static capture of the build's pages (--motion already takes one post; --pages names its own)"); process.exit(2); }
}
const settleMs = flags.settle ?? 2000;
if (subcommand === "capture" && flags.settle !== undefined && flags.settle !== 2000 && !motion) { console.error("visual-parity capture: --settle is for the settled frame of a --motion capture"); process.exit(2); }
// A proof passes --ref to its baseline and --build to its first after capture, never both to one capture (lib/proof.mjs).
if (subcommand === "capture" && [flags.url, flags.build, flags.ref].filter(Boolean).length > 1) { console.error("visual-parity capture: --url, --build and --ref are three sources of one build; pass one"); process.exit(2); }
// The proof refuses it under its own name before any capture starts, not as a failed baseline step.
if (subcommand === "proof" && flags.sample !== undefined && onlyPages.length) { console.error("visual-parity proof: --pages and --sample both choose the pages of a capture; pass one"); process.exit(2); }
// Other origins' scripts and connections are held back from a build the harness serves (HOLD_THIRD_PARTY);
// a --url site is served by its own server and captured as it serves itself.
const THIRD_PARTY = flags["third-party"] ?? "hold";
// The visitor's choice every page of a capture starts from (lib/storage-seed.mjs): resolved once, here in the
// tree, so a --ref baseline built elsewhere is seeded like the tree and every page sees one {now}.
const seed = subcommand === "capture" ? await seedOrExit(flags, "visual-parity capture") : null;
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
// screenshots happen to agree. An infinite loop is left out: how often a page
// starts or restarts one (an observer, a timer) depends on timing, so the
// count would, and its frames are held at its first anyway (PAUSE_LOOPS). The
// effect's own timing in the page says which is a loop, as PAUSE_LOOPS reads
// it; the protocol's report (isLoop) when the page no longer holds the
// animation. The inline SMIL loops, which the browser does not report as
// animations and whose list is the page's markup, join them from
// SMIL_INVENTORY.
const byPlace = (a, b) => (a.target?.top ?? 0) - (b.target?.top ?? 0) || JSON.stringify(a).localeCompare(JSON.stringify(b));
async function recordAnimations(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("DOM.getDocument", { depth: 0 });
  await cdp.send("Animation.enable");
  const seen = new Set();
  const records = [];
  const loops = async (animation) => {
    try {
      const { remoteObject } = await cdp.send("Animation.resolveAnimation", { animationId: animation.id });
      const { result } = await cdp.send("Runtime.callFunctionOn", { objectId: remoteObject.objectId, returnByValue: true, functionDeclaration: "function () { return this.effect?.getTiming().iterations === Infinity; }" });
      if (typeof result.value === "boolean") return result.value;
    } catch { /* gone from the page: the protocol's report decides */ }
    return isLoop(animation.source?.iterations);
  };
  cdp.on("Animation.animationStarted", async ({ animation }) => {
    if (seen.has(animation.id)) return;
    seen.add(animation.id);
    if (await loops(animation)) return;
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
    return records;
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
      await snap(page, path.join(dir, `${name}--s${String(i).padStart(2, "0")}-${tag}.png`));
      count++;
    }
    steps.push({ step: i, y, waited: settled, declared });
  }
  const animations = [...await finishRecording(), ...await page.evaluate(SMIL_INVENTORY)].sort(byPlace);
  fs.writeFileSync(path.join(dir, `${name}.animations.json`), JSON.stringify(animations, null, 1));
  fs.writeFileSync(path.join(dir, `${name}.settle.json`), JSON.stringify(steps, null, 1));
  return count;
}

/** How long each page-width (or state) took, for capture.json: where a run's time went. */
const timings = [];
const timed = async (name, fn) => { const start = Date.now(); try { return await fn(); } finally { timings.push([name, Date.now() - start]); } };
/** The timings in brief: how many, their total and mean in seconds, and the five slowest. */
function timingSummary() {
  const total = timings.reduce((sum, [, ms]) => sum + ms, 0);
  const s = (ms) => Math.round(ms / 100) / 10;
  return { taken: timings.length, seconds: s(total), mean: timings.length ? s(total / timings.length) : 0, slowest: [...timings].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, ms]) => ({ name, seconds: s(ms) })) };
}

// How long a state's target may take to show once the page is ready: the FAQ's toggle gets its aria-expanded when the
// page hydrates. A target that never shows is skipped and recorded, where the state used to time out twice (30 s, a
// reload, 30 s) and end the whole run.
const TARGET_MS = 10000;
const skippedStates = [];

async function captureStates(open, baseUrl, dir, { root, kit, shots }) {
  let count = 0;
  const all = statesFor(kit, listPages(root));
  await inPool(all, { slots: JOBS, open, work: async (state, { context }) => {
    const name = `${routeName(state.page)}@${state.width}--state-${state.name}`;
    const shot = await shots.take(name, dir, (watch, discard) => timed(name, () => onceMore(name, () => withPage(context, state.width, baseUrl + state.page, async (page) => {
      await addStyle(page, FREEZE_CSS);
      await fontsReady(page);
      await revealed(page);
      await settle(page);
      await page.evaluate(HOLD_SMIL, { rest: true });
      const el = state.target(page);
      if (!(await el.first().waitFor({ state: "visible", timeout: TARGET_MS }).then(() => true, () => false))) { discard(); return 0; }
      const target = await state.act(page, el);
      await page.waitForTimeout(800);
      const box = await target.boundingBox();
      const scrollY = await page.evaluate(() => window.scrollY);
      const pad = 24;
      await snap(page, path.join(dir, `${name}.png`), { fullPage: true, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y + scrollY - pad), width: box.width + 2 * pad, height: box.height + 2 * pad } });
      return 1;
    }, { before: watch }))));
    if (shot) { count++; say(`${state.name} `); return; }
    skippedStates.push({ state: state.name, page: state.page, file: `${name}.png`, reason: "no target" });
    say(`${state.name} (skipped: no target) `);
  } });
  return count;
}

/**
 * A page-width's shots: a --motion page's frames and inventories, or the static full page, its section geometry and
 * (the home page at a menu width where its button shows) the open menu; the number of PNGs. A static page with an
 * image that shows and has not arrived is loaded again (a Stall, which onceMore answers with one reload); on the
 * `last` try it is photographed, the images listed in <name>.unloaded.json, and the shot kept out of the cache.
 */
async function shootPage(page, { dir, name, pagePath, width, last = false, discard = () => {} }) {
  await fontsReady(page);
  await addStyle(page, NO_ANCHORING_CSS);
  if (motion) {
    await imagesReady(page);
    await page.waitForTimeout(600);
    await page.evaluate(PAUSE_LOOPS);
    return captureMotion(page, dir, name);
  }
  await addStyle(page, FREEZE_CSS);
  await revealed(page);
  await settle(page);
  await page.evaluate(HOLD_SMIL, { rest: true });
  const unloaded = await page.evaluate(UNLOADED_IMAGES);
  if (unloaded.length && !last) throw new Stall(`${unloaded.length} image(s) not loaded on ${page.url()}, the first ${unloaded[0].src} at y=${unloaded[0].top}`);
  await snap(page, path.join(dir, `${name}.png`), { fullPage: true });
  fs.writeFileSync(path.join(dir, `${name}.sections.json`), JSON.stringify(await page.evaluate(SECTIONS)));
  if (unloaded.length) {
    fs.writeFileSync(path.join(dir, `${name}.unloaded.json`), JSON.stringify(unloaded));
    discard();
    say(`(${name}: ${unloaded.length} image(s) still loading after a reload; recorded as flaky) `);
  }
  if (!menuAt(pagePath, width)) return 1;
  const menu = page.locator(MENU_BUTTON).first();
  if (!(await menu.isVisible())) return 1;
  await menu.click();
  await page.waitForTimeout(600);
  await snap(page, path.join(dir, `${name}--menu.png`));
  return 2;
}

// What decides a shot besides the page's own files: the harness's sources (this file, the browser library, the
// seed and the states), the browser's version and the capture's settings — the seed's templates among them, never the time
// {now} became — for --states also the site's config, whose labels the states look for; and, for the page-widths
// that open the home page's menu alone, that they do (shotKey). A served --url site has no files of ours to digest, so nothing is reused there.
const HARNESS_SOURCES = [import.meta.filename, ...["browser", "storage-seed", "states"].map((lib) => path.join(import.meta.dirname, `lib/${lib}.mjs`))];
function shotCacheFor({ browser, root, baseUrl, build, kit }) {
  if (flags.url) return noShotCache();
  const settings = { scheme, motion, states, ...(motion ? { settle: settleMs, frames: MOTION_FRAMES_MS } : {}), thirdParty: THIRD_PARTY, ...(seed ? { seed: seed.templates } : {}), ...(states ? { site: kit.site } : {}) };
  const base = { harness: harnessDigest(HARNESS_SOURCES), browser: browser.version(), settings };
  return createShotCache({ root: ROOT, key: (shot) => shotKey(base, shot), resolve: (served) => servedFile(root, served), buildId: build, origin: baseUrl, fresh: flags.fresh });
}
const reusedNote = (counts, what) => (counts?.reused ? ` (${counts.reused} of ${counts.reused + counts.taken} ${what} reused from .parity/shot-cache: every build file they load is unchanged)` : "");

/** The routes a capture photographs, and those --sample leaves out of it. */
function pagesOf(root) {
  if (states) return { pages: [], skipped: [] };
  if (onlyPages.length) return { pages: onlyPages, skipped: [] };
  if (motion) return { pages: motionPages(root), skipped: [] };
  const all = capturePages(listPages(root));
  return flags.sample ? sampleRoutes(all, templatesOf(root), flags.sample) : { pages: all, skipped: [] };
}

async function capture(label, baseUrl, { root = ROOT, baseline = null, tree, build = null } = {}) {
  const started = Date.now();
  const dir = path.join(OUT, label);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const { pages, skipped } = pagesOf(root);
  const meta = { scheme, motion, states, ...(motion ? { settle: settleMs, frames: [...MOTION_FRAMES_MS, "settled"] } : {}), ...(baseline ? { ref: baseline.ref, sha: baseline.sha, ...(baseline.demos?.length ? { demosRemoved: baseline.demos } : {}) } : {}), ...(tree !== undefined ? { tree } : {}), ...(flags.sample ? { sample: { n: flags.sample, skipped } } : {}), ...(flags.url ? {} : { thirdParty: THIRD_PARTY }), ...(seed ? { seed: seedRecord(seed) } : {}) };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta));
  if (seed) say(`seed: ${seedLine(seed.templates)}\n`);
  if (skipped.length) say(`sample: the first ${flags.sample} of each template's pages; ${skipped.length} left out (${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? ", …" : ""})\n`);
  const kit = states ? await loadKit() : null;
  // the first browser names the version the cache is keyed on and is the pool's first worker; the others are launched as the pool needs them
  const first = await launch({ scheme, motion, seed });
  const shots = shotCacheFor({ browser: first.browser, root, baseUrl, build, kit });
  let firstUsed = false;
  const open = (index) => (index === 0 ? ((firstUsed = true), first) : launch({ scheme, motion, seed }));
  let count = 0;
  const finish = () => {
    const files = fs.readdirSync(dir).filter((f) => f !== "meta.json").sort();
    const reused = shots.counts ? { shots: shots.counts.reused, of: shots.counts.reused + shots.counts.taken } : null;
    const summary = { label, dir: `.parity/visual/${label}`, pages: states ? null : pages, widths: states ? null : widths, files: files.length, seconds: Math.round((Date.now() - started) / 100) / 10, jobs: JOBS, reused, timings: timingSummary(), ...(states ? { skipped: skippedStates } : {}), meta };
    // written last: its presence is the sign that the capture finished (the directory is wiped at the start)
    fs.writeFileSync(path.join(dir, "capture.json"), JSON.stringify(summary, null, 1));
    if (flags.json) console.log(JSON.stringify(summary, null, 1));
    return summary;
  };
  if (states) {
    count = await captureStates(open, baseUrl, dir, { root, kit, shots });
    if (!firstUsed) await first.close();
    say(`\n${label}: ${count} state screenshots in .parity/visual/${label}${reusedNote(shots.counts, "states")}\n`);
    finish();
    return;
  }
  const tasks = pages.flatMap((pagePath) => widths.map((width) => ({ pagePath, width, name: `${routeName(pagePath)}@${width}` })));
  const left = new Map(pages.map((pagePath) => [pagePath, widths.length]));
  await inPool(tasks, { slots: JOBS, open, work: async ({ pagePath, width, name }, { context }) => {
    // taken before it is added: `count += await …` reads count first, and two workers would lose each other's shots
    let tries = 0;
    const taken = await shots.take(name, dir, (watch, discard) => timed(name, () => onceMore(name, () => { const last = tries++ > 0; return withPage(context, width, baseUrl + pagePath, (page) => shootPage(page, { dir, name, pagePath, width, last, discard }), { before: watch }); })), { menu: menuAt(pagePath, width) });
    count += taken;
    left.set(pagePath, left.get(pagePath) - 1);
    if (!left.get(pagePath)) say(`${pagePath} `);
  } });
  if (!firstUsed) await first.close();
  say(`\n${label}: ${count} screenshots in .parity/visual/${label}${reusedNote(shots.counts, "page-widths")}\n`);
  finish();
}

// ---- compare ---------------------------------------------------------------
async function compare(before, after) {
  const a = path.join(OUT, before), b = path.join(OUT, after), diffDir = path.join(OUT, `${before}-vs-${after}`);
  for (const [label, dir] of [[before, a], [after, b]]) if (!fs.existsSync(dir)) { console.error(`visual-parity compare: no capture ${label} under .parity/visual/ — run agentic-cms visual-parity capture ${label} first`); process.exit(2); }
  const meta = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")); } catch { return {}; } };
  if (meta(a).scheme !== meta(b).scheme) { console.error(`${before} was captured with --scheme ${meta(a).scheme ?? "?"} and ${after} with --scheme ${meta(b).scheme ?? "?"}: compare captures of one scheme`); process.exit(2); }
  // Two seeds are two visits: what differs may be the seed's doing, so they are compared only when asked.
  const seeds = [meta(a).seed, meta(b).seed];
  const alike = sameSeed(...seeds);
  if (!alike && !flags["mixed-seed"]) { console.error(`${before} was seeded with ${seedLine(seeds[0])} and ${after} with ${seedLine(seeds[1])}: compare captures seeded alike — recapture ${before} with the same seed (the site's ${SITE_SEED} and the same --storage flags), or pass --mixed-seed to see what the seed itself changes`); process.exit(2); }
  const report = await compareCapture(a, b, { before, after, diffDir, threshold, thresholdMid, pages: onlyPages });
  const out = flags.json ? console.error : console.log;
  if (report.baseline) out(`baseline: ${report.baseline.ref ?? ""} ${report.baseline.sha ?? ""}`.trim());
  if (!alike) out(`seed: ${before} ${seedLine(seeds[0])}; ${after} ${seedLine(seeds[1])} (--mixed-seed: a difference may be the seed's)`);
  else if (seeds[1]) out(`seed: ${seedLine(seeds[1])}, on both`);
  if (report.sampledOut) out(`sampled: ${report.sampledOut.length} page(s) left out by --sample on one side or both, not judged`);
  // every line that is not ok has its cause under it: the section that moved, an image still loading, what a shot without geometry shows
  for (const file of report.files) { out(file.line); if (file.cause) out(`         ${causeLine(file.cause)}`); }
  const lacking = [[before, report.geometry.before], [after, report.geometry.after]].filter(([, has]) => !has).map(([label]) => label);
  if (lacking.length && report.files.some((f) => f.cause?.kind === "geometry")) out(`\nno section geometry in ${lacking.join(" and ")}: recapture ${lacking.length > 1 ? "them" : "it"} to have a shift's cause named`);
  if (report.summary.flaky) out(`\n${report.summary.flaky} shot(s) taken with an image still loading after a reload: retake those pages with --fresh before reading them as differences`);
  const failures = report.files.length - report.summary.ok;
  out(failures ? `\n${failures} file(s) differ; diffs in .parity/visual/${before}-vs-${after}` : "\nidentical within threshold");
  fs.writeFileSync(path.join(diffDir, "report.json"), JSON.stringify(report, null, 1));
  if (flags.json) console.log(JSON.stringify(report, null, 1));
  process.exit(report.summary.exit);
}

/** The old captures and their compares out of .parity/visual/, the shot cache with --cache; --dry-run lists them. */
function clean() {
  const keep = flags.keep ?? 10;
  if (!Number.isInteger(keep) || keep < 0) { console.error("visual-parity clean: --keep takes a whole number of captures, 0 or more"); process.exit(2); }
  const plan = planClean(readEntries(ROOT), { keep, all: flags.all });
  const dryRun = Boolean(flags["dry-run"]);
  for (const name of plan.remove) say(`${dryRun ? "would go" : "removed"}  ${name}\n`);
  const bytes = dryRun ? 0 : removeEntries(ROOT, plan.remove, { cache: flags.cache });
  const cache = Boolean(flags.cache) && !dryRun;
  if (flags.json) console.log(JSON.stringify({ removed: plan.remove, kept: plan.keep, bytes, cache, dryRun }, null, 1));
  else say(dryRun ? `clean --dry-run: ${plan.remove.length} would go, ${plan.keep.length} stay${flags.cache ? ", and .parity/shot-cache/" : ""}; nothing removed\n` : `clean: ${plan.remove.length} removed${cache ? " and the shot cache emptied" : ""}, ${(bytes / 1048576).toFixed(1)} MB freed; ${plan.keep.length} kept\n`);
}

/** A whole proof: for each pass, the baseline of --ref, the tree as it stands and the compare, as the harness's own commands; one summary, one exit. */
async function proof() {
  const label = labels[0] ?? "proof";
  // the seed's flags go to both sides of every pass, and each capture reads the site's src/config/harness.ts from this tree
  // a flag, then the site's profile, then the built-in default: the ref, a pass in each scheme, the pages or the sample
  const { ref, schemes, pages, sample } = proofSettings(flags, profile);
  const steps = plan({ label, ref, passes: passesOf(flags), schemes, build: flags.build, shared: forwarded(flags, ["jobs", "fresh", "third-party", "storage", "session-storage", "no-storage"]), pages: forwarded({ pages }, ["pages"]), widths: forwarded(flags, ["widths"]), sample: forwarded({ sample }, ["sample"]) });
  const bin = path.join(import.meta.dirname, "../bin/agentic-cms.mjs");
  // each step's progress and its compare lines go straight to the terminal; its --json result comes back here
  const run = (args) => spawnSync(process.execPath, [bin, "visual-parity", ...args], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
  const result = await runProof(steps, { run, log: (step) => console.error(`\nproof: ${step.pass} — ${step.step === "compare" ? "the compare" : `${step.step}: ${step.label}`}`) });
  if (flags.json) console.log(JSON.stringify({ label, ref, schemes, ...result }, null, 1));
  else printProof(label, ref, result);
  process.exitCode = result.exit;
}

/** The proof's summary: a line per pass (the compare's counts, each side's time and reuse), then the verdict. */
function printProof(label, ref, { passes, exit, failed }) {
  const side = (c) => (c ? `${c.label} ${c.seconds} s${c.reused?.shots ? `, ${c.reused.shots} of ${c.reused.of} reused` : ""}` : "—");
  console.log(`\nproof ${label} against ${ref}${passes[0]?.before?.meta?.sha ? ` (${passes[0].before.meta.sha.slice(0, 7)})` : ""}`);
  for (const p of passes) {
    const s = p.report?.summary;
    console.log(`  ${p.pass.padEnd(12)} ${s ? `${s.ok} ok, ${s.changed} changed, ${s.size} size, ${s.missing} missing${s.flaky ? `, ${s.flaky} flaky` : ""}` : "not compared"} — before ${side(p.before)}; after ${side(p.after)}`);
  }
  if (failed) console.log(`proof stopped: the ${failed.step === "compare" ? "compare" : `${failed.step} capture ${failed.label}`} failed (exit ${exit}); its output is above`);
  else console.log(exit ? `proof: a difference — the diffs are in .parity/visual/<before>-vs-<after>, the lines above` : "proof: identical within the thresholds, every pass");
}

if (subcommand === "clean") {
  clean();
} else if (subcommand === "proof") {
  await proof();
} else if (subcommand === "capture") {
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
  let tree, snapshotId;
  if (!flags.url && !flags.ref) {
    let snapshot;
    try { snapshot = snapshotBuild(ROOT, snapshotDir); } catch (error) { console.error(`visual-parity capture: ${error.message}`); process.exit(2); }
    tree = treeState(ROOT, (command, args, options) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], ...options }));
    root = snapshotDir;
    snapshotId = snapshot.buildId; // the id of the build that was copied: the checkout may be rebuilt while the capture runs
    const of = tree ? `HEAD ${tree.head.slice(0, 7)}${tree.dirty ? ", modified" : ""}` : "not a git checkout";
    say(`snapshot: ${snapshot.files} files, ${(snapshot.bytes / 1048576).toFixed(1)} MB of the build (${of}) — building or editing from here on does not change this capture\n`);
  }
  const server = flags.url ? null : await serveStatic({ root, thirdParty: THIRD_PARTY });
  try { await capture(labels[0], flags.url || server.url, { root, baseline, tree, build: snapshotId ?? buildId(root) }); } finally { server?.close(); fs.rmSync(snapshotDir, { recursive: true, force: true }); }
} else {
  await compare(labels[0], labels[1]);
}
