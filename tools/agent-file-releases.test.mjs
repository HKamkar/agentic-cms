import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { sha } from "../scripts/lib/init.mjs";
import { recordText, releasesRecord, releaseTags } from "./agent-file-releases.mjs";

const git = (cwd, ...args) => { const r = spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args], { cwd, encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
const put = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
const release = (root, version) => { put(root, "package.json", JSON.stringify({ version })); git(root, "add", "-A"); git(root, "commit", "-qm", version); git(root, "tag", `v${version}`); };

/** A kit's history: a release before the agent files, two with them (v0.10.0 after v0.2.0 by number), a tag that is no release. */
function kitHistory() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-file-releases-"));
  git(root, "init", "-q");
  release(root, "0.1.0");
  put(root, "templates/site/rules/styling.md", "styling, first\n");
  for (const tree of [".claude", ".agents"]) put(root, `${tree}/skills/design/SKILL.md`, "design\n");
  release(root, "0.2.0");
  git(root, "tag", "lab-demo");
  put(root, "templates/site/rules/styling.md", "styling, second\n");
  release(root, "0.10.0");
  return root;
}

test("the record holds every release's agent files as a site's paths, oldest first by number, each text once; a release without them and a tag that is no release are left out", () => {
  const root = kitHistory();
  assert.deepEqual(releaseTags(root), ["v0.1.0", "v0.2.0", "v0.10.0"]);
  const record = releasesRecord(root);
  assert.deepEqual(Object.keys(record.versions), ["0.2.0", "0.10.0"]);
  assert.deepEqual(record.versions["0.2.0"], { ".agents/skills/design/SKILL.md": sha("design\n"), ".claude/rules/styling.md": sha("styling, first\n"), ".claude/skills/design/SKILL.md": sha("design\n") });
  assert.equal(record.versions["0.10.0"][".claude/rules/styling.md"], sha("styling, second\n"));
  assert.deepEqual(Object.values(record.texts), ["design\n", "styling, first\n", "styling, second\n"], "the two skills trees' text is kept once");
  assert.match(record.about, /do not edit by hand/);
  assert.ok(recordText(record).endsWith("}\n"));
});

test("the package's version is read from the working tree while it has no tag (the release commit), and from its tag once it has one", () => {
  const root = kitHistory();
  put(root, "templates/site/rules/styling.md", "styling, between releases\n");
  assert.equal(releasesRecord(root).versions["0.10.0"][".claude/rules/styling.md"], sha("styling, second\n"), "a tagged version is its tag's, whatever the tree holds");
  put(root, "package.json", JSON.stringify({ version: "0.10.1" }));
  const record = releasesRecord(root);
  assert.deepEqual(Object.keys(record.versions), ["0.2.0", "0.10.0", "0.10.1"]);
  assert.equal(record.versions["0.10.1"][".claude/rules/styling.md"], sha("styling, between releases\n"));
  git(root, "add", "-A");
  git(root, "commit", "-qm", "0.10.1");
  git(root, "tag", "v0.10.1");
  assert.equal(recordText(releasesRecord(root)), recordText(record), "the tag changes nothing");
});
