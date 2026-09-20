import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { commandsMarkdown, END, START } from "./commands-doc.mjs";
import { SPECS } from "../scripts/lib/specs.mjs";

test("the generated block documents every command, subcommand, flag and exit code of the specs", () => {
  const md = commandsMarkdown(SPECS);
  for (const spec of Object.values(SPECS)) {
    assert.match(md, new RegExp(`^### \`${spec.command.replace(/[-]/g, "\\-")}\``, "m"));
    const leaves = spec.subcommands ? Object.values(spec.subcommands) : [spec];
    for (const leaf of leaves) {
      for (const [name, flag] of Object.entries(leaf.flags ?? {})) assert.ok(md.includes(`\`--${name}${flag.type === "boolean" ? "" : ` ${flag.value ?? "<n>"}`}\``), `${leaf.command} --${name}`);
      for (const [code, what] of Object.entries(leaf.exit ?? {})) assert.ok(md.includes(`\`${code}\` ${what}`), `${leaf.command} exit ${code}`);
    }
  }
  assert.ok(md.startsWith(START) && md.endsWith(END));
});

test("docs/commands.md carries the current block", () => {
  const file = fs.readFileSync(new URL("../docs/commands.md", import.meta.url), "utf8");
  const from = file.indexOf(START), to = file.indexOf(END) + END.length;
  assert.ok(from !== -1 && to > from, "docs/commands.md has the markers");
  assert.equal(file.slice(from, to), commandsMarkdown(SPECS), "run node tools/commands-doc.mjs and commit docs/commands.md");
});
