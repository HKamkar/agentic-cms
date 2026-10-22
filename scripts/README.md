# scripts — the agentic-cms command line

Every script here is a command of `agentic-cms`, the package's `bin`
(`bin/agentic-cms.mjs` dispatches to them): `pnpm kit <command>` in
this checkout, `agentic-cms <command>` on a site that installs the
package (its `package.json` names them: `content:lint`, `content:check`,
`content:status`, `content:docs`; `lint` runs ESLint, then `check-site`, and
`build` runs `pnpm lint`, `lint --production`, `docs --check`, `next build`
and `seo` in that order, then `guard-email` on a site whose
`src/config/site.ts` turns `guardEmail` on: the gates of `lib/gates.mjs`).
Each runs against the site in the
current directory: its registry and config through `src/kit.ts`, its
`content/`, `public/`, `.next` and `.parity`. The flags, defaults and exit
codes of every command are `docs/commands.md`, generated from
`lib/specs.mjs` — the spec each script parses its arguments from
(`lib/args.mjs`; an unknown flag is an error that names the nearest one,
a value outside a flag's `choices` lists them, `--help` prints the spec
with its `examples`; a spec's `group` is its family in the map the bin
prints, the families in the order of the kit's layers, `FAMILIES`: the
content engine, the design tools, the site's commands with its default
gates and opt-in steps (`docs/parts.md`); `site: true` marks one that reads
the site's registry and is refused outside a site's root).
`lib/browser.mjs` is the Chromium (and the WebKit beside it,
`launch({ engine })`), the static server and the waits the harness and the
page commands share; `browser/` holds their tests, run against `fixtures/`
by `pnpm test:browser`.

- `optimize-svg-rasters` — `pnpm kit optimize-svg-rasters [--lossy]
  [--dry-run] [file.svg ...]` re-encodes the PNGs that design-tool SVG
  exports embed as base64 into WebP, in place (lossless by default, so the
  rendering is identical; `--lossy` only for files whose bitmap is an alpha
  mask). Without files it walks `public/images`. Run it on every SVG a design
  tool exports: such a file is often a megabyte of wrapper around one bitmap.
- `optimize-webp` — `pnpm kit optimize-webp [--quality 80]
  [--max-width N] [--dry-run] <files-or-dirs>` re-encodes WebP files as lossy
  WebP in place when that saves 30% or more (design exports are usually
  lossless, 3-5x larger). Run it on the images of a new blog post.
- `placeholder` — `pnpm kit placeholder <out> <width> <height>`
  writes one wireframe placeholder image: a mid-grey field with a one-pixel
  border and a corner-to-corner cross, no text (it needs no fonts and reads
  on a light and a dark page alike); the format follows the extension
  (`.webp` lossless, `.jpg` quality 80, `.png`, `.svg`). The placeholders
  committed under `public/images` are its output; a new post's images, a
  new page's 1200×630 OG image and any illustration slot start as one.
- `svgo.config.mjs` — settings for `pnpm dlx svgo@3 --config
  <path>/scripts/svgo.config.mjs` on the pure-vector
  illustrations, where it routinely halves a file; the comment in the file
  has the command and the one plugin that must stay off (the viewBox has to
  survive, or the image stops scaling).
- `seo` — `pnpm kit seo [--strict] [--report]` (`check-seo.mjs`)
  audits every prerendered page after `next build` (title, description,
  canonical, Open Graph, Twitter card, headings, image alt and size, JSON-LD,
  robots, sitemap, internal links) and exits 1 on a failure; `pnpm build`
  runs it, so `preview` and `deploy` cannot skip it. The contract it enforces
  is `src/lib/seo/README.md`.
- `check` — `pnpm kit check [--root <dir>]` (`pnpm content:check`;
  `content-check.mjs`) reads every collection of the site's registry
  (`src/lib/content/README.md`) the way `pnpm build` would and prints one
  row per collection and a summary; a bad file prints its `ContentError`
  lines and exits 1. `--root` points it at another content tree. The
  sub-second schema loop; the build runs the lint below instead.
