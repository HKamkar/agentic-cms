import assert from "node:assert/strict";
import { test } from "node:test";
import { labelOf, passesOf, plan, runProof } from "./proof.mjs";

test("the passes: static alone by default, motion and states when asked, all three with all", () => {
  assert.deepEqual(passesOf({}), ["static"]);
  assert.deepEqual(passesOf({ states: true }), ["static", "states"]);
  assert.deepEqual(passesOf({ all: true }), ["static", "motion", "states"]);
  assert.equal(labelOf("x", "before", "static"), "x-before");
  assert.equal(labelOf("x", "after", "motion"), "x-after-motion");
});

test("the plan: per pass, the baseline of the ref, the after capture, the compare; shared options on both sides, --sample on the static pass, --build once", () => {
  const steps = plan({ label: "p", ref: "main", passes: ["static", "motion"], build: true, shared: ["--scheme", "dark"], pages: ["--pages", "/,/blog"], sample: ["--sample", "1"] });
  assert.deepEqual(steps.map((s) => s.args), [
    ["capture", "p-before", "--ref", "main", "--scheme", "dark", "--pages", "/,/blog", "--sample", "1", "--json"],
    ["capture", "p-after", "--scheme", "dark", "--pages", "/,/blog", "--sample", "1", "--build", "--json"],
    ["compare", "p-before", "p-after", "--pages", "/,/blog", "--json"],
    ["capture", "p-before-motion", "--ref", "main", "--motion", "--scheme", "dark", "--pages", "/,/blog", "--json"],
    ["capture", "p-after-motion", "--motion", "--scheme", "dark", "--pages", "/,/blog", "--json"],
    ["compare", "p-before-motion", "p-after-motion", "--pages", "/,/blog", "--json"],
  ]);
  assert.deepEqual(plan().map((s) => s.args[1]), ["proof-before", "proof-after", "proof-before"], "defaults: label proof, ref develop, the static pass");
  assert.equal(plan()[0].args[3], "develop");
});

const capture = (label) => ({ status: 0, stdout: JSON.stringify({ label, files: 3 }) });
const compare = (exit) => ({ status: exit, stdout: JSON.stringify({ summary: { ok: exit ? 2 : 3, changed: exit ? 1 : 0, exit } }) });

test("a run reads each step's JSON; exit 0 when every compare is clean, 1 when one is not", async () => {
  const steps = plan({ passes: ["static", "states"] });
  let t = 0;
  const clean = await runProof(steps, { run: (args) => (args[0] === "compare" ? compare(0) : capture(args[1])), now: () => (t += 1000) });
  assert.equal(clean.exit, 0);
  assert.deepEqual(clean.passes.map((p) => [p.pass, p.before.label, p.after.label, p.report.summary.ok, p.seconds]), [["static", "proof-before", "proof-after", 3, 3], ["states", "proof-before-states", "proof-after-states", 3, 3]]);
  const differs = await runProof(steps, { run: (args) => (args[0] === "compare" ? compare(args[1].endsWith("states") ? 1 : 0) : capture(args[1])) });
  assert.equal(differs.exit, 1);
});

test("a capture that fails stops the proof with its exit code and names the step; a compare's usage error does too", async () => {
  const steps = plan({ passes: ["static", "motion"] });
  const seen = [];
  const stalled = await runProof(steps, { run: (args) => { seen.push(args[1]); return args[1] === "proof-after" ? { status: 1, stdout: "" } : capture(args[1]); } });
  assert.equal(stalled.exit, 1);
  assert.equal(stalled.failed.label, "proof-after");
  assert.deepEqual(seen, ["proof-before", "proof-after"], "nothing after the failed step runs");
  const usage = await runProof(steps, { run: (args) => (args[0] === "compare" ? { status: 2, stdout: "" } : capture(args[1])) });
  assert.equal(usage.exit, 2);
  assert.equal(usage.failed.step, "compare");
});
