# Content engine

Turns the files under `content/` into typed, validated data at build time:
a **collection** is a definition (name, where its entries live, how they are
laid out, the zod schema every entry must satisfy), `readCollection()` reads
it, and a wrong file fails the build with a message that names the file, the
field and the problem. This document is the contract; read it before
changing anything in `src/lib/content/` or adding a collection. The blog
engine (`src/lib/blog/README.md`) runs on top of it: `posts.ts` maps the
`posts` collection to `Post` objects and owns every derived field.

## Rules that must not break

1. **Build time only.** `read.ts` uses `node:fs`; every consumer is
   prerendered and the Cloudflare Worker has no filesystem. Never import
   `@/lib/content` from a `"use client"` module (Turbopack's client build
   fails on `node:fs`); a client component gets its entries as props from
   the server component or page that read them, and imports only types
   (`import type { Author } from "@/lib/content"`).
2. **A problem is a `ContentError`**, never a warning and never a silent
   default: it names the file, the field path and the problem, one line per
   issue. A consumer never catches it.
3. **Schemas are contracts, not derivations.** A schema says what a file may
   contain (`.strictObject`, every field with `.describe()`); fallbacks,
   defaults and computed fields live with the consumer (`posts.ts` derives
   `excerpt ?? seoDescription`, the `updatedAt` clamp, reading time).
4. **One YAML dialect.** Markdown frontmatter is parsed by gray-matter with
   the `yaml` package as its engine, `.yaml` files by `yaml` itself: both are
   YAML 1.2, so an unquoted date or `yes` stays a string. Quote dates
   anyway; write booleans as `true` / `false`.
5. **Files starting with `_` are ignored**; the file name (or the key of a
   map file, or the index of a list file) is the slug.
6. **Node-loadable.** `pnpm test` and `pnpm content:check` run this module
   under plain Node (types stripped, `scripts/lib/load-ts.mjs` resolving the
   imports), so nothing in its import graph may use an `enum`, a parameter
   property, a namespace, a `.tsx` file or React; type-only imports say
   `import type` (`verbatimModuleSyntax` makes `next build` reject the
   alternative). The page section schemas (`src/components/sections/schemas.ts`)
   are in that graph and follow the same rule; the components they belong
   to are wired apart, in `src/components/sections/render.tsx`.

## Files

| File | Role |
|---|---|
| `define.ts` | `CollectionDef` (folder / list / map), `Entry`, `MarkdownEntry`, `EntryOf<D>`; `defineCollection()` (registers by name), `lookup()`, `contentRoot()` (`<cwd>/content`, spelled statically so Next's file tracer bundles only it) |
| `schema.ts` | The field vocabulary: `text()`, `optional()`, `dateOnly()`, `isoTimestamp()`, `ref()` — each with its own error wording |
| `read.ts` | `readCollection()`, `readEntry()`, `slugsOf()`, `sourceOf()`: listing, parsing (gray-matter + yaml, yaml, JSON), validation, the production-only cache |
| `errors.ts` | `ContentError`, `ContentIssue`, `formatPath()` |
| `collections.ts` | The site's registry: the schemas and definitions of `authors`, `categories`, `posts`, `reviews`, `faqs`, `useCases` and `pages` (`pageSeoSchema`, `jsonldSchema`, `pageSchema`); `collections` |
| `src/components/sections/schemas.ts` | The section types a page file may list: one zod schema per type, copy fields only, `sectionSchema` as their discriminated union |
| `index.ts` | The public surface, `@/lib/content`: the above plus `getAuthors()`, `getCategories()` |
| `*.test.ts`, `test-helpers.ts` | `node:test` suite on mkdtemp fixtures (`withContent()`, `postTree()`), never touching `content/`; `src/lib/blog/posts.test.ts` covers the post pipeline the same way |
| `scripts/content-check.mjs` | `pnpm content:check [--root <dir>]`: reads every collection and reports like the SEO audit (the schema-only loop) |
| `scripts/content-lint.mjs`, `scripts/lib/content-lint.mjs`, `scripts/content-lint.test.mjs` | `pnpm content:lint`, first in `pnpm build`: the engine's lines first, then the rules a schema cannot carry (`content/VOICE.md`'s voice block, SEO limits at the source, post structure, images on disk, dates); the library and its `node:test` suite (`scripts/README.md`) |
| `content/VOICE.md` | The voice and claim rules, prose plus the fenced block the lint reads |
| `scripts/content-docs.mjs` | Generates the "Collections" tables below from the schemas; `--check` (run by `pnpm build`) fails when they are stale |
| `content/README.md`, `content/_templates/` | The door for editing content, and one annotated template per collection |
| `scripts/lib/load-ts.mjs` | The Node loader both scripts and `pnpm test` use |

