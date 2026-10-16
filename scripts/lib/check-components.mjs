// The placement guard behind `agentic-cms check-components`, which a site's
// `pnpm lint` runs after ESLint (so CI does too). ESLint's component rules
// (./component-lint.mjs, `agentic-cms/eslint`) judge what a file contains;
// this judges where files are and what the catalogue and the registry say
// of them, so nobody adds a one-off component to a page:
//   - the layers exist (a layer the config sets to null is one the site does
//     not have), and every file under src/components sits in one;
//   - every component the motion layer, ui and patterns export is named in
//     the catalogue (src/components/README.md); a component is a PascalCase
//     name with a lowercase letter, so an ALL_CAPS constant is none;
//   - every component file in a section folder is imported by the registry;
//   - src/app holds route files only, in the known route folders (a *-demo
//     folder — a design round's route, the lab's lab-demo — is free);
//   - no component (.tsx, .jsx) outside src/components and src/app;
//   - CSS modules only in ui and the motion layer, @keyframes only in the
//     motion layer and src/styles/motion.css.
// A running round's candidates (the `created` of a src/app/*-demo/demo.json,
// with their module.css) pass, and so does every file on the config's frozen
// `inherited` list, which only shrinks: a listed file that is gone is a
// finding. The config is src/config/components.json; its layer keys are
// componentRules()'s options, with the same defaults. The file system comes
// in as `fs` (existsSync, readFileSync, readdirSync with withFileTypes).
import path from "node:path";
import { suggest } from "./args.mjs";
import { DEFAULTS as LINT_DEFAULTS, resolveOptions } from "./component-lint.mjs";
import { MANIFEST as DEMO_MANIFEST } from "./demo.mjs";

export const CONFIG_FILE = "src/config/components.json";
/** The route folders of the kit's example: what a site that names none has. */
export const ROUTES = ["src/app", "src/app/[[...slug]]", "src/app/blog-post/[slug]", "src/app/api/forms/[id]", "src/app/feed.xml"];
/** The guard's keys beyond componentRules()'s, with their defaults; `catalogue` is under `root`. */
export const GUARD_DEFAULTS = { catalogue: "README.md", app: "src/app", routes: ROUTES, motionCss: "src/styles/motion.css", inherited: [] };
const KEYS = new Set([...Object.keys(LINT_DEFAULTS), ...Object.keys(GUARD_DEFAULTS)]);
/** The files Next.js reads in a route folder: the route's own files and its metadata, plus the root layout's stylesheet. */
export const ROUTE_FILE = /^(?:(?:page|layout|template|loading|error|global-error|not-found|forbidden|unauthorized|default|route)\.(?:tsx|ts|jsx|js)|(?:sitemap|robots|manifest)\.(?:ts|js|xml|txt|json|webmanifest)|(?:icon|apple-icon|opengraph-image|twitter-image)\d*\.(?:ico|jpe?g|png|gif|svg|tsx|ts|jsx|js)|(?:opengraph-image|twitter-image)\d*\.alt\.txt|favicon\.ico|globals\.css)$/;
/** A design round's throwaway route folder (`demo new`), the lab's `lab-demo` among them. */
export const DEMO_FOLDER = /^[a-z0-9][a-z0-9-]*-demo$/;
export const LIBRARY_NOTE = "The library is src/components/README.md: look there first, extend a primitive that almost fits, and add one only when nothing does.";
const COMPONENT = /\.(tsx|jsx)$/;
const SOURCE = /\.(tsx|ts|jsx|js|mjs)$/;
const TEST = /\.test\.[cm]?[jt]sx?$/;

export class GuardConfigError extends Error {}

/** The site's config as written, every key checked; throws GuardConfigError naming the fix. */
export function readConfig(root, fs) {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) throw new GuardConfigError(`no ${CONFIG_FILE} here — the guard is not set up in this site (docs/migrating-to-0.8.0.md § 3.7 adopts it), or this is not the site's root`);
  let config;
  try { config = JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { throw new GuardConfigError(`${CONFIG_FILE}: ${error.message}`); }
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new GuardConfigError(`${CONFIG_FILE}: an object of options, not ${JSON.stringify(config)}`);
  for (const key of Object.keys(config)) if (!key.startsWith("$") && !KEYS.has(key)) throw new GuardConfigError(`${CONFIG_FILE}: no option ${key}${suggest(key, [...KEYS])} (a key starting with $ is a comment)`);
  for (const key of ["sections", "ignores", "routes", "inherited"]) if (key in config && !(Array.isArray(config[key]) && config[key].every((v) => typeof v === "string"))) throw new GuardConfigError(`${CONFIG_FILE}: ${key} is a list of paths`);
  return config;
}

