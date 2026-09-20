#!/usr/bin/env node
// The content lint, the first step of `pnpm build` (`pnpm content:lint` alone,
// in about a second): every collection read as the build reads it, then the
// rules a schema cannot carry — the voice and claim block of
// content/VOICE.md, the SEO limits at the source, the post bodies' structure,
// the images on disk, the dates that are not days (scripts/lib/content-lint.mjs
// has the rule table).
//
//   node scripts/content-lint.mjs                 (pnpm content:lint)
//   node scripts/content-lint.mjs --root <dir>    another tree: <dir>/content and <dir>/public
//   node scripts/content-lint.mjs --strict        every WARN counts as a FAIL
//   node scripts/content-lint.mjs --report        also writes .parity/content-lint-report.txt
//
// Prints one row per collection, then one line per finding in the SEO
// audit's grammar (`LEVEL file rule: path problem`), then the summary; exits
// 1 when anything FAILs. A FAIL stops the build; a WARN is read and either
// fixed or explained. The engine is TypeScript under src/, loaded through
// scripts/lib/load-ts.mjs; the hook must be registered before the library is
// imported, hence the dynamic import.
import "./lib/load-ts.mjs";
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS.lint, process.argv.slice(2));
const root = flags.root ? path.resolve(flags.root) : process.cwd();
const { strict, report } = flags;

const { format, lint } = await import("./lib/content-lint.mjs");
const { kit } = await import("@/kit");

console.log(`content-lint: root ${path.join(root, "content")}`);
const result = lint({ root, collections: kit.collections, site: kit.site });
for (const row of result.collections) console.log(`${row.name}: ${row.entries} entries (${row.source})`);
const findings = result.findings.map((finding) => (strict && finding.level === "WARN" ? { ...finding, level: "FAIL" } : finding));
const lines = findings.map(format);
for (const line of lines) (line.startsWith("FAIL") ? console.error : console.log)(line);
const fails = findings.filter((finding) => finding.level === "FAIL").length;
const warns = findings.length - fails;
const s = (n) => (n === 1 ? "" : "s");
const summary = `content-lint: ${result.collections.length} collections, ${result.collections.reduce((n, row) => n + row.entries, 0)} entries, ${fails} failure${s(fails)}, ${warns} warning${s(warns)}${strict ? " (strict)" : ""}`;
console.log(summary);
if (report) {
  fs.mkdirSync(path.join(root, ".parity"), { recursive: true });
  fs.writeFileSync(path.join(root, ".parity/content-lint-report.txt"), [...lines, summary, ""].join("\n"));
}
process.exit(fails ? 1 : 0);
