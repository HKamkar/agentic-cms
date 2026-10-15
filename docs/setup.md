# Setting up a clone

For a person or an agent, on a fresh clone of a site built on the kit (or of
the kit itself) and a machine that may have nothing installed. Each step
says how to check it; the table at the end is what to do when one fails.
An agent asked to "set up this project" in Claude Code or Codex follows
this page in order.

## The steps

```bash
nvm install && nvm use                     # or: fnm use --install-if-missing (reads .nvmrc)
corepack enable pnpm                       # Node 25 and later: npm install -g pnpm@<version>
pnpm install --frozen-lockfile
pnpm exec playwright-core install chromium webkit
cp -n .env.example .env.local              # then this machine's hostnames in ALLOWED_DEV_ORIGINS
pnpm lint && pnpm test                     # pnpm build for the full gate
pnpm dev                                   # port 8000
```

1. **Node 22.18 or newer**, the version `.nvmrc` names. With nvm:
   `nvm install && nvm use`; with fnm: `fnm use --install-if-missing`.
   Check: `node -v`.
2. **pnpm, at the version `package.json` pins** in `packageManager`.
   `corepack enable pnpm` where Node still ships corepack; Node 25 and
   later do not, so there it is `npm install -g pnpm@<version>` with that
   version. Check: `pnpm -v`.
3. **The dependencies:** `pnpm install --frozen-lockfile`. A site fetches
   the kit from GitHub here and builds its `dist/` (`prepare`), which
   pnpm runs only when `pnpm-workspace.yaml` allows it (`allowBuilds`:
   the kit's git spec, `sharp`, `unrs-resolver`; [init.md](init.md)).
4. **The browsers:** `pnpm exec playwright-core install chromium webkit`.
   Chromium drives every kit command (`shot`, `probe`, `sheet`,
   `visual-parity`, `lab render`); WebKit is Safari's engine for the
   checks in [browsers.md](browsers.md). On Linux WebKit needs system
   libraries the first time, which take `sudo`
   ([browsers.md § Install](browsers.md#install)). A machine that only
   edits content can skip this step.
5. **`.env.local`** from `.env.example` when it is absent (`cp -n`
   keeps one that exists). It is gitignored. Add this machine's
   hostnames to `ALLOWED_DEV_ORIGINS`, found as
   [dev-server.md](dev-server.md#which-address-to-hand-over) says; an
   address never goes into a tracked file.
6. **Verify:** `pnpm lint` and `pnpm test`. `pnpm build` is the full gate
   (the content lint first, the prerender, the SEO audit last), about a
   minute.
7. **Start:** `pnpm dev` on port 8000, then the URL for the device that
   will look ([dev-server.md](dev-server.md)).

Two steps need the machine's owner, and an agent stops for them rather
than working around them: `sudo` for WebKit's system libraries, and a
cloud VM's firewall when the owner's devices must reach the dev server.

## When something fails

| Symptom | Do this |
|---|---|
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` lacks the `allowBuilds` key the error names: add it (`init` writes the kit's three; [init.md](init.md)) and run `pnpm install` again |
| `pnpm: command not found` on Node 25 or later | no corepack there: `npm install -g pnpm@<version>`, the `packageManager` version |
| `no Chromium build found` from a kit command | `pnpm exec playwright-core install chromium`, or `CHROME_PATH` pointing at a Chrome you have |
| WebKit fails to launch on Linux | `sudo "$(command -v node)" node_modules/playwright-core/cli.js install-deps webkit` |
| every dev page fails with `Can't resolve '@vercel/turbopack-next/internal/…'` after a build | stop the dev server, `rm -rf .next/dev .next/cache/turbopack`, start it again ([design.md § When the dev server will not serve](design.md#when-the-dev-server-will-not-serve)) |
| a route you just created answers 404 | the dev server's watcher has not seen it yet: wait a second or two and reload (the first request also compiles it) |
| a page on another device renders but nothing on it works | its hostname is missing from `ALLOWED_DEV_ORIGINS`: add it and restart `pnpm dev` ([dev-server.md](dev-server.md#letting-next-dev-serve-that-address)) |
| `pnpm lint` fails naming the component to use instead | read the message: the library comes first (`src/components/README.md`), so use the primitive it names rather than loosening the rule |

## What to read next

- `AGENTS.md`: the site's rules (Claude Code reads it through `CLAUDE.md`;
  Codex reads it directly).
- `src/components/README.md`: the component catalogue;
  [primitives.md](primitives.md): what a new site builds first.
- [dev-server.md](dev-server.md) and [browsers.md](browsers.md): showing
  work to the owner and checking it in both engines;
  [gotchas.md](gotchas.md): the traps by topic.
