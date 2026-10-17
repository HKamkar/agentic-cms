// `serve`'s plan and run with everything faked: the dev server (a start that
// hands back fake servers), the lab, the network (interfaces, the port
// probe, a fetch that answers the routes and the public lookup). No port is
// opened. The addresses are the documentation ranges (RFC 5737).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DEV_LOCK } from "./dev-server.mjs";
import { ServeError, formatServe, servePlan, startServe } from "./serve.mjs";

const LAN = "192.0.2.10", PUBLIC = "203.0.113.7";
const INTERFACES = { lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }], eth0: [{ family: "IPv4", address: LAN, internal: false }], "br-1": [{ family: "IPv4", address: "198.51.100.1", internal: false }] };
const FLAGS = { "lab-port": 4101, timeout: 120 };
const SCRIPTS = { dev: "next dev -p 4100" };

function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "serve-"));
  for (const dir of ["src/app/hero-demo", "src/app/lab-demo", "src/app/blog"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  return root;
}

/** A next dev start that hands back fake servers: each one's output said through onOutput, its exit in the test's hands. */
function fakeStart({ say = [] } = {}) {
  const servers = [];
  const start = async (port, onOutput, onSpawn) => {
    let exit;
    const exited = new Promise((resolve) => { exit = resolve; });
    const server = { port, pid: 5000 + servers.length, exited, exit, onOutput, stopped: false, log: () => "the log's tail", stop: async () => { server.stopped = true; exit("SIGTERM"); await exited; } };
    servers.push(server);
    onSpawn(server);
    for (const text of say[servers.length - 1] ?? []) onOutput(text);
    return server;
  };
  return { start, servers };
}

const fakeLab = () => {
  const labs = [];
  return { labs, startLab: async (options) => { const lab = { options, port: options.port, closed: false, close: () => { lab.closed = true; } }; labs.push(lab); return lab; } };
};

/** The network: the public lookup answers PUBLIC, a route answers `status(url)`. */
const network = (status = () => 200, body = () => "") => ({
  interfaces: INTERFACES,
  fetch: async (url) => (new URL(url).hostname === "api.ipify.org" ? { ok: true, status: 200, text: async () => PUBLIC } : { status: status(url), text: async () => body(url) }),
  sleep: async () => {},
});

test("servePlan: the port from scripts.dev (--port wins), the root and every *-demo route, the lab when there are scenes or --lab; no port is a ServeError", () => {
  const root = site();
  try {
    const plan = servePlan({ root, flags: FLAGS, scripts: SCRIPTS, scenes: ["spin"] });
    assert.deepEqual(plan, { port: 4100, labPort: 4101, lab: true, scenes: ["spin"], routes: ["/", "/hero-demo", "/lab-demo"], writeOrigins: false, fixCache: false, lookupPublic: true, timeout: 120000 });
    assert.equal(servePlan({ root, flags: FLAGS, scripts: SCRIPTS }).lab, false, "no scene, no --lab: no lab");
    assert.equal(servePlan({ root, flags: { ...FLAGS, lab: true }, scripts: SCRIPTS }).lab, true);
    assert.equal(servePlan({ root, flags: { ...FLAGS, port: 4200 }, scripts: SCRIPTS }).port, 4200);
    assert.deepEqual(servePlan({ root, flags: { ...FLAGS, "write-origins": true, "fix-cache": true, "no-public": true, timeout: 30 }, scripts: SCRIPTS }).timeout, 30000);
    assert.throws(() => servePlan({ root, flags: FLAGS, scripts: { dev: "vite" } }), (e) => e instanceof ServeError && /no dev port: package\.json's scripts\.dev runs no next dev here; pass --port/.test(e.message));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("startServe: next dev started on the port, the lab with it, every route waited for, one table of localhost, LAN and public; stop() ends both", async () => {
  const root = site();
  try {
    const plan = servePlan({ root, flags: FLAGS, scripts: SCRIPTS, scenes: ["spin"] });
    const dev = fakeStart(), lab = fakeLab();
    const asked = [];
    const net = network((url) => { asked.push(url); return asked.filter((u) => u === url).length < 2 ? 404 : 200; });
    let tracked;
    const run = await startServe({ root, plan, fs, start: dev.start, startLab: lab.startLab, schemes: ["light"], up: async () => false, track: (stop) => { tracked = stop; }, ...net });
    assert.equal(tracked, run.stop, "the stop is handed over before anything starts");
    assert.equal(dev.servers.length, 1);
    assert.deepEqual(lab.labs[0].options, { root, host: "0.0.0.0", port: 4101, watch: true, schemes: ["light"] });
    assert.deepEqual([...new Set(asked)], ["http://localhost:4100/", "http://localhost:4100/hero-demo", "http://localhost:4100/lab-demo"], "each asked until it stopped answering 404");
    const { report } = run;
    assert.deepEqual(report.dev, { port: 4100, pid: 5000, started: true, reused: false });
    assert.deepEqual(report.hosts, [{ where: "localhost", host: "localhost" }, { where: "LAN", host: LAN }, { where: "public", host: PUBLIC }], "no bridge");
    assert.deepEqual(report.routes[1], { path: "/hero-demo", ready: true, status: 200, tail: null, urls: [{ where: "localhost", url: "http://localhost:4100/hero-demo" }, { where: "LAN", url: `http://${LAN}:4100/hero-demo` }, { where: "public", url: `http://${PUBLIC}:4100/hero-demo` }] });
    assert.deepEqual(report.lab.scenes, [{ name: "spin", urls: [{ where: "localhost", url: "http://localhost:4101/scene/spin" }, { where: "LAN", url: `http://${LAN}:4101/scene/spin` }, { where: "public", url: `http://${PUBLIC}:4101/scene/spin` }] }]);
    assert.deepEqual(report.origins.missing, [LAN, PUBLIC]);

    const lines = formatServe(report);
    assert.equal(lines[0], "serve: next dev on port 4100; the lab on port 4101");
    assert.match(lines[2], /^\s+localhost\s+LAN\s+public$/);
    assert.ok(lines.includes("dev server"));
    assert.ok(lines.some((l) => new RegExp(`^  /hero-demo\\s+200\\s+http://localhost:4100/hero-demo\\s+http://${LAN.replaceAll(".", "\\.")}:4100/hero-demo\\s+http://${PUBLIC.replaceAll(".", "\\.")}:4100/hero-demo$`).test(l)), lines.join("\n"));
    assert.ok(lines.some((l) => /^  \/scene\/spin\s+http:\/\/localhost:4101\/scene\/spin/.test(l)));
    assert.ok(lines.includes("public: answers only where a firewall opens ports 4100 and 4101 to the viewer's IP only (the viewer finds theirs at https://ifconfig.me, in the browser they will use)"));
    assert.ok(lines.includes(`ALLOWED_DEV_ORIGINS in .env.local lacks ${LAN}, ${PUBLIC}: a browser there gets a page that never hydrates; serve --write-origins adds them`));
    assert.equal(lines.at(-1), "hand over the page itself: the route, or each scene's /scene/<name>; Ctrl-C stops both servers");

    await run.stop();
    assert.ok(dev.servers[0].stopped && lab.labs[0].closed);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("startServe: this site's next dev, found by its lock, is reused and left running; anything else on the port is refused; a taken lab port leaves the lab out", async () => {
  const root = site();
  try {
    const plan = servePlan({ root, flags: { ...FLAGS, "no-public": true }, scripts: SCRIPTS, scenes: ["spin"] });
    const dev = fakeStart(), lab = fakeLab();
    const refused = startServe({ root, plan, fs, start: dev.start, startLab: lab.startLab, up: async (port) => port === 4100, ...network() });
    await assert.rejects(refused, (e) => e instanceof ServeError && /^port 4100 answers, but not as this site's next dev \(\.next\/dev\/lock names none running\): stop what holds it/.test(e.message));
    assert.equal(dev.servers.length, 0, "never started, never stopped");

    fs.mkdirSync(path.join(root, ".next/dev"), { recursive: true });
    fs.writeFileSync(path.join(root, DEV_LOCK), JSON.stringify({ pid: process.pid, port: 4102, appUrl: "http://localhost:4102" }));
    const run = await startServe({ root, plan, fs, start: dev.start, startLab: lab.startLab, up: async (port) => port === 4102 || port === 4101, ...network() });
    assert.equal(dev.servers.length, 0, "reused, not started");
    assert.deepEqual(run.report.dev, { port: 4102, pid: process.pid, started: false, reused: true });
    assert.equal(run.report.routes[0].urls[0].url, "http://localhost:4102/", "on the port its lock names");
    assert.deepEqual([run.report.lab.taken, run.report.lab.scenes], [true, []]);
    assert.equal(lab.labs.length, 0);
    const lines = formatServe(run.report);
    assert.equal(lines[0], `serve: this site's next dev on port 4102 (pid ${process.pid}, started before serve: left running); the lab not started: port 4101 is taken (a lab serve already running? --lab-port <n> for another)`);
    assert.ok(!lines.some((l) => l.startsWith("public:")), "no public address looked up: no firewall line");
    assert.equal(lines.at(-1), "hand over the page itself: the route, or each scene's /scene/<name>; Ctrl-C stops the lab");
    await run.stop();
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("startServe --write-origins: the missing hosts written before next dev starts; the line says so", async () => {
  const root = site();
  try {
    const plan = servePlan({ root, flags: { ...FLAGS, "write-origins": true }, scripts: SCRIPTS });
    let envAtStart;
    const dev = fakeStart();
    const start = (...args) => { envAtStart = fs.readFileSync(path.join(root, ".env.local"), "utf8"); return dev.start(...args); };
    const run = await startServe({ root, plan, fs, start, startLab: fakeLab().startLab, up: async () => false, ...network() });
    assert.equal(envAtStart, `ALLOWED_DEV_ORIGINS=${LAN},${PUBLIC}\n`);
    assert.deepEqual(run.report.origins.written, [LAN, PUBLIC]);
    assert.ok(formatServe(run.report).includes(`added ${LAN}, ${PUBLIC} to ALLOWED_DEV_ORIGINS in .env.local`));
    assert.equal(run.report.lab, null);
    await run.stop();
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

const STALE = "Error: Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'";
const staleBody = () => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ err: { message: STALE } })}</script>`;

test("startServe --fix-cache: a stale Turbopack cache in the log, then 500s — the server stopped, .next/dev and .next/cache/turbopack cleared, started again, waited for again", async () => {
  const root = site();
  try {
    for (const dir of [".next/dev/server", ".next/cache/turbopack", ".next/cache/images"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
    const plan = servePlan({ root, flags: { ...FLAGS, "fix-cache": true, "no-public": true }, scripts: SCRIPTS });
    const dev = fakeStart({ say: [[` ⨯ ${STALE}\n`]] });
    const said = [];
    const net = network(() => (dev.servers.length === 1 ? 500 : 200), staleBody);
    const run = await startServe({ root, plan, fs, start: dev.start, startLab: fakeLab().startLab, up: async () => false, log: (l) => said.push(l), ...net });
    assert.equal(dev.servers.length, 2);
    assert.ok(dev.servers[0].stopped && !dev.servers[1].stopped);
    assert.deepEqual(fs.readdirSync(path.join(root, ".next/cache")), ["images"], "the two folders, nothing else");
    assert.ok(!fs.existsSync(path.join(root, ".next/dev")));
    assert.deepEqual(said, ["next dev is reading the caches a production build left: restarting it with .next/dev and .next/cache/turbopack cleared"]);
    assert.deepEqual([run.report.restarted, run.report.dev.pid, run.report.routes.every((r) => r.ready)], [true, 5001, true]);
    assert.match(formatServe(run.report)[0], /^serve: next dev on port 4100 \(restarted with a cleared cache\)/);
    await run.stop();
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("startServe without --fix-cache: the stale cache is named with its fix once and nothing restarts; while serving, --fix-cache repairs it and hands the new table over", async () => {
  const root = site();
  try {
    const plain = servePlan({ root, flags: { ...FLAGS, "no-public": true }, scripts: SCRIPTS });
    const dev = fakeStart({ say: [[` ⨯ ${STALE}\n`]] });
    const said = [];
    const run = await startServe({ root, plan: plain, fs, start: dev.start, startLab: fakeLab().startLab, up: async () => false, log: (l) => said.push(l), ...network(() => 500, staleBody) });
    assert.equal(dev.servers.length, 1);
    assert.equal(said.length, 1);
    assert.match(said[0], /Ctrl-C and pnpm kit serve --fix-cache restart it with \.next\/dev and \.next\/cache\/turbopack cleared/);
    assert.deepEqual([run.report.routes[0].ready, run.report.routes[0].status, run.report.routes[0].tail], [false, 500, STALE]);
    const lines = formatServe(run.report);
    assert.ok(lines.some((l) => /^ {2}\/hero-demo\s+500!/.test(l)));
    assert.ok(lines.includes("/hero-demo answered 500:") && lines.includes(`  ${STALE}`));
    await run.stop();

    const fixing = servePlan({ root, flags: { ...FLAGS, "fix-cache": true, "no-public": true }, scripts: SCRIPTS });
    const later = fakeStart();
    const reports = [];
    const serving = await startServe({ root, plan: fixing, fs, start: later.start, startLab: fakeLab().startLab, up: async () => false, onReport: (r) => reports.push(r), ...network() });
    assert.equal(serving.report.restarted, false);
    later.servers[0].onOutput(` ⨯ ${STALE}\n`);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(later.servers.length, 2);
    assert.deepEqual([reports.length, reports[0]?.restarted], [1, true]);
    await serving.stop();
    assert.ok(later.servers[1].stopped, "stop() ends the server that replaced the first");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("startServe --fix-cache while serving: a restart that fails ends serve with code 1 and the reason, the lab closed", async () => {
  const root = site();
  try {
    const plan = servePlan({ root, flags: { ...FLAGS, lab: true, "fix-cache": true, "no-public": true }, scripts: SCRIPTS });
    const dev = fakeStart(), lab = fakeLab();
    const start = (port, onOutput, onSpawn) => (dev.servers.length ? Promise.reject(new Error("next dev exited (1) before it was ready")) : dev.start(port, onOutput, onSpawn));
    const run = await startServe({ root, plan, fs, start, startLab: lab.startLab, up: async () => false, ...network() });
    dev.servers[0].onOutput(` ⨯ ${STALE}\n`);
    assert.deepEqual(await run.done, { code: 1, message: "next dev did not come back after the cache was cleared: next dev exited (1) before it was ready" });
    assert.ok(dev.servers[0].stopped && lab.labs[0].closed);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("startServe: the dev server exiting on its own ends serve with code 1 and its log's tail; the lab closes with it", async () => {
  const root = site();
  try {
    const plan = servePlan({ root, flags: { ...FLAGS, lab: true, "no-public": true }, scripts: SCRIPTS });
    const dev = fakeStart(), lab = fakeLab();
    const run = await startServe({ root, plan, fs, start: dev.start, startLab: lab.startLab, up: async () => false, ...network() });
    dev.servers[0].exit(1);
    assert.deepEqual(await run.done, { code: 1, message: "next dev exited (1):\nthe log's tail" });
    assert.ok(lab.labs[0].closed);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
