import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { compareVersions, coreOf, loadMigrations, MIGRATIONS, siteVersion, specFor, upgrade, UpgradeError } from "./upgrade.mjs";

const KIT = path.resolve(import.meta.dirname, "../..");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "upgrade-"));
const write = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
const json = (value) => `${JSON.stringify(value, null, 1)}\n`;
/** A site that names the kit by `spec` and has `installed` in node_modules (and `recorded` in its manifest, when given). */
function site({ spec = "github:HKamkar/agentic-cms#v0.8.4", installed = "0.8.4", recorded } = {}) {
  const root = tmp();
  write(root, "package.json", json({ name: "site", dependencies: { "agentic-cms": spec } }));
  if (installed) write(root, "node_modules/agentic-cms/package.json", json({ name: "agentic-cms", version: installed }));
  if (recorded) write(root, ".agentic-cms.json", json({ version: recorded, files: {} }));
  return root;
}
/** A shell that records each command and answers `status` (by "pnpm <script>"). */
const shell = (status = {}) => { const ran = []; return { ran, exec: (command, args) => { const line = [command, ...args].join(" "); ran.push(line); return { status: status[line] ?? 0 }; } }; };
/** A migration that records its runs: it finds `found` until it has applied once, then leaves `manual`. */
function migration(version, { found = ["a thing"], manual = [] } = {}) {
  const runs = [];
  let done = false;
  const apply = () => {
    const changed = done ? [] : [{ file: `${version}.txt`, status: "changed" }];
    if (!done) runs.push(version);
    done = true;
    return { changed, manual };
  };
  return { version, runs, detect: () => (done ? manual.map((m) => `by hand: ${m.text}`) : found), apply };
}

test("versions compare by x.y.z, a pre-release as its release", () => {
  assert.deepEqual(coreOf("0.9.0-rc.1"), [0, 9, 0]);
  assert.equal(coreOf("next"), null);
  assert.ok(compareVersions("0.9.0", "0.8.4") > 0);
  assert.ok(compareVersions("0.8.10", "0.8.9") > 0);
  assert.equal(compareVersions("0.9.0-rc.1", "0.9.0"), 0);
});

test("the version a site is on is the installed kit's, or the manifest's when that is older; neither is an UpgradeError", () => {
  assert.equal(siteVersion(site()), "0.8.4");
  assert.equal(siteVersion(site({ installed: "0.9.0", recorded: "0.8.3" })), "0.8.3", "a pin moved by hand before its upgrade ran");
  assert.equal(siteVersion(site({ installed: null, recorded: "0.8.2" })), "0.8.2");
  assert.throws(() => siteVersion(site({ installed: null })), (error) => error instanceof UpgradeError && /--from <version>/.test(error.message));
});

test("the spec keeps the site's own form: a tag moved to the version, a range to ^version; another pin needs --kit", () => {
  const pkg = (spec) => ({ dependencies: { "agentic-cms": spec } });
  assert.equal(specFor(pkg("github:HKamkar/agentic-cms#v0.8.4"), "0.9.0"), "github:HKamkar/agentic-cms#v0.9.0");
  assert.equal(specFor(pkg("github:someone/agentic-cms-fork#v0.8.4"), "0.9.0"), "github:someone/agentic-cms-fork#v0.9.0", "a fork's repository stays the site's");
  assert.equal(specFor(pkg("^0.9.0"), "0.9.1"), "^0.9.1");
  assert.equal(specFor({ devDependencies: { "agentic-cms": "0.9.0" } }, "0.9.1"), "^0.9.1");
  for (const spec of ["file:../agentic-cms-0.9.0.tgz", "github:HKamkar/agentic-cms#a0869d4"]) assert.throws(() => specFor(pkg(spec), "0.9.0"), /--kit <spec>/);
  assert.throws(() => specFor({ dependencies: {} }, "0.9.0"), /names no agentic-cms dependency/);
});

test("the migrations the release carries load from scripts/migrations/, oldest first, each named for its version with a detect and an apply", async () => {
  const migrations = await loadMigrations(MIGRATIONS);
  assert.ok(migrations.some(({ version }) => version === "0.9.0"));
  assert.deepEqual(migrations.map((m) => m.version), [...migrations.map((m) => m.version)].sort(compareVersions));
  for (const m of migrations) assert.ok(typeof m.detect === "function" && typeof m.apply === "function", m.version);
  assert.deepEqual(await loadMigrations(path.join(tmp(), "none")), []);
});

