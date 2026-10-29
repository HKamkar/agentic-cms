#!/usr/bin/env node
// Proves the package as a site sees it, which the checkout never does (the
// example resolves the package's name to the source): packs the package,
// and in a scratch folder that holds what the old install docs left there
// (`pnpm init`'s package.json and the workspace snippet without
// unrs-resolver), runs the install line of docs/init.md as it is written,
// the tarball standing in for the git spec. The site is the starter: none of
// the example's brand, content or pictures in it. Then it installs the site's
// dependencies and runs its build as its own CI does, the starter's
// placeholders warnings — the content lint, the field-table check, next build
// and the SEO audit — then a production build, which fails on them, then,
// with the copy replaced as a site writes its own, the production build
// clean, guard-email last finding its address in no served file (and one
// planted in a bundle); its lint (ESLint, then the site check, whose
// component guard a planted stray section file fails), with no warning, and
// its Dependabot config; then, the site committed to git, the bypass fixture
// (tools/bypass-fixture.mjs: one example of each way around the kit the
// 0.8.2 plan found) laid over it for one run of its checks — each required
// bypass failing with its message, each preferred one warning — and taken
// back; then the site as 0.8.1 left it (tools/upgrade-fixture.mjs: 0.8.1's
// scripts and configs, a head written by hand, a mailto: of its own, a round
// made by hand, the example's posts, author, logo and reviews) upgraded as
// docs/migrating-to-0.8.2.md § 1 says, its CI build green on the baseline
// `check-site --baseline` writes, a new bypass failing and a fixed one
// shrinking the list, and the fresh site put back; then the site as one
// that never took 0.8.0's § 3.7 left it, on each of the guide's two paths,
// upgraded by § 1 with § 3.7 inside it to a green lint and build, its
// sections' composition held by the baseline; its tests through the
// installed command line;
// then checks the agent files are as shipped, the
// installed entries a build does not run (the inline loop, the play-once
// layer, the form endpoint's server half, the consent entries, the class
// helpers and the component lint in plain Node) and the tarball's size;
// last, a second site laid out by the installed `init --light-only --name`
// builds, lints and tests too, with no theme script in its pages. Exit 1 on
// the first failure.
//
//   pnpm test:pack           (a few minutes: two installs and a build)
//   pnpm test:pack --keep    leaves the scratch site behind and prints where
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BYPASSES, CATALOGUED, eslintEntries, unanswered } from "./bypass-fixture.mjs";
import { content084, site084 } from "./migration-fixture.mjs";
import { heldOtherwise, LEGACY, PATHS, unexpected, UNGUARDED, UPGRADE } from "./upgrade-fixture.mjs";

const ROOT = process.cwd();
const MAX_TARBALL = 1024 * 1024;
const ENV = { ...process.env, CI: "1" };

/** pnpm's answer when its cached metadata predates a version the registry has published. */
export const STALE_METADATA = /ERR_PNPM_NO_MATCHING_VERSION/;

/**
 * A `pnpm install --prefer-offline`, run once more without --prefer-offline
 * when it fails on stale metadata: the online install refreshes the
 * machine's metadata itself, so nobody has to clear pnpm's cache by hand.
 * `run(args)` resolves to { status, output }.
 */
export async function installWithRetry(args, run, log = console.error) {
  const first = await run(args);
  if (first.status === 0 || !args.includes("--prefer-offline") || !STALE_METADATA.test(first.output)) return first;
  log("pack-smoke: pnpm's cached metadata lacks a published version; installing again without --prefer-offline, which refreshes it");
  return run(args.filter((arg) => arg !== "--prefer-offline"));
}

/** The documented install line (`pnpm dlx … agentic-cms@github:…#v<version> init my-site --name "My Site"`) as pnpm's arguments, a quoted one unquoted, with the package spec and the folder swapped; null when the doc has no such line. */
export function documentedInstall(doc, { spec, dir }) {
  const line = doc.match(/^pnpm dlx [^\n]*agentic-cms@github:HKamkar\/agentic-cms#v[\d.]+ init my-site --name "[^"\n]+"$/m)?.[0];
  if (!line) return null;
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].slice(1).map(([, quoted, arg]) => quoted ?? (arg.startsWith("agentic-cms@github:") ? `agentic-cms@${spec}` : arg === "my-site" ? dir : arg));
}

/** What `pnpm init` writes, at the pnpm running the smoke (a newer one would be downloaded through devEngines). */
export const pnpmInitPackage = (name, pnpm) => ({ name, version: "1.0.0", description: "", main: "index.js", scripts: { test: 'echo "Error: no test specified" && exit 1' }, keywords: [], author: "", license: "ISC", devEngines: { packageManager: { name: "pnpm", version: pnpm, onFail: "download" } }, packageManager: `pnpm@${pnpm}`, type: "module" });
/** The workspace docs/init.md had a site write by hand up to 0.7.6: without unrs-resolver, which stopped the install after init at ERR_PNPM_IGNORED_BUILDS. */
export const OLD_WORKSPACE = 'allowBuilds:\n  "agentic-cms@git+https://github.com/HKamkar/agentic-cms.git": true\n  sharp: true\n';

/** The environment of the site's own CI build (templates/site/verify.yml): the starter's placeholders stay warnings in a run that deploys nothing. */
const CI_BUILD = { AGENTIC_CMS_PLACEHOLDERS: "warn" };

