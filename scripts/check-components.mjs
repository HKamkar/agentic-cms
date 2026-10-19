#!/usr/bin/env node
// The component library's placement guard: every component lives in the
// library or is a registered section, so nobody adds a one-off component to
// a page, and the engines' rules hold in ESLint's resolved config. A site's
// `pnpm lint` runs it after ESLint (`eslint; s=$?; agentic-cms
// check-components || s=1; exit $s`), so both report and CI fails on either.
// lib/check-components.mjs does the work; the config is
// src/config/components.json (docs/primitives.md § Placed).
import fs from "node:fs";
import { parseOrExit } from "./lib/args.mjs";
import { checkComponents, checkPreset, formatReport, GuardConfigError, readConfig } from "./lib/check-components.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS["check-components"], process.argv.slice(2));
const root = process.cwd();
let report;
try {
  const config = readConfig(root, fs);
  report = checkComponents({ root, fs, config });
  report.findings.push(...(await checkPreset({ root, config })));
} catch (error) {
  if (!(error instanceof GuardConfigError)) throw error;
  console.error(`check-components: ${error.message}`);
  process.exit(2);
}
if (flags.json) console.log(JSON.stringify(report, null, 1));
else (report.findings.length ? console.error : console.log)(formatReport(report).join("\n"));
process.exit(report.findings.length ? 1 : 0);
