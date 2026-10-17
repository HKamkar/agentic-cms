// `agentic-cms serve`: the dev server and the lab, started or found running,
// for the owner's devices, and every URL to hand over printed once each
// route answers. In order: the origins (a page from a host
// ALLOWED_DEV_ORIGINS lacks renders and never hydrates; --write-origins adds
// them before next dev starts, so they apply); next dev on the site's port,
// on every interface (this site's own server, found by its lock, is reused
// and left running; anything else on the port is refused, never stopped);
// the lab in-process when .parity/lab has scenes, or with --lab; every
// *-demo route and the site's root asked until it answers, which compiles
// it too; then one table: localhost, LAN and public × the routes, the lab's
// index and each /scene/<name>. The dev log is watched for Turbopack's
// stale cache; --fix-cache clears it and restarts, once. stop() ends what
// serve started. The spawn, the file system, fetch and the network come in,
// so the plan and the run are tested without a server; docs/dev-server.md
// is the guide.
import { listDemos } from "./demo.mjs";
import { DEV_LOCK, STALE_CACHE, STALE_CACHE_DIRS, clearStaleCache, ownDevServer, startDevServer } from "./dev-server.mjs";
import { STALE_CACHE_FIX, waitForRoute } from "./handover.mjs";
import { ENV_FILE, ORIGINS_KEY, devPort, isUp, lanAddresses, originsStatus, publicAddress } from "./hosts.mjs";

export class ServeError extends Error {}

/** What serve will run, from the flags and the tree: the ports, whether the lab starts, the routes to wait for, the scenes to list. Throws a ServeError without a dev port. */
export function servePlan({ root, flags, scripts = {}, scenes = [] }) {
  const port = flags.port ?? devPort(scripts);
  if (!port) throw new ServeError("no dev port: package.json's scripts.dev runs no next dev here; pass --port");
  return {
    port, labPort: flags["lab-port"], lab: Boolean(flags.lab) || scenes.length > 0, scenes,
    routes: ["/", ...listDemos(root).map((name) => `/${name}-demo`)],
    writeOrigins: Boolean(flags["write-origins"]), fixCache: Boolean(flags["fix-cache"]), lookupPublic: !flags["no-public"], timeout: flags.timeout * 1000,
  };
}

/** This site's next dev when one runs (its lock names a live pid and a port that answers), else a new one on the port; a ServeError when something else holds it. */
async function findOrStart({ root, port, fs, up, kill, start }) {
  const own = await ownDevServer({ root, fs, up, kill });
  if (own) return { port: own.port, pid: own.pid, reused: true, server: null };
  if (await up(port)) throw new ServeError(`port ${port} answers, but not as this site's next dev (${DEV_LOCK} names none running): stop what holds it (docs/dev-server.md § Stopping a server), or pass --port <another>`);
  const server = await start(port);
  return { port, pid: server.pid, reused: false, server };
}

/** The lab, started in-process on its port; { port, started: false, taken: true } when something already listens there. */
async function labFor({ root, plan, up, startLab, schemes }) {
  if (!plan.lab) return null;
  if (await up(plan.labPort)) return { port: plan.labPort, started: false, taken: true, server: null };
  const server = await startLab({ root, host: "0.0.0.0", port: plan.labPort, watch: true, schemes });
  return { port: server.port, started: true, taken: false, server };
}

const urlOn = (host, port, route) => `http://${host}:${port}${route}`;

/** The report a table and --json are made from: the servers, the hosts, each route's answer and URLs, the lab's index and scenes, the origins. */
export function serveReport({ plan, dev, lab, hosts, results, origins, restarted = false }) {
  const urls = (port, route) => hosts.map((h) => ({ where: h.where, url: urlOn(h.host, port, route) }));
  return {
    dev: { port: dev.port, pid: dev.pid, started: !dev.reused, reused: dev.reused },
    lab: lab && { port: lab.port, started: lab.started, taken: lab.taken, urls: lab.taken ? [] : urls(lab.port, "/"), scenes: lab.taken ? [] : plan.scenes.map((name) => ({ name, urls: urls(lab.port, `/scene/${name}`) })) },
    hosts,
    routes: plan.routes.map((route, i) => ({ path: route, ready: results[i].ready, status: results[i].status, tail: results[i].tail, urls: urls(dev.port, route) })),
    origins, restarted,
  };
}

