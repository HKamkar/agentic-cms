# Changelog

Every release of `agentic-cms`, newest first; a pull request adds its lines
under Unreleased, and the release commit renames that heading. A line that
changes what a capture writes says **recapture baselines**.

## [Unreleased]

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
