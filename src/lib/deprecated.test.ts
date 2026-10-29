import assert from "node:assert/strict";
import { test } from "node:test";
import { deprecated } from "./deprecated.ts";

test("a deprecated part warns once per process, naming what replaces it", () => {
  const said: string[] = [];
  const warn = (message: string) => said.push(message);
  deprecated("oldPart()", "newPart()", warn);
  deprecated("oldPart()", "newPart()", warn);
  deprecated("OldBlock", "NewBlock", warn);
  assert.deepEqual(said, [
    "agentic-cms: oldPart() is deprecated and goes in the next breaking release; use newPart() (docs/stability.md)",
    "agentic-cms: OldBlock is deprecated and goes in the next breaking release; use NewBlock (docs/stability.md)",
  ]);
});
