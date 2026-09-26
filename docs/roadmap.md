# Roadmap — 0.4.0: agentic-cms for agents

> Landed 2026-09-20: the six jobs below are pull requests #13–#18 into
> `develop`, released as 0.4.0. What comes after is under "Later".

The kit's main user is an AI agent designing and maintaining a site built on
it. Two days of design work on a site that installs the package showed what
such an agent lacks: it hand-rolled some forty-five Playwright and sharp
probes (section screenshots, bounding boxes, timelines, candidate sheets, a
row-by-row diff for the harness's `SIZE` dead end, build-and-capture runners,
a worktree baseline), a Python icon generator, an e-mail guard, and a design
process (candidates on a demo route, pick by row, prove with captures, "one
instance means the class", measure screenshots) that lived only in that
site's own rules. Everything in this roadmap is one of those, made a command,
a component or a skill of the kit.

**0.4.0 is the whole roadmap.** Each job below is one pull request against
`develop`, one session; the release is one pull request `develop` → `main`
when the last job has landed, tagged `v0.4.0`. No intermediate versions; the
next version after it is 1.0.0 (npm).

## Principles

- The caller is an agent: one command per recurring job; deterministic and
  idempotent; no prompts; `--json` wherever there is structure (stdout is then
  one JSON document, progress goes to stderr); exit codes 0 clean / 1 findings
  or differences / 2 usage or environment, stated in every `--help`; unknown
  flags are an error; errors name the fix.
- Numbers before pictures: a row index or a bounding box beats a screenshot the
  agent has to read. Deterministic default output paths, so a re-run overwrites.
- Nothing of any site in the kit: no brand, palette, copy, address, absolute
  path; no third-party icon data (Lucide and Simple Icons are read from
  packages the *site* installs; the licence line is written into the site's
  file). No styled component: the kit carries behaviour, a site carries design.
- Works by default, nothing to install: project-scoped skills committed in the
  repo (`.claude/skills/` for Claude Code, `.agents/skills/` for Codex — both
  auto-discovered in a checkout), commands in the package every site already
  depends on, and `agentic-cms init` copying the same files into a site that
  installs rather than forks. The `editorial` plugin stays a plugin, unchanged.

## Hygiene, every pull request

- Branch `feat/<slug>` off `develop`; a pull request against `develop`; CI
  green; merged on the owner's word. `package.json` stays at `0.3.3` on
  `develop` until the release: the bump commit (`…; 0.4.0`, the README's
  install line, the `init` default tag), a pull request `develop` → `main`,
  an annotated tag `v0.4.0` with a one-line note.
- Commit subjects in the repo's style (`<area>: <what>`); no AI attribution
  lines.
- `CHANGELOG.md` (Keep a Changelog): every pull request adds its lines under
  **Unreleased**, which the release commit renames to `0.4.0`; a line that
  needs baselines recaptured says so.
- Every pull request ships its tests (`node --test`), its docs
  (`docs/<topic>.md`, the `scripts/README.md` bullet, the README's command
  table with a link into `docs/`, `AGENTS.md`/`STANDARD.md` where a rule
  changes, the skill that calls the command once skills exist) and its
  CHANGELOG line. `pnpm test:pack` when `files`, `exports`, `bin` or `init`
  change.
- `tools/hygiene.mjs` (job 1; also a CI step): no site's name outside the
  README's "Built on" section; no machine paths, addresses or ports outside
  documented examples; no scratch files, `.parity/` or PNGs outside `docs/`
  and `public/`; `.claude/skills` ≡ `.agents/skills`; `files` covers what
  `init` copies; the CHANGELOG has the entry.
- CI `.github/workflows/verify.yml` on pull requests and pushes to `develop`
  and `main`: job `test` (Node from `.nvmrc`, `pnpm install --frozen-lockfile`,
  `pnpm lint`, `pnpm test`, `pnpm build`, `node tools/hygiene.mjs`); job
  `browser` (`pnpm dlx playwright@<pinned> install --with-deps chromium`,
  `pnpm test:browser`); job `pack` (`pnpm test:pack`) on pushes to `main`.
- A site follows the release in its own pull request (bump the tag, delete
  what moved into the kit, harness clean, the owner's look). A site that wants
  a piece earlier may pin a `develop` commit in between.

## The jobs

| # | Job | Round trips it removes |
|---|---|---|
| 1 | **Foundation**: strict flags and `--help` (`scripts/lib/args.mjs`), the browser library extracted (`scripts/lib/browser.mjs`), CHANGELOG, CI, `docs/`, the hygiene script | unknown flags silently ignored; a header comment as the only spec |
| 2 | **`shot`, `probe`, `sheet`** | every ad hoc Playwright script; a candidate sheet in one command |
| 3 | **Proof**: `compare` on different heights, `--json`, `capture --build` / `--ref <git ref>` / `--settle` and `data-settle`, `capture.json` as the DONE marker | the `SIZE` dead end, shell runners with marker files, the worktree dance, guessing a sequence's length |
| 4 | **Design by default**: the skills, `templates/site/`, `agentic-cms init` (with `--agent-files --check`), the README's "Start your own site" | the process re-derived each session; a from-scratch site without the agent files |
| 5 | **E-mail guard**: `agentic-cms/email`, `EmailLink`, `withEmailToken`, `guard-email` | a site's own token, link, form hack and build scan |
| 6 | **Icons**: `Icon`, `icons add / remove / family / audit`, the `design-icons` skill | an icon class fixed one screenshot at a time; a Python generator |
| — | **Release 0.4.0**: bump, `develop` → `main`, annotated tag | — |
| later | **1.0.0**: npm publish and `create-agentic-cms`; the items under "Later" | — |

Names below are the interface; *(decide in the PR)* marks what only the code
settles.

### 1 — foundation

- `scripts/lib/args.mjs`: `parseArgs(argv, spec)` on `node:util`'s `parseArgs`
  (`strict: true`) → `{ positionals, flags }`; `usageText(spec)`; `spec = {
  command, usage, positionals: [{ name, required }], flags: { width: { type:
  "number", default: 1440, help } … }, exit, json? }`. An unknown flag →
  `unknown flag --x; run agentic-cms <cmd> --help`, exit 2. `bin/agentic-cms.mjs`:
  the `COMMANDS` table gains a one-line description per command; `agentic-cms`
  alone or `--help` prints it; every existing command moves to the parser and
  gains `--help`.
- `scripts/lib/browser.mjs`, extracted from `visual-parity.mjs` with no
  behaviour change (proven: a capture of the example before and after, static,
  `--motion` and `--states`, `compare` clean): `requireBrowser()` (exit 2
  naming `pnpm add -D playwright-core` and a Chromium), `chromePath()`
  (`CHROME_PATH` → `chromium.executablePath()` if it exists → the newest
  `ms-playwright/chromium-*` under `~/.cache`, `~/Library/Caches` or
  `%LOCALAPPDATA%` with the platform's executable path → `null`), `launch({
  scheme, motion, width, height, scale })`, `serveStatic({ root, requireBuild
  })`, `listPages(root)`, `resolveTarget(target, { base })`, the CSS constants,
  `Stall` / `inPage` / `onceMore`, `fontsReady`, `imagesReady`, `revealed`,
  `sequencesRan`, `frames`, `settle`, `prepare(page, { motion })`,
  `findTarget(page, { select, heading, index })` (a heading regex on `h1`–`h3`
  → `closest("section, article, [data-section]")`), `collectConsole(page)`.
- `CHANGELOG.md` (0.2.0–0.3.3 reconstructed from the tags);
  `.github/workflows/verify.yml`; `tools/hygiene.mjs`; the `test:browser`
  script (`node --test scripts/browser.test.mjs`, skipped with the reason `no
  Chromium: set CHROME_PATH or pnpm dlx playwright@<ver> install chromium`);
  `docs/README.md` (the index), `docs/commands.md` (every command: flags, exit
  codes, JSON shapes — *(decide in the PR)* generated from the specs and
  checked in CI like the field tables), `docs/visual-parity.md` (the harness's
  contract out of the script's header comment: flags, defaults, file names,
  output lines, thresholds, exit codes, and the traps a long capture run meets).
  The README's command table links `docs/`; `scripts/README.md` points at
  `docs/commands.md`. The stale `scripts/parity.sh` references in `.gitignore`
  and `PLAN.md` go.
- Tests: `scripts/lib/args.test.mjs` (defaults, numbers, an unknown flag,
  `--help` carrying every flag and the JSON shape); the `scripts/browser.test.mjs`
  skeleton (`serveStatic` on a fixture tree under
  `scripts/fixtures/site/.next/server/app/index.html` — a heading, a
  `[data-ix]` element with a CSS animation, an `ix-init--fadeIn` element at
  opacity 0, a `data-settle="2600"` section — grown by jobs 2, 3 and 6).

### 2 — `shot`, `probe`, `sheet`

- `agentic-cms shot <route|url> [--url <base>] [--width 1440] [--height 900]
  [--scale 1] [--scheme light|dark] [--motion] [--wait <ms>] [--scroll
  <y|into-view>] [--select <css>] [--heading <regex>] [--index 0] [--pad 24]
  [--transparent] [--trim] [--resize <w>] [--out <file>] [--json]`. A route is
  served from `.next` by the harness's own server unless `--url` names a base
  (a dev server); a full-page shot, or the element (`--select`'s nth match, or
  the section holding the heading) clipped with `--pad`; `--transparent`
  isolates it (everything that is neither ancestor nor descendant hidden, the
  ancestors' backgrounds cleared, `omitBackground`); `--trim` and `--resize`
  through sharp; `.png` or `.webp` by extension; the default output
  `.parity/shots/<route>@<w>[--<target>].png`. JSON: `{ url, route, width,
  height, scale, scheme, motion, scrollY, target: { by, value, index, tag, id,
  box, pageBox } | null, out, image: { width, height, transparent, trimmed,
  resized }, console }`.
- `agentic-cms probe <route|url> [--url] [--width] [--height] [--scheme]
  [--motion] [--wait] [--scroll] --select <css> | --heading <regex> [--index]
  [--all] [--props <list>] [--timeline <ms> [--every 100]]`: JSON only — `{
  url, route, width, height, scheme, motion, scrollY, scrollHeight, elements:
  [{ selector, index, tag, id, classes, box, pageBox, computed: { opacity,
  transform, position, z-index, display, visibility, overflow, color,
  background-color, font-size, line-height, …--props }, stacking: [{ tag,
  classes, position, zIndex, transform, isolation, opacity, willChange,
  contain, filter, createsContext }], timeline?: [{ t, opacity, transform }]
  }], reveals: { total, pending: [{ tag, classes, pageTop, opacity }] },
  console }`. The stacking chain and the pending reveals are always included
  (one `evaluate` each); `--timeline` samples after the element enters view and
  is opt-in because it costs seconds.
- `agentic-cms sheet <spec.yaml|json> [--url] [--out .parity/sheets/<name>.png]
  [--scale 2] [--json]`: a candidate sheet for the owner to pick by row. Spec:
  `{ name, background?: "#000220" | "var(--color-paper)", rows: [{ label: "A",
  note?, size?: 40, cells: [{ label: "now", file: "public/images/x.svg" | svg:
  "<svg…>" | html: "<div…>" | img: "/images/x.svg" }] }] }`;
  `scripts/lib/sheet.mjs` (`readSheetSpec`, `sheetHtml` — rows lettered, cells
  numbered, the first row is by convention "now", the site's `globals.css`
  loaded when a build exists so tokens and fonts are real, `public/` served
  alone otherwise — `renderSheet`). `icons audit` (job 6) reuses it.
- Docs `docs/shot-probe-sheet.md` (recipes: prove a gap, is the reveal firing,
  pick an icon, regenerate a phone picture from a live drawing) and
  `docs/commands.md`. Tests: `sheet.test.mjs` (the HTML builder; a missing file
  names the fix) without a browser; `browser.test.mjs` gains `shot` (size,
  alpha with `--transparent --trim`), `probe` (box, computed, stacking, pending
  reveals, console) and `sheet`.

### 3 — proof

- `scripts/lib/compare-images.mjs` (pure, no browser): `compareSameSize(a, b,
  { tolerance: 24 })` → `{ changed, pct, bands, diff }`; `rowDiff(a, b)` for
  different heights: `same(i, j)` is `Buffer.compare` of the two row strides,
  falling back to the tolerant pixel loop only on a miss; `head` = the first
  differing row from the top; `tail` = the matching rows from the bottom
  (bounded so it never overlaps the head); `delta = hB − hA`; `band = {
  before: [head, hA − tail], after: [head, hB − tail] }`; `bandsTop` /
  `bandsBottom` = the differing rows in the top- and bottom-aligned overlaps,
  merged when ≤ 2 rows apart, capped at 20; the verdict `shift` (tail > 0:
  everything below the band survived, only the changed section moved),
  `reflow` (tail = 0: nothing below realigns — an antialiasing or stacking
  flip, or a chrome change), `insert` / `remove` (head + tail = the smaller
  height), `width` (the widths differ: no row analysis). Crops of the band
  ± 40 rows from both sides go to the diff dir. Printed: `SIZE     name
  1440x5200 -> 1440x5240 (+40)  same to row 2017, tail 3140 rows, band
  2017-2060 -> 2017-2100: shift`. Same-size `CHANGED` lines gain their bands.
- `compare --json` → `.parity/visual/<b>-vs-<a>/report.json` and stdout: `{
  before, after, scheme, threshold, thresholdMid, pages, summary: { ok,
  changed, size, missing, exit }, files: [{ name, status:
  "ok|CHANGED|SIZE|MISSING", width, height, changedPixels, changedPct,
  midFlight, bands?, diff?, before?, after?, delta?, head?, tail?, band?,
  verdict?, bandsTop?, bandsBottom?, crops?, onlyBefore?, onlyAfter?, in? }] }`.
  `compare` prints the baseline's `ref` and `sha` when `meta.json` has them.
- `capture --build` (runs the site's `pnpm build` first, log
  `.parity/<label>.build.log`, its last 20 lines on failure); `capture --ref
  <git ref>` (`scripts/lib/ref-build.mjs`: `git fetch origin`, `rev-parse`, a
  worktree in a **sibling** directory `../<site>-ref-<sha12>/` — never inside
  the site, whose `tsconfig` would include it — `pnpm install
  --frozen-lockfile --prefer-offline`, `pnpm build`, served by the harness's
  own server, removed afterwards unless `--keep`; a cache of one: a sibling
  with the same sha is reused, older `-ref-*` siblings removed, printed first;
  `git log -1 --format='%h %ci %s'` printed before capturing; `meta.json`
  gains `{ ref, sha }`). `--url`, `--build` and `--ref` are mutually exclusive
  sources. `capture --json` → `{ label, dir, pages, widths, files, seconds,
  meta }`; `capture.json` is written **last** into the capture dir — its
  presence is the DONE marker (the dir is wiped at the start, so a stale marker
  cannot exist).
- `--settle <ms>` (default 2000; exit 2 without `--motion`) and the element
  attribute `data-settle="<ms>"`: at each motion step the settled frame waits
  `max(--settle, every data-settle in the viewport)`; the frames become
  `--s<ii>-150.png`, `-500.png`, `-settled.png` (a constant name; the
  CHANGELOG says to recapture motion baselines); `<page>.settle.json` `[{
  step, y, waited, declared: [{ tag, top, settle }] }]` compared like the
  animations inventory; `meta.json` gains `settle` and `frames`. `STANDARD.md`
  §7: how a section declares a sequence longer than 2 s.
- Docs: `docs/visual-parity.md` gains "Reading a report", "Baselines
  (`--ref`)", "Settle". Tests: `compare-images.test.mjs` on sharp-made fixtures
  (identical; one band changed; 40 rows inserted → `shift`; rows appended →
  `insert`; every row → `reflow`; a width change → `width`; a +10 tint is
  `same`); `ref-build.test.mjs` with an injected `exec`; `browser.test.mjs`
  gains `capture --motion` on the fixture (`-settled.png`, `settle.json` with
  `waited: 2600`).

### 4 — design by default: the skills, `templates/site/`, `init`

- The skills, in `.claude/skills/<name>/SKILL.md` and
  `.agents/skills/<name>/SKILL.md` (byte-identical copies — symlinks are
  dropped by npm-packlist and break on Windows; `pnpm skills:sync` copies
  `.claude` → `.agents`, `tools/agent-files.test.mjs` asserts equality, that
  the frontmatter `name` is the directory, and that no site's name appears).
  The shape of the editorial skills (frontmatter `name`, `description`,
  `argument-hint`; Read first / Steps / Verify / Stop for the user):
  - `design` — from the wireframe to a design: tokens first (`@theme static`,
    both themes, fonts; radius, shadow and motion re-enabled *as tokens*), then
    the chrome, then the sections; per element the loop candidates → the
    owner's pick → build → prove; every deliberate oddity into `STANDARD.md`
    §8; a design change is its own commit.
  - `design-options` — live candidates on a throwaway route
    `src/app/<name>-demo/page.tsx` (a 15-line snippet: labelled rows, the
    current version last, `robots: noindex`; removed before the merge — the
    SEO audit fails it, on purpose); static candidates through `agentic-cms
    sheet`; one preview round, one build; the owner's look on the served site
    before a merge, and a sheet pick is not that look.
  - `design-proof` — baseline (`capture --ref`), change, capture, `compare
    --json`; reading `verdict` and `bands`; a mid-flight frame is re-run once,
    settled and static frames never jitter; `data-settle`; what a `reflow`
    usually is (a stacking context flipping the antialiasing below it).
  - `design-measure` — a screenshot claim ("unaligned", "too early", "broken")
    is resolved with `probe` (boxes, computed styles, stacking, pending
    reveals, a timeline) and `shot` before any edit; one instance means the
    class: inventory first.
  - `design-icons` arrives with job 6.
- `templates/site/`: `AGENTS.md` (a site's rules: process, styling invariants,
  the harness, git; the engine is the package, its contracts under
  `node_modules/agentic-cms/src/lib/*/README.md` and `docs/`), `CLAUDE.md`
  (`@AGENTS.md`), `.claude/settings.json` (the GitHub marketplace for
  `editorial`, `Bash(pnpm content:*)`), `next.config.ts` (plain:
  `images.unoptimized`, `allowedDevOrigins`; Cloudflare/OpenNext as a
  documented add-on), `gitignore`, `README.md`, `STANDARD.md` (the wireframe's
  values with "replace" markers and an empty §8 register), a `PLAN.md` stub.
  The kit's own `.claude/rules/*.md` are copied through `rewriteKitPaths`
  (`src/lib/<x>/README.md` → `node_modules/agentic-cms/…`, `src/lib/**` globs
  dropped), plus a new `design.md` rule for `src/**/*.tsx`.
- `agentic-cms init [dir] [--force] [--json]` (`scripts/lib/init.mjs`:
  `scaffold`, `rewriteKitPaths`, `agentFiles`, the manifest): copies from the
  package root the set `tools/pack-smoke.mjs` already uses (`content public
  src/app src/components src/config src/styles src/kit.ts postcss.config.mjs
  eslint.config.mjs .env.example STANDARD.md .nvmrc .claude/rules
  .claude/skills .agents/skills`) and `templates/site/*`; writes or merges
  `package.json` (the name from the directory, `private`, `type: module`,
  `engines`, the scripts `dev build start lint test content:* kit`,
  `agentic-cms` at the kit's own tag, the peers at the kit's devDependency
  versions, `playwright-core` dev), `tsconfig.json` (`@/*` only),
  `pnpm-workspace.yaml` (`allowBuilds` with the git URL key, `sharp`),
  `.gitignore`; never overwrites without `--force`; prints `created | updated
  | kept` per file and the next commands. `--agent-files [--check]`: only the
  skills, the rules, `AGENTS.md` (when absent) and the `STANDARD.md` template;
  a manifest `.agentic-cms.json` `{ version, files: { path: "sha256:…" } }`;
  `--check` reports `ok | modified (the site edited it) | stale (the kit has a
  newer one) | missing`, exit 1 on anything but `ok` — an agent never clobbers
  a deliberate edit. `files` in `package.json` gains that set plus `templates`
  (about 250 KB gzipped; pack-smoke asserts under 1 MB and the presence of
  `templates/`, `content/`, `.claude/skills/`); `tools/pack-smoke.mjs`
  becomes: tarball → `pnpm exec agentic-cms init .` → install → build → `init
  --agent-files --check`.
- Docs: the README's "Start your own site" rewritten around `init` (fork or
  install, then the same files); `docs/design.md` (the loop and how the skills
  chain), `docs/skills.md` (each skill, how Claude Code and Codex find them,
  `--agent-files` to update), `docs/init.md`. The kit's `AGENTS.md`: design
  work starts with the `design` skill. Tests: `init.test.mjs` into a tmp dir
  (the file set, the merge, no `src/lib/` left in copied docs, the manifest,
  `kept` on a re-run, `modified` after tampering); `agent-files.test.mjs`.

### 5 — the e-mail guard

- `src/lib/email.ts` → the export `./email`: `encodeEmail`, `decodeEmail`,
  `isEmailToken` (a token never contains `@`), `readableEmail` (`hi [at]
  example [dot] com`); no React. Not secrecy: no plain text for an
  HTML-reading harvester.
- `src/lib/components/EmailLink.tsx` (`"use client"`; a `useSyncExternalStore`
  hydration gate: the readable form in a `<span>` before hydration, `<a
  href="mailto:">` after; `token`, `className`, `children`) from `./components`.
- Forms: `withEmailToken(definition)` in `src/lib/forms/email-token.ts` (a
  mailto `to` encoded; other kinds untouched); `backends/mailto.ts` resolves
  `isEmailToken(to) ? decodeEmail(to) : to` — no config flag, no decode step
  in a site's form component.
- `agentic-cms guard-email [--domain <host>]… [--json]`: scans
  `.next/server/app` and `.next/static` (`html rsc body txt js json xml`,
  `.segment.rsc`) for `[A-Za-z0-9._%+-]+@<domain>` (every dot escaped; `www.`
  stripped from the default, which is `site.url`'s host read through
  `src/kit.ts`); exit 1 listing files and addresses. Documented as the
  optional last build step. The example keeps `hello@acme.example` visible on
  purpose (a wireframe shows its address); the docs say how a site opts in:
  the address in a `contact.ts` outside `site`, `EmailLink` everywhere it
  renders, `withEmailToken` on the form, `guard-email` in `build`, and
  `SiteConfig.email` left out so the structured data carries none.
- Docs `docs/email.md`; the recipe in `src/lib/forms/README.md`;
  `.claude/rules/form-engine.md`. Tests: `email.test.ts`,
  `forms/email-token.test.ts`, `guard-email.test.mjs` on a fixture `.next`
  tree (hits; a token passes; other domains ignored).

### 6 — icons

- `src/lib/components/Icon.tsx` (server-safe): `{ d: string | string[]; kind:
  "stroke" | "fill"; size?; strokeWidth?; className?; title? }`, `viewBox 0 0
  24 24`, `currentColor`, `aria-hidden` unless `title`.
- `agentic-cms icons add <id…>` / `icons remove <id…>` (`--manifest
  src/config/icons.json`): ids `lucide:<name>` / `si:<slug>`; the manifest is
  the truth and `src/config/icons.ts` is regenerated deterministically
  (`export const ICONS = { "lucide:house": { kind: "stroke", d: [...] } } as
  const satisfies Record<string, IconData>`, the Lucide ISC notice verbatim and
  the Simple Icons CC0 line in the header); the SVGs are read from
  `lucide-static` / `simple-icons` resolved from the *site*
  (`scripts/lib/icons-source.mjs`: `readLucide`, `readSimpleIcon`, `toPathD`
  for rect / circle / ellipse / line / polyline / polygon); a missing package
  errors with `pnpm add -D lucide-static simple-icons`; `add` of an existing
  id is a no-op, so it doubles as "regenerate".
- `agentic-cms icons family <spec.yaml> [--check]`
  (`scripts/lib/icons-family.mjs`): a family of marks from primitives — `tile
  glass grey disc glassDisc ring glassRing stroke poly` on a 64 grid; the
  `palette` (named gradients), the `files` (`{ out, size, ring? }`) and the
  compositions (`[["tile", 6, 15, 52, 36, 6], ["poly", "6,19 58,19 32,41",
  "grey"]]`) as data; every file carries a "generated by agentic-cms icons
  family from <spec>; do not hand-edit" header; `--check` fails when the files
  on disk drift.
- `agentic-cms icons audit [--url] [--pages] [--out .parity/icons/audit.png]
  [--json]`: every `<img>` up to 96 px and inline `<svg>` on the built pages
  with its rendered size, colour, section, nearest heading and the copy beside
  it, grouped by file — the "one instance means the class" inventory — as a
  sheet and as JSON `{ pages, count, sheet, icons: [{ page, kind, src, width,
  height, renderedWidth, renderedHeight, color, alt, section, heading, copy,
  selector }], files: { src: { uses, pages, bytes } } }`.
- The skill `design-icons` (both trees): audit the class, pick a family (the
  three families: marks beside copy from a generator, line icons from Lucide,
  other companies' marks from Simple Icons — text for `STANDARD.md` §4),
  `add` / `family`, prove. Docs `docs/icons.md`. Tests:
  `icons-family.test.mjs` (a fixture spec → exact SVGs, plain and ringed;
  idempotent; `--check`), `icons-source.test.mjs` (`toPathD`; a fake
  `node_modules/lucide-static` and `simple-icons` in a tmp dir; the map's
  header), the audit's extractor on the fixture page in `browser.test.mjs`.

## Later (after 0.4.0)

- 1.0.0: npm publish (`agentic-cms`; `create-agentic-cms` as a thin wrapper
  around `init`); the README's install line becomes `pnpm create agentic-cms`.
- By demand: `agentic-cms doctor` (Chromium, Node, pnpm, `ALLOWED_DEV_ORIGINS`,
  a stale server on the dev port); `agentic-cms/styles/reveals.css` (the Fx
  preset start states, importable); `sheet` cells rendered from a route
  (`route: "/#footer"`); the `editorial` plugin mirrored as project skills if
  wanted. Consent mode and a form backend stay a site's.
- After the lab (`agentic-cms lab`, 0.5.0): three.js scenes as a second
  scene kind (`.parity/lab/<name>.js` modules on a pinned CDN import map —
  still no dependency — `build(ctx) → { scene, camera, update(t) }`, rasters
  only, `launch()` taking `--enable-unsafe-swiftshader`). (The inline SVG
  component this list named `Graphic` landed in 0.5.2 as `InlineAnimation`,
  with `readInlineSvg`.)

## Risks and how each is held

- `"use client"` in `dist/`: tsc keeps the directive (proven by
  `FaqAccordion`); `EmailLink` follows it; `Icon` has none.
  `src/lib/components/*` stays out of what `createKit()` reaches (the CLI loads
  `src/kit.ts` under plain Node, `.ts` only).
- `sharp` is already a dependency used from `scripts/` only; `playwright-core`
  stays an optional peer behind one `requireBrowser()` message. CI's Chromium
  is a different build than a workstation's: fine for fixtures; captures are
  only ever compared on one machine.
- The renamed motion frame (`-settled.png`) and the moved harness code: the
  CHANGELOG says "recapture baselines"; the extraction proves the example's
  pixels unchanged.
- `--ref` needs `origin`, `pnpm` and a network for the first install; the
  sibling directory and the cache-of-one deletion are printed before they
  happen.
- `icons add` depends on the two packages' file layouts: fixture-based tests,
  the pinned major in the error, no icon data in the kit.
- `init` on an existing site merges `package.json`, never overwrites without
  `--force`, and the manifest tells `modified` from `stale`.
- `sheet` and `probe --timeline` are inspection, not proof; the skills route
  proof through `visual-parity`.

## Verification, every job

```bash
pnpm lint && pnpm test && pnpm build          # 0 failures
pnpm test:browser                             # the Chromium-backed suite (skips with the reason when there is none)
node tools/hygiene.mjs                        # names, paths, scratch, skills in step, the files list, the CHANGELOG
pnpm test:pack                                # when files, exports, bin or init changed
pnpm kit visual-parity capture before … / after … && compare   # when harness code moved: the example's pixels unchanged
```
