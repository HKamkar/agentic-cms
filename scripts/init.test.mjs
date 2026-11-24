import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { checkComponents, formatReport } from "./lib/check-components.mjs";
import { checkSite, formatSiteReport } from "./lib/check-site.mjs";
import { recordOf, recordText } from "../tools/agent-file-releases.mjs";
import { REQUIRED, requiredBlocks, requiredGone, requiredSources } from "./lib/agent-required.mjs";
import { BLOCK_END, BLOCK_START, codexStub, FORMAT, STUB_NOTE, thinRule } from "./lib/agent-file-format.mjs";
import { measureSettings } from "./lib/agent-files.mjs";
import { AGENT_DIRS, agentFiles, ALLOW_BUILDS, EXAMPLE, GatesError, LINT, mergeWorkspace, readManifest, RELEASES, renderAgentFiles, scaffold, SETTINGS, sha } from "./lib/init.mjs";
import { LightOnlyError } from "./lib/light-only.mjs";
import { KIT_ONLY, SHARED_CONTENT, siteCode, STARTER, StarterError } from "./lib/starter.mjs";
import { readSiteProfile } from "./lib/storage-seed.mjs";

const KIT = path.resolve(import.meta.dirname, "..");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "init-"));
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
const quiet = { log: () => {} };

