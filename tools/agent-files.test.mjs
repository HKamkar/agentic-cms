import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const front = (file) => Object.fromEntries((fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "").split("\n").map((l) => l.split(/:\s(.*)/)).map(([k, v]) => [k, v]));

test("the skills are committed twice and identical, one directory per skill named as its frontmatter", () => {
  const claude = walk(path.join(ROOT, ".claude/skills")).map((f) => path.relative(path.join(ROOT, ".claude/skills"), f)).sort();
  const agents = walk(path.join(ROOT, ".agents/skills")).map((f) => path.relative(path.join(ROOT, ".agents/skills"), f)).sort();
  assert.deepEqual(claude, agents, "pnpm skills:sync");
  assert.ok(claude.length >= 4);
  for (const rel of claude) {
    assert.equal(fs.readFileSync(path.join(ROOT, ".claude/skills", rel), "utf8"), fs.readFileSync(path.join(ROOT, ".agents/skills", rel), "utf8"), `${rel}: pnpm skills:sync`);
    if (path.basename(rel) !== "SKILL.md") continue;
    const meta = front(path.join(ROOT, ".claude/skills", rel));
    assert.equal(meta.name, path.dirname(rel), `${rel}: name = directory`);
    assert.ok(meta.description?.length > 80, `${rel}: a description that says when to use it`);
    assert.match(fs.readFileSync(path.join(ROOT, ".claude/skills", rel), "utf8"), /## Stop for the user/, `${rel}: says where it stops`);
  }
});

test("every site rule template is path-scoped and points at the installed package, never at the kit's source", () => {
  for (const file of walk(path.join(ROOT, "templates/site/rules"))) {
    const text = fs.readFileSync(file, "utf8");
    assert.match(text, /^---\npaths:\n( {2}- ".+"\n)+---/, `${path.basename(file)}: paths frontmatter`);
    assert.doesNotMatch(text, /(?<!agentic-cms\/)src\/lib\//, `${path.basename(file)}: no kit source path`);
    assert.doesNotMatch(text, /\b(bin|scripts|plugin|tools)\//, `${path.basename(file)}: no kit-internal path`);
  }
});

test("the package ships what init copies", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  for (const entry of ["content", "public", "src/app", "src/components", "src/config", "src/styles", "src/kit.ts", "postcss.config.mjs", "eslint.config.mjs", ".env.example", ".nvmrc", "STANDARD.md", "tsconfig.json", "templates", ".claude/skills", ".agents/skills", "docs"]) {
    assert.ok(pkg.files.includes(entry), `files: ${entry}`);
  }
});