const fail = (message) => { console.error(`pack-smoke: ${message}`); process.exit(1); };
const run = (command, args, cwd, env = {}) => {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env: { ...ENV, ...env } });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed in ${cwd}`);
};
/** Runs a command with its output shown as it comes and kept for the caller. */
const tee = (command, args, cwd) => new Promise((resolve) => {
  const child = spawn(command, args, { cwd, stdio: ["inherit", "pipe", "pipe"], env: ENV });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; process.stdout.write(chunk); });
  child.stderr.on("data", (chunk) => { output += chunk; process.stderr.write(chunk); });
  child.on("close", (status) => resolve({ status, output }));
});
async function install(args, cwd) {
  const result = await installWithRetry(["install", ...args], (pnpmArgs) => tee("pnpm", pnpmArgs, cwd));
  if (result.status !== 0) fail(`pnpm install ${args.join(" ")} failed in ${cwd}`);
}

/** 1. The tarball: what a consumer installs, dist/ included (prepare runs first). */
function pack(scratch) {
  const packed = execFileSync("pnpm", ["pack", "--pack-destination", scratch, "--json"], { cwd: ROOT, encoding: "utf8" });
  const tarball = path.join(scratch, path.basename(JSON.parse(packed.slice(packed.indexOf("{"))).filename));
  const size = fs.statSync(tarball).size;
  if (size > MAX_TARBALL) fail(`the tarball is ${(size / 1024).toFixed(0)} KB, over the ${MAX_TARBALL / 1024} KB the files list is meant to stay under`);
  return { tarball, size };
}

/** 2. The old docs' leftovers, then the documented line laying the site out over them; init pins the kit's tag, the smoke keeps the tarball. */
function layOut(scratch, site, tarball) {
  fs.mkdirSync(site, { recursive: true });
  const pnpm = execFileSync("pnpm", ["--version"], { cwd: scratch, encoding: "utf8" }).trim();
  fs.writeFileSync(path.join(site, "package.json"), JSON.stringify(pnpmInitPackage("agentic-cms-smoke", pnpm), null, 2));
  fs.writeFileSync(path.join(site, "pnpm-workspace.yaml"), OLD_WORKSPACE);
  const dlx = documentedInstall(fs.readFileSync(path.join(ROOT, "docs/init.md"), "utf8"), { spec: `file:${tarball}`, dir: path.basename(site) });
  if (!dlx) fail('docs/init.md has no `pnpm dlx … init my-site --name "My Site"` install line to run');
  run("pnpm", dlx, scratch);
  const pkg = JSON.parse(fs.readFileSync(path.join(site, "package.json"), "utf8"));
  if (pkg.scripts.test.includes("no test specified") || "main" in pkg) fail("init kept pnpm init's placeholder test or its main");
  if (!/^ {2}unrs-resolver: true$/m.test(fs.readFileSync(path.join(site, "pnpm-workspace.yaml"), "utf8"))) fail("init left pnpm-workspace.yaml without unrs-resolver");
  pkg.dependencies["agentic-cms"] = `file:${tarball}`;
  fs.writeFileSync(path.join(site, "package.json"), JSON.stringify(pkg, null, 2));
}

/** 3. The site's dependencies (no lockfile yet), the files the tarball must ship and none of the example's, then the starter's builds, the lint, the tests and the agent files through the installed command line. */
async function build(site) {
  await install(["--prefer-offline", "--no-frozen-lockfile"], site);
  const kit = path.join(site, "node_modules/agentic-cms");
  for (const shipped of ["templates/site/AGENTS.md", "templates/site/verify.yml", ".claude/skills/design/SKILL.md", ".agents/skills/design/SKILL.md", "scripts/lib/agent-file-releases.json", "templates/starter/content/pages/home.yaml", "content/_templates/page.yaml", "docs/commands.md"]) {
    if (!fs.existsSync(path.join(kit, shipped))) fail(`the tarball lacks ${shipped} (package.json files)`);
  }
  for (const example of ["content/pages/home.yaml", "content/blog/pages-are-files.md", "content/reviews.yaml", "public/images/authors"]) {
    if (fs.existsSync(path.join(kit, example))) fail(`the tarball ships the example's ${example}, which stays in the kit's repository`);
  }
  noExample(site);
  schemasShipped(site);
  starterBuilds(site);
  redirectsServed(site);
  emailGuarded(site);
  lintsClean(site);
  guardFails(site);
  dependabot(site);
  bypasses(site);
  upgrade(site);
  for (const way of PATHS) upgradeUnguarded(site, way);
  upgradeFrom084(site);
  run("pnpm", ["test"], site);
  run("pnpm", ["exec", "agentic-cms", "init", ".", "--agent-files", "--check"], site);
  agentFilesResolve(site);
}

/**
 * What the site's agent files name is in the installed package: the
 * marketplace its .claude/settings.json gives by path, each plugin it enables
 * listed there with a skill in its folder, the file each Codex stub and each
 * thin rule points at.
 */
function agentFilesResolve(site) {
  const settings = JSON.parse(fs.readFileSync(path.join(site, ".claude/settings.json"), "utf8"));
  for (const [name, { source }] of Object.entries(settings.extraKnownMarketplaces ?? {})) {
    if (source.source !== "directory") fail(`.claude/settings.json: the marketplace ${name} is ${source.source}, not the installed package's folder`);
    const root = path.resolve(site, source.path);
    const market = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin/marketplace.json"), "utf8"));
    for (const plugin of Object.keys(settings.enabledPlugins).filter((id) => id.endsWith(`@${name}`)).map((id) => id.split("@")[0])) {
      const entry = market.plugins.find((p) => p.name === plugin);
      if (!entry) fail(`the package's marketplace lists no ${plugin}, which .claude/settings.json enables`);
      const skills = path.join(root, entry.source, "skills");
      if (!fs.existsSync(skills) || !fs.readdirSync(skills).some((skill) => fs.existsSync(path.join(skills, skill, "SKILL.md")))) fail(`the ${plugin} plugin has no skill at ${path.relative(site, skills)}`);
    }
  }
  const pointers = [".agents/skills", ".claude/rules"].flatMap((dir) => fs.readdirSync(path.join(site, dir), { recursive: true }).filter((file) => file.endsWith(".md")).map((file) => path.join(site, dir, file)));
  for (const file of pointers) {
    for (const [, named] of fs.readFileSync(file, "utf8").matchAll(/`(node_modules\/agentic-cms\/[^`]+\.md)`/g)) if (!fs.existsSync(path.join(site, named))) fail(`${path.relative(site, file)} points at ${named}, which the package lacks`);
  }
  console.log(`pack-smoke: the site's marketplace, plugins, stubs and thin rules resolve in the installed package (${pointers.length} files)`);
}