/** The config with the defaults filled in: the layers resolved under `root` as componentRules() resolves them, the guard's own paths beside them. */
export function resolveGuard(config = {}) {
  const layers = resolveOptions(config);
  const own = { ...GUARD_DEFAULTS, ...config };
  return { ...layers, catalogue: `${layers.root}/${own.catalogue}`, app: own.app, routes: own.routes, motionCss: own.motionCss, inherited: own.inherited, ignores: layers.ignores };
}

/** A glob (`**`, `*`, `?`) as a regex over a root-relative path. */
export function globRegex(glob) {
  const body = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/|\*\*|\*|\?/g, (m) => ({ "**/": "(?:.*/)?", "**": ".*", "*": "[^/]*", "?": "[^/]" })[m]);
  return new RegExp(`^${body}$`);
}

export const within = (file, dir) => Boolean(dir) && (file === dir || file.startsWith(`${dir}/`));

/** The tree the checks read: every file under src (and the layers' root and the app folder, when outside it), root-relative, dotfiles and ignored files left out. */
function readTree(root, fs, g) {
  const ignored = g.ignores.map(globRegex);
  const walk = (dir) => {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) return [];
    return fs.readdirSync(full, { withFileTypes: true }).filter((e) => !e.name.startsWith(".")).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  };
  const files = [...new Set([g.src, g.root, g.app].flatMap(walk))].filter((file) => !ignored.some((re) => re.test(file))).sort();
  const text = new Map();
  const read = (file) => { if (!text.has(file)) text.set(file, fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8") : null); return text.get(file); };
  const isDir = (dir) => { try { return fs.readdirSync(path.join(root, dir)) && true; } catch { return false; } };
  return { files, read, isDir, exists: (file) => fs.existsSync(path.join(root, file)) };
}

const finding = (check, file, problem, fix) => ({ check, file, problem, fix });
const layerFolders = (g) => [["motion", g.motion], ["ui", g.ui], ["patterns", g.patterns], ...g.sections.map((folder) => ["sections", folder])].filter(([, folder]) => folder);

/** The files a running design round created, with their module.css: from each *-demo folder's demo.json. */
export function roundCandidates(g, tree) {
  const manifests = tree.files.filter((file) => within(file, g.app) && path.posix.basename(file) === DEMO_MANIFEST && DEMO_FOLDER.test(file.slice(g.app.length + 1).split("/")[0]));
  const created = manifests.flatMap((file) => { try { const list = JSON.parse(tree.read(file)).created; return Array.isArray(list) ? list.filter((f) => typeof f === "string") : []; } catch { return []; } });
  return new Set(created.flatMap((file) => [file, file.replace(/\.[jt]sx?$/, ".module.css")]));
}

/** The layers the config names are there; the registry and the catalogue too; every file under the layers' root sits in a layer. */
function checkLayers(g, tree, exempt) {
  const out = [];
  for (const [key, folder] of layerFolders(g)) {
    if (tree.isDir(folder)) continue;
    const fix = key === "sections" ? `create it, or take it out of "sections" in ${CONFIG_FILE}` : `create it, or set "${key}": null in ${CONFIG_FILE} (a layer the site does not have)`;
    out.push(finding("layers", folder, `the ${key === "sections" ? "section folder" : `${key} layer`} the config names is not there`, fix));
  }
  if (g.sections.length && !tree.exists(g.registry)) out.push(finding("layers", g.registry, "the section registry is not there", `the registry renders each section type: point "registry" in ${CONFIG_FILE} at it`));
  if (!tree.exists(g.catalogue)) out.push(finding("layers", g.catalogue, "the catalogue is not there", `the catalogue names every primitive: write it, or point "catalogue" in ${CONFIG_FILE} at it`));
  const folders = layerFolders(g).map(([, folder]) => folder);
  for (const file of tree.files.filter((f) => within(f, g.root) && f !== g.catalogue && !exempt.has(f) && !folders.some((folder) => within(f, folder)))) {
    out.push(finding("layers", file, `outside the layers (${path.posix.dirname(file)}/ is none of ${folders.map((f) => f.slice(g.root.length + 1)).join(", ")})`, `build it from the library: reuse or extend a primitive in ${g.ui ?? "ui"}/, or add one there with its catalogue entry, and compose it in a registered section; a new section folder goes into "sections" in ${CONFIG_FILE}`));
  }
  return out;
}

/** The names a module exports that are components: PascalCase with a lowercase letter (an ALL_CAPS constant is none); types are not exports here. */
export function componentExports(source) {
  const names = [...source.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  for (const [, list] of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of list.split(",").map((p) => p.trim()).filter((p) => p && !p.startsWith("type "))) names.push(part.split(/\s+as\s+/).pop());
  }
  return [...new Set(names)].filter((name) => /^[A-Z]/.test(name) && /[a-z]/.test(name));
}

/** Whether the catalogue names a component: in backticks, alone or in a path or an example (`Faq`, `ui/Faq.tsx`, `<Faq …/>`). */
export const catalogued = (catalogue, name) => new RegExp(`\`[^\`\\n]*(?<![\\w$])${name.replaceAll("$", "\\$")}(?![\\w$])[^\`\\n]*\``).test(catalogue);

/** Every component the motion layer, ui and patterns export is in the catalogue. */
function checkCatalogue(g, tree, exempt) {
  const catalogue = tree.read(g.catalogue);
  if (catalogue === null) return [];
  const library = [g.motion, g.ui, g.patterns].filter(Boolean);
  const files = tree.files.filter((f) => SOURCE.test(f) && !TEST.test(f) && !exempt.has(f) && library.some((folder) => within(f, folder)));
  return files.flatMap((file) => componentExports(tree.read(file)).filter((name) => !catalogued(catalogue, name)).map((name) => finding("catalogue", file, `exports \`${name}\`, which the catalogue does not name`, `add an entry for \`${name}\` to ${g.catalogue} — what it is, its options, an example, its name in backticks — in the same commit`)));
}

/** The files the registry imports, without their extensions: by the alias, or relative to it. */
export function registryImports(g, source) {
  const out = new Set();
  for (const [, spec] of source.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    const file = spec.startsWith(g.alias) ? `${g.src}/${spec.slice(g.alias.length)}` : spec.startsWith(".") ? path.posix.join(path.posix.dirname(g.registry), spec) : null;
    if (file) for (const form of [file, `${file}/index`]) out.add(form.replace(/\.[cm]?[jt]sx?$/, ""));
  }
  return out;
}

/** Every component file in a section folder is imported by the registry. */
function checkRegistry(g, tree, exempt) {
  const source = g.sections.length ? tree.read(g.registry) : null;
  if (source === null) return [];
  const imported = registryImports(g, source);
  const files = tree.files.filter((f) => COMPONENT.test(f) && !TEST.test(f) && f !== g.registry && !exempt.has(f) && g.sections.some((folder) => within(f, folder)));
  const shared = g.patterns ?? g.ui ?? "ui";
  return files.filter((file) => !imported.has(file.replace(COMPONENT, ""))).map((file) => finding("registry", file, "a component in a section folder that the registry does not import", `a section folder holds the components the registry renders: register it in ${g.registry} (its type and schema beside the others), or move a piece sections share to ${shared}/ with its catalogue entry`));
}

/** src/app holds route files only, in the known route folders; a *-demo folder is a round's or the lab's. */
function checkRoutes(g, tree, exempt) {
  const files = tree.files.filter((f) => within(f, g.app) && !exempt.has(f) && !DEMO_FOLDER.test(f.slice(g.app.length + 1).split("/")[0]));
  const stray = files.filter((file) => !(g.routes.includes(path.posix.dirname(file)) && ROUTE_FILE.test(path.posix.basename(file))));
  return stray.map((file) => {
    const known = g.routes.includes(path.posix.dirname(file));
    return finding("routes", file, known ? "not a route file (page, layout, route, not-found, the metadata files)" : `in ${path.posix.dirname(file)}/, which is not a known route folder`, `a page is a file, content/pages/<slug>.yaml, that the catch-all route renders from registered sections, and a component belongs in the library; a new route is an architecture change — its folder goes into "routes" in ${CONFIG_FILE}, in its own pull request`);
  });
}

/** No component outside the layers' root and the app folder. */
function checkStrayComponents(g, tree, exempt) {
  const files = tree.files.filter((f) => COMPONENT.test(f) && !exempt.has(f) && !within(f, g.root) && !within(f, g.app));
  return files.map((file) => finding("components", file, `a component outside ${g.root} and ${g.app}`, `move it into the library — ${g.ui ?? "ui"}/ (or the motion layer, when it animates) — with its catalogue entry`));
}

/** CSS modules only in ui and the motion layer. */
function checkModules(g, tree, exempt) {
  const allowed = [g.ui, g.motion].filter(Boolean);
  const files = tree.files.filter((f) => f.endsWith(".module.css") && !exempt.has(f) && !allowed.some((folder) => within(f, folder)));
  return files.map((file) => finding("styles", file, `a CSS module outside ${allowed.length ? allowed.join(" and ") : "the library"}`, `a primitive owns its styles: move the rule into the primitive it styles (${g.ui ?? "ui"}/), or say it with utilities and tokens`));
}

/** @keyframes only in the motion layer and src/styles/motion.css. */
function checkKeyframes(g, tree, exempt) {
  const files = tree.files.filter((f) => /\.(css|tsx|ts|jsx|js|mjs)$/.test(f) && !exempt.has(f) && f !== g.motionCss && !within(f, g.motion) && tree.read(f).includes("@keyframes"));
  const motion = g.motion ? `the motion layer, ${g.motion}/` : `the play-once layer, agentic-cms/ix, and ${g.motionCss}`;
  return files.map((file) => finding("keyframes", file, "defines @keyframes outside the motion layer", `animation is ${motion}: a new effect is a new motion primitive, its keyframes in ${g.motionCss}${g.motion ? " or the layer" : ""}`));
}

/** The frozen list only shrinks: a listed file that is gone leaves it. */
function checkInherited(g, tree) {
  return g.inherited.filter((file) => !tree.exists(file)).map((file) => finding("inherited", file, `on the frozen "inherited" list, but gone`, `take it out of "inherited" in ${CONFIG_FILE}: the list only shrinks`));
}

export const CHECKS = [checkLayers, checkCatalogue, checkRegistry, checkRoutes, checkStrayComponents, checkModules, checkKeyframes, checkInherited];

/** How many files each layer holds: { motion, ui, patterns, sections } (null for a layer the site does not have), and the section folders. */
function layerCounts(g, tree) {
  const count = (folder) => (folder ? tree.files.filter((f) => within(f, folder)).length : null);
  return { motion: count(g.motion), ui: count(g.ui), patterns: count(g.patterns), sections: g.sections.reduce((n, folder) => n + count(folder), 0), sectionFolders: g.sections.length };
}

/** The guard over a site: { config, layers, inherited, candidates, findings: [{ check, file, problem, fix }] }. Throws GuardConfigError for a config it cannot read. */
export function checkComponents({ root, fs, config = readConfig(root, fs) }) {
  const g = resolveGuard(config);
  const tree = readTree(root, fs, g);
  const candidates = roundCandidates(g, tree);
  const exempt = new Set([...g.inherited, ...candidates]);
  const findings = CHECKS.flatMap((check) => check(g, tree, exempt));
  return { config: CONFIG_FILE, layers: layerCounts(g, tree), inherited: g.inherited.length, candidates: [...candidates].filter((file) => tree.exists(file)), findings };
}

/** The report as lines: one line when clean; else each finding with its file, the check, what is wrong and the fix. */
export function formatReport(report) {
  const { layers, inherited, candidates, findings } = report;
  if (!findings.length) {
    const held = ["motion", "ui", "patterns"].filter((key) => layers[key] !== null).map((key) => `${key} ${layers[key]}`);
    held.push(`sections ${layers.sections} in ${layers.sectionFolders} folder${layers.sectionFolders === 1 ? "" : "s"}`);
    return [`check-components: ok (${held.join(", ")}; ${inherited} inherited${candidates.length ? `; ${candidates.length} round candidates` : ""})`];
  }
  const lines = [`check-components: ${findings.length} problem${findings.length === 1 ? "" : "s"}`, ""];
  for (const { check, file, problem, fix } of findings) lines.push(`  ✗ ${file}  [${check}]`, `    ${problem}`, `    → ${fix}`, "");
  lines.push(LIBRARY_NOTE);
  return lines;
}
