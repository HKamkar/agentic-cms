import assert from "node:assert/strict";
import { test } from "node:test";
import { tables } from "./rules-table.mjs";

test("the kit's AGENTS.md and the site template carry the scoped-rules table their rules write, and stay within what Codex reads", () => {
  for (const { file, placed, bytes, budget } of tables()) {
    assert.equal(placed.status, "ok", `${file}: run pnpm docs:rules`);
    assert.ok(bytes <= budget, `${file}: ${bytes} bytes, over its ${budget}-byte budget`);
  }
});
