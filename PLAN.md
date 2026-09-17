# How the content engine was built

The record of the program, condensed. Eight phases turned a site whose copy
lived inside components into a content engine, an editorial plugin, this
kit, and the package a site installs. Everything below is in the past tense and is a fact about the code as
it stands; where this file and a contract document differ, the contract is
right:

- the engine: `src/lib/content/README.md`
- the door for editing content: `content/README.md`
- the voice and claim rules: `content/VOICE.md`
- pages, heads and structured data: `src/lib/seo/README.md`
- posts: `src/lib/blog/README.md`; forms: `src/lib/forms/README.md`
- the design system: `STANDARD.md`; the agent's procedures: `plugin/README.md`

## Context

The site this began as kept its blog posts in files with a hand-written
validator, and everything else in code: reviews, FAQs and use-case cards were
data arrays inside components, page copy and per-page SEO lived in the site
config and in one `page.tsx` per route. Changing a sentence meant opening a
component and proving pixels.

The goal was a site whose content is files with a validated contract, checked
at build time, prerendered, read never at request time — and an agent that can
work on it end to end. Decisions taken before Phase 1 and never reopened:
extend the existing engine rather than adopt a CMS; two new dependencies only
(`zod`, `yaml`); gray-matter keeps parsing frontmatter; YAML for structured
content, Markdown for prose; build-time validation only; `_`-prefixed files
ignored; every phase proven with `scripts/parity.sh` + `diff -r`,
`scripts/visual-parity.mjs` and a green `pnpm build`.

## Phase 1 — the collections engine

