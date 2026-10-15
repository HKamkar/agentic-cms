import { test } from "node:test";
import assert from "node:assert/strict";
import { keepWords } from "./text.ts";

test("keepWords makes a hyphen inside a word non-breaking", () => {
  assert.equal(keepWords("an end-to-end check"), "an end‑to‑end check");
  assert.equal(keepWords("Saint-Étienne and 24-7"), "Saint‑Étienne and 24‑7");
});

test("keepWords leaves a spaced dash and a leading or trailing hyphen alone", () => {
  assert.equal(keepWords("before - after"), "before - after");
  assert.equal(keepWords("-5 and pre-"), "-5 and pre-");
});

test("keepWords changes nothing else", () => {
  assert.equal(keepWords("no hyphen here"), "no hyphen here");
  assert.equal(keepWords(""), "");
});
