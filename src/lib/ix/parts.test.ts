import assert from "node:assert/strict";
import { test } from "node:test";
import { LOOP_KINDS, PART_KINDS, part, staggerDelay } from "./parts.ts";

test("a part carries its kind and its delay, in whole milliseconds", () => {
  assert.deepEqual(part("rise", 120), { "data-part": "rise", style: { "--d": "120ms" } });
  assert.deepEqual(part("fade"), { "data-part": "fade", style: { "--d": "0ms" } });
  assert.deepEqual(part("draw", 99.6).style, { "--d": "100ms" });
});

test("a part keeps the element's own style beside its variables, and its variables win", () => {
  assert.deepEqual(part("pop", 300, { style: { color: "red" } }).style, { color: "red", "--d": "300ms" });
  assert.deepEqual(part("pop", 300, { style: { "--d": "9s" } as never }).style, { "--d": "300ms" });
});

test("a dim part says how far it fades, clamped to 0..1; no other part carries --dim", () => {
  const dim = (value: number) => (part("dim", 0, { dim: value }).style as Record<string, string>)["--dim"];
  assert.equal(dim(0.2), "0.2");
  assert.equal(dim(3), "1");
  assert.equal(dim(-1), "0");
  assert.equal("--dim" in part("dim").style, false);
});

test("a part refuses an unknown kind or a delay that is not milliseconds", () => {
  assert.throws(() => part("spin" as never), /unknown kind "spin"/);
  assert.throws(() => part("fade", -5), /0 or more/);
  assert.throws(() => part("fade", Number.NaN), /0 or more/);
  assert.throws(() => part("fade", Infinity), /0 or more/);
});

test("a stagger steps by the given milliseconds, or by the site's --motion-stagger", () => {
  assert.equal(staggerDelay(0, 100, 80), "100ms");
  assert.equal(staggerDelay(3, 100, 80), "340ms");
  assert.equal(staggerDelay(2), "calc(0ms + 2 * var(--motion-stagger))");
  assert.equal(staggerDelay(1, 200), "calc(200ms + 1 * var(--motion-stagger))");
  assert.throws(() => staggerDelay(-1), /0, 1, 2/);
  assert.throws(() => staggerDelay(1.5), /0, 1, 2/);
});

test("the ten kinds, three of them loops", () => {
  assert.deepEqual([...PART_KINDS], ["fade", "rise", "scale", "pop", "draw", "grow", "dim", "flow", "pulse", "breathe"]);
  assert.deepEqual([...LOOP_KINDS], ["flow", "pulse", "breathe"]);
  for (const kind of PART_KINDS) assert.equal(part(kind)["data-part"], kind);
});
