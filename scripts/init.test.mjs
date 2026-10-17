import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { checkComponents, formatReport } from "./lib/check-components.mjs";
import { recordOf, recordText } from "../tools/agent-file-releases.mjs";
import { acceptAgentFiles, AGENT_DIRS, agentFileDiff, AgentFileError, agentFiles, ALLOW_BUILDS, EXAMPLE, kitCommit, LINT, mergeWorkspace, readManifest, RELEASES, renderAgentFiles, scaffold, sha, siteVersion } from "./lib/init.mjs";
import { LightOnlyError } from "./lib/light-only.mjs";
import { readSiteProfile } from "./lib/storage-seed.mjs";

const KIT = path.resolve(import.meta.dirname, "..");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "init-"));
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
const quiet = { log: () => {} };

test("scaffold lays out a site from the package: the example, the agent files, the config, a manifest", () => {
  const target = path.join(tmp(), "my-site");
  const result = scaffold(target, { kitRoot: KIT, version: "0.4.0", force: false, ...quiet });
  for (const file of ["src/kit.ts", "src/app/layout.tsx", "src/components/README.md", "src/config/site.ts", "src/config/analytics.ts", "src/config/harness.ts", "src/components/ui/ConsentBanner.tsx", "src/styles/base.css", "content/pages/home.yaml", "content/VOICE.md", "public/images/brand/logo.svg", "STANDARD.md", "AGENTS.md", "CLAUDE.md", "README.md", "PLAN.md", "next.config.ts", "postcss.config.mjs", "eslint.config.mjs", "tsconfig.json", "package.json", "pnpm-workspace.yaml", ".gitignore", ".env.example", ".nvmrc", ".github/workflows/verify.yml", "scripts/setup.sh", ".claude/settings.json", ".claude/rules/styling.md", ".claude/rules/design.md", ".claude/rules/components.md", ".claude/rules/pages.md", "src/config/components.json", ".claude/skills/design/SKILL.md", ".agents/skills/design/SKILL.md", ".agentic-cms.json"]) {
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
  assert.equal(pkg.scripts.urls, "agentic-cms urls");
  assert.equal(pkg.scripts.lint, "eslint; s=$?; agentic-cms check-components || s=1; exit $s", "the lint runs ESLint, then the guard, failing on either");
  assert.equal(pkg.scripts.lint, LINT);
  const guard = checkComponents({ root: target, fs });
  assert.deepEqual(guard.findings, [], formatReport(guard).join("\n"));
  assert.ok(!("setup" in pkg.scripts), "no script named setup: pnpm setup is pnpm's own");
  assert.ok(pkg.devDependencies["playwright-core"] && pkg.devDependencies.tailwindcss && pkg.dependencies.next && pkg.dependencies.zod);
  assert.ok(!("@opennextjs/cloudflare" in pkg.devDependencies) && !("wrangler" in pkg.devDependencies));

  const tsconfig = JSON.parse(read(target, "tsconfig.json"));
  assert.deepEqual(tsconfig.compilerOptions.paths, { "@/*": ["./src/*"] });
  assert.match(read(target, "pnpm-workspace.yaml"), /"agentic-cms@git\+https:\/\/github\.com\/HKamkar\/agentic-cms\.git": true/);
  assert.deepEqual(parseYaml(read(target, "pnpm-workspace.yaml")).allowBuilds, Object.fromEntries(ALLOW_BUILDS.map((name) => [name, true])));
  assert.equal(mergeWorkspace(read(target, "pnpm-workspace.yaml")), null, "the kit's own workspace lacks nothing");
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
  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "kept-name", scripts: { dev: "next dev -p 4000", test: "node --test" }, dependencies: { "agentic-cms": "github:HKamkar/agentic-cms#v0.3.3" } }, null, 2));
  fs.mkdirSync(path.join(target, "src/config"), { recursive: true });
  fs.writeFileSync(path.join(target, "src/config/site.ts"), "export const site = {} as const;\n");
  const result = scaffold(target, { kitRoot: KIT, version: "0.4.0", force: false, ...quiet });
  assert.ok(result.kept.includes("src/config/site.ts"));
  assert.equal(read(target, "src/config/site.ts"), "export const site = {} as const;\n");
  const pkg = JSON.parse(read(target, "package.json"));
  assert.equal(pkg.name, "kept-name");
  assert.equal(pkg.scripts.dev, "next dev -p 4000", "an existing script is kept");
  assert.equal(pkg.scripts.test, "node --test", "a real test script of the site's is kept");
  assert.equal(pkg.scripts.build, "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo", "a missing script is added");
  assert.equal(pkg.dependencies["agentic-cms"], "github:HKamkar/agentic-cms#v0.3.3", "an existing dependency is kept");
  const forced = scaffold(target, { kitRoot: KIT, version: "0.4.0", force: true, ...quiet });
  assert.ok(forced.updated.includes("src/config/site.ts"));
  assert.notEqual(read(target, "src/config/site.ts"), "export const site = {} as const;\n");
});

// What docs/init.md had a site write before init (0.7.6 and earlier): `pnpm init`'s package.json and the workspace snippet without unrs-resolver.
const PNPM_INIT = { name: "my-site", version: "1.0.0", description: "", main: "index.js", scripts: { test: 'echo "Error: no test specified" && exit 1' }, keywords: [], author: "", license: "ISC", devEngines: { packageManager: { name: "pnpm", version: "12.11.2", onFail: "download" } }, packageManager: "pnpm@12.11.2", type: "module" };
const OLD_SNIPPET = `# our settings, kept\nallowBuilds:\n  "agentic-cms@git+https://github.com/HKamkar/agentic-cms.git": true\n  sharp: true # the image optimiser\nnodeLinker: hoisted\n`;

