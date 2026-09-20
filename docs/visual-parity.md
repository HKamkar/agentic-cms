# The screenshot harness

`agentic-cms visual-parity` is the proof that a change moved no pixel — or
moved exactly the pixels it meant to. It renders every prerendered page of
the production build at several widths, makes the rendering deterministic,
and diffs two captures pixel by pixel. The flags and exit codes are in
[commands.md](commands.md#visual-parity); this page is what the captures
contain, how to read a compare, and the traps a long run meets.

```bash
pnpm build && pnpm kit visual-parity capture before
# …change things…
pnpm build && pnpm kit visual-parity capture after
pnpm kit visual-parity compare before after          # exit 1 on any difference
```

Captures live in `.parity/visual/<label>/` (gitignored; a capture wipes its
own directory first); a compare writes its diff images to
`.parity/visual/<before>-vs-<after>/`. Every capture records its mode and
scheme in `meta.json`, and `compare` refuses two captures of different
schemes.

## Three modes

**Static** (the default) photographs every page at eight widths — 1920,
1440, 1280, 1100, 992, 800, 767 and 390 — as a full-page shot,
`<page>@<width>.png` (`home` for `/`, `/` → `__` elsewhere:
`blog-post__pages-are-files@1440.png`), and the home page's menu open at
767 and 390 (`home@767--menu.png`, viewport only). The rendering is made
deterministic: `prefers-reduced-motion` (the reveal library snaps to its
end state), every CSS animation and transition disabled, infinite loops
held at their first frame, scroll anchoring off, every image loaded before
the shot. Scroll-linked effects are captured at the top of the page after
one scroll-through, so the shot shows every section revealed.

**`--motion`** plays the animations for real: with every image loaded up
front, the page is scrolled one viewport (900 px) at a time and the viewport
photographed 150, 500 and 2000 ms after each step
(`<page>@<width>--s03-500.png`), at 1440 and 390 by default. The 2000 ms
frame is the settled state of that scroll position and is compared with
`--threshold`; the 150 and 500 ms frames catch an element mid-flight and
jitter by a few frames between runs, so they are compared with the looser
`--threshold-mid` (20 %) — a missing or wrong animation is far more than
that. Alongside the frames, every CSS transition, CSS animation and Web
Animation that starts during the scroll-through is recorded with its timing
and its target's position (`<page>@<width>.animations.json`) and compared
exactly, which catches a retimed or missing animation even when the frames
happen to agree. Motion mode covers every page of the build and its first
post.

**`--states`** photographs what the other modes never reach: the CTA, a nav
link, a footer link and a blog card hovered; a form field focused; a
checkbox checked; the first FAQ open on the first page that has one and on
the first post. Elements are located by role and text from the site's
config and page files (`src/kit.ts`), never by class, so the same list
works before and after a markup rewrite. Each shot is the element's box
with a margin, at 1440 (`home@1440--state-cta-hover.png`).

`--scheme dark` renders any mode under `prefers-color-scheme: dark`.
`--url <base>` captures a served site instead of the build under `.next`
(print its `git log -1` first: a baseline from a checkout that had moved on
proves nothing). `--pages /a,/b` captures only those routes; pass the same
`--pages` to `compare`, which then judges only the after capture's files.

## Reading a compare

One line per file, sorted:

```
ok       home@1440.png                                                          0.000% (0 px)
CHANGED  about@390.png                                                          0.412% (1234 px)
CHANGED  home@1440--s02-500.png                                                18.100% (…)  mid-flight
SIZE     blog@800.png 800x3160 -> 800x3210
MISSING  contact@1920.png (after)
ok       home@1440.animations.json                                              12 -> 12 animations
```

- `ok` / `CHANGED`: the share of pixels whose colour moved by more than 24
  in any channel, against `--threshold` (0.02 % of the image) or, for a
  mid-flight frame, `--threshold-mid`. A `CHANGED` file has a diff image in
  the `-vs-` directory: red where the pixels differ, the before image dimmed
  under it.
- `SIZE`: the two shots have different dimensions, so no pixels were
  compared. A page whose height changed (a section grew, a card wrapped) is
  reported here; which section moved is on the roadmap
  (`docs/roadmap.md`, job 3).
- `MISSING`: a file only one capture has (a page added or removed, or a
  partial capture without `--pages` on the compare).
- `.animations.json`: `CHANGED` when the inventories differ; the diff
  directory then holds the entries only one side has.

Exit `0` when everything is `ok`, `1` on any other line, `2` on a usage
error or two captures of different schemes.

## What the harness waits for, and why

A static shot is taken only when the page has proved itself: fonts ready
(with a grace period, so a font that never arrives shows up as a diff rather
than a hang); every reveal at its end state, which is the trace hydration
leaves under reduced motion; a scroll-through whose steps are counted in the
renderer's animation frames rather than milliseconds, so a loaded machine
slows the capture instead of photographing a reveal before it ran; every
image loaded; and, on a site whose footer hairlines are drawn by a sequence
(`data-ix="footer-line-*"`), those lines drawn. A page whose renderer stalls
is reloaded once; a second stall fails the capture — no shot is ever taken of
a stalled page.

## Traps a long run meets

- A full set (static, `--motion` and `--states` over every page at every
  width) takes tens of minutes. Use `--pages` for the pages a step touches
  and the full set once per pull request. Run a long capture in the
  background with its output in a log (`.parity/<label>.log`) and read the
  tail, not the log.
- A capture reads `.next` and `public/`: never build, edit `public/` or
  move assets while one runs, and build the exact tree you will commit
  before capturing — an edit after the build, however trivial, means the
  capture is of a different tree.
- Baselines come from a build of the exact commit you compare against. A
  reference build served on a port is a process, not a folder: check what
  listens there before capturing against it, and kill a stale one by its
  pid (a standalone Next server renames itself, so a pattern on the path
  misses it). A worktree for it gets its own `pnpm install
  --frozen-lockfile --prefer-offline` (a symlinked `node_modules` breaks the
  bundler) and its own build.
- A mid-flight motion frame (a 500 ms frame at 20–30 %) can differ by timing
  jitter: re-run it once, and identical on the re-run means accepted. A
  settled frame or a static shot never jitters — that is a real difference.
  A sequence that runs longer than two seconds after its section enters is
  not settled at the 2000 ms frame (job 3 of the roadmap lets a section
  declare its settle time).
- A stacking context (`position: relative` alone is enough) on the copy of a
  section whose animated elements overflow it can flip how the compositor
  rasterises everything below it: every text line under that section loses
  or gains subpixel antialiasing, about 1 % of pixels on every desktop
  capture with no layout change. Keep such utilities to the breakpoints that
  need them, and look for this when a diff covers every text line below one
  section.
- Commit each proven state before starting the next change; a working tree
  that mixes a proven change with an unproven one has to be split by hand.
- `.parity/` grows by hundreds of megabytes per full set; delete old labels.
