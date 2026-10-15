// The scaffold behind `agentic-cms init`: a site laid out from the package's
// own files — the wireframe example (its app, components, config, styles,
// content and images), the agent files (a site's path-scoped rules from
// templates/site/rules/, the design skills for Claude Code and Codex), the
// site templates (AGENTS.md, CLAUDE.md, README, PLAN, the Next
// config, the Claude settings, .gitignore, the CI workflow, the setup
// script that installs what a package cannot install for itself) and the
// generated config (package.json, tsconfig.json, pnpm-workspace.yaml).
// Nothing of the package's source. Existing files are kept unless forced;
// package.json and pnpm-workspace.yaml are merged, forced or not, so what
// `pnpm init` or an older install left there cannot stop the first install
// or the first test. A manifest (.agentic-cms.json) records the hash of every agent
// file as written, so `init --agent-files --check` can tell a site's own
// edit (never clobbered) from a file the kit has since updated. The site's
// AGENTS.md is its own, but for one block: the scoped-rules table Codex
// needs to find .claude/rules/ (lib/rules-table.mjs), written from the
// site's rules as they stand, and measured against Codex's 32 KiB.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isMap, parseDocument, Scalar } from "yaml";
import { codexSize, placeBlock, readRules, rulesBlock } from "./rules-table.mjs";

/** The example, copied as it is. */
export const EXAMPLE = ["content", "public", "src/app", "src/components", "src/config", "src/styles", "src/kit.ts", "postcss.config.mjs", "eslint.config.mjs", ".env.example", ".nvmrc"];
/** The templates under templates/site/, and where each lands. */
export const TEMPLATES = { "AGENTS.md": "AGENTS.md", "CLAUDE.md": "CLAUDE.md", "README.md": "README.md", "PLAN.md": "PLAN.md", "next.config.ts": "next.config.ts", "settings.json": ".claude/settings.json", "gitignore": ".gitignore", "verify.yml": ".github/workflows/verify.yml", "setup.sh": "scripts/setup.sh" };
/** The agent files the manifest tracks: the site's rules (templates/site/rules/) and the two skills trees. */
export const AGENT_DIRS = { "templates/site/rules": ".claude/rules", ".claude/skills": ".claude/skills", ".agents/skills": ".agents/skills" };
export const MANIFEST = ".agentic-cms.json";
const STANDARD_NOTE = "> This is the wireframe's standard, as `agentic-cms init` scaffolded it: the `design` skill replaces its tokens, components and motion as the site's own look lands, and §8 collects the site's own decisions.\n";
const sha = (text) => `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
const walk = (dir, base = dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")])) : []);

/** Every agent file the kit provides for a site: { file, text }. */
export function renderAgentFiles(kitRoot) {
  const out = [];
  for (const [from, to] of Object.entries(AGENT_DIRS)) {
    for (const rel of walk(path.join(kitRoot, from))) out.push({ file: `${to}/${rel}`, text: fs.readFileSync(path.join(kitRoot, from, rel), "utf8") });
  }
  return out;
}

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

function copyTree(kitRoot, target, entry, opts) {
  const from = path.join(kitRoot, entry);
  if (fs.statSync(from).isFile()) return put(target, entry, fs.readFileSync(from), opts);
  for (const rel of walk(from)) put(target, `${entry}/${rel}`, fs.readFileSync(path.join(from, rel)), opts);
}

const kitPackage = (kitRoot) => JSON.parse(fs.readFileSync(path.join(kitRoot, "package.json"), "utf8"));

/** What `pnpm init` (and `npm init`) write as the test script: a test run that always fails. */
const PLACEHOLDER_TEST = 'echo "Error: no test specified" && exit 1';

/** The site's package.json: written, or merged into an existing one (its name, scripts and dependencies win, but for `pnpm init`'s placeholders); `notes` says which placeholder went. */
function sitePackage(target, { kitRoot, version }) {
  const kit = kitPackage(kitRoot);
  const dev = kit.devDependencies;
  const wanted = {
    name: path.basename(path.resolve(target)).toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    private: true,
    type: "module",
    engines: kit.engines,
    packageManager: kit.packageManager,
    scripts: { dev: "next dev -p 8000", build: "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo", start: "next start -p 8000", lint: "eslint", test: 'node --import agentic-cms/loader --test "src/**/*.test.ts"', "content:check": "agentic-cms check", "content:lint": "agentic-cms lint", "content:status": "agentic-cms status", "content:docs": "agentic-cms docs", urls: "agentic-cms urls", kit: "agentic-cms" },
    dependencies: { "agentic-cms": `github:HKamkar/agentic-cms#v${version}`, motion: dev.motion, next: dev.next, react: dev.react, "react-dom": dev["react-dom"], zod: dev.zod },
    devDependencies: { "@tailwindcss/postcss": dev["@tailwindcss/postcss"], "@types/node": dev["@types/node"], "@types/react": dev["@types/react"], "@types/react-dom": dev["@types/react-dom"], eslint: dev.eslint, "eslint-config-next": dev["eslint-config-next"], "playwright-core": dev["playwright-core"], postcss: dev.postcss, tailwindcss: dev.tailwindcss, typescript: dev.typescript },
  };
  const file = path.join(target, "package.json");
  if (!fs.existsSync(file)) return { text: JSON.stringify(wanted, null, 2) + "\n", merged: false };
  const existing = JSON.parse(fs.readFileSync(file, "utf8"));
  const merged = { ...wanted, ...existing, scripts: { ...wanted.scripts, ...existing.scripts }, dependencies: { ...wanted.dependencies, ...existing.dependencies }, devDependencies: { ...wanted.devDependencies, ...existing.devDependencies } };
  const notes = dropPlaceholders(merged, { target, test: wanted.scripts.test });
  return { text: JSON.stringify(merged, null, 2) + "\n", merged: true, notes };
}

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