- `lint` — `pnpm kit lint [--root <dir>] [--strict] [--production]
  [--report]` (`pnpm content:lint`; in `pnpm build` after `pnpm lint`, as
  `lint --production`; `content-lint.mjs`) reads every collection like `content-check` (an engine error is
  one `FAIL` line per issue, verbatim), then applies the rules a schema
  cannot carry: the voice and claim block of `content/VOICE.md` (banned
  words and patterns, claim words near a regulation name, model names,
  cloud names outside a customer context, the ® mark, em dashes), the SEO
  limits at the source (title 60/70, description 70–160 and 50/200,
  excerpt 30–40 words, 3–8 keywords), alt-text pairs, the post body's
  structure (headings start at `##` and never jump a level, the FAQ `##`
  holds `###` questions with answers, images carry real alts and live under
  the post's folder), the images on disk (existence, weight over 250 KB,
  orphans under `public/images/blog/`), stray files the loader ignores,
  the shape of `content/editorial/workshop.yaml` when it exists, dates
  that parse but are not days, the starter's placeholder copy and address
  (`placeholder`: a `WARN`, a `FAIL` with `--production`) and, in a site,
  the kit example's brand (`example-brand`, a `FAIL` at any time;
  `lib/placeholders.mjs`). One line per finding in
  `check-seo`'s grammar, `LEVEL file rule: path problem`; exit 1 on any
  `FAIL`; `--strict` promotes every `WARN`; `--report` also writes
  `.parity/content-lint-report.txt`. The exact rules `FAIL`; the two
  heuristics (a claim word near a regulation with the brand as the
  subject, a cloud named as what the stack runs on) and the soft ranges
  (a title over 60, a description outside 70–160, a future date, a stale
  draft, an orphan, a stray file) `WARN`. The rule library is `lib/content-lint.mjs`
  (`lint({ root, collections, site, voice, now })` — the site's registry and
  config come in, nothing is imported), tested by `content-lint.test.mjs`
  (`pnpm test`).
- `status` — `pnpm kit status [--since <window>]` (`pnpm content:status`;
  `content-status.mjs`) prints what the content is right now, from the
  files: the posts by date with their drafts, the pages and their
  `updated`, the FAQ sets, reviews and use cases, the calendar's upcoming
  rows, the backlog, the workshop `content/editorial/workshop.yaml` names
  (present in this checkout or not; its briefs and newest research when it
  is), and the commits under `content/` in the window (default 30 days).
  Read-only; the `content-status` skill reports what it printed.
- `docs` — `pnpm kit docs [--check]` (`pnpm content:docs`; `content-docs.mjs`)
  writes the field tables of every collection of the site's registry into
  the site's `content/README.md` from the schemas' `.describe()` texts
  (between the `content-docs` markers); `--check` exits 1 when the file is
  stale, and `pnpm build` runs it, so a schema change is followed by running
  the command and committing the README.
- `lib/load-ts.mjs` — `node --import ./scripts/lib/load-ts.mjs …` here,
  `node --import agentic-cms/loader …` on a site (the package exports
  it as `./loader`), lets plain Node run the TypeScript under the site's `src/` (types stripped by Node;
  the aliases of the site's `tsconfig.json` — `@/*`, and in this checkout
  the package's own name to its source — and extensionless imports resolved
  by the hook, which never touches `node_modules`, where a package ships
  JavaScript); every command loads `src/kit.ts` through it, and `pnpm test`
  (`src/**/*.test.ts` and `scripts/**/*.test.mjs`) uses it. No `.tsx`.
- `lib/component-lint.mjs` — `componentRules(options)`, the component
  library's ESLint configs (the package exports it as `./eslint`): the
  layers' one-way imports, animation libraries only in the motion layer,
  what a section or a pattern may contain, and the `agentic-cms` plugin's
  rules across `src/` — the engines' (`lib/engine-rules.mjs`: `copy`,
  `head`, `forms`, `tags`, `email`), which fail, and the preferred tier's
  (`lib/preferred-rules.mjs`: `motion`, `graphics`, `images`, `icons`,
  `styling`), which warn, naming the kit's part, and go quiet with an
  `allow` entry or an inline disable that gives its reason. Not a command:
  a site's `eslint.config.mjs` spreads it, and `pnpm lint` runs it
  (`docs/primitives.md` § Enforced).
