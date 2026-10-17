#!/usr/bin/env node
// The design round's throwaway route: `new` scaffolds src/app/<name>-demo
// with a candidate per letter (copies of the section's — or the chrome
// piece's — component to edit into ideas), the page's real copy read from
// its file (a section) or no props at all (the chrome), and the current
// version last, inside the site's own layout — or, with --showcase, a
// review page of pieces that are not one section's candidates — then, with
// the dev server running, waits until the route answers and prints the URLs
// to hand over (lib/handover.mjs); `clean` removes the route, what the
// round created that nothing else uses (the manifest `new` writes beside
// the route, and git, say what that is) and next dev's stale route types.
// The procedure around it — the ideas, the pick, the build — is the
// design-options skill; docs/design.md § The round. Never merged: the
// build's SEO audit fails a route without a seo block, which is the guard.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { parseOrExit } from "./lib/args.mjs";
import { demoDir, demoManifest, isKitDemo, listDemos, removeDemo, writeDemo } from "./lib/demo.mjs";
import { formatHandover, handover } from "./lib/handover.mjs";
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
  try { report = writeDemo(root, { name: positionals[0], type: flags.section, page: flags.page, count: flags.candidates, components: flags.component, showcase: flags.showcase, timeline: flags.timeline, ...round }); } catch (error) { fail(error.message); }
  const scripts = (() => { try { return JSON.parse(fs.readFileSync("package.json", "utf8")).scripts ?? {}; } catch { return {}; } })();
  // the route asked until it answers on the running dev server (which also compiles it), then its URLs
  const handed = await handover({ root, route: report.path, url: flags.url, scripts, wait: !flags["no-wait"], timeout: flags.timeout * 1000, lookupPublic: !flags["no-public"], fs });
  const told = formatHandover(handed, report.path);
  if (flags.json) console.log(JSON.stringify({ ...report, urls: handed.urls, ready: handed.ready, status: handed.status }, null, 1));
  else {
    console.log(`${report.route}  ${report.path}: ${describe(report)}`);
    if (told.out.length) console.log(told.out.join("\n"));
    const edit = report.kind === "showcase" ? "give each block the props, looks and states to review, and its note" : "edit each candidate into one idea and its note in the route";
    console.log(`${edit}; demo clean ${positionals[0]} removes it all`);
  }
  if (told.err.length) console.error(told.err.join("\n"));
  if (report.data) console.error(`note: "${report.section}" is a withData section — the page reads a collection for it; pass that in the route too (the comment there says where)`);
  process.exit(told.exit);
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

/** What the route shows, in one line: a section's candidates, a chrome piece's, or a showcase's pieces. */
function describe(report) {
  if (report.kind === "showcase") return `a showcase, ${report.components.length ? `a block for each of ${report.components.join(", ")}` : "one block to fill"}`;
  const of = report.section ? `"${report.section}" of content/pages/${report.page}.yaml` : `${report.component}, with no page copy (a piece of the chrome reads the site's config)`;
  return `${of}, ${report.candidates.length} candidate(s) — ${report.candidates.map((c) => `${c.letter} ${c.file}`).join(", ")} — the current ${report.component} last`;
}
