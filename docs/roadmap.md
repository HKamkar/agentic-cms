# Roadmap — 0.8.0: a new site in minutes

> Plan, not started. Written 2026-10-15 from a read of the kit at 0.7.6
> (`main` 14c6f95, `develop` 28be17f) and from the first days of a site
> built on it.

Starting the last site took days before the first design round could run,
and most of that time was not design. Three causes:

1. **The kit's own friction.** `docs/init.md` has the reader run `pnpm init`
   and write `pnpm-workspace.yaml` first; `init` then keeps that workspace
   (without `unrs-resolver`: `ERR_PNPM_IGNORED_BUILDS`) and lets `pnpm init`'s
   failing `test` script win the merge. Nothing installs pnpm on Node 25+
   (no corepack), Chromium or WebKit; nothing finds the machine's addresses
   or fills `ALLOWED_DEV_ORIGINS`, so the owner's phone got a page that never
   hydrated. The default proof is eight widths × every page × two schemes,
   even on a site with no dark mode; `visual-parity proof --build` exits 2 on
   every call; `demo new` exits before the route answers (a 404 for the first
   seconds); there is no review page that is not a section's candidates; the
   lab timeline cannot scrub play-once CSS motion.
2. **The owner's practice lived outside the kit** and was brought in
   mid-build, each time a rework: how previews reach the owner's devices
   (demo route and lab, Chrome and Safari), the gotchas, the
   primitives spec, library-first enforcement, the play-once motion standard,
   tokens by role and `variants()`, four design widths, the short proof, a
   setup any agent can run from a fresh clone, CI.
3. **The design work itself** — brand, logo, boards — which is the part
   that should take the time.

0.8.0 removes the first two. **Target:** from an empty folder to the owner
looking at a demo route and a lab scene on their own phone, with nothing
from outside the kit: `init`, `bash scripts/setup.sh`, `pnpm kit serve`,
`pnpm kit demo new …` — minutes of machine time, no hand-edited file.

**0.8.0 is the whole roadmap.** Each job below is one pull request against
`develop`, one session (jobs 9 and 10 two each, see Order); the release is
one pull request `develop` → `main`
when the last job has landed, tagged `v0.8.0`. `package.json` stays at
0.7.6 on `develop` until the release commit.

## Principles

- **Behaviour in the package, look in the example.** The package exports no
  styled element (`docs/design.md:166-171` stands). Styled primitives go into
  the example under `src/`, which `init` copies and a site replaces.
- **Nothing of any site.** No site's name, palette, copy or host choice; no
  machine path or address (`tools/hygiene.mjs`; run `pnpm hygiene --brand
  <site>` every job, since only the README showcase names are guarded by
  default), and no description of a site: not its pages, sections,
  components, scripts, artwork or services. Evidence from a site is numbers.
- **Defaults come from the site, not from flags.** A site says once what it
  is (its widths, its schemes, the pages a proof covers); every command
  reads that; a flag overrides it for one run.
- **Upgrading is safe by default.** A site on 0.7.6 that bumps the tag and
  runs `init --agent-files` builds, lints and proves identical. Everything
  else 0.8.0 brings is opt-in, step by step in the migration guide
  (`docs/migrating-to-0.8.0.md`, drafted with this plan). Nothing the kit
  writes into a site — a rule, a skill line — describes a tool the site has
  not adopted.
- **The wireframe stays what it is.** It animates nothing (STANDARD §7) and
  every job that touches it is pixel-identical, proven with
  `visual-parity proof` in both schemes (the example has dark mode), unless
  the job says "design change".
- **A command is the contract** (`AGENTS.md:227-235`): a spec in
  `scripts/lib/specs.mjs`, `parseOrExit`, the logic in `scripts/lib/<name>.mjs`
  with the shell and file system passed in, a unit test, bin cases, a
  `docs/` page and its index line, `pnpm docs:commands`, a CHANGELOG line —
  in one pull request.
- **Know-how is written once, where every site reads it:**
  `node_modules/agentic-cms/docs/`, and the agent files `init` writes.

## Hygiene, every pull request

- Branch `feat/<slug>` | `bugfix/<slug>` | `docs/<slug>` off `develop`;
  commits `<area>: <what>`; no AI attribution lines (the kit's rule,
  `AGENTS.md:416-417`).
- A line under `## [Unreleased]` in `CHANGELOG.md` (create the heading in
  the first job), with **recapture baselines** when what a capture writes
  changes.
- **The migration guide.** Each job fills its section of
  `docs/migrating-to-0.8.0.md`:
  - what a site must do (ideally nothing);
  - what it may adopt, and why;
  - what it deletes if it wrote its own;
  - how it checks.

  `docs/upgrading.md` gets a short `## 0.7.6 → next (unreleased)` entry
  that links to the guide.
- `pnpm skills:sync` after a skill edit; `pnpm docs:rules` after a rule
  edit (both trees: `.claude/rules/` and `templates/site/rules/`);
  `pnpm docs:commands` after a spec edit.
- Budgets: the kit's `AGENTS.md` is 27,279 of 32,768 bytes, the template's
  12,072 of 16,384 — new practice goes into `docs/` with a one-line pointer.
- The verify block (`AGENTS.md`), `pnpm test:browser` when harness, lab or
  browser code changed, `pnpm test:pack` when `package.json`, `src/lib/` or
  `scripts/` changed.

## The jobs

| # | Job | What it removes |
|---|---|---|
| 0 | This plan into `docs/roadmap.md` | — |
| 1 | Bugs found on the way | `proof --build` exit 2; wrong help and docs |
| 2 | The know-how: guides, gotchas, practice | bringing practice in from outside the kit mid-build |
| 3 | `init` that works the first time | `ERR_PNPM_IGNORED_BUILDS`, the failing `test`, no CI |
| 4 | `setup` and `urls` | hand-installed pnpm, browsers, WebKit libraries; hand-found addresses |
| 5 | The site profile: short proofs by default | 8-width, two-scheme proofs; a hand-written proof script |
| 6 | `serve`; a demo or lab that hands itself over | starting servers, waiting out 404s, composing URLs |
| 7 | The lab timeline drives play-once motion | a slider with nothing to scrub; a site's CSS patches |
| 8 | A play-once motion layer in `agentic-cms/ix` | every site writing `Reveal`/`Sequence` again |
| 9 | Tokens by role, `variants()`, day-one primitives | rebuilding the primitives from a pasted spec |
| 10 | The component library, enforced | every site writing its own guard and lint |
| R | Release 0.8.0 | |
| S | The sites on 0.7.6 follow | a site's local copies of what moved into the kit |

Order: 1 and 2 first (no dependencies); 3 → 4 → 5 → 6 (each uses the one
before: 6 prints URLs through 4's host library and reads 5's profile);
7 before 8 (the layer relies on the timeline); 9 before 10 (the lint names
the primitives a section must use). Jobs 3–6 update the lines of job 2's
guides that describe a step their command now does.

They run in two lanes. Jobs 1 and 2 run together; then 3 → 4 → 5 → 6 runs
beside 7 → 8 → 9 → 10, and 10 starts only after 5 has landed (both change
`scripts/lib/init.mjs`). Jobs 9 and 10 land as two pull requests each:
- 9a: the role tokens and `variants()`;
- 9b: the primitives and the card frames;
- 10a: the ESLint preset and the components rule;
- 10b: `check-components`, the lint script `init` writes, and the
  conditional agent files.

