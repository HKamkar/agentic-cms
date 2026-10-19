#!/usr/bin/env node
// The site check a site's `pnpm lint` runs after ESLint (`eslint; s=$?;
// agentic-cms check-site || s=1; exit $s`), so both report and CI fails on
// either: every pass of the component guard (`check-components`), then the
// site's own — the design rounds' routes and pictures, the exceptions added
// since the merge base with their reasons, the gates in package.json and in
// CI, and the site's own tools where the kit has a command, which warn.
// lib/check-site.mjs does the work; the config is src/config/components.json
// (docs/primitives.md § The whole site).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { parseOrExit } from "./lib/args.mjs";
import { GuardConfigError } from "./lib/check-components.mjs";
import { checkSite, formatSiteReport, SiteCheckError } from "./lib/check-site.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS["check-site"], process.argv.slice(2));
const root = process.cwd();
/** git in the site's root; a machine without git answers as a folder outside any checkout does. */
const git = (args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, stdout: result.stdout ?? "" };
};
let report;
try {
  report = await checkSite({ root, fs, git, env: process.env, base: flags.base });
} catch (error) {
  if (!(error instanceof GuardConfigError) && !(error instanceof SiteCheckError)) throw error;
  console.error(`check-site: ${error.message}`);
  process.exit(2);
}
if (flags.json) console.log(JSON.stringify(report, null, 1));
else (report.findings.length ? console.error : console.log)(formatSiteReport(report).join("\n"));
process.exit(report.findings.length ? 1 : 0);
