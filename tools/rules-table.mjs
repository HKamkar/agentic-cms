#!/usr/bin/env node
// Writes the scoped-rules table (scripts/lib/rules-table.mjs) into the kit's
// own AGENTS.md, from the kit's .claude/rules/, and into the site template's,
// from templates/site/rules/ (where `init` puts them in a site: its
// .claude/rules/). Claude Code loads the rules by their frontmatter; Codex
// finds them only through this table. `--check` exits 1 when a table is
// stale or an AGENTS.md outgrows its budget: Codex's 32 KiB for the kit's,
// half of that for the template, which leaves a site room for its own
// (tools/hygiene.mjs and the tests run it).
//
//   node tools/rules-table.mjs            rewrites the two tables
//   node tools/rules-table.mjs --check    exits 1 when either is out of date or too big
import fs from "node:fs";
import path from "node:path";
import { CODEX_LIMIT, codexSize, placeBlock, readRules, rulesBlock } from "../scripts/lib/rules-table.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
/** The two AGENTS.md the kit keeps a table in: the rules each is written from, what writes it, its size budget. */
export const TARGETS = [
  { file: "AGENTS.md", rules: ".claude/rules", by: "`pnpm docs:rules`", budget: CODEX_LIMIT },
  { file: "templates/site/AGENTS.md", rules: "templates/site/rules", by: "`agentic-cms init --agent-files`", budget: CODEX_LIMIT / 2 },
];

/** Each target as the rules say it should read: { file, placed: { text, status }, bytes, budget }. */
export function tables(root = ROOT) {
  return TARGETS.map(({ file, rules, by, budget }) => {
    const placed = placeBlock(fs.readFileSync(path.join(root, file), "utf8"), rulesBlock(readRules(path.join(root, rules)), { by }));
    return { file, placed, bytes: codexSize(placed.text).bytes, budget };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const check = process.argv.includes("--check");
  let failed = false;
  for (const { file, placed, bytes, budget } of tables()) {
    if (placed.status !== "ok") {
      if (check) { console.error(`${file}: the scoped-rules table is ${placed.status === "inserted" ? "missing" : "stale"} — run pnpm docs:rules`); failed = true; }
      else { fs.writeFileSync(path.join(ROOT, file), placed.text); console.log(`rules-table: ${placed.status} ${file}`); }
    }
    if (bytes > budget) { console.error(`${file}: ${bytes} bytes, over its ${budget}-byte budget — move procedures into linked docs`); failed = true; }
  }
  if (!failed && check) console.log("rules-table: both tables current, both files within budget");
  process.exit(failed ? 1 : 0);
}
