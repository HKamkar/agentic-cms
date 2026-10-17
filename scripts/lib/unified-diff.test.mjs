import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { unifiedDiff } from "./unified-diff.mjs";

const lines = (n, edit = {}) => Array.from({ length: n }, (_, i) => `${edit[i + 1] ?? `line ${i + 1}`}\n`).join("");

test("unifiedDiff: nothing for the same text; a change with three lines of context, removals before additions", () => {
  assert.equal(unifiedDiff("a\nb\n", "a\nb\n"), "");
  assert.equal(unifiedDiff(lines(10), lines(10, { 5: "five" }), { from: "a/x.md", to: "b/x.md" }), "--- a/x.md\n+++ b/x.md\n@@ -2,7 +2,7 @@\n line 2\n line 3\n line 4\n-line 5\n+five\n line 6\n line 7\n line 8\n");
});

test("unifiedDiff: changes closer than twice the context share a hunk, farther ones do not; empty sides and a missing last newline", () => {
  assert.equal((unifiedDiff(lines(20), lines(20, { 3: "x", 9: "y" })).match(/^@@/gm) ?? []).length, 1);
  assert.equal((unifiedDiff(lines(20), lines(20, { 3: "x", 11: "y" })).match(/^@@/gm) ?? []).length, 2);
  assert.equal(unifiedDiff("", "a\n"), "--- a\n+++ b\n@@ -0,0 +1 @@\n+a\n");
  assert.equal(unifiedDiff("a\n", ""), "--- a\n+++ b\n@@ -1 +0,0 @@\n-a\n");
  assert.equal(unifiedDiff("a\nb", "a\nb\n"), "--- a\n+++ b\n@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+b\n");
});

test("unifiedDiff: what it prints, git apply takes, onto the text it came from", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unified-diff-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = lines(40);
  const after = lines(40, { 2: "two", 20: "twenty\nand a new line", 39: "thirty-nine" }).replace("line 30\n", "");
  fs.writeFileSync(path.join(dir, "x.md"), before);
  fs.writeFileSync(path.join(dir, "x.patch"), unifiedDiff(before, after, { from: "a/x.md", to: "b/x.md" }));
  const applied = spawnSync("git", ["apply", "x.patch"], { cwd: dir, encoding: "utf8" });
  if (applied.error) return t.skip("no git on this machine");
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(fs.readFileSync(path.join(dir, "x.md"), "utf8"), after);
});
