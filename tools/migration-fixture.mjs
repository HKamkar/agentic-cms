// A site as 0.8.4 left it, laid over a fresh site for the 0.9.0 migration
// (scripts/migrations/0.9.0.mjs) to move: the tests run `upgrade` on it in
// a scratch folder, and pack-smoke from the tarball. Its agent files are
// 0.8.4's own texts, from the package's record of every release
// (scripts/lib/agent-file-releases.json): the rules whole, the design skills
// copied into both trees, a manifest of their bases and the editorial plugin
// from GitHub. `edits` are the site's own, as a site makes them — a line of
// its own in a rule, a step of its own in a skill — and its AGENTS.md and
// CLAUDE.md carry what the 0.8 templates copied into them.
import fs from "node:fs";
import path from "node:path";
import { readReleases } from "../scripts/lib/agent-file-record.mjs";

export const VERSION = "0.8.4";
/** The site's own edits of 0.8.4's agent files, by file. */
export const EDITS = {
  ".claude/rules/seo.md": (text) => `${text}- The site's own: every page title ends with the brand.\n`,
  ".claude/skills/design-proof/SKILL.md": (text) => `${text}\nThe site's own step: proofs run in light mode first.\n`,
};
/** What the 0.8 templates copied into AGENTS.md and CLAUDE.md, which the migration leaves to the site. */
const AGENTS_COPY = "\n## Gotchas\n\n- Next 16: `params` is a Promise.\n\n## Parity harness and long runs\n\nThe contract is `node_modules/agentic-cms/docs/visual-parity.md`.\n";
const CLAUDE_COPY = "@AGENTS.md\n\n# Claude Code\n\nThe rules are `AGENTS.md`, shared with every agent; the path-scoped\ninvariants are `.claude/rules/`; the design skills are `.claude/skills/`.\n";

const write = (site, file, text) => { fs.mkdirSync(path.dirname(path.join(site, file)), { recursive: true }); fs.writeFileSync(path.join(site, file), text); };

/** Lays 0.8.4's agent files over the site at `site`, from the record `kitRoot` ships; the files it wrote. */
export function site084(site, { kitRoot, edits = EDITS } = {}) {
  const releases = readReleases(kitRoot);
  const files = releases.versions[VERSION];
  if (!files) throw new Error(`the kit's record has no ${VERSION}`);
  for (const dir of [".claude/rules", ".claude/skills", ".agents/skills"]) fs.rmSync(path.join(site, dir), { recursive: true, force: true });
  for (const [file, hash] of Object.entries(files)) write(site, file, edits[file] ? edits[file](releases.texts[hash]) : releases.texts[hash]);
  for (const file of Object.keys(edits)) write(site, `.agentic-cms/base/${file.slice(1)}`, releases.texts[files[file]]);
  write(site, ".agentic-cms.json", `${JSON.stringify({ version: VERSION, files }, null, 1)}\n`);
  write(site, ".claude/settings.json", `${JSON.stringify({ extraKnownMarketplaces: { "agentic-cms": { source: { source: "github", repo: "HKamkar/agentic-cms" } } }, enabledPlugins: { "editorial@agentic-cms": true }, permissions: { allow: ["Bash(pnpm content:*)"] } }, null, 2)}\n`);
  fs.appendFileSync(path.join(site, "AGENTS.md"), AGENTS_COPY);
  write(site, "CLAUDE.md", CLAUDE_COPY);
  return Object.keys(files);
}

