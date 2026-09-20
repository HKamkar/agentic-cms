import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { findings, showcasedBrands } from "./hygiene.mjs";

const tree = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hygiene-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
};

const clean = {
  "README.md": "# kit\n\n## Built on agentic-cms\n\n[Nimbus](https://nimbus.example) is the first site on the package.\n\n## Next\n\nhttps://other.example is not a site.\n",
  "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n- a line\n",
  "docs/commands.md": "x",
  "scripts/a.mjs": "const root = process.cwd();\n",
  "public/images/a.png": "png",
  ".claude/skills/design/SKILL.md": "---\nname: design\n---\n",
  ".agents/skills/design/SKILL.md": "---\nname: design\n---\n",
};

test("the names to guard are the hosts the README's showcase section links", () => {
  assert.deepEqual(showcasedBrands(clean["README.md"]), ["nimbus"]);
  assert.deepEqual(showcasedBrands("# no showcase\n"), []);
});

test("a clean tree has no findings", () => {
  assert.deepEqual(findings(tree(clean), Object.keys(clean), { brands: ["nimbus"] }), []);
});

test("a site's name outside the README's showcase is a finding, and so is a machine path or an address", () => {
  const root = tree({ ...clean, "scripts/b.mjs": "// for nimbus\nconst p = '/home/someone/x';\n", "docs/x.md": "open http://203.0.113.9:8000\n" });
  const found = findings(root, [...Object.keys(clean), "scripts/b.mjs", "docs/x.md"], { brands: ["nimbus"] });
  assert.ok(found.some((f) => f.includes("scripts/b.mjs") && f.includes("nimbus")));
  assert.ok(found.some((f) => f.includes("scripts/b.mjs") && f.includes("/home/")));
  assert.ok(found.some((f) => f.includes("docs/x.md") && f.includes("203.0.113.9:8000")));
});

test("a PNG outside docs/ and public/, a tracked .parity file and a scratch file are findings", () => {
  const files = { ...clean, "scripts/shot.png": "x", ".parity/visual/a.png": "x", "notes.tmp": "x" };
  const found = findings(tree(files), Object.keys(files), { brands: ["nimbus"] });
  assert.ok(found.some((f) => f.includes("scripts/shot.png")));
  assert.ok(found.some((f) => f.includes(".parity/visual/a.png")));
  assert.ok(found.some((f) => f.includes("notes.tmp")));
});

test("the two skills trees must be identical, and the CHANGELOG must have an Unreleased or a version entry", () => {
  const drift = { ...clean, ".agents/skills/design/SKILL.md": "---\nname: design\n---\nchanged\n", "CHANGELOG.md": "# Changelog\n" };
  const found = findings(tree(drift), Object.keys(drift), { brands: ["nimbus"] });
  assert.ok(found.some((f) => f.includes(".agents/skills/design/SKILL.md") && f.includes("differs")));
  assert.ok(found.some((f) => f.includes("CHANGELOG.md")));
  const missing = { ...clean }; delete missing[".agents/skills/design/SKILL.md"];
  assert.ok(findings(tree(missing), Object.keys(missing), { brands: ["nimbus"] }).some((f) => f.includes(".agents/skills/design/SKILL.md") && f.includes("missing")));
});