test("an existing workspace is merged, not kept: the kit's missing keys added, the site's keys, values and comments left, unchanged on a second run", () => {
  const target = tmp();
  fs.writeFileSync(path.join(target, "pnpm-workspace.yaml"), OLD_SNIPPET);
  const logged = [];
  const first = scaffold(target, { kitRoot: KIT, version: "0.8.0", force: false, log: (line) => logged.push(line) });
  assert.ok(first.updated.includes("pnpm-workspace.yaml"));
  assert.ok(logged.includes("merged   pnpm-workspace.yaml (allowBuilds: unrs-resolver)"), logged.join("\n"));
  const merged = read(target, "pnpm-workspace.yaml");
  assert.equal(merged, `${OLD_SNIPPET.replace("nodeLinker", "  unrs-resolver: true\nnodeLinker")}`, "one line added, the rest byte for byte");
  assert.deepEqual(Object.keys(parseYaml(merged).allowBuilds), ALLOW_BUILDS);
  const second = scaffold(target, { kitRoot: KIT, version: "0.8.0", force: false, ...quiet });
  assert.ok(second.kept.includes("pnpm-workspace.yaml"));
  assert.equal(read(target, "pnpm-workspace.yaml"), merged);
  // --force merges too: the site's settings and its own value for a kit key are never replaced
  fs.writeFileSync(path.join(target, "pnpm-workspace.yaml"), "allowBuilds:\n  sharp: false\n");
  scaffold(target, { kitRoot: KIT, version: "0.8.0", force: true, ...quiet });
  assert.deepEqual(parseYaml(read(target, "pnpm-workspace.yaml")).allowBuilds, { sharp: false, "agentic-cms@git+https://github.com/HKamkar/agentic-cms.git": true, "unrs-resolver": true });
  assert.match(read(target, "pnpm-workspace.yaml"), /^ {2}"agentic-cms@git\+https:\/\/github\.com\/HKamkar\/agentic-cms\.git": true$/m, "the git spec quoted, as the kit writes it");
});

test("a legacy onlyBuiltDependencies list, which pnpm no longer reads, is carried into allowBuilds and left in place", () => {
  const legacy = "onlyBuiltDependencies:\n  - sharp\n  - esbuild\n";
  const merged = mergeWorkspace(legacy);
  assert.deepEqual(merged.added, [...ALLOW_BUILDS, "esbuild"]);
  assert.deepEqual(parseYaml(merged.text), { onlyBuiltDependencies: ["sharp", "esbuild"], allowBuilds: { "agentic-cms@git+https://github.com/HKamkar/agentic-cms.git": true, sharp: true, "unrs-resolver": true, esbuild: true } });
  assert.equal(mergeWorkspace(merged.text), null);
  assert.deepEqual(mergeWorkspace("allowBuilds:\n  agentic-cms@git+https://github.com/HKamkar/agentic-cms.git: true\n").added, ["sharp", "unrs-resolver"], "the key as `pnpm add --allow-build` writes it, unquoted, is the same key");
  assert.deepEqual(parseYaml(mergeWorkspace("").text), { allowBuilds: Object.fromEntries(ALLOW_BUILDS.map((name) => [name, true])) }, "an empty file gets the keys");
  assert.equal(mergeWorkspace("allowBuilds: [sharp]\n"), null, "a shape pnpm cannot read is left for pnpm to name");
  assert.equal(mergeWorkspace("allowBuilds:\n  sharp: true\n bad: indent\n"), null, "a file that does not parse is left alone");
});

test("pnpm init's package.json: its failing test gives way to the kit's, its main is dropped, its license, version, devEngines and packageManager stay", () => {
  const target = tmp();
  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify(PNPM_INIT, null, 2));
  const logged = [];
  scaffold(target, { kitRoot: KIT, version: "0.8.0", force: false, log: (line) => logged.push(line) });
  const pkg = JSON.parse(read(target, "package.json"));
  assert.equal(pkg.scripts.test, 'node --import agentic-cms/loader --test "src/**/*.test.ts"');
  assert.ok(!("main" in pkg));
  assert.equal(pkg.license, "ISC");
  assert.equal(pkg.version, "1.0.0");
  assert.deepEqual(pkg.devEngines, PNPM_INIT.devEngines);
  assert.equal(pkg.packageManager, "pnpm@12.11.2");
  assert.equal(pkg.scripts.build, "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo");
  assert.ok(logged.includes('merged   package.json (the kit\'s test script in place of pnpm init\'s placeholder; pnpm init\'s main: "index.js" dropped)'), logged.join("\n"));
  // a main that names a file the site has is the site's
  const own = tmp();
  fs.writeFileSync(path.join(own, "package.json"), JSON.stringify({ ...PNPM_INIT, scripts: {} }));
  fs.writeFileSync(path.join(own, "index.js"), "export {};\n");
  scaffold(own, { kitRoot: KIT, version: "0.8.0", force: false, ...quiet });
  assert.equal(JSON.parse(read(own, "package.json")).main, "index.js");
});

