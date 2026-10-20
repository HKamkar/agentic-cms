#!/usr/bin/env node
// The site check a site's `pnpm lint` runs after ESLint (`eslint; s=$?;
// agentic-cms check-site || s=1; exit $s`), so both report and CI fails on
// either: every pass of the component guard (`check-components`), then the
// site's own — the design rounds' routes and pictures, the exceptions added
// since the merge base with their reasons, the gates in package.json and in
// CI, the site's own tools where the kit has a command, which warn, and what
// is left of the kit's example; the baseline holds what the site had when it
// took 0.8.2, and `--baseline` writes that list or shrinks it.
// lib/check-site.mjs does the work; the config is src/config/components.json
// (docs/primitives.md § The whole site).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { parseOrExit } from "./lib/args.mjs";
import { GuardConfigError } from "./lib/check-components.mjs";
import { baselineSite, checkSite, formatBaselineReport, formatSiteReport, SiteCheckError } from "./lib/check-site.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS["check-site"], process.argv.slice(2));
const root = process.cwd();
/** git in the site's root; a machine without git answers as a folder outside any checkout does. */
const git = (args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, stdout: result.stdout ?? "" };
};
/** The site check in a process of its own, as the lint runs it after --baseline wrote the list: this process's ESLint holds eslint.config.mjs as it read it, the list as it was. */
const recheck = () => {
  const args = [import.meta.filename, "--json", ...(flags.base ? ["--base", flags.base] : [])];
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status === 2 || !result.stdout.trim()) throw new SiteCheckError(`the site check after the write answered ${result.status}: ${(result.stderr || result.stdout).trim()}`);
  return JSON.parse(result.stdout);
};
const run = flags.baseline ? baselineSite : checkSite;
let report;
try {
  report = await run({ root, fs, git, env: process.env, base: flags.base, recheck });
} catch (error) {
  if (!(error instanceof GuardConfigError) && !(error instanceof SiteCheckError)) throw error;
  console.error(`check-site: ${error.message}`);
  process.exit(2);
}
const failed = flags.baseline ? report.refused.length + report.remaining.length > 0 : report.findings.length > 0;
if (flags.json) console.log(JSON.stringify(report, null, 1));
else (failed ? console.error : console.log)((flags.baseline ? formatBaselineReport : formatSiteReport)(report).join("\n"));
process.exit(failed ? 1 : 0);
