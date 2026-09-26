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
pnpm kit lab serve --sizes 32,160              # every scene also at the sizes it ships at
pnpm kit lab serve --scenes public/images/home --sizes 20,32   # reopen what a page ships
```

- **A scene is one SVG file** under `.parity/lab/` (gitignored, like every
  capture). `lab new` writes one to start from: `icon` is the `Icon`
  component's contract (the 24 grid, `stroke="currentColor"`, width 1.6,
  round caps — what `icons add file:<name>` will read), `mark` the 64 grid
  of the icon families, `loop` a CSS `@keyframes` on `transform` with the
  `prefers-reduced-motion` rule, one SMIL `<animate>`, `data-rest` (the
  time, in seconds, of the frame a reduced-motion reader and a static
  capture see — the screenshot harness holds an inline SMIL clock there)
  and `data-duration` (one cycle, in seconds). The templates draw the
  wireframe's crossed box in
  `currentColor` and carry no colour, font or easing of any site.
- **`lab serve`** shows every scene on the site's own tokens — read from the
  `@theme` block of `src/app/globals.css`, so no build is needed and a
  fork's palette follows — **inline in a light and a dark box** (each box
  sets its own `color-scheme`, and `light-dark()`, `currentColor` and
  `var(--color-*)` resolve inside it), at the natural size and at
  `--sizes` — the sizes it ships at, for a scene of any width; without the
  flag an icon-sized scene (up to 96 px wide) is shown at 24, 40 and 64 and
  a bigger one at its own size — and **enlarged**, one pair that fits the
  screen up to 640 px wide (none for a scene already that wide); then
  **the same file as an `<img>`** on both grounds, which is what a page
  embedding the file really gets: `currentColor` is black, a `var()`
  without a fallback is the initial paint, and the scheme is the
  browser's, not the box's. A saved file reloads the page.
- A scene that moves gets the **timeline** (§ Inspecting motion) over
  every inline copy, the enlarged ones too: Play / Pause, Replay, a range
  over one cycle, the time and the cycle in seconds. Its **Replay** also
  restarts the `<img>` copies, which no timeline can drive — an animated
  image restarts only as a new image, so every copy moves to one new URL
  (`?replay=<n>`); one URL for all of them keeps them sharing one image,
  as a page that embeds the file at several sizes does, so a shared-image
  repaint problem stays visible (a URL per copy would hide it).
  **animated · still** switches the whole page to the scene with its
  animation stripped (`/scene/<name>?still=1`: the `-still.svg` a render
  writes beside a loop, the `<picture>`'s fallback, what a reduced-motion
  reader gets), inline and as the `<img>`; the switch is in the URL, so a
  reload on save keeps it.
- Each scene has its own page (`/scene/<name>`, the URL to hand over) and
  a bare one at any width (`/scene/<name>?bare=1&scheme=dark&width=512`,
  `&still=1` for its still).
- The server listens on `0.0.0.0:8001` by default and prints every LAN
  address, so the owner opens the same page on a phone; it serves only the
  scenes it listed and generated HTML — nothing else of the tree.
  `--host 127.0.0.1` keeps it on this machine.
- The second window is the route (below): the same scenes on the site's
  real grounds, inside its chrome, on the dev server.

## The route — the lab on the site's theme

The lab's page shows a scene on the site's tokens, in a light and a dark
box. To judge it on the site's real theme — its background, its type, its
surfaces, next to the real chrome — there is a second window: a throwaway
route inside the site.

```bash
pnpm kit lab route          # src/app/lab-demo/page.tsx from the kit's template
pnpm dev                    # then /lab-demo (on the LAN address too)
pnpm kit lab clean          # removes the route with the lab
```

The route renders `LabScenes` from `agentic-cms/lab`: every scene under
`.parity/lab` (and the `folders` given, like `--scenes`) inline on the
**grounds** the site passes — `{ label, Frame }` pairs, a Frame being any
component that wraps children in one of the site's surfaces — at the
scene's size and, for an icon-sized one, at `sizes` (24 / 40 / 64 by
default). `currentColor` is each ground's ink and the `var()` tokens are
the site's, because the drawing is inline in the site's own document; the
site's theme toggle flips the page ground and leaves a white card white,
which is the point. The template starts with two grounds every site has —
the page and a white card — and the site adds its own (a card, a panel, a
dark band): keep them in a file of your own that the route imports, since
`lab clean` deletes the route. The files are read on every render, so a
save in the lab is a refresh here. Every copy's ids are its own, and an
animated scene gets a timeline of its own (§ Inspecting motion) — its
controls, its cycle, one clock for all its copies.

The page opens with the procedure for the person looking at it (the
component renders it; `intro={false}` hides it, children add the site's
note): what a scene is, the two windows, the loop, and the commands. The
loop, in short — say what you want and where it goes; the agent draws two
to four candidate scenes; pick one by its name on the page and ask for
changes, the agent edits the file, refresh; the pick ships pre-rendered
(`lab render`, or `icons add file:`) and is placed in its section; `lab
clean`.

The route is a plain server component, not `force-dynamic`: `next dev`
renders it on every request anyway, and `next build` prerenders it, where
the SEO audit fails it (`FAIL /lab-demo canonical: missing`, …) — the guard
that keeps it out of a merge. `init` does not ship it; `lab clean` removes
only a route that imports `agentic-cms/lab` and names any other — and,
with it, `next dev`'s generated route types (`.next/dev/types/validator.ts`)
while they still name the route: the production build's type check reads
them and would fail on a page that is gone (any removed route does this;
`next dev` writes the file again).

## Inspecting motion — the timeline

An animation is judged frame by frame, not only as it plays, and every
animated preview the kit shows — the lab's page, the lab route, a design
round's demo route — has the same controls for it, the one timeline of
`agentic-cms/lab` (`mountTimeline`; `LabTimeline` on a route):

- **Play / Pause**, **Replay** (from 0), and a **range over one cycle**,
  with the time and the cycle in seconds beside it. A press on the range
  pauses and holds the frame; a drag or a tap seeks; focused, the arrow
  keys step it by 0.01 s (Home and End go to the ends). Play resumes from
  where the range stands. The controls are labelled (the group is
  "<name>: timeline", the range "Time" with the seconds as its value
  text), keep a visible focus ring, and are 44 px tall for a finger.
- **One clock per animation.** A timeline drives the animation it wraps
  from one `requestAnimationFrame`: each inline SVG's own timeline is paused
  and set with `setCurrentTime()`, each CSS or Web Animation of an element
  inside an SVG — or inside a `data-lab-drive` element, for motion made of
  HTML and CSS — paused and set by `currentTime`, each lab frame sought.
  Nothing else under it is touched: wrapped around a whole section, it
  leaves the section's reveals (`Fx`, `OnView`) on their own clock, where
  driving them replayed each reveal every cycle and folded it flat on a
  scrub, and they do not count towards the cycle. The copies of one animation — its
  sizes, its colour variants, its grounds — show the same frame whether
  they are on screen or not; left to run on their own, SVG timelines
  drift (WebKit advances visible and offscreen ones differently). Two
  timelines on a page are independent: their own controls, their own
  cycle. The frame callback stops on pause, on a cycle of 0 (the controls
  are disabled) and when the component unmounts, and the readout is
  written at most ten times a second, apart from the frames.
- **The cycle is read, not restated**: `data-duration` on the root, else
  the longest SMIL `begin` + `dur` and CSS delay + duration in the file
  (`sceneDuration()`); a timeline given none measures what it holds.
- **Reduced motion**: a reader who prefers it gets every timeline paused
  on its first frame until they press Play, and a scene's own
  `prefers-reduced-motion` rule still applies inside it.
- **Inline copies, not the `<img>`.** An animated file inside an `<img>`
  runs in its own document, which the page cannot pause or seek; a
  timeline inspects inline copies of the file, and the file itself stays
  what ships. Every inline copy's ids are renamed for it
  (`namespaceIds()`: masks, clip paths, gradients, `<use>` and `href`
  targets, SMIL begin/end references, `#id` selectors), so copies never
  resolve each other's references. Only SVG the repository owns goes
  inline: a file under the site's root, outside `node_modules`, with no
  script, event handler or `javascript:` URL (`readTrustedSvg()` refuses
  anything else).

