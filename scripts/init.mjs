#!/usr/bin/env node
// A site from the package: `agentic-cms init [dir]` lays out the wireframe
// example, the agent files (the rules and the design skills, so an agent
// designs from the first session with nothing installed), the config and a
// manifest; `--agent-files` refreshes only the rules and skills of an
// existing site, keeping the site's own edits, `--check` reports what
// drifted instead of writing, `--diff` prints the kit's change to a file the
// site edited since the site took it (for a file the manifest has no base
// for, from the kit's text at the version the site was on, or plainly the
// whole file when no release is known as its source), and `--accept`
// records the kit's current text as that file's base once the site merged
// the change by hand;
// `--light-only` lays the example out as a site without dark mode
// (lib/light-only.mjs). lib/init.mjs is the scaffold; docs/init.md says what
// a new site does next.
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { acceptAgentFiles, agentFileDiff, AgentFileError, agentFiles, scaffold } from "./lib/init.mjs";
import { LightOnlyError } from "./lib/light-only.mjs";
import { CODEX_LIMIT } from "./lib/rules-table.mjs";
import { SPECS } from "./lib/specs.mjs";

const { positionals: [dir = "."], flags } = parseOrExit(SPECS.init, process.argv.slice(2));
const kitRoot = path.resolve(import.meta.dirname, "..");
const version = JSON.parse(fs.readFileSync(path.join(kitRoot, "package.json"), "utf8")).version;
const target = path.resolve(dir);
const log = flags.json ? () => {} : console.log;
const printJson = (value) => console.log(JSON.stringify(value, null, 1));
const usage = (message) => { console.error(`init: ${message}`); process.exit(2); };
/** The statuses --check passes: the kit's text, or the site's edit of it. */
const IN_LINE = new Set(["ok", "modified"]);
const MERGE = "agentic-cms init --agent-files --diff <file>, merge the change by hand, then --accept <file>";
/** A report line's tail: a no-base file's note, AGENTS.md's size against what Codex reads. */
const detail = (f) => (f.note ? ` — ${f.note}` : f.status === "too big" ? ` — ${f.bytes} bytes, Codex reads ${CODEX_LIMIT}` : "");

const modes = ["check", "diff", "accept"].filter((name) => (name === "check" ? flags.check : flags[name].length));
if (flags["agent-files"] && flags["light-only"]) usage("--light-only lays out a new site; --agent-files refreshes the rules and skills, which are the same for every site");
if (modes.length && !flags["agent-files"]) usage(`--${modes[0]} goes with --agent-files`);
if (modes.length > 1) usage(`--${modes.join(" and --")} are separate runs: one at a time`);
if (!flags["agent-files"]) scaffoldSite();
else {
  try {
    if (flags.check) check();
    else if (flags.diff.length) diff();
    else if (flags.accept.length) accept();
    else refresh();
  } catch (error) {
    if (!(error instanceof AgentFileError)) throw error;
    usage(error.message);
  }
}

function check() {
  const report = agentFiles(target, { kitRoot, version, check: true, log });
  const drift = report.filter((f) => !IN_LINE.has(f.status));
  const noted = report.filter((f) => IN_LINE.has(f.status) && f.note);
  const width = Math.max(9, ...[...drift, ...noted].map((f) => f.status.length + 1));
  for (const f of drift) console.error(`${f.status.padEnd(width)} ${f.file}${detail(f)}`);
  if (!flags.json) for (const f of noted) console.log(`${f.status.padEnd(width)} ${f.file}${detail(f)}`);
  const edits = report.filter((f) => f.status === "modified").length;
  if (flags.json) printJson({ version, files: report });
  else if (drift.length) console.log(`init: ${drift.length} agent file(s) drifted — modified, kit changed: the site edited it and the kit's text changed since the site took it (${MERGE}); stale: the kit has a newer one, or the rules changed since the table was written (run agentic-cms init --agent-files); missing: run agentic-cms init --agent-files; too big: AGENTS.md is past what Codex reads, so move procedures into linked docs`);
  else console.log(edits ? `init: ${report.length} agent files in line with the kit — ${report.length - edits} as it ships them, ${edits} the site's own edits of its current text (modified)` : `init: ${report.length} agent files as the kit ships them`);
  process.exit(drift.length ? 1 : 0);
}

