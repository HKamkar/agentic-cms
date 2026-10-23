// The scaffold behind `agentic-cms init`: a site laid out from the package's
// own files — the wireframe example's code (its app, components, config and
// styles), the starter in place of the example's content (lib/starter.mjs: one
// home page and the blog index with their copy marked as placeholder, empty
// collections, the wireframe's neutral pictures, the site's name — required,
// the owner's — where the example says its own), the agent files (a site's path-scoped rules from
// templates/site/rules/, the design skills for Claude Code and Codex), the
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
// dropped. A manifest (.agentic-cms.json) records each agent file's
// base — the hash of the kit's text the site last took, written or accepted
// after a hand merge — with the kit's version and, for a pin between
// releases, its commit; so `init --agent-files --check` can tell a site's own
// edit (never clobbered) from a file the kit has since updated, and an edit
// of the kit's current text from one the kit has moved past. The text of the
// base of each file the site edited, and of each base no release of the kit
// holds (a pin between releases), is kept beside it (.agentic-cms/base/),
// recovered from the kit's releases or the site's git history for a manifest
// older than the copies, so `--diff` prints the kit's change alone, even for
// a file the site edits before it commits the kit's text. A file
// the manifest records no base for (the site wrote it first) takes its base
// from the kit's releases (RELEASES, every release's text of every agent
// file): the release whose text it is, else the kit's text at the version
// the site was on. A block the kit marks required in a rule or a skill
// (lib/agent-required.mjs) stays in a site's edit of it, and the site's
// .claude/settings.json keeps the editorial plugin enabled: `--check` fails
// either, naming what is gone, and a refresh writes the settings when they
// are missing but never rewrites a site's own. A rule for a
// tool a site adopts (the components rule, for the component guard) is
// written and checked only where the site has that tool's config. The site's
// AGENTS.md is its own, but for one block: the scoped-rules table Codex
// needs to find .claude/rules/ (lib/rules-table.mjs), written from the
// site's rules as they stand, and measured against Codex's 32 KiB. With
// lightOnly the site is laid out without dark mode (lib/light-only.mjs),
// every edit made before the first file is written.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isMap, parseDocument, Scalar } from "yaml";
import { requiredGone, settingsGone } from "./agent-required.mjs";
import { buildScript, GatesError, guardsEmail, LINT, mergeBuild, mergeLint } from "./gates.mjs";
import { editsText, lightOnlyFile } from "./light-only.mjs";
import { codexSize, placeBlock, readRules, rulesBlock } from "./rules-table.mjs";
import { isSiteOwn, KIT_ONLY, siteCode, siteIdentity, starterFiles, starterMarkdown } from "./starter.mjs";
import { unifiedDiff } from "./unified-diff.mjs";

/** The example's code, copied as it is but where the starter has a file of its own (lib/starter.mjs): the content and the pictures are the starter's. */
export const EXAMPLE = ["src/app", "src/components", "src/config", "src/styles", "src/kit.ts", "postcss.config.mjs", "eslint.config.mjs", ".env.example", ".nvmrc"];
/** The templates under templates/site/, and where each lands. */
export const TEMPLATES = { "AGENTS.md": "AGENTS.md", "CLAUDE.md": "CLAUDE.md", "README.md": "README.md", "PLAN.md": "PLAN.md", "next.config.ts": "next.config.ts", "settings.json": ".claude/settings.json", "gitignore": ".gitignore", "verify.yml": ".github/workflows/verify.yml", "dependabot.yml": ".github/dependabot.yml", "setup.sh": "scripts/setup.sh" };
/** The agent files the manifest tracks: the site's rules (templates/site/rules/) and the two skills trees. */
export const AGENT_DIRS = { "templates/site/rules": ".claude/rules", ".claude/skills": ".claude/skills", ".agents/skills": ".agents/skills" };
/**
 * The agent files that describe a tool a site adopts, each with the file
 * that adopts it: written and checked only where the site has that file, so
 * nothing the kit writes describes a tool the site has not taken up (a site
 * from 0.7.6 is neither given the components rule nor told it is missing).
 */
