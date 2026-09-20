// The scaffold behind `agentic-cms init`: a site laid out from the package's
// own files — the wireframe example (its app, components, config, styles,
// content and images), the agent files (a site's path-scoped rules from
// templates/site/rules/, the design skills for Claude Code and Codex), the
// site templates (AGENTS.md, CLAUDE.md, README, PLAN, the Next
// config, the Claude settings, .gitignore) and the generated config
// (package.json, tsconfig.json, pnpm-workspace.yaml). Nothing of the
// package's source. Existing files are kept unless forced; package.json is
// merged. A manifest (.agentic-cms.json) records the hash of every agent
// file as written, so `init --agent-files --check` can tell a site's own
// edit (never clobbered) from a file the kit has since updated.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** The example, copied as it is. */
export const EXAMPLE = ["content", "public", "src/app", "src/components", "src/config", "src/styles", "src/kit.ts", "postcss.config.mjs", "eslint.config.mjs", ".env.example", ".nvmrc"];
/** The templates under templates/site/, and where each lands. */
export const TEMPLATES = { "AGENTS.md": "AGENTS.md", "CLAUDE.md": "CLAUDE.md", "README.md": "README.md", "PLAN.md": "PLAN.md", "next.config.ts": "next.config.ts", "settings.json": ".claude/settings.json", "gitignore": ".gitignore" };
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

/** The site's package.json: written, or merged into an existing one (its name, scripts and dependencies win). */
function sitePackage(target, { kitRoot, version }) {
  const kit = kitPackage(kitRoot);
  const dev = kit.devDependencies;
  const wanted = {
    name: path.basename(path.resolve(target)).toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    private: true,
    type: "module",
    engines: kit.engines,
    packageManager: kit.packageManager,
    scripts: { dev: "next dev -p 8000", build: "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo", start: "next start -p 8000", lint: "eslint", test: 'node --import agentic-cms/loader --test "src/**/*.test.ts"', "content:check": "agentic-cms check", "content:lint": "agentic-cms lint", "content:status": "agentic-cms status", "content:docs": "agentic-cms docs", kit: "agentic-cms" },
    dependencies: { "agentic-cms": `github:HKamkar/agentic-cms#v${version}`, motion: dev.motion, next: dev.next, react: dev.react, "react-dom": dev["react-dom"], zod: dev.zod },
    devDependencies: { "@tailwindcss/postcss": dev["@tailwindcss/postcss"], "@types/node": dev["@types/node"], "@types/react": dev["@types/react"], "@types/react-dom": dev["@types/react-dom"], eslint: dev.eslint, "eslint-config-next": dev["eslint-config-next"], "playwright-core": dev["playwright-core"], postcss: dev.postcss, tailwindcss: dev.tailwindcss, typescript: dev.typescript },
  };
  const file = path.join(target, "package.json");
  if (!fs.existsSync(file)) return { text: JSON.stringify(wanted, null, 2) + "\n", merged: false };
  const existing = JSON.parse(fs.readFileSync(file, "utf8"));
  const merged = { ...wanted, ...existing, scripts: { ...wanted.scripts, ...existing.scripts }, dependencies: { ...wanted.dependencies, ...existing.dependencies }, devDependencies: { ...wanted.devDependencies, ...existing.devDependencies } };
  return { text: JSON.stringify(merged, null, 2) + "\n", merged: true };
}

function siteTsconfig(kitRoot) {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(kitRoot, "tsconfig.json"), "utf8"));
  tsconfig.compilerOptions.paths = { "@/*": ["./src/*"] };
  tsconfig.exclude = ["node_modules"];
  return JSON.stringify(tsconfig, null, 2) + "\n";
}

const WORKSPACE = `# pnpm settings. The git dependency builds its dist/ on install (prepare), which pnpm runs only when allowed here.
allowBuilds:
  "agentic-cms@git+https://github.com/HKamkar/agentic-cms.git": true
  sharp: true
  unrs-resolver: true
`;

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
  if (pkg.merged) { fs.writeFileSync(path.join(target, "package.json"), pkg.text); result.updated.push("package.json"); log("merged   package.json"); } else put(target, "package.json", pkg.text, opts);
  put(target, "tsconfig.json", siteTsconfig(kitRoot), opts);
  put(target, "pnpm-workspace.yaml", WORKSPACE, opts);
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
    const status = onDisk === null ? "missing" : recorded && sha(onDisk) !== recorded ? "modified" : sha(onDisk) === current ? "ok" : "stale";
    if (check) { report.push({ file, status }); continue; }
    if (status === "modified" && !force) { report.push({ file, status: "kept" }); result.kept.push(file); next.files[file] = recorded; continue; }
    if (status === "ok") { report.push({ file, status: "ok" }); next.files[file] = current; continue; }
    const written = put(target, file, text, { force: true, result, log });
    report.push({ file, status: written });
    next.files[file] = current;
  }
  if (!check) writeManifest(target, next);
  return report;
}
