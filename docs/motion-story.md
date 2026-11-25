# A motion story without frame loss

A motion story is one page a reader scrolls through like a film: one stage
that never cuts, a camera, a light that lives through every chapter, and
the page's words on top. It is drawn live in the reader's browser, because
CSS cannot draw one: a CSS version of the story this guide was measured on
took 12.3 ms a frame and still looked flat.

The kit ships no story engine. This page is the method: what keeps a live
scene at the screen's own rate, with the number behind each rule, and how
to check it. The procedure is the `design-story` skill, the code to start
from its
[references/steady-frames.md](../.claude/skills/design-story/references/steady-frames.md).

## Optional, at four levels

- **The kit.** Nothing here is on by default. The wireframe animates
  nothing (`STANDARD.md` §7), and everything else still ships pre-rendered
  ([lab.md](lab.md)): a mark, a loop, an illustration is a file.
- **The site.** A `<canvas>` and a `requestAnimationFrame` loop are the
  preferred tier: `pnpm lint` warns (`agentic-cms/graphics`,
  `agentic-cms/motion`) until the site says why, in one line of `allow` in
  `src/config/components.json` ([parts.md](parts.md)).
- **The page.** The page that tells the story asks for it, as a section
  type in its content file. Every other page is a regular page and loads
  none of it.
- **The reader.** Reduced motion or no graphics card: the same words as a
  normal document, with a still picture per chapter, each drawn once. No
  WebGL or no JavaScript: the words alone, or stills the site ships as
  files.

The engines stay required. Every word is in the page's content file and in
the prerendered HTML, so the page reads, ranks and prints without the
scene. The canvas is `aria-hidden`.

## The budget

Set it before the first scene is drawn, and measure against it in every
round.

| What | Limit |
|---|---|
| Frame rate | the screen's own: 16.7 ms at 60 Hz |
| Main thread, a frame, processor slowed 4× | 8 ms, text included |
| Graphics card, a frame | 10 ms, so the browser's own work fits beside it |
| Late frames (over 1.5 refreshes) in 5 s of scrolling | 0 on a desktop, 2 on a phone |
| Main thread blocked by the setup, processor slowed 4× | 200 ms in all |
| First headline on screen | before the scene starts, under 1 s on a slow connection |
| First paint of the stage | the first scene's ground, painted in CSS, before any script |
| Made before the first picture | the first scene's data and programs, nothing else |
| A card's path on screen while it can be read | a tenth of the screen's longer side, and no change of side |
| Layout shift | 0.02 |
| Script of the story, compressed | 60 KB, no rendering library |
| Pixels drawn | 1.9 million on a desktop, 1.3 on a tablet, 0.9 on a phone |
| One-off stutter, the first time a chapter is drawn | none to measure |

## Where the frames go

Measure before optimising: what looks heavy is rarely what is. In the first
version of the measured story, 70–80 % of the drawing in five of its six
chapters went into passes that had nothing to do with the scenes:

| Pass | Share of the frame |
|---|---|
| the background (procedural noise on every pixel) | 21–37 % |
| the glow (seven levels, 13 and 9 samples a pixel) | 18–28 % |
| the final colour step | 12–20 % |
| ring-shaped things drawn as full squares | 3–36 % |
| everything a reader would call the scene | 10–18 % |

The rebuild drew two to three times as much scene. At equal pixels, five of
its chapters cost 43–60 % less; the sixth, a tree of 6,400 leaves and 9,700
line segments, costs what a tree of 30 lines did. Then it draws fewer
pixels. The rules below are what changed. (Shares and times are from a
software renderer, so they compare versions; they are not frame rates.)

## Fewer pixels, cheaper pixels

1. **Cap the pixels, not the ratio.** A device ratio of 1.75 on a large
   screen is 4 million pixels. Canvas width × height stays under the budget
   above, whatever the screen.
