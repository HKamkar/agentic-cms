# Icons

Three kinds of icon live on a site, and each is a family, not a drawing at
a time: **line icons** for the chrome and the cards' glyphs, **other
companies' marks** for a stack or a social network, and **the site's own
marks** beside copy. The kit ships no icon data — a licence question a
kit should not answer for a site — but it ships the mechanism for each,
the `Icon` component that renders the first two, and the inventory that
starts the job. The `design-icons` skill is the procedure.

## The map: Lucide and Simple Icons

The site installs the sets it draws from (`pnpm add -D lucide-static
simple-icons`: Lucide, ISC, 2000 line icons; Simple Icons, CC0, 3000
brand marks) and keeps a manifest of the ones it uses:

```bash
pnpm kit icons add lucide:house lucide:database si:nvidia    # src/config/icons.json, src/config/icons.ts
pnpm kit icons remove si:nvidia
```

`src/config/icons.json` is the list of ids; `src/config/icons.ts` is
generated from it — every shape of the icon file (rect, circle, ellipse,
line, polyline, polygon, path) as path data on the 24 grid, and each set's
licence in the header — and never edited by hand (`add` of an id already
there is a no-op, so it also regenerates). The component:

```tsx
import { Icon } from "agentic-cms/components";
import { ICONS } from "@/config/icons";

<Icon {...ICONS["lucide:house"]} size={20} className="text-accent" />       // stroke 1.6, currentColor, aria-hidden
<Icon {...ICONS["si:nvidia"]} size={26} title="NVIDIA" />                    // a fill mark, named
```

One stroke width for a family of line icons; one ink for a set of marks.

## The site's own marks: `icons family`

The marks beside copy — a benefit, a conviction, a reason — are one family
drawn in the language of a reference mark the site keeps, and generated
from primitives so a new mark is a composition, never a new drawing style:

```yaml
# src/config/icon-family.yaml   (not under content/: the content lint reads every folder there as a collection)
grid: 64
gradients:
  warm:  { x2: 1, y2: 0, stops: [["0", "#E8734A"], [".5", "#F3B27A"], ["1", "#E8734A"]] }
  glass: { x2: 1, y2: 1, stops: [["0", "#fff", ".34"], ["1", "#fff", ".16"]] }
  grey:  { x2: 1, y2: 1, stops: [[".45", "#66687D"], ["1", "#9F9494", ".9"]] }
  edge:  { x2: 0, y2: 1, stops: [["0", "#fff"], ["1", "#fff", "0"]] }
paint: warm                                        # the default gradient of tile, disc, ring and poly
ring: { size: 40, radius: 19.5, stroke: white, opacity: .5, scale: .34375, offset: 9 }
marks:
  perimeter: { out: public/images/use-cases/benefit-perimeter.svg, size: 33, parts: [[glass, 4, 4, 56, 56, 9], [tile, 19, 19, 26, 26, 5]] }
  compliance: { out: public/images/use-cases/benefit-compliance.svg, size: 33, parts: [[glass, 4, 4, 56, 56, 9], [tile, 13, 13, 38, 38, 6], [stroke, "M22 32 L29 39 L42 25", 4.4]] }
  medal: { out: public/images/home/track-record.svg, size: 24, parts: [[tile, 20, 34, 11, 26, 2.5, { rot: 14, cx: 25.5, cy: 47 }], [disc, 32, 23, 17], [glassDisc, 32, 23, 8]] }
  control: { out: public/images/about/own-control.svg, size: 40, ring: true, parts: [[glass, 6, 13, 52, 6, 3], [disc, 42, 16, 7.5]] }
```

```bash
pnpm kit icons family src/config/icon-family.yaml            # writes every out file
pnpm kit icons family src/config/icon-family.yaml --check    # exit 1 when a file on disk differs
```

The primitives, on the grid: `tile(x, y, w, h, rx=5, grad, rot, cx, cy)`,
`glass(x, y, w, h, rx=4.85, rot)`, `grey(…)`, `disc(cx, cy, r, grad)`,
`glassDisc(cx, cy, r)`, `ring(cx, cy, r, w, grad)`, `glassRing(cx, cy,
r, w)`, `stroke(d, w=3.2, color="#fff", grad)`, `poly(points, grad)`. A
part is `[primitive, …args]` with an optional `{ named }` object last;
`glass`, `grey` and `edge` are the gradients the slab primitives paint
with; `paint` is the default of the others. A `ring: true` mark is drawn
inside the ring block's canvas, scaled. Every file starts with a
"generated … do not hand-edit" comment. Solid shapes survive at 24–40 px;
thin strokes do not.

## The inventory: `icons audit`

```bash
pnpm build && pnpm kit icons audit [--pages /,/about] [--json]
```

Every `<img>` rendered at 96 px or less and every inline `<svg>` on the
built pages, with its rendered size, colour, section, nearest heading, the
copy beside it and a selector — as `.parity/icons/audit.json`, grouped by
file (`files: { src: { uses, pages } }`), and as a sheet
(`.parity/icons/audit.png`, one row per page, every icon labelled with its
copy). A report of one template glyph is a report of the class; the audit
is the class.

## In `STANDARD.md`

§4 names the site's families once they exist: the reference mark, the spec
the family is generated from, the stroke width of the line icons, the ink
of the marks — so the next icon is drawn in a language that already exists.
