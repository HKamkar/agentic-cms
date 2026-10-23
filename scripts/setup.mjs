#!/usr/bin/env node
// A clone made ready to work on, after scripts/setup.sh checked Node, got
// pnpm and installed the dependencies (which a command inside node_modules
// cannot do for itself): the browsers the kit drives, WebKit's Linux
// libraries (sudo, with --deps), .env.local and this machine's addresses in
// ALLOWED_DEV_ORIGINS, the lint and the tests, then the URLs to hand over.
// `--check` reports every step and changes nothing. lib/setup.mjs is the
// plan; docs/setup.md the procedure, for a person or an agent.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { browserPath, loadBrowser } from "./lib/browser.mjs";
import { formatUrls } from "./lib/hosts.mjs";
import { SetupError, parseEngines, setup } from "./lib/setup.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS.setup, process.argv.slice(2));
const root = process.cwd();
let engines;
try { engines = parseEngines(flags.engines); } catch (error) {
  if (!(error instanceof SetupError)) throw error;
  console.error(`setup: ${error.message}; run agentic-cms setup --help`);
  process.exit(2);
}

// With --json, stdout carries the report alone: the progress and every command's own output go to stderr.
const say = flags.json ? console.error : console.log;
const exec = (command, args, { capture = false, env = {} } = {}) => {
  const r = spawnSync(command, args, { cwd: root, encoding: "utf8", env: { ...process.env, ...env }, shell: process.platform === "win32", stdio: capture ? ["ignore", "pipe", "ignore"] : ["inherit", flags.json ? 2 : "inherit", "inherit"] });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "" };
};

const pw = await loadBrowser();
const browsers = {
  cli: pw ? path.join(path.dirname(createRequire(import.meta.url).resolve("playwright-core/package.json")), "cli.js") : null,
  path: browserPath,
  async launches(engine) {
    try { const browser = await pw[engine].launch({ executablePath: browserPath(engine), timeout: 30000 }); await browser.close(); return true; } catch { return false; }
  },
};

const MARK = { ok: "✓", done: "✓", skipped: "·", gap: "✗", todo: "!", failed: "✗" };
const log = (s) => say(`  ${MARK[s.status]} ${s.step.padEnd(17)} ${s.detail}${s.command ? `\n${" ".repeat(22)}${s.command}` : ""}`);

say(flags.check ? "setup --check: what this clone has, changing nothing" : "setup");
const report = await setup({
  root, exec, fs, browsers, log,
  flags: { check: flags.check, build: flags.build, browsers: !flags["no-browsers"], engines, deps: flags.deps, public: !flags["no-public"], port: flags.port, labPort: flags["lab-port"] },
});

if (flags.json) console.log(JSON.stringify({ ready: report.ready, check: report.check, steps: report.steps, todo: report.todo, urls: report.urls }, null, 1));
else {
  if (report.urls) console.log(["", ...formatUrls(report.urls)].join("\n"));
  const gaps = report.steps.filter((s) => s.status === "gap").length, yours = report.steps.filter((s) => s.status === "todo").length;
  const owner = yours ? `${yours} step(s) left for you: the lines marked ! above` : "";
  const verdict = report.exit === 2 ? "stopped: the step marked ✗ needs fixing first, then run it again"
    : report.exit === 1 && !report.check ? "a verify step failed: fix it, then run it again"
    : report.check ? [gaps && `${gaps} gap(s), which setup (bash scripts/setup.sh) fills`, owner].filter(Boolean).join("; ") || "nothing missing"
    : owner ? `ready, with ${owner}` : "ready";
  console.log(`\nsetup: ${verdict}`);
  if (report.exit === 0 && !report.check) console.log("next: pnpm kit serve — the dev server, and the URLs to hand over once its pages answer (docs/dev-server.md); AGENTS.md is the rules");
}
process.exit(report.exit);
