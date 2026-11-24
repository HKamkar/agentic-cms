# A schema for every content file

A content file is checked when `pnpm content:check` or the build runs. To
see a wrong key or a missing field before that, as it is typed, every
collection also has a JSON Schema: `agentic-cms schema` writes one per
collection into `content/_schemas/`, from the same zod schemas the build
validates with, and each YAML content file names its schema on its first
line, which an editor reads.

## What is written

- **One file per collection,** `content/_schemas/<collection>.json` in
  kebab case: `authors.json`, `categories.json`, `posts.json`,
  `reviews.json`, `faqs.json`, `use-cases.json`, `pages.json`, and one for
  each collection the site adds through `createKit({ collections })`. The
  folder starts with `_`, so the engine never reads it as content.
- **The file as it is held:** a folder's file is one entry (a page, an FAQ
  set; a post's frontmatter), a list file (`reviews.yaml`) a list of
  entries, a map file (`authors.json`) an object of entries by slug.
- **The input a file may hold** (`z.toJSONSchema` with `io: "input"`,
  JSON Schema draft-07, which every YAML language server reads):
  - a field's `.describe()` is its `description`, which an editor shows on
    hover;
  - a field `optional()` makes takes `null` as well as no key;
  - a strict object refuses a key it does not name, so a typo shows at
    once;
  - a `dateOnly()` field is a string with its `YYYY-MM-DD` pattern, an
    `isoTimestamp()` one a string;
  - a `ref("authors")` field is a string whose description gains a line, "A
    slug of content/authors.json". No slug is listed: adding an author
    changes no schema, and `pnpm content:check` still checks every ref;
  - a page's `sections` is a list of one definition, `section`, whose
    `oneOf` has a member per section type, keyed by its `type` constant.
- **What a schema cannot say,** the build still holds: a ref that names
  no entry, an excerpt or an SEO description (one of the two), a text
  that is only spaces, every rule of the content lint.

## How an editor finds a file's schema

Each YAML content file, and each template under `content/_templates/`,
opens with the line the YAML language server reads:

```yaml
# yaml-language-server: $schema=../_schemas/pages.json
```

The path is relative to the file: `./_schemas/reviews.json` from
`content/reviews.yaml`, `../_schemas/pages.json` from
`content/pages/home.yaml` and from the page template, so a page copied
from the template keeps a line that still points the right way. In VS Code
the YAML extension (Red Hat's) reads it; any editor with
`yaml-language-server` does. `.vscode/` stays the person's own: the kit
writes no editor settings.

A post's frontmatter and the JSON registries (`authors.json`,
`categories.json`) have no such line: frontmatter has no editor hook, and a
`$schema` key in a map file would read as an entry. Their schemas are there
for agents, and for an editor the person points at them.

`agentic-cms schema --lines` adds the line to each YAML content file and
template that lacks it (a file written by hand, a site laid out before
0.9.0), and leaves the rest as they are.

## Never stale

- **`agentic-cms schema --check`** exits 1 when a file under
  `content/_schemas/` is missing, differs from what the code writes, or
  names a collection there is none of.
- **`agentic-cms docs --check`**, which `pnpm build` runs, runs it too: a
  schema change and its files land in the same commit.
- **After changing a schema,** `pnpm content:docs` writes both the field
  tables in `content/README.md` and the schemas (`agentic-cms schema`
  writes the schemas alone). Commit them with the change. Never edit a file
  under `content/_schemas/` by hand.

## For an agent

Before writing or editing a content file, read its schema (the path on its
first line, or `content/_schemas/<collection>.json`): the keys it may hold,
which are required, what each says. Then write the file, and run
`pnpm content:check` after, which checks what no schema can (the refs, the
cross-field rules). The editorial skills do this in that order.

## The command

`agentic-cms schema [--check] [--lines]`, in the site's root; the flags
and exit codes are [commands.md § schema](commands.md#schema).
