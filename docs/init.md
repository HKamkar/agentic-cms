# Starting a site: `agentic-cms init`

Two ways to start, one result. **Fork** this repo when you want the example
around you and replace it piece by piece; or **install** the package and let
it lay the site out, in one line:

```bash
pnpm dlx --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v0.7.6 init my-site
cd my-site && bash scripts/setup.sh && pnpm dev
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
pnpm add --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v0.7.6
pnpm exec agentic-cms init .
```

From a checkout of the kit, `pnpm kit init ../my-site` does the same.

## What it writes

- **The example**: `src/app/`, `src/components/`, `src/config/`,
  `src/styles/`, `src/kit.ts` (the one place the engine is composed),
  `content/` (the registries, the FAQ set, the page files, three posts that
  describe how a post is built), `public/` (the placeholders and the OG
  images), `STANDARD.md` (the wireframe's standard, with a note that the
  `design` skill replaces it as the look lands).
- **The agent files**: `AGENTS.md` (a site's rules; `CLAUDE.md` includes
  it), `.claude/rules/` (path-scoped invariants for the content engine, the
  blog, forms, SEO, styling and design, pointing at the engine's READMEs
  under `node_modules/agentic-cms/`; `AGENTS.md`'s scoped-rules table routes
  Codex to them), `.claude/skills/` and
  `.agents/skills/` (the design skills), `.claude/settings.json` (the
  editorial plugin from the kit's marketplace), and `.agentic-cms.json`, the
  manifest of the agent files as written.
- **The config**: `package.json` (the scripts a build needs and the
  dependencies at the kit's versions — merged into an existing one, whose
  name, scripts and dependencies win, but for `pnpm init`'s placeholders:
  its failing `test` gives way to the kit's and its `main: "index.js"` is
  dropped, while its `license`, `version`, `devEngines` and
  `packageManager` stay), `tsconfig.json`, `pnpm-workspace.yaml` (merged
  into an existing one: the `allowBuilds` keys it lacks are added, the
  names of a legacy `onlyBuiltDependencies` list, which pnpm no longer
  reads, are carried into it, and every other key, value and comment stays
  as the site wrote it), `next.config.ts`, `postcss.config.mjs`,
  `eslint.config.mjs`, `.gitignore`, `.env.example`, `.nvmrc`, `README.md`,
  `PLAN.md`.
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

## Then

`bash scripts/setup.sh` first ([setup.md](setup.md)): the install, the
browsers, `.env.local`, the checks, and the URLs `pnpm dev` answers on.

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
```

A rule is `ok`, `modified` (the site edited it: kept, never overwritten),
`stale` (the kit has a newer one) or `missing`; `--check` exits 1 on
anything but `ok`, a site's own edit included, and the CI workflow `init`
writes runs it on every pull request. `AGENTS.md` is the site's
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
