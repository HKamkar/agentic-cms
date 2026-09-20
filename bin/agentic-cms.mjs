#!/usr/bin/env node
// The agentic-cms command line: one command per script under scripts/, run
// against the site in the current directory — its src/kit.ts for the registry
// and the config, its content/, public/, .next and .parity. A site's
// package.json names them: "content:lint": "agentic-cms lint", and so on.
// The commands, their flags and exit codes are scripts/lib/specs.mjs (the
// help and docs/commands.md are generated from it).
import { usageText } from "../scripts/lib/args.mjs";
import { SPECS } from "../scripts/lib/specs.mjs";

const [command, ...rest] = process.argv.slice(2);
const table = () => ["usage: agentic-cms <command> [options]", "", ...Object.values(SPECS).map((spec) => `  ${spec.command.padEnd(22)} ${spec.summary}`), "", "agentic-cms <command> --help prints its flags and exit codes; docs/commands.md is the contract"].join("\n");

if (!command || ["help", "--help", "-h"].includes(command)) {
  console.log(table());
  process.exit(command ? 0 : 2);
}
const spec = SPECS[command];
if (!spec) {
  console.error(`agentic-cms: no command ${command}\n\n${table()}`);
  process.exit(2);
}
if (rest.includes("--help") || rest.includes("-h")) {
  const sub = spec.subcommands && rest.find((a) => !a.startsWith("-"));
  console.log(usageText(sub && spec.subcommands[sub] ? spec.subcommands[sub] : spec));
  process.exit(0);
}
// The scripts read their own arguments from process.argv.slice(2).
process.argv.splice(2, 1);
await import(`../scripts/${spec.script}.mjs`);
