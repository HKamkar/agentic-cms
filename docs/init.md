# Starting a site: `agentic-cms init`

Two ways to start. **Fork** this repo when you want the example around you
and replace it piece by piece; or **install** the package and let it lay a
site of its own out — the example's code with a starter of the site's name
in place of the example's content — in one line:

```bash
pnpm dlx --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v0.8.4 init my-site --name "My Site"
cd my-site && bash scripts/setup.sh && pnpm kit serve
```

`pnpm dlx` installs the kit in a temporary place and runs its `init`, which
lays the site out in `my-site/` (`.` for the folder you are in) under the
name `--name` gives, as it is spelled. A new site needs it: without it
`init` exits 2 and writes nothing, and the folder's name is never taken for
the site's. `--url` and `--email` give its address
([§ The starter](#the-starter)). The kit is
a git dependency: it builds its `dist/` as it installs (`prepare`), which
pnpm runs only for a package its build approvals name by that exact key — a
bare `--allow-build=agentic-cms` does not match a git-hosted package. `init`
writes the same key into the site's `pnpm-workspace.yaml`, with `sharp` and
`unrs-resolver` (`eslint-config-next`'s resolver), so the site's own install
needs nothing more. Nothing is written by hand first: no `pnpm init`, no
workspace.

Into a project that already has a `package.json`, `pnpm add` takes the same
approval and records it in the workspace:

```bash
pnpm add --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v0.8.4
pnpm exec agentic-cms init . --name "My Site"
```

From a checkout of the kit, `pnpm kit init ../my-site --name "My Site"` does
the same.

## What it writes

- **The example's code**: `src/app/`, `src/components/`, `src/config/`,
  `src/styles/`, `src/kit.ts` (the one place the engine is composed),
  `STANDARD.md` (the wireframe's standard, with a note that the `design`
  skill replaces it as the look lands). Its `src/config/harness.ts`
  holds the site's profile — the widths a capture takes (390, 768, 1440 and
  1920), the schemes a proof runs a pass in (light and dark), the ref a
  proof's baseline is built from ([visual-parity.md](visual-parity.md#the-sites-profile)),
  and its `src/config/components.json` is the component guard's config:
  the layers, the content engine's route folders and the named exceptions
  outside it, each with its reason, the frozen `inherited` list
  ([primitives.md § Placed](primitives.md#placed-agentic-cms-check-components)).
- **The starter**, in place of the example's content and pictures
  ([§ The starter](#the-starter)): `content/` (one home page and the blog
  index, their copy marked as placeholder; the collections empty; the
  voice file with the site's name; the templates, the editorial plan and
  the door, `content/README.md`), `public/images/` (the wireframe's neutral
  placeholders and a logo placeholder with the site's name), and
  `src/config/site.ts` and `src/config/forms.ts` written for the site.
- **The agent files**: `AGENTS.md` (a site's rules, the engines rule
  first, and a table from a task to the kit's guide for it; `CLAUDE.md`
  includes it), `.claude/rules/` (path-scoped invariants for the content
  engine and its layers — pages, the post pipeline, SEO — the form engine,
  styling, design and the components, each thin: its `paths`, then the
  kit's block, with the rule's title, the lines the kit marks required —
  its part, its tier and the check that holds it among them — and a
  pointer to the kit's whole rule in the package,
  `node_modules/agentic-cms/templates/site/rules/<rule>.md`;
  `AGENTS.md`'s scoped-rules table routes Codex to them; the components
  rule is written only beside the guard's config, which the example
  brings), `.agents/skills/` (a stub per design skill for Codex: its name
  and description, and the package's `SKILL.md` to read),
  `.claude/settings.json` (the package's marketplace,
  `./node_modules/agentic-cms`, with its `editorial` and `design` plugins
  enabled, so Claude Code reads the kit's skills at the version the site
  pins; `.claude/skills/` is left for the site's own), and
  `.agentic-cms.json`, the manifest of what the kit wrote
  ([§ After a kit upgrade](#after-a-kit-upgrade)).
- **The config**: `package.json` (the scripts a build needs, the gates in
  its `lint` and `build` ([§ The gates](#the-gates)), and the dependencies
  at the kit's versions; merged into an existing one, whose name, scripts
  and dependencies win, but for `pnpm init`'s placeholders — its failing
  `test` gives way to the kit's and its `main: "index.js"` is dropped,
  while its `license`, `version`, `devEngines` and `packageManager` stay —
  and for the gates, which go into its own `lint` and `build`), `tsconfig.json`, `pnpm-workspace.yaml` (merged
  into an existing one: the `allowBuilds` keys it lacks are added, the
  names of a legacy `onlyBuiltDependencies` list, which pnpm no longer
  reads, are carried into it, and every other key, value and comment stays
  as the site wrote it), `next.config.ts`, `postcss.config.mjs`,
  `eslint.config.mjs` (`eslint-config-next` and the component rules,
  `agentic-cms/eslint`: [primitives.md § Enforced](primitives.md#enforced-agentic-cmseslint)),
  `.gitignore`, `.env.example`, `.nvmrc`, `README.md`, `PLAN.md`.
- **CI**: `.github/workflows/verify.yml`, on every pull request and every
  push to `develop` or `main`: `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm test`, `pnpm build` (with `AGENTIC_CMS_PLACEHOLDERS=warn`: this run
  deploys nothing, so the starter's placeholders warn here and a new site is
  green before its copy is written) and
  `agentic-cms init . --agent-files --check`,
  with pnpm from `packageManager` (Node 25 and later ship no corepack), Node
  from `.nvmrc`, the checkout's whole history (`fetch-depth: 0`: the site
  check lists the exceptions a pull request adds against its base branch),
  and every action pinned to a commit: the commits the kit's own CI runs at
  that release. `.github/dependabot.yml` keeps those pins current: the
  GitHub Actions alone, one grouped pull request a month to the default
  branch (no `target-branch`: a site may have no `develop`); the site's npm
  packages follow the kit's releases instead ([upgrading.md](upgrading.md)).
  `init` writes both files once and keeps them as the site has them, so a
  later release's pins reach a site through Dependabot or by hand, from
  `node_modules/agentic-cms/templates/site/verify.yml`
  ([upgrading.md](upgrading.md) says when they moved), and a site from
  before 0.8.2 copies `node_modules/agentic-cms/templates/site/dependabot.yml`
  to `.github/dependabot.yml` to have its pins proposed too.
- **The setup script**: `scripts/setup.sh`, which a clone runs first on any
  machine: Node checked, pnpm at the `packageManager` version, the install,
  then `agentic-cms setup` (the browsers, `.env.local` and this machine's
  origins, the lint and the tests, the URLs; [setup.md](setup.md)). The
  package scripts include `urls` (`agentic-cms urls`), and none is named
  `setup`: `pnpm setup` is pnpm's own command.

Nothing of the package's source, nothing of the example's content, and
nothing about a host (Cloudflare, Azure, a VPS are a site's decision,
written into its `PLAN.md`). An existing file is never overwritten unless
`--force`; each file prints `created`, `updated` or `kept`. A site's own is
never overwritten, `--force` included: its `content/` and `public/`,
`src/config/site.ts` and `src/config/forms.ts`. The starter's content and
pictures go only into a folder with no `content/` yet, a new site, which
needs its name: `init` on an existing site, `--agent-files` or not, asks
none, writes none of the site's own files and never deletes or rewrites its
content. `package.json` and `pnpm-workspace.yaml` are merged, with `--force`
too, and print `merged` with what changed.

## The gates

What every change passes is in the site's own `package.json`, so an agent
that runs the build runs the lint too:

```json
"lint": "eslint; s=$?; agentic-cms check-site || s=1; exit $s",
"build": "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email"
```

- **The lint** runs ESLint with the component rules, then the site check
  (`check-site`: the component guard's passes, the design rounds, the
  exceptions added since the merge base, these gates and CI, and the site's
  own tools as warnings — [primitives.md § The whole site](primitives.md#the-whole-site-agentic-cms-check-site)),
  failing on either while both report. A warning never fails it.
- **The build** runs the lint first, then the content lint for production
  (a placeholder fails it), the field tables' check, `next build` and the
  SEO audit, and last `agentic-cms guard-email`, which fails a build that
  lets the site's address into a served file as text: the gate of a site
  whose `src/config/site.ts` turns `guardEmail` on, as the starter's does
  ([email.md](email.md)). Each is a step of the `&&` chain, so the first
  that fails stops the build. A site without the key (one laid out before
  0.8.2) is asked for no guard, and `init` adds none to its `build`
  ([migrating-to-0.8.2.md § 5](migrating-to-0.8.2.md#5-the-e-mail-key)
  turns it on).

Into an existing `package.json`, `init` merges the gates and keeps the
site's own steps where they are, printing what went in (a site from 0.8.1:
`merged package.json (lint: check-site in place of check-components;
build: pnpm lint added; --production on its content lint)`):

- a site with no `lint` or `build` takes the kit's;
- a `lint` that runs `agentic-cms check-components` (the kit's before
  0.8.2) runs `check-site` in its place; one that runs ESLint alone keeps
  its command, the check after it;
- a `build` with a `next build` step takes each gate it lacks in its place:
  the lint first of all, the content lint and the docs check right ahead
  of `next build`, the audit and the guard after it. A content lint it
  runs already without `--production` (0.8.1's `agentic-cms lint`) takes
  the flag where it is, so the build runs it once.

A script the gates cannot go into is refused: a `lint` that runs no ESLint
or ends in its own `exit`, a `build` with no `next build` step in its `&&`
chain or a gate on the wrong side of it, or either turning a failure into
a pass (`|| true`, `exit 0`). `init` then exits 2 before writing anything,
naming the script and what to make it; the gates are never dropped
silently. `check-site`'s `scripts` pass holds them from then on.

## The starter

A new site starts from its own name, never from the example's brand:

```bash
pnpm exec agentic-cms init my-site --name "My Site" --url https://my-site.com --email hello@my-site.com
```

- **The name** (`--name`, required for a new site, as it is spelled; never
  taken from the folder's name) goes where the example says its own:
  `site.ts`'s `name` and `shortName`, the starter's copy,
  `content/VOICE.md`'s brand (the prose, `brand.name` and the claim and
  stack expressions), the logo placeholder's text, title and file name
  (`public/images/brand/<slug>-logo.svg`, which `site.logo` names).
- **The address** (`--url`, the origin; `--email`) goes into `site.ts` and
  the home page's contact card. Without them it stands on a domain reserved
  for examples, `https://<slug>.example` and `hello@<slug>.example`, and so
  do the navbar's sign-in link and the footer's one profile, until the site
  has its own. `site.ts` has `guardEmail: true`: the address reaches the
  browser only as a token — the footer's link, the contact card, the
  form's message and recipient — no structured data carries it as text, no
  client component imports `site.ts`, and the build's last step,
  `guard-email`, proves it ([email.md](email.md)). It watches the domain of
  `--url`; an address on another domain is named to it with `--domain` in
  the build's `guard-email` step. An address public on purpose is
  `guardEmail: { off: "<why>" }`, which `check-site` lists with its
  reason.
- **The content**: one home page (`content/pages/home.yaml`: the hero, the
  service split, the five feature cards, the statement and its figures, the
  contact form and the contact cards — sections the wireframe renders) and
  the blog index (`content/pages/blog.yaml`), each string of their copy
  starting with the marker `(placeholder)` and saying what goes there; the
  collections empty (`authors.json` and `categories.json` `{}`,
  `reviews.yaml` and `use-cases.yaml` `[]`, `content/faqs/` with a note and
  no set, `content/blog/` with its template and no post), and each read and
  built as it is: the blog index, the feed and the sitemap with no post;
  `content/_templates/` for everything else. None of the example's posts,
  reviews, use cases, FAQs, author, catalogue pages or pictures: whoever
  wants to read the example reads it in the kit's repository.
- **The pictures**: under `public/images/`, only the wireframe's neutral
  placeholders (the home page's two, its icon, the pull-quote glyph and the
  two OG images, written by `pnpm kit placeholder`) and the logo placeholder.
- **The standard**: `STANDARD.md`'s passages on the example's own pages
  (its page table, its catalogue in the footer, its nav's anchors) are
  marked `<!-- example:start -->` … `<!-- example:end -->` in the kit, with
  `<!-- starter: … -->` for what a new site reads in their place, as the
  dark-mode passages are marked; a marker `init` cannot find stops it
  before any file is written, naming the file — a kit bug to report.

`pnpm content:lint` names every placeholder by file and field — a string
carrying the marker in a content file or in `src/config/` (by line there),
and an address on a reserved domain (`.example`, `.test`, `.invalid`,
`localhost`, example.com) — as a `placeholder` WARN while the site is
written. A production build fails on them: the site's `pnpm build` runs
`agentic-cms lint --production` before `next build`, so every build that
deploys (`pnpm run deploy` and `pnpm upload` build through `pnpm build`,
and `agentic-cms assemble` refuses to package while one remains) stops
there, naming each. The one exception is the site's own CI, which deploys
nothing: its build step sets `AGENTIC_CMS_PLACEHOLDERS=warn`, so a new site
is green before its copy is written. Replace them with the site's own:
`/editorial:new-page` writes a page's copy, or edit by hand; the marker
goes with each string it replaces.

The kit example's brand fails in a site at any time: `Acme` as a word,
`acme.example`, and the example's author `acme-editorial`, in any file
under `content/` and `src/config/`, in an SVG's text and in a picture's
name under `public/` (`example-brand`). The kit's own repository, where the
example is the example, is told by its package name and exempt. A fork is
the kit's repository until it renames the package; from then on it is a
site, and the example's brand fails its lint and `check-site` lists what
else is left of the example (`leftovers`), which `check-site --baseline`
holds while each is replaced
([migrating-to-0.8.2.md § 3](migrating-to-0.8.2.md#3-the-examples-leftovers)).

## A site without dark mode

`--light-only` at the end of the install line above — or, in a project that
already has the kit,

```bash
pnpm exec agentic-cms init my-site --name "My Site" --light-only
```

— lays the same site out with one scheme, light:

- the profile says `schemes: ["light"]`, so no proof and no lab ground is in
  a scheme the site does not have;
- `src/app/globals.css` holds each colour as a single value (the light
  side of each `light-dark()` pair), and `src/styles/base.css` says
  `:root { color-scheme: light; }`;
- `src/app/layout.tsx` has no theme script and no
  `suppressHydrationWarning` on `<html>`, and its viewport says
  `colorScheme: "light"`;
- there is no `ThemeToggle`, in the navbar or anywhere else, and no
  `themeToggle` labels in `src/config/site.ts`'s `chrome`;
- `STANDARD.md` and `src/components/README.md` lose their dark-mode
  passages, which the kit marks `<!-- dark-mode:start -->` …
  `<!-- dark-mode:end -->` (with `<!-- light-only: … -->` for the text a
  light-only site reads in their place).

The code edits anchor on the theme's own names, not on the lines around
them; one that finds nothing to change stops `init` (exit 2) before any
file is written, naming the file — a kit bug to report. The rules and skills
are the same for every site: they speak of "each scheme the profile names".
A site already laid out goes light-only by hand, as
[migrating-to-0.8.0.md § 3.4](migrating-to-0.8.0.md#34-light-only) says.

## Then

`bash scripts/setup.sh` first ([setup.md](setup.md)): the install, the
browsers, `.env.local`, the checks, and the URLs `pnpm dev` answers on.
Then `pnpm kit serve`: the dev server (and the lab, once it has a scene),
every URL to hand over in one table ([dev-server.md](dev-server.md)).

1. The copy first: `content/VOICE.md` (the starter's carries the site's
   name and the generic rules the lint enforces; write its sections for
   the site), then the home page and the blog index, from the owner or
   `/editorial:new-page`, and `src/config/site.ts` (the tagline, the
   address, the URL, the nav, the footer, the calls to action; data only).
   `pnpm content:lint` lists what is still placeholder; `content/README.md`
   is the door.
2. `src/app/globals.css`: the tokens — or start the `design` skill, which
   begins there and designs around the site's real copy, never the
   starter's placeholders.
3. More pages and posts: `/editorial:new-page`, `/editorial:new-post`, the
   templates in `content/_templates/`.
4. Where the contact form delivers: it ships on `mailto`; the endpoint
   sends it to a webhook or a provider of your choosing
   ([forms.md](forms.md)).
5. Analytics, if the site measures visits: `GOOGLE_TAG_ID` where the
   production build runs switches on the Google tag behind a consent banner
   (`src/config/analytics.ts`, the banner the site's to design;
   [consent.md](consent.md)).
6. `pnpm content:lint` until clean, no placeholder left, `pnpm build`,
   then the host of your choice (a Node server: [deploy.md](deploy.md)).

## After a kit upgrade

`agentic-cms upgrade`, run from the new release, does what follows and the
release's own steps ([upgrade.md](upgrade.md)). By hand:

```bash
pnpm add agentic-cms@github:HKamkar/agentic-cms#v<next>
pnpm exec agentic-cms init . --agent-files          # the kit's lines in; the site's own kept; nothing to merge
pnpm exec agentic-cms init . --agent-files --check  # what drifted, for CI (exit 1 on drift)
```

Nothing of the kit's is copied for a site to merge. The skills are the
kit's plugins, read from the installed package, so they change with the
pin. A rule is thin: the refresh rewrites the kit's block — between
`<!-- agentic-cms:start … -->` and `<!-- agentic-cms:end -->` — and
keeps the rest: the site's own lines, which go after the block, and the
rule's `paths` once the site has changed them (paths it never touched
follow the kit's). A Codex stub is never the site's, and is rewritten
whatever it holds. In `.claude/settings.json` the refresh sets the kit's
keys — the marketplace and the two plugins it enables — and leaves every
other key as the site has it.

`--check` reports each: `ok` (the kit's text), `modified` (the site's own
lines or paths beside a current block: passes), `stale` (the kit's block,
a stub or the kit's settings keys behind the kit, or a rule's scope
changed since `AGENTS.md`'s table), `missing`, `modified, required gone`
([§ What an edit keeps](#what-an-edit-keeps)), `unreadable` (settings
that are not JSON) and `legacy` (below), and exits 1 on any but `ok` and
`modified`. The CI workflow `init` writes runs it on every pull request.
`--diff` and `--accept`, 0.8's hand merge, are deprecated: they say so and
do nothing, and go in the next breaking release.

`.agentic-cms.json` records what the kit wrote: its `format` (2), the
kit's `version`, each rule's paths as the kit last wrote them (by hash),
the stubs (a skill the kit drops loses its stub) and the settings keys (a
key the kit drops leaves the site's settings). Commit it.

**A site laid out before 0.9.0** holds the kit's copies: the rules whole,
the design skills in both trees, the manifest's bases and
`.agentic-cms/base/`. `--check` calls each `legacy`, and the refresh
moves them, once:

- a skill copy the site never touched (a text some release of the kit
  shipped, which the package's record, `scripts/lib/agent-file-releases.json`,
  and the old manifest know) goes;
- one the site edited becomes its own, `<name>-site`, its frontmatter
  renamed and a note at its top saying where the kit's is now; the refresh
  lists each, to keep or delete;
- each rule becomes thin, with the lines no release of the kit had kept
  after the kit's block, and its `paths` when they were the site's own;
- `.agentic-cms/base/` goes, and the settings take the kit's keys.

`AGENTS.md` and `CLAUDE.md` are the site's own, and the move leaves them:
the text the 0.8 templates copied into them is the site's to replace with
the current template's ([upgrading.md](upgrading.md)).

A rule for a tool the site has not
adopted is neither written nor checked: the components rule needs the
component guard's config, `src/config/components.json`, so a site that
predates the guard is never told the rule is missing
([migrating-to-0.8.0.md § 3.7](migrating-to-0.8.0.md#37-the-component-library-enforced)
adopts it). `AGENTS.md` is the site's
own, but for one block between `<!-- rules-table:start -->` and
`<!-- rules-table:end -->`: the scoped-rules table, written from the rules'
`paths` frontmatter — the site's edited rules included — because Codex reads
`AGENTS.md` and nothing under `.claude/`, so without the table it never sees
the rules. `--agent-files` writes that block alone (before the first `##`
section when there is none; move it anywhere, it is found by its markers),
and `--check` reports it `stale` when a rule's scope changed since, and
`AGENTS.md` `too big` when it passes the 32 KiB Codex reads by default:
move procedures into linked docs.

### What an edit keeps

A rule marks what no site edits away with `<!-- required -->` at the end
of a list item's or a paragraph's last line: the engines, each rule's tier
line (its part, its tier and the check that holds it), and the pointer to
the kit's whole rule. Inside the kit's block the refresh puts them back
itself. A site that takes the block's marks away makes the rule wholly its
own, and the refresh leaves it as it is; then each required block's words
must stay, in their order: re-wrapped, re-indented, without the marker, in
another case, under a list marker of its own (`*` for `-`, a number) or
with the site's own words before or after them, the block is kept. Its
words reworded, broken up or put in another order, it is gone: `--check`
reports `modified, required gone` and exits 1, naming the block, its line
in the kit's file and the file
(`node_modules/agentic-cms/templates/site/rules/<rule>.md`), so it goes
back in as the kit has it; the refresh keeps the edit and says the same
(`kept, required gone`); `--force` takes the kit's thin rule whole. The
kit's skills are no site's to edit: a site that wants its own version of
one writes it under a name of its own in `.claude/skills/`.

`.claude/settings.json` is the site's own, but for the kit's keys: each
marketplace the kit's template names (`extraKnownMarketplaces["agentic-cms"]`,
the package's folder) and each plugin it enables
(`enabledPlugins["editorial@agentic-cms"]`, `enabledPlugins["design@agentic-cms"]`).
The site's permissions, hooks and other plugins pass; a kit key gone or
changed is `stale`, and the refresh sets it again. A file that is not JSON
is `unreadable`, and kept.

Each release's own steps — the lines a site's `AGENTS.md` and its edited
rules take by hand, the scripts to change, the baselines to recapture — are
in [upgrading.md](upgrading.md); 0.8.2's, the gates and the baseline of
what an existing site already has, in
[migrating-to-0.8.2.md](migrating-to-0.8.2.md).