- `check-components` — `pnpm kit check-components [--json]`
  (`check-components.mjs`; the work in `lib/check-components.mjs`, the file
  system passed in) is the component library's placement guard, the first
  pass of `check-site` (below), alone:
  the layers there and every file under `src/components` in one, every
  component the library exports named in its catalogue, every component in
  a section folder imported by the registry, route files only in
  `src/app`'s known route folders, no component elsewhere in `src/`, CSS
  modules and `@keyframes` only where the library keeps them, every owner
  and `allow` entry with its reason, every inline disable of a required
  rule with its reason, and the required rules as ESLint resolves them for
  a sample file per layer (no later block replacing one); a transition
  declared in CSS outside the motion layer warns. Its config is
  `src/config/components.json` (the layer keys are `componentRules()`'s);
  the config's frozen `inherited` list and a running round's candidates
  pass. Exit 1 on a finding, each with its fix (`docs/primitives.md`
  § Placed).
- `check-site` — `pnpm kit check-site [--baseline] [--base <ref>] [--json]`
  (`check-site.mjs`; the work in `lib/check-site.mjs`, the file system, git
  and the components pass passed in) is the second half of `pnpm lint`
  (`eslint; s=$?; … check-site || s=1; exit $s`): the placement guard's
  passes, then a `*-demo` route only `demo new`'s or the lab's, a round's
  pictures only with its route, every exception added since the merge base
  listed with its reason and `inherited` only shrinking, the gates of
  `lib/gates.mjs` in `package.json`'s `lint` and `build` (which `init`
  writes and merges too), CI running them, what is left of the kit's
  example (`lib/leftovers.mjs`) and the baseline only shrinking
  (`lib/baseline.mjs`), and, as warnings, the site's own Playwright,
  `sharp` or `next dev` script and a machine's address in `next.config.*`
  (`docs/primitives.md` § The whole site). `--baseline` writes an existing
  site's engine bypasses and leftovers into the config's `baseline`, once,
  as it takes 0.8.2 (`docs/migrating-to-0.8.2.md`).
- `parity` — `pnpm kit parity <label>` (`parity.mjs`) builds and stores every prerendered page with scripts stripped, its JSON-LD blocks beside it (`<page>.jsonld`, keys sorted, one block per line) and the non-HTML routes (`sitemap.xml`, `feed.xml`, `robots.txt`, the icons) under `.parity/<label>/`; `diff -r` two captures to prove a refactor changed no markup, structured data or sitemap. React's `useId` values change with the component tree; compare with them normalised (`sed -E 's/_R_[a-z0-9]+_/_R_x_/g'`) when a page moves between trees.
- `shot`, `probe`, `sheet` — `pnpm kit shot <route|url> [--select <css> |
  --heading <regex>] [--transparent --trim --resize <w>] [--json]` is one
  screenshot of a page or an element with its box; `pnpm kit probe
  <route|url> --select <css> | --heading <regex> [--all] [--motion
  --timeline <ms>]` prints the numbers behind a screenshot claim (box,
  computed styles, stacking contexts, a timeline, the pending reveals, the
  console) as JSON; `pnpm kit sheet <spec.yaml>` renders candidates, rows
  lettered and cells numbered at the real size and background, to one
  picture. All three seed the page's storage like a capture (below;
  `--no-storage` is a first visit), and so does `icons audit`. `docs/shot-probe-sheet.md` has the
  recipes; `lib/page-command.mjs` and `lib/sheet.mjs` are their shared parts.
- `guard-email` — `pnpm kit guard-email [--domain <host>]… [--json]`
  scans every served file of the build (pages, RSC payloads, the `.body`
  routes, the static chunks) for an address at the site's domain (the host
  of `site.url`) and exits 1 naming each file; the last step of the build
  on a site whose `src/config/site.ts` turns `guardEmail` on, as `init`
  writes it for a new site (`docs/email.md`).
- `critical-css` — `pnpm kit critical-css [--check] [--json]`
  (`critical-css.mjs`, `lib/critical-css.mjs`) inlines into each
  prerendered page the rules its own HTML uses, with every `@font-face` of
  its stylesheets and the rules the HTML cannot vouch for (Tailwind's
  arbitrary variants, `[data-…]` and `[aria-…]` states), and loads the
  stylesheets without blocking the first paint; `--check` changes nothing
  and exits 1 naming each page that still waits for a stylesheet. Right
  after `next build` on a Node host (`docs/deploy.md`).