test("scaffold lays out a site from the package: the example's code, the starter, the agent files, the config, a manifest", () => {
  const target = path.join(tmp(), "my-site");
  const result = scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.4.0", force: false, ...quiet });
  for (const file of ["src/kit.ts", "src/app/layout.tsx", "src/components/README.md", "src/config/site.ts", "src/config/analytics.ts", "src/config/harness.ts", "src/components/ui/ConsentBanner.tsx", "src/styles/base.css", "content/pages/home.yaml", "content/pages/blog.yaml", "content/VOICE.md", "public/images/brand/my-site-logo.svg", "STANDARD.md", "AGENTS.md", "CLAUDE.md", "README.md", "PLAN.md", "next.config.ts", "postcss.config.mjs", "eslint.config.mjs", "tsconfig.json", "package.json", "pnpm-workspace.yaml", ".gitignore", ".env.example", ".nvmrc", ".github/workflows/verify.yml", ".github/dependabot.yml", "scripts/setup.sh", ".claude/settings.json", ".claude/rules/styling.md", ".claude/rules/design.md", ".claude/rules/components.md", ".claude/rules/pages.md", "src/config/components.json", ".agents/skills/design/SKILL.md", ".agentic-cms.json"]) {
    assert.ok(fs.existsSync(path.join(target, file)), file);
  }
  assert.ok(!fs.existsSync(path.join(target, "src/lib")), "nothing of the package's source");
  assert.ok(!fs.existsSync(path.join(target, "wrangler.jsonc")) && !fs.existsSync(path.join(target, "open-next.config.ts")), "no Cloudflare files");
  assert.ok(result.created.includes("src/kit.ts") && result.kept.length === 0);

  const pkg = JSON.parse(read(target, "package.json"));
  assert.equal(pkg.name, "my-site");
  assert.equal(pkg.private, true);
  assert.equal(pkg.dependencies["agentic-cms"], "github:HKamkar/agentic-cms#v0.4.0");
  assert.equal(pkg.scripts.build, "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email", "the build runs the lint first, and the e-mail guard last: the starter's site.ts turns guardEmail on (D5)");
  assert.match(read(target, "src/config/site.ts"), /^ {2}email: "hello@my-site\.example",\n(?: {2}\/\/[^\n]*\n)+ {2}guardEmail: true,$/m, "a new site keeps its address out of every served file");
  assert.equal(pkg.scripts.kit, "agentic-cms");
  assert.equal(pkg.scripts.urls, "agentic-cms urls");
  assert.equal(pkg.scripts.lint, "eslint; s=$?; agentic-cms check-site || s=1; exit $s", "the lint runs ESLint, then the site check, failing on either");
  assert.equal(pkg.scripts.lint, LINT);
  const guard = checkComponents({ root: target, fs });
  assert.deepEqual(guard.findings, [], formatReport(guard).join("\n"));
  assert.doesNotMatch(read(target, "eslint.config.mjs"), /src\/lib/, "a site's src/lib is its own, and linted: the kit's ignore of its package source stays in the kit");
  const components = JSON.parse(read(target, "src/config/components.json"));
  assert.ok(!("ignores" in components) && !("$ignores" in components), "nor in the guard's config");
  assert.deepEqual(Object.keys(components.owners.forms), ["src/components/ui/form/Form.tsx"], "the form engine's renderer owns the one <form>");
  assert.ok(!("setup" in pkg.scripts), "no script named setup: pnpm setup is pnpm's own");
  assert.ok(pkg.devDependencies["playwright-core"] && pkg.devDependencies.tailwindcss && pkg.dependencies.next && pkg.dependencies.zod);
  assert.ok(!("@opennextjs/cloudflare" in pkg.devDependencies) && !("wrangler" in pkg.devDependencies));

  const tsconfig = JSON.parse(read(target, "tsconfig.json"));
  assert.deepEqual(tsconfig.compilerOptions.paths, { "@/*": ["./src/*"] });
  assert.match(read(target, "pnpm-workspace.yaml"), /"agentic-cms@git\+https:\/\/github\.com\/HKamkar\/agentic-cms\.git": true/);
  assert.deepEqual(parseYaml(read(target, "pnpm-workspace.yaml")).allowBuilds, Object.fromEntries(ALLOW_BUILDS.map((name) => [name, true])));
  assert.equal(mergeWorkspace(read(target, "pnpm-workspace.yaml")), null, "the kit's own workspace lacks nothing");
  assert.deepEqual(JSON.parse(read(target, ".claude/settings.json")).extraKnownMarketplaces["agentic-cms"], { source: { source: "directory", path: "./node_modules/agentic-cms" } }, "the kit's skills come from the installed package's marketplace");
  assert.ok(!fs.existsSync(path.join(target, ".claude/skills")), "no copy of the kit's skills: the design plugin has them");
  assert.ok(read(target, ".agents/skills/design/SKILL.md").includes("node_modules/agentic-cms/.agents/skills/design/SKILL.md"), "Codex's stub names the package's skill");
  assert.doesNotMatch(read(target, ".claude/rules/content-engine.md"), /(?<!agentic-cms\/)src\/lib\//, "a site's rule never names the kit's source");
  assert.match(read(target, ".claude/rules/content-engine.md"), /node_modules\/agentic-cms\/templates\/site\/rules\/content-engine\.md/, "a thin rule points at the kit's whole rule");
  assert.match(read(target, "next.config.ts"), /images: \{ unoptimized: true \}/);
  assert.doesNotMatch(read(target, "next.config.ts"), /opennextjs/);
  assert.match(read(target, "STANDARD.md"), /^> This is the wireframe's standard/m);
  const manifest = readManifest(target);
  assert.equal(manifest.version, "0.4.0");
  assert.equal(manifest.format, FORMAT);
  assert.ok(manifest.rules[".claude/rules/styling.md"].startsWith("sha256:"));
  assert.ok(manifest.stubs.includes(".agents/skills/design/SKILL.md"));
  assert.deepEqual(manifest.settings, ['extraKnownMarketplaces["agentic-cms"]', 'enabledPlugins["editorial@agentic-cms"]', 'enabledPlugins["design@agentic-cms"]']);
});

test("init --name: a new site needs its name, which goes where the example says its own; --url and --email its address, else stand-ins on a reserved domain", () => {
  const plain = path.join(tmp(), "folder-name-unused");
  assert.throws(() => scaffold(plain, { kitRoot: KIT, version: "0.8.2", ...quiet }), (e) => e instanceof StarterError && e.message === 'a new site needs its name, as it is spelled: --name "<Site>" (agentic-cms init my-site --name "My Site")');
  assert.ok(!fs.existsSync(plain), "nothing written: the folder's name is never taken for the site's");
  const result = scaffold(plain, { kitRoot: KIT, version: "0.8.2", name: "My Site", now: new Date("2026-10-17T09:00:00Z"), ...quiet });
  assert.deepEqual(result.site, { name: "My Site", url: "https://my-site.example", email: "hello@my-site.example", starter: true }, "the slug from the name, not the folder");
  const config = read(plain, "src/config/site.ts");
  assert.match(config, /^ {2}name: "My Site",\n {2}shortName: "My Site",\n {2}url: "https:\/\/my-site\.example",$/m);
  assert.match(config, /^ {2}email: "hello@my-site\.example",\n(?: {2}\/\/[^\n]*\n)+ {2}guardEmail: true,\n {2}logo: "\/images\/brand\/my-site-logo\.svg",$/m);
  assert.match(config, /^ {2}tagline: "\(placeholder\) What My Site does, in one sentence/m);
  const logo = read(plain, "public/images/brand/my-site-logo.svg");
  for (const where of [/aria-label="My Site"/, /<title>My Site<\/title>/, />My Site<\/text>/]) assert.match(logo, where, "the logo placeholder names the site");
  const voice = read(plain, "content/VOICE.md");
  assert.match(voice, /^How My Site writes, on every page/m);
  assert.doesNotMatch(voice, /<the brand>|Copy this file to content\/VOICE\.md/, "the blank filled in, its opening note replaced");
  const home = parseYaml(read(plain, "content/pages/home.yaml"));
  assert.equal(home.seo.updated, "2026-10-17", "dated the day init ran");
  assert.equal(home.sections[0].heading, "(placeholder) The promise of My Site, in one line.");
  assert.equal(home.sections.at(-1).cards[1].highlight.value, "hello@my-site.example");

  const odd = 'Café "Ünï" & Co.';
  const named = path.join(tmp(), "x");
  const given = scaffold(named, { kitRoot: KIT, version: "0.8.2", name: odd, url: "https://www.cafe-unico.com/", email: "hi@cafe-unico.com", ...quiet });
  assert.deepEqual(given.site, { name: odd, url: "https://www.cafe-unico.com", email: "hi@cafe-unico.com", starter: true }, "the origin without its trailing slash");
  const typed = read(named, "src/config/site.ts");
  assert.match(typed, /^ {2}name: "Café \\"Ünï\\" & Co\.",$/m, "escaped for the string it sits in");
  assert.match(typed, /^ {2}url: "https:\/\/www\.cafe-unico\.com",\n/m);
  assert.ok(fs.existsSync(path.join(named, "public/images/brand/cafe-uni-co-logo.svg")), "the logo's file is named by the name's slug");
  assert.match(read(named, "public/images/brand/cafe-uni-co-logo.svg"), /<title>Café &quot;Ünï&quot; &amp; Co\.<\/title>/);
  assert.equal(parseYaml(read(named, "content/pages/home.yaml")).sections.at(-1).cards[2].highlight.value, "www.cafe-unico.com/blog");
  const block = parseYaml(read(named, "content/VOICE.md").match(/```yaml\n([\s\S]*?)```/)[1]);
  assert.equal(block.brand.name, odd, "the voice block's brand, as YAML");
  assert.ok(new RegExp(block.claims.subject).test(`${odd} is certified`) && !new RegExp(block.claims.subject).test("Cafe Uni Co"), "and escaped inside its regular expressions");

  for (const [options, error] of [[{ name: "  " }, /--name is empty/], [{ name: "X", url: "https://x.com/blog" }, /--url https:\/\/x\.com\/blog: give the site's origin alone/], [{ name: "X", url: "x.com" }, /--url x\.com: not a URL/], [{ name: "X", email: "hello" }, /--email hello: not an e-mail address/], [{ url: "https://x.com" }, /a new site needs its name/]]) {
    const never = path.join(tmp(), "never");
    assert.throws(() => scaffold(never, { kitRoot: KIT, version: "0.8.2", ...options, ...quiet }), (e) => e instanceof StarterError && error.test(e.message));
    assert.ok(!fs.existsSync(never), "nothing written");
  }
});

test("a fresh site holds none of the example's brand, content or pictures: no Acme, no acme.example, no post, review, use case, FAQ, author or catalogue page; its collections empty", () => {
  const target = path.join(tmp(), "fresh");
  scaffold(target, { kitRoot: KIT, version: "0.8.2", name: "Fresh", ...quiet });
  const written = filesUnder(target).map((file) => file.split(path.sep).join("/"));
  for (const file of written.filter((f) => !/\.(?:jpe?g|png|webp|ico)$/.test(f))) assert.doesNotMatch(read(target, file), /acme/i, `${file}: the example's brand`);
  const starter = new Set(walkFiles(path.join(KIT, STARTER)));
  const shared = new Set(SHARED_CONTENT.flatMap((entry) => (fs.statSync(path.join(KIT, entry)).isFile() ? [entry] : walkFiles(path.join(KIT, entry)).map((rel) => `${entry}/${rel}`))));
  for (const file of ["content", "public"].flatMap((dir) => walkFiles(path.join(KIT, dir)).map((rel) => `${dir}/${rel}`))) {
    if (shared.has(file)) continue;
    if (!starter.has(file) && file !== "content/VOICE.md") assert.ok(!fs.existsSync(path.join(target, file)), `${file}: the example's own, not a new site's`);
    else if (/\.(?:ya?ml|json|md)$/.test(file)) assert.notEqual(read(target, file), read(KIT, file), `${file}: the starter's, not the example's`);
  }
  const pictures = written.filter((f) => f.startsWith("public/"));
  assert.deepEqual(pictures.filter((f) => !starter.has(f)), ["public/images/brand/fresh-logo.svg"], "every picture the starter's neutral placeholders, and the logo written for the name");
  assert.deepEqual(parseYaml(read(target, "content/reviews.yaml")), []);
  assert.deepEqual(parseYaml(read(target, "content/use-cases.yaml")), []);
  assert.deepEqual(JSON.parse(read(target, "content/authors.json")), {});
  assert.deepEqual(JSON.parse(read(target, "content/categories.json")), {});
  assert.deepEqual(fs.readdirSync(path.join(target, "content/blog")), ["_template.md"], "no post");
  assert.deepEqual(fs.readdirSync(path.join(target, "content/faqs")), ["_README.md"], "no FAQ set, the folder kept");
  assert.deepEqual(fs.readdirSync(path.join(target, "content/pages")).sort(), ["blog.yaml", "home.yaml"], "the home page and the blog index, no catalogue page");
  assert.doesNotMatch(read(target, "src/config/site.ts"), /\/sections\//, "no link to a catalogue page");
  const standard = read(target, "STANDARD.md");
  assert.match(standard, /^\| `\/` \| `pages\/home\.yaml` \| `home-hero`, `home-service`, `home-feature`, `home-about`, `contact-form`, `contact-details` \|$/m, "the standard's page table is the starter's");
  assert.doesNotMatch(standard, /`\/sections\/home`|landing page uses nine|example:start|<!-- starter:/, "none of the example's pages, no marker");
});

test("scaffold never overwrites without --force, and merges an existing package.json", () => {
  const target = tmp();
  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "kept-name", scripts: { dev: "next dev -p 4000", test: "node --test" }, dependencies: { "agentic-cms": "github:HKamkar/agentic-cms#v0.3.3" } }, null, 2));
  fs.mkdirSync(path.join(target, "src/config"), { recursive: true });
  fs.writeFileSync(path.join(target, "src/config/site.ts"), "export const site = {} as const;\n");
  const result = scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.4.0", force: false, ...quiet });
  assert.ok(result.kept.includes("src/config/site.ts"));
  assert.equal(read(target, "src/config/site.ts"), "export const site = {} as const;\n");
  const pkg = JSON.parse(read(target, "package.json"));
  assert.equal(pkg.name, "kept-name");
  assert.equal(pkg.scripts.dev, "next dev -p 4000", "an existing script is kept");
  assert.equal(pkg.scripts.test, "node --test", "a real test script of the site's is kept");
  assert.equal(pkg.scripts.build, "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo", "a missing script is added");
  assert.equal(pkg.dependencies["agentic-cms"], "github:HKamkar/agentic-cms#v0.3.3", "an existing dependency is kept");
  fs.writeFileSync(path.join(target, "src/components/ui/Button.tsx"), "// the site's edit\n");
  fs.writeFileSync(path.join(target, "content/pages/home.yaml"), "# the site's own\n");
  const forced = scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.4.0", force: true, ...quiet });
  assert.ok(forced.updated.includes("src/components/ui/Button.tsx"), "--force rewrites the kit's files");
  assert.notEqual(read(target, "src/components/ui/Button.tsx"), "// the site's edit\n");
  assert.ok(![...forced.created, ...forced.updated, ...forced.kept].includes("src/config/site.ts"), "and never a site's own config: a site that has content/ gets none of its own files");
  assert.equal(read(target, "src/config/site.ts"), "export const site = {} as const;\n");
  assert.equal(read(target, "content/pages/home.yaml"), "# the site's own\n", "nor its content");
  assert.deepEqual(forced.site, { starter: false }, "content/ was there: no starter, and no name asked");
});

// What docs/init.md had a site write before init (0.7.6 and earlier): `pnpm init`'s package.json and the workspace snippet without unrs-resolver.
const PNPM_INIT = { name: "my-site", version: "1.0.0", description: "", main: "index.js", scripts: { test: 'echo "Error: no test specified" && exit 1' }, keywords: [], author: "", license: "ISC", devEngines: { packageManager: { name: "pnpm", version: "12.11.2", onFail: "download" } }, packageManager: "pnpm@12.11.2", type: "module" };
const OLD_SNIPPET = `# our settings, kept\nallowBuilds:\n  "agentic-cms@git+https://github.com/HKamkar/agentic-cms.git": true\n  sharp: true # the image optimiser\nnodeLinker: hoisted\n`;

test("an existing workspace is merged, not kept: the kit's missing keys added, the site's keys, values and comments left, unchanged on a second run", () => {
  const target = tmp();
  fs.writeFileSync(path.join(target, "pnpm-workspace.yaml"), OLD_SNIPPET);
  const logged = [];
  const first = scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, log: (line) => logged.push(line) });
  assert.ok(first.updated.includes("pnpm-workspace.yaml"));
  assert.ok(logged.includes("merged   pnpm-workspace.yaml (allowBuilds: unrs-resolver)"), logged.join("\n"));
  const merged = read(target, "pnpm-workspace.yaml");
  assert.equal(merged, `${OLD_SNIPPET.replace("nodeLinker", "  unrs-resolver: true\nnodeLinker")}`, "one line added, the rest byte for byte");
  assert.deepEqual(Object.keys(parseYaml(merged).allowBuilds), ALLOW_BUILDS);
  const second = scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, ...quiet });
  assert.ok(second.kept.includes("pnpm-workspace.yaml"));
  assert.equal(read(target, "pnpm-workspace.yaml"), merged);
  // --force merges too: the site's settings and its own value for a kit key are never replaced
  fs.writeFileSync(path.join(target, "pnpm-workspace.yaml"), "allowBuilds:\n  sharp: false\n");
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: true, ...quiet });
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
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, log: (line) => logged.push(line) });
  const pkg = JSON.parse(read(target, "package.json"));
  assert.equal(pkg.scripts.test, 'node --import agentic-cms/loader --test "src/**/*.test.ts"');
  assert.ok(!("main" in pkg));
  assert.equal(pkg.license, "ISC");
  assert.equal(pkg.version, "1.0.0");
  assert.deepEqual(pkg.devEngines, PNPM_INIT.devEngines);
  assert.equal(pkg.packageManager, "pnpm@12.11.2");
  assert.equal(pkg.scripts.build, "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email");
  assert.ok(logged.includes('merged   package.json (the kit\'s test script in place of pnpm init\'s placeholder; pnpm init\'s main: "index.js" dropped)'), logged.join("\n"));
  // a main that names a file the site has is the site's
  const own = tmp();
  fs.writeFileSync(path.join(own, "package.json"), JSON.stringify({ ...PNPM_INIT, scripts: {} }));
  fs.writeFileSync(path.join(own, "index.js"), "export {};\n");
  scaffold(own, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, ...quiet });
  assert.equal(JSON.parse(read(own, "package.json")).main, "index.js");
});

