// The design round's throwaway route, for `agentic-cms demo`: the section
// registry read for the component that renders a section type, the page
// files read for the one that carries it, the candidates written as copies
// of that component beside it (an export renamed, a header line), the route
// written to show them lettered in the section's real frame with the page's
// real copy — or, for a piece of the chrome (`--component` alone), with no
// props at all — the current version last, and the removal of all of it —
// the route, every component file it alone imported, and next dev's
// generated route types while they still name the route. The procedure
// around it is the design-options skill; docs/design.md § The round.
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export const REGISTRY = "src/components/sections/render.tsx";
export const PAGES = "content/pages";
/** next dev's generated route types, which go on naming a removed route until dev runs again; the production build's type check reads them. */
export const STALE_TYPES = ".next/dev/types/validator.ts";
/** What `demo new` records beside the route, for `demo clean`: the round's base commit, what was untracked then, the component and the candidates. */
export const MANIFEST = "demo.json";
export const LETTERS = "ABCDEFGH";
export const isDemoName = (name) => /^[a-z0-9][a-z0-9-]*$/.test(name);
export const demoDir = (name) => `src/app/${name}-demo`;
export const demoFile = (name) => `${demoDir(name)}/page.tsx`;
const rel = (root, file) => path.relative(root, file).split(path.sep).join("/");

/** The registry: section type → { name (the export), alias, file (site-relative .tsx), data (a withData entry: the page reads more for it) }. */
export function readRegistry(root) {
  const file = path.join(root, REGISTRY);
  if (!fs.existsSync(file)) throw new Error(`no ${REGISTRY}: the section registry the route reads the component from`);
  const text = fs.readFileSync(file, "utf8");
  const imports = new Map();
  for (const m of text.matchAll(/^import \{ (\w+)(?: as (\w+))? \} from "@\/components\/([^"]+)";/gm)) imports.set(m[2] ?? m[1], { name: m[1], file: `src/components/${m[3]}.tsx` });
  const registry = new Map();
  for (const m of text.matchAll(/^\s*"?([\w-]+)"?: (plain|withData)\((\w+)/gm)) { const found = imports.get(m[3]); if (found) registry.set(m[1], { ...found, alias: m[3], data: m[2] === "withData" }); }
  return registry;
}

const flatten = (sections) => (Array.isArray(sections) ? sections.flatMap((s) => (s?.type === "group" ? flatten(s.sections) : [s])) : []);

/** The page files carrying a section of the type, as [{ slug, count }], in file order; groups are looked into. */
export function pagesWith(root, type) {
  const dir = path.join(root, PAGES);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f) && !f.startsWith("_")).sort().flatMap((f) => {
    const doc = parseYaml(fs.readFileSync(path.join(dir, f), "utf8"));
    const count = flatten(doc?.sections).filter((s) => s?.type === type).length;
    return count ? [{ slug: f.replace(/\.ya?ml$/, ""), count }] : [];
  });
}

/** A candidate's source: the component's, its export renamed with the letter, a header line saying what it is and what removes it. */
export function candidateSource(source, name, letter, demo) {
  const re = new RegExp(`export (function|const) ${name}\\b`);
  if (!re.test(source)) throw new Error(`the component has no \`export function ${name}\` (or \`export const ${name}\`) to rename`);
  return `// Candidate ${letter} of ${demo}-demo (agentic-cms demo new): the current ${name} to start from, edited into one idea; goes with the route (agentic-cms demo clean ${demo}).\n${source.replace(re, `export $1 ${name}${letter}`)}`;
}

const alias = (file) => `@/${file.replace(/^src\//, "").replace(/\.tsx?$/, "")}`;