## Kinds

| `kind` | Definition | Entries | Slug | `file` in messages |
|---|---|---|---|---|
| `folder` | `dir`, `format: "markdown" \| "yaml" \| "json"` | one per file under `content/<dir>` with the format's extension (`.md`/`.mdx`, `.yaml`/`.yml`, `.json`); `_` names, subdirectories and other extensions ignored; sorted by name; two files with one stem is an error | the file stem | `content/<dir>/<name>` |
| `list` | `file` (`.yaml`/`.yml`/`.json`) | the items of the top-level sequence | the index as text (`"0"`) | `content/<file>` |
| `map` | `file` | the values of the top-level object | the key | `content/<file>` |

`readCollection(def)` returns `Entry<T>[]` — `{ slug, file, data }` — and for
`format: "markdown"` a `MarkdownEntry<T>` with `body` (gray-matter's content,
byte for byte) and `format: "md" | "mdx"`. `readEntry(def, slug)` throws
when the slug does not exist. Locations in messages are logical
(`content/blog/x.md`) whatever directory the engine runs in; tests and
`content-check --root` read another tree by changing the current directory.

**Cache.** Entries are cached per definition only when
`NODE_ENV === "production"` (each `next build` worker reads once). In
`next dev` every call re-reads, so an edited file shows on reload; the
files are small and it costs milliseconds.

## Declaring fields

Every field is one of the helpers, or a zod schema whose `error` wording is
spelled out (`z.array(text(), { error: "must be a list of strings" })`,
`z.boolean({ error: "must be true or false" })`); zod's default messages
must never reach a build log, and a test asserts they do not.

| Helper | Accepts | Fails with |
|---|---|---|
| `text()` | a non-empty string, returned untrimmed | `is required` (missing or null), `must be a non-empty string` |
| `optional(schema)` | the schema, or null / absent → `undefined` | the schema's own messages |
| `dateOnly()` | `"YYYY-MM-DD"` as text, a real calendar day | `is required (YYYY-MM-DD)`, `"x" must be a valid YYYY-MM-DD` |
| `isoTimestamp()` | anything `Date` parses, normalised to `toISOString()` | `"x" must be an ISO timestamp` |
| `ref("name")` | a slug of that collection (a folder's file stems, drafts included, or a map's keys; self-reference allowed) | `"x" is not in content/<source> (a, b, …)`, plus `text()`'s |

`.describe()` goes on the outermost schema of a field, after `optional()`
or `z.array()`: a wrapper starts a new schema without the description
(`.refine()`, `.check()` and `.meta()` keep it). Write descriptions as
documentation — what the field is and where it shows, one constraint or
derived default as a fact, no "optional"/"required" (the field tables
derive that). The object itself carries a `.describe()` too.

## Errors

`ContentError` has `file`, `path`, `problem` and `issues` (every issue of
that file); its message is one line per issue, `<file>: <path> <problem>`
(`<file>: <problem>` when the path is empty). Paths read `title`,
`related[1]`, `[2].quote` (list entries), `acme-editorial.name` (map entries),
`items[0].question`. The first bad file throws; a build fixes one file at a
time, `pnpm content:check` shows every collection's first bad file at once.

