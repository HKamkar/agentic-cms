// The scaffold behind `agentic-cms init`: a site laid out from the package's
// own files — the wireframe example's code (its app, components, config and
// styles), the starter in place of the example's content (lib/starter.mjs: one
// home page and the blog index with their copy marked as placeholder, empty
// collections, the wireframe's neutral pictures, the site's name — required,
// the owner's — where the example says its own), the agent files (lib/agent-files.mjs: thin
// rules, Codex stubs, the kit's plugins named in the Claude settings), the
// site templates (AGENTS.md, CLAUDE.md, README, PLAN, the Next
// config, the Claude settings, .gitignore, the CI workflow, the setup
// script that installs what a package cannot install for itself) and the
// generated config (package.json, tsconfig.json, pnpm-workspace.yaml).
// Nothing of the package's source, and nothing of the example's content. Existing
// files are kept unless forced, and a site's own (its content, its pictures,
// its brand and forms config) even then: the starter and a site's own files
// go only into a new site, one with no content/ yet;
// package.json and pnpm-workspace.yaml are merged, forced or not, so what
// `pnpm init` or an older install left there cannot stop the first install
// or the first test; the gates (lib/gates.mjs) go into the site's own `lint`
// and `build` — the lint ESLint then `check-site`, the build `pnpm lint`
// first and the SEO audit after `next build` (the e-mail guard joins them
// once lib/gates.mjs turns it on) — or init
// refuses, before anything is written, naming what to add: they are never
// dropped. The agent files and their manifest (.agentic-cms.json) are
// lib/agent-files.mjs's, a site laid out before 0.9.0 moved first. With
// lightOnly the site is laid out without dark mode (lib/light-only.mjs),
// every edit made before the first file is written.
import fs from "node:fs";
import path from "node:path";
import { isMap, parseDocument, Scalar } from "yaml";
import { walk } from "./agent-file-record.mjs";
import { agentFiles } from "./agent-files.mjs";
import { buildScript, GatesError, guardsEmail, LINT, mergeBuild, mergeLint } from "./gates.mjs";
import { editsText, lightOnlyFile } from "./light-only.mjs";
import { isSiteOwn, KIT_ONLY, siteCode, siteIdentity, starterFiles, starterMarkdown } from "./starter.mjs";

/** The example's code, copied as it is but where the starter has a file of its own (lib/starter.mjs): the content and the pictures are the starter's. */
export const EXAMPLE = ["src/app", "src/components", "src/config", "src/styles", "src/kit.ts", "postcss.config.mjs", "eslint.config.mjs", ".env.example", ".nvmrc"];
/** The templates under templates/site/, and where each lands. */
export const TEMPLATES = { "AGENTS.md": "AGENTS.md", "CLAUDE.md": "CLAUDE.md", "README.md": "README.md", "PLAN.md": "PLAN.md", "next.config.ts": "next.config.ts", "settings.json": ".claude/settings.json", "gitignore": ".gitignore", "verify.yml": ".github/workflows/verify.yml", "dependabot.yml": ".github/dependabot.yml", "setup.sh": "scripts/setup.sh" };
export { GatesError, LINT };
export { ADOPTED_BY, adopted, agentFiles, kitPath, MANIFEST, readManifest, SETTINGS } from "./agent-files.mjs";
export { AGENT_DIRS, readReleases, RELEASES, renderAgentFiles, sha } from "./agent-file-record.mjs";
const STANDARD_NOTE = "> This is the wireframe's standard, as `agentic-cms init` scaffolded it: the `design` skill replaces its tokens, components and motion as the site's own look lands, and §8 collects the site's own decisions.\n";

const readText = (full) => (fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null);

/** Writes one file: created, updated (force) or kept. */
function put(target, file, text, { force, result, log }) {
  const full = path.join(target, file);
  const exists = fs.existsSync(full);
  if (exists && !force) { result.kept.push(file); return "kept"; }
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
  (exists ? result.updated : result.created).push(file);
  log(`${exists ? "updated" : "created"}  ${file}`);
  return exists ? "updated" : "created";
}

/** The example's files under one entry: the entry itself when it is a file. */
const filesOf = (kitRoot, entry) => (fs.statSync(path.join(kitRoot, entry)).isFile() ? [entry] : walk(path.join(kitRoot, entry)).map((rel) => `${entry}/${rel}`));

/**
 * Every file the scaffold lays out from the kit, by the path it lands at: the
 * example's code (but the kit's own lines, KIT_ONLY), then, for a new site
 * (its `identity`), the starter over it —
 * a site that has content/ gets none of it and none of a site's own files —
 * then STANDARD.md, its passages on the example's own pages in the starter's
 * words.
 */
function sitePlan(kitRoot, identity, { standard }) {
  const plan = new Map(EXAMPLE.flatMap((entry) => filesOf(kitRoot, entry)).filter((file) => identity || !isSiteOwn(file)).map((file) => [file, fs.readFileSync(path.join(kitRoot, file))]));
  for (const file of Object.keys(KIT_ONLY)) if (plan.has(file)) plan.set(file, siteCode(file, plan.get(file).toString("utf8")));
  if (identity) for (const [file, text] of starterFiles(kitRoot, identity)) plan.set(file, text);
  plan.set("STANDARD.md", starterMarkdown(standard, "STANDARD.md"));
  return plan;
}