On a **demo route** (`pnpm kit demo new`, the `design-options` round), an
animated candidate gets the same inspection. A file — a mark, a loop — is
a `LabStudy`: the file inline at the sizes it ships at, on the grounds
the route passes, under one timeline, with the still a render wrote
beside it and a link that downloads the original:

```tsx
import { LabStudy, LabTimeline } from "agentic-cms/lab";

<LabStudy file="public/images/brand/mark-a.svg" label="A" sizes={[32, 160]} grounds={GROUNDS} />

// a candidate whose motion is its own markup or CSS: wrap it
<LabTimeline label="B"><CandidateB {...props} /></LabTimeline>
```

`LabStudy` reads the file, so it belongs in the route (a server
component), not inside a client component; `LabTimeline` wraps whatever
the route renders, and drives the inline SVGs and their animations inside
it, plus whatever carries `data-lab-drive` — a candidate whose motion is
HTML and CSS puts the attribute on its moving part — while the page's
reveals around them keep their own clock (an `<img>` inside it stays out
of reach). Candidates that are
different animations get a timeline each; the copies of one animation
share one. The route and its studies leave with `demo clean`, like every
candidate.

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
- A mark that moves starts from its master file — its path data, colours
  and proportions as they came — and shows that master at rest, in the
  hold and in every still; the moving pieces exist for the move, and where
  they come together the join is designed frame by frame — an overlap
  grown along the internal boundaries, the pieces opaque until the master
  is fully present, never a crossfade between overlapping solid copies.
  The notes on origins, mask regions, joins and seams, the handoff, the
  rest frame, the loop boundary and an animated `<img>` are the skill's
  reference,
  [svg-motion.md](../.claude/skills/design-graphics/references/svg-motion.md).

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
| a loop that should start when it is seen, stop off screen and rest for reduced motion | the `.svg` inline: `readInlineSvg` at build, `InlineAnimation` on the page (below) | the page runs its SMIL clock | one scheme (tokens resolved), or the page's own when the scene is used as drawn |
| a loop that must be zero-compute, or is shaded | an animated `.webp` (`--animate`) in the same `<picture>` | none | one scheme |
| a big hero loop | a `.webm` in `<video muted autoplay loop playsinline poster="…-still.webp">` | none | — |
| an OG image | a static 1200×630 JPEG, as always | | |

