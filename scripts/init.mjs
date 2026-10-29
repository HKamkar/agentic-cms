#!/usr/bin/env node
// A site from the package: `agentic-cms init [dir] --name <Site>` lays out
// the wireframe example's code with the starter in place of its content (one
// home page and the blog index, their copy marked as placeholder; the site's
// name, which a new site must be given, and its address from --url and
// --email or a stand-in, where the example says its own), the agent files
// (thin rules, Codex stubs, the kit's keys in .claude/settings.json, which
// name the package's marketplace and its editorial and design plugins), the
// config and a manifest; `--agent-files` refreshes only the agent files of an
// existing site — the kit's lines rewritten, the site's own kept, nothing to
// merge; a site laid out before 0.9.0 moved first (lib/agent-files-move.mjs)
// — and `--check` reports what drifted instead of writing, failing a site's
// edit that lost a block the kit marks required, naming each; `--diff` and
// `--accept`, 0.8's hand merge, are deprecated and do nothing;
// `--light-only` lays the site out without dark mode (lib/light-only.mjs).
// lib/init.mjs is the scaffold, lib/agent-files.mjs the agent files,
// lib/starter.mjs the starter; docs/init.md says what a new site does next.
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { agentFiles, GatesError, kitPath, scaffold } from "./lib/init.mjs";
import { LightOnlyError } from "./lib/light-only.mjs";
import { onReservedDomain } from "./lib/placeholders.mjs";
import { CODEX_LIMIT } from "./lib/rules-table.mjs";
import { SPECS } from "./lib/specs.mjs";
import { StarterError } from "./lib/starter.mjs";

const { positionals: [dir = "."], flags } = parseOrExit(SPECS.init, process.argv.slice(2));
const kitRoot = path.resolve(import.meta.dirname, "..");
const version = JSON.parse(fs.readFileSync(path.join(kitRoot, "package.json"), "utf8")).version;
const target = path.resolve(dir);
const log = flags.json ? () => {} : console.log;
const printJson = (value) => console.log(JSON.stringify(value, null, 1));
const usage = (message) => { console.error(`init: ${message}`); process.exit(2); };
/** The statuses --check passes: the kit's text, or the site's own lines beside it. */
const IN_LINE = new Set(["ok", "modified"]);
/** A report line's tail: a file's note, the kit's settings keys, AGENTS.md's size against what Codex reads. */
const detail = (f) => (f.keys ? ` — the kit's ${f.keys.join(", ")}` : f.note ? ` — ${f.note}` : f.status === "too big" ? ` — ${f.bytes} bytes, Codex reads ${CODEX_LIMIT}` : f.status === "unreadable" ? " — not JSON" : "");
const goneFrom = (f) => (f.required ? ` — gone from the site's file, as ${kitPath(f.file)} has it:` : "");
/** A block the kit marks required, as a report shows it: where the kit's text has it, its words cut to one line. */
const clip = (text) => (text.length > 110 ? `${text.slice(0, 109)}…` : text);
const requiredLines = (f) => (f.required ?? []).map((r) => `  ${r.line ? `line ${r.line}: ` : ""}${clip(r.text)}`);
const STATUSES = "legacy: what init copied before 0.9.0 (run agentic-cms init --agent-files, which moves it: the skills to the kit's plugins, the rules thin); stale: the kit's lines, a stub or the kit's settings keys behind the kit, or the rules changed since the table (run agentic-cms init --agent-files); missing: run agentic-cms init --agent-files; modified, required gone: a rule whose kit block the site took apart lost what the kit marks required — put each back as the kit has it; unreadable: .claude/settings.json is not JSON; too big: AGENTS.md is past what Codex reads, so move procedures into linked docs";
const DEPRECATED = "is deprecated since 0.9.0 and goes in the next breaking release: nothing is merged by hand now — agentic-cms init --agent-files rewrites the kit's lines and keeps the site's own";

const modes = ["check", "diff", "accept"].filter((name) => (name === "check" ? flags.check : flags[name].length));
if (flags["agent-files"] && flags["light-only"]) usage("--light-only lays out a new site; --agent-files refreshes the rules and skills, which are the same for every site");
const named = ["name", "url", "email"].find((name) => flags[name] !== undefined);
if (flags["agent-files"] && named) usage(`--${named} names a new site; --agent-files refreshes the rules and skills, which carry no site's name`);
if (modes.length && !flags["agent-files"]) usage(`--${modes[0]} goes with --agent-files`);
if (modes.length > 1) usage(`--${modes.join(" and --")} are separate runs: one at a time`);
if (!flags["agent-files"]) scaffoldSite();
else if (flags.check) check();
else if (flags.diff.length || flags.accept.length) console.error(`init: --${flags.diff.length ? "diff" : "accept"} ${DEPRECATED}`);
else refresh();

