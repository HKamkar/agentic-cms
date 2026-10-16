---
name: setup
description: Set up a site built on agentic-cms on a fresh clone or a new machine - Node and pnpm, the dependencies, the browsers the kit drives (Chromium, WebKit), .env.local with this machine's addresses in ALLOWED_DEV_ORIGINS, the lint and the tests - by running `bash scripts/setup.sh` as docs/setup.md describes, then the dev server and the URL to hand over (`pnpm kit serve`). Use when asked to set up, install, bootstrap or "get the project running", right after cloning, or when pnpm, the dev server or a browser command fails for a missing tool.
argument-hint: [--build] [--deps]
---

# Setup

The procedure is `docs/setup.md` (under `node_modules/agentic-cms/docs/` on
a site, `docs/` in a checkout of the kit); this skill runs it and reports.
Three commands do the work: `bash scripts/setup.sh` (Node, pnpm, the
install, then `agentic-cms setup`), `pnpm kit serve` (the dev server and
the lab started, and this machine's URLs printed once the pages answer)
and `pnpm urls` (the same URLs and the origins `next dev` serves, with no
server started).

## Read first

- `docs/setup.md`: the steps, what each is for, and the table of failures.
- `docs/dev-server.md`: the ports, which address to hand over, stopping a
  server.

## Steps

1. **Look first, change nothing:** `pnpm exec agentic-cms setup --check`
   once the dependencies are installed (`bash scripts/setup.sh --check`
   before that: it installs pnpm and the dependencies, then checks). Read
   each line: `✓` is there, `✗` is a gap setup fills, `!` is the owner's.
2. **Run** `bash scripts/setup.sh`. Add `--build` when asked for the full
   gate, `--deps` when the owner agreed to WebKit's libraries (sudo), and
   `--no-public` on a machine no viewer reaches from outside. It is
   idempotent: after fixing what a step reported, run it again. In a
   checkout of the kit itself it is `pnpm install --frozen-lockfile`, then
   `pnpm kit setup` with the same flags.
3. **When a step fails**, fix the cause its line names (the Node version,
   pnpm, the network for the browsers) and run it again. Never edit the
   lockfile, skip `pnpm lint` or a test, or loosen a rule to get through.
4. **Start the dev server** where the person can see and stop it (a
   terminal of theirs, not a hidden background job): `pnpm kit serve`. It
   starts `next dev` (and the lab, when there are scenes), waits until the
   pages answer, and prints this machine's URLs in one table, with a line
   when `ALLOWED_DEV_ORIGINS` lacks an address (`pnpm kit serve
   --write-origins` adds the missing ones before the server starts;
   `pnpm urls` reports the same any time). Hand over a URL it printed that
   the person can reach: localhost on their own machine, the LAN address
   for a phone on the same network, the public address of a cloud VM whose
   firewall opens the port to the viewer's IP only.
5. **Report** in a few lines: what was installed, what was already there,
   what is left for the person with the command for it, and the URL.

Then the rules are `AGENTS.md`; design work starts with the `design`
skill; the component catalogue is `src/components/README.md`.

## Verify

`pnpm exec agentic-cms setup --check` exits 0 (in the kit, `pnpm kit
setup --check`), and a page opened on the URL handed over hydrates: a
menu opens, a button answers.

## Stop for the user

- **sudo**, for WebKit's system libraries on Linux: setup prints the line
  (`sudo "$(command -v node)" node_modules/playwright-core/cli.js
  install-deps webkit`) or runs it with `--deps` only when the person says
  so. Chromium works without them.
- **The firewall**: a cloud VM's port (8000, and 8001 for the lab) opened
  to the viewer's IP only, in the provider's console. The viewer finds
  their IP by opening <https://ifconfig.me> in the browser they will use.
- An address never goes into a tracked file: `.env.local` is gitignored,
  and nothing setup or `urls` prints goes into a commit, a doc or a pull
  request.
