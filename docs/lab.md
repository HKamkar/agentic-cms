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

## Render — what a page ships

```bash
pnpm kit lab render hero-mark --out public/images/home/hero-mark.svg              # the file, tokens resolved for the light scheme
pnpm kit lab render hero-mark --out public/images/home/hero-mark.webp --scale 2   # a still, transparent, 2× for retina
pnpm kit lab render spin --out public/images/home/spin.webp --animate --fps 12    # a loop as an animated WebP, no ffmpeg
pnpm kit lab render hero --out public/images/home/hero.webm --animate --background paper   # a WebM through ffmpeg
```

The extension of `--out` picks the format; every render is deterministic —
the scene's clock is set frame by frame, never read from the wall.

| Graphic | Ship as | Runtime | Theme |
|---|---|---|---|
| a line icon used across pages | inline `Icon` data from the scene (`icons add file:<name>`) | none | follows the toggle |
| an illustration, a diagram, a mark | `<img src="….svg">` — `--out x.svg`, the tokens resolved for one scheme | none | one scheme, so it must read on both grounds |
| a short 2D loop, flat | the animated `.svg` as an `<img>` inside a `<picture>` with its still | none (the browser's image pipeline) | one scheme |
| a loop that must be zero-compute, or is shaded | an animated `.webp` (`--animate`) in the same `<picture>` | none | one scheme |
| a big hero loop | a `.webm` in `<video muted autoplay loop playsinline poster="…-still.webp">` | none | — |
| an OG image | a static 1200×630 JPEG, as always | | |

- **`.svg`** needs no browser: `currentColor` and `var(--color-*)` become
  the hex of `--scheme` (read from the site's tokens), `light-dark()` keeps
  that side, the animation is kept. Nothing inside an `<img>` follows the
  site's theme toggle, so an asset that must follow it is `Icon` data; a
  render of a scene drawn in the page's ink into `public/` says so in a
  `note` line (on the example's dark page such a file is black on black).
- **`.webp` / `.png` / `.jpg`** are a still at `--at` seconds, on a
  transparent ground unless `--background paper` (a `.jpg` is always on
  the paper), at the scene's width or `--width`, times `--scale`; WebP is
  lossless like every placeholder, `--lossy` for a photograph-like one.
- **`--animate`** renders one cycle — `data-duration`, else what the
  animations declare, else `--duration` — at `--fps` as an **animated
  WebP** (sharp; no ffmpeg) or, for `.webm` / `.mp4`, through **ffmpeg**:
  a system build writes VP9 with alpha (and H.264 for `.mp4` when it has
  `libx264`); without one, the small build in Playwright's cache
  (`pnpm exec playwright-core install ffmpeg`) writes VP8 on the paper only,
  and the command says so. `--frames` caps the count; `--reduced` renders
  what a reduced-motion reader gets.
- **Every loop writes its still beside it** (`<name>-still.webp`, or
  `-still.svg` for an animated `.svg`) and every raster its **source**
  (`<name>.svg`, the scene itself), unless `--no-poster` / `--no-source`;
  reopen a shipped file with `lab serve --scenes public/images/<page>`.

An animated file inside an `<img>` does not stop under
`prefers-reduced-motion` — CSS and SMIL alike, the media query is not
evaluated inside an image document — so a loop ships as a `<picture>` that
picks the still for such a reader, with no script:

```html
<picture>
  <source srcset="/images/home/spin.webp" type="image/webp" media="(prefers-reduced-motion: no-preference)">
  <img src="/images/home/spin-still.webp" width="64" height="64" alt="" loading="lazy">
</picture>
```

The inner `<img>` carries `width`, `height`, `alt` and `loading` like
any other picture (the SEO audit reads it as one), and the parity harness,
which captures under reduced motion, photographs the still. A `<video>`
needs its `poster` and is never held still by the harness: re-run such a
frame once, as a motion frame. The wireframe's own pages place none of this
(`STANDARD.md` §7); on a site, a loop is a design change with its own
commit and its own proof.

## Close

```bash
pnpm kit lab clean          # removes .parity/lab; git status shows nothing of the lab
```

What stays is what a render wrote under `public/images/` (and, for an
inline icon, `src/config/icons/<name>.svg` with its `ICONS` entry).
