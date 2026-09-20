import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { agentFiles, readManifest, scaffold } from "./lib/init.mjs";

const KIT = path.resolve(import.meta.dirname, "..");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "init-"));
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
const quiet = { log: () => {} };

test("scaffold lays out a site from the package: the example, the agent files, the config, a manifest", () => {
  const target = path.join(tmp(), "my-site");
  const result = scaffold(target, { kitRoot: KIT, version: "0.4.0", force: false, ...quiet });
  for (const file of ["src/kit.ts", "src/app/layout.tsx", "src/components/README.md", "src/config/site.ts", "src/styles/base.css", "content/pages/home.yaml", "content/VOICE.md", "public/images/brand/logo.svg", "STANDARD.md", "AGENTS.md", "CLAUDE.md", "README.md", "PLAN.md", "next.config.ts", "postcss.config.mjs", "eslint.config.mjs", "tsconfig.json", "package.json", "pnpm-workspace.yaml", ".gitignore", ".env.example", ".nvmrc", ".claude/settings.json", ".claude/rules/styling.md", ".claude/rules/design.md", ".claude/skills/design/SKILL.md", ".agents/skills/design/SKILL.md", ".agentic-cms.json"]) {
    assert.ok(fs.existsSync(path.join(target, file)), file);
  }
  assert.ok(!fs.existsSync(path.join(target, "src/lib")), "nothing of the package's source");
  assert.ok(!fs.existsSync(path.join(target, "wrangler.jsonc")) && !fs.existsSync(path.join(target, "open-next.config.ts")), "no Cloudflare files");
  assert.ok(result.created.includes("src/kit.ts") && result.kept.length === 0);

  const pkg = JSON.parse(read(target, "package.json"));
  assert.equal(pkg.name, "my-site");
  assert.equal(pkg.private, true);
  assert.equal(pkg.dependencies["agentic-cms"], "github:HKamkar/agentic-cms#v0.4.0");
  assert.equal(pkg.scripts.build, "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo");
  assert.equal(pkg.scripts.kit, "agentic-cms");
  assert.ok(pkg.devDependencies["playwright-core"] && pkg.devDependencies.tailwindcss && pkg.dependencies.next && pkg.dependencies.zod);
  assert.ok(!("@opennextjs/cloudflare" in pkg.devDependencies) && !("wrangler" in pkg.devDependencies));

  const tsconfig = JSON.parse(read(target, "tsconfig.json"));
  assert.deepEqual(tsconfig.compilerOptions.paths, { "@/*": ["./src/*"] });
  assert.match(read(target, "pnpm-workspace.yaml"), /"agentic-cms@git\+https:\/\/github\.com\/HKamkar\/agentic-cms\.git": true/);
  assert.match(read(target, ".claude/settings.json"), /"repo": "HKamkar\/agentic-cms"/);
  assert.doesNotMatch(read(target, ".claude/rules/content-engine.md"), /(?<!agentic-cms\/)src\/lib\//, "a site's rule never names the kit's source");
  assert.match(read(target, ".claude/rules/content-engine.md"), /node_modules\/agentic-cms\/src\/lib\/content\/README\.md/);
  assert.match(read(target, "next.config.ts"), /images: \{ unoptimized: true \}/);
  assert.doesNotMatch(read(target, "next.config.ts"), /opennextjs/);
  assert.match(read(target, "STANDARD.md"), /^> This is the wireframe's standard/m);
  const manifest = readManifest(target);
  assert.equal(manifest.version, "0.4.0");
  assert.ok(manifest.files[".claude/skills/design/SKILL.md"].startsWith("sha256:"));
  assert.ok(manifest.files[".claude/rules/styling.md"]);
});

test("scaffold never overwrites without --force, and merges an existing package.json", () => {
  const target = tmp();
  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "kept-name", scripts: { dev: "next dev -p 4000" }, dependencies: { "agentic-cms": "github:HKamkar/agentic-cms#v0.3.3" } }, null, 2));
  fs.mkdirSync(path.join(target, "src/config"), { recursive: true });
  fs.writeFileSync(path.join(target, "src/config/site.ts"), "export const site = {} as const;\n");
  const result = scaffold(target, { kitRoot: KIT, version: "0.4.0", force: false, ...quiet });
  assert.ok(result.kept.includes("src/config/site.ts"));
  assert.equal(read(target, "src/config/site.ts"), "export const site = {} as const;\n");
  const pkg = JSON.parse(read(target, "package.json"));
  assert.equal(pkg.name, "kept-name");
  assert.equal(pkg.scripts.dev, "next dev -p 4000", "an existing script is kept");
  assert.equal(pkg.scripts.build, "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo", "a missing script is added");
  assert.equal(pkg.dependencies["agentic-cms"], "github:HKamkar/agentic-cms#v0.3.3", "an existing dependency is kept");
  const forced = scaffold(target, { kitRoot: KIT, version: "0.4.0", force: true, ...quiet });
  assert.ok(forced.updated.includes("src/config/site.ts"));
  assert.notEqual(read(target, "src/config/site.ts"), "export const site = {} as const;\n");
});

