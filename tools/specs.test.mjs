import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { SPECS } from "../scripts/lib/specs.mjs";

test("every spec names a script that exists, and its command is its key", () => {
  for (const [key, spec] of Object.entries(SPECS)) {
    assert.equal(spec.command, key);
    assert.ok(spec.script, `${key} names its script`);
    assert.ok(fs.existsSync(path.resolve(import.meta.dirname, `../scripts/${spec.script}.mjs`)), `scripts/${spec.script}.mjs`);
    const leaves = spec.subcommands ? Object.values(spec.subcommands) : [spec];
    for (const leaf of leaves) {
      assert.ok(leaf.summary && leaf.usage && leaf.exit, `${leaf.command} has a summary, a usage and exit codes`);
      for (const [name, flag] of Object.entries(leaf.flags ?? {})) assert.ok(["number", "string", "boolean"].includes(flag.type), `${leaf.command} --${name} has a type`);
    }
  }
});