test("the site's own lint and build take the gates in, its own steps kept where they are: the old kit's, create-next-app's, a site's chain", () => {
  const merged = (scripts, { siteTs } = {}) => {
    const target = tmp();
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "ours", scripts }));
    if (siteTs !== undefined) { fs.mkdirSync(path.join(target, "src/config"), { recursive: true }); fs.writeFileSync(path.join(target, "src/config/site.ts"), siteTs); }
    const logged = [];
    scaffold(target, { name: "Ours", kitRoot: KIT, version: "0.8.2", force: false, log: (line) => logged.push(line) });
    return { scripts: JSON.parse(read(target, "package.json")).scripts, logged };
  };
  const older = merged({ lint: "eslint; s=$?; agentic-cms check-components || s=1; exit $s", build: "agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo" });
  assert.equal(older.scripts.lint, LINT, "the old kit's lint: check-site in place of check-components");
  assert.equal(older.scripts.build, "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email", "the lint first, and the e-mail guard the starter's site.ts asks for");
  assert.ok(older.logged.includes("merged   package.json (lint: check-site in place of check-components; build: pnpm lint, agentic-cms guard-email added)"), older.logged.join("\n"));
  const nextApp = merged({ lint: "eslint --max-warnings 50", build: "next build --turbopack" }, { siteTs: "export const site = { name: \"Ours\" };\n" });
  assert.equal(nextApp.scripts.lint, "eslint --max-warnings 50; s=$?; agentic-cms check-site || s=1; exit $s", "the site's ESLint command kept, the check after it");
  assert.equal(nextApp.scripts.build, "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build --turbopack && agentic-cms seo", "the gates around the site's next build; its own site.ts, without guardEmail, asks for no guard");
  const guarded = merged({ build: "next build" }, { siteTs: "export const site = {\n  email: \"hello@ours.dev\",\n  guardEmail: true,\n};\n" });
  assert.equal(guarded.scripts.build, "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email", "its own site.ts turning guardEmail on: the guard after the audit");
  const chain = merged({ build: "pnpm lint && agentic-cms lint --production && node scripts/og.mjs && next build && agentic-cms assemble" });
  assert.equal(chain.scripts.build, "pnpm lint && agentic-cms lint --production && node scripts/og.mjs && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email && agentic-cms assemble", "the site's own steps where they were, each gate in its place");
  const held = merged({ lint: LINT, build: "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email && agentic-cms critical-css" });
  assert.ok(!held.logged.some((line) => /lint:|build:/.test(line)), "a site that holds the gates is left as it is");
});

