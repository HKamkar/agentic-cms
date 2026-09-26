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

/** Writes the route and its candidates; { route, path, section, page, component, candidates, data }. Throws with the fix. */
export function writeDemo(root, { name, type, page, count = 2, component: override }) {
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
  return { route: demoFile(name), path: `/${name}-demo`, section: type ?? null, page: slug, component: component.file, candidates, data: Boolean(component.data) };
}

const SOURCES = /\.(tsx?|mjs|js)$/;
const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).flatMap((f) => { const full = path.join(dir, f); return fs.statSync(full).isDirectory() ? walk(full) : SOURCES.test(f) ? [full] : []; }) : []);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The files under src/ that import the module: by its @/ alias or a relative path ending in its basename. */
export function importers(root, file) {
  const base = path.basename(file).replace(/\.tsx?$/, "");
  const re = new RegExp(`from "(?:${escapeRe(alias(file))}|\\.{1,2}/(?:[\\w.-]+/)*${escapeRe(base)})(?:\\.tsx?)?"`);
  return walk(path.join(root, "src")).filter((f) => re.test(fs.readFileSync(f, "utf8"))).map((f) => rel(root, f));
}

/** Removes next dev's generated route types when they still name the route; the path when it went. */
export function removeStaleTypes(root, routeDir) {
  const validator = path.join(root, STALE_TYPES);
  if (fs.existsSync(validator) && fs.readFileSync(validator, "utf8").includes(routeDir)) { fs.rmSync(validator); return STALE_TYPES; }
  return null;
}

/** Removes one demo: its folder, every candidate file it alone imported (and its module.css), the stale route types. The component the candidates were copied from is never removed. { removed, kept } */
export function removeDemo(root, name) {
  const dir = path.join(root, demoDir(name));
  const removed = [], kept = [];
  if (!fs.existsSync(dir)) return { removed, kept };
  const route = path.join(dir, "page.tsx");
  // The route's value imports of components (a type import is not a file to remove).
  const imported = fs.existsSync(route) ? [...fs.readFileSync(route, "utf8").matchAll(/^import \{[^}]*\} from "@\/components\/([^"]+)";/gm)].map((m) => `src/components/${m[1]}`) : [];
  // A candidate is <Source><Letter> beside the <Source> the route also imports: only those go, so a
  // round never deletes the site's own component, whatever else happens to import it.
  const sources = new Set(imported);
  const isCandidate = (spec) => { const m = /^(.*)[A-H]$/.exec(spec); return Boolean(m && sources.has(m[1])); };
  fs.rmSync(dir, { recursive: true, force: true });
  removed.push(demoDir(name));
  for (const spec of imported) {
    const file = [".tsx", ".ts"].map((ext) => `${spec}${ext}`).find((f) => fs.existsSync(path.join(root, f)));
    if (!file) continue;
    if (!isCandidate(spec)) { kept.push(`${file} (the component the candidates started from)`); continue; }
    const others = importers(root, file);
    if (others.length) { kept.push(`${file} (imported by ${others.slice(0, 2).join(", ")}${others.length > 2 ? ` and ${others.length - 2} more` : ""})`); continue; }
    fs.rmSync(path.join(root, file));
    removed.push(file);
    const css = file.replace(/\.tsx?$/, ".module.css");
    if (fs.existsSync(path.join(root, css)) && !importers(root, css).length) { fs.rmSync(path.join(root, css)); removed.push(css); }
  }
  const stale = removeStaleTypes(root, demoDir(name));
  if (stale) removed.push(stale);
  return { removed, kept };
}

/** Every demo under src/app, by name. */
export function listDemos(root) {
  const app = path.join(root, "src/app");
  return fs.existsSync(app) ? fs.readdirSync(app).filter((d) => d.endsWith("-demo") && fs.statSync(path.join(app, d)).isDirectory()).map((d) => d.slice(0, -5)).sort() : [];
}