function diff() {
  const results = flags.diff.map((file) => agentFileDiff(target, file, { kitRoot, version }));
  if (flags.json) printJson({ version, files: results });
  else for (const r of results) {
    const note = r.note ? ` (${r.note})` : "";
    if (!r.diff) console.error(`init: ${r.file} — nothing to merge: ${r.status === "ok" ? "it is the kit's text" : `the kit's text has not changed since the site took it${note}`}`);
    else if (!r.base) console.error(`init: ${r.file} has no base, and no release of the kit is known as its source: what follows is the site's whole file against the kit's current text, not the kit's change — never apply it whole; take from it only the kit's lines the site lacks, by hand, then agentic-cms init --agent-files --accept ${r.file}`);
    else console.error(`init: ${r.file} — the kit's change since the site took it (${r.note ?? `the base from ${r.from}`}): merge it by hand (\`git apply\` takes it where the site's edits sit apart from it and its context lines), then agentic-cms init --agent-files --accept ${r.file}`);
    process.stdout.write(r.diff);
  }
  process.exit(results.some((r) => r.diff) ? 1 : 0);
}

function accept() {
  const report = acceptAgentFiles(target, flags.accept, { kitRoot });
  if (flags.json) printJson({ version, files: report });
  else for (const f of report) console.log(`accepted ${f.file} — its base is the kit's current text; --check: ${f.status}`);
}

function refresh() {
  const report = agentFiles(target, { kitRoot, version, force: flags.force, log });
  const count = (...statuses) => report.filter((f) => statuses.includes(f.status)).length;
  const gaps = report.filter((f) => f.status === "kept, kit changed");
  const based = report.filter((f) => f.note && f.status !== "kept, kit changed");
  if (flags.json) printJson({ version, files: report });
  else {
    console.log(`init: agent files — ${count("created")} created, ${count("updated")} updated, ${count("kept", "kept, kit changed")} kept${gaps.length ? ` (${gaps.length} with a kit change to merge)` : ""}, ${count("ok")} ok`);
    if (based.length) console.log(`init: ${based.length} file(s) had no base in the manifest — now recorded from the kit's releases:\n${based.map((f) => `  ${f.status.padEnd(8)} ${f.file}${detail(f)}`).join("\n")}`);
    if (gaps.length) console.log(`init: the kit changed ${gaps.length} file(s) the site edited — for each, ${MERGE}:\n${gaps.map((f) => `  ${f.file}${detail(f)}`).join("\n")}`);
  }
  for (const f of report.filter((entry) => entry.status === "too big")) console.error(`init: AGENTS.md is ${f.bytes} bytes, past the ${CODEX_LIMIT} Codex reads by default — move detailed procedures into linked docs`);
}

function scaffoldSite() {
  let result;
  try { result = scaffold(target, { kitRoot, version, force: flags.force, lightOnly: flags["light-only"], log }); } catch (error) {
    if (!(error instanceof LightOnlyError)) throw error;
    console.error(`init --light-only: ${error.message}; nothing was written`);
    process.exit(2);
  }
  if (flags.json) return printJson({ target, version, ...result });
  const where = path.relative(process.cwd(), target);
  console.log(`init: ${result.created.length} created, ${result.updated.length} updated, ${result.kept.length} kept in ${where || "."}${result.lightOnly ? " — light only: one scheme, no theme toggle" : ""}`);
  console.log(`next: ${where ? `cd ${where} && ` : ""}bash scripts/setup.sh && pnpm kit serve (the dev server, and every URL to hand over) — then src/config/site.ts, src/app/globals.css, content/VOICE.md, and the design skill`);
}
