---
name: design-icons
description: Give a site its icons as families, not one drawing at a time - inventory every icon on the built pages beside the copy it sits with (`pnpm kit icons audit`), pick a family per kind with the owner (line icons from Lucide, other companies' marks from Simple Icons, the site's own marks generated from primitives), add them with `pnpm kit icons add` or render them with `pnpm kit icons family`, and prove the change. Use when an icon "looks like a template", "means nothing", is inconsistent with its neighbours, or when a section, the chrome or a card set needs icons.
argument-hint: [which icons: a section, the chrome, all of them]
---

# Design icons

One instance means the class: a report of one template glyph is a report
of every icon of its kind. The job starts with the inventory, picks a
family per kind with the owner, and lands the family in one change.
`docs/icons.md` of the kit is the guide; `STANDARD.md` §4 names the site's
families once they exist.

## Read first

`STANDARD.md` §4 (the families the site already has, and the reference mark
a family is drawn in the language of); `docs/icons.md`; where the icons
render (`src/components/`, the `icon` fields of `content/pages/*.yaml`).

## Steps

1. **Inventory.** `pnpm build` then `pnpm kit icons audit` — every `<img>`
   up to 96 px and every inline `<svg>` on every page, with its rendered
   size, colour, section, heading and the copy beside it, as
   `.parity/icons/audit.json` and a sheet, one row per page. Group them by
   kind: the chrome's line icons, the marks beside copy, other companies'
   logos, illustrations. A file used on three pages is one decision.
2. **A family per kind**, chosen with the owner (`design-options`):
   - **Line icons** (navigation, the chrome, a card's glyph): Lucide,
     through `pnpm kit icons add lucide:<name>…` — the site installs
     `lucide-static`, the manifest `src/config/icons.json` lists the ids,
     the generated `src/config/icons.ts` carries the paths and the licence,
     and `<Icon {...ICONS["lucide:house"]} size={20} />` renders one in the
     current colour. One stroke width for the whole family.
   - **Other companies' marks** (a stack, an integration, a social network):
     Simple Icons, `pnpm kit icons add si:<slug>…`, `kind: "fill"`, one ink
     for the whole set; a trademark stays its owner's.
   - **The site's own marks** beside copy (a benefit, a conviction, a
     reason): one family generated from primitives in the language of the
     site's reference mark — a spec (`src/config/icon-family.yaml` — not under `content/`, whose
     folders the lint reads as collections: the gradients, the default
     paint, the ring, one entry per mark with its parts) and `pnpm kit icons family <spec>`; a new mark is a composition
     in the spec, never a new drawing style. Solid shapes at the sizes the
     marks render at: thin strokes below about 40 px do not survive.
   - Every icon means the copy it sits beside; a glyph that says
     "something technical" is a template glyph.
3. **Candidates on a sheet** at the real size, on the real background, the
   current icon first: `pnpm kit sheet` with `img:` cells for what is there
   and `svg:` cells (a Lucide file inlined, a generated mark) for the
   candidates; the owner picks by row.
4. **Land the family**: the `add` or the `family` run, the components on the
   map or the files, the `icon` fields of the page files; `pnpm kit icons
   family <spec> --check` and `pnpm kit icons audit` again — the inventory
   is the proof the class is covered.
5. **Prove and record**: `design-proof` (the changed sections `CHANGED`
   within their rows, nothing else); `STANDARD.md` §4 names the families
   and the spec; the manifest and the spec are committed, the generated
   map and files with them.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build
pnpm kit icons family src/config/icon-family.yaml --check   # when the site has a family
pnpm kit icons audit --json                               # the class, covered
```

## Stop for the user

The family per kind (step 2) and the picks (step 3); a mark the owner names
as the reference is never redrawn.
