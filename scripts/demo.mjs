#!/usr/bin/env node
// The design round's throwaway route: `new` scaffolds src/app/<name>-demo
// with a candidate per letter (copies of the section's component to edit
// into ideas), the page's real copy read from its file and the current
// version last, inside the site's own layout; `clean` removes the route,
// the losing candidates and next dev's stale route types. The procedure
// around it — the ideas, the pick, the build — is the design-options skill;
// docs/design.md § The round. Never merged: the build's SEO audit fails a
// route without a seo block, which is the guard.
import { parseOrExit } from "./lib/args.mjs";
import { listDemos, removeDemo, writeDemo } from "./lib/demo.mjs";
import { SPECS } from "./lib/specs.mjs";

const { subcommand, positionals, flags } = parseOrExit(SPECS.demo, process.argv.slice(2));
const root = process.cwd();
const fail = (message, code = 2) => { console.error(`demo ${subcommand}: ${message}`); process.exit(code); };

if (subcommand === "new") {
  if (!flags.section) fail("--section names the section type the candidates are for; run agentic-cms demo new --help");
  let report;
  try { report = writeDemo(root, { name: positionals[0], type: flags.section, page: flags.page, count: flags.candidates, component: flags.component }); } catch (error) { fail(error.message); }
  if (flags.json) console.log(JSON.stringify(report, null, 1));
  else {
    console.log(`${report.route}  ${report.path}: "${report.section}" of content/pages/${report.page}.yaml, ${report.candidates.length} candidate(s) — ${report.candidates.map((c) => `${c.letter} ${c.file}`).join(", ")} — the current ${report.component} last`);
    console.log(`edit each candidate into one idea and its note in the route, pnpm dev, hand over ${report.path}; demo clean ${positionals[0]} removes it all`);
  }
  if (report.data) console.error(`note: "${report.section}" is a withData section — the page reads a collection for it; pass that in the route too (the comment there says where)`);
} else if (subcommand === "clean") {
  const names = positionals[0] ? [positionals[0]] : listDemos(root);
  const removed = [], kept = [];
  for (const name of names) { const r = removeDemo(root, name); removed.push(...r.removed); kept.push(...r.kept); }
  if (flags.json) console.log(JSON.stringify({ removed, kept }, null, 1));
  else console.log(`${removed.length ? `removed: ${removed.join(", ")}` : `nothing to remove${positionals[0] ? `: no src/app/${positionals[0]}-demo` : ""}`}${kept.length ? `\nkept: ${kept.join("; ")}` : ""}`);
}
