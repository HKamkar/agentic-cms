# What a site can rely on

What stays the same between two versions of the kit, what may change in
any release, and how a change is announced. Read it before an upgrade;
[upgrading.md](upgrading.md) has each release's steps.

Every part of the kit is marked **stable** or **experimental**: each
export, each command and each file format a site writes, in
[§ Part by part](#part-by-part) below, and each row of the map,
[parts.md](parts.md), in its Stability column.

## Stable

A stable part keeps its name, its options and its behaviour until a major
version. Before 1.0.0, a minor may change one, but only with a migration
`agentic-cms upgrade` runs or a manual step [upgrading.md](upgrading.md)
writes down, never silently. What that covers:

- **An export:** its specifier (`agentic-cms/content`), the names it
  exports, their options and their types.
- **A command:** its name and subcommands, its flags and their defaults,
  its positionals, its exit codes and the shape of its `--json` output, as
  [commands.md](commands.md) lists them (written from the specs the parser
  reads, so the two cannot drift).
- **A file format:** what a file of the site's holds and how the kit reads
  it — the content files, `src/config/harness.ts`,
  `src/config/components.json`, the agent-file manifest.
- **The gates:** what `pnpm lint` and `pnpm build` run in a site. A check
  that fails what passed before is a change too: it comes in a minor, with
  the baseline or the migration that keeps a site green
  ([migrating-to-0.8.2.md](migrating-to-0.8.2.md) is how 0.8.2 did it).

## Experimental

An experimental part may change in any release: its options, its output,
its name. The changelog says what changed, and nothing else holds it.
Today that is the lab, `agentic-cms/lab` and `agentic-cms lab`; the
languages of a site, `agentic-cms/locales` with `kit.locales`,
`kit.content.in()` and `kit.blog.in()`, `site.locales` and where a
translation sits ([locales.md](locales.md)); and the
preview of a pull request, `agentic-cms pr-preview`, which rests on two
things the kit does not own: OpenNext passing `--preview-alias` through to
`wrangler versions upload`, and the file wrangler writes the preview's URL
to ([preview.md](preview.md)).

## What no version promises

These change in any release, patches included, and none is a break:

- **The wireframe's markup and classes.** `init` copies the example's code
  into a new site once and never rewrites it, so a site's own components
  stay as they are; a new site gets the current ones.
- **A report's wording:** the text a command prints. A `--json` shape is
  the contract, never the text.
- **The kit's example:** its content, its pages, its pictures.
- **The text of the kit's rules, skills and guides.** It changes with each
  release and reaches a site with the pin: the skills and the guides are
  read from the installed package, and `init --agent-files` rewrites the
  kit's block of each thin rule. What a site's rule must keep is the lines
  the kit marks required
  ([init.md § What an edit keeps](init.md#what-an-edit-keeps)).
- **What a capture writes** under `.parity/`: a release may ask for new
  baselines, and its changelog says **recapture baselines**.
- **The code behind a command:** a site runs `agentic-cms <command>`, never
  a file of the package's `scripts/`.
- **Anything marked experimental.**

## How a change is announced

- **The changelog,** `CHANGELOG.md`: a section per version, each change a
  line, a break said as one.
- **A deprecation warning, for one minor.** A deprecated part keeps working
  and warns once per process, naming what replaces it (`deprecated()`,
  `src/lib/deprecated.ts`); a deprecated flag says so in its `--help`. It
  goes in the next breaking release.
- **A migration or a manual step.** `agentic-cms upgrade` runs each
  release's mechanical steps and prints the rest, each with its section of
  [upgrading.md](upgrading.md) ([upgrade.md](upgrade.md)).

## The policy

- Before 1.0.0, a minor may break a stable part, but only with an
  `upgrade` migration or a written manual step.
- A patch never breaks anything.
- From 1.0.0 on, semver: a stable part breaks only in a major.
- A deprecated part warns for one minor and goes in the next breaking
  release.

## Support

- **Fixes** go into the latest release, as a patch of it
  ([SECURITY.md](../SECURITY.md#supported-versions)); an older minor gets
  none, so a site takes a fix by moving to the latest release.
- **Node:** the floor is `engines` in `package.json` (`>=22.18`). CI runs
  the version in `.nvmrc`, the current LTS line, and the unit suites and a
  site's build on the floor too.
- **Peers:** a site installs its own copy of each, within the range the
  package names, bounded to the major CI runs ([§ Peers](#peers)). A new
  major is supported by a release of the kit, whose changelog says so.

## Part by part

The marks, which [parts.md](parts.md) repeats row by row. A new export,
command or file format lands with its row here; a test fails the page
without it.

### Exports

| Export | Mark | What it is |
|---|---|---|
| `agentic-cms` | stable | `createKit()`, `isPreview()` and the site's types — [parts.md § The content engine](parts.md#the-content-engine) |
| `agentic-cms/content` | stable | collections, schemas, the schema helpers |
| `agentic-cms/blog` | stable | the post pipeline |
| `agentic-cms/seo` | stable | the head and the structured data |
| `agentic-cms/forms` | stable | the form engine's fields and backends |
| `agentic-cms/forms/server` | stable | the form endpoint's handler and sinks |
| `agentic-cms/consent` | stable | the consent record and its hooks — [parts.md § Browser libraries](parts.md#browser-libraries) |
| `agentic-cms/consent/google` | stable | the Google tag's adapter |
| `agentic-cms/locales` | experimental | a site's languages: `createLocales()`, a collection's translation — [locales.md](locales.md) |
| `agentic-cms/email` | stable | the address token |
| `agentic-cms/ix` | stable | the motion library |
| `agentic-cms/components` | stable | the components that carry no look |
| `agentic-cms/cx` | stable | `cx()`, `variants()` |
| `agentic-cms/lab` | experimental | the lab's scenes, studies and timeline — [parts.md § Design tools](parts.md#design-tools) |
| `agentic-cms/loader` | stable | TypeScript under `src/` in a script — [parts.md § The site's commands](parts.md#the-sites-commands) |
| `agentic-cms/eslint` | stable | `componentRules()`, the preset |
| `agentic-cms/package.json` | stable | the installed version |

### Commands

Each command's flags, defaults and exit codes are in
[commands.md](commands.md).

| Commands | Mark |
|---|---|
| the command line itself: `agentic-cms --help`, `agentic-cms --version` | stable |
| the content engine: `agentic-cms lint`, `agentic-cms check`, `agentic-cms status`, `agentic-cms docs`, `agentic-cms schema` | stable |
| the images: `agentic-cms placeholder`, `agentic-cms optimize-webp`, `agentic-cms optimize-svg-rasters` | stable |
| the proofs: `agentic-cms visual-parity`, `agentic-cms parity` | stable |
| looks and measures: `agentic-cms shot`, `agentic-cms probe`, `agentic-cms sheet` | stable |
| the icons: `agentic-cms icons` | stable |
| the design round: `agentic-cms demo` | stable |
| the lab: `agentic-cms lab` | experimental |
| the site: `agentic-cms init`, `agentic-cms upgrade`, `agentic-cms setup`, `agentic-cms urls`, `agentic-cms serve` | stable |
| the default gates: `agentic-cms check-components`, `agentic-cms check-site`, `agentic-cms seo`, `agentic-cms guard-email` | stable |
| the opt-in steps: `agentic-cms critical-css`, `agentic-cms assemble` | stable |
| the opt-in CI step: `agentic-cms pr-preview` | experimental |

### Peers

What a site installs beside the package, each in one major. The `peers`
workflow builds, lints and tests a site laid out from the tarball at both
ends of every range: each peer at its floor, on the Node floor, and each at
the newest version within its range, on `.nvmrc`'s Node. It runs on a pull
request that changes `package.json`, on `main` and weekly. A site on a
version outside a range gets pnpm's unmet-peer warning and runs on a
version the kit has not tested ([migrating-to-0.9.0.md § The peers'
ranges](migrating-to-0.9.0.md#the-peers-ranges)).

| Peer | Range | What needs it |
|---|---|---|
| `next` | `^16.3.6` | the pages, the post pipeline, the head |
| `react` | `^19.2.0` | the components, the post body |
| `react-dom` | `^19.2.0` | the components |
| `zod` | `^4.6.2` | the content schemas: the collections, a page's blocks, a site's own collection |
| `motion` | `^13.2.0` | `agentic-cms/ix` |
| `eslint` | `^9.22.0`, optional | `agentic-cms/eslint` and `check-site`; the site's `eslint.config.mjs` imports `eslint/config`, which 9.22 added |
| `playwright-core` | `^1.63.0`, optional | the commands that open a page: the screenshot harness, `shot`, `probe`, `sheet`, `icons audit`, the lab |
| Node (`engines`) | `>=22.18` | every command; CI runs the floor and `.nvmrc` |

### File formats

| File | Mark | Read by |
|---|---|---|
| the content files: `content/pages/`, `content/blog/`, the collections (`content/redirects.yaml` among them since 0.9.0), `content/VOICE.md`'s fenced block, `content/editorial/workshop.yaml` | stable | the content engine and the content lint — `src/lib/content/README.md` |
| `content/_schemas/`, the JSON Schemas, and the first line of each YAML content file and template that names its schema (`# yaml-language-server: $schema=…`) | stable | an editor's YAML language server; `agentic-cms schema --check`, in `docs --check` — [schema.md](schema.md) |
| `src/config/site.ts`, `src/config/forms.ts` | stable | `createKit()`, the form engine |
| `site.locales` in `src/config/site.ts`, and a translation's place: `content/<folder>/<prefix>/`, `content/<stem>.<prefix>.<ext>` | experimental | `createKit()`, the content engine — [locales.md](locales.md) |
| `src/config/harness.ts`, the site's profile and its seed | stable | the screenshot harness — [visual-parity.md](visual-parity.md#the-sites-profile) |
| `src/config/components.json` | stable | the ESLint preset and `check-site` — [primitives.md](primitives.md) |
| `.agentic-cms.json`, the agent-file manifest (its `format` 2 since 0.9.0) | stable | `init --agent-files` alone, which writes it — [init.md § After a kit upgrade](init.md#after-a-kit-upgrade) |
| the kit's block in a site's thin rule, a Codex stub | stable | `init --agent-files`, which rewrites them; the site's own lines go outside the block |
| `.claude/settings.json`'s keys the kit holds | stable | `init --agent-files --check` — [init.md § What an edit keeps](init.md#what-an-edit-keeps) |