test("a lint or a build the gates cannot go into is refused, naming what to add, before anything is written", () => {
  for (const [scripts, why] of [
    [{ lint: "biome lint ." }, /package\.json's lint \("biome lint \."\) runs no ESLint: make it ESLint, then the site check — "lint": "eslint; s=\$\?; agentic-cms check-site \|\| s=1; exit \$s"/],
    [{ lint: "eslint || true" }, /lint \("eslint \|\| true"\) turns a failure into a pass/],
    [{ lint: "eslint; exit 0" }, /lint \("eslint; exit 0"\) turns a failure into a pass/],
    [{ build: "vite build" }, /package\.json's build \("vite build"\) runs no next build as a step of its && chain: make it the gates joined by && — "build": "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email"/],
    [{ build: "next build; agentic-cms seo" }, /runs no next build as a step of its && chain/],
    [{ build: "next build && agentic-cms seo || true" }, /turns a failure into a pass/],
    [{ build: "agentic-cms seo && next build" }, /runs agentic-cms seo on the wrong side of next build/],
  ]) {
    const target = path.join(tmp(), "site");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "ours", scripts }));
    assert.throws(() => scaffold(target, { name: "Ours", kitRoot: KIT, version: "0.8.2", force: false, ...quiet }), (error) => error instanceof GatesError && why.test(error.message), JSON.stringify(scripts));
    assert.deepEqual(fs.readdirSync(target), ["package.json"], "nothing written");
  }
});

test("a fresh site passes the site check: its gates in package.json and CI, no round, no tool of its own", async () => {
  const target = path.join(tmp(), "fresh");
  scaffold(target, { name: "Fresh", kitRoot: KIT, version: "0.8.2", ...quiet });
  const report = await checkSite({ root: target, fs, git: () => ({ status: 128, stdout: "" }), components: async ({ root, config }) => checkComponents({ root, fs, config }) });
  assert.deepEqual([...report.findings, ...report.warnings], [], formatSiteReport(report).join("\n"));
  assert.equal(report.history, "not a git checkout, so the exceptions added since the merge base are not compared");
});

test("the Dependabot config is written once, for the actions alone, then kept as the site has it", () => {
  const target = tmp();
  const file = ".github/dependabot.yml";
  assert.ok(scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).created.includes(file));
  assert.equal(read(target, file), read(KIT, "templates/site/dependabot.yml"));
  assert.deepEqual(parseYaml(read(target, file)).updates.map((u) => [u["package-ecosystem"], u.schedule.interval, "target-branch" in u]), [["github-actions", "monthly", false]]);
  fs.writeFileSync(path.join(target, file), "version: 2\nupdates: []\n");
  assert.ok(scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).kept.includes(file));
  assert.equal(read(target, file), "version: 2\nupdates: []\n");
});

test("the setup script is written once, then kept as the site has it, and hands over to agentic-cms setup", () => {
  const target = tmp();
  assert.ok(scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).created.includes("scripts/setup.sh"));
  assert.equal(read(target, "scripts/setup.sh"), read(KIT, "templates/site/setup.sh"));
  assert.match(read(target, "scripts/setup.sh"), /\nexec pnpm exec agentic-cms setup "\$@"\n$/);
  fs.writeFileSync(path.join(target, "scripts/setup.sh"), "#!/usr/bin/env bash\n# ours\n");
  assert.ok(scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).kept.includes("scripts/setup.sh"));
  assert.equal(read(target, "scripts/setup.sh"), "#!/usr/bin/env bash\n# ours\n");
});

/** Every file under a directory, relative to it. */
/** Every file under a folder, its path relative to it with forward slashes. */
const walkFiles = (dir) => filesUnder(dir).map((file) => file.split(path.sep).join("/"));
const filesUnder = (root, dir = root) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(root, path.join(dir, e.name)) : [path.relative(root, path.join(dir, e.name))]));

