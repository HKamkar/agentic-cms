#!/usr/bin/env node
// Keeps docs/parts.md, the map of every part of the kit, complete: each
// export of the package (package.json's `exports`, as the specifier a site
// imports), each command of the specs (scripts/lib/specs.mjs) and each rule
// the kit's checks define must appear on it — the ESLint preset's rules
// (componentRules()), the placement guard's passes
// (scripts/lib/check-components.mjs) and the content lint's rules
// (scripts/lib/content-lint.mjs), the rules in its "The checks" section. A
// new export, command or rule lands with its row. Exit 1 naming each one
// missing (tools/hygiene.mjs and the tests run it).
//
//   node tools/parts-doc.mjs
import fs from "node:fs";
import path from "node:path";
import { componentRules } from "../scripts/lib/component-lint.mjs";
import { SPECS } from "../scripts/lib/specs.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export const FILE = "docs/parts.md";
const CHECKS = "## The checks";

const ids = (source, patterns) => [...new Set(patterns.flatMap((re) => [...source.matchAll(re)].map((m) => m[1])))];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The specifier a site imports each export by: `agentic-cms`, `agentic-cms/content`, … */
export function exportNames(pkg) {
  return Object.keys(pkg.exports).map((key) => (key === "." ? pkg.name : `${pkg.name}/${key.slice(2)}`));
}

/** The rules the preset sets, with every layer present so none is left out. */
export const presetRules = () => [...new Set(componentRules().flatMap((config) => Object.keys(config.rules ?? {})))];

/** The guard's passes: the check each finding is filed under. */
export const guardPasses = (source) => ids(source, [/\bfinding\(\s*"([a-z-]+)"/g]);

/** The content lint's rules, in each form a finding is written: `rule: "…"`, and add() with the level first. */
export const contentLintRules = (source) => ids(source, [/\brule: "([a-z-]+)"/g, /\badd\("(?:FAIL|WARN)", "([a-z-]+)"/g, /\badd\("(?:FAIL|WARN)", [\w.]+, "([a-z-]+)"/g]);

/** Everything the page must name: { kind, name, where: "page" | "checks", needle } — an export and a command anywhere, a rule in "The checks". */
export function requiredNames(root = ROOT) {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const pkg = JSON.parse(read("package.json"));
  const exact = (name) => new RegExp(`\`${escape(name)}\``);
  return [
    ...exportNames(pkg).map((name) => ({ kind: "export", name, where: "page", needle: exact(name) })),
    ...Object.keys(SPECS).map((command) => ({ kind: "command", name: `${pkg.name} ${command}`, where: "page", needle: new RegExp(`\`${escape(pkg.name)} ${escape(command)}[\` ]`) })),
    ...presetRules().map((name) => ({ kind: "ESLint preset rule", name, where: "checks", needle: exact(name) })),
    ...guardPasses(read("scripts/lib/check-components.mjs")).map((name) => ({ kind: "guard pass", name, where: "checks", needle: exact(name) })),
    ...contentLintRules(read("scripts/lib/content-lint.mjs")).map((name) => ({ kind: "content lint rule", name, where: "checks", needle: exact(name) })),
  ];
}

/** The required names the page lacks; a rule counts only in its "The checks" section. */
export function missingNames(text, required) {
  const at = text.indexOf(`\n${CHECKS}\n`);
  const checks = at === -1 ? "" : text.slice(at).split(/\n## (?!The checks)/)[0];
  return required.filter(({ where, needle }) => !needle.test(where === "checks" ? checks : text));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const required = requiredNames();
  const missing = missingNames(fs.readFileSync(path.join(ROOT, FILE), "utf8"), required);
  for (const { kind, name, where } of missing) console.error(`${FILE}: names no ${kind} ${name}${where === "checks" ? ` in "${CHECKS.slice(3)}"` : ""} — add its row`);
  if (!missing.length) console.log(`parts-doc: ${FILE} names every export, command and rule (${required.length})`);
  process.exit(missing.length ? 1 : 0);
}
