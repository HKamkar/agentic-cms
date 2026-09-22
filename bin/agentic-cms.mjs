#!/usr/bin/env node
// The agentic-cms command line: one command per script under scripts/, run
// against the site in the current directory — its src/kit.ts for the registry
// and the config, its content/, public/, .next and .parity. A site's
// package.json names them: "content:lint": "agentic-cms lint", and so on.
// The commands, their flags and exit codes are scripts/lib/specs.mjs (the
// help and docs/commands.md are generated from it). The help is the map by
// family; a wrong command names the nearest one; a command that reads the
// site refuses to run outside a site's root.
import fs from "node:fs";
import { suggest, usageText } from "../scripts/lib/args.mjs";
import { SPECS } from "../scripts/lib/specs.mjs";

const [command, ...rest] = process.argv.slice(2);

// The families in the order a job runs: the content, the gates a build runs, the images, the proofs, the looks, then the design tools and the site itself.
const FAMILIES = ["content", "build gates", "images", "proof", "look & measure", "icons", "lab", "demo", "site"];
const short = (summary) => { const cut = summary.split(/[:;—(]/)[0].trim(); return cut.length > 72 ? `${cut.slice(0, 69).replace(/\s+\S*$/, "")}…` : cut; };

/** The map: every family with its commands, one line each on what it is for. */
function table() {
  const families = new Map(FAMILIES.map((f) => [f, []]));
  for (const spec of Object.values(SPECS)) { const group = spec.group ?? "other"; if (!families.has(group)) families.set(group, []); families.get(group).push(spec); }
  const width = Math.max(...[...families.keys()].map((g) => g.length)) + 2;
  const lines = ["usage: agentic-cms <command> [options]        (pnpm kit <command> in a checkout of the kit)", ""];
  for (const [group, specs] of families) {
    if (!specs.length) continue;
    const names = specs.map((spec) => (spec.subcommands ? `${spec.command} <${Object.keys(spec.subcommands).join("|")}>` : spec.command)).join(" · ");
    lines.push(`  ${group.padEnd(width)} ${names}`);
    for (const spec of specs) lines.push(`  ${"".padEnd(width)}   ${spec.command.padEnd(22)} ${short(spec.summary)}`);
  }
  lines.push("", "agentic-cms <command> --help prints its flags, exit codes (0 clean · 1 findings · 2 usage or environment) and examples; docs/commands.md is the contract");
  return lines.join("\n");
}

if (!command || ["help", "--help", "-h"].includes(command)) {
  console.log(table());
  process.exit(command ? 0 : 2);
}
const spec = SPECS[command];
if (!spec) {
  console.error(`agentic-cms: no command ${command}${suggest(command, Object.keys(SPECS))}\n\n${table()}`);
  process.exit(2);
}
if (rest.includes("--help") || rest.includes("-h")) {
  const sub = spec.subcommands && rest.find((a) => !a.startsWith("-"));
  console.log(usageText(sub && spec.subcommands[sub] ? spec.subcommands[sub] : spec));
  process.exit(0);
}
// A command that loads the site's registry (site: true) runs in the site's root: src/kit.ts is its mark.
if (spec.site && !fs.existsSync("src/kit.ts")) {
  console.error(`agentic-cms ${command}: no src/kit.ts here — run it in the site's root (where package.json, src/kit.ts and content/ are)${fs.existsSync("package.json") ? "" : "; to start a site here, agentic-cms init ."}`);
  process.exit(2);
}
// The scripts read their own arguments from process.argv.slice(2).
process.argv.splice(2, 1);
await import(`../scripts/${spec.script}.mjs`);