**Built.** `src/lib/content/`: `errors.ts` (`ContentError`, `ContentIssue`,
path formatting), `define.ts` (`defineCollection()`, the folder / list / map
kinds, `lookup()`, `contentRoot()`), `schema.ts` (the field vocabulary:
`text()`, `optional()`, `dateOnly()`, `isoTimestamp()`, `ref()`), `read.ts`
(`readCollection()`, `readEntry()`, `slugsOf()`, `sourceOf()`, the
production-only cache), `collections.ts` (the site's registry) and `index.ts`
(the `@/lib/content` surface). With it came `scripts/lib/load-ts.mjs`, a
~25-line `module.registerHooks` hook that lets plain Node run the TypeScript
under `src/` (types stripped, `@/` and extensionless imports resolved), and
`scripts/content-check.mjs`.

**Decisions.** A problem is a `ContentError` naming file, path and problem —
never a warning, never a silent default; messages are predicate-style
(`content/blog/x.md: title is required`) and locations are logical whatever
root the engine reads. Schemas are contracts, not derivations: no
`.default()`, every fallback lives with the consumer. References are declared
in the schema (`author: ref("authors")`) and checked at parse time against a
cheap slug listing, so a reference inside an array of union members still
reports the right path. One YAML dialect: gray-matter is given `yaml`'s parse
as its engine, so frontmatter and `.yaml` files are both YAML 1.2 and no
`Date` ever reaches a schema. `.describe()` is the last call of a field's
chain (a wrapper starts a new schema without it), which is what makes the
generated field tables possible. The registry `Map` is the engine's one
module-level singleton, because TypeScript cannot type a self-reference
inside a collection's own initializer.

**Set for the whole program.** `engines.node` `>=22.18` (what the loader
needs), `verbatimModuleSyntax: true` (so `next build` rejects the one
Node-loadability mistake tsc can see), and the rule that nothing in the
engine's import graph may use an `enum`, a parameter property, a namespace,
`.tsx` or React. A colocated `node:test` suite on `mkdtemp` fixtures covered
the kinds, the error catalogue and one negative case per rule of the post
contract; a shadow test deep-equalled the new validator's output with the old
one's for every real post, and was deleted in Phase 2 with the validator it
shadowed.

## Phase 2 — posts on the engine

**Built.** `src/lib/blog/posts.ts` reads through
`readCollection(collections.posts)`; the hand-written frontmatter validator
was deleted; every post-specific derivation (the excerpt fallback, the
thumbnail and OG chains, reading time, the `updatedAt` clamp, the sort) stayed
in `posts.ts`. The `related` existence check became
`optional(z.array(ref("posts")))`. Not one byte of prerendered HTML changed.

**Decisions.** `posts.ts` dropped its own module-level cache (the engine
caches in production; without a derived cache `next dev` sees edits on
reload). The content check moved in front of `next build` in the `build`
script, so a content error fails in a fraction of a second with the catalogue
line instead of at "Collecting page data". Three deliberate broken builds
recorded the exact failure output, which the engine README still quotes.

## Phase 3 — the collections marketing touches

**Built.** `reviews.yaml` (a list), `faqs/<key>.yaml` (a folder, one file per
page that shows a FAQ) and `use-cases.yaml` (a list) became collections with
their own schemas and accessors (`getReviews()`, `getFaq(slug)`,
`getUseCases()`). The components that had held those arrays now take them as
props; a client component imports only the type, because a value import of
`@/lib/content` from a `"use client"` module fails the build on `node:fs` —
provoked once on purpose and recorded in the README. `content/_templates/`
got one annotated template per collection, `content/README.md` became the
door for editing, and `scripts/content-docs.mjs` began generating the field
tables in `src/lib/content/README.md` from the schemas' `.describe()` texts,
with `--check` in the build so the docs cannot drift.

**Decisions.** Presentation stayed in code, keyed by position: portrait
sizes, icon widths and layout classes live in the component as index-keyed
arrays, while the collection carries only what a content owner edits. Each
move was its own commit, proven markup-identical before the next.

## Phase 4 — pages as files

**Built.** A page became `content/pages/<slug>.yaml`: its `seo` block (path,
title, description, OG image, `updated`, breadcrumb, change frequency,
priority), its `jsonld` block (the copy of its structured data, a small
discriminated union by page type) and its `sections` list, validated as a
discriminated union over the section registry. `src/app/[[...slug]]/page.tsx`
renders every page file — the head from `pageMetadata()`, the breadcrumb from
`pageBreadcrumb()`, the page-type block from `pageJsonLd()`, the body from
the registry. The per-route `page.tsx` files and the page blocks in the site
config were deleted; the sitemap and the feed read the page files. Section
schemas live in a zod-only module (`src/components/sections/schemas.ts`) and
the `{ schema, Component }` wiring in a separate `render.tsx`, so the schemas
stay Node-loadable. A `group` section type wraps children for the layouts
that need a wrapper.

**Decisions.** Only what a content owner edits moved into the page file —
eyebrows, headings, paragraphs, card titles and texts, stats, button labels,
image paths and alt texts — and never the numbers. Card counts are fixed in
the schema where a section's design depends on them. The structured-data
copy moved into the page file rather than staying in code. Migration went one
page at a time, each proven, with the home page last (a static `page.tsx`
beats a catch-all, so the route only became `[[...slug]]` at the end). The
build-time SEO audit (`scripts/check-seo.mjs`) grew into the contract it is
now, and the content root was spelled statically so Next's file tracer bundles
`content/` and nothing more.

## Phase 5 — the voice lint

**Built.** `content/VOICE.md`: who reads the site, how the brand is spelled,
what is never claimed, what only a reviewer can judge — and, as its last
section, a fenced YAML block between `voice-rules` markers carrying `brand`,
`banned` (each with a `why` and an `instead`), `patterns`, `claims`, `models`
and `clouds`. `scripts/lib/content-lint.mjs` and `scripts/content-lint.mjs`
(`pnpm content:lint`, first in `pnpm build`) print the engine's own lines
first, then one line per finding in the SEO audit's grammar,
`LEVEL file rule: path problem`: the voice rules, the SEO limits at the
source, alt-text pairs, the post body's structure, the images on disk, stray
files, the workshop file's shape and the dates. `scripts/content-status.mjs`
(`pnpm content:status`) prints what the content is right now, from the files.
`content/editorial/` got the calendar and the backlog. The skills that became
the plugin were written here first.

**Decisions.** Exact rules FAIL; the two heuristics (a claim word near a
regulation with the brand as the subject, a cloud named as what the stack runs
on) and the soft ranges WARN. A rule that today's copy breaks ships as WARN
until the copy is fixed, then is promoted. Every rule has a negative case in
`scripts/content-lint.test.mjs`. A content pass retired the warnings the first
run produced, and the exact rules were promoted to FAIL afterwards.

## Phase 6 — the `editorial` plugin

**Built.** `plugin/`: `.claude-plugin/plugin.json`, a README that is the
contract, seven skills (`write-post`, `new-post`, `update-post`, `new-page`,
`retire-content`, `review-voice`, `content-status`) and two read-only review
agents (`voice-reviewer`, `critic`). `write-post` runs in four gated stages —
outline, body written straight into `content/blog/<slug>.md` as a draft, the
two agents in parallel, then the SEO fields — and hands off to `new-post`.
The repo is its own marketplace (`.claude-plugin/marketplace.json`) and
`.claude/settings.json` enables the plugin in a trusted checkout.
`content/editorial/workshop.yaml` names, by role, a marketing workshop outside
the repo (`strategy`, `keywords`, `research`, `briefs`, `drafts`, `prompts`,
`glossary`, `history`); every skill works without one.

**Decisions.** The plugin is brand-neutral by rule: everything a brand owns is
read from the repo the agent is standing in, or from the workshop the repo
names, and a grep for the site's brand over `plugin/` returning nothing is a
test, not a hope. That forced engine hygiene: the SEO audit reads the origin
from the site config, the lint takes the brand and its optional mark from the
voice block and builds the miscased spellings from the name, the templates
carry the site's conventions (image names, the closing call to action) so a
neutral skill can read them there, and `content/_templates/VOICE.md` became
the blank a new site copies. The licence is MIT.

**Proven.** Each skill was run once on a throwaway branch, the two agents on
real drafts, and the whole thing again in a worktree configured for a second,
invented brand — the build, the lint and the audit clean in both. Two things
the runs taught: a marketplace name is registered once per user at the first
checkout's path (a fork renames the marketplace), and a headless session needs
`pnpm` on its PATH and the tools the skills run in its allow-list, which is
why the project settings allow `Bash(pnpm content:*)`.

## Phase 7 — the kit

**Built.** This fork: `content-engine-kit` in the package, the Worker and the
marketplace; a fictional brand, Acme, whose site is the kit describing itself;
and a **wireframe** in place of a design. Four semantic colours, each a
`light-dark()` pair (`paper`, `ink`, `fill`, `muted`), a system font stack,
a type scale, one container width and one section rhythm — no radius, shadow,
blur, gradient, transition or animation utilities exist. `color-scheme` on
`:root` with a `data-theme` override carries the theme; `ui/ThemeToggle`
cycles system → light → dark and an inline script in the layout applies the
stored choice before the first paint. Every section renders inside
`ui/Section`, a bordered box showing its YAML type as a visible tag; former
illustrations are `ui/Placeholder` crossed boxes; content images are
placeholder files from the new `scripts/placeholder.mjs`. `next/font` is gone,
so the build fetches nothing. The landing page carries nine section types and
the nav reaches the rest by anchor; four `/sections/*` pages are the kitchen
sink — every section type the landing page leaves out, one demo page per
family, with slot copy — and three posts describe the post pipeline, pages as
files and the voice file. The parity harness was generalised: its page list
comes from the build, its interaction labels from the site config, and
`--scheme light|dark` renders either mode.

**Unchanged on purpose.** The content engine, the blog engine, the SEO
contract, the form engine, the lint and the `editorial` plugin: this phase
changed the design and the example content, not the machinery. The
`src/components/ix/` library, `src/styles/motion.css` and the `motion`
dependency stay for a fork that adds reveals, and the image optimisers stay
for a fork that brings real assets.

**Proven.** `pnpm test`, `pnpm content:lint` (0 failures, 0 warnings),
`pnpm build` (the content lint, the generated docs check, the prerender and
the SEO audit) and `pnpm preview` at every commit, with visual captures in
both schemes across the phase's design changes.

## Phase 8 — the package

**Built.** The kit is a package a site installs, and still the template it
was. `src/lib/` is the package's source — `content/`, `blog/`, `seo/`,
`forms/`, `ix/` (the reveal library, moved from `src/components/ix/`),
`components/` (`JsonLd`, `EagerImage`, `FaqAccordion`, moved next to the
engines), `cx.ts`, `site.ts` and `index.ts` — compiled by `tsc` to `dist/`
(ESM and `.d.ts`, ES2022, `"use client"` kept) on `prepare`, published by
`exports` as `content-engine-kit`, `./content`, `./blog`, `./seo`,
`./forms`, `./ix`, `./components`, `./cx`; `next`, `react`, `react-dom`,
`zod` and `motion` are peers. Nothing in `src/lib` imports the site any
more: `createCollections({ sections })` builds the seven standard
collections around the site's section union, `createContent()`,
`createBlog()` and `createSeo()` take what they need, and `createKit({ site,
sections, collections? })` composes them once in the site's `src/kit.ts`,
the one file the app, the scripts and the tests read (`kit.collections`,
`kit.content`, `kit.blog`, `kit.seo`, `kit.urls`, `kit.site`).
`renderPostBody(post, { components, blocks })` takes the site's element
overrides and block classes; the sitemap, the feed, robots and a post's
BlogPosting and FAQPage are `kit.seo` functions, so a route file is one
line. The scripts are a command line, `content-engine-kit` (`bin/`), one
command per script, each run against the site in the current directory:
`lint`, `check`, `status`, `docs` (the field tables, now generated into the
site's `content/README.md`), `seo`, `placeholder`, `optimize-webp`,
`optimize-svg-rasters`, `parity` (the shell script ported) and
`visual-parity` (its state pages from the page files); the lint takes the
registry and the site it is given. The plugin's contract names the door's
"Fields" section and the engine's docs under `node_modules/` on a site.

**Decisions.** The repo stays flat: the example around the package imports it
by name through a tsconfig `paths` self-alias, and the Node loader reads the
site's tsconfig paths the same way, so a checkout never needs `dist/` and
`git clone && pnpm install && pnpm dev` still holds. The package ships
compiled JavaScript because Node refuses to strip types under
`node_modules`, and its relative imports name their `.ts` files
(`rewriteRelativeImportExtensions`) so one source serves tsc, Turbopack
and Node. A git dependency builds on install only where the consumer's
`pnpm-workspace.yaml` allows it (`allowBuilds`); not published to npm.
`tools/pack-smoke.mjs` (`pnpm test:pack`) is the one proof that exercises
`dist/` and `exports`: it packs the kit and builds a scratch site from the
tarball; it found the site-side `mdx/types` import a consumer could not
resolve, which the blog barrel now re-exports.

**Proven.** Every code commit markup-identical to `main` (`parity`:
HTML, JSON-LD, sitemap, feed) and the eight interaction states identical;
the example's pixels in both schemes identical at the end but for the two
posts a content commit edited (one line each, `updatedAt` set) and the
FAQ-open state of one of them, which moved with that line; `pnpm lint`,
`pnpm test` (71), `pnpm content:lint` (0/0), `pnpm build` (0/0), `pnpm
test:pack` (the scratch site built from the tarball, its markup
byte-identical to `main`'s), `pnpm preview`. Released as `0.2.0`.

## Verification recipe

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # the build starts with the content lint and ends with the SEO audit, 0 failures
scripts/parity.sh <label>-before    # on the previous commit (worktree or before editing) — then, after the change:
scripts/parity.sh <label>-after && diff -r .parity/<label>-before .parity/<label>-after && echo identical
# pixels, when a page renders differently by construction: a worktree of the previous commit, its own
# pnpm install --frozen-lockfile --prefer-offline && pnpm build, served on another port, then
git -C ../<worktree> log -1 --oneline        # print what the served baseline is before capturing from it
node scripts/visual-parity.mjs capture <label>-before --url http://127.0.0.1:<port> --pages <pages>
node scripts/visual-parity.mjs capture <label>-after --pages <pages>
node scripts/visual-parity.mjs compare <label>-before <label>-after          # add --scheme dark for the dark mode
pnpm preview            # the real Worker on 0.0.0.0:8000 — look at the pages, in both themes; stop it
```
