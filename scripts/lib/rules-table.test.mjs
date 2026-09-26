import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CODEX_LIMIT, END, START, codexSize, placeBlock, readRules, ruleName, rulePaths, rulesBlock } from "./rules-table.mjs";

const RULE = (paths, heading) => `---\npaths:\n${paths.map((p) => `  - "${p}"`).join("\n")}\n---\n\n# ${heading}\n\n- a line\n`;

test("a rule's paths come from its frontmatter in order, its name from its heading up to the dash", () => {
  assert.deepEqual(rulePaths(RULE(["src/**/*.tsx", "src/**/*.css"], "Styling — read STANDARD.md")), ["src/**/*.tsx", "src/**/*.css"]);
  assert.deepEqual(rulePaths("---\npaths:\n  - content/**\n  - 'src/kit.ts'\nother: x\n---\n"), ["content/**", "src/kit.ts"], "unquoted and single-quoted items; the list ends at the next key");
  assert.deepEqual(rulePaths("# no frontmatter\n"), []);
  assert.equal(ruleName(RULE(["a"], "Content engine — read the README"), "content-engine.md"), "Content engine");
  assert.equal(ruleName("---\npaths:\n  - a\n---\n", "seo.md"), "seo", "no heading: the file name");
});

test("the rules of a directory by file name, a rule without paths left out; the block links each and is fenced by the markers", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rules-"));
  fs.writeFileSync(path.join(dir, "styling.md"), RULE(["src/**/*.tsx"], "Styling — x"));
  fs.writeFileSync(path.join(dir, "blog-engine.md"), RULE(["content/blog/**", "src/app/blog-post/**"], "Blog — y"));
  fs.writeFileSync(path.join(dir, "everywhere.md"), "# Everywhere\n");
  fs.writeFileSync(path.join(dir, "notes.txt"), "not a rule");
  const rules = readRules(dir);
  assert.deepEqual(rules.map((r) => r.file), ["blog-engine.md", "styling.md"]);
  const block = rulesBlock(rules);
  assert.ok(block.startsWith(START) && block.endsWith(END));
  assert.match(block, /^\| `content\/blog\/\*\*`, `src\/app\/blog-post\/\*\*` \| \[Blog\]\(\.claude\/rules\/blog-engine\.md\) \|$/m);
  assert.match(block, /Codex does not, so open each/);
  assert.match(rulesBlock(rules, { by: "`pnpm docs:rules`" }), /^`pnpm docs:rules`: a scope changes in its rule, never here\.$/m);
  assert.deepEqual(readRules(path.join(dir, "nowhere")), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the block goes before the first section of an AGENTS.md without one, replaces its own copy, and leaves a current one alone", () => {
  const agents = "# The site\n\nPreamble.\n\n- a rule\n\n## Styling\n\n- x\n\n## Process\n";
  const block = rulesBlock([{ file: "seo.md", name: "SEO", paths: ["src/app/**"] }]);
  const inserted = placeBlock(agents, block);
  assert.equal(inserted.status, "inserted");
  assert.ok(inserted.text.startsWith("# The site\n\nPreamble.\n\n- a rule\n\n" + block + "\n\n## Styling\n"));
  assert.deepEqual(placeBlock(inserted.text, block), { text: inserted.text, status: "ok" });
  const newer = rulesBlock([{ file: "seo.md", name: "SEO", paths: ["src/app/**", "content/pages/**"] }]);
  const updated = placeBlock(inserted.text, newer);
  assert.equal(updated.status, "updated");
  assert.equal(updated.text, inserted.text.replace(block, newer), "only the block changes");
  const moved = `# X\n\n## A\n\n${block}\n\n## B\n`;
  assert.equal(placeBlock(moved, newer).text, `# X\n\n## A\n\n${newer}\n\n## B\n`, "a block the site moved is refreshed where it stands");
  assert.equal(placeBlock("# Only a title\n", block).text, `# Only a title\n\n${block}\n`, "no section: at the end");
});

test("an instruction file over 32 KiB is over Codex's default limit", () => {
  assert.deepEqual(codexSize("x".repeat(CODEX_LIMIT)), { bytes: 32768, over: false });
  assert.deepEqual(codexSize("x".repeat(CODEX_LIMIT) + "é"), { bytes: 32770, over: true }, "bytes, not characters");
});
