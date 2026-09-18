@AGENTS.md

# agentic-cms: project rules

- `STANDARD.md` is the design system and the way pages are built on it:
  tokens, type, spacing, markup, images, components, the section anatomy,
  the page recipe. Read it before writing any markup or CSS; the component
  catalogue is `src/components/README.md`.
- The pages are a **wireframe**: four semantic colours in a light and a dark
  mode, a system font stack, bordered boxes and hairlines, no radius, no
  shadow, no gradient and no motion. That is the design, not an unfinished
  one — a fork replaces the tokens and the section components, not the
  engine, and a site of its own installs the engine as the package
  `agentic-cms` (`src/lib/` is its source; the README says how). A
  change that must not move a pixel proves it with
  `agentic-cms visual-parity`; a design change is its own commit and says so
  — nothing is restyled in passing.
- Content is files under `content/`, validated at build time by the content
  engine: posts in `content/blog/` (the filename is the slug), the author and
  category registries, `reviews.yaml`, `faqs/<key>.yaml`, `use-cases.yaml`,
  the pages in `content/pages/`; the door for editing is `content/README.md`,
  the templates are `content/_templates/`. The voice and claim rules are
  `content/VOICE.md`; `agentic-cms lint` enforces its fenced block
  first in `pnpm build` (a FAIL stops the build, a WARN is read, `--strict`
  promotes them). Never read `content/` at request time: pages are
  prerendered, the Worker has no filesystem.
- The procedures for content jobs are the `editorial` plugin in `plugin/`
  (`/editorial:write-post`, `new-post`, `update-post`, `new-page`,
  `review-voice`, `content-status`, `retire-content`, and the
  `voice-reviewer` and `critic` agents), brand-neutral by rule: it reads the
  brand from the repo, and a grep for this repo's brand over `plugin/` stays
  empty. This checkout enables it through `.claude/settings.json` (the repo
  is its own marketplace, `.claude-plugin/marketplace.json`). The plan is
  `content/editorial/`; a marketing workshop outside the repo, when a site
  has one, is named by `content/editorial/workshop.yaml`.
- Public URLs are `/`, `/sections/home`, `/sections/about`,
  `/sections/use-cases`, `/sections/contact`, `/blog`, `/blog-post/<slug>`.
  On a live site an indexed URL never changes without a redirect; in this
  example site the `/sections/*` pages are a catalogue a fork may delete.
- Brand names, links and the chrome's text come from `src/config/site.ts`;
  every page is served by this app, so links stay relative.
- A page is a file: `content/pages/<slug>.yaml` — its `seo` block, the copy
  of its structured data, and its sections in order (`type` + copy),
  validated at build time and rendered by `src/app/[[...slug]]/page.tsx`
  through the section registry (`src/components/sections/render.tsx`).
  Presentation (sizes, ratios, class strings) stays in the components, keyed
  by position.
- SEO is a contract, not a checklist: `src/lib/seo/README.md`. The page
  file's `seo` block feeds `kit.seo.pageMetadata()` / `pageBreadcrumb()`,
  its `jsonld` block `pageJsonLd()`; `pnpm build` audits every prerendered page
  (`agentic-cms seo`) and fails on a missing or wrong field. Never
  hand-write head tags.
- Verify with `pnpm test` (the content engine, the post pipeline and the
  lint), `pnpm content:lint` (the content rules, in a second), `pnpm build`
  (prerenders everything) and `pnpm preview` (the real Worker) before calling
  a change done.
- Machine-specific notes (this VM, its ports and its IP) live in
  `CLAUDE.local.md`, which is gitignored.

## Styling

The invariants; the values, tables and examples are in `STANDARD.md`.

- Utilities for layout, spacing, type, colour, visibility and hover/focus; a
  `<Name>.module.css` next to the component only for what utilities cannot
  say — today that is `blog/PostBody.module.css` alone: the rich-text element
  rules under `.prose` and the FAQ block. Plain CSS, no `@apply`, breakpoints
  spelled out (`@media (width >= 992px)`), joined to utilities with `cx()`.
