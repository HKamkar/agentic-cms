// Icons from the two sets a site installs — Lucide (`lucide-static`, ISC:
// line icons) and Simple Icons (`simple-icons`, CC0: other companies' marks)
// — and the site's own drawings (`file:<name>`, src/config/icons/<name>.svg,
// designed in the lab), read as SVG files and turned into path data for the
// kit's <Icon>: every shape becomes a `d`, so the site's map is one string
// per path and nothing else. The kit ships no icon data; the site's
// generated map carries each set's licence line.
import fs from "node:fs";
import path from "node:path";

export const ICONS_DIR = "src/config/icons";
const SETS = { file: { kind: null, label: "The site's own icons", licence: () => `${ICONS_DIR}/<name>.svg, drawn in the lab (agentic-cms lab)` }, lucide: { pkg: "lucide-static", kind: "stroke", label: "Lucide icons", licence: (dir) => fs.readFileSync(path.join(dir, "LICENSE"), "utf8").trim() }, si: { pkg: "simple-icons", kind: "fill", label: "Simple Icons", licence: () => "CC0 1.0 Universal (https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md); each mark remains its owner's trademark" } };
const n = (v) => { const x = Number(v); return Number.isInteger(x) ? String(x) : String(Math.round(x * 1000) / 1000); };
const f = (v) => Number(v);

/** The path data of one SVG shape (24-grid icon sets use rect, circle, ellipse, line, polyline, polygon and path). */
export function toPathD(tag, a) {
  switch (tag) {
    case "path": return a.d;
    case "rect": {
      const x = f(a.x ?? 0), y = f(a.y ?? 0), w = f(a.width), h = f(a.height), r = f(a.rx ?? a.ry ?? 0);
      if (!r) return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}H${n(x)}z`;
      return `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}v${n(h - 2 * r)}a${n(r)} ${n(r)} 0 0 1-${n(r)} ${n(r)}H${n(x + r)}a${n(r)} ${n(r)} 0 0 1-${n(r)}-${n(r)}V${n(y + r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)}-${n(r)}z`;
    }
    case "circle": { const cx = f(a.cx), cy = f(a.cy), r = f(a.r); return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0-${n(2 * r)} 0`; }
    case "ellipse": { const cx = f(a.cx), cy = f(a.cy), rx = f(a.rx), ry = f(a.ry); return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0-${n(2 * rx)} 0`; }
    case "line": return `M${n(a.x1)} ${n(a.y1)}L${n(a.x2)} ${n(a.y2)}`;
    case "polyline": case "polygon": {
      const points = a.points.trim().split(/[\s,]+/).map(Number);
      const pairs = []; for (let i = 0; i < points.length; i += 2) pairs.push(`${n(points[i])} ${n(points[i + 1])}`);
      return `M${pairs[0]}${pairs.slice(1).map((p) => `L${p}`).join("")}${tag === "polygon" ? "z" : ""}`;
    }
    default: throw new Error(`<${tag}> is not a shape an icon is made of (path, rect, circle, ellipse, line, polyline, polygon)`);
  }
}

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([a-zA-Z0-9:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

// A site's own file is flat shapes with one paint, like the sets: a group, a
// transform, a reference, a style or a mask would be dropped silently by the
// shape scan, so they are refused with the fix instead.
const NOT_FLAT = /<(g|use|defs|style|mask|clipPath|text|symbol|image)\b|\stransform="/;

/** An icon file's shapes as the kit's IconData: stroke paths for a line set, one fill path for a mark set; a site's own file by its root's paint, with its viewBox when it is not the 24 grid. */
export function parseIcon(svg, set) {
  const text = svg.replace(/<!--[\s\S]*?-->/g, "");
  if (set === "file" && NOT_FLAT.test(text)) throw new Error(`${text.match(NOT_FLAT)[0].trim()}: an icon is flat shapes with one paint — no group, transform, use, defs, style, mask, clipPath or text; flatten it first`);
  const shapes = [...text.matchAll(/<(path|rect|circle|ellipse|line|polyline|polygon)\b([^>]*?)\/?>/g)].map((m) => toPathD(m[1], attrs(m[2])));
  if (!shapes.length) throw new Error("no shapes in the icon");
  const title = text.match(/<title>([^<]*)<\/title>/)?.[1];
  if (set === "si") return { kind: "fill", d: shapes.length === 1 ? shapes[0] : shapes.join(""), ...(title ? { title } : {}) };
  if (set !== "file") return { kind: "stroke", d: shapes };
  const root = attrs(text.match(/<svg\b[^>]*>/)?.[0] ?? "");
  const kind = root.fill !== undefined && root.fill !== "none" ? "fill" : root.stroke !== undefined || root.fill === "none" ? "stroke" : "fill";
  const viewBox = root.viewBox?.trim().replace(/\s+/g, " ");
  return { kind, d: kind === "fill" ? (shapes.length === 1 ? shapes[0] : shapes.join("")) : shapes, ...(viewBox && viewBox !== "0 0 24 24" ? { viewBox } : {}), ...(title ? { title } : {}) };
}

// Node's directory walk by hand: a set's package.json is not always in its
// `exports` (simple-icons'), so require.resolve cannot be asked for it.
function packageDir(pkg, site) {
  for (let dir = path.resolve(site); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", pkg);
    if (fs.existsSync(path.join(candidate, "package.json"))) return fs.realpathSync(candidate);
    if (path.dirname(dir) === dir) break;
  }
  throw new Error(`${pkg} is not installed: pnpm add -D ${pkg} (the kit ships no icon data; a site installs the sets it draws from)`);
}

/** One icon by id — lucide:<name> or si:<slug> from the packages installed under the site, file:<name> from the site's own folder. */
export function readIconSource(id, site, { iconsDir = ICONS_DIR } = {}) {
  const [set, name] = id.split(":");
  if (!SETS[set] || !name) throw new Error(`${id}: an id is lucide:<name>, si:<slug> or file:<name>`);
  if (set === "file") {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`${id}: a file icon's name is lowercase letters, digits and hyphens (the file is ${iconsDir}/<name>.svg)`);
    const own = path.join(site, iconsDir, `${name}.svg`);
    if (!fs.existsSync(own)) throw new Error(`${id}: no ${iconsDir}/${name}.svg (draw it in the lab and render it there: agentic-cms lab render <scene> --out ${iconsDir}/${name}.svg)`);
    try { return { id, ...parseIcon(fs.readFileSync(own, "utf8"), set) }; } catch (error) { throw new Error(`${id}: ${error.message}`); }
  }
  const dir = packageDir(SETS[set].pkg, site);
  const version = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
  const file = path.join(dir, "icons", `${name}.svg`);
  if (!fs.existsSync(file)) throw new Error(`${id}: no such icon in ${SETS[set].pkg} ${version} (the names are the file names under node_modules/${SETS[set].pkg}/icons)`);
  return { id, ...parseIcon(fs.readFileSync(file, "utf8"), set) };
}

