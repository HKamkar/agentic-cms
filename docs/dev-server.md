# Serving previews to the owner's devices

The owner judges a design on their own screens: a laptop, a phone, a
tablet. So the dev server and the lab have to be reachable from outside
the machine the agent works on. This page says which ports, which address
to hand over, how to let `next dev` serve that address, and how to stop a
server. Read it before starting a server or handing over a URL; which
browser checks what is [browsers.md](browsers.md). `pnpm urls`
([`agentic-cms urls`](commands.md#urls)) does the finding: this machine's
URLs for both servers, which one answers, and the origins `next dev`
lacks.

Nothing here names a machine. An address depends on who is developing and
where, so it is found when it is needed and never written down in the
repo; here it is `<lan-ip>` or `<public-ip>`.

## Ports

| Port | What |
|---|---|
| 8000 | `pnpm dev` (`next dev -p 8000`), on every interface: the site, a round's `/<name>-demo`, the lab's `/lab-demo`. `pnpm preview` serves the Worker on the same port, so run one or the other |
| 8001 | `pnpm kit lab serve`, on `0.0.0.0`: the lab's index and each scene at `/scene/<name>` ([lab.md](lab.md)) |

## Which address to hand over

- **A laptop or a desktop:** the LAN address, for a phone or a tablet on
  the same network: `http://<lan-ip>:8000/<name>-demo`. Its public address
  is the router's, which does not forward the port.
- **A cloud VM:** the public address, `http://<public-ip>:8000/…`, once
  its firewall opens 8000 (and 8001 for the lab) **to the viewer's IP
  only**: the dev server has no sign-in, and neither has the lab. The
  viewer finds their own IP by opening <https://ifconfig.me> in the
  browser they will use.

Hand over the page itself, not an index: the demo route, or each scene's
own `/scene/<name>`.

Finding the addresses is `pnpm urls`:

```text
dev server, port 8000: running
  localhost  http://localhost:8000
  LAN        http://<lan-ip>:8000
  public     http://<public-ip>:8000   answers only where a firewall opens 8000, to the viewer's IP only
lab, port 8001: not running (pnpm kit lab serve starts it); /scene/<name> on the same hosts

ALLOWED_DEV_ORIGINS in .env.local covers every address above
```

- **LAN:** the IPv4 addresses of the machine's real interfaces; loopback,
  container and VM bridges (`docker0`, `br-…`, `veth…`, `virbr…`) and a
  Mac's tunnels are left out. `pnpm kit lab serve` prints the same list.
- **Public:** asked of `api.ipify.org`, then `ifconfig.me`, four seconds
  each; `--no-public` skips it offline or on a laptop no viewer reaches
  from outside.
- **The ports:** the dev server's from the `-p` of `scripts.dev` in
  `package.json` (`--port` for another), the lab's 8001 (`--lab-port`).
- `--json` prints the same as one document; exit 1 means an address is
  missing from `ALLOWED_DEV_ORIGINS`.

## Letting `next dev` serve that address

`next dev` serves its scripts and hot reload only to `localhost` and the
hostname it was started with. Any other address gets a page that renders
but never hydrates: reveals stay hidden, buttons do nothing
([gotchas.md](gotchas.md#nextjs)). The site's `next.config.ts` (as `init`
writes it) reads the other hostnames from `ALLOWED_DEV_ORIGINS`:

```bash
# .env.local (gitignored; .env.example carries the key, empty)
ALLOWED_DEV_ORIGINS=<lan-ip>,<public-ip>
```

Hostnames only, comma-separated: no scheme, no port. `pnpm urls --write`
adds the addresses it found that the line lacks (making `.env.local` from
`.env.example` when it is absent) and keeps the file's other lines and
entries; `bash scripts/setup.sh` runs it. Restart the dev server after a
change. The lab server is not Next and needs no entry.

**A machine's address never goes into the repo**: not in `.env.example`,
a doc, a test, a commit message or a pull request. Each developer's
`.env.local` holds their own, found when they need it.

## Stopping a server

- **By port, then by pid.** Next renames its process to `next-server`
  ([deploy.md](deploy.md#what-the-host-needs-besides-the-package)), so a
  pattern on `next dev` can miss it. Find what holds the port, then kill
  that pid:

  ```bash
  ss -ltnp 'sport = :8000'          # Linux
  lsof -iTCP:8000 -sTCP:LISTEN      # macOS
  kill <pid>
  ```

- **By name, bracketed.** `pkill -f "[n]ext dev"` matches the server and
  not the shell that runs `pkill`, whose own command line contains the
  pattern.
- **Never start and kill in one command line**: the kill's pattern
  matches the shell running that line, and takes it down with the
  server.
- A server started in an editor's terminal panel stops with Ctrl-C there.

## When the dev server will not serve

The Turbopack cache after a production build, a removed route in
`validator.ts`, a utility the dev page lacks: each has a one-line fix in
[design.md § When the dev server will not serve](design.md#when-the-dev-server-will-not-serve).

## Old proof baselines

`visual-parity capture --ref` (and `proof`) builds its baseline in a
worktree beside the repo, `../<site>-ref-<sha>`, reused for the same
commit; a baseline of another commit removes the older worktree first
([visual-parity.md](visual-parity.md#where-the-build-comes-from)). When the
work is done, remove the last one and prune the captures:

```bash
git worktree remove ../<site>-ref-<sha>
pnpm kit visual-parity clean --dry-run    # then without --dry-run
```
