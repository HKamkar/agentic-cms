// A family of marks from primitives, for `agentic-cms icons family`: every
// mark is composed on one grid (64 by default) from a few shapes painted with
// named gradients — a tile, a glass slab, a grey slab, a disc, a ring, a
// stroke, a polygon — so a new mark is a composition in the spec, not a new
// drawing style, and the family stays one. The spec (YAML or JSON):
//
//   gradients:                       # named paints, as linearGradient stops [offset, colour, opacity?]
//     warm:  { x2: 1, y2: 0, stops: [["0", "#F46D6B"], [".5", "#FBB17D"], ["1", "#F46D6B"]] }
//     glass: { x2: 1, y2: 1, stops: [["0", "#fff", ".34"], ["1", "#fff", ".16"]] }   # glass and glassDisc paint with it
//     grey:  { … }                                                                    # grey paints with it
//     edge:  { x2: 0, y2: 1, stops: [["0", "#fff"], ["1", "#fff", "0"]] }            # the hairline of glass and grey
//   paint: warm                      # the default gradient of tile, disc, ring and poly
//   ring: { size: 40, radius: 19.5, stroke: white, opacity: .5, scale: .34375, offset: 9 }   # the canvas of a `ring: true` mark
//   marks:
//     perimeter: { out: public/images/benefit-perimeter.svg, size: 33, parts: [[glass, 4, 4, 56, 56, 9], [tile, 19, 19, 26, 26, 5]] }
//
// A part is [primitive, ...positional args, { named options }?]:
//   tile(x, y, w, h, rx=5, grad, rot=0, cx?, cy?)   glass(x, y, w, h, rx=4.85, rot=0)   grey(x, y, w, h, rx=4.85, rot=0)
//   disc(cx, cy, r, grad)   glassDisc(cx, cy, r)   ring(cx, cy, r, w, grad)   glassRing(cx, cy, r, w)
//   stroke(d, w=3.2, color="#fff", grad?)   poly(points, grad)
const num = (n) => String(n);

