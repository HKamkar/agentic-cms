#!/usr/bin/env node
// One screenshot, the way an agent needs it to judge a section or an
// element: the page prepared like the harness prepares one (fonts, every
// reveal at its end state, the page scrolled through once — or, with
// --motion, the animations left to play), the target found by selector or by
// the heading of its section, its box measured, and the picture cropped,
// isolated on a transparent ground, trimmed and resized as asked. --json
// prints the numbers; docs/shot-probe-sheet.md has the recipes.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseOrExit } from "./lib/args.mjs";
import { ISOLATE } from "./lib/browser.mjs";
import { openTarget, relative, requireMatch, routeName, slug, targetOf } from "./lib/page-command.mjs";
import { SPECS } from "./lib/specs.mjs";

const { positionals: [target], flags } = parseOrExit(SPECS.shot, process.argv.slice(2));
if (flags.out && !/\.(png|webp)$/i.test(flags.out)) { console.error(`shot: --out takes a .png or .webp file, not ${flags.out}`); process.exit(2); }
const say = (line) => (flags.json ? console.error(line) : console.log(line));

const { root, url, route, page, locator, consoleLines, close } = await openTarget(target, flags, { command: "shot" });
try {
  const about = targetOf(flags);
  let element = null;
  let clip;
  if (locator) {
    await requireMatch(locator, flags, route);
    const el = locator.nth(flags.index);
    const box = await el.boundingBox();
    const scrollY = await page.evaluate(() => window.scrollY);
    const info = await el.evaluate((node) => ({ tag: node.tagName.toLowerCase(), id: node.id || null }));
    element = { ...about, index: flags.index, ...info, box: round(box), pageBox: round({ ...box, y: box.y + scrollY }) };
    clip = { x: Math.max(0, box.x - flags.pad), y: Math.max(0, box.y + scrollY - flags.pad), width: box.width + 2 * flags.pad, height: box.height + 2 * flags.pad };
    if (flags.transparent) await el.evaluate(ISOLATE);
  }
  const scrollY = await page.evaluate(() => window.scrollY);
  const outFile = path.resolve(root, flags.out ?? path.join(".parity/shots", `${routeName(target)}@${flags.width}${about ? `--${element.id || slug(about.value)}` : ""}.png`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  let image = sharp(await page.screenshot({ fullPage: true, clip, omitBackground: Boolean(flags.transparent), type: "png" }));
  if (flags.trim) image = image.trim({ threshold: 8 });
  if (flags.resize) image = image.resize({ width: flags.resize });
  image = outFile.toLowerCase().endsWith(".webp") ? image.webp({ quality: 82, alphaQuality: 90 }) : image.png();
  const { width, height } = await image.toFile(outFile);
  const out = relative(root, outFile);
  say(`${out}  ${width}x${height}${element ? `  ${element.tag}${element.id ? `#${element.id}` : ""} at ${element.pageBox.x},${element.pageBox.y} ${element.pageBox.width}x${element.pageBox.height}` : ""}`);
  if (flags.json) console.log(JSON.stringify({ url, route, width: flags.width, height: flags.height, scale: flags.scale, scheme: flags.scheme, motion: Boolean(flags.motion), scrollY, target: element, out, image: { width, height, transparent: Boolean(flags.transparent), trimmed: Boolean(flags.trim), resized: flags.resize || null }, console: consoleLines() }, null, 1));
} finally { await close(); }

function round(box) { return Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v * 100) / 100])); }
