import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { agentFiles, ALLOW_BUILDS, EXAMPLE, mergeWorkspace, readManifest, scaffold } from "./lib/init.mjs";
import { LightOnlyError } from "./lib/light-only.mjs";
import { readSiteProfile } from "./lib/storage-seed.mjs";

const KIT = path.resolve(import.meta.dirname, "..");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "init-"));
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
const quiet = { log: () => {} };

test("scaffold lays out a site from the package: the example, the agent files, the config, a manifest", () => {
  const target = path.join(tmp(), "my-site");
  const result = scaffold(target, { kitRoot: KIT, version: "0.4.0", force: false, ...quiet });
  for (const file of ["src/kit.ts", "src/app/layout.tsx", "src/components/README.md", "src/config/site.ts", "src/config/analytics.ts", "src/config/harness.ts", "src/components/ui/ConsentBanner.tsx", "src/styles/base.css", "content/pages/home.yaml", "content/VOICE.md", "public/images/brand/logo.svg", "STANDARD.md", "AGENTS.md", "CLAUDE.md", "README.md", "PLAN.md", "next.config.ts", "postcss.config.mjs", "eslint.config.mjs", "tsconfig.json", "package.json", "pnpm-workspace.yaml", ".gitignore", ".env.example", ".nvmrc", ".github/workflows/verify.yml", "scripts/setup.sh", ".claude/settings.json", ".claude/rules/styling.md", ".claude/rules/design.md", ".claude/skills/design/SKILL.md", ".agents/skills/design/SKILL.md", ".agentic-cms.json"]) {
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
