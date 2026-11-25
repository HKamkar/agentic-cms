#!/usr/bin/env node
// Holds the page of a motion story to its budget: opens the built page (or a
// served one) in Chromium and WebKit, measures it through the hook the story
// carries, and fails on the rules of docs/motion-story.md § The check. Nothing
// here says how it looks (the sheets are for that: --out) or how fast it runs
// on a device: those are the owner's eyes and the owner's devices.
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { resolveTarget, routeName, serveFolder, serveStatic } from "./lib/browser.mjs";
import { SPECS } from "./lib/specs.mjs";
import { judge, LIMITS, rulesFor } from "./lib/story-rules.mjs";
import { measure, NoStory, sheet } from "./lib/story-run.mjs";

const { positionals: [target], flags } = parseOrExit(SPECS.story, process.argv.slice(2));
const engines = flags.engines === "chromium" ? ["chromium"] : ["chromium", "webkit"];
const usage = (message) => { console.error(`story: ${message}`); process.exit(2); };

function wanted() {
  try { return rulesFor((flags.only ?? "").split(",").map((name) => name.trim()).filter(Boolean), engines); } catch (error) { return usage(error.message); }
}

const standalone = target.endsWith(".html") && fs.existsSync(target) ? path.resolve(target) : null;

async function serve() {
  if (standalone) { const folder = await serveFolder(path.dirname(standalone)); return { base: folder.url, close: folder.close }; }
  if (flags.url || /^https?:\/\//.test(target)) return { base: flags.url, close: () => {} };
  try { const server = await serveStatic({ root: process.cwd() }); return { base: server.url, close: server.close }; } catch (error) { return usage(error.message); }
}

async function writeSheets(frames, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const engine of engines) { const file = path.join(dir, `${standalone ? path.basename(standalone, ".html") : routeName(target)}-${engine}.png`); await sheet(frames.filter((frame) => frame.engine === engine), file); files.push(path.relative(process.cwd(), file)); }
  return files;
}

/** What --json prints of the measures: numbers, never pictures or words. */
function summary(measured) {
  const numbers = ["firstPicture", "midScroll", "setup", "pixels", "shift", "stops", "lost", "cards"].filter((key) => key in measured).map((key) => [key, measured[key]]);
  const frames = measured.frames ? { frames: measured.frames.map(({ engine, at, spread }) => ({ engine, at, spread })), engines: measured.pairs } : {};
  return { ...Object.fromEntries(numbers), ...frames };
}

const rules = wanted(), server = await serve();
const url = resolveTarget(standalone ? `/${path.basename(standalone)}` : target, { base: server.base });
const { said, measured } = await measure({ url, engines, rules, wait: flags.wait, blocked: LIMITS.blocked, say: (line) => console.error(`story: ${line}`) })
  .then((m) => ({ said: judge(rules, m), measured: m }), (error) => { if (error instanceof NoStory) return { said: [{ rule: "hook", problem: error.message }], measured: {} }; throw error; })
  .finally(server.close);
const sheets = flags.out && measured.frames ? await writeSheets(measured.frames, path.resolve(flags.out)) : [];
const broken = said.filter(({ problem }) => problem).length;

if (flags.json) console.log(JSON.stringify({ url, engines, scenes: measured.hook?.scenes ?? [], rules: said.map(({ rule, problem }) => ({ rule, ok: !problem, problem })), measured: summary(measured), sheets }, null, 1));
else {
  for (const { rule, problem } of said) console.log(problem ? `FAIL ${rule}: ${problem}` : `ok   ${rule}`);
  for (const file of sheets) console.log(`look at ${file}`);
  console.log(broken ? `story: ${broken} of ${said.length} rules broken` : `story: ${said.length} rules held in ${engines.join(" and ")}`);
}
process.exit(broken ? 1 : 0);
