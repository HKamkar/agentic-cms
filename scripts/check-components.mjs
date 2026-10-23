#!/usr/bin/env node
// The component library's placement guard: every component lives in the
// library or is a registered section, so nobody adds a one-off component to
// a page, and the engines' rules hold in ESLint's resolved config; what the
// preferred tier guides is a warning, which fails nothing. A site's
// `pnpm lint` runs `agentic-cms check-site` after ESLint, which runs this
// pass first and the site's own after it; this command is the components
// pass alone. lib/check-components.mjs does the work; the config is
// src/config/components.json (docs/primitives.md § Placed).
import fs from "node:fs";
import { parseOrExit } from "./lib/args.mjs";
import { componentsReport, formatReport, GuardConfigError } from "./lib/check-components.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS["check-components"], process.argv.slice(2));
const root = process.cwd();
let report;
try {
  report = await componentsReport({ root, fs });
} catch (error) {
  if (!(error instanceof GuardConfigError)) throw error;
  console.error(`check-components: ${error.message}`);
  process.exit(2);
}
if (flags.json) console.log(JSON.stringify(report, null, 1));
else (report.findings.length ? console.error : console.log)(formatReport(report).join("\n"));
process.exit(report.findings.length ? 1 : 0);