test("agentFiles --check tells a site's edit from a kit update and a missing file", () => {
  const target = tmp();
  scaffold(target, { kitRoot: KIT, version: "0.4.0", force: false, ...quiet });
  assert.deepEqual(agentFiles(target, { kitRoot: KIT, version: "0.4.0", check: true, ...quiet }).filter((f) => f.status !== "ok"), []);
  fs.appendFileSync(path.join(target, ".claude/skills/design/SKILL.md"), "\nlocal note\n");
  fs.rmSync(path.join(target, ".claude/rules/design.md"));
  // stale: the site never touched the file (disk matches the record) but the kit's current one differs
  const manifest = readManifest(target);
  fs.writeFileSync(path.join(target, ".claude/rules/styling.md"), "an older version\n");
  manifest.files[".claude/rules/styling.md"] = `sha256:${crypto.createHash("sha256").update("an older version\n").digest("hex")}`;
  fs.writeFileSync(path.join(target, ".agentic-cms.json"), JSON.stringify(manifest));
  const report = agentFiles(target, { kitRoot: KIT, version: "0.4.0", check: true, ...quiet });
  const status = Object.fromEntries(report.map((f) => [f.file, f.status]));
  assert.equal(status[".claude/skills/design/SKILL.md"], "modified");
  assert.equal(status[".claude/rules/design.md"], "missing");
  assert.equal(status[".claude/rules/styling.md"], "stale");
  const written = agentFiles(target, { kitRoot: KIT, version: "0.4.0", check: false, ...quiet });
  assert.equal(Object.fromEntries(written.map((f) => [f.file, f.status]))[".claude/skills/design/SKILL.md"], "kept", "a site's edit is never clobbered");
  assert.equal(Object.fromEntries(written.map((f) => [f.file, f.status]))[".claude/rules/design.md"], "created");
  assert.equal(Object.fromEntries(written.map((f) => [f.file, f.status]))[".claude/rules/styling.md"], "updated");
});

test("a site's own rule that predates the manifest is kept on the first --agent-files run, not overwritten", () => {
  const target = tmp();
  fs.mkdirSync(path.join(target, ".claude/rules"), { recursive: true });
  fs.writeFileSync(path.join(target, ".claude/rules/styling.md"), "the site's own styling rule\n");
  const first = agentFiles(target, { kitRoot: KIT, version: "0.4.1", check: false, ...quiet });
  const status = Object.fromEntries(first.map((f) => [f.file, f.status]));
  assert.equal(status[".claude/rules/styling.md"], "kept");
  assert.equal(status[".claude/rules/design.md"], "created");
  assert.equal(read(target, ".claude/rules/styling.md"), "the site's own styling rule\n");
  const check = Object.fromEntries(agentFiles(target, { kitRoot: KIT, version: "0.4.1", check: true, ...quiet }).map((f) => [f.file, f.status]));
  assert.equal(check[".claude/rules/styling.md"], "modified", "and --check keeps calling it the site's");
  const forced = Object.fromEntries(agentFiles(target, { kitRoot: KIT, version: "0.4.1", check: false, force: true, ...quiet }).map((f) => [f.file, f.status]));
  assert.equal(forced[".claude/rules/styling.md"], "updated", "--force is the way to take the kit's");
});