- Tokens only in the `@theme static` block of `src/app/globals.css`; the two
  breakpoint steps of the scale in `src/styles/base.css`. Four colours, each
  a `light-dark()` pair: `paper` (the page ground), `ink` (text and every
  hairline), `fill` (a filled block), `muted` (secondary text). Nothing else
  exists as a colour utility — never `bg-white`, `text-black`,
  `border-gray-*`; a fifth colour is a token first. No radius, shadow, blur,
  gradient, transition or animation utilities. The type scale is
  `text-h1`…`text-h6` and `text-body` (never `text-base`/`text-sm`, which
  carry Tailwind's own line-heights); the fonts are `font-sans` and
  `font-label`. Breakpoints: `max-sm` < 480, `max-md` < 768, `max-lg` < 992,
  `lg` ≥ 992, `xl` / `2xl` / `3xl` ≥ 1280 / 1440 / 1920.
- The theme is `color-scheme: light dark` on `:root`, overridden by
  `data-theme` on `<html>` (the `ui/ThemeToggle` button, `localStorage.theme`,
  and the inline script in `src/app/layout.tsx` that applies it before the
  first paint). A component never reads the theme; it uses the semantic
  colours and both modes follow.
- Every section renders inside `ui/Section`: its `type` is its YAML section
  type, its `id` and its `data-section`, and the tag is shown on purpose.
  Cards are a `<ul>` of bordered boxes with `<h3>` titles after the section's
  `<h2>`; a `statement` is the section's `<h2>`. What used to be an
  illustration is a `ui/Placeholder` crossed box; content images are `<img>`
  with `width`, `height`, `alt` and `block h-auto w-full border border-ink`.
- No motion in the wireframe: no `Fx` or `OnView` in a section, no `data-ix`
  attributes, no transitions. The `agentic-cms/ix` library and
  `src/styles/motion.css` stay for a fork that adds reveals — and then the
  old rules apply again: `data-ix` targets addressed through `ix(name)`,
  start states in `motion.css`, `useReducedMotionPref()` honoured, and no
  `translate-*` / `rotate-*` / `scale-*` utility on an element something else
  moves.
- Layers: `theme`, `base` (preflight, then `base.css`), `utilities`; outside
  them `src/styles/motion.css` and the modules. Preflight zeroes margins,
  paddings, borders and list markers: never `m-0`, `p-0`, `list-none`.
  Rich-text element rules only under `.prose` in `PostBody.module.css`.
- Decorative elements are real `aria-hidden` elements, not pseudo-elements.
  Interactive things are real `<button>`s and links; no `outline-none` on
  anything a keyboard reaches (`<main>`, which only the skip link focuses, is
  the one exception). One colour utility per property per element (two
  resolve by stylesheet order).
- Images stay `<img>` with `width`/`height`; above the fold in a server
  component `EagerImage` (`agentic-cms/components`), everything else `loading="lazy"`. `base.css`
  reverts preflight's `height: auto`, so a `w-full` image carries `h-auto`
  itself. Do not convert to `next/image`. New placeholders come from
  `pnpm kit placeholder <out> <width> <height>`.
- Proof: a refactor that must not move a pixel captures before and after with
  `pnpm kit visual-parity capture <label>` and `compare` clean, in
  both schemes (`--scheme dark`), with `--states` when hover / focus /
  checked / open change and `--motion` only when there is motion to check.
  Markup-only refactors: `agentic-cms parity`.

## Gotchas

- Node 22.18+ (26 used, see `.nvmrc`) and pnpm. Run `pnpm install` first:
  `node_modules/next/dist/docs/` (which AGENTS.md says to read) is absent
  until then. `pnpm build` fetches nothing — there is no webfont. Next is
  16.3.5: `params` is a Promise; `await params` in both `generateMetadata`
  and the page. `deploy` collides with a pnpm built-in — always
  `pnpm run deploy`.
- The palette is CSS `light-dark()`: the pages need a current browser
  (Chromium 123+, Safari 17.5+, Firefox 120+), and so does anything that
  screenshots them.
- The Worker is static-only by configuration: everything is prerendered and
  served from the static-assets cache (`open-next.config.ts`); there is no
  filesystem at request time. Adding `revalidate`, on-demand revalidation or
  request-time reads means switching to the R2 incremental cache first.
- `next start` and `wrangler dev` straight after `next build` return 500s —
  the asset cache is empty. Only `pnpm preview`, `pnpm run deploy` and
  `pnpm upload` populate it. ~40 "Failed to copy node_modules/…" lines during
  the OpenNext build are an OpenNext bug and harmless.
- Posts carry two dates on purpose: `date` is the editorial date readers see;
  `publishedAt` feeds `datePublished` (and `updatedAt` `dateModified`) in the
  JSON-LD, the feed and the sitemap, so an imported post keeps the timestamps
  search engines already have. Keep both.
- Post body conventions are load-bearing: the FAQ accordion and FAQPage JSON-LD
  key off a `## Frequently asked questions` heading (rename it and the
  accordion silently disappears); a `> blockquote` becomes the pull-quote card;
  an image on its own line becomes the inline image block. `draft: true` only
  hides in production builds; `_`-prefixed files are skipped. The post schema
  is `postSchema` in `src/lib/content/collections.ts`, documented in
  `src/lib/blog/README.md`; the lint fails a body whose headings start at
  `#` or jump a level, or whose FAQ section has no `###` questions with
  answers. `content/VOICE.md`'s prose and its fenced block are edited
  together: the block is what the lint reads.
- Image assets are wireframe placeholders written by
  `pnpm kit placeholder <out> <width> <height>` (OG 1200×630 JPEG,
  post hero and mid 1600×900 WebP, card 820×696, author 256, review 160,
  icons 64×64 SVG). They live under `public/images/<page>/` (one page's) or
  `public/images/ui/` (shared); the brand logo is `site.logo`. The three
  optimiser scripts (`scripts/README.md`) are for the real images a fork
  brings. Before moving or renaming an asset, grep `src` for every user — a
  missed one only shows in the capture.
- Everything under `src/` is bundled for the Worker by OpenNext's esbuild,
  even code that only runs at build time (rehype plugins, loaders): no native
  modules there (`sharp` breaks the bundle; `image-size` is the pure-JS
  alternative). `scripts/` is not bundled and may use `sharp`.
- An eager `<img>` in a **server** component becomes a preload hint in the
  page's RSC payload, and every other page executes it when it prefetches a
  link there (a blog index can end up downloading every post's hero).
  Above-the-fold images in server components use `EagerImage`; everything
  below the fold is `loading="lazy"` (post bodies get it, and their
  `width`/`height`, from `rehype-post-images`).
- A new page is `content/pages/<slug>.yaml` (from
  `content/_templates/page.yaml`; the sitemap follows), with its OG image at
  `public/images/<path-with-hyphens>-og.jpg` (`/sections/about` →
  `sections-about-og.jpg`), and it goes into `links`, `nav` and
  `footer.quickLinks` in `src/config/site.ts` together if it belongs there
  (they are separate lists). A new section type is a schema + a component +
  a registry entry.
- Verify = `pnpm lint` + `pnpm build` (which starts with the content lint
  and ends with the SEO audit) + `pnpm preview`, with `pnpm test` (the
  `node:test` suites, about a second) and `pnpm content:lint` when `content/`
  or `src/lib/content/` changed (`pnpm content:check` is the sub-second
  schema-only loop), and `pnpm test:pack` when `package.json`, `src/lib/`
  or the scripts changed. `pnpm lint` ignores `.claude/worktrees/`, where agent
  worktrees are checked out. No Prettier and no CI; match the existing style
  (double quotes, semicolons, trailing commas).
- Scripts and `node --test` load TypeScript under `src/` through
  `scripts/lib/load-ts.mjs` (Node strips the types; the hook resolves the
  aliases of the site's `tsconfig.json` — `@/`, and here the package's own
  name to `src/lib` — and extensionless imports, never inside
  `node_modules`, where Node refuses to strip types and the package ships
  JavaScript). Code that must stay loadable that way — everything
  `createKit()` reaches (`src/lib/content/`, `blog/posts.ts`, `seo/`,
  `site.ts`), `src/kit.ts` and `src/components/sections/schemas.ts` — uses
  `import type`, no `enum`, no parameter properties, no `.tsx` and nothing
  from React; `src/lib/index.ts` imports `blog/posts.ts`, not the blog
  barrel, for that reason.
- The package is `src/lib/` (`content/`, `blog/`, `seo/`, `forms/`, `ix/`,
  `components/`, `cx.ts`, `site.ts`, `index.ts` with `createKit`), compiled
  by `tsc -p tsconfig.build.json` to the gitignored `dist/` (ESM, `.d.ts`,
  ES2022; `prepare` runs it on install, so a git dependency builds itself
  where `pnpm-workspace.yaml` allows it). Its relative imports name their
  `.ts`/`.tsx` files (`rewriteRelativeImportExtensions` emits `.js`), it
  imports nothing from the site (the site's config, section union, block
  classes and element overrides come in through `createKit()` and
  `renderPostBody()`), and `next`, `react`, `react-dom`, `zod` and `motion`
  are peers so a site has one copy of each. The example imports it by name
  (`agentic-cms/content`, …) through the `paths` self-alias in
  `tsconfig.json`, so nothing in this checkout needs `dist/`; the scripts
  do the same. `pnpm test:pack` packs it and builds a scratch site from the
  tarball, which is the only build here that exercises `dist/` and
  `exports`: run it before a release. `dist/` is ignored by git and ESLint.

## Parity harness

- `pnpm kit visual-parity capture <label>` renders every prerendered
  page of the current build at eight widths and `compare <before> <after>`
  diffs them; `--scheme dark` renders the dark mode (a fresh browser context
  has no stored choice, so the default capture is light), `--states`
  photographs hover, focus, checked and open, `--motion` plays animations
  (only worth running where something animates). `--pages /,/blog` limits a
  capture — pass the same `--pages` to the compare. The page list comes from
  the build itself, so a new route is captured without touching the script.
- Static captures run with `prefers-reduced-motion`; `--motion` runs without
  it. A full set of the current site's routes takes minutes, not the tens of
  minutes a heavy design does, but still run long captures in the background
  with the log under `.parity/<label>.log` and read the tail.
- A capture reads `.next` and `public/`: never `pnpm build`, edit `public/`
  or move assets while one runs, and build the exact tree you will commit
  before capturing — an edit after the build, however trivial, means the
  capture is of a different tree.
- Baselines come from a build of the exact commit you compare against. When
  a served build stands in for a commit (`capture … --url`), print its
  `git log -1` first.
- Static and settled (2000 ms) frames never jitter — a difference there is
  real. Only mid-flight `--motion` frames can differ by timing jitter, which
  matters again once a fork puts the `ix/` library back to work: re-run such
  a frame once, and identical on the re-run means accepted.
- Commit each proven state before starting the next change. A working tree
  that mixes a proven change with an unproven one has to be split by hand
  before either can be committed.
- `.parity/` is gitignored and grows fast; delete old labels.
- A reference build for side-by-side checks is a worktree
  (`git worktree add ../<name> <sha>`) with its own
  `pnpm install --frozen-lockfile --prefer-offline` (a symlinked
  `node_modules` breaks Turbopack; `--offline` fails once the lockfile has
  changed) and its own `pnpm build`; one worktree per purpose, and remove
  them when done.

## Git and GitHub

- Merging a stack of PRs with `gh`: never `gh pr merge --delete-branch` on a
  PR that is the base of the next one — GitHub closes the dependent PR
  instead of retargeting it. Per PR: `gh pr merge N --merge`,
  `gh pr edit N+1 --base develop`, then `git push origin --delete <branch>`.
- One PR-sized job per session, ending at a committed, proven boundary; a
  session that spans several phases loses detail to context compaction.

## Architecture

- Logic and configuration stay decoupled. Anything a maintainer may want to
  change without touching component code — brand data, URLs, nav/footer lists,
  categories, authors, service endpoints — lives in `src/config/` or the
  `content/*.json` registries, never inline in components or `lib/`.
- Swappable services (a form backend, analytics, a content source) sit behind a
  TypeScript interface plus a factory in `src/lib/` that picks the implementation
  from config. Callers depend on the interface only.
- One implementation per shared UI element. The catalogue is
  `src/components/README.md` — read it before writing markup, build pages from
  it, and add every new shared component to it in the same commit. Shared
  pieces live in `src/components/ui/`, animations in `agentic-cms/ix`
  (start states in `src/styles/motion.css`). Never paste header, footer,
  button, container or title block markup into a page. Extract repeated
  markup into a component before its second use, driven by props or
  `src/config/`. Cards are the exception: every section's cards are its own
  design, so a section renders them from its own copy fields; do not build a
  generic Card.
- Four engines carry their full contract next to the code: `src/lib/blog/README.md`
  (posts, frontmatter, body conventions), `src/lib/content/README.md`
  (collections — posts, authors, categories, reviews, faqs, use cases, pages —
  schemas, validation, the generated field tables), `src/lib/forms/README.md` (forms as
  config, field primitives, backend factory) and `src/lib/seo/README.md`
  (page blocks, head and structured data, the build-time audit); the design
  system is `STANDARD.md`, the voice `content/VOICE.md`. `.claude/rules/`
  loads their invariants when those paths are edited; keep the READMEs,
  `STANDARD.md`, `VOICE.md`, the rules and the code in step.
- Refactors of existing pages change no pixels and prove it with
  `agentic-cms visual-parity` (see Styling and the harness section); one that
  also leaves the markup alone proves that with `agentic-cms parity`
  (before/after capture + `diff -r`).
- Single responsibility: one job per module, component and function. Keep
  functions under ~30 lines; split rather than nest.
- Prefer composition and dependency injection (pass collaborators as props or
  arguments) over inheritance and module-level singletons, so `lib/` modules can
  be lifted into other projects.
- Names must be self-documenting; comments explain why, not what.

## Process

- Plan first, edit second: for any non-trivial change, propose the plan and wait
  for explicit approval before editing. Typos and one-line tweaks need no plan.
- No big-bang refactors. Split into small, individually shippable steps; the app
  must build and run after each. Step one only isolates the target (extract /
  rename / move) with no behaviour change; functional changes come later.
- Match scope to the ask: bug fix ≠ refactor ≠ rewrite. Surface drive-by
  cleanups as separate suggestions instead of folding them in.

## Git workflow

- `develop` is the working branch: push day-to-day work there directly. `main` is
  stable and only receives PRs from `develop` (or a feature branch).
- Branch off `develop` as `feat/<slug>`, `bugfix/<slug>` or `refactor/<slug>`;
  open PRs against `develop` unless it is a release.
- Commit messages carry no AI attribution: no `Co-Authored-By: Claude …`, no
  `Claude-Session:`, no "Generated with…" footers.