/** The lettered blocks and the current version last, the part both kinds of route share. */
function routeBody(name, props) {
  const render = (tag) => `<${tag}${props ? ` ${props}` : ""} />`;
  return `  return (
    <>
      {CANDIDATES.map(({ letter, note, Candidate }) => (
        <div key={letter} data-candidate={letter}>
          <p style={chip}><span style={letterStyle}>{letter}</span> {note}</p>
          ${render("Candidate")}
        </div>
      ))}
      <div data-candidate="now">
        <p style={chip}><span style={letterStyle}>now</span> the current version</p>
        ${render(name)}
      </div>
    </>
  );
}
`;
}

// The chip that names a block, in the page's column: a hairline in the site's ink, no colour of its own.
const CHIP = `// The chip that names a block, in the page's column: a hairline in the site's ink, no colour of its own.
const chip = { display: "flex", alignItems: "baseline", gap: ".5rem", maxWidth: "var(--container-page, 72rem)", margin: "3rem auto .5rem", padding: "0 1rem", font: ".75rem/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", letterSpacing: ".06em" } as const;
const letterStyle = { border: "1px solid currentColor", padding: ".1rem .5rem", fontWeight: 700 } as const;`;

const removal = (demo) => `// \`agentic-cms demo new ${demo}\`, removed with the losing candidates by
// \`agentic-cms demo clean ${demo}\`; never merged — the build's SEO audit
// fails a route without a seo block, which is the guard. An animated
// candidate is inspected on the lab's timeline: <LabStudy file="…"> for a
// file, <LabTimeline label="…"> around a component, which drives its inline
// SVGs and whatever carries data-lab-drive, not the reveals around them
// (agentic-cms/lab; docs/lab.md § Inspecting motion).`;

/** The route's source: with a section, the page's copy read at render; without one, each candidate rendered with no props (a piece of the chrome, whose copy is the site's config). Lettered blocks, the current version last, inside the site's own layout. */
export function routeSource({ demo, type, slug, component, letters, data = false }) {
  const { name, file } = component;
  const candidates = letters.map((letter) => ({ letter, name: `${name}${letter}` }));
  const imports = [`import { ${name} } from "${alias(file)}";`, ...candidates.map((c) => `import { ${c.name} } from "${alias(file)}${c.letter}";`)].join("\n");
  const rows = candidates.map((c) => `  { letter: "${c.letter}", note: "what differs, in one line", Candidate: ${c.name} },`).join("\n");
  if (!type) {
    return `// Throwaway demo route of the design round (the design-options skill):
// candidates for ${name}, a piece of the site's chrome — its copy comes
// from the site's config (src/config/site.ts), not a page file — each
// rendered inside the site's own layout so they are judged on its theme,
// lettered with one line on what differs, the current version last. Written by
${removal(demo)}
import type { ComponentType } from "react";
${imports}

export const metadata = { robots: { index: false } };

const CANDIDATES: { letter: string; note: string; Candidate: ComponentType }[] = [
${rows}
];

${CHIP}

export default function ${pascal(demo)}Demo() {
${routeBody(name, "")}`;
  }
  const dataNote = data ? `\n  // This section is a withData entry of the registry: the page also reads a collection for it (its resolve).\n  // Pass that here as well, the way render.tsx does, or the candidates render without it.` : "";
  return `// Throwaway demo route of the design round (the design-options skill):
// candidates for the "${type}" section, each in its real frame with the
// page's real copy — content/pages/${slug}.yaml, read on every render —
// lettered with one line on what differs, the current version last, inside
// the site's own layout so they are judged on its theme. Written by
${removal(demo)}
import type { ReactNode } from "react";
import type { SectionOf, SectionProps } from "@/components/sections/schemas";
import { kit } from "@/kit";
${imports}

export const metadata = { robots: { index: false } };

type Props = SectionProps<"${type}">;
const CANDIDATES: { letter: string; note: string; Candidate: (props: Props) => ReactNode }[] = [
${rows}
];

${CHIP}

/** The section's copy from its page file; groups looked into. */
function copyOf(sections: SectionOf<"group">["sections"]): Props | null {
  for (const section of sections) {
    if (section.type === "group") { const inner = copyOf(section.sections); if (inner) return inner; }
    else if (section.type === "${type}") { const { type: _type, ...props } = section; void _type; return props; }
  }
  return null;
}

export default function ${pascal(demo)}Demo() {
  const props = copyOf(kit.content.getPage("${slug}").sections);
  if (!props) throw new Error('content/pages/${slug}.yaml carries no "${type}" section');${dataNote}
${routeBody(name, "{...props}")}`;
}

