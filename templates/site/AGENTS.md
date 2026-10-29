# This site: the rules for any agent working on it

The site is built on `agentic-cms` (the package under `node_modules/`,
pinned in `package.json`): the content engine and its layers (pages, the
post pipeline, SEO; forms beside it), the browser libraries, the design
tools, the command line, the agent skills and the guides come from it, at
the version pinned; this repo holds what is the site's — the design, the
content, the config, the docs. An engine change is a kit pull request,
then a bumped pin here; never a patch under `node_modules`.

- **The engines are required:** every word a reader sees comes from
  `content/` or `site.ts`, in pages, sections, components and design rounds
  alike; heads come from `kit.seo`, forms from the form engine, tags
  through consent, an address through `EmailLink`. For everything else,
  find the kit's part in `node_modules/agentic-cms/docs/parts.md` and
  prefer it; if you use your own, write its reason in one line. Never
  weaken a check to pass it.
- `STANDARD.md` is the design system and the way pages are built on it:
  tokens, type, spacing, markup, images, components, the section anatomy,
  motion, the page recipe, and §8, the register of decisions that look like
  bugs on purpose. Read it before writing any markup or CSS; the component
  catalogue is `src/components/README.md`. Design work starts with the
  `design` skill (the kit's `design` plugin, read from the installed
  package; a stub in `.agents/skills/` for Codex); a look the owner has to choose goes
  through `design-options`, a screenshot claim through `design-measure`,
  icons through `design-icons`, the site's own graphics (drawn as SVG in
  the lab, `pnpm kit lab`, shipped pre-rendered) through `design-graphics`,
  and nothing merges without `design-proof`.
- Content is files under `content/`, validated at build time: posts in
  `content/blog/` (the filename is the slug), the registries, `reviews.yaml`,
  `faqs/<key>.yaml`, `use-cases.yaml`, `redirects.yaml`, and a page per file
  in `content/pages/<slug>.yaml` (its `seo` block, its structured data, its
  sections in order). Each YAML file names its JSON Schema
  (`content/_schemas/`, written by `pnpm content:docs`) on its first line:
  read it before writing the file. The door for editing is
  `content/README.md`; the templates are `content/_templates/`; the voice
  and claim rules are
  `content/VOICE.md`, enforced by `agentic-cms lint` in `pnpm build`.
  A string marked `(placeholder)` is the starter's: the site's own copy
  replaces it (`/editorial:new-page`) before any design, and a production
  build fails while one remains. The content jobs are the `editorial`
  plugin (`/editorial:write-post`, `new-post`, `update-post`, `new-page`,
  `review-voice`, `critic`, `content-status`, `retire-content`,
  `translate`), enabled by
  `.claude/settings.json` from the package's marketplace,
  `./node_modules/agentic-cms`. `.claude/skills/` holds the site's own
  skills alone. Never read `content/` at request time: every page is
  prerendered.
