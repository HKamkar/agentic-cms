import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parse } from "../scripts/lib/args.mjs";
import { SPECS } from "../scripts/lib/specs.mjs";


/** The commands that run: a spec without subcommands, else its subcommands' leaves, however deep. */
const leavesOf = (spec) => (spec.subcommands ? Object.values(spec.subcommands).flatMap(leavesOf) : [spec]);

test("every spec names a script that exists, and its command is its key", () => {
  for (const [key, spec] of Object.entries(SPECS)) {
    assert.equal(spec.command, key);
    assert.ok(spec.script, `${key} names its script`);
    assert.ok(fs.existsSync(path.resolve(import.meta.dirname, `../scripts/${spec.script}.mjs`)), `scripts/${spec.script}.mjs`);
    assert.ok(spec.group, `${key} names its family`);
    const leaves = leavesOf(spec);
    for (const leaf of leaves) {
      assert.ok(leaf.summary && leaf.usage && leaf.exit, `${leaf.command} has a summary, a usage and exit codes`);
      assert.ok(Array.isArray(leaf.examples) && leaf.examples.length && leaf.examples.every((e) => e.startsWith(`agentic-cms ${leaf.command}`)), `${leaf.command} has an example, and it starts with the command`);
      for (const [name, flag] of Object.entries(leaf.flags ?? {})) {
        assert.ok(["number", "string", "boolean"].includes(flag.type), `${leaf.command} --${name} has a type`);
        if (flag.choices) assert.ok(flag.choices.length > 1 && (flag.default === undefined || flag.choices.includes(flag.default)), `${leaf.command} --${name}: choices and the default among them`);
      }
    }
  }
});

test("a command whose help says what --json prints takes --json: probe, which prints nothing else, takes it too", () => {
  for (const leaf of Object.values(SPECS).flatMap(leavesOf).filter((spec) => spec.json)) {
    assert.equal(leaf.flags?.json?.type, "boolean", `${leaf.command}: its help says "--json prints ${leaf.json.slice(0, 30)}…", so --json is a flag`);
  }
  assert.equal(parse(SPECS.probe, ["/", "--select", ".card", "--motion", "--json"]).flags.json, true);
});
