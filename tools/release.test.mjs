import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { atLeast, changelogSection, distTag, integrity, parseTag, publishPlan, registrySite, registryState, releaseNotes, tagFindings } from "./release.mjs";

const CHANGELOG = "# Changelog\n\nIntro.\n\n## [Unreleased]\n\n- Added: a line.\n\n## [0.9.0] — 2026-11-02\n\n- Added: npm.\n- Fixed: a bug.\n\n## [0.8.4] — 2026-10-23\n\n- Fixed: the baseline.\n";

test("a tag is a release or a candidate, and a candidate goes to next", () => {
  assert.deepEqual(parseTag("v0.9.0"), { version: "0.9.0", candidate: false });
  assert.deepEqual(parseTag("v0.9.0-rc.0"), { version: "0.9.0-rc.0", candidate: true });
  for (const tag of ["0.9.0", "v0.9", "v0.9.0-beta.1", "v0.9.0-rc", "v0.9.0-rc.1-x", undefined]) assert.equal(parseTag(tag), null, String(tag));
  assert.equal(distTag("0.9.0-rc.3"), "next");
  assert.equal(distTag("0.9.0"), "latest");
});

test("a release tag sits on main with its changelog section; a candidate sits on develop; the tag names package.json's version", () => {
  const base = { onMain: true, onDevelop: true, changelog: CHANGELOG };
  assert.deepEqual(tagFindings({ ...base, tag: "v0.9.0", version: "0.9.0" }), []);
  assert.deepEqual(tagFindings({ ...base, tag: "v0.9.0-rc.1", version: "0.9.0-rc.1", onMain: false }), [], "a candidate needs no section and no main");
  assert.match(tagFindings({ ...base, tag: "v0.9.0", version: "0.9.0", onMain: false })[0], /not on main's history/);
  assert.match(tagFindings({ ...base, tag: "v0.9.0-rc.1", version: "0.9.0-rc.1", onDevelop: false })[0], /not on develop's history/);
  assert.match(tagFindings({ ...base, tag: "v0.9.1", version: "0.9.1" })[0], /no "## \[0\.9\.1\]" section/);
  assert.match(tagFindings({ ...base, tag: "v0.9.0-rc.2", version: "0.9.0-rc.1" })[0], /is not package\.json's version, 0\.9\.0-rc\.1/);
  assert.match(tagFindings({ ...base, tag: "release-1", version: "0.9.0" })[0], /neither vX\.Y\.Z nor vX\.Y\.Z-rc\.N/);
  assert.deepEqual(tagFindings({ ...base, version: "0.9.0-rc.1", onMain: false, onDevelop: false }), [], "a dry run checks the version alone");
  assert.match(tagFindings({ ...base, version: "0.9.0-beta.1" })[0], /neither a release/);
});

test("the GitHub Release's text is the version's section; a candidate without one takes its release's, then Unreleased's", () => {
  assert.equal(changelogSection(CHANGELOG, "0.9.0"), "- Added: npm.\n- Fixed: a bug.");
  assert.equal(changelogSection(CHANGELOG, "0.8.4"), "- Fixed: the baseline.");
  assert.equal(changelogSection(CHANGELOG, "0.7.0"), null);
  assert.equal(releaseNotes(CHANGELOG, "0.9.0"), "- Added: npm.\n- Fixed: a bug.");
  assert.match(releaseNotes(CHANGELOG, "0.9.0-rc.2"), /^A release candidate of 0\.9\.0\. Its changes so far:\n\n- Added: npm\./);
  assert.match(releaseNotes(CHANGELOG.replace(/## \[0\.9\.0\][\s\S]*?(?=## \[0\.8\.4\])/, ""), "0.9.0-rc.0"), /Its changes so far:\n\n- Added: a line\.$/);
  assert.match(releaseNotes("# Changelog\n", "0.9.0-rc.0"), /CHANGELOG\.md gets its lines with the release/);
});

test("the floors compare by number, a prerelease suffix aside", () => {
  assert.ok(atLeast("11.5.1", "11.5.1"));
  assert.ok(atLeast("11.10.0", "11.5.1"));
  assert.ok(!atLeast("11.4.9", "11.5.1"));
  assert.ok(atLeast("v26.8.2", "22.14.0"));
  assert.ok(!atLeast("v22.13.1", "22.14.0"));
  assert.ok(atLeast("12.0.0-pre.1", "11.5.1"));
});

test("a tarball's integrity is npm's form, and the registry's answer decides the publish", () => {
  const bytes = Buffer.from("a tarball");
  assert.equal(integrity(bytes), `sha512-${crypto.createHash("sha512").update(bytes).digest("base64")}`);
  const sri = integrity(bytes);
  assert.equal(registryState({ status: 1, stdout: "", stderr: "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/agentic-cms - Not found" }, sri), "absent", "no package yet");
  assert.equal(registryState({ status: 0, stdout: "", stderr: "" }, sri), "absent", "the package, not the version");
  assert.equal(registryState({ status: 0, stdout: JSON.stringify(sri), stderr: "" }, sri), "same");
  assert.equal(registryState({ status: 0, stdout: JSON.stringify(integrity(Buffer.from("other"))), stderr: "" }, sri), "different");
  assert.throws(() => registryState({ status: 1, stdout: "", stderr: "npm error code ETIMEDOUT" }, sri), /npm view failed/);
  const at = { name: "agentic-cms", version: "0.9.0-rc.0" };
  assert.equal(publishPlan("absent", at).publish, true);
  assert.match(publishPlan("same", at).say, /from this same tarball .* nothing to publish/);
  assert.equal(publishPlan("same", at).publish, false);
  assert.match(publishPlan("different", at).fail, /never published twice/);
});

test("the registry's smoke site installs the version under test with no build approval for the kit, the others kept", () => {
  const workspace = 'allowBuilds:\n  "agentic-cms@git+https://github.com/HKamkar/agentic-cms.git": true\n  sharp: true\n  unrs-resolver: true\n';
  const pkg = { name: "smoke", dependencies: { "agentic-cms": "github:HKamkar/agentic-cms#v0.9.0-rc.1", next: "16.3.8" } };
  const site = registrySite({ pkg, workspace }, "0.9.0-rc.1");
  assert.deepEqual(site.pkg.dependencies, { "agentic-cms": "0.9.0-rc.1", next: "16.3.8" });
  assert.equal(site.workspace, "allowBuilds:\n  sharp: true\n  unrs-resolver: true\n");
  assert.equal(registrySite({ pkg, workspace: "allowBuilds:\n  sharp: true\n" }, "0.9.0").workspace, "allowBuilds:\n  sharp: true\n", "a workspace without the kit's approval stays as it is");
});

const ROOT = new URL("..", import.meta.url);
const workflow = (name) => parseYaml(fs.readFileSync(new URL(`.github/workflows/${name}`, ROOT), "utf8"));
const uses = (job) => job.steps.filter((step) => step.uses).map((step) => step.uses);

test("release.yml: only a tag's run publishes, in the environment npm with an OIDC token, from the artifact alone; the dry run has neither", () => {
  const { on, jobs, permissions } = workflow("release.yml");
  assert.deepEqual(on.push.tags, ["v*"]);
  assert.ok("workflow_dispatch" in on);
  assert.deepEqual(permissions, { contents: "read" });
  assert.deepEqual(jobs.check.permissions, undefined, "check reads, as the workflow's token allows");
  const { publish, "dry-run": dry, after } = jobs;
  assert.equal(publish.if, "github.event_name == 'push'");
  assert.equal(publish.environment, "npm");
  assert.deepEqual(publish.permissions, { contents: "read", "id-token": "write" });
  for (const job of [publish, dry]) {
    const runs = job.steps.filter((step) => step.run).map((step) => step.run);
    assert.ok(runs.every((run) => /^node tools\/release\.mjs publish /.test(run)), "it runs the publish and nothing else: no install");
    assert.equal(job.steps.find((step) => step.uses?.startsWith("actions/setup-node@")).with["package-manager-cache"], false, "no cache reaches the publish");
    assert.ok(!uses(job).some((action) => action.startsWith("pnpm/")));
  }
  assert.equal(dry.if, "github.event_name == 'workflow_dispatch'");
  assert.equal(dry.environment, undefined);
  assert.equal(dry.permissions, undefined, "no token: the workflow's contents: read");
  assert.match(dry.steps.at(-1).run, / --dry-run$/);
  assert.deepEqual(after.needs, ["check", "publish"]);
  assert.deepEqual(after.permissions, { contents: "write" });
  assert.ok(jobs.check.steps.some((step) => step.run === 'pnpm test:pack --keep "$RUNNER_TEMP/release"'));
});

test("every workflow pins each action to a commit with its version, the same pin wherever it is used", () => {
  const pins = new Map();
  for (const name of fs.readdirSync(new URL(".github/workflows/", ROOT))) {
    const text = fs.readFileSync(new URL(`.github/workflows/${name}`, ROOT), "utf8");
    for (const [, action, ref, version] of text.matchAll(/^\s*-?\s*uses:\s*([^@\s]+)@(\S+)(?:\s+#\s*(\S+))?/gm)) {
      assert.match(ref, /^[0-9a-f]{40}$/, `${name}: ${action} is pinned to a commit`);
      assert.ok(version, `${name}: ${action}'s pin carries its version`);
      pins.set(action, (pins.get(action) ?? new Set()).add(`${ref} ${version}`));
    }
  }
  for (const [action, set] of pins) assert.equal(set.size, 1, `${action} is pinned to ${[...set].join(" and ")}`);
});