/** A fresh site holds nothing of the example's brand: no Acme, acme.example or acme-editorial in any file init wrote. */
function noExample(site) {
  const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (["node_modules", ".next", ".git"].includes(e.name) ? [] : e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const left = files(site).filter((file) => /acme/i.test(path.basename(file)) || (!/\.(?:jpe?g|png|webp|ico)$/.test(file) && /acme/i.test(fs.readFileSync(file, "utf8"))));
  if (left.length) fail(`the fresh site holds the example's brand: ${left.map((file) => path.relative(site, file)).join(", ")}`);
}

/** The content files checked as they are typed (docs/schema.md): the tarball ships the JSON Schemas, init laid them out current, and the starter's YAML files open with the line an editor reads them by. */
function schemasShipped(site) {
  if (!fs.existsSync(path.join(site, "node_modules/agentic-cms/content/_schemas/pages.json"))) fail("the tarball lacks content/_schemas/ (package.json files)");
  const check = spawnSync("pnpm", ["exec", "agentic-cms", "schema", "--check"], { cwd: site, encoding: "utf8", env: ENV });
  if (check.status !== 0) fail(`agentic-cms schema --check answered ${check.status} in the fresh site: ${`${check.stdout}${check.stderr}`.trim().slice(-600)}`);
  if (!fs.readFileSync(path.join(site, "content/pages/home.yaml"), "utf8").startsWith("# yaml-language-server: $schema=../_schemas/pages.json\n")) fail("the starter's home page does not open with its schema's line");
}

/**
 * The starter's three builds: as the site's CI runs it, its placeholders
 * warnings; a production build, which fails at the content lint naming each
 * placeholder by file and field before next build starts; and, the copy
 * replaced as a site writes its own (the marker gone with each string, an
 * address of its own for each stand-in), the production build clean.
 */
function starterBuilds(site) {
  run("pnpm", ["build"], site, CI_BUILD);
  const production = spawnSync("pnpm", ["build"], { cwd: site, encoding: "utf8", env: ENV });
  const output = `${production.stdout}${production.stderr}`;
  if (production.status === 0 || !/^FAIL content\/pages\/home\.yaml placeholder: sections\[0\]\.heading is placeholder copy, which a production build never ships/m.test(output) || !/^FAIL src\/config\/site\.ts placeholder: line \d+ \(url\) "https:\/\/[\w-]+\.example"/m.test(output) || /Creating an optimized production build/.test(output)) {
    fail(`a production build of the starter answered ${production.status}, and should fail at the content lint on its placeholders: ${output.trim().slice(-800)}`);
  }
  for (const file of ["content/pages/home.yaml", "content/pages/blog.yaml", "src/config/site.ts"]) {
    const full = path.join(site, file);
    fs.writeFileSync(full, fs.readFileSync(full, "utf8").replaceAll("(placeholder) ", "").replace(/([\w.-]+)\.example\b/g, "$1.dev"));
  }
  run("pnpm", ["build"], site);
}

/**
 * The site's redirects reach Next through the config init wrote
 * (docs/redirects.md): one written into content/redirects.yaml in place of
 * the starter's [] is in the next build's routes manifest as a 308, and a
 * path the sitemap lists, redirected, fails the SEO audit (run alone on
 * that build: the content lint would refuse it first). The redirect stays,
 * as a site's own would.
 */
function redirectsServed(site) {
  edit(site, "content/redirects.yaml", (text) => text.replace(/^\[\]\n/m, "- from: /news\n  to: /blog\n"));
  run("pnpm", ["exec", "next", "build"], site);
  const manifest = JSON.parse(fs.readFileSync(path.join(site, ".next/routes-manifest.json"), "utf8"));
  if (!manifest.redirects?.some((r) => r.source === "/news" && r.destination === "/blog" && r.statusCode === 308)) fail(`next.config's redirects() did not serve content/redirects.yaml: ${JSON.stringify(manifest.redirects)}`);
  const file = path.join(site, "content/redirects.yaml");
  const kept = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, `${kept}- from: /blog\n  to: /\n`);
  const audit = spawnSync("pnpm", ["exec", "agentic-cms", "seo"], { cwd: site, encoding: "utf8", env: ENV });
  fs.writeFileSync(file, kept);
  if (audit.status !== 1 || !/FAIL \/sitemap\.xml sitemap: \S+\/blog is redirected \(content\/redirects\.yaml\)/.test(`${audit.stdout}${audit.stderr}`)) fail(`the SEO audit with a redirected sitemap path answered ${audit.status}: ${`${audit.stdout}${audit.stderr}`.trim().slice(-600)}`);
}

/**
 * The starter keeps its address out of every served file (guardEmail, D5):
 * the builds above ran guard-email last; run again, it scans the clean build
 * and finds the address nowhere, the blog's publisher carries a contact point
 * in its place, and an address planted in a bundle fails it, naming the
 * client-component fix — the guard watches the site's own domain.
 */
function emailGuarded(site) {
  const config = fs.readFileSync(path.join(site, "src/config/site.ts"), "utf8");
  const [address, origin] = [/^ {2}email: "([^"]+)",$/m, /^ {2}url: "([^"]+)",$/m].map((re) => config.match(re)?.[1]);
  if (!address || !origin || !/^ {2}guardEmail: true,$/m.test(config)) fail("the starter's site.ts does not turn guardEmail on for its address");
  const guard = () => spawnSync("pnpm", ["exec", "agentic-cms", "guard-email", "--json"], { cwd: site, encoding: "utf8", env: ENV });
  const clean = guard();
  const scan = (() => { try { return JSON.parse(clean.stdout); } catch { return null; } })();
  if (clean.status !== 0 || !scan?.scanned || scan.hits.length) fail(`guard-email over the starter's build answered ${clean.status}: ${`${clean.stdout}${clean.stderr}`.trim().slice(-600)}`);
  const blog = fs.readFileSync(path.join(site, ".next/server/app/blog.html"), "utf8");
  if (blog.includes(address) || !blog.includes(`"contactPoint":{"@type":"ContactPoint","url":"${origin}/#contact-form"}`)) fail("the blog's structured data carries the address, or no contact point in its place");
  const leak = path.join(site, ".next/static/chunks/pack-smoke-leak.js");
  fs.writeFileSync(leak, `const to = ${JSON.stringify(address)};\n`);
  const caught = guard();
  fs.rmSync(leak);
  if (caught.status !== 1 || !caught.stderr.includes(".next/static/chunks/pack-smoke-leak.js") || !caught.stderr.includes("a client component imports the module that holds the address")) fail(`guard-email with the address planted in a bundle answered ${caught.status}: ${caught.stderr.trim().slice(-600)}`);
}