test("--light-only lays out a site without dark mode: one scheme in the profile, single colours under color-scheme light, no theme script, no toggle, no dark lines in the docs", async () => {
  const target = path.join(tmp(), "light");
  const result = scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", lightOnly: true, ...quiet });
  assert.equal(result.lightOnly, true);
  assert.ok(!fs.existsSync(path.join(target, "src/components/ui/ThemeToggle.tsx")), "no toggle component");
  const layout = read(target, "src/app/layout.tsx");
  const document = read(target, "src/components/ui/SiteLayout.tsx");
  assert.doesNotMatch(document, /THEME_SCRIPT|suppressHydrationWarning|data-theme/, "no theme script, nothing to suppress");
  assert.match(layout, /export const viewport: Viewport = \{ colorScheme: "light" \};/);
  assert.match(document, /<html lang=\{site\.locale\}>/);
  const base = read(target, "src/styles/base.css");
  assert.match(base, /^:root \{ color-scheme: light; \}$/m);
  assert.doesNotMatch(base, /data-theme|light dark|light-dark/);
  const globals = read(target, "src/app/globals.css");
  assert.doesNotMatch(globals, /light-dark/);
  assert.match(globals, /--color-paper: #ffffff;\n {2}--color-ink: #000000;/, "each colour its light value");
  assert.deepEqual((await readSiteProfile(target)).schemes, ["light"], "the profile names one scheme");
  for (const file of filesUnder(path.join(target, "src")).filter((f) => /\.(tsx?|css|md)$/.test(f))) assert.doesNotMatch(read(target, `src/${file}`), /ThemeToggle|THEME_SCRIPT|data-theme|light-dark\(/, `src/${file}: nothing of the theme`);
  const standard = read(target, "STANDARD.md");
  assert.doesNotMatch(standard, /dark-mode:|light-only:|example:|starter:|\| Dark \||ThemeToggle|data-theme|light-dark\(/, "STANDARD without its dark lines or the markers");
  assert.match(standard, /^### The scheme$/m);
  assert.match(standard, /^\| Value \| Colour \| What it is \|$/m);
  assert.match(standard, /^> This is the wireframe's standard/m, "still the scaffold's note");
  assert.doesNotMatch(read(target, "src/components/README.md"), /dark-mode:|ThemeToggle|theme switch/);
  assert.match(read(target, "src/components/ui/Navbar.tsx"), /<Button href=\{cta\.href\}/, "the navbar keeps everything else");
  assert.match(document, /^ {8}<Navbar brand=\{site\.shortName\} [^\n]*copy=\{chrome\.navbar\} \/>$/m, "the layout's navbar closes itself, the toggle it held gone");
  const config = read(target, "src/config/site.ts");
  assert.doesNotMatch(config, /themeToggle|ThemeToggle/, "no labels for a toggle the site does not have");
  assert.match(config, /^ {2}navbar: \{ label: "Main", menu: "Menu" \},\n {2}\/\*\* ui\/Footer's/m, "the chrome's other words stay, and so does the comment above the next");
  assert.deepEqual(checkComponents({ root: target, fs }).findings, [], "the guard passes without the toggle and its entry");

  const both = path.join(tmp(), "both");
  scaffold(both, { name: "My Site", kitRoot: KIT, version: "0.8.0", ...quiet });
  assert.ok(fs.existsSync(path.join(both, "src/components/ui/ThemeToggle.tsx")), "without the flag the example keeps its theme");
  assert.match(read(both, "src/components/ui/SiteLayout.tsx"), /THEME_SCRIPT/);
  assert.deepEqual((await readSiteProfile(both)).schemes, ["light", "dark"]);
});

test("the kit's own lines in the example's code stay in the kit: siteCode leaves them out, and a kit that moved them fails before anything is written", () => {
  for (const [file, lines] of Object.entries(KIT_ONLY)) {
    const text = read(KIT, file);
    assert.ok(text.includes(lines), `${file} carries the kit's own lines where init expects them`);
    assert.equal(siteCode(file, text), text.replace(lines, ""));
    assert.throws(() => siteCode(file, text.replace(lines, "")), (error) => error instanceof StarterError && error.message.startsWith(`${file}: the kit's ignore of src/lib is not where init expects it`));
  }
  assert.doesNotThrow(() => JSON.parse(siteCode("src/config/components.json", read(KIT, "src/config/components.json"))), "the guard's config still reads");
  assert.equal(siteCode("src/app/layout.tsx", "x"), "x", "every other file as it is");
});

test("a light-only edit that misses its place in the example fails before anything is written", () => {
  const kit = tmp();
  for (const entry of [STARTER, ...SHARED_CONTENT]) fs.cpSync(path.join(KIT, entry), path.join(kit, entry), { recursive: true });
  for (const entry of EXAMPLE) {
    const full = path.join(kit, entry);
    if (/\.[a-z]+$|^\.[a-z]+$/.test(path.basename(entry))) { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, ""); } else fs.mkdirSync(full, { recursive: true });
  }
  fs.writeFileSync(path.join(kit, "src/app/layout.tsx"), "export const viewport = { colorScheme: \"light dark\" };\n");
  fs.mkdirSync(path.join(kit, "src/components/ui"), { recursive: true });
  fs.writeFileSync(path.join(kit, "src/components/ui/SiteLayout.tsx"), "export function SiteLayout() { return null; }\n");
  for (const [file, lines] of Object.entries(KIT_ONLY)) fs.writeFileSync(path.join(kit, file), lines);
  fs.writeFileSync(path.join(kit, "STANDARD.md"), "# Standard\n\nFour values<!-- dark-mode:start -->, each a pair<!-- dark-mode:end -->.<!-- example:start --> Nine pages.<!-- example:end -->\n");
  const target = path.join(tmp(), "never");
  assert.throws(() => scaffold(target, { name: "My Site", kitRoot: kit, version: "0.8.0", lightOnly: true, ...quiet }), (error) => error instanceof LightOnlyError && /src\/components\/ui\/SiteLayout\.tsx: the theme script and the comment above it not found/.test(error.message));
  assert.ok(!fs.existsSync(target), "nothing written");
});

test("the site's CI workflow is written once, then kept as the site has it", () => {
  const target = tmp();
  const workflow = ".github/workflows/verify.yml";
  assert.ok(scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).created.includes(workflow));
  const steps = parseYaml(read(target, workflow)).jobs.test.steps;
  assert.deepEqual(steps.filter((s) => s.run).map((s) => s.run), ["pnpm install --frozen-lockfile", "pnpm lint", "pnpm test", "pnpm build", "pnpm exec agentic-cms init . --agent-files --check"]);
  assert.equal(steps[0].with["fetch-depth"], 0, "the history, which check-site compares the exceptions against");
  for (const { uses } of steps.filter((s) => s.uses)) assert.match(uses, /@[0-9a-f]{40}$/, `${uses}: pinned to a commit`);
  assert.equal(steps.find((s) => s.uses?.startsWith("actions/setup-node@")).with["node-version-file"], ".nvmrc");
  fs.writeFileSync(path.join(target, workflow), "name: ours\n");
  assert.ok(scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, ...quiet }).kept.includes(workflow));
  assert.equal(read(target, workflow), "name: ours\n");
});

test("a block the kit marks required is its list item or its paragraph, read with the markers out and the whitespace collapsed; a site's copy keeps its words re-wrapped, re-indented, unmarked, in another case or among its own", () => {
  const kit = [
    "# A rule",
    "",
    "- A line the site may edit.",
    `- The engines hold, everywhere. ${REQUIRED}`,
    "  - **copy:** every word from content,",
    `    through props; ${REQUIRED}`,
    "",
    "A paragraph that wraps",
    `across two lines. ${REQUIRED}`,
    "```bash",
    "pnpm lint",
    "```",
  ].join("\n");
  assert.deepEqual(requiredBlocks(kit), [
    { line: 4, text: "- The engines hold, everywhere." },
    { line: 5, text: "- **copy:** every word from content, through props;" },
    { line: 8, text: "A paragraph that wraps across two lines." },
  ]);
  const rewrapped = "# A rule, the site's\n\n- The engines hold,\n  everywhere.\n- **copy:** every word from content, through props;\n\nA paragraph that wraps across two lines.\n\n- The site's own line.\n";
  assert.deepEqual(requiredGone(rewrapped, kit), [], "re-wrapped, re-indented, unmarked: kept");
  assert.deepEqual(requiredGone(rewrapped.replace("everywhere", "in sections"), kit), [{ line: 4, text: "- The engines hold, everywhere." }], "a word changed is the block gone");
  assert.deepEqual(requiredGone(kit.replace(/\n {2}- \*\*copy[^]*?props; .*\n/, "\n"), kit).map((b) => b.line), [5]);
  const ownWords = "# A rule, the site's\n\n- On this site, the engines hold, everywhere. Our checkout adds its own.\n* **copy:** every word from content, through props; the chrome's from site.ts.\n\n1. A paragraph that wraps across two lines.\n";
  assert.deepEqual(requiredGone(ownWords, kit), [], "the site's words before and after the kit's, a list marker of its own: kept");
  assert.deepEqual(requiredGone("- The engines hold. Everywhere.\n", kit).map((b) => b.line), [4, 5, 8], "the kit's words broken up are the block gone");
});

test("every rule the kit gives a site ends with its tier line, marked required, and every skill ends its procedure with pnpm lint, marked required", () => {
  const files = renderAgentFiles(KIT).filter(({ file }) => file.endsWith(".md") && !file.includes("/references/"));
  for (const { file, text } of files.filter(({ file }) => file.startsWith(".claude/rules/"))) {
    assert.match(text.trimEnd().split("\n").at(-1), new RegExp(`^- \\*\\*Tier:\\*\\* .*(?:required|preferred).* ${REQUIRED}$`), `${file}: its part, its tier and its check, last`);
  }
  for (const { file, text } of files.filter(({ file }) => file.endsWith("/SKILL.md"))) {
    const verify = text.slice(text.indexOf("\n## Verify\n"));
    assert.ok(text.includes("\n## Verify\n"), `${file}: a Verify section`);
    assert.ok(requiredBlocks(verify).some((b) => b.text.startsWith("End the procedure with `pnpm lint`")), `${file}: its procedure ends with pnpm lint, marked required`);
  }
  for (const name of ["design", "design-options"]) {
    assert.ok(requiredBlocks(read(KIT, `.claude/skills/${name}/SKILL.md`)).some((b) => /never writes copy into a candidate/.test(b.text)), `${name}: a round starts from the page's file`);
  }
});

test("--check tells the kit's text, the site's own lines after the kit's block, a block or a stub behind the kit's and a missing file; the refresh rewrites the kit's lines and keeps the site's", () => {
  const target = tmp();
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.9.0", force: false, ...quiet });
  assert.deepEqual(agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet }).filter((f) => f.status !== "ok"), []);
  const at = (file) => path.join(target, file);
  fs.appendFileSync(at(".claude/rules/styling.md"), "\n- The site's own line.\n");
  const design = read(target, ".claude/rules/design.md");
  fs.writeFileSync(at(".claude/rules/design.md"), design.replace(` ${REQUIRED}`, ` (the site's word) ${REQUIRED}`));
  fs.rmSync(at(".claude/rules/pages.md"));
  fs.appendFileSync(at(".agents/skills/design/SKILL.md"), "\nlocal note\n");
  const check = statusOf(agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet }));
  assert.equal(check[".claude/rules/styling.md"], "modified", "the site's own lines after the block pass");
  assert.equal(check[".claude/rules/design.md"], "stale", "a line of the kit's block changed is the kit's to put back");
  assert.equal(check[".claude/rules/pages.md"], "missing");
  assert.equal(check[".agents/skills/design/SKILL.md"], "stale", "a stub is never the site's");
  const written = statusOf(agentFiles(target, { kitRoot: KIT, version: "0.9.0", ...quiet }));
  assert.deepEqual([written[".claude/rules/styling.md"], written[".claude/rules/design.md"], written[".claude/rules/pages.md"], written[".agents/skills/design/SKILL.md"]], ["kept", "updated", "created", "updated"]);
  assert.ok(read(target, ".claude/rules/styling.md").endsWith(`${BLOCK_END}\n\n- The site's own line.\n`), "the site's lines stay where it put them");
  assert.equal(read(target, ".claude/rules/design.md"), design);
  assert.deepEqual(agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet }).filter((f) => !["ok", "modified"].includes(f.status)), []);
});