test("the setup script is written once, then kept as the site has it, and hands over to agentic-cms setup", () => {
  const target = tmp();
  assert.ok(scaffold(target, { kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).created.includes("scripts/setup.sh"));
  assert.equal(read(target, "scripts/setup.sh"), read(KIT, "templates/site/setup.sh"));
  assert.match(read(target, "scripts/setup.sh"), /\nexec pnpm exec agentic-cms setup "\$@"\n$/);
  fs.writeFileSync(path.join(target, "scripts/setup.sh"), "#!/usr/bin/env bash\n# ours\n");
  assert.ok(scaffold(target, { kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).kept.includes("scripts/setup.sh"));
  assert.equal(read(target, "scripts/setup.sh"), "#!/usr/bin/env bash\n# ours\n");
});

/** Every file under a directory, relative to it. */
const filesUnder = (root, dir = root) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(root, path.join(dir, e.name)) : [path.relative(root, path.join(dir, e.name))]));

test("--light-only lays out a site without dark mode: one scheme in the profile, single colours under color-scheme light, no theme script, no toggle, no dark lines in the docs", async () => {
  const target = path.join(tmp(), "light");
  const result = scaffold(target, { kitRoot: KIT, version: "0.8.0", lightOnly: true, ...quiet });
  assert.equal(result.lightOnly, true);
  assert.ok(!fs.existsSync(path.join(target, "src/components/ui/ThemeToggle.tsx")), "no toggle component");
  const layout = read(target, "src/app/layout.tsx");
  assert.doesNotMatch(layout, /THEME_SCRIPT|suppressHydrationWarning|data-theme/, "no theme script, nothing to suppress");
  assert.match(layout, /export const viewport: Viewport = \{ colorScheme: "light" \};/);
  assert.match(layout, /<html lang=\{site\.locale\}>/);
  const base = read(target, "src/styles/base.css");
  assert.match(base, /^:root \{ color-scheme: light; \}$/m);
  assert.doesNotMatch(base, /data-theme|light dark|light-dark/);
  const globals = read(target, "src/app/globals.css");
  assert.doesNotMatch(globals, /light-dark/);
  assert.match(globals, /--color-paper: #ffffff;\n {2}--color-ink: #000000;/, "each colour its light value");
  assert.deepEqual((await readSiteProfile(target)).schemes, ["light"], "the profile names one scheme");
  for (const file of filesUnder(path.join(target, "src")).filter((f) => /\.(tsx?|css|md)$/.test(f))) assert.doesNotMatch(read(target, `src/${file}`), /ThemeToggle|THEME_SCRIPT|data-theme|light-dark\(/, `src/${file}: nothing of the theme`);
  const standard = read(target, "STANDARD.md");
  assert.doesNotMatch(standard, /dark-mode:|light-only:|\| Dark \||ThemeToggle|data-theme|light-dark\(/, "STANDARD without its dark lines or the markers");
  assert.match(standard, /^### The scheme$/m);
  assert.match(standard, /^\| Value \| Colour \| What it is \|$/m);
  assert.match(standard, /^> This is the wireframe's standard/m, "still the scaffold's note");
  assert.doesNotMatch(read(target, "src/components/README.md"), /dark-mode:|ThemeToggle|theme switch/);
  assert.match(read(target, "src/components/ui/Navbar.tsx"), /<Button href=\{site\.cta\.href\}/, "the navbar keeps everything else");
  const config = read(target, "src/config/site.ts");
  assert.doesNotMatch(config, /themeToggle|ThemeToggle/, "no labels for a toggle the site does not have");
  assert.match(config, /^ {2}navbar: \{ label: "Main", menu: "Menu" \},\n {2}\/\*\* ui\/Footer's/m, "the chrome's other words stay, and so does the comment above the next");
  assert.deepEqual(checkComponents({ root: target, fs }).findings, [], "the guard passes without the toggle and its entry");

  const both = path.join(tmp(), "both");
  scaffold(both, { kitRoot: KIT, version: "0.8.0", ...quiet });
  assert.ok(fs.existsSync(path.join(both, "src/components/ui/ThemeToggle.tsx")), "without the flag the example keeps its theme");
  assert.match(read(both, "src/app/layout.tsx"), /THEME_SCRIPT/);
  assert.deepEqual((await readSiteProfile(both)).schemes, ["light", "dark"]);
});

test("a light-only edit that misses its place in the example fails before anything is written", () => {
  const kit = tmp();
  for (const entry of EXAMPLE) {
    const full = path.join(kit, entry);
    if (/\.[a-z]+$|^\.[a-z]+$/.test(path.basename(entry))) { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, ""); } else fs.mkdirSync(full, { recursive: true });
  }
  fs.writeFileSync(path.join(kit, "src/app/layout.tsx"), "export const viewport = { colorScheme: \"light dark\" };\n");
  fs.writeFileSync(path.join(kit, "STANDARD.md"), "# Standard\n\nFour values<!-- dark-mode:start -->, each a pair<!-- dark-mode:end -->.\n");
  const target = path.join(tmp(), "never");
  assert.throws(() => scaffold(target, { kitRoot: kit, version: "0.8.0", lightOnly: true, ...quiet }), (error) => error instanceof LightOnlyError && /src\/app\/layout\.tsx: the theme script and the comment above it not found/.test(error.message));
  assert.ok(!fs.existsSync(target), "nothing written");
});

test("the site's CI workflow is written once, then kept as the site has it", () => {
  const target = tmp();
  const workflow = ".github/workflows/verify.yml";
  assert.ok(scaffold(target, { kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).created.includes(workflow));
  const steps = parseYaml(read(target, workflow)).jobs.test.steps;
  assert.deepEqual(steps.filter((s) => s.run).map((s) => s.run), ["pnpm install --frozen-lockfile", "pnpm lint", "pnpm test", "pnpm build", "pnpm exec agentic-cms init . --agent-files --check"]);
  for (const { uses } of steps.filter((s) => s.uses)) assert.match(uses, /@[0-9a-f]{40}$/, `${uses}: pinned to a commit`);
  assert.equal(steps.find((s) => s.uses?.startsWith("actions/setup-node@")).with["node-version-file"], ".nvmrc");
  fs.writeFileSync(path.join(target, workflow), "name: ours\n");
  assert.ok(scaffold(target, { kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).kept.includes(workflow));
  assert.equal(read(target, workflow), "name: ours\n");
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

test("a site's own rule that predates the manifest is kept on the first --agent-files run, not overwritten, and is a gap until the site accepts the kit's text", () => {
  const target = tmp();
  fs.mkdirSync(path.join(target, ".claude/rules"), { recursive: true });
  fs.writeFileSync(path.join(target, ".claude/rules/styling.md"), "the site's own styling rule\n");
  const first = agentFiles(target, { kitRoot: KIT, version: "0.4.1", check: false, ...quiet });
  const status = Object.fromEntries(first.map((f) => [f.file, f.status]));
  assert.equal(status[".claude/rules/styling.md"], "kept, kit changed", "no base: the site never took the kit's text");
  assert.equal(status[".claude/rules/design.md"], "created");
  assert.ok(!(".claude/rules/components.md" in status), "no guard config: the components rule is not the site's");
  assert.equal(read(target, ".claude/rules/styling.md"), "the site's own styling rule\n");
  assert.ok(!(".claude/rules/styling.md" in readManifest(target).files), "and no base is made up for it");
  const check = Object.fromEntries(agentFiles(target, { kitRoot: KIT, version: "0.4.1", check: true, ...quiet }).map((f) => [f.file, f.status]));
  assert.equal(check[".claude/rules/styling.md"], "modified, kit changed", "and --check keeps calling it the site's, with the kit's text to look at");
  const diff = agentFileDiff(target, ".claude/rules/styling.md", { kitRoot: KIT, version: "0.4.1" });
  assert.equal(diff.base, null);
  assert.match(diff.diff, /^--- a\/\.claude\/rules\/styling\.md\n\+\+\+ b\/\.claude\/rules\/styling\.md\n@@ -1 \+1,\d+ @@\n-the site's own styling rule\n/, "with no base, the site's text against the kit's");
  const forced = Object.fromEntries(agentFiles(target, { kitRoot: KIT, version: "0.4.1", check: false, force: true, ...quiet }).map((f) => [f.file, f.status]));
  assert.equal(forced[".claude/rules/styling.md"], "updated", "--force is the way to take the kit's");
});

test("--agent-files keeps AGENTS.md's scoped-rules table as the site's rules read; --check flags it stale or missing, and an AGENTS.md past what Codex reads", () => {
  const target = tmp();
  scaffold(target, { kitRoot: KIT, version: "0.5.5", force: false, ...quiet });
  const status = (report) => Object.fromEntries(report.map((f) => [f.file, f.status]));
  const check = () => status(agentFiles(target, { kitRoot: KIT, version: "0.5.5", check: true, ...quiet }));
  assert.equal(check()["AGENTS.md (rules table)"], "ok", "a new site's AGENTS.md carries the table");
  assert.equal(check()["AGENTS.md (size)"], "ok");
  assert.match(read(target, "AGENTS.md"), /^\| `src\/\*\*\/\*\.tsx`, `src\/\*\*\/\*\.css` \| \[Styling\]\(\.claude\/rules\/styling\.md\) \|$/m);
  // the site widens a rule's scope: its edit is kept, and the table follows the rule
  const seo = path.join(target, ".claude/rules/seo.md");
  fs.writeFileSync(seo, fs.readFileSync(seo, "utf8").replace('  - "content/pages/**"', '  - "content/pages/**"\n  - "content/landing/**"'));
  assert.equal(check()["AGENTS.md (rules table)"], "stale");
  const written = status(agentFiles(target, { kitRoot: KIT, version: "0.5.5", check: false, ...quiet }));
  assert.equal(written[".claude/rules/seo.md"], "kept");
  assert.equal(written["AGENTS.md (rules table)"], "updated");
  assert.match(read(target, "AGENTS.md"), /`content\/landing\/\*\*` \| \[SEO\]/);
  // an AGENTS.md without the table gets one before its first section, the rest of it untouched
  fs.writeFileSync(path.join(target, "AGENTS.md"), "# Our site\n\nOur own rules.\n\n## Styling\n\n- ours\n");
  assert.equal(check()["AGENTS.md (rules table)"], "missing");
  assert.equal(status(agentFiles(target, { kitRoot: KIT, version: "0.5.5", check: false, ...quiet }))["AGENTS.md (rules table)"], "created");
  const agents = read(target, "AGENTS.md");
  assert.ok(agents.startsWith("# Our site\n\nOur own rules.\n\n<!-- rules-table:start -->\n## Scoped rules for Claude Code and Codex\n"));
  assert.ok(agents.endsWith("<!-- rules-table:end -->\n\n## Styling\n\n- ours\n"));
  // past the 32 KiB Codex reads by default
  fs.appendFileSync(path.join(target, "AGENTS.md"), `\n${"x".repeat(33 * 1024)}\n`);
  const size = agentFiles(target, { kitRoot: KIT, version: "0.5.5", check: true, ...quiet }).find((f) => f.file === "AGENTS.md (size)");
  assert.equal(size.status, "too big");
  assert.ok(size.bytes > 32 * 1024);
});

test("the components rule follows the guard: a site without src/config/components.json is neither given it nor told it is missing; adopting the guard brings it", () => {
  const target = tmp();
  scaffold(target, { kitRoot: KIT, version: "0.8.0", force: false, ...quiet });
  const status = (report) => Object.fromEntries(report.map((f) => [f.file, f.status]));
  const rule = path.join(target, ".claude/rules/components.md");
  // a site as 0.7.6 left it: no guard config, no components rule, nothing of either in the manifest or the table
  fs.rmSync(path.join(target, "src/config/components.json"));
  fs.rmSync(rule);
  const refreshed = status(agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: false, ...quiet }));
  assert.ok(!(".claude/rules/components.md" in refreshed), "not written");
  assert.ok(!fs.existsSync(rule));
  assert.ok(!(".claude/rules/components.md" in readManifest(target).files), "not recorded");
  assert.doesNotMatch(read(target, "AGENTS.md"), /\[Components\]/, "the table follows the rules the site has");
  const check = agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: true, ...quiet });
  assert.ok(!check.some((f) => f.file === ".claude/rules/components.md"), "not reported missing");
  assert.deepEqual(check.filter((f) => f.status !== "ok"), [], "--check stays clean");
  // the site adopts the guard: its config, then --agent-files
  fs.writeFileSync(path.join(target, "src/config/components.json"), "{}\n");
  assert.equal(status(agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: true, ...quiet }))[".claude/rules/components.md"], "missing");
  assert.equal(status(agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: false, ...quiet }))[".claude/rules/components.md"], "created");
  assert.equal(read(target, ".claude/rules/components.md"), read(KIT, "templates/site/rules/components.md"));
  assert.match(read(target, "AGENTS.md"), /\| \[Components\]\(\.claude\/rules\/components\.md\) \|$/m);
  assert.deepEqual(agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: true, ...quiet }).filter((f) => f.status !== "ok"), []);
});