- **Every page is a content file.** It is `content/pages/<slug>.yaml`,
  rendered by the catch-all route through the section registry; a new page
  is `/editorial:new-page` (or the page template), a new section type a
  schema, a component and a registry entry, together. A page's copy
  (headings, body, labels, alt text, the SEO fields) never lives in a
  component, a `page.tsx` or `src/config/` (the chrome is configured in
  `site.ts`, a form in `forms.ts`). A route outside the content engine
  (the API, the feed, a design round's `*-demo`, `lab-demo`) is a named
  exception with its reason, in `src/config/components.json` where the
  site runs the guard. The pages rule has the rest.
- The kit's contracts and know-how are read in the package, never copied
  here: [The kit's guides](#the-kits-guides) says which, by task.
- A machine's address never goes into the repo: it is found when needed,
  per developer, and lives in the gitignored `.env.local`
  (`ALLOWED_DEV_ORIGINS`; `pnpm kit serve` starts the dev server and
  prints the URLs to hand over, `pnpm urls` prints them alone and
  `--write` adds the missing hosts; `dev-server.md`).
- Brand names, links and the chrome's text come from `src/config/site.ts`;
  every page is served by this app, so links stay relative. Public URLs do
  not change without redirects: an entry of `content/redirects.yaml`,
  which `next.config.ts` serves (`/editorial:retire-content` writes it).
- Analytics loads only behind the visitor's consent: `agentic-cms/consent`
  and `agentic-cms/consent/google` (`GoogleTag`, the consent default as an
  inline script near the top of `<body>`), configured in
  `src/config/analytics.ts`; the banner is the site's design
  (`node_modules/agentic-cms/docs/consent.md`).
- SEO is a contract, not a checklist: the page file's `seo` block feeds
  the head, its `jsonld` block the structured data; `pnpm build` audits every
  prerendered page (`agentic-cms seo`) and fails on a missing field. Never
  hand-write head tags.
- Verify = `pnpm lint` (ESLint, then `agentic-cms check-site`) +
  `pnpm test` + `pnpm content:lint` + `pnpm build` (the lint first; the
  SEO audit, then `guard-email` with `guardEmail: true` in `site.ts`), 0
  failures, before calling a change done; `pnpm kit visual-parity` before
  a merge that touches `src/`, styles or images. CI
  (`.github/workflows/verify.yml`) runs the same, and `agentic-cms init .
  --agent-files --check` (which fails a rule that lost a line marked
  `<!-- required -->`, or a file of the kit's behind the kit), on every pull
  request; opted in, its `preview` job puts each pull request at a link of
  its own, never indexed (`node_modules/agentic-cms/docs/preview.md`).
  Never drop a gate from `lint` or `build`.

<!-- rules-table:start -->
## Scoped rules for Claude Code and Codex

Before editing or reviewing a file, read and follow **every** rule below
whose paths match it: `**` spans directories, and matches add up (a post
needs its content, post pipeline and SEO rules). Claude Code loads these
files itself through their `paths` frontmatter; Codex does not, so open each
matching file before the edit, and again when the task reaches other
paths. The table is written from the rules' frontmatter by
`agentic-cms init --agent-files`: a scope changes in its rule, never here.

| Paths | Read and follow |
| --- | --- |
| `content/blog/**`, `src/components/blog/**`, `src/app/blog-post/**`, `src/app/feed.xml/**` | [The post pipeline](.claude/rules/blog-engine.md) |
| `src/components/**`, `src/app/**/*.tsx`, `eslint.config.mjs`, `src/config/components.json` | [Components](.claude/rules/components.md) |
| `content/**`, `src/kit.ts`, `src/kit.test.ts`, `src/components/sections/schemas.ts`, `src/components/sections/render.tsx` | [Content engine](.claude/rules/content-engine.md) |
| `src/**/*.tsx`, `src/**/*.css`, `public/images/**` | [Design](.claude/rules/design.md) |
| `src/components/ui/form/**`, `src/config/forms.ts`, `src/config/form-delivery.ts`, `src/app/api/forms/**` | [Forms](.claude/rules/form-engine.md) |
| `src/app/**`, `src/components/**`, `content/pages/**` | [Pages](.claude/rules/pages.md) |
| `src/app/**`, `src/config/site.ts`, `src/kit.ts`, `content/blog/**`, `content/pages/**` | [SEO](.claude/rules/seo.md) |
| `src/**/*.tsx`, `src/**/*.css` | [Styling](.claude/rules/styling.md) |
<!-- rules-table:end -->

## The kit's guides

Read the guide before the task: each is under `node_modules/agentic-cms/`,
at the version this site pins.

| Before | Read |
|---|---|
| writing your own of anything | `docs/parts.md`, the map of every part; `docs/stability.md`, what each promises |
| a content file, a page, a post, the head | `src/lib/content/README.md`, `src/lib/blog/README.md`, `src/lib/seo/README.md`; `docs/schema.md` |
| a URL that moves, a page or a post that goes | `docs/redirects.md` |
| a form, an address, a tag | `src/lib/forms/README.md`, `docs/forms.md`; `docs/email.md`; `docs/consent.md` |
| another language, a translation | `docs/locales.md` |
| a command | `docs/commands.md` |
| markup, CSS or motion | the scoped rules above, each pointing at the kit's whole rule; `STANDARD.md` here |
| a design round, a candidate, an icon, a graphic | `docs/design.md`, `docs/icons.md`, `docs/lab.md`; the design plugin's skills |
| a screenshot claim | `docs/shot-probe-sheet.md` |
| a capture or a proof | `docs/visual-parity.md`: the profile, the baselines, the cache, the seed, what a verdict means |
| a fresh clone or a new machine | `docs/setup.md` (`bash scripts/setup.sh`; the `setup` skill) |
| a dev server, a URL for the owner | `docs/dev-server.md`, `docs/browsers.md` |
| a primitive | `docs/primitives.md` |
| a host, a deploy, a preview of a pull request | `docs/deploy.md`, `docs/preview.md` |
| an upgrade of the kit | `docs/upgrade.md` (`pnpm dlx agentic-cms@<version> upgrade`), `docs/upgrading.md` |
| an area with traps | `docs/gotchas.md`, by topic |

## Process

- Plan first, edit second: a non-trivial change is proposed and approved
  before editing. Typos and one-line tweaks need no plan.
- Match scope to the ask: a bug fix is not a refactor is not a redesign;
  drive-by cleanups are separate suggestions.
- Design choices go to the owner as a round (`design-options`): three to
  five ideas in one message, the owner's pick of what to build, the
  candidates as real components on a demo route (`pnpm kit demo new <name>
  --section <type>`) in the section's frame with the page's copy on the
  site's theme, the current version last; the owner picks by letter or edits
  the pick in words on the route, inside the round; on their word the winner
  is built, generic pieces leave for `ui/`, and `pnpm kit demo clean` removes
  the rest. A sheet for static candidates. One round, one build.
- One instance means the class: a report of one template glyph, one
  hard-coded value, one unaligned card is a report of every one of its
  kind; inventory the class first (`pnpm kit probe … --all`, `grep`, a
  sheet) and fix it in one job.
- Reading a screenshot: measure, don't guess (`design-measure`). "It looks
  broken" is resolved with `pnpm kit probe` and `pnpm kit shot`, not by
  eyeballing.
- The site is designed, looked at and measured at its widths — the
  profile's, `widths` in `src/config/harness.ts`; for a new site four:
  390, 768, 1440 and 1920.
- Rejected and unapproved candidates are deleted, never archived or kept
  "for later" (`pnpm kit demo clean`, `pnpm kit lab clean`).
- A pick from a sheet is not the owner's look at the built thing: build it,
  show it on the dev server, ask, then merge.

## Git workflow

- Every change on a branch off `develop` (`feat/<slug>`, `bugfix/<slug>`,
  `refactor/<slug>`, `docs/<slug>`), committed and pushed there, shown on
  the dev server; the branch goes into `develop` only after the owner has
  looked and said so. The harness proofs are necessary, not sufficient: a
  pixel-identical end state says nothing about whether a design change
  looks right, and that judgement is the owner's.
- `main` is stable and only receives pull requests from `develop`; a merge
  into `main` is a release.
- Stage per commit, exactly; read `git status` before every commit. Commit
  messages carry no AI attribution: no `Co-Authored-By: …`, no "Generated
  with…" footers.
- One pull-request-sized job per session, ending at a committed, proven
  boundary; `PLAN.md` and the memory are the handover.
