---
name: design-graphics
description: Draw the site's own graphics as SVG in the lab - an icon beyond the families, a mark beside copy, an illustration, an animated logo or brand mark, a short 2D loop - starting from the artwork the site already has, looked at on the site's tokens in both schemes, at the sizes it ships and enlarged, and on a phone (`pnpm kit lab serve`), checked frame by frame and as the embedded image, shipped pre-rendered as the file a page embeds or as inline Icon data (`pnpm kit lab render`, `pnpm kit icons add file:`), never as a rendering library in the reader's browser, its source kept and the lab closed after (`pnpm kit lab clean`). Use when a page needs a drawing the icon family's primitives cannot say, an animated mark, logo motion or a loop, a hero illustration, or when asked to make the site "more graphical", "more alive", "less template".
argument-hint: <what to draw> [where it goes: a section, the chrome, a post]
---

# Design graphics

A site's authentic graphics are SVG written as code, designed where they
can be judged — at the real size, on the real tokens, light and dark, on
the owner's phone — and shipped **pre-rendered**: a file under
`public/images/`, or inline `Icon` data. Speed and search come first, so
nothing renders in the reader's browser that a file could carry; the lab is
a tool opened for the drawing and gone once the files exist. The guide is
`docs/lab.md` (`node_modules/agentic-cms/docs/lab.md` on a site that
installs the kit); the pick goes through `design-options`, the merge
through `design-proof`; the notes on building motion in SVG are
[references/svg-motion.md](references/svg-motion.md).

## Read first

`STANDARD.md` §1 (the four tokens the drawing lives on), §4 (where a file
lives and how it is named; the families — a mark the primitives of `icons
family` can say is `design-icons`, not a drawing) and §8 (decisions already
made); `docs/lab.md` § Render (the table of what ships as what); the
section or component the graphic sits in (`grep -rn` its file under
`src/`), and the copy beside it — a drawing means what it stands next to.
For a mark that exists, the artwork itself: its master file (`site.logo` in
`src/config/site.ts`, `public/images/brand/`, or what the owner hands
over), its exact colours as written in that file, its proportions and
`viewBox`, where it is used and at which sizes, and every constraint
already stated. For anything that moves, `references/svg-motion.md`.

## Steps