export const ADOPTED_BY = { ".claude/rules/components.md": "src/config/components.json" };
export { GatesError, LINT };
export const MANIFEST = ".agentic-cms.json";
/** The site's Claude Code settings: the site's own file, which must keep the editorial plugin its template enables. */
export const SETTINGS = TEMPLATES["settings.json"];
/** The base copies: for each agent file the site edited, the kit's text it was last taken from, kept beside the manifest for `--diff`. */
export const BASES = ".agentic-cms/base";
/** A file's base copy: its path under BASES without the leading dot, so no agent takes the copies for the site's own rules and skills. */
export const basePath = (file) => `${BASES}/${file.replace(/^\./, "")}`;
/** The kit's agent files at every release, written from its tags by tools/agent-file-releases.mjs: { versions: { <version>: { <file>: <hash> } }, texts: { <hash>: <text> } }, the versions oldest first. */
export const RELEASES = "scripts/lib/agent-file-releases.json";
/** A file named by --diff or --accept that is not one of the site's agent files, or a base nothing holds: exit 2. */
export class AgentFileError extends Error {}
const STANDARD_NOTE = "> This is the wireframe's standard, as `agentic-cms init` scaffolded it: the `design` skill replaces its tokens, components and motion as the site's own look lands, and §8 collects the site's own decisions.\n";
/** A text as the manifest records it. */
export const sha = (text) => `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
const walk = (dir, base = dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")])) : []);

/** Every agent file the kit provides for a site: { file, text }. */
export function renderAgentFiles(kitRoot) {
  const out = [];
  for (const [from, to] of Object.entries(AGENT_DIRS)) {
    for (const rel of walk(path.join(kitRoot, from))) out.push({ file: `${to}/${rel}`, text: fs.readFileSync(path.join(kitRoot, from, rel), "utf8") });
  }
  return out;
}

const readText = (full) => (fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null);

export const readManifest = (target) => { try { return JSON.parse(fs.readFileSync(path.join(target, MANIFEST), "utf8")); } catch { return { version: null, files: {} }; } };
export const writeManifest = (target, manifest) => fs.writeFileSync(path.join(target, MANIFEST), JSON.stringify(manifest, null, 1) + "\n");

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
/** The running kit's version; undefined for a kit without a package.json. */
const kitVersion = (kitRoot) => { try { return kitPackage(kitRoot).version; } catch { return undefined; } };

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

/** Whether the site has adopted what an agent file describes: always, unless ADOPTED_BY names a file the site lacks. */
export const adopted = (target, file) => !ADOPTED_BY[file] || fs.existsSync(path.join(target, ADOPTED_BY[file]));

/** The kit's text of every agent file this site takes, by file. */
const siteAgentFiles = (target, kitRoot) => new Map(renderAgentFiles(kitRoot).filter(({ file }) => adopted(target, file)).map(({ file, text }) => [file, text]));

/**
 * An agent file against the kit's text (`current`) and its base (the hash of
 * the kit's text the site last took): missing; ok, the kit's text; stale, the
 * base untouched while the kit moved on; modified, the site's edit of the
 * kit's current text; "modified, kit changed", the site's edit of a text the
 * kit has changed since — or of none, for a file the site wrote before the
 * manifest recorded a base and whose source the kit's releases do not know.
 */
export function statusOf(onDisk, base, current) {
  if (onDisk === null) return "missing";
  const hash = sha(onDisk);
  if (hash === current) return "ok";
  if (base && hash === base) return "stale";
  return base === current ? "modified" : "modified, kit changed";
}

/** Writes the agent files (a site's own edit is kept, "kept, kit changed" when the kit changed since its base), or with `check` reports each by statusOf(), with a note for a file the manifest has no base for; a file for a tool the site has not adopted is neither. */
export function agentFiles(target, { kitRoot, version, check = false, force = false, log = console.log, result = { created: [], updated: [], kept: [] } }) {
  const releases = readReleases(kitRoot);
  const baseFor = basesOf(target, readManifest(target), { releases, version });
  const report = [];
  const bases = {};
  for (const [file, text] of siteAgentFiles(target, kitRoot)) {
    const onDisk = readText(path.join(target, file));
    const { status, base, note, required } = withRequired(measure(onDisk, sha(text), baseFor(file, onDisk)), onDisk, text);
    const entry = (shown) => ({ file, status: shown, ...(note && { note }), ...(required && { required }) });
    if (check) { report.push(entry(status)); continue; }
    if (status.startsWith("modified") && !force) { report.push(entry(status.replace("modified", "kept"))); result.kept.push(file); if (base) bases[file] = base; continue; }
    bases[file] = sha(text);
    report.push(entry(status === "ok" ? "ok" : put(target, file, text, { force: true, result, log })));
  }
  report.push(...settingsFile(target, kitRoot, { check, log, result }));
  report.push(...agentsMd(target, { check, log, result }));
  if (!check) { writeManifest(target, { version, commit: kitCommit(target, kitRoot), files: bases }); keepBaseCopies(target, bases, releases); }
  return report;
}

/** The kit's releases record (RELEASES); an empty one for a kit without it. */
export const readReleases = (kitRoot) => { try { return JSON.parse(fs.readFileSync(path.join(kitRoot, RELEASES), "utf8")); } catch { return { versions: {}, texts: {} }; } };

/** The newest release whose text of `file` hashes to `hash`; undefined when none. */
const releaseOf = (releases, file, hash) => Object.keys(releases.versions).reverse().find((version) => releases.versions[version][file] === hash);

/**
 * A file's base, by file and its text on disk: the manifest's; for a file it
 * records none for, the release whose text the file is (`exact`), else the
 * kit's text at the version the site was on (siteVersion()), which the file
 * is taken to come from; else none. { base, release?, exact?, recorded? },
 * base null when nothing is known.
 */
function basesOf(target, manifest, { releases, version }) {
  let was;
  return (file, onDisk) => {
    if (manifest.files[file]) return { base: manifest.files[file], recorded: true };
    if (onDisk === null) return { base: null };
    const exact = releaseOf(releases, file, sha(onDisk));
    if (exact) return { base: sha(onDisk), release: exact, exact: true };
    if (was === undefined) was = siteVersion(target, manifest, version) ?? null;
    const base = was && releases.versions[was]?.[file];
    return base ? { base, release: was } : { base: null };
  };
}

/** An agent file against the kit's text (`current`) and the base basesOf() found for it: { status, base, note }, the note saying where a base the manifest lacks came from. */
function measure(onDisk, current, { base, release, exact, recorded }) {
  const status = statusOf(onDisk, base, current);
  if (recorded || status === "ok" || status === "missing") return { status, base };
  if (!base) return { status, base, note: "no base, and no release of the kit found as its source: --diff is the site's whole file" };
  if (exact) return { status, base, note: `no base: the kit's text at ${release}` };
  return { status, base, note: status === "modified" ? `no base: kit unchanged since ${release}` : `no base: from the kit's text at ${release}, the version the site was on` };
}

