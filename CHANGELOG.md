# Changelog

Every release of `agentic-cms`, newest first; a pull request adds its lines
under Unreleased, and the release commit renames that heading. A line that
changes what a capture writes says **recapture baselines**.

## [Unreleased]

- `seo`: the page's `<title>` is counted in `<head>` only; an inline
  `<svg>` with a `<title>` (a named icon) no longer fails a page for having
  several. The icon family's spec is documented under `src/config/`, not
  `content/` (whose folders the content lint reads as collections).

## [0.4.1] — 2026-09-20

- `shot` and `probe` take `--heading` and `--select` together: the
  selector is searched inside the section that holds the heading.
- `init --agent-files` on a site that wrote its own rules before any
  manifest existed keeps them (they read as `modified`, the site's), where
  0.4.0 took them for stale and overwrote them; `--force` takes the kit's.

## [0.4.0] — 2026-09-20

The kit as an agent's design toolbox: six jobs, one release (`docs/roadmap.md`).

- Icons as families: `Icon` in `agentic-cms/components` (path data on the
  24 grid in the current colour, stroke or fill); `agentic-cms icons add |
  remove <id>…` keeps a site's manifest (`src/config/icons.json`) and
  generates its map (`src/config/icons.ts`, each set's licence in the
  header) from the sets the site installs — Lucide (`lucide:<name>`) and
  Simple Icons (`si:<slug>`); the kit ships no icon data. `agentic-cms icons
  family <spec>` renders a family of marks from primitives on one grid with
  named gradients (`--check` for drift). `agentic-cms icons audit` lists
  every icon on the built pages beside its copy, as JSON and a sheet. The
  `design-icons` skill; `docs/icons.md`; `STANDARD.md` §4 on families.
- The e-mail guard: `agentic-cms/email` (`encodeEmail`, `decodeEmail`,
  `isEmailToken`, `readableEmail` — a token that never carries the address
  as text), `EmailLink` in `agentic-cms/components` (the readable form
  until hydration, a `mailto:` link after), `withEmailToken` in
  `agentic-cms/forms` (a mailto form's recipient as a token; the backend
  resolves it at submit), and `agentic-cms guard-email` (fails a build
  whose served files carry an address at the site's domain as text). A
  site opts in; `docs/email.md` says how.
- Design works by default: four skills committed in the repo —
  `.claude/skills/` for Claude Code and `.agents/skills/` for Codex,
  identical (`pnpm skills:sync`), found from a checkout with nothing
  installed — `design` (the loop from the wireframe to a look), `design-options`
  (candidates the owner picks by row), `design-measure` (a screenshot claim
  into numbers), `design-proof` (the pixel proof before a merge); a `design`
  rule for `src/`; `docs/design.md`, `docs/skills.md`.
- `agentic-cms init [dir]`: a site from the package — the wireframe
  example, a site's `AGENTS.md`, rules and the skills, the config
  (`package.json` merged, never overwritten), a manifest of the agent files;
  `init --agent-files` refreshes the rules and skills after a kit upgrade
  keeping the site's own edits, `--check` reports drift for CI. The package
  now ships the example, the templates, the skills and `docs/` (`files`);
  the pack smoke lays its scratch site out with `init`. `docs/init.md`.
- `visual-parity compare` on two pages of different heights no longer stops
  at `SIZE`: it compares row by row from the top and the bottom and reports
  the first differing row, the intact tail, the band that changed on each
  side and a verdict — `shift` (one section changed and moved the rest
  intact), `insert`, `remove`, `reflow`, `width` — with crops of the band in
  the diff directory; a same-size `CHANGED` line names the rows that
  changed. `--json` prints the report (always written as `report.json`).
- `visual-parity capture --build` (the site's build first), `--ref <git
  ref>` (a baseline: that commit checked out, installed and built in a
  sibling directory, served and captured, its sha in the capture), `--json`
  (the summary), and `capture.json` written last as the sign a capture
  finished. `--url`, `--build` and `--ref` are three sources of one build.
- The settled motion frame is `--s<nn>-settled.png` (was `-2000.png`) and
  waits `--settle` ms (2000) or longer when an element in view declares
  `data-settle="<ms>"`; `<page>.settle.json` records each step's wait and
  compares like the animation inventory. **Recapture motion baselines.**
- The harness reads the site's config (`src/kit.ts`) only for `--states`,
  so a static or motion capture and a compare run on any build.
- `agentic-cms shot <route|url>`: one screenshot of a page or of an element
  (`--select`, or `--heading` for the section holding a heading), prepared
  like the harness prepares a page, at any width, scale and scheme, cropped
  with a margin, isolated on a transparent ground (`--transparent`),
  trimmed, resized, as PNG or WebP; `--json` prints the element's box.
- `agentic-cms probe <route|url>`: the numbers behind a screenshot claim,
  as JSON — an element's box, computed styles and the chain of stacking
  contexts above it (with the property that creates each), a timeline of
  its opacity, transform and position under `--motion`, the reveals still
  pending on the page, the console's errors.
- `agentic-cms sheet <spec>`: a candidate sheet from a YAML or JSON spec —
  rows lettered, cells numbered, each candidate (a file, inline SVG, markup
  or a served image) at the real size on the real background, the site's
  stylesheets linked — rendered to one picture for a pick by row.
- `scripts/lib/browser.mjs` gains the helpers the three share (a target by
  selector or heading, the harness's preparation, console collection,
  isolation, the stacking chain); `docs/shot-probe-sheet.md` has the recipes.
- The command line is strict: an unknown flag is an error that names the fix
  (`run agentic-cms <command> --help`) instead of being ignored; every
  command has `--help`, with its flags, defaults and exit codes generated
  from one spec (`scripts/lib/specs.mjs`), and `agentic-cms` alone lists
  the commands. `visual-parity capture --motion --states` is now an error
  (it was two captures pretending to be one).
- `docs/`: `commands.md` (generated from the specs, checked by CI),
  `visual-parity.md` (the harness's contract, out of the script's header),
  `roadmap.md`.
- The browser code the harness shares with the coming one-shot commands is
  `scripts/lib/browser.mjs`; the harness behaves as before. Chromium is
  found in Playwright's cache on Linux, macOS and Windows (builds sorted by
  number, so `chromium-1000` no longer loses to `chromium-999`), and a
  missing build is an error that names the install command.
- Repo hygiene: this changelog; CI (`.github/workflows/verify.yml`: lint,
  tests, build, the hygiene check, the browser suite with a Chromium, the
  pack smoke on `main`); `tools/hygiene.mjs` (`pnpm hygiene`: no one site's
  name, no machine paths, no captures or scratch committed, the skills trees
  in step, the changelog and the generated docs current); `pnpm
  test:browser` (the Chromium-backed suite, skipped with a reason without
  one).

## [0.3.3] — 2026-09-19

- seo: the organisation's e-mail is optional in the structured data
  (`SiteConfig.email?`); without it the Organization carries no `email` and
  a ContactPoint carries the page's URL.

## [0.3.2] — 2026-09-19

- visual-parity: the capture scrolls through a page that grows (the height
  is re-read at every step, so lazy images loading during the pass no longer
  stop it short of the footer).

## [0.3.1] — 2026-09-19

- ix: reveals and sequences replay only after the element has left the
  viewport entirely, never while it is still partly on screen.

## [0.3.0] — 2026-09-18

- The package, its command line and its marketplace renamed from
  `content-engine-kit` to `agentic-cms`; the engine unchanged since 0.2.0.

## [0.2.0] — 2026-09-17

- The kit as a package: `createKit()`, the `content`, `blog`, `seo`, `forms`
  and `ix` exports, the `agentic-cms` command line, the `editorial` plugin
  for Claude Code and Codex, the example site consuming it.