/** A kit as an older release left its agent files: this kit's, with the styling rule's text as it was. */
function olderKit() {
  const kit = tmp();
  for (const dir of ["templates/site/rules", ".claude/skills", ".agents/skills"]) fs.cpSync(path.join(KIT, dir), path.join(kit, dir), { recursive: true });
  fs.writeFileSync(path.join(kit, "templates/site/rules/styling.md"), read(KIT, "templates/site/rules/styling.md").replace(/\n- [^\n]*\n/, "\n- The older styling line.\n"));
  return kit;
}
/** This kit's agent files with a record of `releases` [{ version, changed }], each release this kit's texts but for those `changed` names by site path; a kit whose record holds its own texts is a release, one whose record does not a pin between releases. */
function recordedKit(releases) {
  const kit = tmp();
  for (const dir of Object.keys(AGENT_DIRS)) fs.cpSync(path.join(KIT, dir), path.join(kit, dir), { recursive: true });
  const current = renderAgentFiles(kit);
  const record = recordOf(releases.map(({ version, changed = {} }) => ({ version, files: current.map(({ file, text }) => ({ file, text: changed[file] ?? text })) })));
  fs.mkdirSync(path.dirname(path.join(kit, RELEASES)), { recursive: true });
  fs.writeFileSync(path.join(kit, RELEASES), recordText(record));
  return kit;
}
/** A site as 0.7.6 left it: no base copies, which 0.8.0 began to keep. */
const withoutCopies = (target) => fs.rmSync(path.join(target, ".agentic-cms"), { recursive: true, force: true });
const git = (cwd, ...args) => { const r = spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
const statusOf = (report) => Object.fromEntries(report.map((f) => [f.file, f.status]));

test("a site that keeps its edits passes --check: an edit of a text the kit left alone is modified (exit 0), one the kit changed is a gap until --diff, a merge and --accept", () => {
  const target = tmp();
  const older = olderKit();
  const kit = recordedKit([{ version: "0.8.0" }]);
  agentFiles(target, { kitRoot: older, version: "0.7.6", ...quiet });
  withoutCopies(target);
  git(target, "init", "-q");
  git(target, "add", "-A");
  git(target, "commit", "-qm", "the agent files as the older kit wrote them");
  for (const rule of ["styling", "seo"]) fs.appendFileSync(path.join(target, `.claude/rules/${rule}.md`), "\n- The site's own line.\n");
  git(target, "commit", "-qam", "the site's edits");
  const check = statusOf(agentFiles(target, { kitRoot: kit, version: "0.8.0", check: true, ...quiet }));
  assert.equal(check[".claude/rules/seo.md"], "modified", "the kit's text is the base: nothing to merge");
  assert.equal(check[".claude/rules/styling.md"], "modified, kit changed");
  // --diff reads the base from the site's history before any copy exists, and prints the kit's change alone
  const before = agentFileDiff(target, ".claude/rules/styling.md", { kitRoot: kit });
  assert.match(before.from, /^git [0-9a-f]{7}$/);
  assert.match(before.diff, /^-- The older styling line\.$/m);
  assert.doesNotMatch(before.diff, /The site's own line/, "the site's edit is not the kit's change");
  assert.equal(agentFileDiff(target, ".claude/rules/seo.md", { kitRoot: kit }).diff, "");
  // the refresh keeps both edits and the base copies --diff needs, recovered from the history
  const refreshed = statusOf(agentFiles(target, { kitRoot: kit, version: "0.8.0", ...quiet }));
  assert.equal(refreshed[".claude/rules/styling.md"], "kept, kit changed");
  assert.equal(refreshed[".claude/rules/seo.md"], "kept");
  assert.equal(read(target, ".agentic-cms/base/claude/rules/styling.md"), read(older, "templates/site/rules/styling.md"));
  assert.equal(read(target, ".agentic-cms/base/claude/rules/seo.md"), read(KIT, "templates/site/rules/seo.md"));
  assert.ok(!fs.existsSync(path.join(target, ".agentic-cms/base/claude/rules/design.md")), "a copy only for a file the site edited");
  assert.equal(agentFileDiff(target, ".claude/rules/styling.md", { kitRoot: kit }).from, ".agentic-cms/base/claude/rules/styling.md");
  // the site merges the kit's change by hand, keeping its line, and accepts it
  fs.writeFileSync(path.join(target, ".claude/rules/styling.md"), `${read(KIT, "templates/site/rules/styling.md")}\n- The site's own line.\n`);
  assert.equal(statusOf(agentFiles(target, { kitRoot: kit, version: "0.8.0", check: true, ...quiet }))[".claude/rules/styling.md"], "modified, kit changed", "a merge alone is not recorded");
  assert.deepEqual(acceptAgentFiles(target, ["./.claude/rules/styling.md"], { kitRoot: kit }), [{ file: ".claude/rules/styling.md", status: "modified" }]);
  assert.equal(read(target, ".agentic-cms/base/claude/rules/styling.md"), read(KIT, "templates/site/rules/styling.md"), "the base copy is the kit's text it took");
  assert.deepEqual(agentFiles(target, { kitRoot: kit, version: "0.8.0", check: true, ...quiet }).filter((f) => !["ok", "modified"].includes(f.status)), [], "--check passes");
  assert.equal(agentFileDiff(target, ".claude/rules/styling.md", { kitRoot: kit }).diff, "");
  // the site drops its edit: the next refresh finds the kit's text and keeps no copy
  fs.writeFileSync(path.join(target, ".claude/rules/styling.md"), read(KIT, "templates/site/rules/styling.md"));
  fs.writeFileSync(path.join(target, ".claude/rules/seo.md"), read(KIT, "templates/site/rules/seo.md"));
  agentFiles(target, { kitRoot: kit, version: "0.8.0", ...quiet });
  assert.ok(!fs.existsSync(path.join(target, ".agentic-cms")), "no edits, no copies");
});

test("--diff names the kit's file when the base is in neither its copy nor the history; --accept refuses a name that is not an agent file or a missing file, writing nothing", () => {
  const target = tmp();
  agentFiles(target, { kitRoot: olderKit(), version: "0.7.6", ...quiet });
  withoutCopies(target);
  fs.appendFileSync(path.join(target, ".claude/rules/styling.md"), "\n- The site's own line.\n");
  assert.throws(() => agentFileDiff(target, ".claude/rules/styling.md", { kitRoot: KIT }), (error) => error instanceof AgentFileError && /node_modules\/agentic-cms\/templates\/site\/rules\/styling\.md by hand, merge, then agentic-cms init --agent-files --accept \.claude\/rules\/styling\.md$/.test(error.message));
  const manifest = read(target, ".agentic-cms.json");
  assert.throws(() => acceptAgentFiles(target, [".claude/rules/styling.md", "STANDARD.md"], { kitRoot: KIT }), /STANDARD\.md is not one of this site's agent files/);
  fs.rmSync(path.join(target, ".claude/rules/seo.md"));
  assert.throws(() => acceptAgentFiles(target, [".claude/rules/styling.md", ".claude/rules/seo.md"], { kitRoot: KIT }), /\.claude\/rules\/seo\.md is missing: agentic-cms init --agent-files writes it/);
  assert.equal(read(target, ".agentic-cms.json"), manifest, "nothing written");
  assert.ok(!fs.existsSync(path.join(target, ".agentic-cms")));
});

test("the manifest records the kit commit the site's lockfile installed, when the kit running is the site's own; a 0.7.6 manifest reads as before", () => {
  const target = tmp();
  const sha = "5345ccc35663e662b8172bcc87f8ba5f10dd10cd";
  fs.writeFileSync(path.join(target, "pnpm-lock.yaml"), `lockfileVersion: '9.0'\n\npackages:\n\n  agentic-cms@https://codeload.github.com/HKamkar/agentic-cms/tar.gz/${sha}:\n    resolution: {gitHosted: true, tarball: https://codeload.github.com/HKamkar/agentic-cms/tar.gz/${sha}}\n`);
  assert.equal(kitCommit(target, KIT), undefined, "no node_modules/agentic-cms: a kit run from elsewhere");
  fs.mkdirSync(path.join(target, "node_modules"));
  fs.symlinkSync(KIT, path.join(target, "node_modules/agentic-cms"), "dir");
  assert.equal(kitCommit(target, KIT), sha);
  assert.equal(kitCommit(target, olderKit()), undefined, "another kit than the one installed");
  agentFiles(target, { kitRoot: KIT, version: "0.7.6", ...quiet });
  assert.deepEqual(Object.keys(readManifest(target)), ["version", "commit", "files"]);
  assert.equal(readManifest(target).commit, sha);
  // a manifest as 0.7.6 wrote it: a version and a hash per file
  const legacy = { version: "0.7.6", files: readManifest(target).files };
  fs.writeFileSync(path.join(target, ".agentic-cms.json"), JSON.stringify(legacy, null, 1));
  assert.deepEqual(agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: true, ...quiet }).filter((f) => f.status !== "ok"), []);
});

/** The styling rule as an older release had it. */
const OLDER_STYLING = read(KIT, "templates/site/rules/styling.md").replace(/\n- [^\n]*\n/, "\n- The older styling line.\n");
const SEO = ".claude/rules/seo.md";
const STYLING = ".claude/rules/styling.md";
const OWN_LINE = "\n- The site's own line.\n";
const entry = (report, file) => report.find((f) => f.file === file);

/** A kit with a record of its releases: this kit's agent files, and a 0.7.6 whose texts are this kit's but for the older styling rule. */
const releasedKit = () => recordedKit([{ version: "0.7.6", changed: { [STYLING]: OLDER_STYLING } }]);

/** A site whose seo and styling rules it wrote before the manifest recorded their bases: each the text of 0.7.6 with the site's own line, under a manifest as 0.7.6 wrote it. */
function noBaseSite(kit, { version = "0.7.6" } = {}) {
  const target = tmp();
  agentFiles(target, { kitRoot: kit, version, ...quiet });
  const { files } = readManifest(target);
  delete files[SEO];
  delete files[STYLING];
  fs.writeFileSync(path.join(target, ".agentic-cms.json"), JSON.stringify({ version, files }, null, 1));
  fs.writeFileSync(path.join(target, SEO), `${read(KIT, "templates/site/rules/seo.md")}${OWN_LINE}`);
  fs.writeFileSync(path.join(target, STYLING), `${OLDER_STYLING}${OWN_LINE}`);
  return target;
}

test("no base, and the kit's text unchanged since the version the site was on: the site's edit (modified, noted), nothing to --diff, and the refresh records the base", () => {
  const kit = releasedKit();
  const target = noBaseSite(kit);
  const check = agentFiles(target, { kitRoot: kit, version: "0.8.1", check: true, ...quiet });
  assert.deepEqual(entry(check, SEO), { file: SEO, status: "modified", note: "no base: kit unchanged since 0.7.6" });
  const diff = agentFileDiff(target, SEO, { kitRoot: kit, version: "0.8.1" });
  assert.deepEqual(diff, { file: SEO, status: "modified", base: sha(read(KIT, "templates/site/rules/seo.md")), from: null, diff: "", note: "no base: kit unchanged since 0.7.6" });
  const refreshed = agentFiles(target, { kitRoot: kit, version: "0.8.1", ...quiet });
  assert.deepEqual(entry(refreshed, SEO), { file: SEO, status: "kept", note: "no base: kit unchanged since 0.7.6" });
  assert.equal(read(target, SEO), `${read(KIT, "templates/site/rules/seo.md")}${OWN_LINE}`, "the site's edit is kept");
  assert.equal(readManifest(target).files[SEO], sha(read(KIT, "templates/site/rules/seo.md")), "the base is recorded");
  assert.deepEqual(entry(agentFiles(target, { kitRoot: kit, version: "0.8.1", check: true, ...quiet }), SEO), { file: SEO, status: "modified" }, "and is the manifest's from then on");
});

test("no base, and the kit's text changed since the version the site was on: that release's text is its base — --diff prints the kit's change alone, and the refresh keeps the file and records the base", () => {
  const kit = releasedKit();
  const target = noBaseSite(kit);
  const note = "no base: from the kit's text at 0.7.6, the version the site was on";
  assert.deepEqual(entry(agentFiles(target, { kitRoot: kit, version: "0.8.1", check: true, ...quiet }), STYLING), { file: STYLING, status: "modified, kit changed", note });
  const diff = agentFileDiff(target, STYLING, { kitRoot: kit, version: "0.8.1" });
  assert.equal(diff.base, sha(OLDER_STYLING));
  assert.equal(diff.from, "agentic-cms 0.7.6");
  assert.equal(diff.note, note);
  assert.match(diff.diff, /^-- The older styling line\.$/m, "old → new");
  assert.doesNotMatch(diff.diff, /The site's own line/, "the site's edit is not the kit's change");
  const refreshed = agentFiles(target, { kitRoot: kit, version: "0.8.1", ...quiet });
  assert.deepEqual(entry(refreshed, STYLING), { file: STYLING, status: "kept, kit changed", note });
  assert.equal(read(target, STYLING), `${OLDER_STYLING}${OWN_LINE}`);
  assert.equal(readManifest(target).files[STYLING], sha(OLDER_STYLING), "the release's text is recorded as its base");
  assert.equal(read(target, ".agentic-cms/base/claude/rules/styling.md"), OLDER_STYLING, "with its copy");
  assert.equal(agentFileDiff(target, STYLING, { kitRoot: kit, version: "0.8.1" }).diff, diff.diff, "the same change, from the copy");
  fs.writeFileSync(path.join(target, STYLING), `${read(KIT, "templates/site/rules/styling.md")}${OWN_LINE}`);
  assert.deepEqual(acceptAgentFiles(target, [STYLING], { kitRoot: kit }), [{ file: STYLING, status: "modified" }]);
});

test("no base, and no release known as its source: modified, kit changed, noted, and --diff is the site's whole file against the kit's text, from the file itself; nothing is recorded", () => {
  const kit = releasedKit();
  const target = noBaseSite(kit, { version: "0.6.0" });
  const note = "no base, and no release of the kit found as its source: --diff is the site's whole file";
  assert.deepEqual(entry(agentFiles(target, { kitRoot: kit, version: "0.8.1", check: true, ...quiet }), SEO), { file: SEO, status: "modified, kit changed", note }, "the record has no 0.6.0");
  const diff = agentFileDiff(target, SEO, { kitRoot: kit, version: "0.8.1" });
  assert.equal(diff.base, null);
  assert.equal(diff.from, SEO, "the site's file, not a base");
  assert.equal(diff.note, note);
  assert.match(diff.diff, /^-- The site's own line\.$/m, "the site's own lines are in it");
  assert.deepEqual(entry(agentFiles(target, { kitRoot: kit, version: "0.8.1", ...quiet }), SEO), { file: SEO, status: "kept, kit changed", note });
  assert.ok(!(SEO in readManifest(target).files), "no base is made up");
});

test("the version a site was on is the manifest's, unless the running version wrote it, else the last other one its package.json named in git; a file that is a release's text untouched is stale", () => {
  const target = tmp();
  assert.equal(siteVersion(target, { version: "0.7.6", files: {} }, "0.8.1"), "0.7.6");
  assert.equal(siteVersion(target, { version: "0.8.1", files: {} }, "0.8.1"), undefined, "a refresh with the running version wrote it, and no git");
  const pin = (spec) => fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ dependencies: { "agentic-cms": spec } }));
  git(target, "init", "-q");
  pin("github:HKamkar/agentic-cms#v0.6.1");
  git(target, "add", "package.json");
  git(target, "commit", "-qm", "0.6.1");
  pin("github:HKamkar/agentic-cms#v0.7.6");
  git(target, "commit", "-qam", "0.7.6");
  pin("github:HKamkar/agentic-cms#v0.8.1");
  assert.equal(siteVersion(target, { version: null, files: {} }, "0.8.1"), "0.7.6", "the upgrade not yet committed");
  git(target, "commit", "-qam", "0.8.1");
  assert.equal(siteVersion(target, { version: "0.8.1", files: {} }, "0.8.1"), "0.7.6", "the upgrade committed");
  // a site's file that is the text of a release, never edited: stale, and the refresh takes the kit's
  const kit = releasedKit();
  fs.mkdirSync(path.join(target, ".claude/rules"), { recursive: true });
  fs.writeFileSync(path.join(target, STYLING), OLDER_STYLING);
  assert.deepEqual(entry(agentFiles(target, { kitRoot: kit, version: "0.8.1", check: true, ...quiet }), STYLING), { file: STYLING, status: "stale", note: "no base: the kit's text at 0.7.6" });
  assert.equal(entry(agentFiles(target, { kitRoot: kit, version: "0.8.1", ...quiet }), STYLING).status, "updated");
  assert.equal(read(target, STYLING), read(KIT, "templates/site/rules/styling.md"));
});