/** The site's icon map as TypeScript, with each set's licence in the header. */
export function renderIconMap(entries, { site }) {
  const sets = [...new Set(entries.map((e) => e.id.split(":")[0]))];
  const licences = sets.map((set) => {
    if (set === "file") return `// ${SETS.file.label}: ${SETS.file.licence()}`;
    const dir = packageDir(SETS[set].pkg, site);
    const version = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
    return `// ${SETS[set].label} (${SETS[set].pkg} ${version}): ${SETS[set].licence(dir).split("\n").map((l) => l.trimEnd()).join("\n// ").replace(/\/\/ $/gm, "//")}`;
  });
  const d = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v));
  const row = (e) => `  ${JSON.stringify(e.id)}: { kind: ${JSON.stringify(e.kind)}, d: ${d(e.d)}${e.viewBox ? `, viewBox: ${JSON.stringify(e.viewBox)}` : ""}${e.title ? `, title: ${JSON.stringify(e.title)}` : ""} },`;
  return ["// generated by agentic-cms icons from src/config/icons.json; do not edit by hand — agentic-cms icons add|remove <id>", ...licences, 'import type { IconData } from "agentic-cms/components";', "", "export const ICONS = {", ...entries.map(row), "} as const satisfies Record<string, IconData>;", ""].join("\n");
}

/**
 * Adds ids to (or, with `remove`, removes them from) the site's icon manifest and regenerates the map beside it:
 * { manifest, map, ids, changed } with site-relative paths. Throws with the fix on an unknown id, a set that is not
 * installed or a manifest that is not a list, before anything is written.
 */
export function updateIcons(site, ids, { manifest = "src/config/icons.json", remove = false } = {}) {
  const manifestFile = path.resolve(site, manifest);
  const mapFile = manifestFile.replace(/\.json$/, ".ts");
  const current = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : [];
  if (!Array.isArray(current)) throw new Error(`${manifest} is not a list of ids`);
  const kept = new Set(current);
  const changed = ids.filter((id) => (remove ? kept.delete(id) : !kept.has(id) && kept.add(id)));
  const sorted = [...kept].sort();
  const iconsDir = path.join(path.relative(site, path.dirname(manifestFile)), "icons");
  const entries = sorted.map((id) => readIconSource(id, site, { iconsDir }));
  const map = renderIconMap(entries, { site });
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(sorted, null, 1) + "\n");
  fs.writeFileSync(mapFile, map);
  const rel = (f) => path.relative(site, f).split(path.sep).join("/");
  return { manifest: rel(manifestFile), map: rel(mapFile), ids: sorted, changed };
}