/** The site's lint passes with no warning: what the starter keeps of its own that the preferred tier guides (the placeholder's crossed box, the honeypot's offset) carries its reason in "allow". */
function lintsClean(site) {
  const result = spawnSync("pnpm", ["lint"], { cwd: site, encoding: "utf8", env: ENV });
  const output = `${result.stdout}${result.stderr}`;
  process.stdout.write(output);
  if (result.status !== 0) fail(`pnpm lint failed in ${site}`);
  if (/\bwarnings?\b|⚠/.test(output)) fail(`pnpm lint warns in the fresh site, which keeps nothing the preferred tier guides without its reason: ${output.trim().slice(-800)}`);
}

/** The site's lint runs the installed site check after ESLint: the components rule came with the guard's config, and a section file the registry does not import fails the lint though ESLint passes it. */
function guardFails(site) {
  const { lint, build } = JSON.parse(fs.readFileSync(path.join(site, "package.json"), "utf8")).scripts;
  if (!/; agentic-cms check-site \|\| s=1; exit \$s$/.test(lint)) fail(`the site's lint does not run the site check after ESLint: ${lint}`);
  // The builds above ran the lint first: the gates init writes, the e-mail guard last (the starter turns guardEmail on).
  if (!/^pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email$/.test(build)) fail(`the site's build does not hold the gates in their order: ${build}`);
  if (!fs.existsSync(path.join(site, "src/config/components.json")) || !fs.existsSync(path.join(site, ".claude/rules/components.md"))) fail("init wrote the guard's config without the components rule, or neither");
  const stray = path.join(site, "src/components/sections/Stray.tsx");
  fs.writeFileSync(stray, "export function Stray() {\n  return null;\n}\n");
  const result = spawnSync("pnpm", ["lint"], { cwd: site, encoding: "utf8", env: ENV });
  fs.rmSync(stray);
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 1 || !/✗ src\/components\/sections\/Stray\.tsx {2}\[registry\]/.test(output)) fail(`pnpm lint with a stray section file answered ${result.status}: ${output.trim().slice(-600)}`);
}

/** The fresh site keeps its CI's actions current: init wrote the kit's Dependabot config for them. */
function dependabot(site) {
  const file = path.join(site, ".github/dependabot.yml");
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== fs.readFileSync(path.join(ROOT, "templates/site/dependabot.yml"), "utf8")) fail("init did not write .github/dependabot.yml from the kit's template");
}

/** A file of the site written, its folder made first. */
const write = (site, file, text) => { fs.mkdirSync(path.dirname(path.join(site, file)), { recursive: true }); fs.writeFileSync(path.join(site, file), text); };
/** A JSON file's text as the kit writes one: two-space indents, a newline at the end. */
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** git in the site, as a person who commits nothing anywhere else: no signing, the identity the commit needs and no more. */
const git = (site, ...args) => run("git", ["-c", "user.name=pack-smoke", "-c", "user.email=pack-smoke@localhost", "-c", "commit.gpgsign=false", ...args], site);

/** The fixture's writes, applied — each edit on the file as the edits before it left it: the files it adds and the text each file it edits had, to take them back. */
function layBypasses(site) {
  const added = [];
  const before = new Map();
  const current = (file) => { const text = fs.readFileSync(path.join(site, file), "utf8"); if (!before.has(file)) before.set(file, text); return text; };
  for (const bypass of BYPASSES) {
    for (const [file, text] of Object.entries(bypass.files ?? {})) { added.push(file); write(site, file, text); }
    for (const [file, text] of Object.entries(bypass.append ?? {})) write(site, file, `${current(file)}${text}`);
    for (const [file, change] of Object.entries(bypass.edit ?? {})) write(site, file, change(current(file)));
    for (const [file, change] of Object.entries(bypass.json ?? {})) write(site, file, json(change(JSON.parse(current(file)))));
  }
  write(site, "src/components/README.md", `${current("src/components/README.md")}\n${CATALOGUED.map((name) => `\`${name}\``).join(", ")}: the bypass fixture's.\n`);
  return { added, before };
}

/**
 * The bypass fixture over the fresh site, committed to git first so the site
 * check compares the exceptions with it: one run each of the lint, the
 * content lint and the agent-file check, every bypass answered as its tier
 * says (tools/bypass-fixture.mjs), then everything taken back, which git
 * confirms.
 */
function bypasses(site) {
  git(site, "init", "-q", "-b", "main");
  git(site, "add", "-A");
  git(site, "commit", "-q", "-m", "the fresh site");
  const { added, before } = layBypasses(site);
  // The site's own history is the base: a pull request's base branch in the kit's CI names none here.
  const env = Object.fromEntries(Object.entries(ENV).filter(([key]) => key !== "GITHUB_BASE_REF"));
  const answer = (...args) => { const r = spawnSync("pnpm", args, { cwd: site, encoding: "utf8", env }); return { status: r.status, output: `${r.stdout}${r.stderr}` }; };
  const lint = answer("lint");
  const content = answer("content:lint");
  const agentFiles = answer("exec", "agentic-cms", "init", ".", "--agent-files", "--check");
  for (const file of added) fs.rmSync(path.join(site, file));
  fs.rmSync(path.join(site, "src/app/promo-demo"), { recursive: true, force: true });
  for (const [file, text] of before) fs.writeFileSync(path.join(site, file), text);
  const missing = unanswered({ lint: lint.output, content: content.output, agentFiles: agentFiles.output, entries: eslintEntries(lint.output, fs.realpathSync(site)) });
  for (const [name, { status }] of Object.entries({ "pnpm lint": lint, "pnpm content:lint": content, "init --agent-files --check": agentFiles })) if (status !== 1) missing.push(`${name} answered ${status}, and should fail on the fixture`);
  if (missing.length) fail(`the bypass fixture was not answered as its tiers say:\n  ${missing.join("\n  ")}\n${lint.output.trim().slice(-3000)}`);
  const left = spawnSync("git", ["status", "--porcelain"], { cwd: site, encoding: "utf8" }).stdout.trim();
  if (left) fail(`the bypass fixture was not taken back: ${left}`);
  console.log(`pack-smoke: the bypass fixture answered — ${BYPASSES.filter((b) => b.tier === "required").length} required bypasses fail their checks with their messages, ${BYPASSES.filter((b) => b.tier === "preferred").length} preferred ones warn`);
}

