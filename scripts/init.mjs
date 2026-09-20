#!/usr/bin/env node
// A site from the package: `agentic-cms init [dir]` lays out the wireframe
// example, the agent files (the rules and the design skills, so an agent
// designs from the first session with nothing installed), the config and a
// manifest; `--agent-files` refreshes only the rules and skills of an
// existing site, keeping the site's own edits, and `--check` reports what
// drifted instead of writing. lib/init.mjs is the scaffold; docs/init.md
// says what a new site does next.
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { agentFiles, scaffold } from "./lib/init.mjs";
import { SPECS } from "./lib/specs.mjs";

const { positionals: [dir = "."], flags } = parseOrExit(SPECS.init, process.argv.slice(2));
const kitRoot = path.resolve(import.meta.dirname, "..");
const version = JSON.parse(fs.readFileSync(path.join(kitRoot, "package.json"), "utf8")).version;
const target = path.resolve(dir);
const log = flags.json ? () => {} : console.log;

if (flags["agent-files"]) {
  const report = agentFiles(target, { kitRoot, version, check: flags.check, force: flags.force, log });
  const drift = report.filter((f) => f.status !== "ok");
  if (flags.check) {
    for (const f of drift) console.error(`${f.status.padEnd(9)} ${f.file}`);
    if (flags.json) console.log(JSON.stringify({ version, files: report }, null, 1));
    else console.log(drift.length ? `init: ${drift.length} agent file(s) drifted — modified: the site edited it (kept); stale: the kit has a newer one (run agentic-cms init --agent-files); missing: run agentic-cms init --agent-files` : `init: ${report.length} agent files as the kit ships them`);
    process.exit(drift.length ? 1 : 0);
  }
  if (flags.json) console.log(JSON.stringify({ version, files: report }, null, 1));
  else console.log(`init: agent files — ${["created", "updated", "kept", "ok"].map((s) => `${report.filter((f) => f.status === s).length} ${s}`).join(", ")}`);
} else {
  if (flags.check) { console.error("init: --check goes with --agent-files"); process.exit(2); }
  const result = scaffold(target, { kitRoot, version, force: flags.force, log });
  if (flags.json) console.log(JSON.stringify({ target, version, ...result }, null, 1));
  else {
    console.log(`init: ${result.created.length} created, ${result.updated.length} updated, ${result.kept.length} kept in ${path.relative(process.cwd(), target) || "."}`);
    console.log(`next: cd ${path.relative(process.cwd(), target) || "."} && pnpm install && pnpm dev — then src/config/site.ts, src/app/globals.css, content/VOICE.md, and the design skill`);
  }
}