/**
 * A site's edit of the kit's current text (modified) that lost a block the
 * kit marks required: "modified, required gone", with the blocks. A file the
 * kit changed since its base is left as it is: the merge brings the kit's
 * text, and the check reads the blocks once the site accepts it.
 */
function withRequired(measured, onDisk, kitText) {
  if (measured.status !== "modified") return measured;
  const required = requiredGone(onDisk, kitText);
  return required.length ? { ...measured, status: "modified, required gone", required } : measured;
}

/**
 * The site's .claude/settings.json against the kit's template: missing (a
 * refresh writes the template), unreadable, "modified, required gone" (a
 * refresh keeps it: "kept, required gone"), else ok; none for a kit without
 * the template. A site's own settings are never rewritten.
 */
function settingsFile(target, kitRoot, { check, log, result }) {
  const kitText = readText(path.join(kitRoot, "templates/site/settings.json"));
  if (kitText === null) return [];
  const onDisk = readText(path.join(target, SETTINGS));
  if (onDisk === null) return [{ file: SETTINGS, status: check ? "missing" : put(target, SETTINGS, kitText, { force: false, result, log }) }];
  let settings;
  try { settings = JSON.parse(onDisk); } catch { return [{ file: SETTINGS, status: "unreadable" }]; }
  const required = settingsGone(settings, JSON.parse(kitText));
  if (!required.length) return [{ file: SETTINGS, status: "ok" }];
  return [{ file: SETTINGS, status: check ? "modified, required gone" : "kept, required gone", required }];
}

/**
 * The kit version a site was on before the one running: the manifest's,
 * unless a refresh with the running version wrote it, else the newest other
 * version the site's package.json named in its git history; undefined when
 * neither says.
 */
export function siteVersion(target, manifest, version) {
  if (manifest.version && manifest.version !== version) return manifest.version;
  for (const { text } of gitTexts(target, "package.json")) {
    const named = kitSpecVersion(text);
    if (named && named !== version) return named;
  }
  return undefined;
}