/** The site's own history is the base of the site check's comparisons: a pull request's base branch in the kit's CI names none here. */
const ownBase = () => Object.fromEntries(Object.entries(ENV).filter(([key]) => key !== "GITHUB_BASE_REF"));
/** A command in the site, its exit and its output kept, run as its own CI runs it. */
const answer = (site, args, env = {}) => { const r = spawnSync("pnpm", args, { cwd: site, encoding: "utf8", env: { ...ownBase(), ...env } }); return { status: r.status, output: `${r.stdout}${r.stderr}` }; };
const edit = (site, file, change) => { const full = path.join(site, file); fs.writeFileSync(full, change(fs.readFileSync(full, "utf8"))); };
const editJson = (site, file, change) => edit(site, file, (text) => json(change(JSON.parse(text))));
const setScripts = (site, scripts) => editJson(site, "package.json", (pkg) => ({ ...pkg, scripts: { ...pkg.scripts, ...scripts } }));
/** The baseline `check-site --baseline` wrote into the site's guard config. */
const writtenBaseline = (site) => JSON.parse(fs.readFileSync(path.join(site, "src/config/components.json"), "utf8")).baseline ?? [];
const headOf = (site) => spawnSync("git", ["rev-parse", "HEAD"], { cwd: site, encoding: "utf8" }).stdout.trim();
/** The fresh site put back at its commit, which git confirms. */
function putBack(site, fresh, label) {
  git(site, "reset", "-q", "--hard", fresh);
  git(site, "clean", "-fdq");
  const left = spawnSync("git", ["status", "--porcelain"], { cwd: site, encoding: "utf8" }).stdout.trim();
  if (left) fail(`${label}the fresh site was not put back after the upgrade: ${left}`);
}

/** The fresh site made the site 0.8.1 left (tools/upgrade-fixture.mjs), the example's files copied from the kit's checkout. */
function layLegacy(site) {
  setScripts(site, LEGACY.scripts);
  for (const [file, text] of Object.entries(LEGACY.files)) write(site, file, text);
  for (const [file, change] of Object.entries(LEGACY.edit)) edit(site, file, change);
  for (const file of LEGACY.example) fs.cpSync(path.join(ROOT, file), path.join(site, file), { recursive: true });
  edit(site, "src/components/README.md", (text) => `${text}\n${LEGACY.catalogued.map((name) => `\`${name}\``).join(", ")}: the site's own, from before 0.8.2.\n`);
}

/** docs/migrating-to-0.8.2.md § 1 on the site: the gates, ESLint reading the guard's config, the owners. */
function layUpgrade(site) {
  setScripts(site, UPGRADE.scripts);
  for (const [file, change] of Object.entries(UPGRADE.edit)) edit(site, file, change);
  for (const [file, change] of Object.entries(UPGRADE.json)) editJson(site, file, change);
}

/**
 * 3b. The site as 0.8.1 left it, committed, then upgraded by § 1 of the
 * guide: on 0.8.2 its 0.8.1 lint fails on the engines; with § 1's edits,
 * `check-site --baseline` writes each engine bypass and each of the
 * example's leftovers into the baseline and the site's CI build passes on
 * it. A new mailto: in a baselined file then fails the lint; the hand-written
 * head put back on kit.seo asks for its entry to shrink, `--baseline` takes
 * it out, and the lint passes. Last, the fresh site is put back, which git
 * confirms.
 */
function upgrade(site) {
  const fresh = headOf(site);
  const layout = fs.readFileSync(path.join(site, "src/app/layout.tsx"), "utf8");
  layLegacy(site);
  git(site, "add", "-A");
  git(site, "commit", "-q", "-m", "the site as 0.8.1 left it");
  const old = answer(site, ["lint"]);
  if (old.status !== 1 || !/agentic-cms\/head/.test(old.output) || !/agentic-cms\/email/.test(old.output)) fail(`the site as 0.8.1 left it answered ${old.status} to its own lint, which should fail on 0.8.2's engines: ${old.output.trim().slice(-1200)}`);
  layUpgrade(site);
  const taken = answer(site, ["exec", "agentic-cms", "check-site", "--baseline"]);
  const baseline = writtenBaseline(site);
  const missing = unexpected(baseline);
  if (taken.status !== 0 || missing.length) fail(`check-site --baseline answered ${taken.status}${missing.length ? `, and wrote ${missing.join(", ")}` : ""}: ${taken.output.trim().slice(-2000)}`);
  const build = answer(site, ["build"], CI_BUILD);
  if (build.status !== 0) fail(`the upgraded site's CI build failed on its baseline: ${build.output.trim().slice(-3000)}`);
  const mailLink = fs.readFileSync(path.join(site, "src/components/ui/MailLink.tsx"), "utf8");
  edit(site, "src/components/ui/MailLink.tsx", (text) => text.replace("className={className}>", "className={className} data-copy={`mailto:${address}`}>"));
  const grown = answer(site, ["lint"]);
  fs.writeFileSync(path.join(site, "src/components/ui/MailLink.tsx"), mailLink);
  if (grown.status !== 1 || !/2 of this rule here, and the baseline \(src\/config\/components\.json\) holds 1: the baseline only shrinks/.test(grown.output)) fail(`a second mailto: in a baselined file answered ${grown.status}, and should fail the lint naming the count: ${grown.output.trim().slice(-1500)}`);
  fs.writeFileSync(path.join(site, "src/app/layout.tsx"), layout);
  const fixed = answer(site, ["lint"]);
  if (fixed.status !== 1 || !/The baseline \(src\/config\/components\.json\) holds 1 of this rule here and 0 are left/.test(fixed.output)) fail(`the head put back on kit.seo answered ${fixed.status}, and should ask for its entry to shrink: ${fixed.output.trim().slice(-1500)}`);
  const shrunk = answer(site, ["exec", "agentic-cms", "check-site", "--baseline"]);
  if (shrunk.status !== 0 || !/− src\/app\/layout\.tsx {2}agentic-cms\/head: none left, the entry is gone/.test(shrunk.output)) fail(`check-site --baseline answered ${shrunk.status}, and should take the head's entry out: ${shrunk.output.trim().slice(-1500)}`);
  const clean = answer(site, ["lint"]);
  if (clean.status !== 0) fail(`the lint after the baseline shrank answered ${clean.status}: ${clean.output.trim().slice(-1500)}`);
  putBack(site, fresh, "");
  console.log(`pack-smoke: the site as 0.8.1 left it upgraded by the guide's § 1 — ${baseline.length} baseline entries, its CI build green, a new bypass refused and a fixed one shrinking the list`);
}