- **`.svg`** needs no browser: `currentColor` and `var(--color-*)` become
  the hex of `--scheme` (read from the site's tokens), `light-dark()` keeps
  that side, the animation is kept, and so are `data-duration` and
  `data-rest` on the root (a page that puts the file inline, and the
  screenshot harness, read them). Nothing inside an `<img>` follows the
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

## Inline — a loop the page runs

An `<img>` runs its SVG on a clock of its own: it plays from load, off
screen too, and cannot rest for a reader who prefers reduced motion. A loop
that should start when it is seen ships inline instead, in two pieces:

```tsx
// src/components/sections/render.tsx — read when the page is built, never at request time
import { readInlineSvg } from "agentic-cms/content";
"platform-benefits": withData(PlatformBenefits, () => ({ loop: readInlineSvg("public/images/platform/loop.svg", { prefix: "benefits" }) })),

// the section — a client component from agentic-cms/ix
import { InlineAnimation } from "agentic-cms/ix";
<InlineAnimation markup={loop} className="aspect-[5/4] w-full" />
```

- **`readInlineSvg(file, { prefix })`** (`agentic-cms/content`, server code
  and build time) reads an SVG the site owns — a path under its root,
  outside `node_modules`; one that carries a script, an event handler or a
  `javascript:` URL is refused — drops its prolog and comments, and
  prefixes every id (references follow), so two drawings on one page never
  resolve each other's masks or gradients. On a standalone Node host the
  file stays in `public/`, which `agentic-cms assemble` copies into the
  package whatever the build's file trace did with it
  ([deploy.md](deploy.md)).
- **`InlineAnimation`** (`agentic-cms/ix`) puts the markup in an
  `aria-hidden` box that the svg fills. It waits on its first frame until
  the box scrolls into view, plays from the start on each entry (once it
  has left the viewport entirely, as the reveals do; `offset` is how far
  in, in percent), pauses off screen, and shows the frame at `data-rest`
  to a reader who prefers reduced motion — the frame the screenshot
  harness holds too. A scene carries `data-duration` and `data-rest` on its
  root (the `loop` template has both; `lab render` keeps them).
- The file is the scene rendered for one scheme (`--out x.svg`), or the
  scene itself when it should paint in the page's ink and tokens — inline,
  `currentColor` and `var(--color-*)` follow the page, which an `<img>`
  never does.

## Close

```bash
pnpm kit lab clean          # removes .parity/lab and src/app/lab-demo; git status shows nothing of the lab
```

What stays is what a render wrote under `public/images/` (and, for an
inline icon, `src/config/icons/<name>.svg` with its `ICONS` entry). `lab
clean` deletes everything under `.parity/lab`, so the picked artwork's
editable source goes into the tree before it: a raster's render already
copies its scene beside it; an `.svg` render resolves the tokens, so the
scene goes beside it as `<name>.source.svg` when its `var()`s matter; a
script that generated the geometry is committed outside `public/` with
the command that regenerates the scene.