const PRIMITIVES = {
  tile: { args: ["x", "y", "w", "h", "rx", "grad", "rot", "cx", "cy"], render: ({ x, y, w, h, rx = 5, grad, rot = 0, cx, cy }, ctx) => (grad === "none" ? "" : `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(rx)}" fill="url(#${ctx.gradient(grad)})"${rot ? ` transform="rotate(${num(rot)} ${num(cx ?? x + w / 2)} ${num(cy ?? y + h / 2)})"` : ""}/>`) },
  glass: { args: ["x", "y", "w", "h", "rx", "rot"], render: ({ x, y, w, h, rx = 4.85, rot = 0 }, ctx) => `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(rx)}" fill="url(#${ctx.gradient("glass")})" stroke="url(#${ctx.gradient("edge")})" stroke-width=".5"${rot ? ` transform="rotate(${num(rot)} ${num(x + w / 2)} ${num(y + h / 2)})"` : ""}/>` },
  grey: { args: ["x", "y", "w", "h", "rx", "rot"], render: ({ x, y, w, h, rx = 4.85, rot = 0 }, ctx) => `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(rx)}" fill="url(#${ctx.gradient("grey")})" fill-opacity=".6" stroke="url(#${ctx.gradient("edge")})" stroke-width=".5"${rot ? ` transform="rotate(${num(rot)} ${num(x + w / 2)} ${num(y + h / 2)})"` : ""}/>` },
  disc: { args: ["cx", "cy", "r", "grad"], render: ({ cx, cy, r, grad }, ctx) => `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="url(#${ctx.gradient(grad)})"/>` },
  glassDisc: { args: ["cx", "cy", "r"], render: ({ cx, cy, r }, ctx) => `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="url(#${ctx.gradient("glass")})" stroke="url(#${ctx.gradient("edge")})" stroke-width=".5"/>` },
  ring: { args: ["cx", "cy", "r", "w", "grad"], render: ({ cx, cy, r, w, grad }, ctx) => `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="none" stroke="url(#${ctx.gradient(grad)})" stroke-width="${num(w)}"/>` },
  glassRing: { args: ["cx", "cy", "r", "w"], render: ({ cx, cy, r, w }) => `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="${num(w)}"/>` },
  stroke: { args: ["d", "w", "color", "grad"], render: ({ d, w = 3.2, color = "#fff", grad }, ctx) => `<path d="${d}" fill="none" stroke="${grad ? `url(#${ctx.gradient(grad)})` : color}" stroke-width="${num(w)}" stroke-linecap="round" stroke-linejoin="round"/>` },
  poly: { args: ["points", "grad"], render: ({ points, grad }, ctx) => { const name = ctx.gradient(grad); const slab = ["glass", "grey"].includes(name); return `<polygon points="${points}" fill="url(#${name})"${name === "grey" ? ' fill-opacity=".6"' : ""} stroke-linejoin="round"${slab ? ` stroke="url(#${ctx.gradient("edge")})" stroke-width=".5"` : ""}/>`; } },
};
const NAMES = Object.keys(PRIMITIVES).join(", ");

function defs(gradients) {
  const stop = ([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}"${opacity !== undefined ? ` stop-opacity="${opacity}"` : ""}/>`;
  return `<defs>\n${Object.entries(gradients).map(([id, g]) => `<linearGradient id="${id}" x1="${num(g.x1 ?? 0)}" y1="${num(g.y1 ?? 0)}" x2="${num(g.x2 ?? 1)}" y2="${num(g.y2 ?? 0)}">${g.stops.map(stop).join("")}</linearGradient>`).join("\n")}\n</defs>`;
}

function part(mark, spec, entry) {
  const [name, ...rest] = entry;
  const primitive = PRIMITIVES[name];
  if (!primitive) throw new Error(`marks.${mark}: no primitive "${name}" (${NAMES})`);
  const named = typeof rest.at(-1) === "object" && rest.at(-1) !== null ? rest.pop() : {};
  const args = { ...Object.fromEntries(primitive.args.map((key, i) => [key, rest[i]]).filter(([, v]) => v !== undefined)), ...named };
  const ctx = { gradient: (grad) => { const id = grad ?? spec.paint ?? "warm"; if (!spec.gradients?.[id]) throw new Error(`marks.${mark}: no gradient "${id}" in gradients`); return id; } };
  return primitive.render(args, ctx);
}

/** Every mark of the spec rendered: a Map of output file → SVG text, in the spec's order. */
export function renderFamily(spec, { from }) {
  const head = `<!-- generated by agentic-cms icons family from ${from}; do not hand-edit -->\n`;
  const grid = spec.grid ?? 64;
  const out = new Map();
  for (const [name, mark] of Object.entries(spec.marks ?? {})) {
    if (!mark?.out || !mark.size || !Array.isArray(mark.parts)) throw new Error(`marks.${name}: needs out (the file), size (px) and parts`);
    const body = mark.parts.map((entry) => part(name, spec, entry)).filter(Boolean).join("\n");
    const ring = mark.ring ? spec.ring : null;
    if (mark.ring && !ring) throw new Error(`marks.${name}: ring: true needs a ring block (size, radius, stroke, opacity, scale, offset)`);
    const svg = ring
      ? `<svg width="${num(ring.size)}" height="${num(ring.size)}" viewBox="0 0 ${num(ring.size)} ${num(ring.size)}" fill="none" xmlns="http://www.w3.org/2000/svg">\n${defs(spec.gradients)}\n<circle opacity="${num(ring.opacity)}" cx="${num(ring.size / 2)}" cy="${num(ring.size / 2)}" r="${num(ring.radius)}" stroke="${ring.stroke}"/>\n<g transform="translate(${num(ring.offset)} ${num(ring.offset)}) scale(${num(ring.scale)})">\n${body}\n</g>\n</svg>\n`
      : `<svg width="${num(mark.size)}" height="${num(mark.size)}" viewBox="0 0 ${grid} ${grid}" fill="none" xmlns="http://www.w3.org/2000/svg">\n${defs(spec.gradients)}\n${body}\n</svg>\n`;
    out.set(mark.out, head + svg);
  }
  return out;
}