- `assemble` — `pnpm kit assemble [--check] [--json]` (`assemble.mjs`,
  `lib/assemble.mjs`) copies `public/` and `.next/static` into a standalone
  build's package (`.next/standalone`, or its `relativeAppDir`) — into its
  folders, never as them — and checks every file there by size and hash;
  exit 1 naming each missing, different or nested file. The last step of a
  standalone site's build (`docs/deploy.md`).
- `icons` — `pnpm kit icons add|remove <id>…` keeps the site's icon
  manifest and generates `src/config/icons.ts` from `lucide-static` and
  `simple-icons` (installed by the site; the kit ships no icon data);
  `icons family <spec>` renders a family of marks from primitives;
  `icons audit` inventories every icon on the built pages beside its copy,
  as JSON and a sheet; `icons round new|publish|retire` runs a design round
  for a set of the site's own icons in the lab (`docs/icons.md`;
  `lib/icons-source.mjs`, `lib/icons-family.mjs`, `lib/icons-audit.mjs`,
  `lib/icons-round.mjs`).
- `demo` — `pnpm kit demo new <name> --section <type> [--page <slug>]
  [--candidates 2] [--timeline]` scaffolds the design round's throwaway route,
  `src/app/<name>-demo/page.tsx`, with a candidate per letter (a copy of the
  section's component beside it, from the registry) reading the page's real
  copy from its file, in the section's frame inside the site's own layout,
  the current version last (`--timeline`: each block under the lab's
  timeline); `--showcase [--component <file>]…` writes a review page of
  pieces instead. With the dev server running it waits until the route
  answers and prints its URLs (`lib/handover.mjs`); `demo clean [name]`
  removes the route, every component file it alone imported and next
  dev's stale route types (`docs/design.md` § The round; `lib/demo.mjs`).
- `lab` — `pnpm kit lab new <name> --kind icon|mark|loop` writes an SVG
  scene under `.parity/lab/` to start from; `lab serve` shows every scene
  on the site's tokens (in each of its schemes, inline and as an `<img>`, with a
  scrubber over its animations) on this machine and the LAN, reloading on
  every save, and prints each scene's `/scene/<name>`; `lab route` writes
  the throwaway route and waits for it like `demo new`; `lab clean`
  removes the lab. The design canvas for the site's
  own icons, graphics and short 2D loops, opened when a drawing is needed
  and gone once its files are rendered (`docs/lab.md`; `lib/lab.mjs`,
  `lib/lab-page.mjs`, `lib/lab-server.mjs`).
- `init` — `pnpm kit init [dir] --name <Site> [--url <origin>] [--email
  <address>] [--light-only]` (`init.mjs`, `lib/init.mjs`) lays a site out
  from the package: the example's code, a starter of the site's own in
  place of the example's content (`lib/starter.mjs`, `templates/starter/`:
  a home page and the blog index whose copy is marked `(placeholder)`,
  empty collections, neutral pictures), the agent files, the config with
  `guardEmail: true`, the gates in `package.json`, a CI workflow and
  `.github/dependabot.yml` (`templates/site/`). A new site needs `--name`.
  `init . --agent-files [--check | --diff <file> | --accept <file>]`
  refreshes or checks an existing site's rules and skills (`docs/init.md`).
- `setup` — `pnpm kit setup [--check] [--build] [--no-browsers]
  [--engines chromium,webkit] [--deps] [--no-public]` (`setup.mjs`) makes a
  clone ready to work on, after a site's `scripts/setup.sh` (the kit's
  `templates/site/setup.sh`, which `init` copies) checked Node, got pnpm at
  the `packageManager` version and installed: the browsers not installed
  yet, WebKit's Linux libraries (a launch tells; `--deps` runs the `sudo`
  line, else it is printed for the owner), `.env.local` from
  `.env.example`, this machine's addresses in `ALLOWED_DEV_ORIGINS`,
  `pnpm lint` and `pnpm test` (`--build` adds `pnpm build`), then the URLs.
  Every step keeps what is there; `--check` reports and changes nothing
  (`docs/setup.md`; `lib/setup.mjs`, with the shell, the file system, the
  browsers and the network passed in).
