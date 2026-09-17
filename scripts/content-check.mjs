#!/usr/bin/env node
// Reads every collection of the site's registry (src/kit.ts) and reports
// what it found, the way pnpm build would fail on it — in a fraction of a second:
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

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
if (rootIndex !== -1) process.chdir(args[rootIndex + 1]);

const { ContentError, contentRoot, readCollection } = await import("../src/lib/content/index.ts");
const { sourceOf } = await import("../src/lib/content/read.ts");
const { kit } = await import("@/kit");
const { collections } = kit;

console.log(`content-check: root ${contentRoot()}`);
let entries = 0;
let problems = 0;
for (const def of Object.values(collections)) {
  try {
    const found = readCollection(def);
    entries += found.length;
    console.log(`${def.name}: ${found.length} entries (${sourceOf(def)})`);
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    problems += 1;
    console.error(error.message);
  }
}
const count = Object.keys(collections).length;
console.log(problems ? `content-check: ${problems} problem(s)` : `content-check: ${count} collections, ${entries} entries, 0 problems`);
process.exit(problems ? 1 : 0);
