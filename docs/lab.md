# The lab — designing the site's own graphics

A site's authentic graphics — an icon beyond the families of `docs/icons.md`,
a mark beside copy, an illustration, a short 2D loop — are **SVG authored as
code**, designed in the lab and shipped **pre-rendered**: a file under
`public/images/` or inline `Icon` data, never a rendering library in the
reader's browser. The lab is a tool an agent opens when a drawing is needed
and removes when its files are rendered: nothing of it lives under `src/`,
in `package.json` or in a route. The flags are in
[commands.md](commands.md); the procedure is the `design-graphics` skill.

## Open, draw, look

```bash
pnpm kit lab new hero-mark --kind mark        # .parity/lab/hero-mark.svg from a template
pnpm kit lab serve                            # http://localhost:8001 and the LAN URLs
pnpm kit lab serve --scenes public/images/home --sizes 20,32   # reopen what a page ships
```

- **A scene is one SVG file** under `.parity/lab/` (gitignored, like every
  capture). `lab new` writes one to start from: `icon` is the `Icon`
  component's contract (the 24 grid, `stroke="currentColor"`, width 1.6,
  round caps — what `icons add file:<name>` will read), `mark` the 64 grid
  of the icon families, `loop` a CSS `@keyframes` on `transform` with the
  `prefers-reduced-motion` rule, one SMIL `<animate>`, and `data-duration`
  (one cycle, in seconds). The templates draw the wireframe's crossed box in
  `currentColor` and carry no colour, font or easing of any site.
- **`lab serve`** shows every scene on the site's own tokens — read from the
  `@theme` block of `src/app/globals.css`, so no build is needed and a
  fork's palette follows — **inline in a light and a dark box** (each box
  sets its own `color-scheme`, and `light-dark()`, `currentColor` and
  `var(--color-*)` resolve inside it), at the natural size and, for an
  icon-sized scene (up to 96 px wide), at `--sizes`; then **the same file as
  an `<img>`** on both grounds, which is what a page embedding the file
  really gets: `currentColor` is black, a `var()` without a fallback is the
  initial paint, and the scheme is the browser's, not the box's. A scrubber
  pauses every animation of the scene (SMIL and CSS alike) at a time and
  steps it by a frame; a saved file reloads the page.
- The server listens on `0.0.0.0:8001` by default and prints every LAN
  address, so the owner opens the same page on a phone; it serves only the
  scenes it listed and generated HTML — nothing else of the tree.
  `--host 127.0.0.1` keeps it on this machine.

## Drawing rules

- `viewBox` always, and the natural `width`/`height` on the root — the
  size a page will render it at; an icon on the 24 grid, a mark on 64.
- Colour: `currentColor` and `var(--color-ink|paper|fill|muted)` when the
  drawing ships inline (it then follows the theme toggle); a hex, or
  mid-tones that read on both grounds like the placeholder's grey, when it
  ships as an `<img>` — a render to `.svg` resolves the tokens for one
  scheme, and nothing inside an `<img>` follows the site's toggle.
- Motion: `transform` and `opacity` only (`transform-box: fill-box;
  transform-origin: center` on what turns or scales); ids, class names and
  keyframe names prefixed with the scene's name; an
  `@media (prefers-reduced-motion: reduce)` rule in every CSS loop; SMIL
  (`<animate>`) for a loop that ships as an `<img>`, where a page's CSS and
  JavaScript cannot reach.
- No text that needs a font the reader may not have; no raster inside an
  SVG that a design tool exported (`optimize-svg-rasters` says why).

## Close

```bash
pnpm kit lab clean          # removes .parity/lab; git status shows nothing of the lab
```

What stays is what a render wrote under `public/images/` (and, for an
inline icon, `src/config/icons/<name>.svg` with its `ICONS` entry).
