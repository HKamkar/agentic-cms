// Icons from the two sets a site installs — Lucide (`lucide-static`, ISC:
// line icons) and Simple Icons (`simple-icons`, CC0: other companies' marks)
// — read as SVG files from the site's node_modules and turned into path
// data for the kit's <Icon>: every shape an icon set uses becomes a `d`, so
// the site's map is one string per path and nothing else. The kit ships no
// icon data; the site's generated map carries each set's licence line.
import fs from "node:fs";
import path from "node:path";

const SETS = { lucide: { pkg: "lucide-static", kind: "stroke", label: "Lucide icons", licence: (dir) => fs.readFileSync(path.join(dir, "LICENSE"), "utf8").trim() }, si: { pkg: "simple-icons", kind: "fill", label: "Simple Icons", licence: () => "CC0 1.0 Universal (https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md); each mark remains its owner's trademark" } };
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

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

/** An icon file's shapes as the kit's IconData: stroke paths for a line set, one fill path for a mark set. */
export function parseIcon(svg, set) {
  const shapes = [...svg.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<(path|rect|circle|ellipse|line|polyline|polygon)\b([^>]*?)\/?>/g)].map((m) => toPathD(m[1], attrs(m[2])));
  if (!shapes.length) throw new Error("no shapes in the icon");
  if (set === "si") { const title = svg.match(/<title>([^<]*)<\/title>/)?.[1]; return { kind: "fill", d: shapes.length === 1 ? shapes[0] : shapes.join(""), ...(title ? { title } : {}) }; }
  return { kind: "stroke", d: shapes };
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

/** One icon by id (lucide:<name> or si:<slug>) from the packages installed under the site. */
export function readIconSource(id, site) {
  const [set, name] = id.split(":");
  if (!SETS[set] || !name) throw new Error(`${id}: an id is lucide:<name> or si:<slug>`);
  const dir = packageDir(SETS[set].pkg, site);
  const version = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
  const file = path.join(dir, "icons", `${name}.svg`);
  if (!fs.existsSync(file)) throw new Error(`${id}: no such icon in ${SETS[set].pkg} ${version} (the names are the file names under node_modules/${SETS[set].pkg}/icons)`);
  return { id, ...parseIcon(fs.readFileSync(file, "utf8"), set) };
}

/** The site's icon map as TypeScript, with each set's licence in the header. */
export function renderIconMap(entries, { site }) {
  const sets = [...new Set(entries.map((e) => e.id.split(":")[0]))];
  const licences = sets.map((set) => { const dir = packageDir(SETS[set].pkg, site); const version = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version; return `// ${SETS[set].label} (${SETS[set].pkg} ${version}): ${SETS[set].licence(dir).split("\n").map((l) => l.trimEnd()).join("\n// ").replace(/\/\/ $/gm, "//")}`; });
  const d = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v));
  const row = (e) => `  ${JSON.stringify(e.id)}: { kind: ${JSON.stringify(e.kind)}, d: ${d(e.d)}${e.title ? `, title: ${JSON.stringify(e.title)}` : ""} },`;
  return ["// generated by agentic-cms icons from src/config/icons.json; do not edit by hand — agentic-cms icons add|remove <id>", ...licences, 'import type { IconData } from "agentic-cms/components";', "", "export const ICONS = {", ...entries.map(row), "} as const satisfies Record<string, IconData>;", ""].join("\n");
}