/**
 * 3d. The site as 0.8.4 left its agent files (tools/migration-fixture.mjs:
 * 0.8.4's own texts from the installed package's record, a rule and a skill
 * the site edited, AGENTS.md and CLAUDE.md as the 0.8 templates wrote them)
 * and its content (no JSON Schemas, no schema lines, no redirects),
 * upgraded by the installed `agentic-cms upgrade` with the tarball as its
 * spec: the 0.9.0 migration moves the copies, the steps left by hand come
 * back with their section (exit 1), the lint and the tests pass, the docs
 * check and the content lint pass on what it wrote, and the agent files'
 * check is clean after it; then the fresh site is put back.
 */
function upgradeFrom084(site) {
  const fresh = headOf(site);
  site084(site, { kitRoot: path.join(site, "node_modules/agentic-cms") });
  content084(site);
  git(site, "add", "-A");
  git(site, "commit", "-q", "-m", "the site as 0.8.4 left its agent files");
  const spec = JSON.parse(fs.readFileSync(path.join(site, "package.json"), "utf8")).dependencies["agentic-cms"];
  const r = spawnSync("pnpm", ["exec", "agentic-cms", "upgrade", "--kit", spec, "--json"], { cwd: site, encoding: "utf8", env: ownBase() });
  let report;
  try { report = JSON.parse(r.stdout); } catch { fail(`upgrade answered ${r.status} with no report: ${r.stderr.trim().slice(-2000)}`); }
  const moved = (report.migrations.find((m) => m.version === "0.9.0")?.changed ?? []).map((c) => c.status);
  const wrong = [
    r.status !== 1 && `it answered ${r.status}, and should leave AGENTS.md and CLAUDE.md by hand (exit 1)`,
    !["removed", "moved", "thin", "schema line", "written", "created", "redirects()"].every((status) => moved.includes(status)) && `the 0.9.0 migration changed ${moved.join(", ") || "nothing"}`,
    report.manual.length !== 3 && `it left ${report.manual.length} step(s) by hand, not AGENTS.md, CLAUDE.md and the site's own skill`,
    report.verify.some((v) => v.status !== 0) && `${report.verify.filter((v) => v.status !== 0).map((v) => `pnpm ${v.script}`).join(" and ")} failed after it`,
  ].filter(Boolean);
  if (wrong.length) fail(`upgrade from 0.8.4: ${wrong.join("; ")}: ${r.stderr.trim().slice(-2000)}`);
  run("pnpm", ["exec", "agentic-cms", "init", ".", "--agent-files", "--check"], site);
  run("pnpm", ["exec", "agentic-cms", "docs", "--check"], site);
  run("pnpm", ["content:lint"], site);
  if (!fs.existsSync(path.join(site, ".claude/skills/design-proof-site/SKILL.md")) || fs.existsSync(path.join(site, ".claude/skills/design"))) fail("upgrade did not make the site's edited skill its own, or kept a copy it never touched");
  putBack(site, fresh, "upgrade from 0.8.4: ");
  console.log(`pack-smoke: the site as 0.8.4 left its agent files upgraded by the installed upgrade — ${moved.length} moved, ${report.manual.length} steps left by hand with their section, the lint and the tests green`);
}

/** The text of each of a site's files, to put back. */
const texts = (site, files) => Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(site, file), "utf8")]));

/**
 * 3c. The site as one that never took 0.8.0's § 3.7 left it, on one of the
 * guide's two paths (tools/upgrade-fixture.mjs: no guard's config, Next's
 * ESLint rules alone, a registered section from before the composition
 * rules, a stale agent worktree; on the second path a route written by
 * hand), committed, then § 1 with § 3.7 inside it: the guard's config and
 * the ESLint config as the package gives a site, its `"baseline": []` a
 * first run on a base that has none, the gates, the path's route
 * exceptions. `check-site --baseline` writes exactly what the path
 * expects; the CI build passes; a second `--baseline` changes nothing; one
 * more raw link in the baselined section fails the lint naming the count.
 * Then the fresh site is put back, which git confirms.
 */
