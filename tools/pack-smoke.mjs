#!/usr/bin/env node
// Proves the package as a site sees it, which the checkout never does (the
// example resolves the package's name to the source): packs the package,
// and in a scratch folder that holds what the old install docs left there
// (`pnpm init`'s package.json and the workspace snippet without
// unrs-resolver), runs the install line of docs/init.md as it is written,
// the tarball standing in for the git spec. Then it installs the site's
// dependencies and runs its build — the content lint, the field-table check,
// next build and the SEO audit — its lint (ESLint, then the component
// guard, which a planted stray section file fails) and its tests through the
// installed command line; then checks the agent files are as shipped, the
// installed entries a build does not run (the inline loop, the play-once
// layer, the form endpoint's server half, the consent entries, the class
// helpers and the component lint in plain Node) and the tarball's size;
// last, a second site laid out by the installed `init --light-only` builds,
// lints and tests too, with no theme script in its pages. Exit 1 on the
// first failure.
//
//   pnpm test:pack           (a few minutes: two installs and a build)
//   pnpm test:pack --keep    leaves the scratch site behind and prints where
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

/** The documented install line (`pnpm dlx … agentic-cms@github:…#v<version> init my-site`) as pnpm's arguments, with the package spec and the folder swapped; null when the doc has no such line. */
export function documentedInstall(doc, { spec, dir }) {
  const line = doc.match(/^pnpm dlx [^\n]*agentic-cms@github:HKamkar\/agentic-cms#v[\d.]+ init my-site$/m)?.[0];
  if (!line) return null;
  return line.split(/\s+/).slice(1).map((arg) => (arg.startsWith("agentic-cms@github:") ? `agentic-cms@${spec}` : arg === "my-site" ? dir : arg));
}

/** What `pnpm init` writes, at the pnpm running the smoke (a newer one would be downloaded through devEngines). */
export const pnpmInitPackage = (name, pnpm) => ({ name, version: "1.0.0", description: "", main: "index.js", scripts: { test: 'echo "Error: no test specified" && exit 1' }, keywords: [], author: "", license: "ISC", devEngines: { packageManager: { name: "pnpm", version: pnpm, onFail: "download" } }, packageManager: `pnpm@${pnpm}`, type: "module" });
/** The workspace docs/init.md had a site write by hand up to 0.7.6: without unrs-resolver, which stopped the install after init at ERR_PNPM_IGNORED_BUILDS. */
export const OLD_WORKSPACE = 'allowBuilds:\n  "agentic-cms@git+https://github.com/HKamkar/agentic-cms.git": true\n  sharp: true\n';

const fail = (message) => { console.error(`pack-smoke: ${message}`); process.exit(1); };
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env: ENV });
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
  if (!dlx) fail("docs/init.md has no `pnpm dlx … init my-site` install line to run");
  run("pnpm", dlx, scratch);
  const pkg = JSON.parse(fs.readFileSync(path.join(site, "package.json"), "utf8"));
  if (pkg.scripts.test.includes("no test specified") || "main" in pkg) fail("init kept pnpm init's placeholder test or its main");
  if (!/^ {2}unrs-resolver: true$/m.test(fs.readFileSync(path.join(site, "pnpm-workspace.yaml"), "utf8"))) fail("init left pnpm-workspace.yaml without unrs-resolver");
  pkg.dependencies["agentic-cms"] = `file:${tarball}`;
  fs.writeFileSync(path.join(site, "package.json"), JSON.stringify(pkg, null, 2));
}

/** 3. The site's dependencies (no lockfile yet), the files the tarball must ship, then the build, the lint, the tests and the agent files through the installed command line. */
async function build(site) {
  await install(["--prefer-offline", "--no-frozen-lockfile"], site);
  for (const shipped of ["templates/site/AGENTS.md", "templates/site/verify.yml", ".claude/skills/design/SKILL.md", ".agents/skills/design/SKILL.md", "scripts/lib/agent-file-releases.json", "content/pages/home.yaml", "docs/commands.md"]) {
    if (!fs.existsSync(path.join(site, "node_modules/agentic-cms", shipped))) fail(`the tarball lacks ${shipped} (package.json files)`);
  }
  run("pnpm", ["build"], site);
  run("pnpm", ["lint"], site);
  guardFails(site);
  run("pnpm", ["test"], site);
  run("pnpm", ["exec", "agentic-cms", "init", ".", "--agent-files", "--check"], site);
}

/** The site's lint runs the installed guard after ESLint: the components rule came with the guard's config, and a section file the registry does not import fails the lint though ESLint passes it. */
function guardFails(site) {
  const { lint } = JSON.parse(fs.readFileSync(path.join(site, "package.json"), "utf8")).scripts;
  if (!/; agentic-cms check-components \|\| s=1; exit \$s$/.test(lint)) fail(`the site's lint does not run the guard after ESLint: ${lint}`);
  if (!fs.existsSync(path.join(site, "src/config/components.json")) || !fs.existsSync(path.join(site, ".claude/rules/components.md"))) fail("init wrote the guard's config without the components rule, or neither");
  const stray = path.join(site, "src/components/sections/Stray.tsx");
  fs.writeFileSync(stray, "export function Stray() {\n  return null;\n}\n");
  const result = spawnSync("pnpm", ["lint"], { cwd: site, encoding: "utf8", env: ENV });
  fs.rmSync(stray);
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 1 || !/✗ src\/components\/sections\/Stray\.tsx {2}\[registry\]/.test(output)) fail(`pnpm lint with a stray section file answered ${result.status}: ${output.trim().slice(-600)}`);
}

/** 5. A site without dark mode, laid out by the installed init --light-only: it builds, lints and tests, and its pages carry no theme script. */
async function lightOnly(site, tarball) {
  const light = path.join(path.dirname(site), "light");
  run("pnpm", ["exec", "agentic-cms", "init", light, "--light-only"], site);
  if (fs.existsSync(path.join(light, "src/components/ui/ThemeToggle.tsx"))) fail("init --light-only wrote the theme toggle");
  const pkg = JSON.parse(fs.readFileSync(path.join(light, "package.json"), "utf8"));
  pkg.dependencies["agentic-cms"] = `file:${tarball}`;
  fs.writeFileSync(path.join(light, "package.json"), JSON.stringify(pkg, null, 2));
  await install(["--prefer-offline", "--no-frozen-lockfile"], light);
  run("pnpm", ["build"], light);
  run("pnpm", ["lint"], light);
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
const choice = consent.readChoice({ getItem: () => JSON.stringify({ analytics: "granted", at: new Date().toISOString(), version: 1 }) }, policy);
console.log(choice?.analytics, google.consentDefaultScript(policy).includes('"consent","default"'), typeof consent.useConsent, typeof google.GoogleTag);`;

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-smoke-"));
  const site = path.join(scratch, "site");
  const { tarball, size } = pack(scratch);
  layOut(scratch, site, tarball);
  await build(site);
  entries(site);
  await lightOnly(site, tarball);
  console.log(`pack-smoke: the package builds a site, and a light-only one, from the tarball (${path.basename(tarball)}, ${(size / 1024).toFixed(0)} KB)`);
  if (process.argv.includes("--keep")) console.log(`pack-smoke: scratch site kept at ${site}`);
  else fs.rmSync(scratch, { recursive: true, force: true });
}