/** The x.y.z of the agentic-cms dependency a package.json names (`github:HKamkar/agentic-cms#v0.7.6`, `^0.7.6`); undefined for none or a commit pin. */
function kitSpecVersion(text) {
  try {
    const pkg = JSON.parse(text);
    return (pkg.dependencies?.["agentic-cms"] ?? pkg.devDependencies?.["agentic-cms"])?.match(/\d+\.\d+\.\d+/)?.[0];
  } catch { return undefined; }
}

/** Each committed text of a file in the site's git history, newest first: { commit, text }; none outside a repository. */
function* gitTexts(target, file) {
  const git = (...args) => spawnSync("git", args, { cwd: target, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const log = git("log", "--format=%H", "--", file);
  if (log.status !== 0) return;
  for (const commit of log.stdout.split("\n").filter(Boolean)) {
    const show = git("show", `${commit}:./${file}`);
    if (show.status === 0) yield { commit, text: show.stdout };
  }
}

/**
 * The kit commit a site installed, from its lockfile, when the kit running is
 * the one its node_modules links: a pin between releases (the release gate's
 * candidate) carries the last release's version, so the commit says which
 * text the bases are. undefined for a kit run from elsewhere, or a lockfile
 * that names no commit (a tarball, a registry).
 */
export function kitCommit(target, kitRoot) {
  try { if (fs.realpathSync(path.join(target, "node_modules/agentic-cms")) !== fs.realpathSync(kitRoot)) return undefined; } catch { return undefined; }
  return readText(path.join(target, "pnpm-lock.yaml"))?.match(/^ {2}'?agentic-cms@[^\s']*?\b([0-9a-f]{40})\b/m)?.[1];
}

/** The text of a file's base: its copy under BASES, else the kit's release that has it, else the version of the file in the site's git history that hashes to it; { text, from } or null. */
export function baseText(target, file, base, releases = { versions: {}, texts: {} }) {
  const copy = readText(path.join(target, basePath(file)));
  if (copy !== null && sha(copy) === base) return { text: copy, from: basePath(file) };
  const released = releases.texts[base];
  if (released !== undefined && sha(released) === base) {
    const release = releaseOf(releases, file, base);
    return { text: released, from: release ? `agentic-cms ${release}` : "the kit's releases" };
  }
  for (const { commit, text } of gitTexts(target, file)) if (sha(text) === base) return { text, from: `git ${commit.slice(0, 7)}` };
  return null;
}

const writeBaseCopy = (target, file, text) => { const full = path.join(target, basePath(file)); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, text); };
const removeEmptyDirs = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
};

/** Whether a base needs its copy under BASES: the site's text differs from it, or no release of the kit holds its text to give it back once the site edits the file. */
const keepsCopy = (onDisk, base, releases) => (onDisk !== null && sha(onDisk) !== base) || releases.texts[base] === undefined;

/** Leaves under BASES the copy of each base keepsCopy() names — the one there, the site's file when it is the base, or recovered from the kit's releases or the site's git history — and nothing else. */
function keepBaseCopies(target, bases, releases) {
  const wanted = new Set();
  for (const [file, base] of Object.entries(bases)) {
    const onDisk = readText(path.join(target, file));
    if (!keepsCopy(onDisk, base, releases)) continue;
    const found = onDisk !== null && sha(onDisk) === base ? { text: onDisk, from: file } : baseText(target, file, base, releases);
    if (!found) continue;
    wanted.add(basePath(file));
    if (found.from !== basePath(file)) writeBaseCopy(target, file, found.text);
  }
  for (const rel of walk(path.join(target, BASES))) if (!wanted.has(`${BASES}/${rel}`)) fs.rmSync(path.join(target, BASES, rel));
  removeEmptyDirs(path.join(target, path.dirname(BASES)));
}