**Decided** marks a choice the owner settled when reviewing this plan
(2026-10-15), each the recommendation the plan gave. A job that finds a
decision does not hold says so in its pull request.

### 0 — This plan into the repo

- `git fetch && git switch develop` (it tracks `origin/develop` if the
  checkout has only `main`), then branch `docs/roadmap-0.8`.
- This file becomes `docs/roadmap.md`. The 0.4.0 roadmap's text stays in
  history; its open "Later" items move into this one's Later. Change
  `docs/README.md:39` ("what 0.4.0 adds") to "what 0.8.0 adds".
- `docs/migrating-to-0.8.0.md`, the draft migration guide, is committed with
  it, banner and all. `docs/README.md` indexes it.
- `pnpm hygiene --brand <site>`. The owner approves the plan in this pull
  request; no code moves before.

### 1 — Bugs found on the way

1. **`visual-parity proof --build` always exits 2** with "--url, --build and
   --ref are three sources of one build". The guard at
   `scripts/visual-parity.mjs:69` runs for every subcommand, and `proof`'s
   `--ref` is always set (default `develop`, `specs.mjs:138`, filled by
   `args.mjs:75`). The documented example (`specs.mjs:154`,
   `docs/visual-parity.md:21`) never starts. Fix:
   `subcommand === "capture" &&` on the guard; the plan is already right
   (`scripts/lib/proof.mjs:36-37`: `--ref` on the baseline only, `--build`
   on the first after capture only). Tests:
   - `bin.test.mjs`: `proof --build --ref nope` in a temp dir stops at "not
     a commit, branch or tag", not at "three sources";
   - `proof.test.mjs`: no step carries both `--ref` and `--build`.
2. **`proof --pages` with `--sample`** is refused only by the baseline
   capture, minutes in (`visual-parity.mjs:65`): refuse it up front.
3. **`lab clean`'s spec has `summary` twice** (`specs.mjs:452`): the newer
   text never reaches `--help` or `docs/commands.md`. Keep the newer one and
   regenerate the docs.
4. **`src/styles/motion.css:2`** still names `src/components/ix/` (the
   library is `src/lib/ix`).
5. **`useReveal`, `EASE`, `fillBox`** are exported (`src/lib/ix/index.ts`)
   but missing from STANDARD §5/§7 (`:246`, `:336-341`) and the catalogue's
   ix table (`src/components/README.md:207-215`).
6. **The ref baseline's worktree has no `.env.local`** (`ref-build.mjs`),
   while the tree's build reads one, so a build-time value can differ
   between before and after. **Decided:** copy `.env.local` into the
   sibling.
7. **The workspace snippet** in `docs/init.md:19-23` and
   `README.md:292-295` lacks `unrs-resolver: true`. Fix it now; job 3 makes
   the snippet unnecessary.

### 2 — The know-how: guides, gotchas, practice

What one site paid for once, every site reads from
`node_modules/agentic-cms/docs/` and from the agent files `init` writes.
Each item below was checked against the kit's docs, rules and skills on
2026-10-15. **New** means the kit has nothing on it. **Link** means the kit
already covers it: point to it and don't copy it.

Every guide is brand-, host- and machine-neutral. Addresses are
placeholders (`<lan-ip>`, `<public-ip>`), because hygiene fails on a real
`IP:port`. Jobs 3–6 later replace the manual steps written here with their
commands.

**New guides**

