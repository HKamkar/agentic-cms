// The `editorial` plugin is one directory read by two clients: Claude Code
// through `plugin/.claude-plugin/plugin.json` and the marketplace at
// `.claude-plugin/marketplace.json`, Codex through
// `plugin/.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`.
// This keeps the five manifests in step (the release checklist in
// plugin/README.md), the skills readable by both, the agents pointed at
// skills that exist, and the plugin free of the site's brand. `claude plugin
// validate --strict` is the other half (`pnpm plugin:validate`); Codex has no
// validator. Run with `pnpm test`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { site } from "../src/config/site.ts";

const REPO = path.resolve(import.meta.dirname, "..");
const PLUGIN = path.join(REPO, "plugin");
const read = (file) => JSON.parse(fs.readFileSync(path.join(REPO, file), "utf8"));

const generic = read("plugin/plugin.json");
const claude = read("plugin/.claude-plugin/plugin.json");
const codex = read("plugin/.codex-plugin/plugin.json");
const claudeMarket = read(".claude-plugin/marketplace.json");
const codexMarket = read(".agents/plugins/marketplace.json");
const claudeEntry = claudeMarket.plugins.find((p) => p.name === generic.name);
const codexEntry = codexMarket.plugins.find((p) => p.name === generic.name);

/** The frontmatter of a skill or agent file as a flat object; null when the file does not open with one. */
function frontmatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  return Object.fromEntries(match[1].split("\n").map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()]));
}

describe("the manifests agree", () => {
  test("name, description and author are one string across the three plugin manifests", () => {
    for (const manifest of [claude, codex]) {
      assert.equal(manifest.name, generic.name);
      assert.equal(manifest.description, generic.description);
      assert.deepEqual(manifest.author, generic.author);
    }
  });
  test("both marketplaces list the plugin from ./plugin", () => {
    assert.equal(claudeMarket.name, codexMarket.name);
    assert.ok(claudeEntry, "Claude Code marketplace entry");
    assert.ok(codexEntry, "Codex marketplace entry");
    assert.equal(path.resolve(REPO, claudeEntry.source), PLUGIN);
    assert.equal(codexEntry.source.source, "local");
    assert.equal(path.resolve(REPO, codexEntry.source.path), PLUGIN);
  });
  test("the versions match, Codex's with a build suffix (the release checklist)", () => {
    assert.match(generic.version, /^\d+\.\d+\.\d+$/);
    assert.equal(claude.version, generic.version);
    assert.equal(claudeEntry.version, generic.version, "Claude Code offers plugin update only when the marketplace entry's version changes");
    assert.match(codex.version, /^\d+\.\d+\.\d+\+codex\.\d{14}$/);
    assert.equal(codex.version.split("+")[0], generic.version);
  });
  test("no $schema and no MCP server: a $schema puts Codex in portable mode, a server needs the auth work first", () => {
    for (const manifest of [generic, claude, codex]) assert.equal(manifest.$schema, undefined);
    for (const manifest of [claude, codex]) assert.equal(manifest.mcpServers, undefined);
    assert.equal(fs.existsSync(path.join(PLUGIN, ".mcp.json")), false, "plugin/.mcp.json is Claude Code's default MCP file");
  });
});

describe("the skills serve both clients", () => {
  const skillsDir = path.resolve(PLUGIN, codex.skills);
  const skills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

  test("the Codex skills path is the skills directory Claude Code discovers", () => {
    assert.equal(skillsDir, path.join(PLUGIN, "skills"));
    assert.ok(skills.length > 0);
  });
  test("every skill opens with a frontmatter whose name is its directory and whose description is a trigger sentence", () => {
    for (const skill of skills) {
      const meta = frontmatter(path.join(skillsDir, skill, "SKILL.md"));
      assert.ok(meta, `${skill}: SKILL.md opens with ---`);
      assert.equal(meta.name, skill);
      assert.ok(meta.description?.length > 40, `${skill}: description`);
    }
  });
  test("every agent is a wrapper over a skill that exists", () => {
    const agentsDir = path.join(PLUGIN, "agents");
    for (const file of fs.readdirSync(agentsDir)) {
      const meta = frontmatter(path.join(agentsDir, file));
      assert.equal(meta?.name, path.basename(file, ".md"));
      const body = fs.readFileSync(path.join(agentsDir, file), "utf8");
      const target = body.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/([\w-]+)\/SKILL\.md/)?.[1];
      assert.ok(target, `${file}: reads a skill through \${CLAUDE_PLUGIN_ROOT}`);
      assert.ok(skills.includes(target), `${file}: skills/${target} exists`);
    }
  });
});

describe("the plugin knows no brand", () => {
  test("the site's brand appears nowhere under plugin/ or the Codex marketplace", () => {
    const brand = new RegExp(site.name, "i");
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
    for (const file of [...walk(PLUGIN), path.join(REPO, ".agents/plugins/marketplace.json")]) {
      assert.doesNotMatch(fs.readFileSync(file, "utf8"), brand, path.relative(REPO, file));
    }
  });
});