2. **Change the quality without making anything again.** Allocate the
   render targets once, at the cap. A frame's quality is the part of them
   it uses: a smaller viewport, and texture coordinates scaled to it. A
   target made again in mid-scroll is a stutter of its own.
3. **Small floats.** `R11F_G11F_B10F` targets hold a high-dynamic-range
   picture in half the bytes of `RGBA16F`. With additive blending every
   layer reads and writes them, so memory traffic halves too. Keep a little
   grain in the last step: it hides the coarser steps.
4. **Draw soft things small.** A nebula, a sky or a haze is drawn at
   256 × 144 and stretched. Only what has an edge needs every pixel.
5. **Sparse things are geometry.** Stars are a thousand points, never a
   test on every pixel.
6. **Noise is a texture.** One 32³ single-channel 3D texture, filtered and
   repeated, replaces eight hashes and seven blends per octave with one
   read.
7. **Draw the shape, not its box.** A ring is a ring of triangles. In a
   see-through thing, `discard` what comes out near black: with additive
   blending an empty pixel still costs a read and a write. A solid thing is
   the opposite ([§ Safari](#safari)).
8. **One side, one job.** Cull the far wall of a tunnel, a shell, a bezel. A
   shader that does one of seven jobs becomes seven programs: splitting one
   halved a whole chapter's frame.
9. **Glow at half size, few samples.** Down with five samples, up with four
   between texels (four filtered reads are a 3 × 3 tent). Five or six
   levels.
10. **Detail follows size.** Veins, text lines and grain fade by `fwidth`
    before they are smaller than a pixel. It is cheaper, and it stops the
    crawling that reads as bad frames.
11. **Solid where it can be.** A dark solid trunk hides what is behind it,
    and that depth is what makes it read as a tree. To fade a solid thing,
    dissolve it with a noise threshold, not with blending.

## Nothing new in mid-scroll

12. **Geometry in a worker.** The measured story builds its tree, its
    particles and its linework in about 0.3–0.5 s of script. In a worker
    that is none of the main thread's. Transfer the buffers. Where a page
    may not start a worker, run the same generator on the main thread in
    slices of 6 ms.
13. **Compile together, ask late.** Start every shader before asking about
    any, then wait on `KHR_parallel_shader_compile`.
14. **Warm up unseen.** A program is really prepared on its first draw. Draw
    each chapter once, at 6 % size, without the final step to the screen,
    and wait for a fence (`fenceSync`) before the next: the chapter on
    screen before the scene fades in, the others while the reader is still
    on it. Without it, the first frame of the story cost 0.9 s extra and one
    later chapter 60–90 ms. With it, no chapter's first frame could be told
    from its third.
15. **Constants once.** Palettes and samplers are set when a program is
    linked. A frame's shared values are one plain array, sent once to each
    program the frame uses; so are one ring's. No uniform buffer: Safari
    imitates them, and an engine's makers measured a 150 ms stall from an
    upload at the wrong moment
    ([Wonderland Engine](https://wonderlandengine.com/news/webgl-performance-safari-apple-vision-pro/)).
16. **No garbage, no layout.** Typed arrays are kept between frames; colours
    are parsed at the start; sizes come from a `ResizeObserver`, never from
    a read in the frame.

## The words move cheaply

17. **`transform` and `opacity`, nothing else.** An animated `filter:
    blur()` on a headline cost 3.5–6 ms of main thread and 3–5 ms of raster a
    frame, 12–14 ms with the processor slowed 4×: it dropped frames on its
    own. Without it the same headline costs 2.1 ms, 4 ms slowed, and no
    raster.
18. **No large `text-shadow`.** A soft glow behind a headline is in the
    scene, or a gradient that does not move.
19. **Write only what changed.** Round opacity to 1 % and movement to half a
    pixel, remember what was written, and skip the rest. Chapters that are
    not on screen are not touched.
20. **Promote only what moves now.** `will-change` on the words of the
    chapter on screen, not on all of them, and `visibility: hidden` on what
    has faded out: twenty invisible labels cost 3 ms a frame in layers alone,
    slowed 4×. No transition of `box-shadow`, and no custom property set on
    `<html>` in a frame: it restyles the page.

## The frames keep their pace

21. **A governor.** Every 24 frames, or 0.9 s, compare the slow quarter of
    the frames with the screen's refresh, and the graphics card's own time
    where `EXT_disjoint_timer_query_webgl2` gives it (WebKit offers none).
    Then, in this order: a smaller picture, down to 42 % (46 % on a phone or
    a tablet); on a fast screen, an even half rate (an even 60 looks better
    than an uneven 90); fewer details; and, when the lowest setting cannot
    hold 24, the still version. Never a slideshow.
22. **Down fast, up slow.** One slow window lowers the picture by 4–20 %.
    Going up takes several good ones, 4 % at a time, and not over the size
    that just failed for 20 s, then 40, then 80.
23. **The measured refresh, not 60.** Take it while the page loads, before
    anything is drawn, and judge lateness against it. When a smaller picture
    does not make a frame shorter, the picture is not the cause: one window
    at the smallest size settles it, and the size goes back.
24. **Motion by time.** Damping is `1 - exp(-dt * k)` with `dt` capped, so
    a late frame does not become a jump.
25. **Stop.** No drawing when the stage is off screen, the tab is hidden,
    the context is lost or the reader is on another page.
26. **A software renderer is not a graphics card.** Ask for the context
    with `failIfMajorPerformanceCaveat`, check the renderer's name, and go
    straight to the stills.

## Safari

Safari draws through Metal, in another process, on chips that work tile by
tile. A scene that is right in Chromium can be black, sparkling or slow
there. Headless WebKit runs WebGL 2 on a machine without a graphics card, so
the first two show before a device does ([browsers.md](browsers.md)): the
measured story, finished in Chromium, did not start in WebKit at all. Speed
shows only on a device.

- **Nothing undefined in a shader.** One engine's answer to undefined maths
  is another's not-a-number, and one such pixel becomes a white patch through
  the glow. Guard the square root of zero, the power of a negative number
  (`exp(-pow(x, 2.))` is written `exp(-x * x)`), a reversed `smoothstep`, a
  normalised zero, `atan(0, 0)`. In WebKit the measured story showed white
  sparks with a black centre, from `sqrt(0)`; Chromium never did.
- **Random numbers from bits, not from `sin`.** `fract(sin(n) * 43758.5)`
  differs on every chip and fails at large `n`. Hash the bits
  (`floatBitsToUint`), and the same picture comes out everywhere. On the
  processor, a shuffle is a loop, never a `sort()` with a random answer:
  each engine sorts its own way.
- **A setting the compiler removed is not there.** Read the names from the
  source, ask only for the place, and make a missing one a no-op.
- **Ask nothing in a frame.** Every `get…`, `is…`, `check…` and `read…` is a
  round trip to the graphics process. Zero in a frame; in the setup, names
  and types from the source instead of `getActiveUniform` (915 questions
  became 270). Fewer calls too: a ring's values in one array took a frame
  from 295 calls to 214.
- **No `flat` varyings, no index buffer that changes.** Flat shading takes
  the last vertex's value by default, the slower way on some hardware
  ([WEBGL_provoking_vertex](https://registry.khronos.org/webgl/extensions/WEBGL_provoking_vertex));
  a value that is the same on every vertex needs no `flat`. An index buffer
  that is updated is read back to check its range
  ([ANGLE](https://groups.google.com/g/angleproject/c/fzOgBCPtpnU)).
- **No `discard` in a solid thing while it is whole.** It stops the chip
  skipping hidden pixels. A leaf's outline is its mesh; two programs, one
  with the dissolve and one without, and the second only while the thing
  fades.
- **Say what is not needed.** `invalidateFramebuffer` before a pass that
  overwrites everything, and on the depth after the scene, so a chip that
  works in tiles need neither load nor store them.
- **30 a second can be a limit, not a slow device.** Low power mode gives 30
  ([WebKit bug 215745](https://bugs.webkit.org/show_bug.cgi?id=215745)), and
  an embedded page from another site is held at 30 until it is touched
  ([WebKit r215070](https://trac.webkit.org/r215070)). A governor that
  assumes 60 takes the picture apart for nothing: on a simulated strong phone
  in low power mode it went to 46 %, and with rule 23 it stays at 100 %. The
  rate is measured again when the limit lifts.
- **Prove the format.** Make a 4 × 4 target and ask if it is complete:
  `R11F_G11F_B10F`, then `RGBA16F`, then `RGBA8`.
- **The scene can be taken away.** A phone takes back the graphics memory of
  a page put aside. On `webglcontextlost`, `preventDefault()` and stop; on
  `webglcontextrestored`, build it again from the buffers that were kept.
- **The stage is `100lvh`.** With `100svh` a strip shows under it when the
  bar folds away. What sits at its bottom stays above the bar:
  `calc(100lvh - 100svh)`.
- **A tablet is not a desktop.** A coarse pointer gets 1.3 million pixels
  and fewer particles, whatever its width.

## The scroll stays the reader's

27. Native scroll and a `position: sticky` stage. Never a captured wheel.
28. A play button stops at the first wheel, touch or key.
29. Jumping to a chapter is a link. The story can be skipped with the
    keyboard.
30. Flashes stay under three a second and dim.

## The first picture comes first

A story that makes everything before it shows anything looks broken. The
measured story took 2.9 s to its first picture in software rendering, and
1.9 s when the first scene came first. The script's own part is about
120 ms.

31. **Paint the ground in CSS.** The first scene's horizon, sky and one
    light are gradients on the stage, in the page's styles. They are there
    at the first paint, 0.2–0.3 s in, and the canvas fades in over them.
32. **The generator yields the first scene.** Its buffers are posted on
    their own, its programs compiled on their own, and the scene is drawn.
    Everything else is made behind it, while the reader is on it.
33. **The order follows the reader.** Who arrives in the middle (a link to
    a chapter, a page that comes back) gets that chapter first.
34. **A scene that is not ready is not faked.** Until the rest is there the
    camera holds at the end of the first scene, and the words go on.

## The cards stay still

A card (a label with a line to a point of the scene) moves when the camera
does. In the measured story one travelled 644 px while a reader was meant to
read it, and two changed sides while they were up. No frame time shows it.

35. **The camera turns first.** It makes its large move before a chapter's
    first card and settles while cards are read. After the fix the longest
    path is 142 px on a 1440 px screen.
36. **One side, chosen once.** A card measures itself when it appears, picks
    the side that has room, and keeps it until it goes.
37. **On screen, in the clear.** A card in the window's lower edge, under
    the caption or past the side is a card nobody reads. Three cards of one
    chapter stood below a 900 px window through several rounds: nothing checked it.
38. **Gone before the dive.** Cards fade before the camera pushes through
    to the next chapter.

## Where it lives on a site

- **A section type**, its copy in `content/pages/<slug>.yaml` like every
  section's: chapters in order, each with its words. The server renders the
  words; the scene is a client component that only finds them.
- **Load it on its page only.** Every page the content engine renders goes
  through one route, so a client component any section imports lands in a
  script every one of those pages downloads (measured: 182 KB became
  200 KB on pages without it). Import the engine on demand
  (`import("./story")` in an effect), after the words are on screen, and
  keep its CSS in a `<style href precedence>` the section renders.
- **The exception, named**: `allow` for `agentic-cms/graphics` and
  `agentic-cms/motion` on its files, with the reason.
- **The stills** are the reduced-motion version, so the screenshot harness
  photographs them: its static captures run with reduced motion
  ([visual-parity.md](visual-parity.md)).

## What makes it good

Steady frames of a poor picture are still a poor page. These came from
studying work at this level in its own code, then going round after round
against it:

- **Study before building.** Name what the reference does and how: passes,
  timing, camera, light. Techniques carry over; its artwork, words and
  names never do.
- **Hairlines carry the quality.** Anti-aliased rings, ticks, grids and
  glass edges, one pixel wide at any distance. Particles support them.
- **One language, abstract and minimal.** Say it in one sentence before the
  first scene and hold every scene to it. The measured story's is fine
  fibres of light in the dark, two hues a chapter, one accent, small panes
  of glass. The scenes that left it (a spine of beads, a stained-glass
  window in a stone wall, sheets of paper) were the ones turned down, at
  first sight. Realism reads as a poor copy; a drawing reads as a drawing.
- **Everything dim, the light does the work.** Low brightness, glow with a
  threshold, a filmic curve, a vignette. Bloom on everything is a fog.
- **An approved scene is frozen.** Its random numbers are a stream of its
  own, so work on another scene cannot move one leaf of it, and it is
  compared pixel by pixel at fixed positions after every round.
- **Scroll carries an event through each chapter**: something lights, moves
  or is found, in order, and the rest steps back.
- **One object lives through all of it.** The light in the first chapter is
  the one in the last.
- **The camera moves on a path**, with several keys a chapter, a change of
  field of view, and a push at the exit. A still camera is a slide.
- **Light with a place.** Leaves lit by distance to the light, and a solid
  trunk in front of them, give depth that glow never does.
- **Chapters hand over.** The particles of one become the next; nothing is
  cut or faded to black.
- **Rounds.** Photograph the same positions of the story after every change
  and look: too bright, too flat, unreadable words, a label over a label,
  an empty frame in a transition. The measured story took fourteen rounds.

## Checking it

Give the page a test hook, `render(position, time, quality)`, so a script
can draw any frame. Then, with Playwright:

| Check | How |
|---|---|
| Every chapter and every transition, at 1440 and 390 | `render()` at a list of positions, a screenshot each, one contact sheet |
| The cards | `render()` every 12 px of scroll: each readable card's path on screen, its side, and whether it was in the window and clear of the caption, at 390, 1024, 1440 and 1920 |
| The frozen scenes | the same positions before and after the round, pixel by pixel: identical |
| The first picture | from navigation to the first lit frame; the stage with the canvas hidden (the painted ground); the programs compiled before it |
| What each pass costs | wrap the draw calls with a one-pixel `readPixels` and time them; take the fastest of several; compare two versions at equal pixels |
| What the words cost | the draw calls off, a trace of 90 frames: script, style, paint, commit, raster |
| Script a frame | the draw calls off, the processor slowed 4× |
| First-time stutters | for each chapter, the first frame against the third, both ending in `readPixels` |
| The setup | long tasks over 50 ms, the largest paint, the layout shift, slowed 4× |
| The governor | run it on a software renderer: it must go down step by step and end on the stills; and as a simulation without a browser: strong and weak devices, 60 and 120 Hz, a limit of 30 from the start, at 10 s and lifted again |
| WebKit | the same positions as Chromium, side by side: they must match; play, wheel, links, an iPhone and an iPad profile; the graphics calls and the questions in a frame |
| The scene taken away | `WEBGL_lose_context`: lose, restore, the same picture |
| Fallbacks | reduced motion, no WebGL, no JavaScript: all the words, no errors |

A machine without a graphics card gives proportions, never a frame rate, and
none of the measured story's frame rates come from one. The real numbers come from the owner's devices: put a frame readout behind a
small button (frames a second, late frames, the worst frame, the picture
size), open the page on a phone and a laptop, and in Safari and Firefox, and
read it while scrolling through every chapter
([browsers.md](browsers.md)).