test("a rule init writes and the site edits before its first commit keeps its base: a pin's text in a copy, a release's in the kit's record, and --diff prints the kit's change alone", () => {
  const COMPONENTS = ".claude/rules/components.md";
  const newer = (kit) => { fs.appendFileSync(path.join(kit, "templates/site/rules/components.md"), "\n- The kit's newer line.\n"); return kit; };
  for (const { name, releases, from } of [
    { name: "a pin between releases", releases: [], from: ".agentic-cms/base/claude/rules/components.md" },
    { name: "a release", releases: [{ version: "0.8.0" }], from: "agentic-cms 0.8.0" },
  ]) {
    const target = tmp();
    fs.mkdirSync(path.join(target, "src/config"), { recursive: true });
    fs.writeFileSync(path.join(target, "src/config/components.json"), "{}\n");
    const kit = recordedKit(releases);
    assert.equal(entry(agentFiles(target, { kitRoot: kit, version: "0.8.0", ...quiet }), COMPONENTS).status, "created", name);
    const copy = path.join(target, ".agentic-cms/base/claude/rules/components.md");
    assert.equal(fs.existsSync(copy), !releases.length, `${name}: a copy only where no release holds the text`);
    fs.appendFileSync(path.join(target, COMPONENTS), OWN_LINE);
    assert.equal(fs.existsSync(path.join(target, ".git")), false, "nothing committed");
    const later = newer(recordedKit(releases));
    assert.equal(entry(agentFiles(target, { kitRoot: later, version: "0.8.1", check: true, ...quiet }), COMPONENTS).status, "modified, kit changed", name);
    const diff = agentFileDiff(target, COMPONENTS, { kitRoot: later, version: "0.8.1" });
    assert.equal(diff.from, from, name);
    assert.match(diff.diff, /^\+- The kit's newer line\.$/m, `${name}: the kit's change`);
    assert.doesNotMatch(diff.diff, /The site's own line/, `${name}: alone`);
  }
});
