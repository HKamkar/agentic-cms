# scripts

- `optimize-svg-rasters.mjs` — `node scripts/optimize-svg-rasters.mjs [--lossy]
  [--dry-run] [file.svg ...]` re-encodes the PNGs that design-tool SVG
  exports embed as base64 into WebP, in place (lossless by default, so the
  rendering is identical; `--lossy` only for files whose bitmap is an alpha
  mask). Without files it walks `public/images`. Run it on every SVG a design
  tool exports: such a file is often a megabyte of wrapper around one bitmap.
- `optimize-webp.mjs` — `node scripts/optimize-webp.mjs [--quality 80]
  [--max-width N] [--dry-run] <files-or-dirs>` re-encodes WebP files as lossy
  WebP in place when that saves 30% or more (design exports are usually
  lossless, 3-5x larger). Run it on the images of a new blog post.
- `placeholder.mjs` — `node scripts/placeholder.mjs <out> <width> <height>`
  writes one wireframe placeholder image: a mid-grey field with a one-pixel
  border and a corner-to-corner cross, no text (it needs no fonts and reads
  on a light and a dark page alike); the format follows the extension
  (`.webp` lossless, `.jpg` quality 80, `.png`, `.svg`). The placeholders
  committed under `public/images` are its output; a new post's images, a
  new page's 1200×630 OG image and any illustration slot start as one.
- `svgo.config.mjs` — settings for `pnpm dlx svgo@3` on the pure-vector
  illustrations, where it routinely halves a file; the comment in the file
  has the command and the one plugin that must stay off (the viewBox has to
  survive, or the image stops scaling).
- `check-seo.mjs` — `node scripts/check-seo.mjs [--strict] [--report]`
  audits every prerendered page after `next build` (title, description,
  canonical, Open Graph, Twitter card, headings, image alt and size, JSON-LD,
  robots, sitemap, internal links) and exits 1 on a failure; `pnpm build`
  runs it, so `preview` and `deploy` cannot skip it. The contract it enforces
  is `src/lib/seo/README.md`.
- `content-check.mjs` — `node scripts/content-check.mjs [--root <dir>]` (`pnpm
  content:check`) reads every collection of the content engine
  (`src/lib/content/README.md`) the way `pnpm build` would and prints one
  row per collection and a summary; a bad file prints its `ContentError`
  lines and exits 1. `--root` points it at another content tree. The
  sub-second schema loop; the build runs the lint below instead.
- `content-lint.mjs` — `node scripts/content-lint.mjs [--root <dir>]
  [--strict] [--report]` (`pnpm content:lint`; the first step of `pnpm
  build`) reads every collection like `content-check` (an engine error is
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
  the shape of `content/editorial/workshop.yaml` when it exists, and dates
  that parse but are not days. One line per finding in
  `check-seo`'s grammar, `LEVEL file rule: path problem`; exit 1 on any
  `FAIL`; `--strict` promotes every `WARN`; `--report` also writes
  `.parity/content-lint-report.txt`. The exact rules `FAIL`; the two
  heuristics (a claim word near a regulation with the brand as the
  subject, a cloud named as what the stack runs on) and the soft ranges
  (a title over 60, a description outside 70–160, a future date, a stale
  draft, an orphan, a stray file) `WARN`. The rule library is `lib/content-lint.mjs`
  (`lint({ root, voice, now })`), tested by `content-lint.test.mjs`
  (`pnpm test`).
- `content-status.mjs` — `node scripts/content-status.mjs [--since <window>]`
  (`pnpm content:status`) prints what the content is right now, from the
  files: the posts by date with their drafts, the pages and their
  `updated`, the FAQ sets, reviews and use cases, the calendar's upcoming
  rows, the backlog, the workshop `content/editorial/workshop.yaml` names
  (present in this checkout or not; its briefs and newest research when it
  is), and the commits under `content/` in the window (default 30 days).
  Read-only; the `content-status` skill reports what it printed.
- `content-docs.mjs` — `node scripts/content-docs.mjs [--check]` writes the
  field tables of every collection into `src/lib/content/README.md` from
  the schemas' `.describe()` texts (between the `content-docs` markers);
  `--check` exits 1 when the file is stale, and `pnpm build` runs it, so a
  schema change is followed by running the script and committing the README.
- `lib/load-ts.mjs` — `node --import ./scripts/lib/load-ts.mjs …` lets plain
  Node run the TypeScript under `src/` (types stripped by Node, `@/` and
  extensionless imports resolved by the hook); `pnpm test` (`src/**/*.test.ts`
  and `scripts/**/*.test.mjs`) and the content scripts use it. No `.tsx`.
- `parity.sh <label>` — builds and stores every prerendered page with scripts stripped, its JSON-LD blocks beside it (`<page>.jsonld`, keys sorted, one block per line) and the non-HTML routes (`sitemap.xml`, `feed.xml`, `robots.txt`, the icons) under `.parity/<label>/`; `diff -r` two captures to prove a refactor changed no markup, structured data or sitemap. React's `useId` values change with the component tree; compare with them normalised (`sed -E 's/_R_[a-z0-9]+_/_R_x_/g'`) when a page moves between trees.
- `visual-parity.mjs` — proves a change altered no pixels: `node
  scripts/visual-parity.mjs capture <label>` renders every prerendered page of
  the current build at eight widths with motion frozen
  (`.parity/visual/<label>/`), and `compare <before> <after>` diffs two
  captures pixel by pixel and writes diff images. The page list is derived
  from the build's own output, so a new route is captured without editing the
  script, and the three interaction labels of `--states` come from
  `src/config/site.ts` — nothing here hard-codes a slug or a class.
  `capture <label> --motion` plays the animations instead (viewport frames at
  150/500/2000 ms after each scroll step, plus a recorded inventory of every
  animation with its timing and target); `capture <label> --states`
  photographs hover, focus, checked and open states located by role.
  `--pages /,/blog` limits a capture to some pages (pass it to the compare
  too, so it judges only those); `--scheme dark` renders with
  `prefers-color-scheme: dark` — a fresh browser context has no stored theme
  choice, so the default capture is the light mode and a themed site is proven
  twice. Compare any two captures with the same command. A static capture
  scrolls each page through once, waiting in the renderer's animation frames
  rather than in milliseconds, so a loaded machine slows a capture instead of
  corrupting it; a page whose renderer stalls is reloaded once and then fails
  rather than yielding a wrong shot. Two of those waits — the reveals that
  prove hydration and the footer hairlines that prove the scroll-through ran
  its sequences — look for `ix`/`OnView` markers, so they have nothing to wait
  for while the wireframe has no motion and become load-bearing again in a
  fork that adds reveals. Needs a Chromium build (`~/.cache/ms-playwright`, or
  `CHROME_PATH`). The comment at the top of the script has the details.
