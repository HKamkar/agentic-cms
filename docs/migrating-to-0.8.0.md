# Migrating a site from 0.7.6 to 0.8.0

> **Draft.** Written with the 0.8.0 roadmap (`docs/roadmap.md`). Each job
> of the roadmap fills in its section here as it lands, and the release is
> cut only after this guide has been run on two sites on 0.7.6. Lines marked
> *(job N)* are the plan; the final text replaces them.

This is for a site on agentic-cms 0.7.6. Upgrading changes nothing a reader
sees: a site that does only § 1 builds, lints and proves identical.
Everything after § 1 is a choice. Each step says why you might take it,
what to do, how to check, and what to delete if your site already wrote its
own version.

| § | Step | Who | Effort |
|---|---|---|---|
| 1 | Upgrade | every site | minutes |
| 2 | Breaking changes | every site | none planned |
| 3.1 | The site profile: widths, schemes, proof pages | every site | minutes |
| 3.2 | `setup`, `urls`, `serve` | every site | minutes |
| 3.3 | CI | a site without CI | minutes |
| 3.4 | Light only | a site without dark mode | an hour |
| 3.5 | The play-once motion layer | a site that wants it, or wrote its own | an hour or more |
| 3.6 | `variants()`, tokens by role, the example's primitives | a site that wants them | it depends |
| 3.7 | The component library, enforced | a site ready to freeze its components | an hour |
| 3.8 | The know-how pointers | every site | minutes |
| 3.9 | Pages as content files | a site with hand-written page routes | an hour per page |
| 4 | Delete what your site wrote itself | a site with its own tools | minutes per tool |
| 5 | Check | every site | a proof |

## Before you start

- **A clean tree, on a branch off `develop`** (`chore/agentic-cms-0.8`), with
  `develop` pushed.
- **No baseline to take by hand.** `visual-parity proof --ref develop` builds
  `develop`, whose lockfile still pins 0.7.6, so the proof compares the old
  kit against the new one. It is `develop` as pushed: a branch name
  resolves to `origin/<ref>` first, after a fetch, and to the local branch
  only when origin has none, so a stale local `develop` is never the
  baseline, and a commit you have not pushed is not in it.
- **Know what your site wrote itself.** Read the table in § 4 first: each of
  those files is deleted only after the step that replaces it.

## 1. Upgrade (required)

```bash
# package.json: "agentic-cms": "github:HKamkar/agentic-cms#v0.8.0"
pnpm install
pnpm exec agentic-cms init . --agent-files --check   # what will change, writes nothing
pnpm exec agentic-cms init . --agent-files           # skills, rules, the rules table
```

**Before the release** there is no tag: a site that runs this guide as the
release's gate pins the candidate, `github:HKamkar/agentic-cms#<develop sha>`,
and moves to `#v0.8.0` once the tag exists. The candidate's `package.json`
still reads 0.7.6, so `.agentic-cms.json` records `"version": "0.7.6"`, with
the candidate's `"commit"` from the lockfile beside it.

**What `--agent-files` updates:** the skills, the scoped rules and the rules
table in `AGENTS.md`.
- **Skills:** `design-proof`, `design-options`, `design-graphics`, `design`,
  and the new `setup`.
- **Rules:** `styling`, `design`, and the new `pages`.

A file you edited is kept. `--check` reports it `modified` when the kit's
text of it has not changed since your site took it (nothing to take; the
check passes), and `modified, kit changed` when it has. For each of those,
take the kit's change by hand, then record the merge:

```bash
pnpm exec agentic-cms init . --agent-files --diff .claude/rules/styling.md     # the kit's change since your site took it
pnpm exec agentic-cms init . --agent-files --accept .claude/rules/styling.md   # merged: the kit's text is the file's base
```

The base, the kit's text your site last took, comes from your site's git
history the first time (the commit that has the file as `init` wrote it)
and is kept in `.agentic-cms/base/` from then on: commit that folder with
`.agentic-cms.json`. `git apply` takes a `--diff` where your edits sit apart
from it; otherwise merge by hand. `--diff` prints the kit's new lines alone,
without your edits.

