// The two exports whose types are written by hand (`./loader` and
// `./eslint`, JavaScript under scripts/lib/ beside a .d.mts): package.json
// names each declaration under `types`, and each declares the names its
// module exports, no more and no fewer. `pnpm lint:pkg` compiles them.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const exported = (node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** The value names a module exports, read from its text: `export const|let|function|class`, `export { a, b as c }` and `export { … } from`; types and interfaces are not values. */
function exportedValues(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false);
  const names = [];
  for (const node of source.statements) {
    if (ts.isVariableStatement(node) && exported(node)) names.push(...node.declarationList.declarations.map((d) => d.name.getText(source)));
    else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && exported(node) && node.name) names.push(node.name.text);
    else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)) names.push(...node.exportClause.elements.filter((e) => !e.isTypeOnly).map((e) => e.name.text));
  }
  return [...new Set(names)].sort();
}

const HAND_TYPED = Object.entries(JSON.parse(read("package.json")).exports).filter(([, target]) => typeof target === "object" && target.types?.endsWith(".d.mts"));

test("./loader and ./eslint name a .d.mts beside their module under types", () => {
  assert.deepEqual(HAND_TYPED.map(([key]) => key).sort(), ["./eslint", "./loader"]);
  for (const [key, { types, default: module }] of HAND_TYPED) {
    assert.equal(types, module.replace(/\.mjs$/, ".d.mts"), `${key}: the declaration sits beside its module`);
    assert.ok(fs.existsSync(path.join(ROOT, types)), `${key}: ${types}`);
  }
});

test("each declaration declares the names its module exports, no more and no fewer", () => {
  for (const [key, { types, default: module }] of HAND_TYPED) {
    assert.deepEqual(exportedValues(read(types), types), exportedValues(read(module), module), `${key}: ${types} against ${module}`);
  }
  assert.ok(exportedValues(read("scripts/lib/component-lint.mjs"), "x.mjs").includes("componentRules"));
});

test("the reading sees every form of export, and no type", () => {
  const text = "export const a = 1, b = 2;\nexport function c() {}\nexport class D {}\nconst e = 1;\nexport { e, e as f };\nexport { g } from './g.mjs';\nexport type H = string;\nexport interface I {}\nexport type { J } from './j';\n";
  assert.deepEqual(exportedValues(text, "x.mts"), ["D", "a", "b", "c", "e", "f", "g"]);
});
