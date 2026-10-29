#!/usr/bin/env node
// The agentic-cms command line: one command per script under scripts/, run
// against the site in the current directory — its src/kit.ts for the registry
// and the config, its content/, public/, .next and .parity. A site's
// package.json names them: "content:lint": "agentic-cms lint", and so on.
// The commands, their flags and exit codes are scripts/lib/specs.mjs (the
// help and docs/commands.md are generated from it). The help is the map by
// family, --version the installed version (TOP); a wrong command names the
// nearest one; a command that reads the site refuses to run outside a site's
// root.
import fs from "node:fs";
import { specAt, subcommandPath, suggest, usageText } from "../scripts/lib/args.mjs";
import { FAMILIES, SPECS, TOP } from "../scripts/lib/specs.mjs";

const [command, ...rest] = process.argv.slice(2);

const short = (summary) => { const cut = summary.split(/[:;—(]/)[0].trim(); return cut.length > 72 ? `${cut.slice(0, 69).replace(/\s+\S*$/, "")}…` : cut; };

/** The map: every family with its commands, one line each on what it is for, under the layer it belongs to (FAMILIES' order). */
function table() {
  const families = new Map(FAMILIES.map((f) => [f.group, []]));
  const layers = new Map(FAMILIES.map((f) => [f.group, f.layer]));
  for (const spec of Object.values(SPECS)) { const group = spec.group ?? "other"; if (!families.has(group)) families.set(group, []); families.get(group).push(spec); }
  const width = Math.max(...[...families.keys()].map((g) => g.length)) + 2;
  const lines = ["usage: agentic-cms <command> [options]        (pnpm kit <command> in a checkout of the kit)"];
  let layer;
  for (const [group, specs] of families) {
    if (!specs.length) continue;
    if (layers.get(group) !== layer) { layer = layers.get(group); lines.push("", layer ?? "other"); }
    const names = specs.map((spec) => (spec.subcommands ? `${spec.command} <${Object.keys(spec.subcommands).join("|")}>` : spec.command)).join(" · ");
    lines.push(`  ${group.padEnd(width)} ${names}`);
    for (const spec of specs) lines.push(`  ${"".padEnd(width)}   ${spec.command.padEnd(22)} ${short(spec.summary)}`);
  }
  lines.push("", "agentic-cms <command> --help prints its flags, exit codes (0 clean · 1 findings · 2 usage or environment) and examples; docs/commands.md is the contract, docs/parts.md the map of every part");
  lines.push(`agentic-cms --version: ${TOP.flags.version.help}`);
  return lines.join("\n");
}

if (!command || ["help", "--help", "-h"].includes(command)) {
  console.log(table());
  process.exit(command ? 0 : 2);
}
if (command === "--version") {
  console.log(JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
  process.exit(0);
}
const spec = SPECS[command];
if (!spec) {
  console.error(`agentic-cms: no command ${command}${suggest(command, [...Object.keys(SPECS), "--version"])}\n\n${table()}`);
  process.exit(2);
}
if (rest.includes("--help") || rest.includes("-h")) {
  console.log(usageText(specAt(spec, subcommandPath(spec, rest.filter((a) => !a.startsWith("-"))))));
  process.exit(0);
}
// A command that loads the site's registry (site: true) runs in the site's root: src/kit.ts is its mark.
if (spec.site && !fs.existsSync("src/kit.ts")) {
  console.error(`agentic-cms ${command}: no src/kit.ts here — run it in the site's root (where package.json, src/kit.ts and content/ are)${fs.existsSync("package.json") ? "" : "; to start a site here, agentic-cms init . --name \"<Site>\""}`);
  process.exit(2);
}
// The scripts print and then process.exit(), which drops whatever a pipe has not
// taken yet (a --json report read through a pipe ended at 64 KB): on a pipe,
// stdout and stderr write synchronously, as they already do to a file or a terminal.
for (const stream of [process.stdout, process.stderr]) stream._handle?.setBlocking?.(true);
// The scripts read their own arguments from process.argv.slice(2).
process.argv.splice(2, 1);
await import(`../scripts/${spec.script}.mjs`);
