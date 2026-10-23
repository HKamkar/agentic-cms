#!/usr/bin/env node
// Packages a standalone build for a Node host and proves it complete:
// public/ and .next/static copied into .next/standalone — into its folders,
// never as them — then every file of both checked there. The documented
// place is the last step of a standalone site's `pnpm build`
// (docs/deploy.md); --check only checks, for CI or a package made by hand.
// What deploys holds no placeholder: while the starter's placeholder copy or
// address remains (lib/placeholders.mjs), nothing is packaged — unless this
// run's environment keeps placeholders warnings (AGENTIC_CMS_PLACEHOLDERS=warn,
// a CI build that deploys nothing).
import { parseOrExit } from "./lib/args.mjs";
import { checkPackage, complete, copyInto, hasPackage, STANDALONE } from "./lib/assemble.mjs";
import { PLACEHOLDERS_ENV, placeholderLines, placeholdersAllowed } from "./lib/placeholders.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS.assemble, process.argv.slice(2));
const root = process.cwd();
if (!hasPackage(root)) {
  console.error(`assemble: no standalone build (no server.js under ${STANDALONE}) — set output: "standalone" in next.config and run next build first`);
  process.exit(2);
}
const placeholders = placeholderLines(root);
if (placeholders.length) {
  const lines = placeholders.map((p) => `  ${p.file} ${p.path}: ${p.value}`).join("\n");
  if (!placeholdersAllowed()) {
    console.error(`assemble: ${placeholders.length} placeholder(s) left from the starter, and what deploys ships none — write the site's own (/editorial:new-page, or by hand; pnpm content:lint names each by field), then build again; nothing was packaged:\n${lines}`);
    process.exit(1);
  }
  console.error(`assemble: ${placeholders.length} placeholder(s) left, packaged anyway (${PLACEHOLDERS_ENV}=warn: this run deploys nothing):\n${lines}`);
}
const { removed } = flags.check ? { removed: [] } : copyInto(root);
const report = checkPackage(root);
if (flags.json) console.log(JSON.stringify({ ...report, copied: !flags.check, removed }, null, 1));
for (const file of removed) console.error(`assemble: removed ${file}, a copy an earlier step nested inside the folder it should fill`);
if (!complete(report)) {
  const lines = [
    ...report.nested.map((f) => `  ${f}: a copy nested inside the folder it should fill — copy the contents into the folder (agentic-cms assemble), never the folder onto it`),
    ...report.missing.map((f) => `  ${f}: missing`),
    ...report.differ.map((f) => `  ${f}: differs from its source`),
  ];
  console.error(`assemble: ${report.package} is incomplete${flags.check ? " — run agentic-cms assemble" : ""}:\n${lines.join("\n")}`);
  process.exit(1);
}
if (!flags.json) {
  const parts = report.parts.map((p) => `${p.from}/ ${p.files} files`).join(", ");
  const extra = report.extra.length ? `; ${report.extra.length} file(s) in the package have no source and were left as they are` : "";
  console.log(`assemble: ${report.package} — ${parts} ${flags.check ? "checked" : "copied and checked"}, complete${extra}`);
}
