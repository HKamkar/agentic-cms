import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "./args.mjs";
import { DEFAULT_WIDTHS, MENU_WIDTHS, MOTION_WIDTHS, captureWidths, menuWidths, proofSettings, schemeOf } from "./profile.mjs";
import { forwarded, labelOf, passesOf, plan, runProof } from "./proof.mjs";
import { SPECS } from "./specs.mjs";

test("the passes: static alone by default, motion and states when asked, all three with all", () => {
  assert.deepEqual(passesOf({}), ["static"]);
  assert.deepEqual(passesOf({ states: true }), ["static", "states"]);
  assert.deepEqual(passesOf({ all: true }), ["static", "motion", "states"]);
  assert.equal(labelOf("x", "before", "static"), "x-before");
  assert.equal(labelOf("x", "after", "motion"), "x-after-motion");
});

test("the plan: per pass, the baseline of the ref, the after capture, the compare; the scheme and shared options on both sides, --sample on the static pass, --build once", () => {
  const steps = plan({ label: "p", ref: "main", passes: ["static", "motion"], schemes: ["dark"], build: true, pages: ["--pages", "/,/blog"], sample: ["--sample", "1"] });
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

test("--widths reaches the static pass alone, as --sample does: --motion keeps its widths and --states its 1440", () => {
  const steps = plan({ passes: ["static", "motion", "states"], widths: ["--widths", "390,1440"], sample: ["--sample", "1"] });
  const captures = steps.filter((s) => s.step !== "compare");
  assert.deepEqual(captures.filter((s) => s.args.includes("--widths")).map((s) => s.label), ["proof-before", "proof-after"]);
  assert.ok(steps.filter((s) => s.step === "compare").every((s) => !s.args.includes("--widths")), "a compare judges what the captures took");
  assert.deepEqual(captureWidths({ motion: true, profile: { widths: [390, 768] } }), MOTION_WIDTHS, "a motion capture keeps its own widths over the profile's");
  assert.deepEqual(captureWidths({ flag: "1440,390", motion: true }), [1440, 390], "a flag still names them");
});

test("two schemes in the profile run every pass once in each, the dark one's captures and pass ending in -dark; one scheme keeps the plain labels", () => {
  const steps = plan({ passes: ["static", "states"], schemes: ["light", "dark"], build: true });
  assert.deepEqual(steps.filter((s) => s.step === "before").map((s) => [s.pass, s.label, s.args[s.args.indexOf("--scheme") + 1]]), [["static", "proof-before", "light"], ["states", "proof-before-states", "light"], ["static-dark", "proof-before-dark", "dark"], ["states-dark", "proof-before-states-dark", "dark"]]);
  assert.deepEqual(steps.filter((s) => s.step === "compare").map((s) => s.args.slice(1, 3)), [["proof-before", "proof-after"], ["proof-before-states", "proof-after-states"], ["proof-before-dark", "proof-after-dark"], ["proof-before-states-dark", "proof-after-states-dark"]]);
  assert.equal(steps.filter((s) => s.args.includes("--build")).length, 1, "the tree is built once, before the first after capture");
  assert.deepEqual(plan({ schemes: ["dark"] }).map((s) => s.args[1]), ["proof-before", "proof-after", "proof-before"], "--scheme dark alone: the labels it always had");
});

test("precedence: a flag, then the site's profile, then the built-in default", () => {
  const profile = { widths: [390, 768, 1440, 1920], schemes: ["light", "dark"], proof: { pages: ["/", "/blog"], ref: "main" } };
  assert.deepEqual(proofSettings({}, profile), { ref: "main", schemes: ["light", "dark"], pages: "/,/blog", sample: undefined }, "the profile");
  assert.deepEqual(proofSettings({ ref: "HEAD~1", scheme: "dark", pages: "/about" }, profile), { ref: "HEAD~1", schemes: ["dark"], pages: "/about", sample: undefined }, "the flags");
  assert.deepEqual(proofSettings({ sample: 1 }, profile), { ref: "main", schemes: ["light", "dark"], pages: undefined, sample: 1 }, "--sample picks the pages: the profile's give way");
  assert.deepEqual(proofSettings({}, { widths: [390], schemes: undefined, proof: { pages: undefined, ref: undefined, sample: undefined } }), { ref: "develop", schemes: ["light"], pages: undefined, sample: undefined }, "a key the profile leaves out is the default");
  assert.equal(schemeOf("dark", profile), "dark");
  assert.equal(schemeOf(undefined, { schemes: ["dark", "light"] }), "dark", "one capture takes the profile's first scheme");
  assert.deepEqual(captureWidths({ flag: "800,1200", profile }), [800, 1200]);
  assert.deepEqual(captureWidths({ profile }), [390, 768, 1440, 1920]);
  assert.deepEqual(menuWidths(profile), [390, 768, 1440, 1920], "the menu is tried at every profile width and opened where its button shows");
});

test("the profile's proof.sample is the static pass's --sample: a --sample flag wins, a --pages flag sets it aside, and neither reaches --motion or --states", () => {
  const profile = { widths: [390, 1440], schemes: ["light"], proof: { pages: undefined, ref: undefined, sample: 1 } };
  assert.deepEqual(proofSettings({}, profile), { ref: "develop", schemes: ["light"], pages: undefined, sample: 1 }, "the profile's sample");
  assert.equal(proofSettings({ sample: 3 }, profile).sample, 3, "the flag wins");
  assert.deepEqual([proofSettings({ pages: "/about" }, profile).pages, proofSettings({ pages: "/about" }, profile).sample], ["/about", undefined], "--pages names its own pages: the profile's sample gives way");
  const { ref, schemes, pages, sample } = proofSettings({}, profile);
  const steps = plan({ ref, schemes, passes: ["static", "motion", "states"], pages: forwarded({ pages }, ["pages"]), sample: forwarded({ sample }, ["sample"]) });
  assert.deepEqual(steps.filter((s) => s.args.includes("--sample")).map((s) => [s.label, s.args[s.args.indexOf("--sample") + 1]]), [["proof-before", "1"], ["proof-after", "1"]], "the static pass's two captures, as --sample does");
  assert.ok(steps.every((s) => !s.args.includes("--pages")), "no --pages beside it");
  assert.match(SPECS["visual-parity"].subcommands.proof.flags.sample.help, /default the profile's proof\.sample \(src\/config\/harness\.ts\) unless --pages is given/);
});

test("without a profile, a bare command does what it did: the parser fills no scheme and no ref, and the fallbacks are the old defaults", () => {
  const bare = parse(SPECS["visual-parity"], ["proof"]).flags;
  assert.equal(bare.scheme, undefined, "the parser leaves --scheme to the profile");
  assert.equal(bare.ref, undefined, "and --ref");
  for (const spec of [SPECS["visual-parity"].subcommands.capture, SPECS.shot, SPECS.probe, SPECS.sheet, SPECS.icons.subcommands.audit, SPECS.icons.subcommands.round.subcommands.publish, SPECS.lab.subcommands.render]) {
    assert.equal(spec.flags.scheme.default, undefined, `${spec.command}: --scheme has no default`);
    assert.match(spec.flags.scheme.help, /default the first of the profile's schemes \(src\/config\/harness\.ts\), else light/, `${spec.command}'s help names the fallback`);
  }
  assert.match(SPECS["visual-parity"].subcommands.proof.flags.ref.help, /default the profile's proof\.ref \(src\/config\/harness\.ts\), else develop/);
  assert.deepEqual(proofSettings(bare, null), { ref: "develop", schemes: ["light"], pages: undefined, sample: undefined });
  assert.equal(schemeOf(undefined, null), "light");
  assert.deepEqual(captureWidths({ profile: null }), DEFAULT_WIDTHS);
  assert.deepEqual(DEFAULT_WIDTHS, [1920, 1440, 1280, 1100, 992, 800, 767, 390]);
  assert.deepEqual(menuWidths(null), MENU_WIDTHS);
  assert.deepEqual(MENU_WIDTHS, [767, 390]);
  const { ref, schemes, pages } = proofSettings(bare, null);
  assert.deepEqual(plan({ ref, schemes, pages: forwarded({ pages }, ["pages"]) }).map((s) => s.args), [
    ["capture", "proof-before", "--ref", "develop", "--scheme", "light", "--json"],
    ["capture", "proof-after", "--scheme", "light", "--json"],
    ["compare", "proof-before", "proof-after", "--json"],
  ], "the commands a bare proof ran before profiles");
});

test("no step of a plan carries both --ref and --build: a capture refuses two sources of one build", () => {
  for (const passes of [["static"], ["static", "motion", "states"]]) {
    const steps = plan({ passes, build: true });
    assert.ok(steps.every((s) => !(s.args.includes("--ref") && s.args.includes("--build"))), passes.join(","));
    assert.equal(steps.filter((s) => s.args.includes("--build")).length, 1, "the tree is built once");
  }
});

test("the proof's flags forwarded to its captures: a value after its flag, a repeatable one per value, a boolean as itself, nothing for one not given", () => {
  const flags = { scheme: "dark", jobs: 2, fresh: false, "no-storage": true, storage: ["consent={\"at\":\"{now}\"}", "theme=dark"], "session-storage": [], pages: undefined };
  assert.deepEqual(forwarded(flags, ["scheme", "jobs", "fresh", "storage", "session-storage", "no-storage", "pages"]), ["--scheme", "dark", "--jobs", "2", "--storage", "consent={\"at\":\"{now}\"}", "--storage", "theme=dark", "--no-storage"]);
  const steps = plan({ shared: forwarded(flags, ["storage"]) });
  assert.deepEqual(steps.filter((s) => s.step !== "compare").map((s) => s.args.slice(-5, -1)), [["--storage", "consent={\"at\":\"{now}\"}", "--storage", "theme=dark"], ["--storage", "consent={\"at\":\"{now}\"}", "--storage", "theme=dark"]], "the seed on both sides");
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