/** The plan without dark mode: each text file edited, a file a light-only site does not get left out. Throws a LightOnlyError, before anything is written, when an edit misses. */
function lightOnlyPlan(plan) {
  for (const [file, text] of plan) {
    if (!editsText(file)) continue;
    const out = lightOnlyFile(file, text.toString("utf8"));
    if (out === null) plan.delete(file);
    else plan.set(file, out);
  }
  return plan;
}

const kitPackage = (kitRoot) => JSON.parse(fs.readFileSync(path.join(kitRoot, "package.json"), "utf8"));

/** What `pnpm init` (and `npm init`) write as the test script: a test run that always fails. */
const PLACEHOLDER_TEST = 'echo "Error: no test specified" && exit 1';

/** The site's package.json: written, or merged into an existing one (its name, scripts and dependencies win, but for `pnpm init`'s placeholders and the gates its lint and build take in); `notes` says what changed. Throws a GatesError for a lint or a build the gates cannot go into. */
function sitePackage(target, { kitRoot, version, guard }) {
  const kit = kitPackage(kitRoot);
  const dev = kit.devDependencies;
  const wanted = {
    name: path.basename(path.resolve(target)).toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    private: true,
    type: "module",
    engines: kit.engines,
    packageManager: kit.packageManager,
    scripts: { dev: "next dev -p 8000", build: buildScript({ guard }), start: "next start -p 8000", lint: LINT, test: 'node --import agentic-cms/loader --test "src/**/*.test.ts"', "content:check": "agentic-cms check", "content:lint": "agentic-cms lint", "content:status": "agentic-cms status", "content:docs": "agentic-cms docs", urls: "agentic-cms urls", kit: "agentic-cms" },
    dependencies: { "agentic-cms": `github:HKamkar/agentic-cms#v${version}`, motion: dev.motion, next: dev.next, react: dev.react, "react-dom": dev["react-dom"], zod: dev.zod },
    devDependencies: { "@tailwindcss/postcss": dev["@tailwindcss/postcss"], "@types/node": dev["@types/node"], "@types/react": dev["@types/react"], "@types/react-dom": dev["@types/react-dom"], eslint: dev.eslint, "eslint-config-next": dev["eslint-config-next"], "playwright-core": dev["playwright-core"], postcss: dev.postcss, tailwindcss: dev.tailwindcss, typescript: dev.typescript },
  };
  const file = path.join(target, "package.json");
  if (!fs.existsSync(file)) return { text: JSON.stringify(wanted, null, 2) + "\n", merged: false };
  const existing = JSON.parse(fs.readFileSync(file, "utf8"));
  const merged = { ...wanted, ...existing, scripts: { ...wanted.scripts, ...existing.scripts }, dependencies: { ...wanted.dependencies, ...existing.dependencies }, devDependencies: { ...wanted.devDependencies, ...existing.devDependencies } };
  const notes = [...dropPlaceholders(merged, { target, test: wanted.scripts.test }), ...mergeGates(merged.scripts, existing.scripts ?? {}, { guard })];
  return { text: JSON.stringify(merged, null, 2) + "\n", merged: true, notes };
}

/** The gates into the site's own lint and build (lib/gates.mjs), in place; the notes say what went in. Throws a GatesError naming what to add. */
function mergeGates(scripts, own, { guard }) {
  const lint = mergeLint(own.lint);
  const build = mergeBuild(own.build, { guard });
  scripts.lint = lint.script;
  scripts.build = build.script;
  return [lint.note, build.note].filter(Boolean);
}

/** The text src/config/site.ts will have once the site is laid out: the site's own where it has one (never overwritten), else the starter's. */
const siteConfigText = (target, plan) => readText(path.join(target, "src/config/site.ts")) ?? plan.get("src/config/site.ts")?.toString("utf8") ?? "";

/** `pnpm init`'s two placeholders lose to the kit: its failing test script, and `main` naming an index.js that is not there. Its license, version, devEngines and packageManager stay. */
function dropPlaceholders(merged, { target, test }) {
  const notes = [];
  if (merged.scripts.test?.trim() === PLACEHOLDER_TEST) { merged.scripts.test = test; notes.push("the kit's test script in place of pnpm init's placeholder"); }
  if (merged.main === "index.js" && !fs.existsSync(path.join(target, "index.js"))) { delete merged.main; notes.push('pnpm init\'s main: "index.js" dropped'); }
  return notes;
}

function siteTsconfig(kitRoot) {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(kitRoot, "tsconfig.json"), "utf8"));
  tsconfig.compilerOptions.paths = { "@/*": ["./src/*"] };
  tsconfig.exclude = ["node_modules"];
  return JSON.stringify(tsconfig, null, 2) + "\n";
}

