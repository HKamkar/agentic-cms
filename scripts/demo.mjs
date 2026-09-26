#!/usr/bin/env node
// The design round's throwaway route: `new` scaffolds src/app/<name>-demo
// with a candidate per letter (copies of the section's — or the chrome
// piece's — component to edit into ideas), the page's real copy read from
// its file (a section) or no props at all (the chrome), and the current
// version last, inside the site's own layout; `clean` removes the route,
// what the round created that nothing else uses (the manifest `new` writes
// beside the route, and git, say what that is) and next dev's stale route
// types. The procedure
// around it — the ideas, the pick, the build — is the design-options skill;
// docs/design.md § The round. Never merged: the build's SEO audit fails a
// route without a seo block, which is the guard.
import { execFileSync } from "node:child_process";
import { parseOrExit } from "./lib/args.mjs";
import { demoDir, demoManifest, isKitDemo, listDemos, removeDemo, writeDemo } from "./lib/demo.mjs";
import { SPECS } from "./lib/specs.mjs";

const { subcommand, positionals, flags } = parseOrExit(SPECS.demo, process.argv.slice(2));
const root = process.cwd();
const fail = (message, code = 2) => { console.error(`demo ${subcommand}: ${message}`); process.exit(code); };
/** A git command's lines, or null outside a git checkout. */
const git = (args) => { try { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean); } catch { return null; } };

if (subcommand === "new") {
  let report;
  // where the round begins, so clean can tell what it created: the commit, and what git did not track yet
  const round = { base: git(["rev-parse", "HEAD"])?.[0] ?? null, untracked: git(["ls-files", "--others", "--exclude-standard"]) ?? [] };
  try { report = writeDemo(root, { name: positionals[0], type: flags.section, page: flags.page, count: flags.candidates, component: flags.component, ...round }); } catch (error) { fail(error.message); }
  if (flags.json) console.log(JSON.stringify(report, null, 1));
  else {
    const of = report.section ? `"${report.section}" of content/pages/${report.page}.yaml` : `${report.component}, with no page copy (a piece of the chrome reads the site's config)`;
    console.log(`${report.route}  ${report.path}: ${of}, ${report.candidates.length} candidate(s) — ${report.candidates.map((c) => `${c.letter} ${c.file}`).join(", ")} — the current ${report.component} last`);
    console.log(`edit each candidate into one idea and its note in the route, pnpm dev, hand over ${report.path}; demo clean ${positionals[0]} removes it all`);
  }
  if (report.data) console.error(`note: "${report.section}" is a withData section — the page reads a collection for it; pass that in the route too (the comment there says where)`);
} else if (subcommand === "clean") {
  // Without a name, only the routes `demo new` wrote: a site's own gallery in a *-demo folder (the lab's route too) is kept and named.
  const found = positionals[0] ? [positionals[0]] : listDemos(root);
  const names = positionals[0] ? found : found.filter((name) => isKitDemo(root, name));
  const dryRun = flags["dry-run"];
  const removed = [], kept = found.filter((name) => !names.includes(name)).map((name) => `${demoDir(name)} (not a route demo new wrote: demo clean ${name} removes it)`);
  for (const name of names) {
    // what the round added since it began: committed since its base, or not tracked yet
    const base = demoManifest(root, name)?.base;
    const newness = { added: (base && git(["diff", "--name-only", "--relative", "--diff-filter=A", base, "--"])) || [], untracked: git(["ls-files", "--others", "--exclude-standard"]) ?? [] };
    const r = removeDemo(root, name, { newness, dryRun });
    removed.push(...r.removed); kept.push(...r.kept);
  }
  if (flags.json) console.log(JSON.stringify({ removed, kept, ...(dryRun ? { dryRun } : {}) }, null, 1));
  else console.log(`${removed.length ? `${dryRun ? "would remove" : "removed"}: ${removed.join(", ")}` : `nothing to remove${positionals[0] ? `: no src/app/${positionals[0]}-demo` : ""}`}${kept.length ? `\nkept: ${kept.join("; ")}` : ""}`);
}