/**
 * Runs serve to its first table; resolves to { report, stop, done }. `report` is that table's data, `onReport` gets
 * each later one (after a restart), `done` resolves with { code, message } when the dev server serve started exits on
 * its own, and `stop()` ends what serve started (a reused server is left running); `track(stop)` hands it over before
 * anything starts, for a Ctrl-C mid-way. `start(port, onOutput, onSpawn)` starts next dev (nextDev below),
 * `startLab(options)` the lab (lib/lab-server.mjs); interfaces, fetch and up are the network (lib/hosts.mjs).
 */
export async function startServe({ root, plan, fs, kill = process.kill, start, startLab, schemes, interfaces, fetch = globalThis.fetch, up = isUp, log = () => {}, onReport = () => {}, track = () => {}, sleep, now }) {
  let dev = null, lab = null, phase = "starting", stale = false, fixed = false, advised = false, busy = null, finish;
  const done = new Promise((resolve) => { finish = resolve; });
  const live = new Set();   // every next dev serve spawned and that still runs, the one starting too
  const stop = async () => { phase = "stopping"; lab?.server?.close(); await Promise.all([...live].map((server) => server.stop())); };
  track(stop);

  const lan = lanAddresses(interfaces);
  const publicIp = plan.lookupPublic ? await publicAddress({ fetch }) : null;
  const hosts = [{ where: "localhost", host: "localhost" }, ...lan.map((host) => ({ where: "LAN", host })), ...(publicIp ? [{ where: "public", host: publicIp }] : [])];
  const origins = originsStatus({ root, hosts: hosts.slice(1).map((h) => h.host), write: plan.writeOrigins, fs });

  // A stale cache in the log: noted while serve starts (the first table repairs it), repaired at once while it serves.
  const watch = (text) => {
    if (!STALE_CACHE.test(text)) return;
    stale = true;
    if (phase === "serving" && !busy) {
      busy = repair().then((report) => report && onReport(report))
        .catch((error) => { phase = "stopping"; lab?.server?.close(); finish({ code: 1, message: `next dev did not come back after the cache was cleared: ${error.message}` }); })
        .finally(() => { busy = null; });
    }
  };
  const spawned = (server) => { live.add(server); server.exited.then(() => live.delete(server)); };
  const launch = (port) => start(port, watch, spawned).then((server) => {
    server.exited.then((code) => { if (phase !== "stopping" && dev?.server === server) { phase = "stopping"; lab?.server?.close(); finish({ code: 1, message: `next dev exited (${code}):\n${server.log().slice(-1200)}` }); } });
    return server;
  });
  const waitAll = () => Promise.all(plan.routes.map((route) => waitForRoute(urlOn("localhost", dev.port, route), { fetch, timeout: plan.timeout, sleep, now })));
  const tableOf = (results, restarted) => {
    if (results.some((r) => STALE_CACHE.test(r.tail ?? ""))) stale = true;
    return serveReport({ plan, dev, lab, hosts, results, origins, restarted });
  };

  /** With --fix-cache, on a server serve started, once: stop it, clear the two folders, start it again, wait again; otherwise the fix, said once. */
  async function repair() {
    if (!plan.fixCache || !dev.server || fixed) {
      if (!advised) log(!dev.server ? `${STALE_CACHE_FIX} (this server started before serve, so serve cannot restart it)` : fixed ? `${STALE_CACHE_FIX} (serve cleared the cache once already)` : `${STALE_CACHE_FIX.replace("pnpm kit serve --fix-cache restarts it", "Ctrl-C and pnpm kit serve --fix-cache restart it")}`);
      advised = true;
      return null;
    }
    fixed = true;
    log(`next dev is reading the caches a production build left: restarting it with ${STALE_CACHE_DIRS.join(" and ")} cleared`);
    const old = dev.server;
    dev = { ...dev, server: null };
    await old.stop();
    clearStaleCache(root, fs);
    const server = await launch(dev.port);
    dev = { ...dev, pid: server.pid, server };
    stale = false;
    return tableOf(await waitAll(), true);
  }

  dev = await findOrStart({ root, port: plan.port, fs, up, kill, start: launch });
  try { lab = await labFor({ root, plan, up, startLab, schemes }); } catch (error) { await stop(); throw error; }
  let report = tableOf(await waitAll(), false);
  if (stale) report = (await repair()) ?? report;
  phase = "serving";
  return { report, stop, done };
}