test("upgrade adds the kit at this version, runs each migration newer than the site's in order, refreshes the agent files and verifies; a step left by hand is exit 1", async () => {
  const root = site();
  const older = migration("0.8.4");
  const step = { text: "AGENTS.md: replace its copy", link: "docs/upgrading.md#084--090" };
  const due = migration("0.9.0", { manual: [step] });
  const later = migration("0.9.1");
  const { ran, exec } = shell();
  const report = await upgrade(root, { kitRoot: KIT, version: "0.9.1", exec, migrations: [later, older, due].sort((a, b) => compareVersions(a.version, b.version)) });
  assert.deepEqual(ran, ["pnpm add agentic-cms@github:HKamkar/agentic-cms#v0.9.1", "pnpm lint", "pnpm test"]);
  assert.deepEqual(report.migrations.map((m) => m.version), ["0.9.0", "0.9.1"], "only what is newer than 0.8.4");
  assert.deepEqual([...due.runs, ...later.runs, ...older.runs], ["0.9.0", "0.9.1"]);
  assert.deepEqual(report.manual, [step]);
  assert.equal(report.exit, 1);
  assert.ok(report.agentFiles.some((f) => f.file === ".claude/settings.json"), "init --agent-files ran");
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".agentic-cms.json"), "utf8")).version, "0.9.1");
  const again = await upgrade(root, { kitRoot: KIT, version: "0.9.1", exec, from: "0.8.4", migrations: [due, later] });
  assert.deepEqual([...due.runs, ...later.runs], ["0.9.0", "0.9.1"], "applied once: a second run changes nothing");
  assert.deepEqual(again.migrations.map((m) => m.changed), [[], []]);
  assert.deepEqual(again.manual, [step], "and still names the step left by hand");
  assert.equal(again.exit, 1);
});

test("--dry-run runs nothing and changes nothing; a failed verify is exit 1; a failed install stops before anything changes", async () => {
  const root = site();
  const due = migration("0.9.0");
  const dry = shell();
  const report = await upgrade(root, { kitRoot: KIT, version: "0.9.0", exec: dry.exec, dryRun: true, migrations: [due] });
  assert.deepEqual(dry.ran, []);
  assert.deepEqual(report.migrations, [{ version: "0.9.0", found: ["a thing"], changed: [], manual: [] }]);
  assert.deepEqual(due.runs, []);
  assert.ok(!fs.existsSync(path.join(root, ".claude")) && !fs.existsSync(path.join(root, ".agentic-cms.json")), "the agent files only checked");
  assert.equal(report.exit, 0);
  const red = await upgrade(root, { kitRoot: KIT, version: "0.9.0", exec: shell({ "pnpm test": 1 }).exec, migrations: [] });
  assert.deepEqual(red.verify, [{ script: "lint", status: 0 }, { script: "test", status: 1 }]);
  assert.equal(red.exit, 1);
  const broken = site();
  await assert.rejects(upgrade(broken, { kitRoot: KIT, version: "0.9.0", exec: shell({ "pnpm add agentic-cms@github:HKamkar/agentic-cms#v0.9.0": 1 }).exec, migrations: [due] }), (error) => error instanceof UpgradeError && /nothing else was changed/.test(error.message));
  assert.ok(!fs.existsSync(path.join(broken, ".agentic-cms.json")));
});

test("upgrade refuses what it cannot read before it changes anything: no package.json, a --from that is no version, a pin of another form without --kit", async () => {
  const none = tmp();
  await assert.rejects(upgrade(none, { kitRoot: KIT, version: "0.9.0", exec: shell().exec, migrations: [] }), /no package\.json here/);
  await assert.rejects(upgrade(site(), { kitRoot: KIT, version: "0.9.0", exec: shell().exec, from: "latest", migrations: [] }), /--from latest is not a version/);
  const tarball = site({ spec: "file:../kit.tgz" });
  const { ran, exec } = shell();
  await assert.rejects(upgrade(tarball, { kitRoot: KIT, version: "0.9.0", exec, migrations: [] }), /--kit <spec>/);
  assert.deepEqual(ran, []);
  await upgrade(tarball, { kitRoot: KIT, version: "0.9.0", exec, kit: "file:../kit-0.9.0.tgz", migrations: [] });
  assert.equal(ran[0], "pnpm add agentic-cms@file:../kit-0.9.0.tgz");
});
