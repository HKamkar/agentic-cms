# Setting up a clone

For a person or an agent, on a fresh clone of a site built on the kit (or of
the kit itself) and a machine that may have nothing installed. Two commands
do it; this page says what each step is for, how to check it, and what to do
when one fails. An agent asked to "set up this project" in Claude Code or
Codex follows this page, through the `setup` skill.

## The commands

```bash
bash scripts/setup.sh                      # Node, pnpm, the install, then agentic-cms setup
pnpm kit serve                             # the dev server on the port of scripts.dev (and the lab), and every URL to hand over
pnpm urls                                  # this machine's URLs, and the origins next dev serves, with no server started
```

`scripts/setup.sh` is the site's copy of the kit's
`templates/site/setup.sh` (`init` writes it, and keeps a site's own). It
does what a package inside `node_modules` cannot do for itself, then hands
over to [`agentic-cms setup`](commands.md#setup), which does the rest. Every
step keeps what is already there, so a second run takes seconds; run it
again after fixing whatever a step reported. In a checkout of the kit
itself, which has no `scripts/setup.sh`, the same is
`pnpm install --frozen-lockfile && pnpm kit setup`.

| Flag | What it adds or changes |
|---|---|
| `--check` | reports every step and writes, installs and runs nothing (after the install, which `setup.sh` always does); exit 1 on a gap |
| `--build` | verifies with `pnpm build` too, about a minute |
| `--deps` | on Linux, installs WebKit's system libraries with `sudo` when WebKit does not launch |
| `--no-browsers` | skips the browsers: a machine that only edits content |
| `--engines chromium` | installs only the browsers named (default `chromium,webkit`) |
| `--no-public` | does not look up the public address: offline, or a laptop no viewer reaches from outside |

`pnpm exec agentic-cms setup --check` alone (`pnpm kit setup --check` in
the kit) is the doctor: Node, pnpm, the browsers, WebKit's libraries,
`.env.local`, the origins and what holds the dev port (this clone's own
`next dev`, another server, or nothing), one line each, nothing changed.

## The steps

1. **Node 22.18 or newer**, the version `.nvmrc` names (`setup.sh`).
   With nvm: `nvm install && nvm use`; with fnm:
   `fnm use --install-if-missing`. Check: `node -v`.
2. **pnpm, at the version `package.json` pins** in `packageManager`
   (`setup.sh`): `corepack enable pnpm` where Node still ships corepack;
   Node 25 and later do not, so there it is `npm install -g pnpm@<version>`.
   Check: `pnpm -v`.
3. **The dependencies:** `pnpm install --frozen-lockfile` (`setup.sh`; a
   new site from `init`, which has no lockfile yet, gets a plain
   `pnpm install`, and commits the lockfile it writes). A site fetches the
   kit from GitHub here and builds its `dist/` (`prepare`), which pnpm runs
   only when `pnpm-workspace.yaml` allows it (`allowBuilds`: the kit's git
   spec, `sharp`, `unrs-resolver`; [init.md](init.md)).
4. **The browsers** (`agentic-cms setup`):
   `pnpm exec playwright-core install chromium webkit`, for the engines not
   installed yet. Chromium drives every kit command (`shot`, `probe`,
   `sheet`, `visual-parity`, `lab render`); WebKit is Safari's engine for
   the checks in [browsers.md](browsers.md). On Linux WebKit needs system
   libraries the first time, which take `sudo`: setup launches WebKit to
   find out, and prints the line to run, or runs it with `--deps`
   ([browsers.md § Install](browsers.md#install)).
5. **`.env.local`** from `.env.example` when it is absent (`agentic-cms
   setup`). It is gitignored.
6. **The origins** (`agentic-cms setup`, as `pnpm urls --write`): this
   machine's LAN addresses and its public address go into
   `ALLOWED_DEV_ORIGINS`, as hostnames, beside what the file already lists
   ([dev-server.md](dev-server.md#letting-next-dev-serve-that-address)).
   They are found now, on this machine, and never go into a tracked file.
7. **Verify** (`agentic-cms setup`): `pnpm lint` and `pnpm test`; with
   `--build`, `pnpm build` (the content lint first, the prerender, the SEO
   audit last).
8. **The URLs** (`agentic-cms setup`, and `pnpm urls` any time after):
   localhost, the LAN and the public address on the dev server's port and
   the lab's, each server said running or not. The dev server is running
   only when it is this clone's own `next dev` (its `.next/dev/lock`, as
   `serve` reads it); another checkout's server on the port is named as
   such, and no restart is asked of it. Then `pnpm kit serve`,
   which starts the dev server, waits for its pages and prints the URLs,
   and hand over the one for the device that will look
   ([dev-server.md](dev-server.md)).

Two steps need the machine's owner, and an agent stops for them rather
than working around them: `sudo` for WebKit's system libraries, and a
cloud VM's firewall when the owner's devices must reach the dev server.

## When something fails

| Symptom | Do this |
|---|---|
| `setup.sh` stops at Node | install the version `.nvmrc` names (`nvm install && nvm use`), then run it again |
| `setup.sh` could not install pnpm | `npm install -g pnpm@<version>`, the `packageManager` version, with `sudo` if npm's global folder needs it |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` lacks the `allowBuilds` key the error names: add it (`init` writes the kit's three; [init.md](init.md)) and run the setup again |
| `browsers ✗ the browser install failed` | the network or the disk: the install's own output says which; run the setup again when it is fixed |
| `no Chromium build found` from a kit command | `bash scripts/setup.sh`, or `CHROME_PATH` pointing at a Chrome you have |
| `webkit libraries ! WebKit does not launch` | the owner runs the line it prints (`sudo "$(command -v node)" node_modules/playwright-core/cli.js install-deps webkit`), or `bash scripts/setup.sh --deps` |
| every dev page fails with `Can't resolve '@vercel/turbopack-next/internal/…'` after a build | `pnpm kit serve --fix-cache`; or stop the dev server, `rm -rf .next/dev .next/cache/turbopack`, start it again ([design.md § When the dev server will not serve](design.md#when-the-dev-server-will-not-serve)) |
| a route you just created answers 404 | the dev server's watcher has not seen it yet: wait a second or two and reload (the first request also compiles it). `demo new` and `lab route` wait for it themselves while a dev server runs |
| a page on another device renders but nothing on it works | its address is missing from `ALLOWED_DEV_ORIGINS`: `pnpm kit serve --write-origins` (or `pnpm urls --write`, then restart the dev server) ([dev-server.md](dev-server.md#letting-next-dev-serve-that-address)) |
| `serve: port 8000 answers, but not as this site's next dev`, or `urls`, `setup --check`, `demo new` and `lab route`: `… not as this clone's next dev` | something else holds the port (another checkout's or another project's dev server, `pnpm preview`): stop it if it is yours ([dev-server.md § Stopping a server](dev-server.md#stopping-a-server)), or `pnpm kit serve --port <another>` |
| `pnpm lint` fails naming the component to use instead | read the message: the library comes first (`src/components/README.md`), so use the primitive it names rather than loosening the rule |

## What to read next

- `AGENTS.md`: the site's rules (Claude Code reads it through `CLAUDE.md`;
  Codex reads it directly).
- `src/components/README.md`: the component catalogue;
  [primitives.md](primitives.md): what a new site builds first.
- [dev-server.md](dev-server.md) and [browsers.md](browsers.md): showing
  work to the owner and checking it in both engines;
  [gotchas.md](gotchas.md): the traps by topic.
