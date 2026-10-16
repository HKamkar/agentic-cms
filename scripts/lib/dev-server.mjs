// next dev for a command: the site's own Next on the site's port, on every
// interface (or the one given), resolved once it prints "Ready in", its
// output read as it comes, and stopped with its whole process group — next
// dev forks workers that a signal to the parent alone would leave holding
// the port. `serve` runs it for the owner's devices; the browser tests
// (scripts/browser/dev-server.mjs) on a free loopback port. Also what tells
// this site's server from another one on the port (next dev's own lock,
// .next/dev/lock, names its pid and port), for serve, urls and setup alike,
// and the stale Turbopack cache a production build leaves behind
// (docs/design.md § When the dev server will not serve). The spawn and the
// signals come in, so a test fakes the child.
import { spawn as nodeSpawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

/** The line next dev prints once it listens. */
export const READY = /Ready in/;
/** What every page fails to compile with when next dev reads the caches a `next build` left: the fix is the two folders below gone. */
export const STALE_CACHE = /Can't resolve '@vercel\/turbopack-next\/internal\//;
export const STALE_CACHE_DIRS = [".next/dev", ".next/cache/turbopack"];
/** next dev's lock: JSON with its pid and port while it runs (left behind, unlocked, after it exits). */
export const DEV_LOCK = ".next/dev/lock";

/** The site's next binary, or null when next is not installed there. */
export function nextBin(root) {
  try { return createRequire(path.join(root, "package.json")).resolve("next/dist/bin/next"); } catch { return null; }
}

/** A port nothing listens on, from the system. */
export const freePort = (host = "127.0.0.1") => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, host, () => { const { port } = server.address(); server.close(() => resolve(port)); });
});

/** next dev's lock in the site, parsed: { pid, port, appUrl, … }, or null. */
export function readDevLock(root, fs) {
  try { const lock = JSON.parse(fs.readFileSync(path.join(root, DEV_LOCK), "utf8")); return Number.isInteger(lock?.pid) && Number.isInteger(lock?.port) ? lock : null; } catch { return null; }
}

/** Whether a process runs: signal 0 tests without sending; EPERM is a process of another user's, alive. */
export function processAlive(pid, kill = process.kill) {
  try { kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

/**
 * This site's own next dev while it runs, as its lock ({ pid, port, … }), else null: the lock names a live pid and
 * its port answers to `up` (hosts.mjs's isUp). Whatever else answers on a port, another checkout's server or
 * another project's, is not it: serve reuses this one and refuses the rest, urls and setup call only this one running.
 */
export async function ownDevServer({ root, fs, up, kill = process.kill }) {
  const lock = readDevLock(root, fs);
  return lock && processAlive(lock.pid, kill) && (await up(lock.port)) ? lock : null;
}

/** Removes the caches a production build leaves next dev to misread; the folders that were there. */
export function clearStaleCache(root, fs) {
  const removed = STALE_CACHE_DIRS.filter((dir) => fs.existsSync(path.join(root, dir)));
  for (const dir of removed) fs.rmSync(path.join(root, dir), { recursive: true, force: true });
  return removed;
}

/** A signal to the child's whole process group (it was spawned detached, so it leads one); the child alone where groups do not exist. */
const signalGroup = (child, signal, kill) => { try { kill(-child.pid, signal); } catch { try { child.kill(signal); } catch { /* gone already */ } } };

/**
 * Starts next dev and resolves once it is ready: { url, port, pid, log(), exited, stop() }. `host` null listens on
 * every interface (next dev's own default, what a phone on the LAN needs); `onOutput` gets every chunk of its stdout
 * and stderr; `onSpawn` gets the server as soon as it is spawned (to stop one a Ctrl-C catches while it starts);
 * `exited` resolves with its exit code; `stop()` sends the group SIGTERM, then SIGKILL after `grace` ms, and
 * resolves once it exited. Rejects with the log's tail when it exits first or is not ready within `timeout` ms.
 */
export function startDevServer({ root, port, host = null, env = {}, timeout = 120000, grace = 5000, spawn = nodeSpawn, kill = process.kill, bin = nextBin(root), onOutput = () => {}, onSpawn = () => {} }) {
  if (!bin) return Promise.reject(new Error(`next is not installed in ${root} (pnpm install)`));
  const args = [bin, "dev", "-p", String(port), ...(host ? ["-H", host] : [])];
  const child = spawn(process.execPath, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, ...env } });
  let log = "", ready = false;
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve(code ?? signal)));
  const tail = () => log.slice(-1200);
  const server = {
    url: `http://${host && host !== "0.0.0.0" && host !== "::" ? host : "localhost"}:${port}`,
    port, pid: child.pid, exited, log: () => log,
    stop: () => {
      signalGroup(child, "SIGTERM", kill);
      const force = setTimeout(() => signalGroup(child, "SIGKILL", kill), grace);
      return exited.then(() => clearTimeout(force));
    },
  };
  onSpawn(server);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { server.stop(); reject(new Error(`next dev was not ready in ${Math.round(timeout / 1000)} s:\n${tail()}`)); }, timeout);
    const read = (chunk) => {
      const text = String(chunk);
      log += text;
      onOutput(text);
      if (!ready && READY.test(log)) { ready = true; clearTimeout(timer); resolve(server); }
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    exited.then((code) => { if (!ready) { clearTimeout(timer); reject(new Error(`next dev exited (${code}) before it was ready:\n${tail()}`)); } });
  });
}
