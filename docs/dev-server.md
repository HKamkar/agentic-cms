# Serving previews to the owner's devices

The owner judges a design on their own screens: a laptop, a phone, a
tablet. So the dev server and the lab have to be reachable from outside
the machine the agent works on. This page says which ports, which address
to hand over, how to let `next dev` serve that address, and how to stop a
server. Read it before starting a server or handing over a URL; which
browser checks what is [browsers.md](browsers.md). `pnpm urls`
([`agentic-cms urls`](commands.md#urls)) does the finding: this machine's
URLs for both servers, which one answers, and the origins `next dev`
lacks. `pnpm kit serve` ([`agentic-cms serve`](commands.md#serve)) does
the rest: it starts both servers, waits until every page under review
answers, and prints the URLs to hand over in one table.

Nothing here names a machine. An address depends on who is developing and
where, so it is found when it is needed and never written down in the
repo; here it is `<lan-ip>` or `<public-ip>`.

## Ports

| Port | What |
|---|---|
| 8000 | `pnpm dev` (`next dev -p 8000`), or `pnpm kit serve`, on every interface: the site, a round's `/<name>-demo`, the lab's `/lab-demo`. `pnpm preview` serves the Worker on the same port, so run one or the other |
| 8001 | `pnpm kit lab serve`, or `pnpm kit serve` when the lab has a scene, on `0.0.0.0`: the lab's index and each scene at `/scene/<name>` ([lab.md](lab.md)) |

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

## Both servers and every URL: `pnpm kit serve`

The one command before a look: it starts the dev server and the lab,
waits for the pages, and prints every URL to hand over.

```text
serve: next dev on port 8000; the lab on port 8001

                         localhost                             LAN                                   public
dev server
  /                200   http://localhost:8000/                http://<lan-ip>:8000/                 http://<public-ip>:8000/
  /services-demo   200   http://localhost:8000/services-demo   http://<lan-ip>:8000/services-demo    http://<public-ip>:8000/services-demo
lab
  /                      http://localhost:8001/                http://<lan-ip>:8001/                 http://<public-ip>:8001/
  /scene/mark            http://localhost:8001/scene/mark      http://<lan-ip>:8001/scene/mark       http://<public-ip>:8001/scene/mark

public: answers only where a firewall opens ports 8000 and 8001 to the viewer's IP only (the viewer finds theirs at https://ifconfig.me, in the browser they will use)

ALLOWED_DEV_ORIGINS in .env.local covers every address above
hand over the page itself: the route, or each scene's /scene/<name>; Ctrl-C stops both servers
```

- **The origins first.** A host `ALLOWED_DEV_ORIGINS` lacks is named;
  `--write-origins` adds it to `.env.local` before `next dev` starts, so
  it applies with no restart.
- **The dev server** is `next dev` on the port of `scripts.dev`
  (`--port` for another), on every interface. This site's own `next dev`,
  already running (`.next/dev/lock` names its pid and port), is reused,
  and left running when serve stops. Anything else on the port, such as
  another project's server, is refused with exit 2 and never stopped.
- **The lab** starts in the same process when `.parity/lab` has a scene,
  or with `--lab`, on 8001 (`--lab-port`). When that port is taken, serve
  goes on without the lab and says so.
- **The wait.** The site's root and every `*-demo` route (a round's, the
  lab's `/lab-demo`) are asked until each stops answering 404. That
  request compiles the route too, so the owner's first look is neither a
  404 nor a cold compile. A route that answers 5xx is listed with its
  error.
- **A stale cache.** When the dev log shows `Can't resolve
  '@vercel/turbopack-next/internal/…'` ([design.md § When the dev server
  will not serve](design.md#when-the-dev-server-will-not-serve)), serve
  names the fix. With `--fix-cache` it stops the server it started,
  clears `.next/dev` and `.next/cache/turbopack`, starts it again and
  prints the table again, once.
- **Ctrl-C** stops what serve started: `next dev`'s whole process group
  and the lab. Run it where it can be stopped: a terminal the owner sees,
  or an agent's background command that the agent stops before it ends
  its turn.
- `--no-public` skips the public address; `--json` prints each table as
  one JSON line.

`demo new` and `lab route` do the same for the route they write. With the
dev server running, each waits until its route answers, prints its URLs,
and warns about each host missing from `ALLOWED_DEV_ORIGINS`. A 5xx prints
the error's tail and exits 1. With no server running, each says `pnpm kit
serve`. `--no-wait` asks nothing, and `--url` names another server.

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
  So does one `pnpm kit serve` started: serve passes the Ctrl-C to `next
  dev`'s whole process group, and stops the lab.

## When the dev server will not serve

The Turbopack cache after a production build, a removed route in
`validator.ts`, a utility the dev page lacks: each has a one-line fix in
[design.md § When the dev server will not serve](design.md#when-the-dev-server-will-not-serve).
`pnpm kit serve --fix-cache` applies the first one itself.

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
