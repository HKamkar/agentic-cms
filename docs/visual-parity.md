# The screenshot harness

`agentic-cms visual-parity` is the proof that a change moved no pixel — or
moved exactly the pixels it meant to. It renders every prerendered page of
the production build at several widths, makes the rendering deterministic,
and diffs two captures pixel by pixel. The flags and exit codes are in
[commands.md](commands.md#visual-parity); this page is what the captures
contain, how to read a compare, and the traps a long run meets.

```bash
pnpm kit visual-parity capture before --ref develop   # the baseline: that commit built in a sibling directory and captured
# …change things…
pnpm kit visual-parity capture after --build          # the site's build first, then the capture
pnpm kit visual-parity compare before after --json    # exit 1 on any difference; the report as JSON
```

Captures live in `.parity/visual/<label>/` (gitignored; a capture wipes its
own directory first and writes `capture.json` **last** — its presence means
the capture finished, which is what a script waiting on a long run should
poll). Every capture records its mode, scheme and, for a baseline, the ref
and sha in `meta.json` — for the site's own build also the checkout it was
(`tree: { head, dirty }`, `null` outside git); `compare` refuses two
captures of different schemes and prints the baseline it is judging
against.

## Where the build comes from

A capture photographs one build, from one of three sources: the site's own
`.next` (the default; `--build` runs `pnpm build` first, with its output in
`.parity/<label>.build.log` and the last lines printed on failure) — copied
first, with `public/`, into `.parity/snapshots/<label>/` and photographed from
there, so a build or an asset edit while the capture runs changes nothing it
shows (the `snapshot:` line says when the tree is free; the copy is removed
when the capture ends, and a build that changes during the seconds of the
copy fails it); a served
site (`--url http://host:port` — print its `git log -1` first, because a
baseline from a checkout that had moved on proves nothing); or another commit
(`--ref <git ref>`: the ref resolved on `origin` first, checked out as a
detached worktree in a sibling directory `../<site>-ref-<sha>` — never inside
the site, whose `tsconfig` would include it — its demo routes removed
(`src/app/<name>-demo`: never production, and the build's SEO audit rejects
them by design, so a commit made mid-round still builds), installed with the
lockfile as it was, built there, served and captured; a sibling whose build
finished for the same sha is reused (its `.parity/ref-build.json` says so —
one whose build failed is rebuilt, never reused), older ref siblings are
removed, and the sha and the demo routes it removed go into `meta.json`).
The one command replaces the worktree, install, build, port and kill dance a
baseline used to be.

Whatever the source, a capture leaves the demo routes (`/<name>-demo`,
`/lab-demo`) out of its pages unless `--pages` names one, so a baseline
without them and an after capture of a tree that still has one list the
same pages.

## Three modes

**Static** (the default) photographs every page at eight widths — 1920,
1440, 1280, 1100, 992, 800, 767 and 390 — as a full-page shot,
`<page>@<width>.png` (`home` for `/`, `/` → `__` elsewhere:
`blog-post__pages-are-files@1440.png`), and the home page's menu open at
767 and 390 (`home@767--menu.png`, viewport only). The rendering is made
deterministic: `prefers-reduced-motion` (the reveal library snaps to its
end state), every CSS animation and transition disabled, infinite loops
held at their first frame, every inline SVG's SMIL clock paused at its
`data-rest` (seconds; else 0), scroll anchoring off, every image loaded
before the shot. SMIL is not a CSS or Web Animation, so nothing else stops
it; an animated SVG shown through an `<img>` is its own document and out of
reach — it is photographed as it runs. Scroll-linked effects are captured at the top of the page after
one scroll-through, so the shot shows every section revealed.

**`--motion`** plays the animations for real: once the page has hydrated,
with every image loaded up front, the page is scrolled one viewport (900 px) at a time and the viewport
photographed 150 and 500 ms after each step (`<page>@<width>--s03-500.png`)
and once more when it has settled (`--s03-settled.png`), at 1440 and 390 by
default. The settled frame is taken `--settle` ms after the step (2000 by
default) — or later when an element in view declares a longer sequence with
`data-settle="<ms>"` (a section whose icons keep popping until 2.6 s says
`data-settle="2600"`; `STANDARD.md` §7); what each step waited for and which
elements declared it is recorded in `<page>@<width>.settle.json` and
compared like the animation inventory. The settled frame is compared with
`--threshold`; the 150 and 500 ms frames catch an element mid-flight and
jitter by a few frames between runs, so they are compared with the looser
`--threshold-mid` (20 %) — a missing or wrong animation is far more than
that. An inline SVG's SMIL clock, which the browser runs apart from every
other animation, is paused and set before each frame to that frame's own
time since the step (0.15 s, 0.5 s, modulo its `data-duration`), and for the
settled frame to its `data-rest` — so a loop is photographed at the same
moment in every run, never at whenever the shot happened. Alongside the
frames, every CSS transition, CSS animation and Web Animation that starts
during the scroll-through is recorded with its timing and its target's
position (`<page>@<width>.animations.json`), and so is every inline SMIL
loop (`type: "smil"`, its cycle, its rest, its box), and compared exactly,
which catches a retimed or missing animation even when the frames happen to
agree. Motion mode covers every page of the build and its first post.

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
baseline: develop 55ab6af3d59bee8ce99b1e572c2bbf5ba360f106
ok       home@1440.png                                                          0.000% (0 px)
CHANGED  about@390.png                                                          0.412% (1234 px) rows 2017-2060
CHANGED  home@1440--s02-500.png                                                18.100% (…)  mid-flight
SIZE     blog@800.png                                                           800x3160 -> 800x3210 (+50)  same to row 1204, tail 1550 rows, band 1204-1610 -> 1204-1660: shift
MISSING  contact@1920.png (only in before)
ok       home@1440.animations.json                                              12 -> 12 animations
```

- `ok` / `CHANGED`: the share of pixels whose colour moved by more than 24
  in any channel, against `--threshold` (0.02 % of the image) or, for a
  mid-flight frame, `--threshold-mid`; `rows` are the bands of rows that
  changed (runs at most two rows apart), so the line says where on the page.
  A `CHANGED` file has a diff image in the `-vs-` directory: red where the
  pixels differ, the before image dimmed under it.
- `SIZE`: the two shots have different heights, so they were compared row by
  row instead — from the top until the first row that differs (`same to
  row`), from the bottom while the rows still match (`tail`), and the band
  between them on each side. The verdict says what happened:
  - `shift` — the band changed and grew or shrank, and every row below it
    survived intact: one section changed and pushed the rest of the page by
    the delta. The usual case, and the one that used to be a dead end.
  - `insert` / `remove` — rows appeared or vanished and nothing else
    changed (the band is empty on the shorter side).
  - `reflow` — nothing below the first differing row lines up again: the
    change reaches the whole page. Most often one section's height changed
    by a fraction of a pixel, which moves every row below it by that
    fraction and re-antialiases the rest (the `cause` line says so);
    otherwise a stacking context flipping the antialiasing below it, a
    chrome change, a font.
  - `width` — the widths differ: a viewport change, not a layout one.

  The band's crops (`<name>.before.png`, `<name>.after.png`, with a margin)
  are in the `-vs-` directory for a look at the section that moved.
- `cause:` — under a `SIZE` or `CHANGED` page shot, the section behind it,
  from the geometry a static capture writes beside each shot
  (`<page>@<width>.sections.json`: every `[data-section]`, else the header,
  `main`'s children and the footer, with its top and height in fractional
  pixels): the first one in page order whose height changed, and by how
  much — `fractional` when the change is not a whole pixel — or the first
  whose top moved, when something above the sections changed. No section
  measured by hand. A capture from before the kit wrote geometry has none;
  the compare says so and names the capture to redo.
- `MISSING`: a file only one capture has (a page added or removed, or a
  partial capture without `--pages` on the compare). With `--pages` the
  compare judges only those pages' files, on both sides, and of the before
  capture only the widths the after capture took: a full capture against a
  partial one lists no other page, and a frame of a named page that one side
  lacks (a motion step lost because the page got shorter) is still
  `MISSING`.
- `.animations.json` / `.settle.json`: `CHANGED` when the inventories
  differ; the diff directory then holds the entries only one side has.

`--json` prints the same as one document (`{ before, after, scheme,
baseline, summary: { ok, changed, size, missing, exit }, files: [{ name,
kind, status, line, … }] }`; every file's entry carries its printed `line`
and its numbers) and it is always written as `report.json` in the `-vs-`
directory. Exit `0` when everything is `ok`, `1` on any other line, `2` on
a usage error, a missing capture or two captures of different schemes.

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

To load every image without scrolling, the harness switches lazy images to
`loading="eager"` — in every mode, and in `shot` and `probe` — but only once
React has hydrated them (each carries React's key, or sits in markup React
inserted as a string and never hydrates). An attribute changed before that
is one React's development build reports as a hydration mismatch, blaming the
site; against `next dev`, whose hydrate is slow, `--motion` used to trip it.
A page that is not a Next app passes at once, and one that never hydrates
falls through after 10 s.

## Traps a long run meets

- A full set (static, `--motion` and `--states` over every page at every
  width) takes tens of minutes. Use `--pages` for the pages a step touches
  and the full set once per pull request. Run a long capture in the
  background with its output in a log (`.parity/<label>.log`) and read the
  tail, not the log.
- A capture photographs a copy of the build and `public/`, taken before
  the browser starts: once it prints `snapshot:`, building, editing
  `public/` or moving assets no longer reaches it. Still build the exact
  tree you will commit before capturing — an edit before the build,
  however trivial, means the capture is of a different tree; `meta.json`'s
  `tree` (HEAD, modified or not) says which checkout it was.
- Baselines come from a build of the exact commit you compare against:
  `capture <label> --ref <commit>` does the worktree, the install, the build
  and the serving, and stamps the sha into the capture. If a served build
  stands in instead (`--url`), it is a process, not a folder: check what
  listens on the port before capturing against it, kill a stale one by its
  pid (a standalone Next server renames itself, so a pattern on the path
  misses it), and print its `git log -1` first.
- A mid-flight motion frame (a 500 ms frame at 20–30 %) can differ by timing
  jitter: re-run it once, and identical on the re-run means accepted. A
  settled frame or a static shot never jitters — that is a real difference.
  A sequence that runs longer than two seconds after its section enters is
  not settled at the default: the section declares `data-settle="<ms>"`
  (or the capture raises `--settle`), and the settled frame waits.
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