What `--diff` shows for each file is listed here, each line with the step
it belongs to. A line for a step your site has not taken is worded to hold
without it ("where the layout renders `motionScript()`", "on a site that
has the example's"), so the whole `--diff` can go into your copy: a line
marked § 1 applies to every site, the others once you take their step. If
you leave a later step's lines out, take them from this list when you take
that step: once you `--accept`, `--diff` no longer shows them.

- **The styling rule:**
  - § 1: motion is `agentic-cms/ix` in the layer the site has (its
    `STANDARD.md` §7): the play-once layer where the layout renders
    `motionScript()`, and for a site's first motion; `Fx` and `OnView` on
    a site that moves with them and has not adopted it, and elsewhere only
    where a replay on re-entry is wanted. The `Fx` / `OnView` bullet opens
    "Where the site uses them".
  - § 1: a change that must not move a pixel proves it with
    `pnpm kit visual-parity proof` (the baseline of develop, the tree and
    the compare, once built), in place of `capture before`,
    `capture after` and `compare`.
  - 3.1: the site is designed, looked at and measured at its widths, the
    profile's (for a new site 390, 768, 1440 and 1920), and nothing that
    moves widens the page at any of them.
  - 3.1: the proof runs at the profile's widths and in each scheme it
    names; a site without a profile writes one first.
  - 3.5: the play-once bullet (`Reveal`, `RevealGroup`, `Sequence`,
    `part()`, `motionScript()`, the `--ease-*` / `--motion-*` tokens),
    which opens "Where the layout renders `motionScript()`".
  - 3.6: a component asks for a colour, a radius or a shadow by its role
    where the site has one, and names a value only where no role does.
- **The design rule:**
  - § 1: rejected and unapproved candidates are deleted, never archived,
    moved aside or kept "for later".
  - 3.6: a section's card content is its own, inside the site's one card
    frame (`ui/Panel` on a site that has the example's).
- **The components rule:** 3.7. It is new, and `--agent-files` writes it
  only once the site has `src/config/components.json`.
- **The pages rule:** § 1. It is new, written whole: a page is a content
  file, a new one `/editorial:new-page`, a page's copy never in a
  component. Its guard sentence opens "Where the site runs the guard"
  (3.7), and its last line points a site with hand-written pages at 3.9.
- **`design`:**
  - § 1: the owner's look is `pnpm kit serve`, handing over the URLs it
    printed, in place of `pnpm dev`.
  - § 1: motion comes last, in the layer the site has: a site on `Fx` and
    `OnView` keeps them, and a site with no motion yet starts with the
    play-once layer.
  - 3.1: the colours in each scheme the profile names.
  - 3.5: where the layout renders `motionScript()`, the play-once layer
    is the default, and `Fx` and `OnView` serve only where a replay is
    wanted.
  - 3.6: where the site has role tokens, the design gives the roles their
    values first.
  - 3.6: a section's cards sit in the site's one card frame (`ui/Panel`
    where it has the example's).
- **`design-options`:**
  - § 1: step 4's hand-over. `pnpm kit serve` starts next dev and the lab
    and prints every URL in one table, and `demo new` waits until the
    route answers and prints its URLs. The LAN or public address goes over
    with its origin in `ALLOWED_DEV_ORIGINS` (`serve --write-origins`
    adds it), and a public one only where the firewall opens the port to
    the viewer's IP only. The candidates are measured at the site's widths
    and their interactions run in WebKit, with what to ask the owner's
    Safari for. `serve --fix-cache` clears Turbopack's stale cache.
  - § 1: `demo new --timeline` in place of wrapping a moving candidate in
    `<LabTimeline>` by hand, and `--showcase` for a review page of pieces.
  - § 1: rejected and unapproved candidates are deleted, never archived.
  - 3.1: the demo route shows the site's tokens and chrome in each scheme
    the profile names, in place of "its theme toggle".
- **`design-proof`:**
  - § 1: a proof as short as the change allows, in place of "capture the
    full set": the pages the change touches, `--sample 1` only for a
    site-wide change, `--states` / `--motion` only when hover or animation
    changed (the read-first step checks which). A page is left out only
    because the change cannot reach it.
  - 3.1: the profile paragraph (a site says its widths, schemes, proof
    pages and ref once, in `src/config/harness.ts`; without one, the
    built-in eight widths in light). The widths and the scheme come from
    the profile with no flag, a proof runs a pass in each scheme it names
    (the dark one's captures end in `-dark`), and never in a scheme the
    site does not have.
- **`design-graphics`:**
  - § 1: `lab serve` prints the URLs to hand over, each scene's own
    `/scene/<name>`. `lab route` waits until `/lab-demo` answers on the
    dev server (`pnpm kit serve` starts it, with the lab) and prints its
    URLs, and `demo new --timeline` gives a moving candidate its timeline.
    A public URL goes over only where the firewall opens the port to the
    viewer's IP only. Inline `Icon` data follows the scheme, and an `<img>`
    of a `.svg` must read on both grounds only on a site with two.
  - 3.1: the graphic is looked at, and rendered with `--scheme`, in each
    scheme the profile names (light and dark without one), in place of
    "light and dark" and `--scheme dark`.
- **`setup`:** § 1. It is new, written whole. On a site that has not taken
  3.2 it runs `pnpm install --frozen-lockfile` and
  `pnpm exec agentic-cms setup` in place of `bash scripts/setup.sh`, and
  `pnpm exec agentic-cms urls` in place of `pnpm urls`.

**`AGENTS.md`:** `init` never rewrites it outside the rules table. Add
these lines by hand, as a new site's `AGENTS.md` carries them. After the
bullet on content (`Content is files under content/ …`):

```md
- **Every page is a content file.** It is `content/pages/<slug>.yaml`,
  rendered by the catch-all route through the section registry; a new page
  is `/editorial:new-page` (or the page template), a new section type a
  schema, a component and a registry entry, together. A page's copy
  (headings, body, labels, alt text, the SEO fields) never lives in a
  component, a `page.tsx` or `src/config/` (the chrome is configured in
  `site.ts`, a form in `forms.ts`). A route outside the content engine
  (the API, the feed, a design round's `*-demo`, `lab-demo`) is a named
  exception with its reason, in `src/config/components.json` where the
  site runs the guard. The pages rule has the rest.
```

After the bullet that names the engines' contracts:

```md
- The kit's know-how is under `node_modules/agentic-cms/docs/`, read
  there, not copied: `setup.md` on a fresh clone or a new machine;
  `dev-server.md` before starting a server or handing over a URL;
  `browsers.md` for what Chromium, WebKit and the owner's Safari each
  check; `primitives.md` for what a new site builds first; `gotchas.md`,
  the traps by topic, before touching an area it lists.
- A machine's address never goes into the repo: it is found when needed,
  per developer, and lives in the gitignored `.env.local`
  (`ALLOWED_DEV_ORIGINS`, `dev-server.md`).
```

Among the rules for how the work is done, after the one on reading a
screenshot (measure with `pnpm kit probe` and `pnpm kit shot`, don't
guess):

```md
- The site is designed, looked at and measured at its widths — for a new
  site four: 390, 768, 1440 and 1920.
- Rejected and unapproved candidates are deleted, never archived or kept
  "for later" (`pnpm kit demo clean`, `pnpm kit lab clean`).
```

Where your `AGENTS.md` gives the screenshot harness's rules, replace the
advice to capture every page rather than a subset to save time (in a site
from `init`, the clause "so capture the full set rather than a `--pages`
subset to save time (`--pages` is for looking at one page; `--sample <n>`
for a site with many posts)") with:

```md
; keep a proof as short as the change allows — the site's widths
(`capture --widths`), the pages the change touches (`--pages`), one page
per template (`--sample 1`) only when the change is site-wide, `--states` /
`--motion` only when hover or animation changed, never a scheme the site
does not have
```

Two more lines of a new site's `AGENTS.md` belong to later steps: its
motion bullet, which names the play-once layer beside `Fx` and `OnView`
(3.5), and the sentence on CI in its verify bullet (3.3).

**What changes without any action from you:**

- `visual-parity proof --build` works: it builds the tree before the first
  after capture. Before, it exited 2 on every call. `--pages` with
  `--sample` is refused up front.
- A `--ref` baseline is built with your `.env.local` (copied into its
  worktree), so a build-time value is the same on both sides. With a
  `.env.local`, the first proof after the upgrade rebuilds its baseline
  once: the old build was made without it.
- With no profile (§ 3.1), every command's defaults are what they were:
  a capture takes the eight widths and light, the menu is shot at 767 and
  390, and a bare `proof` runs one pass in light against `develop`. The
  one difference: a menu shot is skipped where the menu button does not
  show, instead of failing the capture.
- The lab timeline keeps play-once motion on its range after it ends,
  with the fill of what it drives pinned to `both` (under the timeline
  only), and finds, measures and plays motion that starts after it mounts.
  `InlineAnimation` under a timeline leaves its clock to it
  ([lab.md § Inspecting motion](lab.md#inspecting-motion--the-timeline)).
- `demo new` and `lab route` wait until their route answers on this
  clone's running `next dev` (the one `.next/dev/lock` names, on whichever
  port, or the server `--url` names), up to `--timeout` (120 s), and print
  the URLs to hand over, with a warning for each host
  `ALLOWED_DEV_ORIGINS` lacks. A route that answers 5xx prints the error's
  tail and exits 1, where the command used to exit 0 before the route had
  compiled. Another server on the `scripts.dev` port, such as another
  checkout's, is named at once and exits 1. With no dev server running,
  each prints `pnpm kit serve` and exits 0, as before; `--no-wait` asks
  nothing. Their `--json` gains `urls`, `ready` and `status` (and
  `demo new`'s a `kind`).
- `lab serve` lists real network addresses only: no container or VM bridge
  (`docker0`, `br-…`, `veth…`, `virbr…`) and no Mac tunnel. It also
  prints each scene's own page, `/scene/<name>`, on every address.

**Check:** the verify block, then
`pnpm kit visual-parity proof upgrade --ref develop --build --all`: the
static pass, `--states` and `--motion`, in each scheme the site has. Every
pass must be identical: each page shot, each state's box, and each
`--motion` step's settled frame. A mid-flight frame (`-150`, `-500`) that
differs is re-run once with `--fresh`, and identical then is accepted; a
`FLAKY` line is a shot taken with an image still loading, retaken with
`--pages <route> --fresh`. Any other difference is a kit bug: report it
with the `cause:` line the compare prints under it rather than adjusting
the site.

The baseline is built in a sibling worktree, `../<checkout>-ref-<sha>`
(this checkout's folder name and the first 12 characters of `develop`'s
sha), with a full `pnpm install` and `pnpm build`: minutes the first time,
reused while `develop` stays at that sha, and replaced when it moves. Once
the migration is merged, remove it with
`git worktree remove ../<checkout>-ref-<sha>`, and the captures with
`pnpm kit visual-parity clean` (`--cache` empties the shot cache too).

## 2. Breaking changes

None planned. If a job has to break something, it is listed here with the
step that fixes it.

Watch:
- The screenshot harness learns the new motion layer's markers *(job 8)*. If
  that changes a captured frame, the CHANGELOG says **recapture baselines**.
- A site with no profile keeps the built-in widths: only the kit's own
  example moved to four, so nothing to recapture until the site writes a
  profile (§ 3.1).

## 3. Adopt what you want

### 3.1 The site profile

**Why:** proofs are only as long as your site needs. Without a profile the
default is eight widths, every page and light only — or a second capture in
dark that each command has to be told about.

**Do:** say what your site is, once, in `src/config/harness.ts` (create it
with just these keys if the site has no seed):

```ts
export const harness = {
  storage: { /* as before */ },
  widths: [390, 768, 1440, 1920],
  schemes: ["light"],                    // ["light", "dark"] if the site has both
  proof: { pages: ["/"], ref: "develop" },
};
```

Every key is optional; one you leave out keeps the built-in default. A
site whose short proof is one page of each template says
`proof: { sample: 1 }` in place of `pages` (one or the other: both exit 2),
and `--pages` or `--sample` on the command line sets it aside for a run.
Then make the profile the site's proof in `AGENTS.md`, where it gives the
screenshot harness's rules: after the line that names their contract,
`node_modules/agentic-cms/docs/visual-parity.md`, add
"The site's profile in `src/config/harness.ts` says once what every
capture takes without a flag: its `widths`, its `schemes` (a proof runs a
pass in each, the dark one's captures ending in `-dark`) and `proof: {
pages, ref }`, what a bare `pnpm kit visual-parity proof` covers and
proves against — so that command, with no flag, is the site's proof.", and
"the site's widths (`capture --widths`)" becomes "the profile's widths and
schemes (a flag only for a run that needs others; never a scheme the site
does not have)" (dropping the later "never a scheme the site does not
have").

**Check:** `pnpm kit visual-parity proof profile --build` takes only those
widths, pages and schemes (one pass per scheme), and opens the menu at each
width below the menu breakpoint (where its button shows). A key of the
wrong shape exits 2 naming it. Baselines taken at other widths no longer
compare: recapture them. The shot cache carries over: with the widths the
site passed as a flag before, this first proof retakes only the home page,
at the widths where the menu is now tried, and copies every other
page-width; with new widths it takes every shot, as long as a first
capture.

**If you wrote your own short-proof script:** delete it, and point the
package script, if you keep one, at `agentic-cms visual-parity proof`:
`--sample 1` is one page per template, and `--pages` the pages a change
touches.

### 3.2 `setup`, `urls`, `serve`

**Why:** a co-worker, or their agent in Claude Code or Codex, sets the site
up from a fresh clone with one command, and the owner's phone gets URLs
that work: a page opened from an address `next dev` was not told about
renders and never hydrates.

**Do:**

1. Copy the setup script, which checks Node, gets pnpm at the
   `packageManager` version and installs the dependencies (none of which a
   command inside `node_modules` can do for itself), then runs
   `agentic-cms setup`:

   ```bash
   cp node_modules/agentic-cms/templates/site/setup.sh scripts/setup.sh
   ```

2. Add `"urls": "agentic-cms urls"` to the package scripts. Don't add a
   `setup` script: `pnpm setup` is pnpm's own command.
3. Run `bash scripts/setup.sh` once (`--deps` to let it install WebKit's
   Linux libraries with `sudo`, `--no-public` on a machine no viewer
   reaches from outside). It:
   - installs Chromium and WebKit when they are missing, and on Linux
     checks that WebKit launches, printing the `sudo` line for its
     libraries when it does not;
   - writes `.env.local` from `.env.example` when absent, and adds this
     machine's LAN and public addresses to `ALLOWED_DEV_ORIGINS`;
   - runs `pnpm lint` and `pnpm test` (`--build` adds `pnpm build`);
   - prints the dev server's and the lab's URLs, the dev server said
     running only when it is this clone's own `next dev` (another
     checkout's server on the port is named as such, as `pnpm urls` does).
4. In `AGENTS.md`, the know-how bullet's "`setup.md` on a fresh clone or a
   new machine" becomes "`setup.md` on a fresh clone or a new machine
   (`bash scripts/setup.sh`; the `setup` skill runs it)", and the
   addresses bullet's "(`ALLOWED_DEV_ORIGINS`, `dev-server.md`)" becomes
   "(`ALLOWED_DEV_ORIGINS`; `pnpm urls` prints the URLs to hand over and
   `--write` adds the missing hosts; `dev-server.md`)". The `setup` skill
   comes with `init --agent-files` (§ 1).
5. From then on, `pnpm kit serve` starts the dev server for a look, in
   place of `pnpm dev`: `next dev` on the port of `scripts.dev`, the lab
   when `.parity/lab` has a scene, the root and every demo route waited
   for, and their URLs, and the lab's, in one table, naming each address
   `ALLOWED_DEV_ORIGINS` lacks (`--write-origins` adds it before the
   server starts). Ctrl-C stops both. It runs through the `kit` script
   `init` writes (`"kit": "agentic-cms"`); a site without one runs
   `pnpm exec agentic-cms serve`. `pnpm urls` prints the same URLs with no
   server started, and `pnpm urls --write` adds a missing origin. In
   `AGENTS.md`, the addresses bullet's "`pnpm urls` prints the URLs to
   hand over and" becomes "`pnpm kit serve` starts the dev server and
   prints the URLs to hand over, `pnpm urls` prints them alone and", as a
   new site's has it.

**Check:** `pnpm exec agentic-cms setup --check` exits 0 (it writes,
installs and runs nothing), `pnpm urls` exits 0, `pnpm kit serve` prints
its table with a `200` on every route, and the owner's phone loads a page
from it that hydrates (a menu opens).

**If you wrote your own setup or addresses script:** delete it once this
works, with any package script that ran it. Keep your site-only steps as a
short script that calls `bash scripts/setup.sh` first, then does its own.

### 3.3 CI

**Why:** the lint, the tests and the build on every pull request, and the
agent files checked against the kit.

**Do:** if `.github/workflows/` has no verify workflow, copy the one a new
site gets from `init`:

```bash
mkdir -p .github/workflows
cp node_modules/agentic-cms/templates/site/verify.yml .github/workflows/verify.yml
```

It takes Node from `.nvmrc` and pnpm from `packageManager` in
`package.json`, as a site from `init` has them. If your site has a
workflow of its own, add the step
`pnpm exec agentic-cms init . --agent-files --check` to it. That step
passes a rule or skill your site edited while the kit's text of it is the
one your site took (`modified`), and fails on one the kit changed since
(`modified, kit changed`), a stale one or a missing one: a site that keeps
edits of its own merges and accepts the kit's changes (§ 1) and keeps the
step.

**Check:** a pull request runs it, and it passes.

### 3.4 Light only

**Why:** a site without dark mode should carry no theme script, toggle or
`light-dark()` pairs, and no proof or lab ground in a scheme it doesn't have.

**Do:** set `schemes: ["light"]` (§ 3.1): from then on no capture, proof or
lab ground is in dark. If your site still has the example's theme wiring,
remove it as `init --light-only` does for a new site:
- `src/app/layout.tsx`: delete the `THEME_SCRIPT` constant (with its
  comment) and the `<script>` that renders it, drop
  `suppressHydrationWarning` from `<html>` (unless the play-once layer's
  `motionScript()` is in use: it needs it), and set
  `viewport.colorScheme` to `"light"`;
- `src/styles/base.css`: `:root { color-scheme: light; }` in place of
  `light dark` and the two `:root[data-theme=…]` rules;
- `src/app/globals.css`: each `light-dark(a, b)` becomes `a`;
- `src/components/ui/ThemeToggle.tsx` goes, with its import and its
  `<ThemeToggle />` in the navbar or anywhere else it is rendered;
- `STANDARD.md` and `src/components/README.md`: the theme passages go
  (the kit's copies mark them `<!-- dark-mode:start -->` … `<!--
  dark-mode:end -->`).

**Check:** `grep -rn "ThemeToggle\|THEME_SCRIPT\|data-theme\|light-dark(" src`
finds nothing, and a proof of the change is identical in light. The theme
toggle is gone, and that is intended: say so in the commit.

### 3.5 The play-once motion layer *(jobs 7, 8)*

**Why:** `Fx` replays each time an element re-enters the viewport. The new
layer in `agentic-cms/ix` plays once, when it first enters, never on hover
or a second scroll, and its loops run only on screen:
- `Reveal`, `RevealGroup`, `Sequence`, `part()`;
- `motionScript()`, the inline script that arms motion before first paint.

**Not required:** a site on `Fx` and `OnView` can stay on them. Both are
kept and documented.

**Do:**
1. Render `motionScript()` near the top of `<body>`, beside the theme
   script (`<html>` keeps `suppressHydrationWarning`):
   `<script dangerouslySetInnerHTML={{ __html: motionScript() }} />`, with
   `motionScript` from `agentic-cms/ix`.
2. Copy the block that starts at "The play-once layer" at the end of
   `node_modules/agentic-cms/src/styles/motion.css` into your
   `src/styles/motion.css`, its `:root` custom properties with it
   (`--ease-enter`, `--ease-move`, `--ease-pop`, `--motion-fast`,
   `--motion-base`, `--motion-slow`, `--motion-travel`,
   `--motion-stagger`), then give them your values. Keep them out of
   `@theme`: there they would bring back the `ease-*` utilities.
3. Use `Reveal` and friends in new work (`STANDARD.md` §7, the components
   catalogue). Move existing reveals only when the owner wants them to stop
   replaying.

**Check:**
- a browser check: scroll away and back, and nothing replays; hover, and
  nothing replays;
- with reduced motion, nothing is hidden;
- `pnpm kit probe <page> --select <element> --motion` lists the parts
  below the fold under `reveals.pending`, each with its kind;
- `pnpm kit visual-parity proof motion --motion --build`.

**If you wrote your own play-once layer:** switch the imports to
`agentic-cms/ix`, then delete your components, your hooks and any lab
timeline patch of your own. The timeline pins the fill of what it drives
to `both`, so a fill override under `[data-lab-timeline]` goes; the
layer plays at once under a timeline, as `docs/lab.md` § Inspecting
motion asks of any motion. The layer's markup is `data-motion="on"` on
`<html>`, `data-motion-root`, `data-part`, `data-play`, `data-visible` and
`data-intro`, with `--d`, `--len` and `--dim`: a stylesheet of your own
written for those names keeps working, any other takes the kit's block
(step 2).

### 3.6 `variants()`, tokens by role, the example's primitives *(job 9)*

**Why:** one typed map of looks per primitive, so a new look is a line and
never a copy. Components name roles (`panel`, `line`, `on-ink`) wherever one
applies, never the hue behind it.

**Do:**
- **`variants()`:** `import { variants, type VariantProps } from "agentic-cms/cx"`,
  beside `cx`. `variants({ base, variants, defaults, compound })` returns
  the function that picks a look (`button({ variant: "outline" })`), and
  `VariantProps<typeof button>` types the component's props. An option an
  axis lacks throws and names the options it has. The components catalogue
  (`node_modules/agentic-cms/src/components/README.md` § Class helpers) has
  an example.
- **Tokens by role:** add the roles to `@theme static` as aliases of your
  values, the radius and shadow roles after any `--radius-*: initial` /
  `--shadow-*: initial` reset:

  ```css
  --color-panel: var(--color-paper);   /* a panel's face: a box with a ground of its own */
  --color-line: var(--color-ink);      /* every hairline: a border, a rule, a cross */
  --color-on-ink: var(--color-paper);  /* text on an ink ground */
  --text-h1--letter-spacing: normal;   /* and so on, to h6 */
  --tracking-label: normal;            /* a label's letter-spacing */
  --radius-panel: 0;
  --radius-control: 0;
  --shadow-panel: 0 0 #0000;
  --shadow-glow: 0 0 #0000;
  ```

  The values are yours: alias your own colour names, and give radius and
  shadow your design's values. In `src/styles/base.css`, `h1`–`h6` read
  `letter-spacing: var(--text-hN--letter-spacing)` beside their size. Then
  move components onto the roles where one applies: a hairline is
  `border-line`, a box with a ground of its own `bg-panel`, text on an ink
  ground `text-on-ink`. While each role aliases the value a component
  named, nothing moves and the proof is identical. The styling rule and
  the `design` skill that `--agent-files` writes say it; if you kept an
  edited copy, take their token lines from the kit's (§ 1).
- **Primitives:** the example now has `Panel` (`solid`, `dashed`, and
  `panel()` for an element a component draws itself), `OutlineButton` (a
  choice, `aria-pressed` when it toggles), `IconButton` (44 px, its label
  required), `Heading` (its level apart from its `size`, and an `entrance`
  through `Reveal`), `MetaLine` and `metaLabel`, `TextLink`, `Media` and
  `keepWords` (`ui/text.ts`), and `Button` declares its looks with
  `variants()` (`button`, behind `buttonClass`). `init` never
  copies the example into an existing site, so copy the ones you want from
  `node_modules/agentic-cms/src/components/ui/` with their catalogue rows
  (`src/components/README.md`, with its § Library first and § Extending a
  primitive), and restyle them with your tokens: each asks for the roles
  above. The example's cards are a `<Panel as="li">` around each section's
  own content, and `Section` draws its box with `Panel`; a site that adopts
  `Panel` moves its card frames the same way and keeps what goes inside
  them. The design rule `--agent-files` writes says "a section's card
  content is its own, its frame the site's one card frame (`ui/Panel` on a
  site that has the example's)"; an edited copy takes that line by hand
  (§ 1).
- **The guide:** `docs/primitives.md` is the checklist of what a site builds
  on day one and what waits for a second use.

**Check:** the verify block, and a proof. Adopting a primitive in place of
existing markup must be pixel-identical, or it is a design change in a
commit of its own.

**If you wrote your own `variants()`:** delete it and its test, and switch
the imports.

### 3.7 The component library, enforced

**Why:** UI is made only in the library, and ESLint and CI keep it that way:
- the layers: `motion ← ui ← patterns ← sections`;
- no raw elements, styles or visual classes in a section, and no copy (3.9);
- every primitive catalogued;
- `src/app` holds route files only, in the content engine's folders and
  the named exceptions'.

**Do:**
1. Add the guard's config, `src/config/components.json`, with the same
   folders as step 2's options (`motion`, `ui`, `patterns`, `sections`,
   `registry`, `ignores`; `null` for a layer you do not have), the content
   engine's route folders under `routes` and every other route folder
   under `exceptions`, each with the reason it stays outside the engine,
   then run the guard:

   ```json
   {
     "motion": null,
     "patterns": null,
     "sections": ["sections"],
     "routes": ["src/app", "src/app/[[...slug]]"],
     "exceptions": {
       "src/app/blog-post/[slug]": "the blog engine: a post is content/blog/<slug>.md, rendered by the post template",
       "src/app/api/forms/[id]": "the form endpoint, POST /api/forms/[id], the one route that runs at request time",
       "src/app/feed.xml": "the RSS feed, written from the posts"
     },
     "inherited": []
   }
   ```

   ```bash
   pnpm exec agentic-cms check-components
   ```

   Each finding names its file and its fix. List every file it finds under
   `inherited`: those are frozen, not rewritten, and leave the list as you
   replace them. An export the catalogue does not name is quicker named
   than frozen: add it, in backticks, to `src/components/README.md`
   ([primitives.md § Placed](primitives.md#placed-agentic-cms-check-components)
   has every key).
2. Spread `componentRules()` from `agentic-cms/eslint` into
   `eslint.config.mjs`, after `eslint-config-next` (which registers the
   `react` plugin two of its rules use):

   ```js
   import { componentRules } from "agentic-cms/eslint";
   // in defineConfig([…]), after ...nextVitals and ...nextTs:
   ...componentRules({ motion: null, patterns: null, sections: ["sections"] }),
   ```

   Name your section folders in `sections` (the example's are its page
   folders, `sections/` and `blog/`) and pass `null` for a layer you do not
   have; with no `motion/` folder, `agentic-cms/ix` is your motion layer
   ([primitives.md § Enforced](primitives.md#enforced-agentic-cmseslint)
   has every option). Run `pnpm lint`: each finding names the primitive to
   use. Move the section onto it, pixel for pixel and proven with
   `visual-parity proof`: a raw `<img>` becomes `Media`, an `<h3>`
   `Heading`, a bordered box `Panel`, an arbitrary grid a token. A file you
   cannot move yet goes into `ignores`, with its reason, until you can.
3. Change the lint script in `package.json` to
   `eslint; s=$?; agentic-cms check-components || s=1; exit $s`: both tools
   report, and either fails the lint, so CI's `pnpm lint` fails too.
4. Run `pnpm exec agentic-cms init . --agent-files`: with the config
   present, it writes the components rule (`.claude/rules/components.md`)
   and its row in `AGENTS.md`'s scoped-rules table. Without the config it
   never writes the rule, and `--check` does not report it missing.

**Check:** `pnpm lint` passes on the current tree, and
`pnpm exec agentic-cms init . --agent-files --check` is clean. A planted
violation fails the lint, each caught by the tool meant for it: a raw
`<button>` in a section by ESLint; a new file in a section folder that the
registry does not import, or an export of `ui/` the catalogue does not
name, by the guard. Remove the plant.

**If you wrote your own guard and lint:** move your config's lists into
`src/config/components.json` (the layers, the route folders, the frozen
list as `inherited`), then delete your scripts and the rule you wrote; the
kit's rule replaces yours at step 4.

### 3.8 The know-how pointers

**Why:** the kit now carries the traps and the practice once, for every
site, under `node_modules/agentic-cms/docs/`:
- `setup.md`: a fresh clone on a new machine, step by step, and what to
  do when a step fails;
- `dev-server.md`: the ports, which address to hand over, the allowed
  origins, stopping a server, old proof baselines;
- `browsers.md`: what headless Chromium, headless WebKit and the owner's
  Safari each check, what headless cannot show, the engines' differences;
- `primitives.md`: the tokens, what the kit provides, the day-one
  primitives, what waits for a second use, the rules every primitive
  follows;
- `gotchas.md`: the traps by topic (Next.js, Tailwind, CSS and SVG,
  measuring, pnpm, git and GitHub, services);
- `deploy.md`: the notes for Cloudflare Workers, Google Cloud Run and
  Azure App Service beside the Node server;
- `design.md` § Handing over and merging: the checklist before a URL goes
  to the owner and before a merge.

**Do:** add the `AGENTS.md` lines from § 1. If your site wrote its own
copies of these guides, delete each entry the kit's guide now has, and
keep what is only yours: your brand and design directions, your clone
URL, your chosen host, your services, and your own overrides of the kit.
Point your `AGENTS.md` at the kit's guide for the rest.

**Check:** `grep -rlE "ALLOWED_DEV_ORIGINS|install-deps webkit|auto-cols-fr|not all and \(min-width" docs/`
finds nothing your site does not keep on purpose, and your `AGENTS.md`
names the five guides.

### 3.9 Pages as content files

**Why:** a page in the content engine is a file the build checks: its
`seo` block audited, its copy linted against `content/VOICE.md`, its
sections validated, the next page one `/editorial:new-page` away. A
hand-written `src/app/<page>/page.tsx` with its copy inside gets none of
that, and once the site runs 3.7 the lint and the guard refuse it.

**Do,** one page per commit, each proven before the next:
1. For each block of the page, take the section type in
   `src/components/sections/schemas.ts` that fits. Where none does, add
   one: its schema (copy only, every field described), its component in a
   section folder taking that copy as props, and its entry in `render.tsx`.
   Move the block's markup into the component as it is; only its words
   leave.
2. Write `content/pages/<slug>.yaml` from `content/_templates/page.yaml`:
   `seo` from the route's metadata (`seo.path` is its URL, unchanged),
   `jsonld`, and the sections in order with the copy the route held, word
   for word.
3. Delete the route's folder, `src/app/<page>/`: the catch-all renders the
   page at the same URL.
4. Prove it against the commit before, on that page alone, and commit:

   ```bash
   pnpm kit visual-parity proof page-<slug> --ref HEAD --pages /<path> --build
   ```

With every page moved, adopt the exceptions (3.7) for what stays outside
the engine: `routes` keeps the app folder and the catch-all, and each
other route folder (an API route, the feed, the post template) goes under
`exceptions` with its reason.

**Check:** `pnpm lint` and `pnpm build` pass, each page's proof was
identical, and `git ls-files 'src/app/**/page.tsx'` lists the catch-all
and the named exceptions' pages alone.

## 4. Delete what your site wrote itself

Each row goes only after its step works.

| You wrote | Now | After |
|---|---|---|
| a setup script (Node, pnpm, the install, the browsers, `.env.local`, a verify) | `scripts/setup.sh` from the kit's template, which ends in `agentic-cms setup`; site-only steps in a script that calls it first | 3.2 |
| a script that finds the machine's addresses or writes `ALLOWED_DEV_ORIGINS`, and its package script | `pnpm urls` (`agentic-cms urls`, `--write`) | 3.2 |
| a short-proof wrapper, or a workaround for `proof --build` | `visual-parity proof` with the profile | 1, 3.1 |
| a lab-timeline patch for play-once motion | the timeline itself | 1 |
| a play-once motion layer | `agentic-cms/ix` | 3.5 |
| `variants()` | `agentic-cms/cx` | 3.6 |
| a placement guard and its config, component lint rules, a components rule | `agentic-cms check-components` with `src/config/components.json`, `agentic-cms/eslint`, the components rule `init --agent-files` writes | 3.7 |
| hand-written review routes (a page of every primitive, of every motion) | `demo new <name> --showcase --component <file>…` (`--timeline` for motion), removed by `demo clean` with every file only it uses | 1 |
| a script that starts the dev server and the lab, waits for a route, prints its URLs, or clears Turbopack's cache | `pnpm kit serve` (`--fix-cache`); `demo new` and `lab route` wait themselves | 3.2 |
| copies of the gotchas, browser, dev-server or setup guides, or a primitives spec | the kit's docs, plus your site-only lines | 3.8 |
| hand-written page routes (`src/app/<page>/page.tsx` with the copy inside) | `content/pages/<slug>.yaml` through the section registry; every other route folder an `exception` with its reason | 3.9 |

## Two paths, worked

- **A site that wrote its own versions of what 0.8.0 brings:** § 1, then
  the steps that replace them (3.1, 3.2, 3.5, 3.6, 3.7, and 3.9 for its
  hand-written pages), deleting each § 4 row as its step lands. Then 3.8
  and § 5.
- **A site on `Fx` that wrote none of it:** § 1, then 3.1, 3.2 and 3.8.
  Keep `Fx`. Take 3.3 only for the agent-files check, if it has CI.
  Take 3.7 when the owner wants it, with every existing component in
  `inherited`, and 3.9 for any page that is a hand-written route. Then § 5.

## 5. Check

- The verify block: `pnpm lint`, `pnpm test`, `pnpm content:lint` and
  `pnpm build`, 0 failures.
- `pnpm exec agentic-cms init . --agent-files --check` is clean: every file
  the kit's text, or your edit of it (`modified`).
- `pnpm kit visual-parity proof migrate --ref develop --build` is identical,
  except for the design changes you chose and committed apart (3.4's
  toggle).
- The owner looks on the dev server (`pnpm kit serve`), then the merge.

## When something fails

| Symptom | Do this |
|---|---|
| `init --agent-files --check` reports a rule or skill `modified, kit changed` | You edited it and the kit changed it since: `--diff`, merge by hand, `--accept` (§ 1). `--force` would discard your edits |
| The proof differs after § 1 alone | A kit bug: open an issue with the compare's `cause:` line; don't adjust the site |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` misses the `allowBuilds` key the error names, or lists it under `onlyBuiltDependencies`, which pnpm no longer reads: add it under `allowBuilds` as `<name>: true`. A new site's `init` writes the kit's three keys and merges them into a workspace it finds |
| `pnpm lint` fails everywhere after 3.7 | Files the guard finds that the site had before it: list them under `inherited` in `src/config/components.json`, then replace them one pull request at a time. A layer the config names but the site lacks is `null` |
| `check-components: no src/config/components.json here` | The lint script runs the guard before its config exists: § 3.7 step 1 first |
| A page on the owner's phone renders but nothing works | Its address is missing from `ALLOWED_DEV_ORIGINS`: `pnpm urls --write`, then restart the dev server (or `pnpm kit serve --write-origins`, which writes it before the server starts) |
| `serve: port 8000 answers, but not as this site's next dev` | Something else holds the port (another project's dev server, `pnpm preview`): stop it if it is yours, or `pnpm kit serve --port <another>` |
