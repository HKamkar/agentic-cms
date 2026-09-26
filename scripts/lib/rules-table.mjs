// The scoped-rules table of an AGENTS.md. Claude Code loads each
// .claude/rules/*.md itself when an edited path matches the rule's `paths`
// frontmatter; Codex reads AGENTS.md and nothing under .claude/, so without
// a table it never sees the rules at all. The table is written from the
// rules' own frontmatter and headings — a rule's scope is changed in the
// rule, never in the table — and it sits between two markers, the one part
// of a site's AGENTS.md the kit rewrites. Codex stops reading an
// instruction file at 32 KiB by default (project_doc_max_bytes), which is
// what CODEX_LIMIT measures against.
import fs from "node:fs";
import path from "node:path";

export const START = "<!-- rules-table:start -->";
export const END = "<!-- rules-table:end -->";
export const CODEX_LIMIT = 32 * 1024;

/** A rule's `paths` frontmatter, in its order. */
export function rulePaths(text) {
  const lines = (text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "").split("\n");
  const at = lines.findIndex((line) => /^paths:\s*$/.test(line));
  if (at < 0) return [];
  const paths = [];
  for (const line of lines.slice(at + 1)) {
    const item = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
    if (!item) break;
    paths.push(item[1]);
  }
  return paths;
}

/** A rule's name: its first heading up to the dash ("# Styling — read …" is "Styling"), else its file name. */
export const ruleName = (text, file) => (text.match(/^# (.+)$/m)?.[1] ?? path.basename(file, ".md")).split(" — ")[0].trim();

/** The path-scoped rules of a directory, by file name: [{ file, name, paths }]; a rule without paths applies everywhere and is left out. */
export function readRules(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((file) => file.endsWith(".md")).sort().map((file) => {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    return { file, name: ruleName(text, file), paths: rulePaths(text) };
  }).filter((rule) => rule.paths.length);
}

/** The block between the markers: the section, what an agent does with it, one row per rule linking `base/<file>`; `by` names what writes it. */
export function rulesBlock(rules, { base = ".claude/rules", by = "`agentic-cms init --agent-files`" } = {}) {
  const row = (rule) => `| ${rule.paths.map((p) => `\`${p}\``).join(", ")} | [${rule.name}](${base}/${rule.file}) |`;
  return [
    START,
    "## Scoped rules for Claude Code and Codex",
    "",
    "Before editing or reviewing a file, read and follow **every** rule below",
    "whose paths match it: `**` spans directories, and matches add up (a post",
    "needs its content, blog and SEO rules). Claude Code loads these files",
    "itself through their `paths` frontmatter; Codex does not, so open each",
    "matching file before the edit, and again when the task reaches other",
    "paths. The table is written from the rules' frontmatter by",
    `${by}: a scope changes in its rule, never here.`,
    "",
    "| Paths | Read and follow |",
    "| --- | --- |",
    ...rules.map(row),
    END,
  ].join("\n");
}

/** AGENTS.md with the block in place — replaced between the markers, or put before the first `## ` section — and ok | updated | inserted. */
export function placeBlock(agents, block) {
  const start = agents.indexOf(START), end = agents.indexOf(END);
  if (start >= 0 && end > start) {
    if (agents.slice(start, end + END.length) === block) return { text: agents, status: "ok" };
    return { text: agents.slice(0, start) + block + agents.slice(end + END.length), status: "updated" };
  }
  const at = agents.search(/^## /m);
  const cut = at < 0 ? agents.length : at;
  return { text: `${agents.slice(0, cut).replace(/\n*$/, "\n\n")}${block}\n\n${agents.slice(cut)}`.replace(/\n+$/, "\n"), status: "inserted" };
}

/** An instruction file's size against Codex's default limit: { bytes, over }. */
export const codexSize = (text) => { const bytes = Buffer.byteLength(text); return { bytes, over: bytes > CODEX_LIMIT }; };
