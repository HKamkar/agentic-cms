#!/usr/bin/env node
// The skills are committed twice, for Claude Code (.claude/skills/) and
// Codex (.agents/skills/), both auto-discovered from a checkout with nothing
// installed: this copies the first tree over the second so they stay
// identical (tools/agent-files.test.mjs and the hygiene check assert it).
//
//   node tools/skills-sync.mjs        (pnpm skills:sync)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const from = path.join(root, ".claude/skills"), to = path.join(root, ".agents/skills");
fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log(`skills-sync: ${fs.readdirSync(to).length} skills copied to .agents/skills`);