- **`docs/gotchas.md`**: traps by topic. Each is the symptom, the reason
  and what to do.
  - **Next.js** (all new):
    - `next dev` refuses its scripts to any origin but localhost, so the
      page renders but never hydrates. Fix with `ALLOWED_DEV_ORIGINS`,
      hostnames only, no scheme or port. A script opening the dev server
      uses `localhost`, not `127.0.0.1`. `-H 0.0.0.0` is not needed: it is
      `next dev`'s default.
    - `experimental.inlineCss` writes the CSS twice, into the HTML and into
      every prefetch (a home page went from 23 to 93 KB gzipped). Leave it
      off; `critical-css` inlines what the first paint needs.
    - Redirects:
      - `permanent: true` sends a 308, so write `statusCode: 301` where a
        301 is meant;
      - an empty `:path*` comes out as the literal token, so www → apex
        takes two rules, `/` and `/:path+`.
    - `next/font/google` fetches at build time and can fail a CI run.
      Re-run once; the lasting fix is `next/font/local`.
    - **Link:** prefetch weight of an eager `<img>` (`EagerImage`,
      `src/lib/components/EagerImage.tsx:9`); the Turbopack cache error
      and stale `validator.ts` (`docs/design.md` § When the dev server will
      not serve).
  - **Tailwind v4:**
    - new: grid items spanning into implicit columns need `auto-cols-fr`;
    - **link** to the styling rule: `text-base`/`text-sm` set a
      line-height, two colour utilities resolve by stylesheet order,
      preflight's zeroes, `h-auto` with a `height` attribute, the dev
      scan cache.
  - **CSS, SVG and performance:**
    - New:
      - no motion widens the page: a moving decoration clips its own box
        (`overflow-x: clip`) and travels in `cqw`. Measure `scrollWidth`
        against `clientWidth` while the animations run, at the narrowest
        width;
      - an SVG with only a `viewBox` has no natural size and becomes
        300 × 150 in a shrink-to-fit box: give it `width` and `height`;
      - an SVG shown as `<img>` cannot use the page's web fonts: measure
        its text widths in Chromium and WebKit (`getBBox()`) and leave
        about 10% spare;
      - `<source media>`: write `not all and (min-width: …)`, because
        Safari before 16.4 ignores the range syntax;
      - loops the compositor cannot run (`stroke-dashoffset`) tick the
        main thread off screen: pause them (desktop blocking time went
        from 260 to 20 ms);
      - design-tool exports hide weight (a full-HD bitmap inside an SVG,
        a filter on every repeated shape): look inside before re-encoding.
    - **Link:** the lab's off-screen stop (`docs/lab.md:148-154`), and
      critical CSS keyed on `data-`/`aria-` (`docs/deploy.md`).
  - **Measuring** (new):
    - Lighthouse quirks:
      - Chrome's paint holding delays the first paint about 1 s under
        Lighthouse, not in Playwright;
      - a local HTTP/1.1 proxy inflates the simulated timings;
      - on a VM, blocking time swings ±200 ms, so use 7 interleaved runs;
      - request and byte counts are exact: trust them first.
    - Prove a new build step with the whole build, never the step alone
      (one once broke 234 `alt` attributes).
  - **pnpm** (new):
    - only direct dependencies resolve from the site, so a script
      importing a kit dependency (`image-size`) fails: add it as a
      devDependency;
    - Node 25+ ships no corepack (job 4's setup handles it);
    - `deploy` and `setup` are pnpm built-ins, so a package script of
      either name needs `pnpm run …` (`deploy` is already in
      `docs/deploy.md`).
  - **Git and GitHub:**
    - New:
      - split a mixed working tree into commits by rebuilding each state
        from `HEAD` with scripted edits, not `git add -p`;
      - `gh pr edit` fails on repositories that hit the Projects (classic)
        deprecation: `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f base=develop`;
      - where auto-merge is off, merge once CI is green with
        `gh api -X PUT …/pulls/<n>/merge -f sha=<head sha>`, so a push
        after the check is not merged.
    - **Link:** stacked PRs and `--delete-branch` (`AGENTS.md:344`), and
      reference worktrees needing their own install (`AGENTS.md:337`).
  - **Services, if used** (new):
    - a form provider can mark a submission spam unless the page's host
      is in its allowed domains: check there first;
    - GA4 can send one event measured before a Reject about 3 s after it.
      That is Google's behaviour, not a consent bug; add the line to
      `docs/consent.md`.
- **`docs/browsers.md`: Chrome and Safari, who checks what.** All new
  except where marked.
  - **Three levels:**
    1. headless Chromium is every kit command: layout numbers, proofs,
       overflow, tap targets, the accessibility tree;
    2. headless WebKit is Safari's engine as a stand-in, for interactions
       and layout checks run as a throwaway two-engine loop (the snippet).
       Report it as "WebKit", never "Safari" (**link**
       `design-graphics/SKILL.md:128-129`);
    3. the owner's real Safari, on a Mac, iPhone or iPad at the versions
       they run, has the final word.
  - **Install:** `pnpm exec playwright-core install chromium webkit`. On
    Linux WebKit's system libraries come from
    `sudo "$(command -v node)" node_modules/playwright-core/cli.js install-deps webkit`.
  - **What headless cannot show:**
    - WebKit on Linux: no `backdrop-filter`, no GPU compositing, no touch
      momentum, no Apple fonts;
    - Chromium without a GPU: software compositing, so FPS means nothing.
      Measure long tasks; `will-change` on many layers slows the software
      compositor and says nothing about a GPU;
    - element screenshots drop children under a 3D `perspective`: capture
      a clip instead.
  - **Engine differences, as a table:**
    - `preserve-3d` depth sorting (set `z-index` from state);
    - `@property` transitions barely animate in WebKit;
    - an iOS swipe stolen by native link and image drag (`draggable={false}`,
      `-webkit-user-drag: none`, `touch-action: pan-y`);
    - a tap that both turns a carousel and navigates through `Link`;
    - a Safari tap focusing a link first (react to `:focus-visible` only);
    - blur and overlay glitches (no `backdrop-filter` at opacity 0, no
      `display` toggles on filter layers, no nested backdrop filters);
    - an iPhone scrolling sideways at 390–430;
    - the `<source media>` syntax;
    - SVG timeline drift (**link** `docs/lab.md:141`).
- **`docs/dev-server.md`: serving previews to the owner's devices.**
  - **Ports:** 8000 dev, 8001 lab.
  - **Which address to hand over:** a laptop gives the LAN address (its
    public one is the router's); a cloud VM gives the public address once
    its firewall opens the port **to the viewer's IP only**, because the dev
    server has no sign-in. The viewer finds their IP at ifconfig.me in the
    browser they will use.
  - **`ALLOWED_DEV_ORIGINS`** goes in `.env.local`, gitignored. **A
    machine's address never goes into the repo**; it is found when needed
    (job 4's `urls`).
  - **Stopping a server:**
    - find it by port (`ss -ltnp 'sport = :8000'`,
      `lsof -iTCP:8000 -sTCP:LISTEN`) and kill it by pid;
    - when matching by name, use a bracketed pattern
      (`pkill -f "[n]ext dev"`);
    - never start and kill in one command line;
    - **link** `next-server` (`docs/deploy.md:121`).
  - **Cache failures:** **link** `docs/design.md`.
  - **Old proof baselines:** remove with
    `git worktree remove ../<repo>-ref-<sha>`, and `visual-parity clean`.
- **`docs/setup.md`: a fresh clone, for a person or an agent.**
  - Node ≥ 22.18 (`.nvmrc`; nvm or fnm);
  - pnpm at `packageManager`: corepack, else `npm i -g pnpm@<version>` on
    Node 25+;
  - `pnpm install --frozen-lockfile`;
  - the browsers;
  - `.env.local` from `.env.example`, plus the origins;
  - verify with `pnpm lint` and `pnpm test`, and `pnpm build` for the full
    gate;
  - a "when something fails" table:
    - `ERR_PNPM_IGNORED_BUILDS`;
    - no Chromium;
    - WebKit libraries missing;
    - the Turbopack cache;
    - a new route answering 404 for its first seconds;
    - a lint failure naming a primitive.

  Job 4 turns the steps into one command and adds the `setup` skill.
- **`docs/primitives.md`: primitives for a new site** (the owner's spec,
  verbatim in substance):
  - tokens first: brand and role colours (page ground, panel face,
    hairline, text on a coloured ground; a token at its second use), the
    type scale with line-height and letter spacing per breakpoint,
    spacing, radius/shadow/glow, easing and durations, a fixed set of
    breakpoints;
  - what the kit provides (don't build): `Fx`/`OnView`/`ease()`/
    `useReducedMotionPref`/`useMainBreakpoint`/`InlineAnimation`,
    `EagerImage`, `JsonLd`, `FaqAccordion`, `EmailLink`, `Icon`, the
    consent store, the form engine;
  - the day-one table: Layout, Type, Actions, Surfaces, Icons, Chrome,
    Consent, Forms, Data, Media and performance, Motion wrappers;
  - add on the second use, not before: `ShowMore`, `Dots`, chips and
    badges, a meter, tabs, a carousel; name any exception to "cards are a
    section's own design";
  - the rules every primitive follows:
    - extendable through props, `className`, `style` and CSS variables,
      and catalogued in the same commit;
    - real `<button>`s and links, with a visible focus ring and 44 px
      targets;
    - decorations as real `aria-hidden` elements;
    - reduced motion honoured, and no motion that widens the page;
    - tokens only;
    - pre-paint states keyed on `data-`/`aria-`, never a class.

  A column says what the example already has; job 9 fills it in.

**Edits to existing guides**

- **`docs/deploy.md`:**
  - **§ Cloudflare** (new lines):
    - `next start` / `wrangler dev` straight after `next build` return
      500s, because only `pnpm preview`, `pnpm run deploy` and
      `pnpm upload` fill the asset cache;
    - about 40 "Failed to copy node_modules/…" lines during the OpenNext
      build are harmless.
  - **§ Google Cloud Run** (new): the Node-host guide applies
    (`output: "standalone"`, `pnpm kit assemble`, `HOSTNAME=0.0.0.0`), and
    Cloud Run's `PORT` is read by the standalone server.
  - **§ Azure App Service** (new):
    - turn Kudu's build off;
    - ARR affinity sets a cookie before consent: turn it off, and again on
      every new slot;
    - slot settings are copied once, when the slot is made;
    - no auto-swap on Linux: staging, a 200, then swap;
    - deploy with `clean: true`;
    - an organisation's OIDC subject can carry ids;
    - managed certificates need the Cloudflare proxy off (DNS only);
    - the sign-in app's client secret expires: put the date in a calendar.
- **`docs/design.md`, a new § Handing over and merging:**
  - **Before handing over a URL:**
    - the candidates use the page's real copy, the current version last,
      lettered with one line each, and a timeline on anything that moves;
    - they are measured at the site's widths;
    - interactions are run in WebKit too;
    - the URL is the public or LAN one with the origin allowed (the lab's
      `/scene/<name>` URLs for scenes);
    - name what the machine cannot show and ask for a Safari check.
  - **Before the merge:**
    - the winner is promoted, and the generic pieces are in `ui/` with
      their catalogue rows;
    - `demo clean` and `lab clean` have run, and `git status` shows
      nothing of the round;
    - the verify block and a short proof pass;
    - the owner has looked on the dev server.
  - **Rejected and unapproved candidates are deleted, never archived or
    kept "for later".**
- **`docs/lab.md`:**
  - new:
    - a chart with text needs a phone drawing, shipped as a `<picture>`
      with a `not all and (min-width: 768px)` `<source>` (a landscape
      chart shrunk to a phone leaves 5 px labels);
    - the SVG natural-size and font rules from gotchas, linked;
    - hand over each scene's own `/scene/<name>` URL, not the index;
  - keep the grounds in a file the route imports, since `lab clean`
    deletes the route (check `:83-89`; add if missing).

**Practice: the owner's standing rules, into the agent files**

| Rule | Where it goes |
|---|---|
| Rejected designs are deleted, never archived | `design-options` skill, the design rule (both trees), `docs/design.md` |
| A machine's address never goes into the repo; it is found at runtime, per developer | template `AGENTS.md` (one line with the `urls` pointer from job 4), `docs/dev-server.md` |
| Proofs as short as possible: the site's widths, the pages a change touches, one page per template only when the change is site-wide, `--states`/`--motion` only when hover or animation changed, never a scheme the site doesn't have | `design-proof` skill, template `AGENTS.md` § Parity harness (job 5 makes it the default) |
| The site is designed, looked at and measured at its widths (four for a new site: 390, 768, 1440, 1920) | template `AGENTS.md`, the styling rule (job 5 writes them into the profile) |
| Motion plays once, when it first enters the viewport; never on hover or a second scroll; loops only on screen | the styling rule and STANDARD §7 for forks (job 8, with the layer) |
| The library first: never a one-off component on a page | the components rule (job 10) |
| A co-worker sets the project up from a fresh clone with Claude Code or Codex | `docs/setup.md` now; the `setup` skill (job 4) |
| Already in the kit (link, don't copy): plan first; the round on a demo route; one instance means the class; the owner's look before a merge; no AI attribution | — |

**Stays with the site:** its brand and design directions, its clone URL,
its chosen host, and its own overrides of the kit.

**Done when:** a new site's `AGENTS.md` points at `setup`, `dev-server`,
`browsers`, `gotchas` and `primitives`, and an agent with only the kit can
answer "how do I show the owner a candidate on their phone and check it in
Safari?". Tests: `tools/agent-files.test.mjs` (the skill shape), hygiene,
`pnpm docs:rules`.

### 3 — `init` that works the first time

- **The workspace is merged, not kept.** `scripts/lib/init.mjs:110` writes
  `pnpm-workspace.yaml` through `put()` (`:44-53`), so an existing file
  survives without the kit's `allowBuilds` (`:91-96`). Instead:
  - parse it with `yaml`'s `parseDocument` (already a dependency; keeps
    comments) and add the missing `allowBuilds` keys, leaving the site's own
    values alone;
  - cover a legacy `onlyBuiltDependencies` list too;
  - write only on a change and report "merged";
  - `--force` merges as well.
- **`pnpm init`'s placeholders are replaced.** The merge at `:80` lets every
  existing key win, scripts included. After it:
  - restore the kit's `test` when the existing one is
    `echo "Error: no test specified" && exit 1`, and report it. A real
    custom `test` is still kept (`init.test.mjs:58` stands);
  - `main: "index.js"`, `license: "ISC"`, `version: "1.0.0"`,
    `devEngines` and a newer `packageManager`. **Decided:** drop `main`,
    keep the rest.
- **One install line.** `docs/init.md` drops `pnpm init` and the
  hand-written workspace. **Decided:** (a)
  `pnpm dlx --allow-build=agentic-cms agentic-cms@github:HKamkar/agentic-cms#v0.8.0 init my-site`
  if it works with a git spec, which the job proves in pack-smoke before
  anything else; else (b)
  `mkdir`, `pnpm add …`, `pnpm exec agentic-cms init .`. With (b), init no
  longer breaks on what `pnpm add` wrote.
- **CI for the site.** Add `templates/site/verify.yml` →
  `.github/workflows/verify.yml` (a `TEMPLATES` entry at `init.mjs:23`; kept
  if present). On pull requests and pushes to `develop`/`main` it runs:
  1. checkout;
  2. `pnpm/action-setup`, because Node 25+ has no corepack;
  3. `setup-node` with `node-version-file: .nvmrc` and the pnpm cache;
  4. `pnpm install --frozen-lockfile`;
  5. `pnpm lint`, `pnpm test` and `pnpm build`;
  6. `pnpm exec agentic-cms init . --agent-files --check` (`docs/init.md:78`
     already calls this the CI check).
- **The next-steps line** (`scripts/init.mjs:40`) becomes
  `bash scripts/setup.sh`, then `pnpm kit serve`, then the files to edit.
  The dev script stays `next dev -p 8000`.
- **Tests:**
  - `init.test.mjs`:
    - a workspace written from the old docs snippet comes out with all
      three keys, the site's keys and comments, and stays unchanged on a
      second run;
    - a `pnpm init`-shaped `package.json` gets the kit's `test`;
    - the workflow is written once, then kept;
  - `tools/pack-smoke.mjs`:
    - write what the old docs produced (`:41-42`: the placeholder and the
      snippet without `unrs-resolver`), which today masks both bugs;
    - after the build, run `pnpm lint` and `pnpm test`.

### 4 — `setup` and `urls`

- **The bootstrap.** `agentic-cms setup` lives in `node_modules`, so it
  cannot install Node, pnpm or the dependencies. `init` copies
  `templates/site/setup.sh` → `scripts/setup.sh` (kept if present). It:
  1. checks Node ≥ 22.18;
  2. gets pnpm at `packageManager`: `corepack enable pnpm`, else
     `npm install -g pnpm@<version>`;
  3. runs `pnpm install --frozen-lockfile`;
  4. runs `exec pnpm exec agentic-cms setup "$@"`.

  No package script named `setup`: `pnpm setup` is a pnpm built-in.
- **`agentic-cms setup`** (group `site`, not `site: true`):
  - **Browsers:** `playwright-core install chromium webkit`. If WebKit does
    not launch on Linux, print the `install-deps` line; `--deps` runs it
    (it asks for sudo).
  - **`.env.local`** from `.env.example` when absent, then the origins
    (`urls --write`).
  - **Verify:** `pnpm lint` and `pnpm test`; `--build` adds `pnpm build`.
  - **Then** print the URLs.
  - **Flags:**
    - `--check` reports and writes nothing (the 0.4.0 roadmap's `doctor`:
      Node, pnpm, browsers, origins, a stale server on the dev port);
    - `--build`, `--no-browsers`, `--engines chromium,webkit`, `--deps`,
      `--json`.
  - **Exit codes:** 0 ready, 1 a verify step failed or `--check` found a
    gap, 2 environment or usage.
  - Idempotent: a re-run takes seconds.
- **`scripts/lib/browser.mjs`:** `webkitPath()` (`/^webkit-\d+$/` in
  `CACHE_DIRS`, else `playwright.webkit.executablePath()`) and
  `launch({ engine })`. The "no Chromium build found" message (`:71-72`)
  names `bash scripts/setup.sh`.
- **`agentic-cms urls`** and `scripts/lib/hosts.mjs`, shared with the lab
  server:
  - `lanAddresses(interfaces)` skips
    `^(lo|docker|br-|veth|virbr|utun|awdl|llw)`. Today `lab-server.mjs:21-23`
    lists docker bridges too.
  - `publicAddress({ fetch })` tries api.ipify.org, then ifconfig.me, with a
    4 s timeout; `--no-public` skips it for offline use.
  - `isUp(port)`.
  - `readOrigins` and `writeOrigins` are pure and idempotent, write
    hostnames only, and keep the file's other lines.
  - **Output:** the dev and lab URLs (localhost, LAN, public), whether each
    server is up, and which origins are covered or missing. `--write` adds
    the missing ones and says to restart the dev server.
  - **Port:** from the site's `scripts.dev` (`-p N`), else `--port`.
  - **Exit codes:** 1 when an address is missing and `--write` was not
    given.
  - `init` adds `"urls": "agentic-cms urls"`.
- **The `setup` skill** in `.claude/skills/setup`, synced to `.agents/`, so
  "set up this project" works in Claude Code and Codex. It follows
  `docs/setup.md`. Its `## Stop for the user`: sudo for WebKit's libraries,
  and the firewall.
- **Docs:** the manual steps written in job 2 (`docs/setup.md`,
  `docs/dev-server.md`, `docs/browsers.md`) become the commands. Also
  update the `README.md` Commands block, `scripts/README.md`, and the
  template `AGENTS.md` pointer.
- **Tests:**
  - `hosts.test.mjs`: an interfaces fixture, a fetch stub, the `.env`
    merge;
  - `setup.test.mjs`, with exec and fs injected: the step plan, a re-run,
    and `--check` writing nothing;
  - bin cases.

### 5 — The site profile: short proofs by default

- **Where:** `src/config/harness.ts`. Every capture already reads it, from
  the tree, for both sides of a proof (`scripts/lib/storage-seed.mjs:62-70`).
  It gains:
  ```ts
  export const harness = {
    storage: { … },
    widths: [390, 768, 1440, 1920],
    schemes: ["light"],          // or ["light", "dark"]
    proof: { pages: ["/"], ref: "develop" },
  };
  ```
  `validateSiteSeed` (`:55-58`, which rejects every key but the storages
  today) is widened: integer widths, schemes within light/dark, pages
  starting with `/`. **Decided:** these keys go inside `harness` (one file,
  one loader).
- **Precedence:** a flag wins, then the profile, then the built-in default.
  `args.mjs:75` fills every spec default, so a flag with a default can
  never yield to a profile.
  - Remove `default` from `scheme` (capture `specs.mjs:100`, proof `:143`;
    shot, probe, sheet and lab at `:182`, `:210`, `:235`, `:330`, `:367`,
    `:437`) and from proof's `ref` (`:138`).
  - The code already falls back (`visual-parity.mjs:49`, `:350`).
  - The help text names the fallback.
- **`proof --widths`.** The flag is unknown today. The plan forwards it to
  the static pass only, as it does `--sample` (`proof.mjs:34`); `--motion`
  keeps `MOTION_WIDTHS` and `--states` keeps 1440.
- **Menu shots:** taken at the profile's widths that are below the menu
  breakpoint, instead of the fixed `MENU_WIDTHS` 767/390
  (`visual-parity.mjs:45`). That is 390 and 768 for four widths.
- **Pages:** `--pages` defaults to the profile's. One page per template is
  `--sample 1`; don't reuse `--all`, which means all three passes.
- **Two schemes** in the profile run one pass each (label suffix `-dark`).
- **The kit's own profile.** **Decided:** 390/768/1440/1920 in place of
  eight widths, one width in each band of the example's 768 and 992 steps
  (CHANGELOG: **recapture baselines**). The job first proves that nothing
  moved at the old eight widths, passing them as `--widths` on both sides.
- **`init --light-only`** writes `schemes: ["light"]` and a light-only
  example. Each place is listed with its line (`init.mjs` report, 2026-10-15):
  - **`layout.tsx`:** without `THEME_SCRIPT` (`:11-14`, `:33`) or
    `suppressHydrationWarning` (`:31`), and `colorScheme: "light"` at
    `:27`;
  - **`base.css:8-14`:** `:root { color-scheme: light; }`;
  - **`globals.css:49-52`:** single values;
  - **`ThemeToggle`:** no `ThemeToggle.tsx`, and none in `Navbar.tsx`
    (`:8`, `:63`, `:71`);
  - **STANDARD and the catalogue:** their dark lines;
  - **the lab** (`lab-page.mjs:96-100`, `lab.mjs:86`): one ground per
    profile scheme;
  - **the skills** (`design:32`, `design-proof:33-34`, `design-options:13`,
    `design-graphics:3,10,42,134`): "each scheme the profile names"
    instead of "both themes".
- **Tests:**
  - `proof.test.mjs`: widths on the static pass only, and the precedence;
  - the seed still reads with the new keys;
  - `init.test.mjs`: a light-only scaffold (no toggle, no theme script);
  - pack-smoke builds it.

### 6 — `serve`; a demo or lab that hands itself over

- **`agentic-cms serve`** (**Decided:** `serve`, not `review`; not
  `preview`, which is OpenNext's Cloudflare preview (`package.json:113`),
  and not `dev`, which is `pnpm dev`):
  - start or reuse `next dev` on the site's port, generalising the test
    helper `scripts/browser/dev-server.mjs` (all interfaces, wait for
    "Ready in", stop the process group);
  - check the origins first; `--write-origins` adds them;
  - start the lab server in-process when `.parity/lab` has scenes, or
    with `--lab`;
  - wait until every `*-demo` route and `/lab-demo` answers;
  - print one table: localhost, LAN and public × the routes, plus the lab
    index and each `/scene/<name>`. Add the firewall note: the viewer's IP
    only;
  - watch the dev log for `Can't resolve '@vercel/turbopack-next/internal/`;
    `--fix-cache` clears `.next/dev .next/cache/turbopack` and restarts;
  - Ctrl-C stops both servers.
- **`demo new` waits for its route.** Today it exits after writing and
  prints a bare path (`scripts/demo.mjs:31-33`, `lib/demo.mjs:188`).
  - When a dev server answers on the port, poll `GET /<name>-demo` until it
    stops returning 404; that request also warms the compile.
  - A 5xx prints the error's tail and exits 1.
  - Then print the URLs and warn about each host missing from the origins.
  - With no server, it prints `pnpm kit serve`.
  - Flags: `--no-wait`, `--timeout`, `--url`. `--json` adds `urls`, `ready`
    and `status`.
- **`demo new <name> --showcase [--component <file>]…`:** a review page that
  is not a section's candidates, such as a library's primitives or a motion
  layer. Written by hand today, such a page is kept by `demo clean`,
  because `isKitDemo` is false.
  - `writeDemo` (`:163`) and `routeSource` (`:96`) get a third branch.
  - The manifest is `{ kind: "showcase", component: null, … }`.
  - `demo clean` removes it and the files only it imports; `roundPlan`
    already works from the manifest.
- **`--timeline`** on candidates and showcases wraps each block in
  `<LabTimeline label><div data-lab-drive>`. Today that is a hand edit
  (`docs/design.md:73-77`, `design-options` step 4, `docs/lab.md:185-203`).
- **`lab route`** waits and prints the same way, and **`lab serve`** prints
  each `/scene/<name>` URL, which `design-graphics:105-107` asks for.
- **Docs and skills:**
  - `docs/design.md` § The round, `design-options` step 4,
    `design-graphics`, `docs/lab.md`, `docs/skills.md:26,29`,
    `design/SKILL.md:93`: "hand over the URLs it printed";
  - `docs/design.md`: a firewall note.
- **Tests:**
  - the showcase manifest and its clean;
  - the wait loop against a fetch stub;
  - the serve plan;
  - a browser test: `demo new` against a running dev server, whose route
    answers 200 before the command exits.

### 7 — The lab timeline drives play-once motion

- **The problem** (confirmed in the code):
  - **Finished animations drop out.** `parts()` re-queries
    `root.getAnimations({ subtree: true })` on every action
    (`src/lib/lab/timeline.ts:77-89`). A finished CSS animation whose fill
    is `none` or `backwards` is no longer relevant and drops out, so the
    slider moves over a frozen end pose.
  - **Late animations are never measured.** `measure()` runs only at mount
    (`:199`) and on an iframe's load (`:192-197`). An animation that starts
    when an observer sets an attribute after mount is not in the span, and
    a span of 0 disables every control (`:148`).
  - **The unit stub hides both.** It returns a fixed list
    (`timeline.test.ts:52`).
- **The fix:**
  - **Keep a `seen` set.** Drop an animation when it is idle or its target
    has left the root.
  - **Pin the fill.** On first sight of a driven animation, call
    `effect.updateTiming({ fill: "both" })`. This happens under the
    timeline only: shipped pages keep `backwards`, for the reason at
    `src/styles/motion.css:43-48`.
  - **Rediscover new animations.** A `MutationObserver` (attributes,
    childList, subtree) and `animationstart` on the root, batched to one
    frame:
    - find new animations and put them on the timeline's time;
    - re-measure when no duration was given (the span never shrinks);
    - enable the controls and autoplay, as the iframe path does;
    - disconnect in `destroy()`.
  - **`lab render` too:** the same in `src/lib/lab/api.ts`.
  - **`InlineAnimation`** hands its clock to the timeline under
    `[data-lab-timeline]`.
- **The contract** goes in `docs/lab.md` § Inspecting motion: motion under
  `[data-lab-timeline]` plays at once (`el.closest("[data-lab-timeline]")`
  in a ref callback, which runs before the timeline's). Optionally add
  `data-lab-arm="<attr>"`.
- **Tests:**
  - **Unit:** a stub that drops a finished non-forwards animation and adds
    one after mount (with `getTiming`/`updateTiming`).
  - **Browser** (`timeline.test.mjs` already launches WebKit): a
    `backwards` play-once animation gated by an observer-set attribute
    under `data-lab-drive`.
    - The slider is enabled, a scrub moves it, and Replay restarts it.
    - The span is the same in both engines (3.4 s against 5 s has been
      measured without the fix).
  - **CI:** the `browser` job installs WebKit too
    (`playwright-core install --with-deps chromium webkit` in
    `.github/workflows/verify.yml`). Today it installs Chromium alone, so
    the WebKit cases skip there.

### 8 — A play-once motion layer in `agentic-cms/ix`

- **Why:** `Fx` replays each time an element re-enters (`useReveal`
  re-arms after it leaves), but the owner's standard is play once, which
  today a site writes as a layer of its own.
- **What the package gets** (`src/lib/ix/`, re-exported from `index.ts`):
  - **`part(kind, delayMs, { dim, style })`:** returns
    `{ "data-part", style: { "--d" } }`. The `PartKind`s are fade, rise,
    scale, pop, draw, grow, dim, flow, pulse and breathe. Also
    `staggerDelay`.
  - **`useMotionRoot`:**
    - one shared IntersectionObserver plays a root once (rootMargin
      `0px 0px -12% 0px`, then unobserves); another toggles
      `data-visible`, so loops run only on screen;
    - `--len` for draws;
    - it plays at once under `[data-lab-timeline]`.
  - **The components:** `Reveal` (`effect`, `delay`, `intro`, `as`),
    `RevealGroup` (`effect`, `delay`, `step`, `as`), `Sequence` (`as`,
    `settle` → `data-settle`).
  - **`motionScript()`:** returns the inline arming script's text, which
    sets `data-motion="on"` unless the reader prefers reduced motion (the
    precedent is `consentDefaultScript`).
  - Timings and curves come from the site's custom properties
    (`--ease-enter/move/pop`, `--motion-fast/base/slow`, `--motion-travel`,
    `--motion-stagger`), never constants in the package.
  - `.ts` with `createElement` wherever a test loads it.
- **Where the CSS lives** (the keyframes and the armed start states, played
  with fill `backwards`, loops under `[data-play][data-visible]`, the
  reduced-motion guard). **Decided:** (a) for 0.8.0; (b) moves to Later.
  - **(a)** In the example's `src/styles/motion.css`, unused by the
    wireframe and copied by `init`, with an upgrading step that says "copy
    the block". This fits today's rule (`docs/upgrading.md:72`: "the
    keyframes are the site's file").
  - **(b)** Shipped as `agentic-cms/ix/motion.css` (the 0.4.0 roadmap's
    `reveals.css`). This would need:
    - the rule reworded, so the presets' start states and keyframes ship
      with the package and a site's overrides load after them;
    - a `files` entry and an exports path, because tsc emits no CSS.
- **The tokens:** as plain `:root` custom properties in `motion.css`,
  not in `@theme`, so that no `ease-*` utility comes back (the wireframe
  resets them, `globals.css:77-81`).
- **The harness:** `revealed()` (`scripts/lib/browser.mjs:218-219`) and
  probe's pending reveals (`scripts/probe.mjs:50`) wait only on `ix-init--`
  classes.
  - Teach them the layer's markers: an armed `[data-part]` whose root has
    no `data-play` yet.
  - Or prove that the static capture leaves nothing armed.
  - The `--motion` pass must see played parts.
- **`Fx`, `OnView` and `useReveal` stay.** The docs say which to choose:
  `Reveal` to play once, `Fx` when a replay on re-entry is wanted.
- **The template styling rule names both libraries.** A site on `Fx` that
  never edited its styling rule receives the new text from
  `init --agent-files`, so the rule must stay true for it. The migration
  guide's motion step is opt-in.
- **The wireframe uses none of it** (STANDARD §7 stands). STANDARD §7 and
  the catalogue document the layer for a fork. The template's styling rule
  gets the motion bullet:
  - play once, when it first enters the viewport, never on hover or a
    second scroll;
  - loops only on screen;
  - nothing hidden unless armed;
  - `intro` on the first screen;
  - the tokens for curves and durations;
  - no transition or animation class in a section;
  - no transform utility on an element a part moves;
  - `settle` on a sequence over 2 s.
- **Tests:**
  - **Unit:** `parts.test.ts`.
  - **Browser:**
    - a root plays once: scrolling away and back does not replay it, and
      neither does hover;
    - a loop stops off screen;
    - under a timeline it plays at once;
    - with reduced motion nothing is hidden.
  - **Pack-smoke:** the exports exist.

### 9 — Tokens by role, `variants()`, day-one primitives in the example

- **`variants()` and `VariantProps`:** pure `.ts`, no React, so it loads
  under node:test. An unknown option throws and names the options.
  **Decided:** it goes beside `cx` in `agentic-cms/cx` (no new export),
  with its unit tests.
- **Tokens by role at wireframe values** (pixel-identical):
  - `--color-panel: var(--color-paper)`, `--color-line: var(--color-ink)`,
    `--color-on-ink: var(--color-paper)`;
  - `--text-hN--letter-spacing: normal` and `--tracking-label`;
  - `--radius-panel/control: 0` and `--shadow-panel/glow: 0 0 #0000`.

  Components use roles, never hues. **The rule changes**, in each place it
  appears: `AGENTS.md:99-105`, the styling rule (both trees), STANDARD §1
  (`:53-65`, `:107-110`), the §6 table (`:280-289`),
  `src/components/README.md:16-18`, and the `globals.css` comments. The
  proposed wording:

  > Four colour values — `paper`, `ink`, `fill`, `muted` — and role tokens
  > that alias them (`panel`, `line`, `on-ink`); a component uses the role,
  > never a value, and a new value is a token first. Radius and shadow
  > exist only as role tokens (`--radius-panel`, `--radius-control`,
  > `--shadow-panel`, `--shadow-glow`) held at the wireframe's `0` / none;
  > no other radius, shadow, blur, gradient, transition or animation
  > utility exists.
- **The primitives in the example's `ui/`**, from `docs/primitives.md`'s
  day-one list, at wireframe values:
  - `Panel` (solid, dashed): the box `Section` draws today
    (`Section.tsx:14-34`) becomes a `Panel`;
  - `OutlineButton` (a choice: `<button aria-pressed>`, never a call to
    action);
  - `IconButton` (44 px, label required);
  - `Heading` (level apart from size; `entrance` through `Reveal` once job
    8 lands);
  - `MetaLine` and `metaLabel`;
  - `TextLink` (`next/link` for paths, a new tab for http(s));
  - `Media` (`EagerImage` above the fold, a lazy `<img>` otherwise);
  - `keepWords` (U+2011);
  - `Button` on `variants()`.

  The catalogue gains a row for each, and the sections "Library first" and
  "Extending a primitive".
- **Card frames.** Today the example's sections each declare
  `const card = "flex flex-col gap-2 border border-ink p-4"`. **Decided:**
  the card's frame is `ui/Panel`, and what goes inside it is each section's
  own design, from its own copy fields. That keeps "do not build
  a generic Card" (`AGENTS.md:371-373`, STANDARD `:250-252`) and lets job
  10's lint ban visual classes in sections. Reword "a section's cards are
  its own" (`design.md:12`, both trees) to "a section's card content is its
  own; the card frame is `ui/Panel`".
- **Not in the example:**
  - a shared `Card`: a site that shares one names the exception;
  - Panel looks beyond solid and dashed, which belong to a site's
    direction.
- **Later, by demand,** when a second site needs them:
  - `PageHero`, `PostalAddress`, `NavIcon`/`ContentIcon`/`BrandIcon`/
    `SocialLinks`, `FactTable`, `DataTable`;
  - the look-less `LazyBackdrop` and `PauseOffscreen`, which would go into
    `agentic-cms/components`.
- **Proof:** `visual-parity proof` in both schemes with `--states`, which
  must be identical; `parity` does not apply because the markup changes.

### 10 — The component library, enforced

- **`agentic-cms/eslint`:** an exported `.mjs`, like `./loader`, with
  `componentRules(options)`.
  - **Layers:** one-way imports, `motion ← ui ← patterns ← sections`.
    Animation libraries (`motion`, `framer-motion`, `agentic-cms/ix`) are
    allowed only in `motion/`.
  - **In sections and patterns:**
    - one component per file;
    - no raw `button`, `a`, `img`, `picture`, `video`, form fields or
      `h1`–`h6` (and no `svg` in sections), each message naming the
      primitive to use instead;
    - no `style` attribute and no arbitrary values;
    - no visual classes (`bg-`, `border`, `rounded`, `shadow`, `ring-`,
      `outline-`, `divide-`) or motion classes, checked in className
      literals, template elements and `cx()` literals.
  - **Options:** the layer folders, the forbidden elements with their
    messages, and the section folders. The example's sections live in its
    page folders, `home/` … `blog/`.
  - ESLint becomes an optional peer.
- **`agentic-cms check-components`**, the placement guard (a full command:
  spec, script, test, docs). It checks that:
  - the layers exist;
  - every export of motion, ui and patterns is catalogued in
    `src/components/README.md`. Only PascalCase names with a lowercase
    letter count, so ALL_CAPS constants pass;
  - every section file is registered in `render.tsx`;
  - `src/app` holds route files only, in the known route folders, plus
    `*-demo` and `lab-demo`;
  - there is no `.tsx` outside `src/components` and `src/app`;
  - `.module.css` files are only in ui and motion, and `@keyframes` only
    in the motion layer and `src/styles/motion.css`;
  - a round's candidates (`demo.json` `created`) pass while it runs.

  Config goes in `src/config/components.json`, with a frozen `inherited`
  list for example files a site has not replaced yet.
- **The lint script `init` writes** reports both tools:
  `eslint; s=$?; agentic-cms check-components || s=1; exit $s`.
- **The components rule:** `templates/site/rules/components.md` and the
  kit's own, brand-neutral:
  - the library first;
  - the layers;
  - what a section may contain;
  - primitives extendable by construction;
  - enforced by lint and CI;
  - loosening a rule is its own pull request, said so in its title.

  Then `pnpm docs:rules`.
- **The rule follows the guard.** `init --agent-files` writes the
  components rule only when the site has the guard's config. Today
  `agentFiles()` writes every missing file (`scripts/lib/init.mjs:116-137`),
  so it needs conditional files: on a 0.7.6 site without the config, the
  rule is neither written nor reported missing. Adopting the guard is a
  migration step, with the `inherited` list freezing every component the
  site already has.
- **The kit's example passes in CI.** Job 9's card frames (`ui/Panel`)
  are what let the visual-class ban pass in the example's sections.
- **Tests:**
  - the preset and the guard against planted violations as fixtures, each
    caught by the tool meant for it (ESLint or the guard);
  - `init` writes the lint script;
  - pack-smoke's `pnpm lint` (job 3) passes on a fresh site.

### R — Release 0.8.0

1. **The gate: the migration guide has been run on two sites on 0.7.6**,
   one for each of its paths, on a branch in each.
   - There is no tag yet, so the run pins the candidate,
     `github:HKamkar/agentic-cms#<develop sha>`; the site moves to
     `#v0.8.0` after the tag (S).
   - Each site builds and proves identical after its § 1, and its chosen
     opt-ins work.
   - Whatever the runs found is fixed in the guide or the kit, not by hand
     in a site.
   - The guide loses its "draft" banner.

   Then run `pnpm test:pack` and the verify block on `develop`.
2. Make the release commit on `develop`, "Release 0.8.0: <summary>". It:
   - renames `## [Unreleased]` to `## [0.8.0] — <date>`;
   - sets `package.json` `version` to 0.8.0, which is also init's default
     tag;
   - changes `README.md:268,283` and `docs/init.md:10` to `#v0.8.0`;
   - renames the upgrading heading to `## 0.7.6 → 0.8.0`.
3. Open a PR from `develop` to `main` and merge it as a merge commit. Never
   use `--delete-branch` on it. CI must be green: `test` and `browser`, then
   `pack` on the push.
4. Tag `v0.8.0` (annotated) on `main`'s merge commit, subject
   "agentic-cms 0.8.0: <summary>", and push it. Tags are immutable.
5. Record the release in `PLAN.md` as a new Phase.

### S — The sites on 0.7.6 follow

Each site in its own pull request, in its own repo and its own session
(the kit's sessions work on the kit alone), following
`docs/migrating-to-0.8.0.md` on the path that fits it ("Two paths,
worked"). The branch is the one the R.1 gate ran on:

1. **Upgrade:** § 1 of the guide.
2. **Adopt and delete:** the steps the site takes, each § 4 row deleted as
   its step lands.
3. **Prove and measure:** a short proof; time a fresh clone from
   `bash scripts/setup.sh` to `pnpm kit serve` against the target above;
   the owner's look.
4. **Pin the release:** after the tag, the branch moves from the candidate
   sha to `#v0.8.0`, proves again, and merges.

## After 0.8.0: toward 1.0.0

0.8.0 makes a site quick to start and safe to upgrade. 1.0.0 is the
promise that it stays that way:

- a published package;
- a public surface that changes only by semver;
- upgrades that run themselves.

The recommended order: **0.9.0 packages, 1.0.0 freezes.**

### 0.9.0 — the package

- **npm.** Publish with the built `dist/` inside. Today every site install
  fetches GitHub and compiles the kit (`prepare`), which is why the kit
  needs an `allowBuilds` entry at all; published, that entry goes (`sharp`
  and `unrs-resolver` stay).
  - Check the name on npm first, and use a scope if `agentic-cms` is taken.
  - Publish from CI on a `v*` tag, with provenance, after `test:pack`.
- **`pnpm create agentic-cms my-site`:** `create-agentic-cms`, a thin
  wrapper around `init`, so there is one source of truth. The starter stays
  in the main package until the 1 MB tarball budget says otherwise; then it
  becomes a starter package of its own.
- **`agentic-cms upgrade`**, the migration guide made executable:
  - bump the dependency;
  - run `init --agent-files`;
  - apply each version's mechanical steps as codemods (renamed imports,
    moved files, new `harness.ts` keys);
  - print the manual steps with links to the guide's sections.

  0.8 → 0.9 is its first run, on both sites.
- **The public surface, written down on one page:**
  - each export: `.`, `./content`, `./blog`, `./seo`, `./forms`,
    `./forms/server`, `./consent`, `./consent/google`, `./email`, `./ix`,
    `./components`, `./lab`, `./cx`, `./loader`, `./eslint`;
  - each command's flags, exit codes and `--json` shape;
  - the content file formats, `harness.ts` and the agent-file manifest.

  Each is marked **stable** or **experimental** (the lab, probably). A
  deprecation warns for one minor and is removed in the next major.
- **Peers and engines:** the supported ranges of Next, React, Tailwind,
  zod, motion and Node, tested in CI at both ends.

### 1.0.0 — the freeze, and what kind of CMS it is

Semver from 1.0.0 on. Before it, the owner decides what "a real CMS" means
for this project. That answer changes the roadmap more than packaging does.
A short brief per question is the first job of 0.9.0, decided before any
code.

| Question | Options | Recommendation |
|---|---|---|
| Who edits content? | (a) agents and developers, in files, through pull requests (today); (b) also people who don't use git: an editing UI over the same files; (c) a hosted content API | (a) as the core, plus a review surface for people: a preview URL per pull request, the content change in words, approve = merge. (b) only when a site's editors need it. (c) no: it gives up what makes this kit different |
| Where does it run? | self-hosted per site (today), or a hosted service | self-hosted, with a deploy guide per host |
| Starters and themes | the wireframe only, or designed starters | the wireframe in the package; designed starters as separate packages a site copies once, never a theme it inherits (the kit carries behaviour, a site carries design) |
| The content model | site-defined schemas (today), or a kit schema API | keep site schemas; add content migrations (`agentic-cms migrate`) for when a schema changes, and versioned file formats |
| Media | files under `public/`, or a media library | a `media` command (import, the sizes STANDARD asks for, alt-text checks) before any UI |
| Extensions | ad hoc (form sinks, consent providers, the editorial plugin), or a plugin API | name the extension points that exist, mark them stable, add more by demand |
| Name and home | a personal GitHub repo, or an org with a docs site | an org on GitHub and npm; the docs as a site built on the kit itself; MIT stays |

## Later (after 0.8.0)

- **From 0.4.0, still open** (1.0.0 on npm is now the section above):
  - `sheet` cells rendered from a route;
  - three.js scenes in the lab;
  - the `editorial` plugin mirrored as project skills, if wanted;
  - the hold of other origins' scripts for a `--url` site.
- **From job 8:** `agentic-cms/ix/motion.css`, its option (b).
- **The second-use primitives,** and `LazyBackdrop`/`PauseOffscreen` in the
  package, each when a second site needs it.
- **A site-side check for machine addresses** in tracked files (hygiene's
  `IP:port` rule as a site command), by demand.

## Risks and how each is held

- **Removing spec defaults (`scheme`, `ref`)** changes what a bare command
  does. Hold: with no profile the fallback is today's value, and a test
  covers it.
- **The kit's own captures change** if its widths change. Hold: a decision
  in job 5, with **recapture baselines** in the CHANGELOG.
- **The template `AGENTS.md` grows past its budget.** Hold: pointers only,
  and `init --agent-files` warns when it is too big.
- **Two motion libraries confuse a fork.** Hold: one paragraph in
  STANDARD §7 on which to choose.
- **The timeline's fill override leaks to shipped pages.** Hold: it applies
  only under `[data-lab-timeline]`, and a browser test checks that a page
  without one keeps `backwards`.
- **The one-line install depends on pnpm's build approvals.** Hold:
  pack-smoke runs exactly the documented path.
- **A site's name, a description of it or a machine address leaks into
  the kit.** Hold: `pnpm hygiene --brand <site>` every job, and every
  commit message and pull request text read for a site's pages, sections,
  components, scripts or services before it is pushed.

## Verification, every job

The kit's verify block (`AGENTS.md`), `pnpm hygiene --brand <site>`,
`pnpm test:browser` when browser-facing code changed, `pnpm test:pack` when
the package surface changed, and `visual-parity proof` of the example in
both schemes when anything under `src/` changed. The owner's word before a
merge.
