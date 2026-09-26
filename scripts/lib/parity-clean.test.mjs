import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CACHE, VISUAL, planClean, readEntries, removeEntries } from "./parity-clean.mjs";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 26, 12);
const capture = (name, finishedHoursAgo, startedHoursAgo = finishedHoursAgo) => ({ name, kind: "capture", finished: finishedHoursAgo === null ? null : NOW - finishedHoursAgo * HOUR, started: NOW - startedHoursAgo * HOUR, bytes: 10 });
const compare = (before, after) => ({ name: `${before}-vs-${after}`, kind: "compare", before, after, bytes: 1 });

test("the newest `keep` finished captures stay, the rest go, and a compare goes with either of its captures", () => {
  const entries = [capture("a", 5), capture("b", 1), capture("c", 3), compare("a", "b"), compare("b", "c"), compare("c", "gone")];
  const plan = planClean(entries, { keep: 2, now: NOW });
  assert.deepEqual(plan.remove, ["a", "a-vs-b", "c-vs-gone"]);
  assert.deepEqual(plan.keep, ["b", "c", "b-vs-c"]);
});

test("a capture still running (no capture.json, under a day old) is kept, even with --all; a dead one goes", () => {
  const entries = [capture("done", 2), capture("running", null, 0.1), capture("dead", null, 30)];
  assert.deepEqual(planClean(entries, { all: true, now: NOW }), { remove: ["done", "dead"], keep: ["running"] });
  assert.deepEqual(planClean(entries, { keep: 10, now: NOW }).remove, ["dead"]);
});

function parity(tree) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "parity-clean-"));
  for (const [file, age] of Object.entries(tree)) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "x".repeat(100));
    if (age !== null) fs.utimesSync(full, new Date(NOW - age * HOUR), new Date(NOW - age * HOUR));
  }
  return root;
}

test("the entries read from disk: captures by their meta.json, compares split into their two captures, finish times from capture.json", () => {
  const root = parity({ [`${VISUAL}/a/meta.json`]: 5, [`${VISUAL}/a/capture.json`]: 4, [`${VISUAL}/a/home@390.png`]: 4, [`${VISUAL}/b-vs-x/meta.json`]: 2, [`${VISUAL}/a-vs-b-vs-x/report.json`]: 1, [`${VISUAL}/loose/notes.txt`]: 1 });
  const entries = Object.fromEntries(readEntries(root).map((e) => [e.name, e]));
  assert.equal(entries.a.kind, "capture");
  assert.equal(entries.a.finished, NOW - 4 * HOUR);
  assert.equal(entries.a.bytes, 300);
  assert.equal(entries["b-vs-x"].kind, "capture", "a label with -vs- in it that holds a capture is a capture");
  assert.deepEqual([entries["a-vs-b-vs-x"].before, entries["a-vs-b-vs-x"].after], ["a", "b-vs-x"], "the split whose sides both exist");
  assert.equal(entries.loose.kind, "compare");
  assert.equal(entries.loose.before, null, "a directory that is neither goes with the compares of nothing");
  assert.deepEqual(readEntries(path.join(root, "nowhere")), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test("removal stays inside .parity/visual (and the cache with --cache) and counts the bytes", () => {
  const root = parity({ [`${VISUAL}/a/meta.json`]: 1, [`${VISUAL}/b/meta.json`]: 1, [`${CACHE}/k/home@390/x/deps.json`]: 1, "keep-me.txt": 1 });
  assert.equal(removeEntries(root, ["a", "missing"]), 100);
  assert.ok(!fs.existsSync(path.join(root, VISUAL, "a")) && fs.existsSync(path.join(root, VISUAL, "b")));
  assert.throws(() => removeEntries(root, ["../../keep-me.txt"]), /refusing to remove/);
  assert.throws(() => removeEntries(root, ["b/../../shot-cache"]), /refusing to remove/);
  assert.ok(fs.existsSync(path.join(root, "keep-me.txt")) && fs.existsSync(path.join(root, CACHE)));
  assert.equal(removeEntries(root, [], { cache: true }), 100);
  assert.ok(!fs.existsSync(path.join(root, CACHE)));
  fs.rmSync(root, { recursive: true, force: true });
});
