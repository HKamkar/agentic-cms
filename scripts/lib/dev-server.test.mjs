// next dev for a command, against a fake child: ready on "Ready in", every
// interface unless a host is given, the process group stopped, the log's
// tail when it exits first; next dev's lock, a live pid, the stale caches.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import net from "node:net";
import { DEV_LOCK, FREE_PORT_RANGE, clearStaleCache, freePorts, ownDevServer, processAlive, readDevLock, startDevServer } from "./dev-server.mjs";

/** A spawn that hands back fake children, and a kill that ends a child when its group is sent a signal. */
function fakes({ say = [" ✓ Ready in 812ms\n"], exitFirst = null } = {}) {
  const children = [], signals = [];
  const spawn = (command, args, options) => {
    const child = Object.assign(new EventEmitter(), { pid: 7000 + children.length, stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => {}, command, args, options });
    children.push(child);
    setImmediate(() => { for (const line of say) child.stdout.emit("data", Buffer.from(line)); if (exitFirst !== null) child.emit("exit", exitFirst, null); });
    return child;
  };
  const kill = (pid, signal) => { signals.push([pid, signal]); const child = children.find((c) => c.pid === -pid); if (child) setImmediate(() => child.emit("exit", null, signal)); };
  return { spawn, kill, children, signals };
}

test("startDevServer: the site's next on the port, every interface by default, ready on its line; stop() signals the whole group and resolves on exit", async () => {
  const f = fakes({ say: ["   ▲ Next.js 16\n", " ✓ Ready in 812ms\n"] });
  const output = [], spawned = [];
  const server = await startDevServer({ root: "/site", port: 4100, bin: "/site/node_modules/next/dist/bin/next", spawn: f.spawn, kill: f.kill, onOutput: (t) => output.push(t), onSpawn: (s) => spawned.push(s) });
  const [child] = f.children;
  assert.deepEqual(child.args, ["/site/node_modules/next/dist/bin/next", "dev", "-p", "4100"], "no -H: next dev's own default, every interface");
  assert.deepEqual([child.options.cwd, child.options.detached], ["/site", true], "its own process group");
  assert.deepEqual([server.url, server.port, server.pid], ["http://localhost:4100", 4100, 7000]);
  assert.equal(spawned[0], server, "handed over as soon as it is spawned");
  assert.match(output.join(""), /Ready in 812ms/);
  await server.stop();
  assert.deepEqual(f.signals, [[-7000, "SIGTERM"]], "the group, not the parent alone");
  const loopback = await startDevServer({ root: "/site", port: 4101, host: "127.0.0.1", bin: "next", spawn: f.spawn, kill: f.kill });
  assert.deepEqual(f.children[1].args.slice(-2), ["-H", "127.0.0.1"]);
  assert.equal(loopback.url, "http://127.0.0.1:4101");
  await loopback.stop();
});

test("startDevServer: exiting before it is ready rejects with the log's tail; no next installed rejects naming the install", async () => {
  const f = fakes({ say: ["Error: Another next dev server is already running.\n"], exitFirst: 1 });
  await assert.rejects(startDevServer({ root: "/site", port: 4100, bin: "next", spawn: f.spawn, kill: f.kill }), /next dev exited \(1\) before it was ready:\nError: Another next dev server is already running\./);
  await assert.rejects(startDevServer({ root: "/site", port: 4100, bin: null }), /next is not installed in \/site \(pnpm install\)/);
  const taken = fakes({ say: ["Error: listen EADDRINUSE: address already in use :::4100\n"], exitFirst: 1 });
  await assert.rejects(startDevServer({ root: "/site", port: 4100, bin: "next", spawn: taken.spawn, kill: taken.kill }), /^Error: next dev exited \(1\) before it was ready: port 4100 is taken, something else listens on it:\nError: listen EADDRINUSE/);
});

const listening = (port) => new Promise((resolve, reject) => { const server = net.createServer().once("error", reject); server.listen({ port, exclusive: true }, () => resolve(server)); });
const closed = (server) => new Promise((resolve) => server.close(resolve));

