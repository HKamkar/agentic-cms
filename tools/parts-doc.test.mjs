import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { contentLintRules, exportNames, FILE, guardPasses, missingNames, presetRules, requiredNames } from "./parts-doc.mjs";

const ROOT = new URL("..", import.meta.url);

test("docs/parts.md names every export, command and rule of the kit", () => {
  const missing = missingNames(fs.readFileSync(new URL(FILE, ROOT), "utf8"), requiredNames());
  assert.deepEqual(missing.map(({ kind, name }) => `${kind} ${name}`), [], "add a row to docs/parts.md for each");
});

test("the names come from the code: the exports as a site imports them, the preset's rules, the guard's passes, the content lint's rules", () => {
  assert.deepEqual(exportNames({ name: "kit", exports: { ".": "./a.js", "./eslint": "./b.mjs", "./forms/server": {} } }), ["kit", "kit/eslint", "kit/forms/server"]);
  assert.deepEqual(presetRules().sort(), ["agentic-cms/copy", "agentic-cms/email", "agentic-cms/forms", "agentic-cms/graphics", "agentic-cms/head", "agentic-cms/icons", "agentic-cms/images", "agentic-cms/motion", "agentic-cms/styling", "agentic-cms/tags", "no-restricted-imports", "no-restricted-syntax", "react/forbid-elements", "react/no-multi-comp"]);
  assert.deepEqual(guardPasses('finding("layers", a); finding( "routes", b); const finding = (check) => check;'), ["layers", "routes"]);
  assert.deepEqual(contentLintRules('{ rule: "seo-title" }; add("WARN", "voice-claim", x); add("FAIL", error.file, "schema", p, q); add("FAIL", `image ${src}`);').sort(), ["schema", "seo-title", "voice-claim"]);
  const kinds = new Set(requiredNames().map((r) => r.kind));
  assert.deepEqual([...kinds], ["export", "command", "ESLint preset rule", "guard pass", "site check pass", "content lint rule"]);
  assert.deepEqual(requiredNames().filter((r) => r.kind === "site check pass").map((r) => r.name), ["rounds", "exceptions", "scripts", "ci", "tools", "leftovers", "baseline"]);
});

test("a page that lacks a name is told which; a rule counts only in The checks, and a command only as itself", () => {
  const required = [
    { kind: "export", name: "kit/cx", where: "page", needle: /`kit\/cx`/ },
    { kind: "command", name: "kit check", where: "page", needle: /`kit check[` ]/ },
    { kind: "guard pass", name: "routes", where: "checks", needle: /`routes`/ },
  ];
  const page = "# Parts\n\n`kit/cx` and `kit check-components`, the `routes` key.\n\n## The checks\n\nnothing\n";
  assert.deepEqual(missingNames(page, required).map((r) => r.name), ["kit check", "routes"]);
  const complete = "# Parts\n\n`kit/cx`, `kit check --json`.\n\n## The checks\n\n| `routes` | … |\n";
  assert.deepEqual(missingNames(complete, required), []);
});
