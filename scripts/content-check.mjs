#!/usr/bin/env node
// Reads every collection of the site's registry (src/kit.ts), and in a site
// in several languages each translation on disk and where each language's
// page files sit (docs/locales.md), and reports what it found, the way
// pnpm build would fail on it — in a fraction of a second:
//
//   node scripts/content-check.mjs                 (pnpm content:check)
//   node scripts/content-check.mjs --root <dir>    another tree: <dir>/content is read instead of ./content
//
// Prints one row per collection and a summary line; exits 1 when any
// collection has a problem, printing the ContentError's lines (one per
// issue, each starting with the file). The engine is TypeScript under src/,
// loaded through scripts/lib/load-ts.mjs; the hook must be registered before
// the engine is imported, hence the dynamic import.
import "./lib/load-ts.mjs";
import { parseOrExit } from "./lib/args.mjs";
import { SPECS } from "./lib/specs.mjs";
import { translations } from "./lib/translations.mjs";

const { flags } = parseOrExit(SPECS.check, process.argv.slice(2));
if (flags.root) process.chdir(flags.root);

const { ContentError, contentRoot, readCollection, sourceOf } = await import("agentic-cms/content");
const { checkPagePaths } = await import("agentic-cms/locales");
const { kit } = await import("@/kit");
const { collections, locales } = kit;

console.log(`content-check: root ${contentRoot()}`);
let entries = 0;
let problems = 0;
/** Runs a read, counting its ContentError as a problem; returns what it read, or null. */
const attempt = (read) => {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    problems += 1;
    console.error(error.message);
    return null;
  }
};
const read = [...Object.values(collections), ...translations({ collections, locales }).map(({ def }) => def)];
const pages = new Map();
for (const def of read) {
  const found = attempt(() => readCollection(def));
  if (!found) continue;
  entries += found.length;
  if (def === collections.pages || def.dir?.startsWith(`${collections.pages.dir}/`)) pages.set(def, found);
  console.log(`${def.name}: ${found.length} entries (${sourceOf(def)})`);
}
// Where each language's page files sit: the engine's own check, which createKit()'s accessors run in the build.
const defaults = pages.get(collections.pages);
for (const locale of locales.all.length > 1 && defaults ? locales.all : []) {
  const own = pages.get(locales.collection(collections.pages, locale.locale));
  if (own) attempt(() => checkPagePaths(locales, locale.locale, own, () => defaults));
}
const count = read.length;
console.log(problems ? `content-check: ${problems} problem(s)` : `content-check: ${count} collections, ${entries} entries, 0 problems`);
process.exit(problems ? 1 : 0);