const pascal = (name) => name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");

/** Writes the route, its candidates and the manifest (base: the commit the round starts from, untracked: the files git did not track then); { route, path, section, page, component, candidates, data }. Throws with the fix. */
export function writeDemo(root, { name, type, page, count = 2, component: override, base = null, untracked = [] }) {
  if (!isDemoName(name)) throw new Error(`${name}: a demo's name is lowercase letters, digits and hyphens`);
  if (!type && !override) throw new Error(`name what the candidates are for: --section <type> for a section (the route reads the page's copy), or --component <file> for a piece of the chrome (no page copy)`);
  if (!(count >= 1 && count <= LETTERS.length)) throw new Error(`--candidates is 1 to ${LETTERS.length}, not ${count}`);
  const route = path.join(root, demoFile(name));
  if (fs.existsSync(route)) throw new Error(`${demoFile(name)} exists; edit it, or remove it with demo clean ${name}`);
  // A section's component comes from the registry unless --component names one; a chrome piece is the file alone.
  const entry = type ? readRegistry(root).get(type) : null;
  if (type && !entry && !override) { const known = [...readRegistry(root).keys()].join(", "); throw new Error(`${type}: no such section in ${REGISTRY} (${known}); pass --component <file> for one outside the registry`); }
  const component = override ? { name: path.basename(override).replace(/\.tsx?$/, ""), file: rel(root, path.resolve(root, override)), data: false } : entry;
  const source = fs.existsSync(path.join(root, component.file)) ? fs.readFileSync(path.join(root, component.file), "utf8") : null;
  if (source === null) throw new Error(`${component.file}: no such file (${type ? `the component of "${type}"` : "the component the candidates start from"})`);
  let slug = null;
  if (type) {
    const pages = pagesWith(root, type);
    slug = page ?? pages[0]?.slug;
    if (!slug) throw new Error(`no page under ${PAGES}/ carries a "${type}" section; pass --page <slug> for one that will, or add the section to a page file first`);
    if (page && !pages.some((p) => p.slug === page)) throw new Error(`${PAGES}/${page}.yaml carries no "${type}" section`);
  } else if (page) throw new Error("--page names the page file a section's copy is read from; without --section there is no page copy to read");
  const letters = [...LETTERS.slice(0, count)];
  const candidates = letters.map((letter) => ({ letter, file: component.file.replace(/\.tsx$/, `${letter}.tsx`) }));
  for (const c of candidates) if (fs.existsSync(path.join(root, c.file))) throw new Error(`${c.file} exists; a candidate of an earlier round? demo clean, or another name`);
  for (const c of candidates) fs.writeFileSync(path.join(root, c.file), candidateSource(source, component.name, c.letter, name));
  fs.mkdirSync(path.dirname(route), { recursive: true });
  fs.writeFileSync(route, routeSource({ demo: name, type, slug, component, letters, data: Boolean(component.data) }));
  const manifest = { demo: name, component: component.file, base, untracked, created: candidates.map((c) => c.file) };
  fs.writeFileSync(path.join(path.dirname(route), MANIFEST), `${JSON.stringify(manifest, null, 1)}\n`);
  return { route: demoFile(name), path: `/${name}-demo`, section: type ?? null, page: slug, component: component.file, candidates, data: Boolean(component.data) };
}

