# Starting a site: `agentic-cms init`

Two ways to start, one result. **Fork** this repo when you want the example
around you and replace it piece by piece; or **install** the package and let
it lay the site out:

```bash
mkdir my-site && cd my-site
pnpm init                                                        # a package.json to add to
pnpm add agentic-cms@github:HKamkar/agentic-cms#v0.5.1           # the engine (allowBuilds below, first)
pnpm exec agentic-cms init .                                     # the site
pnpm install && pnpm dev
```

A git dependency builds its `dist/` on install (`prepare`), which pnpm runs
only when `pnpm-workspace.yaml` allows it — `init` writes the file, but the
first `pnpm add` needs it too:

```yaml
allowBuilds:
  "agentic-cms@git+https://github.com/HKamkar/agentic-cms.git": true
  sharp: true
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
  under `node_modules/agentic-cms/`), `.claude/skills/` and
  `.agents/skills/` (the design skills), `.claude/settings.json` (the
  editorial plugin from the kit's marketplace), and `.agentic-cms.json`, the
  manifest of the agent files as written.
- **The config**: `package.json` (the scripts a build needs and the
  dependencies at the kit's versions — merged into an existing one, whose
  name, scripts and dependencies win), `tsconfig.json`, `pnpm-workspace.yaml`,
  `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`,
  `.gitignore`, `.env.example`, `.nvmrc`, `README.md`, `PLAN.md`.

Nothing of the package's source; nothing about a host (Cloudflare, Azure,
a VPS are a site's decision, written into its `PLAN.md`). An existing file
is never overwritten unless `--force`; each file prints `created`,
`updated` or `kept`.

## Then

1. `src/config/site.ts`: the brand, the URL, the address, the nav, the
   footer, the calls to action (data only).
2. `src/app/globals.css`: the tokens — or start the `design` skill, which
   begins there.
3. `content/VOICE.md` from `content/_templates/VOICE.md`: the voice and
   claim rules the lint enforces.
4. Replace the content: `content/README.md` is the door.
5. `pnpm content:lint` until clean, `pnpm build`, then the host of your
   choice.

## After a kit upgrade

```bash
pnpm add agentic-cms@github:HKamkar/agentic-cms#v<next>
pnpm exec agentic-cms init . --agent-files          # the new rules and skills; the site's own edits are kept
pnpm exec agentic-cms init . --agent-files --check  # what drifted, for CI (exit 1 on drift)
```
