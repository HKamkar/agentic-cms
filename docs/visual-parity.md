# The screenshot harness

`agentic-cms visual-parity` is the proof that a change moved no pixel — or
moved exactly the pixels it meant to. It renders every prerendered page of
the production build at the site's widths, makes the rendering deterministic,
and diffs two captures pixel by pixel. The flags and exit codes are in
[commands.md](commands.md#visual-parity); this page is what the captures
contain, how to read a compare, and the traps a long run meets.

```bash
pnpm kit visual-parity capture before --ref develop   # the baseline: that commit built in a sibling directory and captured
# …change things…
pnpm kit visual-parity capture after --build          # the site's build first, then the capture
pnpm kit visual-parity compare before after --json    # exit 1 on any difference; the report as JSON
```

The same in one command, after the change is built:

```bash
pnpm kit visual-parity proof                          # baseline of develop, the tree as it stands, the compare
pnpm kit visual-parity proof nav-fix --states --build # the states pass too; build the tree first
pnpm kit visual-parity proof --all --ref main         # static, --motion and --states against main
```

`proof` runs the three steps of each pass as the commands above (static
always; `--motion`, `--states` or `--all` add theirs), the `--ref` build
done once for all of them, and ends with one line per pass — the compare's
counts, each side's time and how much the shot cache reused — and one exit:
`0` when every pass is identical, `1` on any difference or a failed capture.
Its captures are `<label>-before` / `<label>-after` (`-motion`, `-states`),
so a pass that differs is read like any compare. `--json` prints every
pass's captures and report. A static shot or a `--motion` frame that
differs is retaken before the pass reports
([below](#a-difference-retaken)), into `<label>-before-retake` and
`<label>-after-retake` (`-motion`). What it runs on — the ref, the schemes, the
widths, the pages — is the site's profile unless a flag says otherwise
([below](#the-sites-profile)): a site with two schemes gets every pass in
each, the dark one's captures ending in `-dark` (`proof-before-dark`,
`proof-after-states-dark`); `--widths` reaches the static pass alone, as
`--sample` does.

Captures live in `.parity/visual/<label>/` (gitignored; a capture wipes its
own directory first and writes `capture.json` **last** — its presence means
the capture finished, which is what a script waiting on a long run should
poll), with how long it took: `seconds` for the whole run and `timings`
for its shots — how many page-widths (or states) it took, their total and
mean, and the five slowest, which is where to look when a run is slow.
Every capture records its mode, scheme and, for a baseline, the ref
and sha in `meta.json` — for the site's own build also the checkout it was
(`tree: { head, dirty }`, `null` outside git) and the storage it was
seeded with (`seed`, [below](#a-visitors-choice-seeded)); `compare` refuses
two captures of different schemes or seeded differently, and prints the
baseline it is judging against.

## The site's profile

A site says once what it is, in the `harness` export of
`src/config/harness.ts` beside its seed ([below](#a-visitors-choice-seeded)),
and every command takes that as its default:

```ts
export const harness = {
  storage: { /* the seed */ },
  widths: [390, 768, 1440, 1920],          // the widths it is designed and proved at
  schemes: ["light"],                       // or ["light", "dark"]
  proof: { pages: ["/"], ref: "develop" },  // what a bare proof covers, and its baseline
  // or proof: { sample: 1, ref: "develop" } — one page of each template
};
```

A flag wins, then the profile, then the built-in default — the value the
command had before profiles existed, so a site without one, or a key it
leaves out, gets what it always got:

| Setting | Flag | Profile | Built-in |
|---|---|---|---|
| a static capture's widths | `--widths` | `widths` | 1920, 1440, 1280, 1100, 992, 800, 767, 390 |
| the home page's menu, opened and shot | — | each of `widths` where the menu button shows | 767 and 390, where it shows |
| one command's scheme (`capture`, `shot`, `probe`, `sheet`, `icons audit`, `icons round publish`, `lab render`) | `--scheme` | the first of `schemes` | light |
| `proof`'s schemes | `--scheme` (one) | a pass in each of `schemes` | light |
| `proof`'s pages, on every capture and compare | `--pages` (or `--sample`) | `proof.pages` | every page |
| `proof`'s sample, the first n pages of each template on the static pass | `--sample` (or `--pages`) | `proof.sample` | every page |
| `proof`'s baseline | `--ref` | `proof.ref` | `develop` |
| `lab serve`'s grounds | — | a box per scheme in `schemes` | light and dark |

`--motion` keeps its own widths (1440 and 390) and `--states` its 1440,
whatever the profile says. The menu shots are taken at the widths below the
site's menu breakpoint, found where the button shows rather than named: 390
and 768 for the example's four widths and its menu below 992. The profile is
read from the tree like the seed, so a `--ref` baseline is captured at the
tree's widths and in its schemes even when the ref predates the profile.
`proof.pages` and `proof.sample` are two ways of choosing a proof's pages,
like the flags: a profile sets one, and either flag sets aside the
profile's choice. A key of the wrong shape exits 2 naming it: widths are
whole pixels, schemes are `light` and `dark` (each once), pages are routes
starting with `/`, a sample is a whole number from 1, and pages and sample
together are refused.

A site without dark mode says `schemes: ["light"]` and is never proved in a
scheme it does not have; `init --light-only` writes that profile with a
light-only example ([init.md](init.md)). A site whose widths change
recaptures its baselines: a capture at the old widths and one at the new
compare as `MISSING` files. A site that writes into its profile the widths
it used to pass as a flag keeps its shot cache: the first proof after it
retakes only the home page, at the widths where the menu is now tried
([below](#unchanged-shots-are-reused)).

## A difference, retaken

One shot is one sample. A renderer can lay a line of text a pixel lower
once in a few hundred page-widths; a canvas drawn every frame, a loop the
harness cannot hold (a script's own, not a CSS or Web Animation), a spring
still moving near the settle time all move a `--motion` frame between two
captures of one build; and a shot copied from the cache repeats whatever
its first take was. So a difference is evidence only once it reproduces
outside what moves on its own, and `proof` asks before it reports: when a
static or `--motion` pass's compare has shots that differ (`CHANGED` or
`SIZE`), it takes those pages again at those widths alone, once on each
side and with the same seed —
the baseline from the sha it was built from (`capture --ref <sha>`), the
after side from the tree — with `--no-cache`, so nothing comes from the
cache and nothing goes into it. Then it compares again, judged against the
two retakes (`compare --retake-before <label> --retake-after <label>`):

- A real change never renders the before build's pixels. When some take of
  the after build matches some take of the before build — the after side's
  retake matches the before shot, the before side's retake matches the
  after shot, or the two retakes match each other — the difference does not
  reproduce: the line is `FLAKY`, its cause says which take jittered, and
  the shot that jittered leaves the shot cache, so the next capture takes it
  again instead of copying it.
- When none matches, each side's retake against its own first take shows
  where the shot moves between two takes of one build: the noise floor, a
  box around each band of rows that differ, as wide as their changed pixels
  and grown by 16 px. When every pixel that differs between the two sides
  lies inside those boxes, the line is `UNSTABLE`: the region is no
  evidence either way (a change there would be hidden by what moves), and
  outside it the two sides are identical; its cause names the region.
- Otherwise the line stands as it was, `CHANGED` or `SIZE`, and its cause
  ends `reproduced on a fresh retake of each side`, with how many of its
  pixels lie outside the noise floor when there is one.

The base against itself is what `--motion` pays for its noise floor, and
only for the page-widths with a frame that differs. Only the shots that
differ pay, two page-widths each (the retake takes every page with a shot
that differs at every width with one, so a page-width that did not differ
may come along). The first compare's lines are not printed; the compare
with the retakes is the pass's report.
Its retake captures must photograph the same build as their side — the
build id `meta.json` records, and the sha — in the same scheme, mode and
seed, taken with `--no-cache`; one that is not is refused (exit 2), so a
tree rebuilt while the proof ran stops it rather than judging the new build
against the old one.

A bare `compare` judges two captures and cannot take a shot. Without
`--retake-before` / `--retake-after` it reports every difference as it
finds it, and ends with how many shots no retake judged
(`unretaken` in its `--json`), which `proof` would have retaken. By hand,
capture each side again with `--pages`, `--widths` and `--no-cache` and
compare with both retakes.

`FLAKY` and `UNSTABLE` still count against the exit: a proof with such a
line exits 1 and says it found no difference that reproduces, and the line
is read, never passed silently.

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
(`--ref <git ref>`: a branch name resolved on `origin` first, so `develop` is
the branch as pushed, and `HEAD`, a sha or `HEAD~2` in this checkout; checked
out as a detached worktree in a sibling directory `../<site>-ref-<sha>` — never inside
the site, whose `tsconfig` would include it — its demo routes removed
(`src/app/<name>-demo`: never production, and the build's SEO audit rejects
them by design, so a commit made mid-round still builds), given the tree's
`.env.local` (gitignored, so a checkout has none, while the tree's own build
reads it: without the copy a build-time value could differ between the two
sides), installed with the lockfile as it was, built there, served and
captured; a sibling whose build finished for the same sha and the same
`.env.local` is reused (its `.parity/ref-build.json` says so, with a digest
of the file, never its values — one whose build failed, or that read another
`.env.local`, is rebuilt), older ref siblings are removed, and the sha and
the demo routes it removed go into `meta.json`).
The one command replaces the worktree, install, build, port and kill dance a
baseline used to be.

The build (a snapshot or a `--ref` sibling) is served the way Next's own
server serves it: the pages, their RSC payloads and the per-segment prefetch
files (`<page>.segments/`) the router asks for when a link comes into view,
the static chunks and `public/`. A prefetch answered with the wrong file is
asked again at every frame, which is load a capture does not need.

Whatever the source, a capture leaves the demo routes (`/<name>-demo`,
`/lab-demo`) out of its pages unless `--pages` names one, so a baseline
without them and an after capture of a tree that still has one list the
same pages.

## Third parties held back

An analytics tag, a chat widget's script, a beacon: none of them is the
page's look, all of them cost a capture network and timing, and any of them
can move a frame. On a build the harness serves, each page comes with a
Content-Security-Policy that lets scripts and connections (fetch, XHR,
beacons, sockets, event streams) come from the page's own origin alone:
`script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; connect-src
'self'`. Images, fonts, stylesheets and frames from other origins load as
ever, since they are the page's pixels. It is a header, not request
interception, which would switch the browser's HTTP cache off. A site whose
third-party script draws on the page — a chat bubble, a consent banner
loaded from another origin — loses it from its shots; `--third-party allow`
keeps it (a capture records the setting in `meta.json`, and the shot cache
never mixes the two). A `--url` site is served by its own server and
captured as it serves itself. A banner the site draws itself until a choice
is stored is the seed's to close, below.

## A visitor's choice, seeded

Every browser the harness launches starts with empty storage: a first
visit. A site that renders something until a choice is in `localStorage` —
a consent banner fixed over the page, a notice, a "what's new"
card — shows it on every full-page shot and in every `--states` crop it
overlaps, and whatever lies under it can no longer be proved. A seed writes
the choice in first: keys and values put into the page's `localStorage`
(and `sessionStorage`) before any of its own scripts runs, the first inline
`<head>` script included, through Playwright's `addInitScript`.

The site's default is `src/config/harness.ts`, a file only the harness
reads — the app never imports it, so it never ships and never changes a
build file:

```ts
// The record the consent banner leaves once a visitor has chosen, so the
// captures show the page after the choice; `shot --no-storage` shows the banner.
export const harness = {
  storage: { consent: { analytics: "denied", at: "{now}", version: 1 } },
};
```

`storage` is `localStorage`, `sessionStorage` the other; a value is a
string, stored as it is, or any JSON value, stored as its JSON. The commands
that take the seed's flags read it — `visual-parity capture` and `proof`,
`shot`, `probe`, `sheet`, `icons audit` — from the directory they run in,
against the build or a served site alike: a design round's demo route or
the lab route on the dev server (`shot /<name>-demo --url …`) starts from
the same storage as a capture. Flags change it
for one run: `--storage <key>=<value>` and `--session-storage
<key>=<value>` (each repeatable, split at the first `=`) set their key over
the file's, key by key; `--no-storage` leaves the file out, so only the
flags given are seeded — `shot / --no-storage` is the first visit, banner
and all. A file of another shape, an unknown key in it, or a pair without
its `=` exits 2 naming what to fix.

A real record expires — its time is checked against a maximum age — so a
fixed value goes stale. `{now}` in a value is replaced with the ISO time of
the run (`2026-10-02T12:00:00.000Z`) and `{now:ms}` with its epoch
milliseconds; once per run, so every page and every browser of a capture
gets the same record. Inside an object value a token stays inside its
quotes; a record that wants the milliseconds as a bare number is written as
a string (`'{"at":{now:ms}}'`).

The seed is written at the start of every document, in the top frame only,
over whatever the page before it stored: every page of a run starts from the
same storage, and another origin's frame is left alone.

Both sides of a compare must be seeded alike, and are:

- a capture records the seed in `meta.json` (and so `capture.json`) as
  written — `seed: { storage, sessionStorage, at }`, `{now}` unreplaced and
  the time it stood for beside it — and an unseeded capture records none;
- the shot cache's settings include the seed, so a seeded and an unseeded
  shot never stand in for each other, while `{now}` moving on does not stop
  a shot being reused;
- a `--ref` baseline is captured by the tree's harness, which reads the
  tree's `src/config/harness.ts`, never the ref's: the baseline is seeded
  like the tree, even when the ref predates the file; `proof` passes its
  `--storage`, `--session-storage` and `--no-storage` to both sides;
- `compare` refuses two captures seeded differently (exit 2), like two
  schemes, naming both seeds; it compares the templates, so two runs at
  different times are alike. `--mixed-seed` compares them all the same — to
  see what a seed itself changes — with a `seed:` line saying the captures
  differ in it; a seeded compare prints `seed: … on both`.

A site that adopts a seed recaptures its baselines: an old capture is
unseeded and the compare refuses it.

## Unchanged shots are reused

A shot is a function of the files its page loads from the build, of the
harness, the browser and the capture's settings. So after every page-width
(every state, with `--states`) a capture records the build files the page
requested — its HTML, chunks, stylesheets, fonts and images — with a digest
of each, under `.parity/shot-cache/`, and a later capture of any build copies
that page-width's shots instead of taking them when every one of those files
has the same bytes. The build id is masked first: two builds of one source
differ in it alone. In a proof that is most of the pages: a `--ref` baseline
and the after capture share every page the change did not touch, and a
baseline taken again, or a capture repeated after a fix elsewhere, copies
what it already has. The line under the capture says how many were reused,
and `capture.json` has `reused: { shots, of }`.

Only the build is an input: a third-party script or image, an analytics
beacon, is not; nor is a router prefetch, which shows nothing. A change to
the harness's own sources, the browser, the scheme, the motion settings, the
seed or (for `--states`) the site's config starts from nothing, and a `--url`
capture reuses nothing. The menu is a setting of the page-widths that open
it alone — the home page of a static capture at the menu's widths — so a
change to those widths retakes the home page there and reuses every other
page-width. A shot taken with an image still loading (below) and a state
skipped for want of its target are never stored, so a later capture takes
them again; so is a retake (`--no-cache` takes every shot and stores none),
and a shot a retake found to have jittered is removed from it
([above](#a-difference-retaken)). `--fresh` takes every shot again and
refreshes the cache: to prove a frame deterministic, or whenever a copied
shot is in doubt. Four
entries are kept per page-width, the least recently used going first;
`visual-parity clean --cache` empties it.

## Several browsers at once

A capture runs several browsers, each taking the next page-width (or state)
from one list: by default every core but one, four at most, for a static or
`--states` capture — a shot shares nothing with the next but the build — and
two for `--motion`, whose frames are timed in milliseconds and would drift on
a machine loaded past that. `--jobs <n>` sets it (`--jobs 1` is one browser,
the page-widths in order); `capture.json` records it. The shots are the same
whichever browser takes them; the one thing parallel runs were ever seen to
move is a single channel value by one, which a compare's threshold absorbs.

## A template's pages, sampled

A site with many pages of one template — fifty posts from
`/blog-post/[slug]` — proves a change to that template on a few of them as
well as on all. `--sample <n>` photographs the first n routes of each
template in route order, as the build's prerender manifest names the
templates, and every page that is no template's. A catch-all
(`/[[...slug]]`, `/docs/[...rest]`) is never sampled: its pages are the
site's own, each of its own design. The routes left out are printed and
listed in `meta.json` (`sample: { n, skipped }`), and a compare leaves out a
page either capture skipped, so a baseline that sampled `/blog-post/b` and an
after capture of a build with one more post do not report each other's
posts `MISSING`. Static captures only: `--motion` already takes one post,
and `--pages` names its own. Off by default.

## Three modes

**Static** (the default) photographs every page at the site's widths (the
profile's; without one, eight: 1920, 1440, 1280, 1100, 992, 800, 767 and
390) as a full-page shot, `<page>@<width>.png` (`home` for `/`, `/` → `__`
elsewhere: `blog-post__pages-are-files@1440.png`), and the home page's menu
open at each of the profile's widths where its button shows (without a
profile, 767 and 390), `home@390--menu.png`, viewport only. The rendering is made
deterministic: `prefers-reduced-motion` (the reveals snap to their end
state, and the play-once layer arms nothing, so its parts are at rest from
the first paint), every CSS animation and transition disabled, infinite loops
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
agree. An infinite CSS or Web Animation loop is left out, read from its
effect's timing in the page (DevTools reports one with no iteration count
at all): how often a page starts or restarts a loop, from an observer or a
timer, depends on timing, and the frames show it held at its first frame.
What the harness cannot hold still moves: a canvas drawn every frame, a
script's own loop, a spring that has not come to rest by the settle time.
Such a region differs between two captures of one build, settled frame
included, and only a second take tells it from a change: `proof` retakes
every frame that differs, the base against itself among them, and calls a
difference that lies only there `UNSTABLE`
([above](#a-difference-retaken)). Motion mode covers every page of the
build and its first post.

**`--states`** photographs what the other modes never reach: the CTA, a nav
link, a footer link and a blog card hovered; a form field focused; a
checkbox checked; the first FAQ open on the first page that has one and on
the first post whose body has one (the kit's own test, the FAQPage its page
emits: the accordion's toggle gets its `aria-expanded` only once the page
hydrates, so the built HTML cannot say). A build without such a page or
post has no row for it. Elements are located by role and text from the
site's config and page files (`src/kit.ts`), never by class, so the same
list works before and after a markup rewrite. Each shot is the element's
box with a margin, at 1440 (`home@1440--state-cta-hover.png`). A state
whose target does not show within 10 s of the page being ready is skipped,
`<state> (skipped: no target)` on the progress line and `skipped: [{ state,
page, file, reason }]` in `capture.json`, and the run goes on; the compare
calls its shot `MISSING` and says which side skipped it. It used to time
out twice and end the run.

`--scheme dark` renders any mode under `prefers-color-scheme: dark`; without
the flag a capture takes the first of the profile's schemes, else light.
`--url <base>` captures a served site instead of the build under `.next`
(print its `git log -1` first: a baseline from a checkout that had moved on
proves nothing). `--pages /a,/b` captures only those routes; pass the same
`--pages` to `compare`, which then judges only those routes' files, on both
sides.

## Reading a compare

One line per file, sorted (here a proof's compare, judged against its
retakes):

```
baseline: develop 55ab6af3d59bee8ce99b1e572c2bbf5ba360f106
seed: storage consent={"analytics":"denied","at":"{now}","version":1}, on both
ok       home@1440.png                                                          0.000% (0 px)
CHANGED  about@390.png                                                          0.412% (1234 px) rows 2017-2060
         cause: no section moved; the change at rows 2017-2060 is inside cards: its content changed in place; reproduced on a fresh retake of each side
FLAKY    blog-post__pages-are-files@390.png                                     0.024% (1180 px) rows 2210-2228
         cause: the difference does not reproduce — a fresh retake of the after side matches the before shot: the first after shot jittered, the capture's doing, not the build's
UNSTABLE home@1440--s02-settled.png                                            0.310% (4018 px) rows 120-188
         cause: unstable — scroll step 2, settled: the shot also differs between two takes of one build at rows 104-204, x 612-1180, and every changed pixel lies there: that region is no evidence either way, and outside it the two sides are identical
SIZE     blog@800.png                                                           800x3160 -> 800x3210 (+50)  same to row 1204, tail 1550 rows, band 1204-1610 -> 1204-1660: shift
         cause: hero height 812.000 → 862.000 (+50.000 px)
FLAKY    blog-post__pages-are-files@1440.png                                    3.214% (…) rows 3320-3610
         cause: image not loaded on before at y=3320 (/images/blog/pages-are-files-mid.webp, 1440x810): the shot is not evidence; retake the page with --fresh
MISSING  contact@1920.png (only in before)
         cause: only in the before capture: the after capture took contact at 390, 768, 1440 only
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
- `FLAKY`: a shot that differs and proves nothing either way. Either one
  side took it with an image still loading, after a reload had not brought
  it (below): the empty box is the capture's, not the build's; retake that
  page with `--pages <route> --fresh`. Or a fresh retake showed the
  difference does not reproduce
  ([above](#a-difference-retaken)): a take of the after build matched a take
  of the before build, so the first shot jittered. It counts against the
  exit like any other line that is not `ok`.
- `UNSTABLE`: a shot whose every changed pixel lies where it also differs
  between two takes of one build ([above](#a-difference-retaken)): a
  canvas, a loop, a spring still moving. The region proves nothing either
  way; outside it the sides are identical. It counts against the exit too.
- `cause:` — under every line that is not `ok`, what is behind it:
  - a page shot's section, from the geometry a static capture writes beside
    each shot (`<page>@<width>.sections.json`: every `[data-section]`, else
    the header, `main`'s children and the footer, with its top and height
    in fractional pixels): the first one in page order whose height
    changed, and by how much — `fractional` when the change is not a whole
    pixel — or the first whose top moved, when something above the
    sections changed; when none moved, the section whose box holds the
    first changed row, whose content changed in place. No section measured
    by hand. A capture from before the kit wrote geometry has none; the
    cause says so and names the side to redo;
  - on a `FLAKY` line, the image that had not arrived (its side, its place
    and its source), or which take a retake matched;
  - on an `UNSTABLE` line, the region where the shot moves on its own (its
    rows and columns, and how many more regions);
  - on a line a retake reproduced, `reproduced on a fresh retake of each
    side` (or of the one side retaken) after the cause, with how many of
    its pixels lie outside where the shot moves on its own;
  - for a shot that has no geometry by kind, what it shows: the open menu,
    a motion step's frame (whether it moves with timing is the retakes' to
    say) or a state's box; the diff image shows where;
  - for a `MISSING` file, why the other side lacks it: a state it skipped
    for want of a target, a page it did not take at all or not at that
    width, or a motion step past its end because the page's height changed;
  - for an inventory, how many animations each side alone has and the first
    of them; for a settle record, the step whose wait changed.
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
baseline, retakes, unretaken, summary: { ok, changed, size, missing, flaky,
unstable, exit }, files: [{ name, kind, status, line, cause, … }] }`; every file's
entry carries its printed `line` and its numbers, and every one that is not
`ok` its `cause`) and it is always written as `report.json` in the `-vs-`
directory. Exit `0` when everything is `ok`, `1` on any other line, `2` on
a usage error, a missing capture, two captures of different schemes, or a
retake that is not a fresh take of its side's build.

## What the harness waits for, and why

A static shot is taken only when the page has proved itself: fonts ready
(with a grace period, so a font that never arrives shows up as a diff rather
than a hang); every reveal at its end state, which is the trace hydration
leaves under reduced motion (an armed part of the play-once layer whose root
has not played counts as a reveal still pending, which a static capture
never has: under reduced motion nothing is armed); a scroll-through whose steps are counted in the
renderer's animation frames rather than milliseconds, so a loaded machine
slows the capture instead of photographing a reveal before it ran — each
600 px step done once the page has not changed (no DOM mutation) for two
frames in a row, two frames at least and never more than eight, so a busy
section gets the eight a step always had and a quiet one is not held; every
image arrived and decoded; and, on a site whose footer hairlines are drawn by a sequence
(`data-ix="footer-line-*"`), those lines drawn. A page whose renderer stalls
is reloaded once; a second stall fails the capture — no shot is ever taken of
a stalled page.

An image is waited for until it has arrived and then decoded
(`img.decode()`): arrived is not painted, and a renderer may decode a large
image off its main thread and draw the box empty until it has. The wait
listens beside the page's own `load` handlers, never in place of them, and
gives up after 10 s. Then, just before the shot, every image that shows and
has not arrived is counted: a page with one is loaded again, once, as a
stalled one is; if the second load still has one, the shot is taken, the
images are listed beside it (`<page>@<width>.unloaded.json`: source, place,
size), the shot is kept out of the cache and the compare calls a difference
on it `FLAKY` with that image as its cause. A broken image (a 404) is the
build's, and is photographed as it is.

The scroll-through exists to run what entering the view runs — reveals,
lazy images, observers — so it runs with every element `visibility:
hidden`: layout, scrolling and intersection observers behave as ever, and
nothing is painted until the page is back at the top, which on a long page
at a desktop width is most of the scroll-through's time. The shot is one
DevTools screenshot at the page's full size with the renderer's fast PNG
encoding: the pixels Playwright's full-page screenshot takes, in half the
time. The same scroll-through serves `shot`, `probe` and `icons audit`.

To load every image without scrolling, the harness switches lazy images to
`loading="eager"` — in every mode, and in `shot` and `probe` — but only once
React has hydrated them (each carries React's key, or sits in markup React
inserted as a string and never hydrates). An attribute changed before that
is one React's development build reports as a hydration mismatch, blaming the
site; against `next dev`, whose hydrate is slow, `--motion` used to trip it.
A page that is not a Next app passes at once, and one that never hydrates
falls through after 10 s.

## Traps a long run meets

- A proof is as short as the change allows: the site's widths and its
  schemes, which the profile gives every capture without a flag (never a
  scheme the site does not have), the pages the change touches (`--pages`,
  the same on both captures and the compare; `proof.pages` for what a bare
  proof covers), one page per template (`--sample 1`, or `proof.sample` for
  a site whose bare proof is that) only when the change is site-wide,
  `--states` / `--motion` only when hover or animation
  changed. A page is left
  out because the change cannot reach it, never to save time: every
  page-width whose build files did not change is copied from
  `.parity/shot-cache/`, and several browsers work at once, so a wider
  capture stays cheap (on the example, one post edited: 18.7 s for 80
  page-widths; the whole static set from nothing, 44 s on four cores).
  Only a first capture of a large site is worth the background, with its
  output in a log (`.parity/<label>.log`) whose tail you read.
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
- No shot is promised never to move. A mid-flight motion frame (a 500 ms
  frame at 20–30 %) can differ by timing; a settled frame differs wherever
  a canvas, a script's loop or a spring still runs; and once in a few
  hundred page-widths a static line of text lands a pixel off. `proof`
  retakes every static shot and `--motion` frame that differs before
  calling it a difference ([above](#a-difference-retaken)); after a bare
  `compare`, retake by hand (`capture --no-cache` of each side, then
  `compare --retake-before … --retake-after …`). A sequence that runs
  longer than two seconds after its section enters is not settled at the
  default: the section declares `data-settle="<ms>"` (or the capture raises
  `--settle`), and the settled frame waits — the fix too for a spring an
  `UNSTABLE` line keeps finding near the settle time.
- A stacking context (`position: relative` alone is enough) on the copy of a
  section whose animated elements overflow it can flip how the compositor
  rasterises everything below it: every text line under that section loses
  or gains subpixel antialiasing, about 1 % of pixels on every desktop
  capture with no layout change. Keep such utilities to the breakpoints that
  need them, and look for this when a diff covers every text line below one
  section.
- Commit each proven state before starting the next change; a working tree
  that mixes a proven change with an unproven one has to be split by hand.
- `.parity/` grows by hundreds of megabytes per full set. `visual-parity
  clean` keeps the newest finished captures (10; `--keep <n>`, or `--all`),
  removes the rest and every compare of a removed capture, and never touches
  a capture still running (no `capture.json` yet, under a day old); `--cache`
  also empties `.parity/shot-cache/`, `--dry-run` lists first. It removes
  nothing outside `.parity/`.