function check() {
  const report = agentFiles(target, { kitRoot, version, check: true, log });
  const drift = report.filter((f) => !IN_LINE.has(f.status));
  const noted = report.filter((f) => IN_LINE.has(f.status) && f.note);
  const width = Math.max(9, ...[...drift, ...noted].map((f) => f.status.length + 1));
  for (const f of drift) console.error([`${f.status.padEnd(width)} ${f.file}${detail(f)}${goneFrom(f)}`, ...requiredLines(f)].join("\n"));
  if (!flags.json) for (const f of noted) console.log(`${f.status.padEnd(width)} ${f.file}${detail(f)}`);
  const edits = report.filter((f) => f.status === "modified").length;
  if (flags.json) printJson({ version, files: report });
  else if (drift.length) console.log(`init: ${drift.length} agent file(s) drifted — ${STATUSES}`);
  else console.log(edits ? `init: ${report.length} agent files in line with the kit — ${report.length - edits} as it ships them, ${edits} with the site's own lines or paths beside the kit's (modified)` : `init: ${report.length} agent files as the kit ships them`);
  process.exit(drift.length ? 1 : 0);
}

function refresh() {
  const report = agentFiles(target, { kitRoot, version, force: flags.force, log });
  const count = (...statuses) => report.filter((f) => statuses.includes(f.status)).length;
  const lost = report.filter((f) => f.status === "kept, required gone");
  const moved = report.filter((f) => ["removed", "moved", "thin"].includes(f.status));
  if (flags.json) printJson({ version, files: report });
  else {
    console.log(`init: agent files — ${count("created")} created, ${count("updated")} updated, ${count("kept", "kept, required gone")} kept${lost.length ? ` (${lost.length} without a block the kit requires)` : ""}, ${count("ok")} ok${moved.length ? `; ${moved.length} moved from before 0.9.0` : ""}`);
    const own = report.filter((f) => f.status === "moved" || f.status === "kept" && f.note?.includes("is taken"));
    if (own.length) console.log(`init: ${own.length} skill(s) the site edited are its own now — keep each, or delete it to follow the kit's:\n${own.map((f) => `  ${f.file}${detail(f)}`).join("\n")}`);
  }
  for (const f of lost) console.error([`init: ${f.file} is kept as the site edited it, without what the kit marks required — put it back as ${kitPath(f.file)} has it (--check fails until then):`, ...requiredLines(f)].join("\n"));
  for (const f of report.filter((entry) => entry.status === "unreadable")) console.error(`init: ${f.file} is not JSON — the kit sets its plugins there`);
  for (const f of report.filter((entry) => entry.status === "too big")) console.error(`init: AGENTS.md is ${f.bytes} bytes, past the ${CODEX_LIMIT} Codex reads by default — move detailed procedures into linked docs`);
}

function scaffoldSite() {
  let result;
  try { result = scaffold(target, { kitRoot, version, force: flags.force, lightOnly: flags["light-only"], name: flags.name, url: flags.url, email: flags.email, log }); } catch (error) {
    if (error instanceof StarterError || error instanceof GatesError) usage(`${error.message}; nothing was written`);
    if (!(error instanceof LightOnlyError)) throw error;
    console.error(`init --light-only: ${error.message}; nothing was written`);
    process.exit(2);
  }
  if (flags.json) return printJson({ target, version, ...result });
  const where = path.relative(process.cwd(), target);
  const { site } = result;
  console.log(`init: ${result.created.length} created, ${result.updated.length} updated, ${result.kept.length} kept in ${where || "."}${result.lightOnly ? " — light only: one scheme, no theme toggle" : ""}`);
  if (!site.starter) console.log(`init: content/ was there: the site's own content, pictures, site.ts and forms.ts are left as they are (the starter is for a new site)${named ? `, and --${named} names nothing here` : ""}`);
  else {
    const standIn = [site.url, site.email].filter(onReservedDomain);
    console.log(`init: ${site.name} — the starter: a home page and the blog index whose copy is marked "(placeholder)"${standIn.length ? `, and ${standIn.join(" and ")} standing in for the site's address (--url, --email)` : ""}; pnpm content:lint names each, and a production build fails while one remains`);
  }
  console.log(`next: ${where ? `cd ${where} && ` : ""}bash scripts/setup.sh && pnpm kit serve (the dev server, and every URL to hand over) — then the copy first (/editorial:new-page writes the home page's; content/VOICE.md), then src/config/site.ts, src/app/globals.css and the design skill`);
}