/** Lays the site out under target; { created, updated, kept }. */
export function scaffold(target, { kitRoot, version, force = false, log = console.log }) {
  const result = { created: [], updated: [], kept: [] };
  const opts = { force, result, log };
  fs.mkdirSync(target, { recursive: true });
  for (const entry of EXAMPLE) copyTree(kitRoot, target, entry, opts);
  const standard = fs.readFileSync(path.join(kitRoot, "STANDARD.md"), "utf8").replace(/^(# .*\n)/, `$1\n${STANDARD_NOTE}`);
  put(target, "STANDARD.md", standard, opts);
  for (const [from, to] of Object.entries(TEMPLATES)) put(target, to, fs.readFileSync(path.join(kitRoot, "templates/site", from), "utf8"), opts);
  const pkg = sitePackage(target, { kitRoot, version });
  if (pkg.merged) { fs.writeFileSync(path.join(target, "package.json"), pkg.text); result.updated.push("package.json"); log(`merged   package.json${pkg.notes.length ? ` (${pkg.notes.join("; ")})` : ""}`); } else put(target, "package.json", pkg.text, opts);
  put(target, "tsconfig.json", siteTsconfig(kitRoot), opts);
  putWorkspace(target, opts);
  agentFiles(target, { kitRoot, version, force, log, result });
  return result;
}

/** Writes the agent files (a site's own edit is kept), or with `check` reports each: ok | modified | stale | missing. */
export function agentFiles(target, { kitRoot, version, check = false, force = false, log = console.log, result = { created: [], updated: [], kept: [] } }) {
  const manifest = readManifest(target);
  const report = [];
  const next = { version, files: {} };
  for (const { file, text } of renderAgentFiles(kitRoot)) {
    const full = path.join(target, file);
    const onDisk = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
    const recorded = manifest.files[file];
    const current = sha(text);
    // A file the manifest never recorded is the site's own (a site adopting the agent files after writing its rules): kept, like an edit.
    const status = onDisk === null ? "missing" : sha(onDisk) === current ? "ok" : !recorded || sha(onDisk) !== recorded ? "modified" : "stale";
    if (check) { report.push({ file, status }); continue; }
    if (status === "modified" && !force) { report.push({ file, status: "kept" }); result.kept.push(file); next.files[file] = recorded; continue; }
    if (status === "ok") { report.push({ file, status: "ok" }); next.files[file] = current; continue; }
    const written = put(target, file, text, { force: true, result, log });
    report.push({ file, status: written });
    next.files[file] = current;
  }
  report.push(...agentsMd(target, { check, log, result }));
  if (!check) writeManifest(target, next);
  return report;
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