function upgradeUnguarded(site, way) {
  const fresh = headOf(site);
  const given = texts(site, ["src/config/components.json", "eslint.config.mjs"]);
  const gates = JSON.parse(fs.readFileSync(path.join(site, "package.json"), "utf8")).scripts;
  setScripts(site, UNGUARDED.scripts);
  for (const file of UNGUARDED.remove) fs.rmSync(path.join(site, file));
  for (const [file, text] of Object.entries({ ...UNGUARDED.files, ...way.files })) write(site, file, text);
  for (const [file, change] of Object.entries(way.edit)) edit(site, file, change);
  for (const [to, from] of Object.entries(way.copies)) fs.copyFileSync(path.join(site, from), path.join(site, to));
  git(site, "add", "-A");
  git(site, "commit", "-q", "-m", "the site before the rules");
  for (const [file, text] of Object.entries(UNGUARDED.worktree)) write(site, file, text);
  for (const [file, text] of Object.entries(given)) write(site, file, text);
  editJson(site, "src/config/components.json", (config) => ({ ...config, exceptions: { ...config.exceptions, ...way.exceptions } }));
  setScripts(site, { lint: gates.lint, build: gates.build });
  const taken = answer(site, ["exec", "agentic-cms", "check-site", "--baseline"]);
  const baseline = writtenBaseline(site);
  const wrong = heldOtherwise(baseline, way.expected);
  if (taken.status !== 0 || wrong.length) fail(`${way.name}: check-site --baseline answered ${taken.status}${wrong.length ? `, and wrote ${wrong.join("; ")}` : ""}: ${taken.output.trim().slice(-2500)}`);
  const build = answer(site, ["build"], CI_BUILD);
  if (build.status !== 0) fail(`${way.name}: the upgraded site's CI build failed on its baseline: ${build.output.trim().slice(-3000)}`);
  const again = answer(site, ["exec", "agentic-cms", "check-site", "--baseline"]);
  if (again.status !== 0 || !/src\/config\/components\.json unchanged/.test(again.output)) fail(`${way.name}: a second check-site --baseline answered ${again.status}, and should change nothing: ${again.output.trim().slice(-1500)}`);
  for (const [file, change] of Object.entries(UNGUARDED.grow)) edit(site, file, change);
  const grown = answer(site, ["lint"]);
  if (grown.status !== 1 || !/4 of this rule here, and the baseline \(src\/config\/components\.json\) holds 3: the baseline only shrinks/.test(grown.output)) fail(`${way.name}: one more raw link in the baselined section answered ${grown.status}, and should fail the lint naming the count: ${grown.output.trim().slice(-1500)}`);
  fs.rmSync(path.join(site, ".claude/worktrees/stale-copy"), { recursive: true, force: true });
  putBack(site, fresh, `${way.name}: `);
  console.log(`pack-smoke: ${way.name}, upgraded by the guide's § 1 with § 3.7 inside it — ${baseline.length} baseline entries, its sections' composition among them, its lint and CI build green, a second --baseline unchanged, a new finding refused`);
}