test("a thin rule is the kit's paths, then its block: the title, each block the kit marks required as the kit has it, and the pointer to the whole rule, itself required", () => {
  for (const name of fs.readdirSync(path.join(KIT, "templates/site/rules"))) {
    const whole = read(KIT, `templates/site/rules/${name}`);
    const thin = thinRule(whole, `.claude/rules/${name}`);
    assert.ok(thin.startsWith(whole.match(/^---\n[\s\S]*?\n---\n/)[0] + "\n" + BLOCK_START + "\n" + whole.match(/^# .+$/m)[0] + "\n"), `${name}: the paths, the block, the title`);
    for (const block of requiredSources(whole)) assert.ok(thin.includes(block), `${name}: ${block.slice(0, 40)}…`);
    assert.deepEqual(requiredGone(thin, whole), [], `${name}: nothing the kit requires left out`);
    assert.ok(requiredBlocks(thin).at(-1).text.startsWith(`Before an edit these paths match, read the kit's whole rule, \`node_modules/agentic-cms/templates/site/rules/${name}\``), `${name}: the pointer, last and required`);
    assert.ok(thin.endsWith(`${BLOCK_END}\n`));
  }
});

test("a rule whose block marks the site took away is its own: modified while every required block is in it, modified, required gone once one is not; the refresh keeps it, --force takes the kit's", () => {
  const target = tmp();
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.9.0", force: false, ...quiet });
  const RULE = ".claude/rules/pages.md";
  const thin = read(target, RULE);
  const entry = (report) => report.find((f) => f.file === RULE);
  const unmarked = thin.replace(`${BLOCK_START}\n`, "").replace(`${BLOCK_END}\n`, "- The site's own line.\n");
  fs.writeFileSync(path.join(target, RULE), unmarked);
  assert.equal(entry(agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet })).status, "modified");
  const [gone] = requiredBlocks(thin);
  const lines = unmarked.split("\n");
  fs.writeFileSync(path.join(target, RULE), lines.filter((line) => !line.startsWith(requiredSources(thin)[0].split("\n")[0])).join("\n"));
  const edited = read(target, RULE);
  assert.deepEqual(entry(agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet })).required, [gone]);
  assert.equal(entry(agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet })).status, "modified, required gone");
  assert.equal(entry(agentFiles(target, { kitRoot: KIT, version: "0.9.0", ...quiet })).status, "kept, required gone");
  assert.equal(read(target, RULE), edited, "a site's own file is never clobbered");
  assert.equal(entry(agentFiles(target, { kitRoot: KIT, version: "0.9.0", force: true, ...quiet })).status, "updated");
  assert.equal(read(target, RULE), thin);
});

/** A kit with this one's agent-file sources, `edit` given each { <path>: (text) => text } to change. */
function kitWith(edit = {}) {
  const kit = tmp();
  for (const dir of ["templates/site/rules", ".claude/skills", ".agents/skills"]) fs.cpSync(path.join(KIT, dir), path.join(kit, dir), { recursive: true });
  fs.copyFileSync(path.join(KIT, "templates/site/settings.json"), path.join(kit, "templates/site/settings.json"));
  for (const [file, change] of Object.entries(edit)) fs.writeFileSync(path.join(kit, file), change(read(kit, file)));
  return kit;
}