const pad = (rows) => {
  const widths = rows.reduce((w, row) => row.map((cell, i) => Math.max(w[i] ?? 0, cell.length)), []);
  return rows.map((row) => row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i]))).join("  ").trimEnd());
};

/** The report as lines for a person: who runs what, one table — the routes and the lab's pages × localhost, LAN and public — each failure's tail, the firewall note, the origins. */
export function formatServe(report) {
  const { dev, lab, hosts, routes, origins } = report;
  const lines = [];
  const who = dev.reused ? `this site's next dev on port ${dev.port} (pid ${dev.pid}, started before serve: left running)` : `next dev on port ${dev.port}${report.restarted ? " (restarted with a cleared cache)" : ""}`;
  const labLine = !lab ? "no lab (no scene under .parity/lab; --lab starts one)" : lab.taken ? `the lab not started: port ${lab.port} is taken (a lab serve already running? --lab-port <n> for another)` : `the lab on port ${lab.port}`;
  lines.push(`serve: ${who}; ${labLine}`, "");
  const header = ["", "", ...hosts.map((h) => h.where)];
  const rows = [header, ["dev server", "", ...hosts.map(() => "")]];
  for (const r of routes) rows.push([`  ${r.path}`, r.ready ? String(r.status) : r.status ? `${r.status}!` : "no answer", ...r.urls.map((u) => u.url)]);
  if (lab && !lab.taken) {
    rows.push(["lab", "", ...hosts.map(() => "")], ["  /", "", ...lab.urls.map((u) => u.url)]);
    for (const scene of lab.scenes) rows.push([`  /scene/${scene.name}`, "", ...scene.urls.map((u) => u.url)]);
  }
  lines.push(...pad(rows));
  for (const r of routes.filter((route) => !route.ready)) {
    lines.push("", r.tail ? `${r.path} answered ${r.status}:` : r.status ? `${r.path} still answers ${r.status}` : `${r.path} did not answer (--timeout for longer)`);
    if (r.tail) lines.push(...r.tail.split("\n").map((line) => `  ${line}`));
  }
  if (hosts.some((h) => h.where === "public")) lines.push("", `public: answers only where a firewall opens ${lab && !lab.taken ? `ports ${dev.port} and ${lab.port}` : `port ${dev.port}`} to the viewer's IP only (the viewer finds theirs at https://ifconfig.me, in the browser they will use)`);
  lines.push("", originsLine(origins, dev));
  lines.push(`hand over the page itself: the route, or each scene's /scene/<name>; Ctrl-C stops ${dev.reused ? "the lab" : lab?.started ? "both servers" : "the dev server"}`);
  return lines;
}

function originsLine(origins, dev) {
  const where = `${ORIGINS_KEY} in ${ENV_FILE}`;
  if (origins.written.length) return `added ${origins.written.join(", ")} to ${where}${dev.reused ? "; restart the dev server to apply it (it started before they were written)" : ""}`;
  if (!origins.missing.length) return `${where} covers every address above`;
  return `${where} lacks ${origins.missing.join(", ")}: a browser there gets a page that never hydrates; serve --write-origins adds ${origins.missing.length > 1 ? "them" : "it"}`;
}

/** The `start` startServe takes: next dev on every interface (lib/dev-server.mjs), its output to `onOutput`, the server to `onSpawn` once spawned. */
export const nextDev = ({ root, timeout, spawn, kill }) => (port, onOutput, onSpawn) => startDevServer({ root, port, host: null, timeout, spawn, kill, onOutput, onSpawn });
