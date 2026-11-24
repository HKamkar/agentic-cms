#!/usr/bin/env node
// Keeps docs/parts.md, the map of every part of the kit, complete: each
// export of the package (package.json's `exports`, as the specifier a site
// imports), each command of the specs (scripts/lib/specs.mjs) and each rule
// the kit's checks define must appear on it — the ESLint preset's rules
// (componentRules()), the placement guard's passes
// (scripts/lib/check-components.mjs), the site check's (SITE_PASSES of
// scripts/lib/check-site.mjs) and the content lint's rules
// (scripts/lib/content-lint.mjs), the rules in its "The checks" section. A
// new export, command or rule lands with its row. It keeps the marks
// complete too (job 6 of docs/roadmap.md): docs/stability.md marks every
// export and command stable or experimental, and every row of the map's four
// layer tables carries its Stability, experimental exactly where the row names
// an experimental part. Exit 1 naming each one missing (tools/hygiene.mjs and
// the tests run it).
//
//   node tools/parts-doc.mjs
import fs from "node:fs";
import path from "node:path";
import { SITE_PASSES } from "../scripts/lib/check-site.mjs";
import { componentRules } from "../scripts/lib/component-lint.mjs";
import { SPECS } from "../scripts/lib/specs.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export const FILE = "docs/parts.md";
export const STABILITY = "docs/stability.md";
const CHECKS = "## The checks";
const MARKS = ["stable", "experimental"];

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
    ...SITE_PASSES.map((name) => ({ kind: "site check pass", name, where: "checks", needle: exact(name) })),
    ...contentLintRules(read("scripts/lib/content-lint.mjs")).map((name) => ({ kind: "content lint rule", name, where: "checks", needle: exact(name) })),
  ];
}

/** The required names the page lacks; a rule counts only in its "The checks" section. */
export function missingNames(text, required) {
  const at = text.indexOf(`\n${CHECKS}\n`);
  const checks = at === -1 ? "" : text.slice(at).split(/\n## (?!The checks)/)[0];
  return required.filter(({ where, needle }) => !needle.test(where === "checks" ? checks : text));
}

const tableRows = (lines) => lines.filter((line) => line.startsWith("| ") && !line.startsWith("|---"));
const cells = (row) => row.slice(2, -2).split(" | ");
const markOf = (row) => (row ? cells(row).find((cell) => MARKS.includes(cell)) : undefined);

/** The rows of every table whose header has a Stability column: the map's four layer tables. */
function markedRows(text) {
  const rows = [];
  let column = -1;
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) column = -1;
    else if (line.includes("| Stability |")) column = cells(line).indexOf("Stability");
    else if (column >= 0 && !line.startsWith("|---")) rows.push({ need: cells(line)[0], part: cells(line)[1], stability: cells(line)[column] });
  }
  return rows;
}

/** What keeps the marks from being complete: an export or a command the stability page does not mark, a map row without its Stability or with the wrong one. */
export function stabilityFindings(page, map, required) {
  const rows = tableRows(page.split("\n"));
  const marked = required.filter(({ kind }) => kind === "export" || kind === "command").map((part) => ({ ...part, mark: markOf(rows.find((row) => part.needle.test(row))) }));
  const findings = marked.filter(({ mark }) => !mark).map(({ kind, name }) => `${STABILITY}: marks no ${kind} ${name} stable or experimental — add its row`);
  const experimental = marked.filter(({ mark }) => mark === "experimental");
  for (const { need, part, stability } of markedRows(map)) {
    const named = experimental.filter(({ needle }) => needle.test(part)).map(({ name }) => name);
    const mark = MARKS.find((m) => stability.startsWith(m));
    if (!mark) findings.push(`${FILE}: "${need}" has no Stability — stable or experimental, as ${STABILITY} marks its parts`);
    else if (named.length && mark !== "experimental") findings.push(`${FILE}: "${need}" names ${named.join(", ")}, experimental on ${STABILITY}, and is marked ${mark}`);
    else if (!named.length && mark === "experimental") findings.push(`${FILE}: "${need}" is marked experimental and names no part ${STABILITY} marks so`);
  }
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const required = requiredNames();
  const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
  const missing = missingNames(read(FILE), required);
  for (const { kind, name, where } of missing) console.error(`${FILE}: names no ${kind} ${name}${where === "checks" ? ` in "${CHECKS.slice(3)}"` : ""} — add its row`);
  const marks = stabilityFindings(read(STABILITY), read(FILE), required);
  for (const finding of marks) console.error(finding);
  if (!missing.length && !marks.length) console.log(`parts-doc: ${FILE} names every export, command and rule (${required.length}), each export and command marked on ${STABILITY}`);
  process.exit(missing.length || marks.length ? 1 : 0);
}