test("a rule's paths follow the kit while the site leaves them alone, and stay the site's once it changes them", () => {
  const target = tmp();
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.9.0", force: false, ...quiet });
  const RULE = ".claude/rules/seo.md";
  const widen = (from, to) => (text) => text.replace(from, to);
  const later = kitWith({ "templates/site/rules/seo.md": widen('  - "content/pages/**"', '  - "content/pages/**"\n  - "content/landing/**"') });
  assert.equal(statusOf(agentFiles(target, { kitRoot: later, version: "0.9.1", check: true, ...quiet }))[RULE], "stale");
  agentFiles(target, { kitRoot: later, version: "0.9.1", ...quiet });
  assert.match(read(target, RULE), /- "content\/landing\/\*\*"/, "the kit's new scope, in");
  fs.writeFileSync(path.join(target, RULE), read(target, RULE).replace('  - "content/landing/**"', '  - "content/campaigns/**"'));
  const own = read(target, RULE);
  const next = kitWith({ "templates/site/rules/seo.md": widen('  - "content/pages/**"', '  - "content/pages/**"\n  - "content/offers/**"') });
  const entry = agentFiles(target, { kitRoot: next, version: "0.9.2", check: true, ...quiet }).find((f) => f.file === RULE);
  assert.deepEqual(entry, { file: RULE, status: "modified", note: "its own paths, kept" });
  agentFiles(target, { kitRoot: next, version: "0.9.2", ...quiet });
  assert.equal(read(target, RULE), own, "the site's scope is the site's");
});

test("a Codex stub stands for each of the kit's skills: the skill's name and description and the package's file; a skill the kit drops loses its stub", () => {
  for (const name of fs.readdirSync(path.join(KIT, ".agents/skills"))) {
    const file = `.agents/skills/${name}/SKILL.md`;
    const stub = codexStub(read(KIT, file), file);
    const front = (text) => text.match(/^---\n([\s\S]*?)\n---\n/)[1].split("\n").filter((line) => /^(?:name|description):/.test(line));
    assert.deepEqual(front(stub), front(read(KIT, file)), `${name}: its name and description`);
    assert.ok(stub.includes(`read \`node_modules/agentic-cms/${file}\``) && stub.trimEnd().endsWith(STUB_NOTE), `${name}: the package's file, and the note`);
  }
  const target = tmp();
  const kit = kitWith();
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.9.0", force: false, ...quiet });
  fs.rmSync(path.join(kit, ".agents/skills/setup"), { recursive: true });
  const report = agentFiles(target, { kitRoot: kit, version: "0.9.1", ...quiet });
  assert.equal(statusOf(report)[".agents/skills/setup/SKILL.md"], "removed");
  assert.ok(!fs.existsSync(path.join(target, ".agents/skills/setup")));
  assert.ok(!readManifest(target).stubs.includes(".agents/skills/setup/SKILL.md"));
});

test(".claude/settings.json holds the kit's keys as its template has them — the package's marketplace, the editorial and design plugins — and the site's own beside them; a refresh sets the kit's, and drops one the kit wrote and holds no more", () => {
  const template = read(KIT, "templates/site/settings.json");
  const kit = JSON.parse(template);
  assert.deepEqual(kit.extraKnownMarketplaces["agentic-cms"], { source: { source: "directory", path: "./node_modules/agentic-cms" } });
  assert.deepEqual(measureSettings(null, template), { status: "missing", text: template });
  assert.deepEqual(measureSettings("{ not json", template), { status: "unreadable" });
  const own = { ...kit, permissions: { allow: ["Bash(pnpm lint)"] }, hooks: {}, enabledPlugins: { ...kit.enabledPlugins, "other@elsewhere": true } };
  assert.deepEqual(measureSettings(JSON.stringify(own), template), { status: "ok" }, "the site's own keys beside the kit's");
  const old = { extraKnownMarketplaces: { "agentic-cms": { source: { source: "github", repo: "HKamkar/agentic-cms" } } }, enabledPlugins: { "editorial@agentic-cms": true, "other@elsewhere": true }, permissions: { allow: ["Bash(ls)"] } };
  const moved = measureSettings(JSON.stringify(old), template);
  assert.deepEqual(moved.keys, ['extraKnownMarketplaces["agentic-cms"]', 'enabledPlugins["design@agentic-cms"]']);
  assert.deepEqual(JSON.parse(moved.text), { ...old, extraKnownMarketplaces: kit.extraKnownMarketplaces, enabledPlugins: { ...old.enabledPlugins, "design@agentic-cms": true } });
  assert.deepEqual(measureSettings(JSON.stringify({ ...kit, enabledPlugins: { ...kit.enabledPlugins, "editorial@agentic-cms": false } }), template).keys, ['enabledPlugins["editorial@agentic-cms"]']);
  const dropped = measureSettings(JSON.stringify({ ...kit, enabledPlugins: { ...kit.enabledPlugins, "old@agentic-cms": true } }), template, ['enabledPlugins["old@agentic-cms"]']);
  assert.deepEqual(dropped.keys, ['enabledPlugins["old@agentic-cms"] (no longer the kit\'s)']);
  assert.ok(!("old@agentic-cms" in JSON.parse(dropped.text).enabledPlugins));
  const target = tmp();
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.9.0", force: false, ...quiet });
  fs.writeFileSync(path.join(target, SETTINGS), JSON.stringify(old, null, 2));
  assert.equal(statusOf(agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet }))[SETTINGS], "stale");
  assert.equal(statusOf(agentFiles(target, { kitRoot: KIT, version: "0.9.0", ...quiet }))[SETTINGS], "updated");
  assert.equal(statusOf(agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet }))[SETTINGS], "ok");
  assert.deepEqual(JSON.parse(read(target, SETTINGS)).permissions, old.permissions, "the site's own keys stay");
});

test("--agent-files keeps AGENTS.md's scoped-rules table as the site's rules read; --check flags it stale or missing, and an AGENTS.md past what Codex reads", () => {
  const target = tmp();
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.5.5", force: false, ...quiet });
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
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.8.0", force: false, ...quiet });
  const status = (report) => Object.fromEntries(report.map((f) => [f.file, f.status]));
  const rule = path.join(target, ".claude/rules/components.md");
  // a site as 0.7.6 left it: no guard config, no components rule, nothing of either in the manifest or the table
  fs.rmSync(path.join(target, "src/config/components.json"));
  fs.rmSync(rule);
  const refreshed = status(agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: false, ...quiet }));
  assert.ok(!(".claude/rules/components.md" in refreshed), "not written");
  assert.ok(!fs.existsSync(rule));
  assert.ok(!(".claude/rules/components.md" in readManifest(target).rules), "not recorded");
  assert.doesNotMatch(read(target, "AGENTS.md"), /\[Components\]/, "the table follows the rules the site has");
  const check = agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: true, ...quiet });
  assert.ok(!check.some((f) => f.file === ".claude/rules/components.md"), "not reported missing");
  assert.deepEqual(check.filter((f) => f.status !== "ok"), [], "--check stays clean");
  // the site adopts the guard: its config, then --agent-files
  fs.writeFileSync(path.join(target, "src/config/components.json"), "{}\n");
  assert.equal(status(agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: true, ...quiet }))[".claude/rules/components.md"], "missing");
  assert.equal(status(agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: false, ...quiet }))[".claude/rules/components.md"], "created");
  assert.equal(read(target, ".claude/rules/components.md"), thinRule(read(KIT, "templates/site/rules/components.md"), ".claude/rules/components.md"));
  assert.match(read(target, "AGENTS.md"), /\| \[Components\]\(\.claude\/rules\/components\.md\) \|$/m);
  assert.deepEqual(agentFiles(target, { kitRoot: KIT, version: "0.8.0", check: true, ...quiet }).filter((f) => f.status !== "ok"), []);
});

