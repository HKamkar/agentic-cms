#!/usr/bin/env node
// A pull request's preview on Cloudflare Workers (lib/pr-preview.mjs), the
// step the site's verify.yml preview job runs: the site built as production
// with AGENTIC_CMS_PREVIEW=1, uploaded as a version under the alias pr-<n>,
// not deployed, and one comment on the pull request with the link and the
// pages the change touches. A fork's pull request, or a run without the
// Cloudflare secrets, makes no preview and says so, in the log, the run's
// annotations and its summary. docs/preview.md is the procedure.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { parseOrExit } from "./lib/args.mjs";
import { githubApi, PreviewError, prPreview } from "./lib/pr-preview.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS["pr-preview"], process.argv.slice(2));
const root = process.cwd();
// With --json, stdout carries the result alone: the progress and the build's own output go to stderr.
const say = flags.json ? console.error : console.log;
const run = (command, args, { env = {} } = {}) => {
  const quiet = command === "git";
  const r = spawnSync(command, args, { cwd: root, encoding: "utf8", env: { ...process.env, ...env }, stdio: quiet ? ["ignore", "pipe", "pipe"] : ["inherit", flags.json ? 2 : "inherit", "pipe"] });
  if (!quiet && r.stderr) process.stderr.write(r.stderr);
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};
const github = process.env.GITHUB_TOKEN ? githubApi({ token: process.env.GITHUB_TOKEN, fetch }) : null;
const summary = (text) => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`); };

try {
  const result = await prPreview({ root, env: process.env, flags: { pr: flags.pr, base: flags.base, build: !flags["no-build"], comment: !flags["no-comment"], dryRun: flags["dry-run"] }, fs, run, github, log: say });
  if (result.status === "skipped") {
    say(`pr-preview: no preview: ${result.reason}`);
    if (process.env.GITHUB_ACTIONS === "true") console.log(`::notice title=No preview::${result.reason}`);
    summary(`No preview: ${result.reason}.`);
  } else if (result.status === "dry-run") say(result.body);
  else {
    say(`pr-preview: ${result.url} (${result.alias}); the comment ${result.comment ?? "not posted (--no-comment, or no GITHUB_TOKEN)"}`);
    summary(result.body);
  }
  if (flags.json) console.log(JSON.stringify(result, null, 1));
} catch (error) {
  if (!(error instanceof PreviewError)) throw error;
  console.error(`pr-preview: ${error.message}`);
  process.exit(error.usage ? 2 : 1);
}