const SOURCES = /\.(tsx?|mjs|js)$/;
const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).flatMap((f) => { const full = path.join(dir, f); return fs.statSync(full).isDirectory() ? walk(full) : SOURCES.test(f) ? [full] : []; }) : []);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MODULE_EXTENSIONS = [".tsx", ".ts", ".mjs", ".js"];

/** The files under src/ that import the module: by its @/ alias or a relative path ending in its basename; the `except` files do not count. */
export function importers(root, file, except = new Set()) {
  const base = path.basename(file).replace(/\.tsx?$/, "");
  const re = new RegExp(`from "(?:${escapeRe(alias(file))}|\\.{1,2}/(?:[\\w.-]+/)*${escapeRe(base)})(?:\\.tsx?)?"`);
  return walk(path.join(root, "src")).map((f) => rel(root, f)).filter((f) => !except.has(f) && re.test(fs.readFileSync(path.join(root, f), "utf8")));
}

/** The site file a specifier names from `from` (@/ and relative ones; a package is none), site-relative, or null. */
function resolveImport(root, from, spec) {
  const base = spec.startsWith("@/") ? path.join(root, "src", spec.slice(2)) : spec.startsWith(".") ? path.resolve(root, path.dirname(from), spec) : null;
  if (!base) return null;
  const found = [base, ...MODULE_EXTENSIONS.map((e) => base + e), ...MODULE_EXTENSIONS.map((e) => path.join(base, `index${e}`))].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  const file = found ? rel(root, found) : null;
  return file && !file.startsWith("..") ? file : null;
}

/** The site files a file imports as values (import and export … from, a stylesheet included; never `import type`), in source order. */
export function importsOf(root, file) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const specs = [...text.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\bfrom\s+)?["']([^"']+)["']/gm)].map((m) => m[1]);
  return [...new Set(specs.map((spec) => resolveImport(root, file, spec)).filter(Boolean))];
}

/** The newness test of a round: a file it created, or one git added or left untracked since its base that was not untracked already when it began. */
export function roundNewness(manifest, { added = [], untracked = [] } = {}) {
  const fresh = new Set([...added, ...untracked]);
  const before = new Set(manifest.untracked ?? []);
  return (file) => manifest.created.includes(file) || (fresh.has(file) && !before.has(file));
}

/** Removes next dev's generated route types when they still name the route; the path when it went (or would go, with dryRun). */
export function removeStaleTypes(root, routeDir, { dryRun = false } = {}) {
  const validator = path.join(root, STALE_TYPES);
  if (!fs.existsSync(validator) || !fs.readFileSync(validator, "utf8").includes(routeDir)) return null;
  if (!dryRun) fs.rmSync(validator);
  return STALE_TYPES;
}

const importedBy = (file, users) => `${file} (imported by ${users.slice(0, 2).join(", ")}${users.length > 2 ? ` and ${users.length - 2} more` : ""})`;
/** A file's module.css beside it, when nothing outside `except` imports it: [css] or []. */
const cssOf = (root, file, except) => { const css = file.replace(/\.tsx?$/, ".module.css"); return css !== file && fs.existsSync(path.join(root, css)) && !importers(root, css, except).length ? [css] : []; };

/** The files a demo of an older kit (no manifest) takes with it: the lettered candidates the route imports that nothing else does. { files, kept } */
function candidatePlan(root, dir, inDemo) {
  const route = path.join(dir, "page.tsx");
  const imported = fs.existsSync(route) ? [...fs.readFileSync(route, "utf8").matchAll(/^import \{[^}]*\} from "@\/components\/([^"]+)";/gm)].map((m) => `src/components/${m[1]}`) : [];
  const sources = new Set(imported);
  const isCandidate = (spec) => { const m = /^(.*)[A-H]$/.exec(spec); return Boolean(m && sources.has(m[1])); };
  const files = [], kept = [];
  for (const spec of imported) {
    const file = [".tsx", ".ts"].map((ext) => `${spec}${ext}`).find((f) => fs.existsSync(path.join(root, f)));
    if (!file) continue;
    if (!isCandidate(spec)) { kept.push(`${file} (the component the candidates started from)`); continue; }
    const users = importers(root, file, inDemo);
    if (users.length) { kept.push(importedBy(file, users)); continue; }
    files.push(file, ...cssOf(root, file, new Set([...inDemo, file])));
  }
  return { files, kept };
}