/** A site as 0.8 laid its agent files out, from `kit`: the rules whole and the skills copied in both trees, a manifest of their bases, and the base copy of `edited` rules. */
function oldSite(target, kit, { edit = {}, add = {} } = {}) {
  for (const dir of [".claude/rules", ".claude/skills", ".agents/skills"]) fs.rmSync(path.join(target, dir), { recursive: true, force: true });
  const files = {};
  for (const { file, text } of renderAgentFiles(kit)) {
    fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
    fs.writeFileSync(path.join(target, file), edit[file] ? edit[file](text) : text);
    files[file] = sha(text);
    if (edit[file]) { fs.mkdirSync(path.dirname(path.join(target, ".agentic-cms/base", file.slice(1))), { recursive: true }); fs.writeFileSync(path.join(target, ".agentic-cms/base", file.slice(1)), text); }
  }
  for (const [file, text] of Object.entries(add)) fs.writeFileSync(path.join(target, file), text);
  fs.writeFileSync(path.join(target, ".agentic-cms.json"), JSON.stringify({ version: "0.8.4", files }, null, 1));
  fs.writeFileSync(path.join(target, SETTINGS), JSON.stringify({ extraKnownMarketplaces: { "agentic-cms": { source: { source: "github", repo: "HKamkar/agentic-cms" } } }, enabledPlugins: { "editorial@agentic-cms": true } }, null, 2));
}

test("a site laid out before 0.9.0 is legacy to --check, and the refresh moves it: the copies it never touched go, one it edited becomes its own, each rule thin with its own lines and paths; a second run moves nothing", () => {
  const target = tmp();
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.9.0", force: false, ...quiet });
  oldSite(target, KIT, {
    edit: {
      ".claude/rules/seo.md": (text) => text.replace('  - "content/pages/**"', '  - "content/pages/**"\n  - "content/landing/**"') + "- Our own: every title ends with the brand.\n",
      ".claude/skills/design-proof/SKILL.md": (text) => `${text}\nOur own step.\n`,
    },
    add: { ".agents/skills/design-icons/ours.md": "the site's own reference\n" },
  });
  const check = agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet });
  assert.ok(check.length && check.every((f) => f.status === "legacy"));
  assert.ok([".claude/skills/design", ".agents/skills/design", ".claude/rules/seo.md", ".agentic-cms/base"].every((file) => check.some((f) => f.file === file)));
  const report = agentFiles(target, { kitRoot: KIT, version: "0.9.0", ...quiet });
  const moved = statusOf(report.filter((f) => MOVES.includes(f.status)));
  assert.equal(moved[".claude/skills/design"], "removed", "the kit's text: the design plugin has it");
  assert.equal(moved[".claude/skills/design-proof"], "moved");
  assert.equal(moved[".agents/skills/design-icons"], "moved", "a file of the site's own in it makes it the site's");
  assert.equal(moved[".claude/rules/styling.md"], "thin");
  assert.equal(statusOf(report)[".agents/skills/design-icons/SKILL.md"], "created", "and Codex gets the stub in its place");
  assert.ok(!fs.existsSync(path.join(target, ".claude/skills/design")) && !fs.existsSync(path.join(target, ".agentic-cms")));
  assert.match(read(target, ".claude/skills/design-proof-site/SKILL.md"), /^---\nname: design-proof-site\n[\s\S]*\n---\n\n> This site's own version of the kit's `design-proof` skill[\s\S]*Our own step\.\n$/);
  assert.equal(read(target, ".agents/skills/design-icons-site/ours.md"), "the site's own reference\n");
  const seo = read(target, ".claude/rules/seo.md");
  assert.match(seo, /^---\npaths:\n[\s\S]*- "content\/landing\/\*\*"\n[\s\S]*?---\n/, "the site's own paths");
  assert.ok(seo.endsWith(`${BLOCK_END}\n\n- Our own: every title ends with the brand.\n`), "and its own line, after the kit's block");
  assert.equal(read(target, ".claude/rules/styling.md"), thinRule(read(KIT, "templates/site/rules/styling.md"), ".claude/rules/styling.md"));
  assert.equal(JSON.parse(read(target, SETTINGS)).extraKnownMarketplaces["agentic-cms"].source.source, "directory");
  assert.deepEqual(agentFiles(target, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet }).filter((f) => !["ok", "modified"].includes(f.status)), []);
  assert.ok(!agentFiles(target, { kitRoot: KIT, version: "0.9.0", ...quiet }).some((f) => MOVES.includes(f.status)), "nothing left to move");
});

test("a rule a release of the kit shipped is the kit's however old, and takes the kit's current paths; on a site already moved, a rule without the marks is the site's own, never legacy", () => {
  const target = tmp();
  const older = (text) => text.replace('  - "content/pages/**"\n', "");
  const kit = recordedKit([{ version: "0.8.3", changed: { ".claude/rules/seo.md": older(read(KIT, "templates/site/rules/seo.md")) } }, { version: "0.8.4" }]);
  scaffold(target, { name: "My Site", kitRoot: KIT, version: "0.9.0", force: false, ...quiet });
  oldSite(target, kit);
  fs.writeFileSync(path.join(target, ".claude/rules/seo.md"), older(read(KIT, "templates/site/rules/seo.md")));
  fs.rmSync(path.join(target, ".agentic-cms.json"));
  assert.equal(agentFiles(target, { kitRoot: kit, version: "0.9.0", ...quiet }).find((f) => f.file === ".claude/rules/seo.md").status, "thin");
  assert.equal(read(target, ".claude/rules/seo.md"), thinRule(read(KIT, "templates/site/rules/seo.md"), ".claude/rules/seo.md"), "0.8.3's text untouched: the kit's thin rule, the kit's paths");
  fs.writeFileSync(path.join(target, ".claude/rules/seo.md"), read(target, ".claude/rules/seo.md").replace(`${BLOCK_START}\n`, ""));
  assert.equal(statusOf(agentFiles(target, { kitRoot: kit, version: "0.9.0", check: true, ...quiet }))[".claude/rules/seo.md"], "modified");
});

/** This kit's agent files with a record of `releases` [{ version, changed }], each release this kit's texts but for those `changed` names by site path. */
function recordedKit(releases) {
  const kit = kitWith();
  const current = renderAgentFiles(kit);
  const record = recordOf(releases.map(({ version, changed = {} }) => ({ version, files: current.map(({ file, text }) => ({ file, text: changed[file] ?? text })) })));
  fs.mkdirSync(path.dirname(path.join(kit, RELEASES)), { recursive: true });
  fs.writeFileSync(path.join(kit, RELEASES), recordText(record));
  return kit;
}
const statusOf = (report) => Object.fromEntries(report.map((f) => [f.file, f.status]));
/** The statuses of what the move from 0.8 did. */
const MOVES = ["removed", "moved", "thin"];