- `urls` — `pnpm urls [--write] [--no-public] [--port <n>]` (`urls.mjs`)
  prints this machine's URLs for the dev server (its port from
  `scripts.dev`) and the lab, localhost, the LAN and the public address,
  whether each server answers, and whether `ALLOWED_DEV_ORIGINS` in
  `.env.local` covers every address; `--write` adds the missing hostnames,
  keeping the file's other lines; exit 1 on a missing one without it
  (`docs/dev-server.md`; `lib/hosts.mjs`, which the lab server lists its
  LAN URLs from too).
- `serve` — `pnpm kit serve [--port <n>] [--lab] [--write-origins]
  [--fix-cache] [--no-public]` (`serve.mjs`) starts next dev on the site's
  port on every interface (or reuses this site's, found by
  `.next/dev/lock`; anything else on the port is refused) and the lab when
  `.parity/lab` has scenes, waits until the root and every `*-demo` route
  answer, prints one table of localhost, LAN and public × the routes and
  the lab's pages, restarts next dev with a cleared cache on Turbopack's
  stale-cache error (`--fix-cache`), and stops both on Ctrl-C
  (`docs/dev-server.md`; `lib/serve.mjs`, `lib/dev-server.mjs` — next dev
  started, watched and stopped by process group, which the browser tests
  run too — and `lib/handover.mjs`, the wait and the URLs).
- `visual-parity` — proves a change altered no pixels: `pnpm kit
  visual-parity capture <label>` (`visual-parity.mjs`) renders every
  prerendered page of the current build at the site's widths (its profile,
  `src/config/harness.ts`; `lib/profile.mjs`) with motion frozen
  (`.parity/visual/<label>/`), and `compare <before> <after>` diffs two
  captures pixel by pixel and writes diff images. The page list is derived
  from the build's own output, so a new route is captured without editing the
  script, and the pages and the three interaction labels of `--states` come
  from the site's page files and config through `src/kit.ts` (the first page
  with a `contact-form` section, the first with a `faq` section, the blog
  index, the build's first post) — nothing here hard-codes a slug or a class.
  `capture <label> --motion` plays the animations instead (viewport frames at
  150/500/2000 ms after each scroll step, plus a recorded inventory of every
  animation with its timing and target); `capture <label> --states`
  photographs hover, focus, checked and open states located by role.
  `--pages /,/blog` limits a capture to some pages (pass it to the compare
  too, so it judges only those); `--scheme dark` renders with
  `prefers-color-scheme: dark` — a fresh browser context has no stored theme
  choice, so a capture takes the profile's first scheme (else light) and
  `proof` runs a pass in each scheme the profile names. Compare any two captures with the same command. A static capture
  scrolls each page through once, waiting in the renderer's animation frames
  rather than in milliseconds, so a loaded machine slows a capture instead of
  corrupting it; a page whose renderer stalls is reloaded once and then fails
  rather than yielding a wrong shot. Two of those waits — the reveals that
  prove hydration and the footer hairlines that prove the scroll-through ran
  its sequences — look for `ix`/`OnView` markers, so they have nothing to wait
  for while the wireframe has no motion and become load-bearing again in a
  fork that adds reveals. The play-once layer's parts count among the
  reveals while armed and unplayed, which a static capture never sees: it
  runs under reduced motion, where the layer arms nothing. Needs a Chromium build (`~/.cache/ms-playwright`, or
  `CHROME_PATH`). The comment at the top of the script has the details.
  Every page starts from a seeded storage when the site has a
  `src/config/harness.ts` (`export const harness = { storage: { consent:
  … } }`) or the run passes `--storage <key>=<value>` /
  `--session-storage <key>=<value>`: written before any of the page's
  scripts, so a capture shows the site after a visitor's choice (a consent
  banner closed); `{now}` in a value is the run's ISO time. The seed is
  recorded in `meta.json`, read from the tree for a `--ref` baseline too,
  and `compare` refuses two captures seeded differently unless
  `--mixed-seed` (`lib/storage-seed.mjs`, `docs/visual-parity.md`).
