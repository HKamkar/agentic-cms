#!/usr/bin/env node
// The numbers behind a screenshot claim ("unaligned", "too early", "looks
// broken"), so the diagnosis is measured before anything is edited: for the
// element (or every match), its box on the viewport and on the page, the
// computed styles that decide layout and paint, the chain of stacking
// contexts above it with the property that creates each, and — with --motion
// and --timeline — how its opacity, transform and position move after it
// enters the viewport. Always with it: the reveals still pending on the page
// and the console's errors. JSON only; docs/shot-probe-sheet.md has the
// recipes.
import { parseOrExit } from "./lib/args.mjs";
import { FX_START_STATE, STACKING } from "./lib/browser.mjs";
import { openTarget, requireMatch, targetOf } from "./lib/page-command.mjs";
import { SPECS } from "./lib/specs.mjs";

const DEFAULT_PROPS = ["opacity", "transform", "position", "z-index", "display", "visibility", "overflow", "color", "background-color", "font-size", "line-height", "width", "height", "margin", "padding"];

const { positionals: [target], flags } = parseOrExit(SPECS.probe, process.argv.slice(2));
if (!flags.select && !flags.heading) { console.error("probe: name the element with --select <css> or --heading <regex>; run agentic-cms probe --help"); process.exit(2); }
if (flags.timeline && !flags.motion) { console.error("probe: --timeline samples a playing animation; add --motion"); process.exit(2); }
const props = [...DEFAULT_PROPS, ...(flags.props ?? "").split(",").map((p) => p.trim()).filter(Boolean)];

const { url, route, page, locator, consoleLines, close } = await openTarget(target, flags, { command: "probe" });
try {
  const count = await requireMatch(locator, flags, route);
  const indexes = flags.all ? [...Array(count).keys()] : [flags.index];
  const elements = [];
  for (const index of indexes) {
    const el = locator.nth(index);
    const measured = await el.evaluate((node, { props, stacking }) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      return { tag: node.tagName.toLowerCase(), id: node.id || null, classes: [...node.classList], box, pageBox: { ...box, x: box.x + window.scrollX, y: box.y + window.scrollY }, computed: Object.fromEntries(props.map((p) => [p, style.getPropertyValue(p)])), stacking: new Function("el", `return (${stacking})(el)`)(node) };
    }, { props, stacking: STACKING.toString() });
    const entry = { ...targetOf(flags), index, ...measured, box: round(measured.box), pageBox: round(measured.pageBox) };
    if (flags.timeline) {
      await el.scrollIntoViewIfNeeded();
      const t0 = Date.now();
      const samples = [];
      while (Date.now() - t0 <= flags.timeline) {
        samples.push(await el.evaluate((node, t) => { const s = getComputedStyle(node); return { t, opacity: s.opacity, transform: s.transform, top: Math.round(node.getBoundingClientRect().top * 100) / 100 }; }, Date.now() - t0));
        await page.waitForTimeout(flags.every);
      }
      entry.timeline = samples;
    }
    elements.push(entry);
  }
  const reveals = await page.evaluate((pattern) => {
    const all = [...document.querySelectorAll('[class*="ix-init--"], [class*="ix-main-init--"]')].filter((el) => new RegExp(pattern).test(el.getAttribute("class") ?? ""));
    const pending = all.filter((el) => getComputedStyle(el).opacity !== "1").map((el) => ({ tag: el.tagName.toLowerCase(), id: el.id || null, classes: [...el.classList], pageTop: Math.round(el.getBoundingClientRect().top + window.scrollY), opacity: getComputedStyle(el).opacity }));
    return { total: all.length, pending };
  }, FX_START_STATE.source);
  const [scrollY, scrollHeight] = await page.evaluate(() => [window.scrollY, document.documentElement.scrollHeight]);
  console.log(JSON.stringify({ url, route, width: flags.width, height: flags.height, scheme: flags.scheme, motion: Boolean(flags.motion), scrollY, scrollHeight, elements, reveals, console: consoleLines() }, null, 1));
} finally { await close(); }

function round(box) { return Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v * 100) / 100])); }
