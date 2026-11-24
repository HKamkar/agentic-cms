import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ALLOW_BUILDS, mergeWorkspace } from "../scripts/lib/init.mjs";
import { BYPASSES, eslintEntries, unanswered } from "./bypass-fixture.mjs";
import { documentedInstall, installWithRetry, OLD_WORKSPACE, pnpmInitPackage } from "./pack-smoke.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const STALE = { status: 1, output: "Error: ERR_PNPM_NO_MATCHING_VERSION\n  No matching version found for @typescript-eslint/parser@8.71.2" };

/** A stand-in for pnpm: answers each call from the list and records the arguments. */
const fakePnpm = (...answers) => {
  const calls = [];
  return { calls, run: async (args) => { calls.push(args); return answers[calls.length - 1]; } };
};

test("an install that fails on stale metadata runs once more without --prefer-offline, and nothing else is retried", async () => {
  const logged = [];
  const stale = fakePnpm(STALE, { status: 0, output: "Done" });
  assert.equal((await installWithRetry(["install", "--prefer-offline", "--no-frozen-lockfile"], stale.run, (line) => logged.push(line))).status, 0);
  assert.deepEqual(stale.calls, [["install", "--prefer-offline", "--no-frozen-lockfile"], ["install", "--no-frozen-lockfile"]]);
  assert.match(logged.join("\n"), /without --prefer-offline/);

  const ok = fakePnpm({ status: 0, output: "Done" });
  await installWithRetry(["install", "--prefer-offline"], ok.run, () => {});
  assert.equal(ok.calls.length, 1, "a clean install runs once");

  const other = fakePnpm({ status: 1, output: "Error: ERR_PNPM_IGNORED_BUILDS" });
  assert.equal((await installWithRetry(["install", "--prefer-offline"], other.run, () => {})).status, 1);
  assert.equal(other.calls.length, 1, "any other failure is the smoke's to report");

  const online = fakePnpm(STALE);
  assert.equal((await installWithRetry(["install"], online.run, () => {})).status, 1);
  assert.equal(online.calls.length, 1, "an install already online has nothing to refresh");
});

test("the smoke runs docs/init.md's install line with the tarball for the git spec, and the README gives the same line", () => {
  const doc = read("docs/init.md");
  const args = documentedInstall(doc, { spec: "file:/tmp/agentic-cms-0.8.0.tgz", dir: "site" });
  assert.deepEqual(args, ["dlx", `--allow-build=${ALLOW_BUILDS[0]}`, "agentic-cms@file:/tmp/agentic-cms-0.8.0.tgz", "init", "site", "--name", "My Site"], "the build approval is the key init writes into the workspace; the site's name, required, one argument");
  const line = (text) => text.match(/^pnpm dlx .* init my-site --name "My Site"$/m)?.[0];
  assert.ok(line(doc));
  assert.equal(line(read("README.md")), line(doc));
  assert.match(line(doc), new RegExp(`#v${JSON.parse(read("package.json")).version.replaceAll(".", "\\.")} init my-site --name "My Site"$`), "the line installs the version the package is");
  assert.deepEqual(documentedInstall('pnpm dlx agentic-cms@github:HKamkar/agentic-cms#v0.9.0-rc.1 init my-site --name "X"\n', { spec: "file:x", dir: "site" }), ["dlx", "agentic-cms@file:x", "init", "site", "--name", "X"], "a candidate's tag is an install line too");
  assert.equal(documentedInstall("pnpm init\npnpm exec agentic-cms init . --name \"X\"\n", { spec: "file:x", dir: "site" }), null);
  assert.equal(documentedInstall("pnpm dlx agentic-cms@github:HKamkar/agentic-cms#v0.8.1 init my-site\n", { spec: "file:x", dir: "site" }), null, "a line without the name is no install line: init refuses it");
});

test("the smoke starts from what the old docs left, which init must repair", () => {
  const pkg = pnpmInitPackage("site", "12.4.1");
  assert.equal(pkg.scripts.test, 'echo "Error: no test specified" && exit 1');
  assert.equal(pkg.packageManager, "pnpm@12.4.1");
  assert.deepEqual(mergeWorkspace(OLD_WORKSPACE).added, ["unrs-resolver"]);
});

test("the bypass fixture covers every row of the 0.8.2 plan's survey, each with the check that must answer it", () => {
  const plan = read("docs/roadmap-0.8.2.md");
  const survey = plan.slice(plan.indexOf("## What gets around the kit today"), plan.indexOf("## Decisions"));
  const rows = [...survey.matchAll(/^\| ([^|]+?) \| (required|preferred|—) \|/gm)].map(([, part]) => part);
  const covered = new Set(BYPASSES.map((bypass) => bypass.part.split(":")[0]));
  assert.deepEqual(rows.filter((part) => !covered.has(part)), [], "a survey row with no bypass in the fixture");
  for (const bypass of BYPASSES) assert.ok([bypass.eslint, bypass.report, bypass.content, bypass.agentFiles].some((answers) => answers?.length), `${bypass.part}: nothing must answer it`);
  for (const bypass of BYPASSES.filter((b) => b.tier === "preferred")) assert.ok((bypass.eslint ?? []).every((want) => want.severity === "warning") && (bypass.report ?? []).every((re) => re.source.includes("⚠")), `${bypass.part}: a preferred bypass warns`);
  for (const bypass of BYPASSES.filter((b) => b.tier === "required")) assert.ok((bypass.eslint ?? []).every((want) => want.severity === "error") && (bypass.report ?? []).every((re) => !re.source.includes("⚠")), `${bypass.part}: a required bypass fails`);
});

test("the lint's ESLint report is read by file, and a bypass its check did not answer is named", () => {
  const output = "/s/src/components/ui/Promo.tsx\n  2:13  error  No copy in a primitive: …  agentic-cms/copy\n\n/s/src/components/ui/Chart.tsx\n  2:10  warning  A <canvas> draws: the lab  agentic-cms/graphics\n\n✖ 2 problems\n";
  const entries = eslintEntries(output, "/s");
  assert.deepEqual(entries.get("src/components/ui/Chart.tsx"), [{ line: 2, severity: "warning", message: "A <canvas> draws: the lab", rule: "agentic-cms/graphics" }]);
  const missing = unanswered({ lint: output, content: "", agentFiles: "", entries });
  assert.ok(missing.some((line) => line.startsWith("Forms (required): no error of agentic-cms/forms in src/components/ui/Signup.tsx")), missing.join("\n"));
  assert.ok(!missing.some((line) => line.includes("agentic-cms/graphics")), "the canvas warned");
  assert.ok(missing.some((line) => line.startsWith("The starter (required): the content lint printed nothing matching")));
});