/** 5. A site without dark mode, laid out by the installed init --light-only with a name of its own: it builds as its CI runs it, lints and tests, and its pages carry no theme script. */
async function lightOnly(site, tarball) {
  const light = path.join(path.dirname(site), "light");
  run("pnpm", ["exec", "agentic-cms", "init", light, "--light-only", "--name", "Light & Co."], site);
  if (fs.existsSync(path.join(light, "src/components/ui/ThemeToggle.tsx"))) fail("init --light-only wrote the theme toggle");
  if (!fs.readFileSync(path.join(light, "src/config/site.ts"), "utf8").includes('name: "Light & Co.",') || !fs.existsSync(path.join(light, "public/images/brand/light-co-logo.svg"))) fail("init --name did not name the site in src/config/site.ts and its logo");
  const pkg = JSON.parse(fs.readFileSync(path.join(light, "package.json"), "utf8"));
  pkg.dependencies["agentic-cms"] = `file:${tarball}`;
  fs.writeFileSync(path.join(light, "package.json"), JSON.stringify(pkg, null, 2));
  await install(["--prefer-offline", "--no-frozen-lockfile"], light);
  run("pnpm", ["build"], light, CI_BUILD);
  lintsClean(light);
  run("pnpm", ["test"], light);
  const home = fs.readFileSync(path.join(light, ".next/server/app/index.html"), "utf8");
  if (/data-theme|localStorage\.getItem\(['"]theme/.test(home)) fail("the light-only site's home page still carries the theme script");
}

/** 4. The installed entries a build does not run. */
function entries(site) {
  // The standalone packaging step ships and dispatches: the example is not standalone, so it says how to make one (exit 2).
  const assemble = spawnSync("pnpm", ["exec", "agentic-cms", "assemble"], { cwd: site, encoding: "utf8" });
  if (assemble.status !== 2 || !/output: "standalone"/.test(assemble.stderr)) fail(`agentic-cms assemble answered ${assemble.status}: ${assemble.stderr.trim()}`);
  // The inline-loop pieces ship: readInlineSvg runs from the installed agentic-cms/content, InlineAnimation is compiled into the ix entry.
  fs.writeFileSync(path.join(site, "public/smoke-loop.svg"), '<svg xmlns="http://www.w3.org/2000/svg" data-rest="1"><circle id="c" r="1"/><use href="#c"/></svg>');
  const inline = node(site, 'const { readInlineSvg } = await import("agentic-cms/content"); console.log(readInlineSvg("public/smoke-loop.svg", { prefix: "smoke" }));');
  if (inline.status !== 0 || !/id="smoke-c"[\s\S]*href="#smoke-c"/.test(inline.stdout)) fail(`readInlineSvg from the tarball answered ${inline.status}: ${(inline.stderr || inline.stdout).trim()}`);
  const ix = path.join(site, "node_modules/agentic-cms/dist/ix");
  if (!fs.existsSync(path.join(ix, "InlineAnimation.js")) || !/InlineAnimation/.test(fs.readFileSync(path.join(ix, "index.js"), "utf8")) || !/InlineAnimation/.test(fs.readFileSync(path.join(ix, "index.d.ts"), "utf8"))) fail("the tarball's agentic-cms/ix lacks InlineAnimation");
  playOnceLayer(site, ix);
  // The form endpoint's server half ships: agentic-cms/forms/server, installed, validates a Request and hands it to a sink.
  const formsServer = node(site, FORMS_SMOKE);
  if (formsServer.status !== 0 || formsServer.stdout.trim() !== "200 1 1") fail(`agentic-cms/forms/server from the tarball answered ${formsServer.status}: ${(formsServer.stderr || formsServer.stdout).trim()}`);
  // The consent entries load in plain Node, as a site's own tests import them: a stored choice read, the default script built, the hooks and the tag exported — nothing of next/script or JSX on the way.
  const consentEntries = node(site, CONSENT_SMOKE);
  if (consentEntries.status !== 0 || consentEntries.stdout.trim() !== "granted true function function") fail(`agentic-cms/consent from the tarball answered ${consentEntries.status}: ${(consentEntries.stderr || consentEntries.stdout).trim()}`);
  classHelpers(site);
  componentLint(site);
}
const node = (cwd, source) => spawnSync(process.execPath, ["--input-type=module", "-e", source], { cwd, encoding: "utf8" });

/** The play-once layer is in the installed ix entry, and its plain halves run from its files in plain Node: a part's props, a stagger, the arming script. */
function playOnceLayer(site, ix) {
  const texts = ["index.js", "index.d.ts"].map((file) => fs.readFileSync(path.join(ix, file), "utf8"));
  const missing = LAYER_EXPORTS.filter((name) => texts.some((text) => !new RegExp(`\\b${name}\\b`).test(text)));
  if (missing.length) fail(`the tarball's agentic-cms/ix lacks ${missing.join(", ")}`);
  const fileUrl = (file) => JSON.stringify(pathToFileURL(path.join(ix, file)).href);
  const parts = node(site, `const { part, staggerDelay } = await import(${fileUrl("parts.js")});
const { motionScript } = await import(${fileUrl("motionScript.js")});
console.log(JSON.stringify(part("rise", 120)), staggerDelay(2, 0, 80), motionScript().includes("data-motion"));`);
  if (parts.status !== 0 || parts.stdout.trim() !== '{"data-part":"rise","style":{"--d":"120ms"}} 160ms true') fail(`the play-once layer from the tarball answered ${parts.status}: ${(parts.stderr || parts.stdout).trim()}`);
}
/** agentic-cms/cx loads in plain Node, as a site's own tests import it: cx joins, variants() picks a look and refuses an option its axis lacks, and the types name VariantProps. */
function classHelpers(site) {
  const classes = node(site, CX_SMOKE);
  if (classes.status !== 0 || classes.stdout.trim() !== 'a b|border p-8|variants: "xl" is not an option of size (md, lg)') fail(`agentic-cms/cx from the tarball answered ${classes.status}: ${(classes.stderr || classes.stdout).trim()}`);
  const types = fs.readFileSync(path.join(site, "node_modules/agentic-cms/dist/cx.d.ts"), "utf8");
  if (!/\bVariantProps\b/.test(types) || !/\bvariants\b/.test(types)) fail("the tarball's agentic-cms/cx types lack variants or VariantProps");
}
/** agentic-cms/eslint, the export the example's eslint.config.mjs imports, loads in plain Node and builds the component configs, a missing layer allowed. */
function componentLint(site) {
  const lint = node(site, ESLINT_SMOKE);
  if (lint.status !== 0 || lint.stdout.trim() !== "true true") fail(`agentic-cms/eslint from the tarball answered ${lint.status}: ${(lint.stderr || lint.stdout).trim()}`);
}
const ESLINT_SMOKE = `const { componentRules } = await import("agentic-cms/eslint");
const configs = componentRules({ motion: null, patterns: null });
console.log(configs.length > 0, configs.some((config) => Boolean(config.rules?.["react/forbid-elements"])));`;
const CX_SMOKE = `const { cx, variants } = await import("agentic-cms/cx");
const box = variants({ base: "border", variants: { size: { md: "p-4", lg: "p-8" } }, defaults: { size: "md" } });
let refused = "";
try { box({ size: "xl" }); } catch (error) { refused = error.message; }
console.log([cx("a", false, "b"), box({ size: "lg" }), refused].join("|"));`;
const LAYER_EXPORTS = ["Reveal", "RevealGroup", "Sequence", "part", "staggerDelay", "useMotionRoot", "motionScript"];
const FORMS_SMOKE = `const { createFormHandler } = await import("agentic-cms/forms/server");
const received = [];
const form = { id: "f", name: "F", items: [{ type: "email", name: "email", label: "E-mail", required: true }], submit: { label: "s", waitLabel: "w" }, messages: { success: "y", error: "n" }, backend: { kind: "endpoint", url: "/api/forms/f" } };
const handle = createFormHandler({ forms: { f: form }, sink: { deliver: async (submission) => { received.push(submission); } } });
const response = await handle(new Request("https://acme.example/api/forms/f", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: { email: "hello@acme.example" } }) }), "f");
console.log(response.status, received.length, received[0]?.version);`;
const CONSENT_SMOKE = `const consent = await import("agentic-cms/consent");
const google = await import("agentic-cms/consent/google");
const policy = { storageKey: "consent", version: 1, maxAgeDays: 365 };
const choice = consent.readChoice({ getItem: () => JSON.stringify({ analytics: "granted", at: new Date(Date.now() - 1000).toISOString(), version: 1 }) }, policy); // a second old: a choice stamped after readChoice reads its clock is from the future and refused
console.log(choice?.analytics, google.consentDefaultScript(policy).includes('"consent","default"'), typeof consent.useConsent, typeof google.GoogleTag);`;

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-smoke-"));
  const site = path.join(scratch, "site");
  const { tarball, size } = pack(scratch);
  layOut(scratch, site, tarball);
  await build(site);
  entries(site);
  await lightOnly(site, tarball);
  console.log(`pack-smoke: the package builds a site from the starter — its production build refused until its placeholders are replaced — and a light-only one, from the tarball (${path.basename(tarball)}, ${(size / 1024).toFixed(0)} KB)`);
  if (process.argv.includes("--keep")) console.log(`pack-smoke: scratch site kept at ${site}`);
  else fs.rmSync(scratch, { recursive: true, force: true });
}
