# Starting a site: `agentic-cms init`

Two ways to start, one result. **Fork** this repo when you want the example
around you and replace it piece by piece; or **install** the package and let
it lay the site out, in one line:

```bash
pnpm dlx --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v0.8.1 init my-site
cd my-site && bash scripts/setup.sh && pnpm kit serve
```

`pnpm dlx` installs the kit in a temporary place and runs its `init`, which
lays the site out in `my-site/` (`.` for the folder you are in). The kit is
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
pnpm add --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v0.8.1
pnpm exec agentic-cms init .
```

From a checkout of the kit, `pnpm kit init ../my-site` does the same.

## What it writes

- **The example**: `src/app/`, `src/components/`, `src/config/`,
  `src/styles/`, `src/kit.ts` (the one place the engine is composed),
  `content/` (the registries, the FAQ set, the page files, three posts that
  describe how a post is built), `public/` (the placeholders and the OG
  images), `STANDARD.md` (the wireframe's standard, with a note that the
  `design` skill replaces it as the look lands). Its `src/config/harness.ts`
  holds the site's profile — the widths a capture takes (390, 768, 1440 and
  1920), the schemes a proof runs a pass in (light and dark), the ref a
  proof's baseline is built from ([visual-parity.md](visual-parity.md#the-sites-profile)),
  and its `src/config/components.json` is the component guard's config:
  the layers, the content engine's route folders and the named exceptions
  outside it, each with its reason, the frozen `inherited` list
  ([primitives.md § Placed](primitives.md#placed-agentic-cms-check-components)).
- **The agent files**: `AGENTS.md` (a site's rules; `CLAUDE.md` includes
  it), `.claude/rules/` (path-scoped invariants for the content engine, the
  blog, forms, SEO, styling, design and the components, pointing at the
  engine's READMEs under `node_modules/agentic-cms/`; `AGENTS.md`'s
  scoped-rules table routes Codex to them; the components rule is written
  only beside the guard's config, which the example brings), `.claude/skills/` and
  `.agents/skills/` (the design skills), `.claude/settings.json` (the
  editorial plugin from the kit's marketplace), and `.agentic-cms.json`, the
  manifest of the agent files: the kit's text each one was written from
  ([§ After a kit upgrade](#after-a-kit-upgrade)).
- **The config**: `package.json` (the scripts a build needs — `lint` runs
  ESLint, then the component guard, and fails on either:
  `eslint; s=$?; agentic-cms check-components || s=1; exit $s` — and the
  dependencies at the kit's versions; merged into an existing one, whose
  name, scripts and dependencies win, but for `pnpm init`'s placeholders:
  its failing `test` gives way to the kit's and its `main: "index.js"` is
  dropped, while its `license`, `version`, `devEngines` and
  `packageManager` stay), `tsconfig.json`, `pnpm-workspace.yaml` (merged
  into an existing one: the `allowBuilds` keys it lacks are added, the
  names of a legacy `onlyBuiltDependencies` list, which pnpm no longer
  reads, are carried into it, and every other key, value and comment stays
  as the site wrote it), `next.config.ts`, `postcss.config.mjs`,
  `eslint.config.mjs` (`eslint-config-next` and the component rules,
  `agentic-cms/eslint`: [primitives.md § Enforced](primitives.md#enforced-agentic-cmseslint)),
  `.gitignore`, `.env.example`, `.nvmrc`, `README.md`, `PLAN.md`.
- **CI**: `.github/workflows/verify.yml`, on every pull request and every
  push to `develop` or `main`: `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm test`, `pnpm build` and `agentic-cms init . --agent-files --check`,
  with pnpm from `packageManager` (Node 25 and later ship no corepack), Node
  from `.nvmrc`, and every action pinned to a commit.
- **The setup script**: `scripts/setup.sh`, which a clone runs first on any
  machine: Node checked, pnpm at the `packageManager` version, the install,
  then `agentic-cms setup` (the browsers, `.env.local` and this machine's
  origins, the lint and the tests, the URLs; [setup.md](setup.md)). The
  package scripts include `urls` (`agentic-cms urls`), and none is named
  `setup`: `pnpm setup` is pnpm's own command.

Nothing of the package's source; nothing about a host (Cloudflare, Azure,
a VPS are a site's decision, written into its `PLAN.md`). An existing file
is never overwritten unless `--force`; each file prints `created`,
`updated` or `kept`. `package.json` and `pnpm-workspace.yaml` are merged,
with `--force` too, and print `merged` with what changed.

## A site without dark mode

`--light-only` at the end of the install line above — or, in a project that
already has the kit,

```bash
pnpm exec agentic-cms init my-site --light-only
```

— lays the same example out with one scheme, light:

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
A site already laid out goes light-only by hand, as the migration guide's
§ 3.4 says.

## Then

`bash scripts/setup.sh` first ([setup.md](setup.md)): the install, the
browsers, `.env.local`, the checks, and the URLs `pnpm dev` answers on.
Then `pnpm kit serve`: the dev server (and the lab, once it has a scene),
every URL to hand over in one table ([dev-server.md](dev-server.md)).

1. `src/config/site.ts`: the brand, the URL, the address, the nav, the
   footer, the calls to action (data only).
2. `src/app/globals.css`: the tokens — or start the `design` skill, which
   begins there.
3. `content/VOICE.md` from `content/_templates/VOICE.md`: the voice and
   claim rules the lint enforces.
4. Replace the content: `content/README.md` is the door.
5. Where the contact form delivers: it ships on `mailto`; the endpoint
   sends it to a webhook or a provider of your choosing
   ([forms.md](forms.md)).
6. Analytics, if the site measures visits: `GOOGLE_TAG_ID` where the
   production build runs switches on the Google tag behind a consent banner
   (`src/config/analytics.ts`, the banner the site's to design;
   [consent.md](consent.md)).
7. `pnpm content:lint` until clean, `pnpm build`, then the host of your
   choice (a Node server: [deploy.md](deploy.md)).

## After a kit upgrade

```bash
pnpm add agentic-cms@github:HKamkar/agentic-cms#v<next>
pnpm exec agentic-cms init . --agent-files          # the new rules and skills; the site's own edits are kept
pnpm exec agentic-cms init . --agent-files --check  # what drifted, for CI (exit 1 on drift)
pnpm exec agentic-cms init . --agent-files --diff <file>    # a file the site edited: the kit's change since the site took it
pnpm exec agentic-cms init . --agent-files --accept <file>  # merged by hand: the kit's current text is the file's base
```

`.agentic-cms.json` records each agent file's base, the hash of the kit's
text the site last took (written by `init`, or accepted after a hand
merge), with the kit's `version` and, for a pin between releases (which
still carries the last release's version), the `commit` the site's
lockfile installed. Against its base a rule is `ok` (the kit's text),
`modified` (the site edited the kit's current text: kept, never
overwritten), `modified, kit changed` (the site edited it and the kit's
text changed since its base), `stale` (the site never touched it and the
kit has a newer one) or `missing`. `--check` exits 1 on the last three, so a
site that keeps its own edits keeps a clean check, and the CI workflow
`init` writes runs it on every pull request. A `modified, kit changed`
file is merged by hand: `--diff <file>` prints the kit's change alone, from
the base to the kit's current text, as a unified diff (`git apply` takes it
where the site's edits sit apart from it), and `--accept <file>` then
records the kit's current text as the file's base. The text of the base of
each file the site edited is kept in `.agentic-cms/base/`, under the file's
path without its leading dot so no agent loads the copies as rules or
skills, and so is the text of a base no release of the kit holds (a pin
between releases; a release's text is in the package's record of its
releases). So a file `init` writes and the site edits before committing
it keeps its base, and `--diff` prints the kit's change alone with nothing
committed first. The first time, a base's text comes from the kit's
releases or the site's git history (the commit that has the file as the
kit wrote it). Commit the folder with the manifest.

A file the site wrote before the manifest recorded its base has none, so
it is measured against the kit's text at the version the site was on: the
manifest's `version` (unless a refresh with the running version wrote it),
else the last other version the site's `package.json` named in its git
history. The package carries every release's text of every agent file for
that (`scripts/lib/agent-file-releases.json`, written from the kit's tags),
so a site needs no history of the kit. A file that is a release's text,
untouched, is `stale`. One whose kit text has not changed since that
version is `modified`, noted "no base: kit unchanged since 0.7.6": the
site's own edit, nothing to take. One whose kit text has changed is
`modified, kit changed` with that release's text as its base, and `--diff`
prints the kit's change from it. The refresh and `--accept` record the
base, as for any file. Where neither the version nor its text is known,
the file is `modified, kit changed` with a note, and `--diff` says that
what it prints is the site's whole file against the kit's current text:
not the kit's change, and never applied whole — take the kit's lines from
it by hand. Only a `--diff` from a base is the kit's change alone.

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

Each release's own steps — the lines a site's `AGENTS.md` and its edited
rules take by hand, the scripts to change, the baselines to recapture — are
in [upgrading.md](upgrading.md).