1. **The artwork, then the form.** A mark that exists is the brief: its
   geometry stays recognisable, its colours are the file's (never
   re-picked from a screenshot), its master path is what rests and what
   every still shows. List where it goes, the sizes it ships at and the
   grounds it sits on before drawing. Then the form, from the table in
   `docs/lab.md`: an icon used across pages → inline `Icon` data (follows
   the theme toggle, no request); an illustration, diagram or mark → an
   `<img>` of a `.svg` (one scheme, so it must read on both grounds —
   mid-tones like the placeholder's grey, or a render per scheme); a short
   flat loop → an animated `.svg` in a `<picture>` with its still; a loop
   that must be zero-compute or shaded → an animated `.webp` in the same
   `<picture>`; a big hero loop → a `.webm` with its poster; an OG image
   stays a static JPEG. When the form is not obvious, ask the owner with
   the trade-off in one line each.
2. **Ideas from the parts.** Motion for a mark starts from its anatomy:
   the segments, the strokes, the counters and the negative space between
   them. Segments that separate, interweave and rebuild the mark; an inner
   shape that leaves and merges back into its cutout; nested forms that
   fold, trade places or open an aperture — each idea says what transforms
   and why that is this brand's move, not any logo's. A whole-mark fade,
   spin or pulse is not an answer on its own when the owner asks for
   complex motion; a subtle idea stays on the list when the placement
   wants calm (the chrome, a small size, a spot seen on every page).
   Choreograph with anticipation, separation, interaction, reassembly and
   a hold long enough to read the mark — tools to choose from, not a
   sequence every idea follows — with deliberate timing and continuity: a
   part leaves from where it rests and returns to where it belongs. The
   ideas go to the owner in one message (`design-options` step 2); an ask
   to build them all builds them all, with no second question.
3. **Draw.** `pnpm kit lab new <name> --kind icon|mark|loop` writes
   `.parity/lab/<name>.svg` on the kit's contracts; edit the file. The
   rules: `viewBox` and the natural `width`/`height`; `currentColor` and
   `var(--color-*)` when it ships inline, hex or mid-tones when it ships as
   an `<img>`; `transform` and `opacity` only, with an explicit
   `transform-box` and `transform-origin` on what turns; ids, class and
   keyframe names prefixed with the scene's name; a
   `prefers-reduced-motion` rule in every CSS loop; SMIL (`<animate>`) for
   a loop that ships as an `<img>`; no text that needs a font, no bitmap
   inside the SVG, no double hyphen in a comment. An icon for `Icon` is
   flat shapes with one paint on the 24 grid — no group, transform,
   `<use>`, `<defs>` or `<style>`. A mark that moves keeps the master path
   in the file and shows it at rest; the moving pieces exist for the move
   (the reference says how: origins, mask regions, seams, the rest frame).
4. **Look, then pick.** Two windows. `pnpm kit lab serve` and hand the
   owner the LAN URL it prints: the scene inline in a light and a dark box
   at its sizes, the same file as an `<img>` on both grounds (what an embed
   really gets), a scrubber over its animation, and a bare page at any
   width (`/scene/<name>?bare=1&scheme=dark&width=<px>`). And `pnpm kit
   lab route` then `/lab-demo` on the dev server: the same scenes on the
   site's own grounds — its page, its cards, its panels, as the route's
   `GROUNDS` list says — inside the real chrome, with the procedure written
   for the owner at the top; a scene that must sit on a surface is judged
   there. A loop is judged per candidate on light and dark, at every size
   it ships and once enlarged, with a replay, an animated / still switch
   and what a reduced-motion reader gets (the `<picture>`'s still); what
   the lab's page lacks of that — a size beyond 96 px, the enlargement,
   replay, the switch — goes on the route as a small control that leaves
   with it. The message carries the direct URL of the candidates, not the
   index. Candidates are scenes `a`, `b`, `c` beside the current version:
   two to four, or every idea when the owner asked for all
   (`design-options`). A letter names its candidate for the whole round:
   a "more" is a change on that file and a second look; alternatives the
   owner asks for beside an approved candidate join the same lab or route
   under the next letters, the approved file and every label left as they
   are (an experiment on it is a copy under a new letter). A saved file
   reloads the page.
5. **Check the frames, not only the ending.** A right final silhouette
   proves little. Scrub every candidate through its cycle, at the sizes it
   ships and enlarged: the parts in flight (no seam, gap, clipped edge or
   jump), the moment they meet, the hold, and the loop boundary — the last
   frame and the first are the same picture, and the rest frame is the
   master. Check the `<img>` the page will embed (the lab's second row,
   then the placed page), not the inline copy: an image has its own
   timeline and none of the page's CSS. The kit's commands drive Chromium;
   when Safari matters, run the same frames in WebKit as well and report
   them as WebKit — the owner's Safari, at the version they run, is the
   confirmation.
6. **Render and place.** `pnpm kit lab render <name> --out
   public/images/<page>/<file>` — `.svg` for the file, `--scale 2` for a
   retina still, `--animate --fps 12` for a loop (its still lands beside
   it, the `<picture>` fallback), `--scheme dark` for the dark render; or
   `--out src/config/icons/<name>.svg` then `pnpm kit icons add
   file:<name>` for inline `Icon` data. Place it with the image rules:
   `<img>` with `width`, `height`, `alt` and `loading="lazy"` (`EagerImage`
   above the fold), a loop inside the `<picture>` from `docs/lab.md`, a
   `.webm` with its `poster`, the OG image untouched. A loop on a page is a
   design change with its own commit; the wireframe's own pages place none
   (`STANDARD.md` §7).
7. **Keep the source, prove, close.** `lab clean` deletes `.parity/lab`
   and whatever else was left there, so the picked artwork's editable
   source goes into the tree first: `lab render` copies a raster's scene
   beside it; an `.svg` render resolves the tokens, so the scene goes
   beside it as `<name>.source.svg` when its `var()`s or `currentColor`
   matter; a script that computed the geometry is the source, committed
   outside `public/` with the command that regenerates the scene in its
   first comment. Then `design-proof` (a `<picture>` loop is still under
   the harness's reduced motion; a `<video>` is not — re-run that frame
   once); `pnpm kit lab clean` (the lab and the route; a route left in the
   tree fails the build's SEO audit, on purpose); `git status` shows
   nothing of the lab, only the files a page ships, their sources and, for
   an icon, its source under `src/config/icons/`. Record the family, the
   form or where sources live in `STANDARD.md` §4 when the site will reuse
   it.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # the SEO audit reads every <img>
pnpm kit lab render <name> --out <file> --json              # the report: size, frames, bytes, the console
pnpm kit lab render <name> --out .parity/frames/<name>-<s>.png --at <s> --scale 4 --no-source   # a frame between, enlarged; the rest frame against the master
pnpm kit visual-parity capture before --ref develop && pnpm build && pnpm kit visual-parity capture after && pnpm kit visual-parity compare before after --json
pnpm kit lab clean && git status --short                    # nothing of the lab, no src/app/lab-demo; the picked source kept
```

## Stop for the user

The form (step 1) when it is not obvious; the ideas (step 2), unless the
ask already said to build them all; the pick (step 4); the look at the
placed graphic on the dev server; the merge.