test("freePorts: distinct ports below the ephemeral range, free on every interface once returned; a held port is skipped; a full range throws", async () => {
  const [a, b] = await freePorts(2);
  assert.notEqual(a, b);
  assert.ok([a, b].every((port) => port >= FREE_PORT_RANGE[0] && port <= FREE_PORT_RANGE[1]), `${a}, ${b}`);
  const servers = [await listening(a), await listening(b)];   // both closed again: a server can start on each
  await closed(servers[1]);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const picks = [a === lo ? 0 : 0.99999, a === lo ? 0.99999 : 0];   // the held one first, then the other
  try {
    assert.deepEqual(await freePorts(1, { range: [lo, hi], random: () => picks.shift() }), [b]);
    await assert.rejects(freePorts(1, { range: [a, a], tries: 5 }), new RegExp(`0 of 1 free ports found between ${a} and ${a} in 5 tries`));
  } finally {
    await closed(servers[0]);
  }
});

test("ownDevServer: this site's next dev only while its lock names a live pid on a port that answers; another server on the port, a stale lock, no lock are none", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dev-server-"));
  const kill = (pid) => { if (pid !== 4242) throw Object.assign(new Error("ESRCH"), { code: "ESRCH" }); };
  const answering = (...ports) => async (port) => ports.includes(port);
  try {
    assert.equal(await ownDevServer({ root, fs, kill, up: answering(8000) }), null, "no lock: whatever answers on 8000 is not this site's");
    fs.mkdirSync(path.join(root, ".next/dev"), { recursive: true });
    fs.writeFileSync(path.join(root, DEV_LOCK), JSON.stringify({ pid: 4242, port: 8000, appUrl: "http://localhost:8000" }));
    assert.deepEqual(await ownDevServer({ root, fs, kill, up: answering(8000) }), { pid: 4242, port: 8000, appUrl: "http://localhost:8000" });
    assert.equal(await ownDevServer({ root, fs, kill, up: answering() }), null, "its port answers nothing: it stopped");
    fs.writeFileSync(path.join(root, DEV_LOCK), JSON.stringify({ pid: 4343, port: 8000 }));
    assert.equal(await ownDevServer({ root, fs, kill, up: answering(8000) }), null, "a lock left by a server that exited: the one on 8000 is another");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("readDevLock, processAlive, clearStaleCache: next dev's lock read, a pid tested without a signal, the two cache folders removed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dev-server-"));
  try {
    assert.equal(readDevLock(root, fs), null);
    fs.mkdirSync(path.join(root, ".next/dev"), { recursive: true });
    fs.writeFileSync(path.join(root, DEV_LOCK), JSON.stringify({ pid: 1234, port: 8000, hostname: "localhost", appUrl: "http://localhost:8000", startedAt: 1 }));
    assert.deepEqual(readDevLock(root, fs), { pid: 1234, port: 8000, hostname: "localhost", appUrl: "http://localhost:8000", startedAt: 1 });
    fs.writeFileSync(path.join(root, DEV_LOCK), "");
    assert.equal(readDevLock(root, fs), null, "an empty lock is no server");
    assert.equal(processAlive(process.pid), true);
    assert.equal(processAlive(1, () => { throw Object.assign(new Error("EPERM"), { code: "EPERM" }); }), true, "another user's process is alive");
    assert.equal(processAlive(99999999, () => { throw Object.assign(new Error("ESRCH"), { code: "ESRCH" }); }), false);
    fs.mkdirSync(path.join(root, ".next/cache/turbopack"), { recursive: true });
    fs.mkdirSync(path.join(root, ".next/server"), { recursive: true });
    assert.deepEqual(clearStaleCache(root, fs), [".next/dev", ".next/cache/turbopack"]);
    assert.deepEqual(fs.readdirSync(path.join(root, ".next")).sort(), ["cache", "server"], "the build's own output stays");
    assert.deepEqual(clearStaleCache(root, fs), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