/** A file named on the command line as the manifest names it: as given, or as a path from the current directory into the site. */
function agentFileName(target, given, kit) {
  const fromHere = path.relative(target, path.resolve(given)).split(path.sep).join("/");
  const file = [given.replace(/^\.\//, ""), fromHere].find((name) => kit.has(name));
  if (!file) throw new AgentFileError(`${given} is not one of this site's agent files (.claude/rules/<name>.md, .claude/skills/<name>/SKILL.md, .agents/skills/<name>/SKILL.md)`);
  return file;
}

/** Where the kit keeps an agent file (or the template of the site's settings), for the person merging by hand. */
export const kitPath = (file) => {
  const template = Object.keys(TEMPLATES).find((from) => TEMPLATES[from] === file);
  if (template) return `node_modules/agentic-cms/templates/site/${template}`;
  const [from, to] = Object.entries(AGENT_DIRS).find(([, dir]) => file.startsWith(`${dir}/`));
  return `node_modules/agentic-cms/${from}${file.slice(to.length)}`;
};

/**
 * Records the kit's current text as the base of each file the site merged by
 * hand (--accept), its base copy kept while the site's text differs or no
 * release of the kit holds it; nothing else changes. [{ file, status }], the status --check now gives. Throws an
 * AgentFileError, before anything is written, for a name that is not one of
 * the site's agent files or a file that is not there.
 */
export function acceptAgentFiles(target, files, { kitRoot }) {
  const kit = siteAgentFiles(target, kitRoot);
  const named = [...new Set(files.map((given) => agentFileName(target, given, kit)))];
  for (const file of named) if (!fs.existsSync(path.join(target, file))) throw new AgentFileError(`${file} is missing: agentic-cms init --agent-files writes it`);
  const manifest = readManifest(target);
  const releases = readReleases(kitRoot);
  const report = named.map((file) => {
    const onDisk = readText(path.join(target, file));
    const base = sha(kit.get(file));
    manifest.files[file] = base;
    if (keepsCopy(onDisk, base, releases)) writeBaseCopy(target, file, kit.get(file));
    else fs.rmSync(path.join(target, basePath(file)), { force: true });
    const { status, required } = withRequired({ status: statusOf(onDisk, base, base) }, onDisk, kit.get(file));
    return { file, status, ...(required && { required }) };
  });
  writeManifest(target, manifest);
  removeEmptyDirs(path.join(target, path.dirname(BASES)));
  return report;
}

/**
 * The kit's change to an agent file since its base, as a unified diff that
 * `git apply` reads: { file, status, base, from, diff, note? }, the diff ""
 * when there is nothing to merge. A file the manifest records no base for
 * takes the one basesOf() finds in the kit's releases, with a note; with
 * none, it is diffed from its own whole text to the kit's (`from` the file
 * itself), which is not the kit's change. Throws an AgentFileError when the
 * base's text is in neither its copy, the kit's releases nor the site's git
 * history.
 */
export function agentFileDiff(target, given, { kitRoot, version = kitVersion(kitRoot) }) {
  const kit = siteAgentFiles(target, kitRoot);
  const file = agentFileName(target, given, kit);
  const text = kit.get(file);
  const releases = readReleases(kitRoot);
  const onDisk = readText(path.join(target, file));
  const { status, base, note } = measure(onDisk, sha(text), basesOf(target, readManifest(target), { releases, version })(file, onDisk));
  const headers = { from: `a/${file}`, to: `b/${file}` };
  const result = (from, diff) => ({ file, status, base, from, diff, ...(note && { note }) });
  if (status === "ok" || base === sha(text)) return result(null, "");
  if (!base) return result(file, unifiedDiff(onDisk ?? "", text, headers));
  const found = baseText(target, file, base, releases);
  if (!found) throw new AgentFileError(`${file}: the text of its base is in neither ${basePath(file)}, the kit's releases nor the site's git history — compare the file with ${kitPath(file)} by hand, merge, then agentic-cms init --agent-files --accept ${file}`);
  return result(found.from, unifiedDiff(found.text, text, headers));
}

/** The site's AGENTS.md: its scoped-rules table as the site's rules now read (written, or with `check` reported ok | stale | missing) and its size against what Codex reads. */
function agentsMd(target, { check, log, result }) {
  const file = path.join(target, "AGENTS.md");
  const rules = readRules(path.join(target, ".claude/rules"));
  if (!fs.existsSync(file) || !rules.length) return [];
  const placed = placeBlock(fs.readFileSync(file, "utf8"), rulesBlock(rules));
  const table = "AGENTS.md (rules table)";
  const written = placed.status === "inserted" ? "created" : "updated";
  const status = placed.status === "ok" ? "ok" : check ? (placed.status === "inserted" ? "missing" : "stale") : written;
  if (!check && placed.status !== "ok") { fs.writeFileSync(file, placed.text); result[written].push(table); log(`${written}  ${table}`); }
  // measured as --agent-files leaves it: with the table in
  const { bytes, over } = codexSize(placed.text);
  return [{ file: table, status }, { file: "AGENTS.md (size)", status: over ? "too big" : "ok", bytes }];
}