/** The builds a site's install runs: the kit's prepare (its dist/), sharp, and eslint-config-next's resolver. */
export const ALLOW_BUILDS = ["agentic-cms@git+https://github.com/HKamkar/agentic-cms.git", "sharp", "unrs-resolver"];
const plainName = (name) => /^[\w.-]+$/.test(name);
const WORKSPACE = `# pnpm settings. The git dependency builds its dist/ on install (prepare), which pnpm runs only when allowed here.
allowBuilds:
${ALLOW_BUILDS.map((name) => `  ${plainName(name) ? name : JSON.stringify(name)}: true\n`).join("")}`;

/**
 * The site's pnpm-workspace.yaml merged with the kit's: the allowBuilds keys it
 * lacks added as true, the names of a legacy onlyBuiltDependencies list (which
 * pnpm 11 and later no longer read) carried over with them, and every other key,
 * value and comment left as the site wrote it. { text, added }, or null when
 * nothing is missing or the file is not a map pnpm could read either.
 */
export function mergeWorkspace(text) {
  const doc = parseDocument(text);
  if (doc.errors.length || !(doc.contents === null || isMap(doc.contents))) return null;
  if (!isMap(doc.get("allowBuilds"))) {
    if (doc.get("allowBuilds") != null) return null;
    doc.set("allowBuilds", doc.createNode({}));
  }
  const allow = doc.get("allowBuilds");
  const legacy = doc.toJS()?.onlyBuiltDependencies;
  const wanted = [...new Set([...ALLOW_BUILDS, ...(Array.isArray(legacy) ? legacy.map(String) : [])])];
  const added = wanted.filter((name) => !allow.has(name));
  if (!added.length) return null;
  for (const name of added) allow.set(quotedKey(doc, name), true);
  return { text: doc.toString(), added };
}

/** A key past a plain package name (a git spec) is double-quoted, as the kit's own workspace writes it. */
function quotedKey(doc, name) {
  const key = doc.createNode(name);
  if (!plainName(name)) key.type = Scalar.QUOTE_DOUBLE;
  return key;
}

/** Writes pnpm-workspace.yaml, or merges the kit's keys into an existing one (with --force too: a site's settings are never replaced). */
function putWorkspace(target, { result, log }) {
  const file = path.join(target, "pnpm-workspace.yaml");
  if (!fs.existsSync(file)) return put(target, "pnpm-workspace.yaml", WORKSPACE, { result, log });
  const merged = mergeWorkspace(fs.readFileSync(file, "utf8"));
  if (!merged) { result.kept.push("pnpm-workspace.yaml"); return "kept"; }
  fs.writeFileSync(file, merged.text);
  result.updated.push("pnpm-workspace.yaml");
  log(`merged   pnpm-workspace.yaml (allowBuilds: ${merged.added.join(", ")})`);
  return "merged";
}

/**
 * Lays the site out under target — a new site (no content/ yet) named `name`,
 * which it requires, at `url` with `email` (default: stand-ins on a reserved
 * domain); a site that has content/ without the starter, its own files left
 * alone and no name asked — with lightOnly as a site without dark mode;
 * { created, updated, kept, lightOnly, site: { name, url, email, starter:
 * true } | { starter: false } }. Throws a StarterError (a new site without
 * its name, a name, a URL or an address it cannot use), a LightOnlyError or
 * a GatesError (a site's own lint or build the gates cannot go into) before
 * anything is written.
 */
export function scaffold(target, { kitRoot, version, force = false, lightOnly = false, name, url, email, now, log = console.log }) {
  const fresh = !fs.existsSync(path.join(target, "content"));
  const identity = fresh ? siteIdentity(target, { name, url, email, now }) : null;
  const result = { created: [], updated: [], kept: [], lightOnly, site: identity ? { name: identity.name, url: identity.url, email: identity.email, starter: true } : { starter: false } };
  const opts = { force, result, log };
  const standard = fs.readFileSync(path.join(kitRoot, "STANDARD.md"), "utf8").replace(/^(# .*\n)/, `$1\n${STANDARD_NOTE}`);
  const plan = sitePlan(kitRoot, identity, { standard });
  if (lightOnly) lightOnlyPlan(plan);
  const pkg = sitePackage(target, { kitRoot, version, guard: guardsEmail(siteConfigText(target, plan)) });
  fs.mkdirSync(target, { recursive: true });
  for (const [file, text] of plan) put(target, file, text, { ...opts, force: force && !isSiteOwn(file) });
  for (const [from, to] of Object.entries(TEMPLATES)) put(target, to, fs.readFileSync(path.join(kitRoot, "templates/site", from), "utf8"), opts);
  if (pkg.merged) { fs.writeFileSync(path.join(target, "package.json"), pkg.text); result.updated.push("package.json"); log(`merged   package.json${pkg.notes.length ? ` (${pkg.notes.join("; ")})` : ""}`); } else put(target, "package.json", pkg.text, opts);
  put(target, "tsconfig.json", siteTsconfig(kitRoot), opts);
  putWorkspace(target, opts);
  agentFiles(target, { kitRoot, version, force, log, result });
  return result;
}
