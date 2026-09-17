# Content engine

Turns the files under `content/` into typed, validated data at build time:
a **collection** is a definition (name, where its entries live, how they are
laid out, the zod schema every entry must satisfy), `readCollection()` reads
it, and a wrong file fails the build with a message that names the file, the
field and the problem. A site builds its registry once, in `src/kit.ts`
(`createKit({ site, sections })`, which calls `createCollections()` and
`createContent()` here), and reads it as `kit.collections` and
`kit.content`; nothing in this directory imports the site. This document is the contract; read it before
changing anything in `src/lib/content/` or adding a collection. The blog
engine (`src/lib/blog/README.md`) runs on top of it: `posts.ts` maps the
`posts` collection to `Post` objects and owns every derived field.

## Rules that must not break

1. **Build time only.** `read.ts` uses `node:fs`; every consumer is
   prerendered and the Cloudflare Worker has no filesystem. Never import
   `@/kit` or `content-engine-kit/content` from a `"use client"` module (Turbopack's
   client build fails on `node:fs`); a client component gets its entries as
   props from the server component or page that read them, and imports only
   types (`import type { Author } from "content-engine-kit/content"`).
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
| `collections.ts` | The standard contract: the schemas of `authors`, `categories`, `posts`, `reviews`, `faqs`, `useCases` and `pages` (`pageSeoSchema`, `jsonldSchema`, `pageSchema(sections)`); `createCollections({ sections })` builds the seven definitions around the site's section union; `SectionLike`, the least the engine knows about a section |
| `src/components/sections/schemas.ts` | The site's section types: one zod schema per type, copy fields only, `sectionSchema` as their discriminated union — what `createCollections()` takes |
| `index.ts` | The public surface, `content-engine-kit/content`: the above plus `createContent(collections)`, the typed accessors (`getAuthors()`, `getCategories()`, `getReviews()`, `getFaq()`, `getUseCases()`, `getPages()`, `getPage()`) a site reads as `kit.content` |
| `src/lib/index.ts`, `src/kit.ts` | `createKit({ site, sections, collections? })` composes the registry, the accessors, the post pipeline and the SEO for one site; `src/kit.ts` is where the site calls it, and the one module the app and the scripts import it from |
| `*.test.ts`, `test-helpers.ts` | `node:test` suite on mkdtemp fixtures (`withContent()`, `postTree()`), never touching `content/`; `src/lib/blog/posts.test.ts` covers the post pipeline the same way |
| `content-engine-kit check` (`scripts/content-check.mjs`) | `pnpm content:check [--root <dir>]`: reads every collection of the site's registry and reports like the SEO audit (the schema-only loop) |
| `content-engine-kit lint` (`scripts/content-lint.mjs`), `scripts/lib/content-lint.mjs`, `scripts/content-lint.test.mjs` | `pnpm content:lint`, first in `pnpm build`: the engine's lines first, then the rules a schema cannot carry (`content/VOICE.md`'s voice block, SEO limits at the source, post structure, images on disk, dates); the library and its `node:test` suite (`scripts/README.md`) |
| `content/VOICE.md` | The voice and claim rules, prose plus the fenced block the lint reads |
| `content-engine-kit docs` (`scripts/content-docs.mjs`) | Generates the field tables of the site's registry into the site's `content/README.md` from the schemas; `--check` (run by `pnpm build`) fails when they are stale |
| `content/README.md`, `content/_templates/` | The door for editing content, and one annotated template per collection |
| `scripts/lib/load-ts.mjs` | The Node loader every command and `pnpm test` use: the site's `tsconfig.json` aliases, extensionless imports, types stripped |

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
- `content-engine-kit parity` stores every prerendered HTML file, `_global-error` and
  `_not-found` included, while `check-seo` audits the public routes; the two
  counts differ by those internals and both are right.

## Collections

The seven standard collections, in the order the scripts read and document
them: `authors` (`content/authors.json`, a map), `categories`
(`content/categories.json`, a map), `posts` (`content/blog/*.md`), `reviews`
(`content/reviews.yaml`, a list), `faqs` (`content/faqs/*.yaml`), `useCases`
(`content/use-cases.yaml`, a list) and `pages` (`content/pages/*.yaml`, each
validated by the site's section union). Their schemas are `collections.ts`;
the field tables — every key, its type, whether it is required, and the
`.describe()` text — are generated from those schemas into the **site's
`content/README.md`** (its "Fields" section) by `content-engine-kit docs`,
one table per collection and one per section type of the site, and
`content-engine-kit docs --check` fails `pnpm build` when they are stale.

## Recipes

**Add a collection.** A site's own collection is declared in its
`src/kit.ts`: the schema (`z.strictObject` of the helpers, `.describe()` on
every field and on the object), then `defineCollection({ name, kind,
dir|file, format?, schema })`, returned from the `collections` option
(`createKit({ site, sections, collections: (standard) => ({ ...standard,
glossary }) })`), so the lint, the docs and the status see it; read it with
`readCollection(kit.collections.glossary)`. A collection every site should
have goes into `collections.ts` and `createContent()` instead. Put the files
under `content/`, an annotated template in `content/_templates/`, a row
in `content/README.md`. Run `pnpm content:docs` (the tables in
`content/README.md`) and `pnpm test`, `pnpm content:check`, `pnpm build`. A client
component gets the entries as props from the page or server component that
read them (a value import of `content-engine-kit/content` in a client module fails the
build: "Failed to write app endpoint … does not support external modules
(request: node:fs)").

**Add a field.** Add it to the schema with a helper and a `.describe()`;
map it where the collection is consumed (`toPost()` in `posts.ts` for
posts); mention it in the collection's template; run
`pnpm content:docs`.

**Reference another collection.** `field: ref("authors")` — a string that
must be one of the target's slugs; `optional(z.array(ref("posts")))` for a
list of them. A `ref()` to a name nobody defined, or to a `list`
collection, is a programmer error and throws a plain `Error`.

**Write a negative test.** `withContent({ "blog/x.md": "---\n…\n---\n" }, () =>
expectContentError(() => readCollection(kit.collections.posts), "content/blog/x.md: title is required"))`
— the fixture lives in a temp directory the process changes into, and the
working directory is restored afterwards; `postTree()` supplies the two registries a post needs.

**Check a content tree by hand.** `pnpm content:check --root /path/to/tree`
(the schemas), `pnpm content:lint --root /path/to/tree` (the schemas and
every lint rule).

## Verify

`pnpm lint && pnpm test && pnpm content:lint && pnpm build`; a change to
how anything renders is proven with `content-engine-kit parity` (markup) and
`content-engine-kit visual-parity` (pixels), as `CLAUDE.md` says.
