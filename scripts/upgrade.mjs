#!/usr/bin/env node
// A site moved to this release: `pnpm dlx agentic-cms@<version> upgrade` in
// its root runs this release's code, which carries every migration up to
// it. The version the site is on, `pnpm add` of this one, each migration
// newer than the site's, `init --agent-files`, the manual steps left with
// their sections of docs/upgrading.md, then `pnpm lint` and `pnpm test`;
// `--dry-run` says what it would change and changes nothing. lib/upgrade.mjs
// is the plan, scripts/migrations/ the steps; docs/upgrade.md the guide.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { SPECS } from "./lib/specs.mjs";
import { upgrade, UpgradeError } from "./lib/upgrade.mjs";

const { flags } = parseOrExit(SPECS.upgrade, process.argv.slice(2));
const site = process.cwd();
const kitRoot = path.resolve(import.meta.dirname, "..");
const version = JSON.parse(fs.readFileSync(path.join(kitRoot, "package.json"), "utf8")).version;
// With --json, stdout carries the report alone: the progress and every command's own output go to stderr.
const say = flags.json ? console.error : console.log;
const exec = (command, args) => {
  const r = spawnSync(command, args, { cwd: site, stdio: ["ignore", flags.json ? 2 : "inherit", "inherit"], shell: process.platform === "win32" });
  return { status: r.error ? null : r.status };
};

let report;
try {
  report = await upgrade(site, { kitRoot, version, kit: flags.kit, from: flags.from, dryRun: flags["dry-run"], exec, log: (line) => say(`  ${line}`) });
} catch (error) {
  if (!(error instanceof UpgradeError)) throw error;
  console.error(`upgrade: ${error.message}`);
  process.exit(2);
}

if (flags.json) console.log(JSON.stringify(report, null, 1));
else print(report);
process.exit(report.exit);

function print({ from, to, spec, dryRun, migrations, agentFiles, manual, verify }) {
  console.log(`upgrade: agentic-cms ${from} → ${to}${dryRun ? " (--dry-run: nothing is changed)" : ""}, pnpm add agentic-cms@${spec}`);
  for (const { version: at, found, changed } of migrations) {
    console.log(`  ${at}: ${found.length ? `${found.length} to do${dryRun ? "" : `, ${changed.length} changed`}` : "nothing to do"}`);
    if (dryRun) for (const { piece, what } of found) console.log(`    ${piece}: ${what}`);
  }
  const drift = agentFiles.filter((f) => !["ok", "modified", "kept"].includes(f.status));
  console.log(`  init --agent-files${dryRun ? " --check" : ""}: ${agentFiles.length} agent files${drift.length ? `, ${drift.length} ${dryRun ? "to write" : "written"}` : ", in line with the kit"}`);
  for (const { script, status } of verify) console.log(`  ${status === 0 ? "✓" : "✗"} pnpm ${script}`);
  if (manual.length) console.log(["upgrade: by hand, then commit:", ...manual.map(({ text, link }) => `  ! ${text}\n    ${link}`)].join("\n"));
  const failed = verify.filter((v) => v.status !== 0).map((v) => `pnpm ${v.script}`);
  console.log(dryRun ? "upgrade: run it without --dry-run to make these changes" : failed.length ? `upgrade: ${failed.join(" and ")} failed after the upgrade: fix, then run them again` : manual.length ? `upgrade: ${manual.length} step(s) left by hand, above` : "upgrade: done — commit the changes");
}