/**
 * The files a round takes with it: from the demo folder, imports followed through the files the round created only — an
 * existing file (the section's component, a ui piece, the kit) stops the walk, so promoted work and the rest of the app
 * are never reached — then, until nothing changes, every file something outside the round still imports dropped (the
 * piece the promoted section now uses stays, and what it needs). { files, kept }
 */
function roundPlan(root, inDemo, manifest, isNew) {
  const found = [], seen = new Set(inDemo), queue = [...inDemo];
  while (queue.length) for (const dep of importsOf(root, queue.shift())) { if (seen.has(dep)) continue; seen.add(dep); if (dep !== manifest.component && isNew(dep)) { found.push(dep); queue.push(dep); } }
  const set = new Set(found), kept = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const file of set) { const users = importers(root, file, new Set([...set, ...inDemo])); if (users.length) { set.delete(file); kept.push(importedBy(file, users)); changed = true; } }
  }
  const files = [...new Set([...set].flatMap((file) => [file, ...cssOf(root, file, new Set([...set, ...inDemo]))]))];
  const source = manifest.component && fs.existsSync(path.join(root, manifest.component)) ? [`${manifest.component} (the component the candidates started from)`] : [];
  return { files, kept: [...source, ...kept] };
}

const readManifest = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), "utf8")); } catch { return null; } };
/** A demo's manifest, or null (no demo, or one an older kit wrote). */
export const demoManifest = (root, name) => readManifest(path.join(root, demoDir(name)));

/**
 * Removes one demo: its folder, what the round created that nothing else imports (its manifest says what it created and
 * where it began; `newness` from git adds what it created since) with their module.css, the round's assets
 * (public/images/<name>-demo/) and the stale route types. The component the candidates were copied from is never
 * removed. With dryRun nothing is removed and the lists are what would be. { removed, kept }
 */
export function removeDemo(root, name, { newness = {}, dryRun = false } = {}) {
  const dir = path.join(root, demoDir(name));
  if (!fs.existsSync(dir)) return { removed: [], kept: [] };
  const inDemo = new Set(walk(dir).map((f) => rel(root, f)));
  const manifest = readManifest(dir);
  const plan = manifest ? roundPlan(root, inDemo, manifest, roundNewness(manifest, newness)) : candidatePlan(root, dir, inDemo);
  const assets = `public/images/${name}-demo`;
  const removed = [demoDir(name), ...plan.files, ...(fs.existsSync(path.join(root, assets)) ? [assets] : [])];
  if (!dryRun) for (const file of removed) fs.rmSync(path.join(root, file), { recursive: true, force: true });
  const stale = removeStaleTypes(root, demoDir(name), { dryRun });
  return { removed: stale ? [...removed, stale] : removed, kept: plan.kept };
}

/** Whether a demo folder is one `demo new` wrote: its manifest, or — a demo from before the manifest — the header its route starts with. A site's own gallery in a *-demo folder is not. */
export function isKitDemo(root, name) {
  const dir = path.join(root, demoDir(name));
  if (fs.existsSync(path.join(dir, MANIFEST))) return true;
  const route = path.join(dir, "page.tsx");
  return fs.existsSync(route) && fs.readFileSync(route, "utf8").startsWith("// Throwaway demo route of the design round");
}

/** Every demo under src/app, by name. */
export function listDemos(root) {
  const app = path.join(root, "src/app");
  return fs.existsSync(app) ? fs.readdirSync(app).filter((d) => d.endsWith("-demo") && fs.statSync(path.join(app, d)).isDirectory()).map((d) => d.slice(0, -5)).sort() : [];
}