```
content/blog/x.md: title is required
content/blog/x.md: excerpt is required (or seoDescription as a fallback)
content/blog/x.md: seoTitle must be a non-empty string
content/blog/x.md: keywords must be a list of strings          content/blog/x.md: keywords[1] must be a string
content/blog/x.md: draft must be true or false
content/blog/x.md: date is required (YYYY-MM-DD)                content/blog/x.md: date "2026-13-40" must be a valid YYYY-MM-DD
content/blog/x.md: publishedAt "nope" must be an ISO timestamp
content/blog/x.md: author "nobody" is not in content/authors.json (acme-editorial)
content/blog/x.md: related[1] "y" is not in content/blog (how-a-post-is-built, …)
content/blog/x.md: unknown key(s) foo; allowed: title, excerpt, date, category, author, image, …, draft
content/blog/x.md: frontmatter must be a mapping                content/blog/x.md: invalid frontmatter: <parser message>
content/blog: duplicate slug "x" (x.md, x.mdx)                  content/blog: no such directory
content/authors.json: acme-editorial.name is required           content/authors.json: acme-editorial unknown key(s) twitter; allowed: name, title, bio, image, imageAlt
content/authors.json: must be a mapping of entries keyed by slug   content/reviews.yaml: must be a list of entries
content/x.yaml: is empty                                        content/faqs: no entry "genera" (general)
```

Unknown keys list the allowed ones at an entry's top level only. The
object-level refine (`excerpt` or `seoDescription`) is skipped while any
field issue is present; an unknown-key issue alone does not hide it.

A bad list item is reported at its index (`keywords[1] must be a string`),
not as the whole list. Two edges to know: `draft: yes` is a string under
YAML 1.2 and fails, and `2026-02-30` passes `dateOnly()` because
`Date.parse` rolls it over — `content-lint`'s `date-rollover` rule is what
fails that one.

## What each proof proves

- `pnpm test` (`node:test`, ~0.6 s) executes the engine under Node: the
  kinds, the error catalogue, one case per rule of the post contract, and
  the post pipeline on the real posts (`src/lib/blog/posts.test.ts`).
- `pnpm content:check` reads the real `content/` exactly as a build would,
  and `pnpm build` runs it first, so a bad file fails in a fraction of a
  second with the catalogue line. Left to `next build` alone, the same
  error surfaces at "Collecting page data" as
  `Error [ContentError]: content/blog/x.md: author "nobody" is not in …`
  followed by `> Build error occurred` and
  `Failed to collect page data for /blog-post/[slug]`, exit 1.
- `pnpm build` type-checks this directory and its tests (tsconfig includes
  `**/*.ts`). The engine is bundled into the Worker like gray-matter, dead
  at request time (every route is prerendered and served from the
  static-assets cache); the Worker's file trace still lists the files under
  `content/`, because the content root is spelled statically and Next's
  tracer follows it — that folder and nothing more.
- `scripts/parity.sh` stores every prerendered HTML file, `_global-error` and
  `_not-found` included, while `check-seo` audits the public routes; the two
  counts differ by those internals and both are right.

## Collections

<!-- content-docs:start -->

<!-- generated by scripts/content-docs.mjs from the schemas in collections.ts; do not edit by hand -->

### `authors` — `content/authors.json`

An author of posts; the key of content/authors.json is the slug a post's `author` names (one file holding a map, the key is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | text | yes | Shown in the byline, the author card and as the JSON-LD author |
| `title` | text | no | Role line under the name on the author card |
| `bio` | text | no | One or two sentences on the author card |
| `image` | text | no | Portrait under public/images/authors/ |
| `imageAlt` | text | no | What the portrait shows |

### `categories` — `content/categories.json`

A post category; the key of content/categories.json is the slug a post's `category` names (one file holding a map, the key is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | text | yes | The label shown as the post's eyebrow and articleSection |

### `posts` — `content/blog`

