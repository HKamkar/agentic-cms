# SVG motion — implementation notes

What the `design-graphics` skill means by a scene that moves well, written
as defaults with their reasons. A workaround for one engine's bug is
applied when that bug is seen in the engine that matters, never as a rule
for every scene.

## Coordinates and origins

- One coordinate system, said out loud: the scene's `viewBox`, and the
  master artwork placed in it by one `<g transform>` rather than by
  rewriting its path data. Keep the master's path data as it came — an
  optimiser pass that rounds coordinates changes the mark.
- A CSS transform on an SVG element turns about `transform-origin`
  measured in its `transform-box`, whose default is the viewport: the
  origin is the `viewBox`'s 0,0, not the part's centre. Write both:
  `transform-box: fill-box; transform-origin: center` for a part that
  turns about itself, `transform-box: view-box; transform-origin: <x>px
  <y>px` (in `viewBox` units) for a pivot elsewhere. Engines have differed
  on the implicit values; explicit ones agree.
- SMIL has no origin: rotate with `values="0 cx cy; 180 cx cy"`, scale
  about a point as translate · scale · translate on nested `<g>`s. One
  `animateTransform` per element — a second one, and the element's own
  `transform` attribute, are replaced unless `additive="sum"`. An outer
  `<g>` for the travel, an inner one for the turn: each reads on its own
  on the timeline.

## Masks and clips

- A mask's or a filter's region defaults to the masked element's bounding
  box plus 10% a side; anything outside it is cut at a straight edge. A
  part that travels past the mark's outline needs
  `maskUnits="userSpaceOnUse"` (or `filterUnits`) with `x`, `y`, `width`,
  `height` covering the whole travel.
- An aperture that opens or a cutout a shape leaves and re-enters is a
  shape inside a mask, animated like any other part (white shows, black
  hides). At rest the master's own cutout — its `fill-rule` or subpath —
  takes over again.

## Edges and seams

- Two shapes that abut are antialiased separately, and a hairline of the
  ground shows along the joint: worst at small sizes and on the dark
  ground. Overlap the pieces slightly under the joint, or draw them as one
  path while they touch.
- A clip or mask edge that crosses a moving part reads as a glitch. Put a
  cut where the master already has an edge, or move the mask with the part.
- Leave `shape-rendering` at `auto`; `crispEdges` steps every diagonal.

## Rest is the master

- The pieces exist for the move. At rest — the first frame, the hold, the
  last frame — the master path shows, exactly as it came, and the pieces
  are hidden (a discrete `<set>`, or `calcMode="discrete"` on `opacity`, at
  the keyTime where they meet). Reassembled pieces are almost the mark:
  rounding, seams and antialiasing show at the hold.
- The still (`-still.svg`, the `<picture>` fallback, the reduced-motion
  render) is the master. A `-still.svg` is the file with every animation
  stripped, so the plain attributes are the rest state: master visible,
  pieces at `opacity="0"`. A loop that starts at rest also gives a raster
  still (its first frame) that is the master. A PNG of the rest frame
  (`lab render --at`) matches a PNG of the master.

## The loop

- One cycle: one `dur` (or durations that divide it), `values` that end
  where they start, and the hold as a flat segment of `keyTimes` inside the
  cycle — a `begin` offset drifts over repeats. `keySplines` with
  `calcMode="spline"` count one fewer than `keyTimes`. `data-duration` on
  the root is the cycle the lab and `lab render` read.
- The boundary is the most common flaw: the last frame of a cycle and the
  first of the next are the same picture, with no jump, pop or blink of a
  part that was hidden a frame early.

## An animated SVG as an `<img>`

- An image document has no page CSS, no script and no external file;
  `currentColor` is black, and the `<picture>` still — not the scene's
  media query — is what a reduced-motion reader gets (`docs/lab.md`). The
  `<img>` is what ships, so it is what gets checked.
- One animated file embedded at several sizes can share one image and one
  timeline; in some engines a copy at one size then freezes, lags or keeps
  a stale frame while another plays. When — and only when — that shows in
  an engine that matters, mitigate, cheapest first: a distinct URL per size
  (a query string gives each its own image), a file per size, or the still
  where the size is too small to need motion. Write the engine and version
  that showed it next to the fix, so it can go when the engine is fixed.
- An `<img>` replays only as a new image — a fresh URL. The lab's replay
  moves every copy to one new URL, so they still share one image, as on a
  page; a review page that gives each copy a URL of its own hides the
  shared-image problem — judge it on the page's real markup.

## Inspecting it

- Inspect on the lab's timeline (`docs/lab.md` § Inspecting motion), not
  on a player of your own: an animated SVG inside an `<img>` cannot be
  paused or sought from the page, so the timeline drives inline copies —
  `LabStudy` for a file, `LabTimeline` around a component on a demo route
  — and the file stays what ships and what downloads.
- Several copies of one SVG inline on one page share one id space: a copy
  resolves the first copy's mask, clip path, gradient or `<use>` target,
  and hiding or changing that copy breaks the others. `LabStudy` and the
  lab route rename every copy's ids and references (`namespaceIds()`);
  markup inlined by hand gets the same, and only SVG the repository owns
  goes inline at all.
- One clock for all the copies: each root paused and set with
  `setCurrentTime(t)` from one frame callback, rather than each running on
  its own — WebKit can advance visible and offscreen SVG timelines
  differently, so free-running copies drift apart. The callback stops on
  pause, when there is nothing to play and on unmount, and the readout
  updates slower than the frames.
- The cycle comes from the file (`data-duration`, else its SMIL and CSS
  timings), never from a constant restated in the route.

## Browsers

- The kit's commands drive Chromium. When Safari matters, run the same
  frames in WebKit: `pnpm exec playwright-core install webkit` (on Linux it
  may also want its system libraries), then a throwaway script under
  `.parity/` that launches `webkit`, opens the lab's bare scene page
  (`/scene/<name>?bare=1&width=<px>`) and seeks it with `window.lab.seek(t)`
  frame by frame, then screenshots the placed page's `<img>` as it plays
  (an image's clock cannot be seeked from the page).
- Report that as WebKit, not Safari. Confirmation is the owner's Safari on
  their device, at the version they run, opening the LAN URL.
