# shot, probe, sheet — one command instead of a script

Three commands for the questions that come up while designing on a site, each
one call where an agent used to write a Playwright script: **a picture of a
section or an element** (`shot`), **the numbers behind a screenshot claim**
(`probe`), and **a sheet of candidates for the owner to pick from** (`sheet`).
The flags and exit codes are in [commands.md](commands.md); this page is the
recipes.

All three run against the site in the current directory: the production
build under `.next` is served by the harness's own server (`pnpm build`
first), or `--url http://localhost:8000` points them at a dev server. A page
is prepared the way the screenshot harness prepares one
([visual-parity.md](visual-parity.md)): fonts loaded, every reveal at its end
state under reduced motion, one scroll-through, every image loaded — so a
`shot` shows a section the way a static capture would. `--motion` leaves the
animations to play instead, for a picture or a measurement of a reveal
mid-flight; either way the images are touched only once the page has
hydrated, so a dev server's console shows the site's errors, not the
harness's.

## `shot` — a picture with its box

```bash
pnpm kit shot /                                  # the whole page at 1440, .parity/shots/home@1440.png
pnpm kit shot /about --width 390 --scheme dark   # a phone width, the dark theme
pnpm kit shot / --heading "fits the stack" --scale 2 --json
pnpm kit shot / --select ".card" --index 2 --pad 0 --out out/card.webp
```

- `--heading <regex>` photographs the section (or article, or any
  `[data-section]`) that holds the first heading matching the pattern;
  `--select <css>` the first match of a selector (`--index` for another);
  both together the selector's match inside that section (`--heading "fits
  the stack" --select ".stack-row"`). The crop keeps `--pad` px around the
  element's box.
- `--transparent` isolates the element: everything that is neither its
  ancestor nor its descendant is hidden and the ancestors' backgrounds are
  cleared, so the picture is the element alone on a transparent ground. With
  `--trim` (the transparent edges cut) and `--resize <w>`, this regenerates a
  static picture of a live drawing — a phone-width composite of a section the
  desktop renders live, say — in one line:

  ```bash
  pnpm kit shot / --url http://localhost:8000 --heading "fits the stack" --select ".stack-row" --scale 2 --pad 4 --transparent --trim --resize 1305 --out public/images/home/stack-phone.webp
  ```

- `--json` prints the element's box on the viewport and on the page, the
  output file and its size, and the console's errors — the numbers an agent
  reads instead of the picture.

## `probe` — measure, don't guess

A screenshot claim ("unaligned", "appears too early", "looks broken") is a
measurement waiting to be taken. `probe` prints JSON only:

```bash
pnpm kit probe / --heading "built for"                  # the section: box, computed styles, stacking contexts
pnpm kit probe / --select "li.card" --all               # every card
pnpm kit probe / --select ".hero img" --props "object-fit,aspect-ratio"
pnpm kit probe /use-cases --select "[data-ix=shape-1]" --motion --timeline 3000 --every 200
```

For each element: its `box` (viewport) and `pageBox`, the `computed` values
that decide layout and paint (opacity, transform, position, z-index, display,
visibility, overflow, colours, type, size, margin, padding — `--props` adds
more), and `stacking`: the chain of stacking contexts above it, nearest
first, each with the property that creates it. That chain is the answer to
the harness's commonest surprise — a `position: relative; z-index` on a
section's copy that flips how everything below it is rasterised.

With `--motion --timeline <ms>` the element is scrolled into view and its
opacity, transform and top are sampled every `--every` ms: whether a reveal
fires, when, and how far it travels. Always included: `reveals.pending`, the
elements with a reveal start-state class (`ix-init--*`, `ix-main-init--*`)
still below opacity 1 after the page was prepared (under reduced motion that
list must be empty: a reveal that never fires shows up here), and
`console`, the page's errors and warnings.

Exit 1 when nothing matches, with the selector or heading named.

## `sheet` — candidates the owner picks by row

When the owner has to choose a look for an asset — an icon set, a mark, a
chip — the candidates go on one sheet at the size and on the background the
section really uses, rows lettered and cells numbered, so the pick is a
row's letter and a cell's number ("B2", "the alternate"). One preview round,
one build.

```yaml
# .parity/icons.yaml
name: sector icons
background: "#000220"          # or var(--color-paper); the site's tokens are available
color: "#fff"
rows:
  - label: now
    note: what the cards render today
    size: 40
    cells:
      - { label: health, img: /images/use-cases/health.svg }
      - { label: finance, img: /images/use-cases/finance.svg }
  - label: alternate
    note: line icons, stroke 1.6
    size: 40
    cells:
      - { label: health, svg: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.6'>…</svg>" }
      - { label: finance, file: candidates/finance.svg }
      - { label: chip, html: "<span class='font-label border border-ink px-2'>tag</span>" }
```

```bash
pnpm kit sheet .parity/icons.yaml            # .parity/sheets/sector-icons.png at 2x
```

A cell is one of `file` (an SVG file, inlined), `svg` (inline markup),
`html` (any markup — the site's compiled stylesheets are linked when a build
exists, so utilities and tokens are the site's own) or `img` (a served path,
from the build or `--url`). A cell may carry its own `size` and `ground`
(`{ background, color }`: the ground and the ink a `currentColor` drawing
takes). Every inline SVG's ids are made its cell's own, so one file shown at
three sizes never borrows another copy's mask, clip path or gradient. The
first row is by convention "now": what is there today, beside the
alternatives. `--json` prints the file and the rows.

A set of SVG files at the sizes they ship and on the grounds they sit on is
one `files:` row — a folder (walked for `.svg`) or a list — which becomes one
row per file, a cell per size and ground:

```yaml
name: icon round
rows:
  - label: study
    files: .parity/lab/rounds/modules
    sizes: [24, 36, 96]
    grounds:
      - { background: "var(--color-paper)", color: "var(--color-ink)" }
      - { background: "#fff", color: "#000" }
      - { background: "#000", color: "#fff", label: black }
```

A sheet is for static candidates. A component with motion or hover — a
footer, a menu — is judged on a throwaway demo route on the dev server
instead, and a pick from a sheet is not the owner's look at the built thing:
build it, show it, ask, then merge.