A post's frontmatter: content/blog/<slug>.md, where the filename is the URL /blog-post/<slug> (a folder of markdown files, one entry per file, the file name is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `title` | text | yes | The H1 and card title, the `<title>` unless seoTitle is set, and the JSON-LD headline |
| `excerpt` | text | no | Card text, meta description fallback, RSS and JSON-LD description; 30–40 reader-focused words; required unless seoDescription is set |
| `date` | YYYY-MM-DD | yes | The editorial date readers see, YYYY-MM-DD (quote it); the primary sort key, newest first |
| `category` | key of `content/categories.json` | yes | The eyebrow label and articleSection, also the related-post fallback |
| `author` | key of `content/authors.json` | yes | The byline, the author card and the JSON-LD author |
| `image` | text | no | Hero image on the post page and the JSON-LD image, under public/images/blog/`<slug>`/ |
| `imageAlt` | text | no | What the hero image shows, in a sentence |
| `thumbnail` | text | no | Card image (820×696); defaults to image |
| `thumbnailAlt` | text | no | What the card image shows |
| `ogImage` | text | no | Open Graph / Twitter image, about 1.91:1 and at least 1200 px wide; defaults to image, then thumbnail |
| `seoTitle` | text | no | The exact `<title>` and og:title, 60 characters or fewer; defaults to the title followed by " \| " and the site's name |
| `seoDescription` | text | no | Meta description, 70–160 characters; defaults to excerpt |
| `keywords` | list of text | no | `<meta keywords>` and the JSON-LD keywords |
| `related` | list of key of `content/blog` | no | Slugs shown first under "Read next", topped up by same category, then newest; every slug must exist, drafts included |
| `source` | text | no | Provenance note, e.g. the URL an imported post came from |
| `publishedAt` | ISO timestamp | no | ISO timestamp for JSON-LD datePublished, the RSS pubDate and the sitemap; set once when the post first goes live |
| `updatedAt` | ISO timestamp | no | ISO timestamp for JSON-LD dateModified; add it only after editing a published post (a value before publishedAt is clamped by posts.ts) |
| `draft` | true / false | no | true keeps the post out of production builds; pnpm dev still renders it |

### `reviews` — `content/reviews.yaml`

A client review on the home page slider, in slide order (one file holding a list, one entry per item).

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | text | yes | The reviewer, shown under the quote |
| `role` | text | yes | Their role, shown in brackets after the name |
| `quote` | text | yes | The quote as it reads on the slide, with its own quotation marks |
| `photo` | text | yes | Portrait under public/images/home/ (about 80×80) |
| `photoAlt` | text | no | What the portrait shows; leave it out while the portrait is decorative |

### `faqs` — `content/faqs`

A FAQ set: one file per page that shows one, the file name is the key the page reads it by (a folder of yaml files, one entry per file, the file name is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `items` | list of entries | yes | The questions in order; each opens to its answer |
| `items[].question` | text | yes | The question, shown as the item's heading |
| `items[].answer` | text | yes | The answer, one paragraph, shown when the item opens |

### `useCases` — `content/use-cases.yaml`

A use-case card on the Use cases page, in order; the same list is the page's ItemList structured data (one file holding a list, one entry per item).

| Key | Type | Required | Description |
|---|---|---|---|
| `sector` | text | yes | The tag above the title (Life sciences, Finance and banking, …) |
| `title` | text | yes | The card title |
| `text` | text | yes | The paragraph under the rule |
| `icon` | text | yes | Illustration under public/images/use-cases/ |

### `pages` — `content/pages`

A page: content/pages/<slug>.yaml — its SEO block, its structured data, and its sections in order (seo.path is the route; the file name is only the key) (a folder of yaml files, one entry per file, the file name is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `seo` | entries | yes | The SEO block: the `<title>`, meta description, canonical, Open Graph image, sitemap entry and breadcrumb name |
| `seo.path` | text | yes | The route: / for the home page, else /lowercase-words; indexed once published, never changed without a redirect |
| `seo.title` | text | yes | The exact `<title>` and og:title: the topic first, the brand last, 60 characters or fewer, unique across pages |
| `seo.description` | text | yes | The meta description: the page's promise in one sentence, 70–160 characters |
| `seo.ogImage` | text | yes | The social image, a 1200×630 JPEG under public/images/, e.g. /images/home-og.jpg |
| `seo.updated` | YYYY-MM-DD | yes | The date the content last changed, YYYY-MM-DD (quote it); the sitemap's lastmod — bump it with the copy, not on refactors |
| `seo.breadcrumb` | text | yes | The page's name in the breadcrumb trail and its structured data |
| `seo.changeFrequency` | one of always, hourly, daily, weekly, monthly, yearly, never | no | The sitemap's changefreq hint |
| `seo.priority` | number | no | The sitemap's priority hint, 0–1 |
| `jsonld` | one of the section types below | yes | The page's structured data: the copy of its JSON-LD block by page type |
| `sections` | list of one of the section types below | yes | The sections in order, each a `type` and its copy |

The section types (25); every section has `type` plus the fields below:

#### `home-hero`

The home hero: eyebrow, H1, paragraph, the button and the hero illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `home-automation`

Two cards and the button beside an illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
#### `home-about`

A statement and three stat cards

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `statement` | text | yes | The statement paragraph the section leads with, set in heading type |
| `cards` | list of entries | yes |  |
| `cards[].title` | text | yes | The card title |
| `cards[].stat` | text | yes | The big figure |
| `cards[].text` | text | yes | The line under the figure |
#### `home-service`

A feature split: the dashboard card on the left, the copy, one feature and the button to the contact page on the right

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `feature` | entries | yes |  |
| `feature.title` | text | yes | The feature title under the icon |
| `feature.text` | text | yes | The feature text |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
| `dashboard` | entries | yes |  |
| `dashboard.title` | text | yes | The dashboard card's title |
| `dashboard.text` | text | yes | The dashboard card's line |
| `dashboard.image` | text | yes | The dashboard screenshot, under public/images/`<page>`/ |
| `dashboard.imageAlt` | text | yes | What the the dashboard screenshot shows, in a sentence (it is informative, not decorative) |
#### `home-feature`

Five feature cards, the copy and a tall screenshot beside them

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
| `monitoring` | entries | yes |  |
| `monitoring.image` | text | yes | The monitoring screenshot, under public/images/`<page>`/ |
| `monitoring.imageAlt` | text | yes | What the the monitoring screenshot shows, in a sentence (it is informative, not decorative) |
#### `home-choose-us`

Three points beside a demo card and a stats image

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `items` | list of entries | yes |  |
| `items[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `items[].title` | text | yes | The item's title |
| `items[].text` | text | yes | The item's text |
| `demo` | entries | yes |  |
| `demo.title` | text | yes | The demo card's title |
| `demo.image` | text | yes | The demo screenshot, under public/images/`<page>`/ |
| `demo.imageAlt` | text | yes | What the the demo screenshot shows, in a sentence (it is informative, not decorative) |
| `stats` | entries | yes |  |
| `stats.image` | text | yes | The stats card, under public/images/`<page>`/ |
| `stats.imageAlt` | text | yes | What the the stats card shows, in a sentence (it is informative, not decorative) |
#### `home-integration`

The heading over an integration diagram (the diagram is the design's)

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
#### `reviews`

The heading over the reviews; the reviews are content/reviews.yaml

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
#### `about-hero`

The About hero: eyebrow, H1, paragraph and three illustration cards (the cards are the design's)

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
#### `about-story`

A statement and five cards: two picture cards with captions, two stat cards and the modality card

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `statement` | text | yes | The statement paragraph the section leads with, set in heading type |
| `founded` | text | yes | The caption of the first picture card |
| `sovereignty` | entries | yes | The first stat card |
| `sovereignty.title` | text | yes | The first stat card: the line above the number |
| `sovereignty.value` | text | yes | The first stat card: the big number or figure |
| `sovereignty.text` | text | yes | The first stat card: the line under the number |
| `compliance` | entries | yes | The second stat card |
| `compliance.title` | text | yes | The second stat card: the line above the number |
| `compliance.value` | text | yes | The second stat card: the big number or figure |
| `compliance.text` | text | yes | The second stat card: the line under the number |
| `partners` | text | yes | The caption of the second picture card |
| `modalities` | entries | yes | The modality card: heading, illustration, figure and line |
| `modalities.heading` | text | yes | The modality card's heading |
| `modalities.stat` | text | yes | The modality card's big figure |
| `modalities.text` | text | yes | The line under the figure |
#### `about-strategy`

An illustration on one side; the copy, four beliefs and the button on the other

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `beliefsHeading` | text | yes | The heading over the list of beliefs |
| `beliefs` | list of text | yes | The four beliefs |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `about-benefits`

Three benefit cards

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
#### `about-choose-us`

Copy, two cards and the button on one side; an illustration on the other

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `faq`

A FAQ section: eyebrow, heading and the accordion of a FAQ set; the page's FAQPage structured data reads the same set

| Key | Type | Required | Description |
|---|---|---|---|
| `set` | key of `content/faqs` | yes | The FAQ set to show: the file name in content/faqs/ |
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `variant` | one of about, contact | yes | The design variant, about or contact; the wireframe draws both the same and prints the name |
#### `use-cases-hero`

The Use cases hero: eyebrow, H1, paragraph and the button

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `use-cases-vision`

A statement and four stat cards

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `statement` | text | yes | The statement paragraph the section leads with, set in heading type |
| `cards` | list of entries | yes |  |
| `cards[].stat` | text | yes | The big figure |
| `cards[].text` | text | yes | The line under the figure |
#### `use-cases-choose-us`

Three points beside an illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `points` | list of entries | yes |  |
| `points[].title` | text | yes | The point's title |
| `points[].text` | text | yes | The point's text |
#### `use-case-cards`

The heading over the use-case cards; the cards are content/use-cases.yaml

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
#### `use-cases-benefits`

Two benefits on each side of an illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `left` | list of entries | yes | The two benefits left of the dashboard |
| `left[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `left[].text` | text | yes | The benefit, one line |
| `right` | list of entries | yes | The two benefits right of the dashboard |
| `right[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `right[].text` | text | yes | The benefit, one line |
#### `use-cases-strategy`

Two cards and the button beside an illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `cards` | list of entries | yes |  |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `contact-hero`

The Contact hero: eyebrow, H1, paragraph and the button

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `contact-form`

The contact form; its fields and messages are the form definition

| Key | Type | Required | Description |
|---|---|---|---|
| `form` | text | yes | The form to render, a key of src/config/forms.ts |
#### `contact-details`

Three contact cards, each with an icon, a title, its text and a highlighted line

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | list of text | yes | The card text, one paragraph per line (a line break between lines) |
| `cards[].highlight` | one of the kinds below | yes | The highlighted line under the rule: plain text, or an e-mail address as a link |
#### `blog-index`

The blog index: the hero and the grid of every published post, newest first

| Key | Type | Required | Description |
|---|---|---|---|
| `label` | text | yes | The hero's label |
| `heading` | text | yes | The hero's H1 |
| `listEyebrow` | text | yes | The eyebrow over the post grid |
| `listHeading` | text | yes | The heading over the post grid |
| `cta` | text | yes | The button label beside the heading (the button is the current page) |
#### `group`

A wrapper around several sections, for a design that decorates a run of them together

| Key | Type | Required | Description |
|---|---|---|---|
| `variant` | one of use-cases-upper, use-cases-lower | yes | Which of the design's two wrappers; the wireframe draws both as a dashed box that names the variant |
| `sections` | list of one of the section types below | yes | The sections inside the wrapper, in order |

<!-- content-docs:end -->

## Recipes

**Add a collection.** In `collections.ts`: the schema (`z.strictObject` of
the helpers, `.describe()` on every field and on the object), then
`defineCollection({ name, kind, dir|file, format?, schema })`, and add it
to `collections`. In `index.ts`: a typed accessor (`getX()`). Put the files
under `content/`, an annotated template in `content/_templates/`, a row
in `content/README.md`. Run `node scripts/content-docs.mjs` (the tables
below) and `pnpm test`, `pnpm content:check`, `pnpm build`. A client
component gets the entries as props from the page or server component that
read them (a value import of `@/lib/content` in a client module fails the
build: "Failed to write app endpoint … does not support external modules
(request: node:fs)").

**Add a field.** Add it to the schema with a helper and a `.describe()`;
map it where the collection is consumed (`toPost()` in `posts.ts` for
posts); mention it in the collection's template; run
`node scripts/content-docs.mjs`.

**Reference another collection.** `field: ref("authors")` — a string that
must be one of the target's slugs; `optional(z.array(ref("posts")))` for a
list of them. A `ref()` to a name nobody defined, or to a `list`
collection, is a programmer error and throws a plain `Error`.

**Write a negative test.** `withContent({ "blog/x.md": "---\n…\n---\n" }, () =>
expectContentError(() => readCollection(collections.posts), "content/blog/x.md: title is required"))`
— the fixture lives in a temp directory the process changes into, and the
working directory is restored afterwards; `postTree()` supplies the two registries a post needs.

**Check a content tree by hand.** `pnpm content:check --root /path/to/tree`
(the schemas), `pnpm content:lint --root /path/to/tree` (the schemas and
every lint rule).

## Verify

`pnpm lint && pnpm test && pnpm content:lint && pnpm build`; a change to
how anything renders is proven with `scripts/parity.sh` (markup) and
`scripts/visual-parity.mjs` (pixels), as `CLAUDE.md` says.
