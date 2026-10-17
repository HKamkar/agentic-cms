// The hand-over of a route: the wait loop against a fetch stub and a fake
// clock, the error's tail from the two pages next dev answers a 5xx with,
// the URLs on each host, the hosts the origins lack, and which server is
// asked — this clone's next dev by its lock (the pid test and the port
// probe stubbed), never another one on the port. The addresses are the
// documentation ranges (RFC 5737).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DEV_LOCK } from "./dev-server.mjs";
import { devBase, devServerFor, errorTail, formatHandover, handover, missingOrigins, routeUrls, waitForRoute } from "./handover.mjs";

const LAN = "192.0.2.10", PUBLIC = "203.0.113.7";
const INTERFACES = { lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }], eth0: [{ family: "IPv4", address: LAN, internal: false }], docker0: [{ family: "IPv4", address: "198.51.100.1", internal: false }] };
/** The pid this clone's next dev runs as: alive to the kill stub, every other pid gone. */
const PID = 4242;
const kill = (pid) => { if (pid !== PID) throw Object.assign(new Error("ESRCH"), { code: "ESRCH" }); };
/** next dev's lock in the site, as it writes it while it runs. */
const writeLock = (root, { pid = PID, port }) => { fs.mkdirSync(path.join(root, path.dirname(DEV_LOCK)), { recursive: true }); fs.writeFileSync(path.join(root, DEV_LOCK), JSON.stringify({ pid, port, hostname: "localhost", appUrl: `http://localhost:${port}` })); };
/** A port probe that answers on the ports given and records what it was asked. */
function answering(...ports) {
  const asked = [];
  const up = async (port, { host = "localhost" } = {}) => { asked.push([port, host]); return ports.includes(port); };
  return { up, asked };
}

/** A clock that moves only when the loop sleeps, and a fetch that answers from a script of statuses (an Error is a refused connection). */
function stubs(answers, { body = () => "" } = {}) {
  let t = 0;
  const asked = [];
  const fetch = async (url) => {
    const next = answers.length > 1 ? answers.shift() : answers[0];
    asked.push({ url, at: t });
    if (next instanceof Error) throw next;
    return { status: next, text: async () => body(next) };
  };
  return { fetch, asked, now: () => t, sleep: async (ms) => { t += ms; } };
}

test("waitForRoute: a 404 and a refused connection are asked again until the route answers; a redirect is an answer", async () => {
  const s = stubs([404, new Error("ECONNREFUSED"), 404, 200]);
  assert.deepEqual(await waitForRoute("http://localhost:8000/x-demo", { ...s, interval: 500 }), { ready: true, status: 200, tail: null, reached: true, timedOut: false });
  assert.equal(s.asked.length, 4);
  assert.deepEqual(s.asked.map((a) => a.at), [0, 500, 1000, 1500], "every interval");
  const moved = stubs([307]);
  assert.equal((await waitForRoute("http://localhost:8000/x-demo", moved)).ready, true);
});

test("waitForRoute: a 5xx is asked once more after a second, then reported with its tail; a route still taken in answers on the second ask", async () => {
  const failing = stubs([500], { body: () => '<script id="__NEXT_DATA__" type="application/json">{"err":{"message":"Error: Module not found: Can\'t resolve \'@/components/ui/Nope\'"}}</script>' });
  const r = await waitForRoute("http://localhost:8000/x-demo", failing);
  assert.deepEqual(r, { ready: false, status: 500, tail: "Error: Module not found: Can't resolve '@/components/ui/Nope'", reached: true, timedOut: false });
  assert.deepEqual(failing.asked.map((a) => a.at), [0, 1000]);
  const settling = stubs([500, 200]);
  assert.deepEqual(await waitForRoute("http://localhost:8000/x-demo", settling), { ready: true, status: 200, tail: null, reached: true, timedOut: false });
});

test("waitForRoute: past the timeout, the last status — or none, when nothing answered", async () => {
  const lost = stubs([404]);
  assert.deepEqual(await waitForRoute("http://localhost:8000/x-demo", { ...lost, timeout: 3000 }), { ready: false, status: 404, tail: null, reached: true, timedOut: true });
  assert.equal(lost.asked.length, 6, "every 500 ms for 3 s");
  const silent = stubs([new Error("ECONNREFUSED")]);
  assert.deepEqual(await waitForRoute("http://localhost:8000/x-demo", { ...silent, timeout: 1000 }), { ready: false, status: null, tail: null, reached: false, timedOut: true });
});

test("errorTail: a compile error from __NEXT_DATA__, a thrown error from the flight data, else the page's text; colour codes dropped, twelve lines at most", () => {
  const compile = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: {}, err: { name: "Error", message: "./src/app/x-demo/page.tsx:1:1\nError: Module not found: Can't resolve '@/components/ui/Nope'\n\u001b[31m> 1 |\u001b[0m import { Nope } from \"@/components/ui/Nope\";\n" } })}</script></html>`;
  assert.equal(errorTail(compile), "./src/app/x-demo/page.tsx:1:1\nError: Module not found: Can't resolve '@/components/ui/Nope'\n> 1 | import { Nope } from \"@/components/ui/Nope\";");
  const row = `a1:E${JSON.stringify({ digest: "1", name: "TypeError", message: "props.items is undefined", stack: [] })}\n`;
  const thrown = `<html><body><script>self.__next_f.push([0])</script><script>self.__next_f.push(${JSON.stringify([1, "0:{\"P\":null}\n"])})</script><script>self.__next_f.push(${JSON.stringify([1, row])})</script></body></html>`;
  assert.equal(errorTail(thrown), "TypeError: props.items is undefined");
  assert.equal(errorTail("<html><style>p{}</style><body><h1>502</h1><p>Bad gateway</p></body></html>"), "502 Bad gateway");
  assert.doesNotMatch(errorTail("<p>Bad gateway</p><scr<script>x</script>ipt>y</script><<b>p"), /[<>]/, "a removal that joins two halves into a tag removes that one too, and no bracket is left");
  assert.equal(errorTail(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ err: { message: Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n") } })}</script>`).split("\n").length, 12);
});

test("devBase and routeUrls: --url, else localhost on the port of scripts.dev; a loopback base adds the LAN and the public address, any other is itself", () => {
  assert.deepEqual(devBase({ scripts: { dev: "next dev -p 8000" } }), { origin: "http://localhost:8000", host: "localhost", port: 8000 });
  assert.deepEqual(devBase({ url: "http://127.0.0.1:41234/", scripts: {} }), { origin: "http://127.0.0.1:41234", host: "127.0.0.1", port: 41234 });
  assert.equal(devBase({ scripts: { dev: "vite" } }), null);
  assert.deepEqual(routeUrls(devBase({ scripts: { dev: "next dev -p 8000" } }), "/x-demo", { lan: [LAN], publicIp: PUBLIC }), [
    { where: "localhost", url: "http://localhost:8000/x-demo" },
    { where: "LAN", url: `http://${LAN}:8000/x-demo` },
    { where: "public", url: `http://${PUBLIC}:8000/x-demo` },
  ]);
  assert.deepEqual(routeUrls(devBase({ url: "http://dev.example.test:3000" }), "/x-demo", { lan: [LAN] }), [{ where: "dev.example.test", url: "http://dev.example.test:3000/x-demo" }]);
});

test("missingOrigins: the hosts ALLOWED_DEV_ORIGINS in .env.local lacks; localhost needs none", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "handover-"));
  try {
    const urls = [{ url: "http://localhost:8000/x" }, { url: `http://${LAN}:8000/x` }, { url: `http://${PUBLIC}:8000/x` }];
    assert.deepEqual(missingOrigins(root, urls, fs), [LAN, PUBLIC], "no .env.local: every host is missing");
    fs.writeFileSync(path.join(root, ".env.local"), `OTHER=1\nALLOWED_DEV_ORIGINS=${LAN}\n`);
    assert.deepEqual(missingOrigins(root, urls, fs), [PUBLIC]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("handover: no server asks nothing; this clone's running one is asked until the route answers; --no-wait lists the URLs and asks nothing; the public address through the fetch stub", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "handover-"));
  const scripts = { dev: "next dev -p 8000" };
  try {
    let asked = 0;
    const fetch = async (url) => (new URL(url).hostname === "api.ipify.org" ? { ok: true, status: 200, text: async () => `${PUBLIC}\n` } : (asked++, { status: asked < 3 ? 404 : 200, text: async () => "" }));
    const sleep = async () => {};
    const down = await handover({ root, route: "/x-demo", scripts, fs, fetch, interfaces: INTERFACES, up: async () => false, kill, sleep });
    assert.deepEqual([down.server, down.ready, down.status, down.urls, asked], ["down", false, null, [], 0]);
    assert.match(formatHandover(down, "/x-demo").out[0], /^no dev server answers on port 8000: pnpm kit serve starts it, waits for \/x-demo and prints the URLs to hand over$/);

    writeLock(root, { port: 8000 });
    const probe = answering(8000);
    const ready = await handover({ root, route: "/x-demo", scripts, fs, fetch, interfaces: INTERFACES, up: probe.up, kill, sleep });
    assert.deepEqual(probe.asked, [[8000, "localhost"]], "the lock's port, asked once");
    assert.deepEqual([ready.server, ready.ready, ready.status, asked], ["up", true, 200, 3]);
    assert.deepEqual(ready.urls.map((u) => u.url), ["http://localhost:8000/x-demo", `http://${LAN}:8000/x-demo`, `http://${PUBLIC}:8000/x-demo`], "no container bridge");
    assert.deepEqual(ready.missing, [LAN, PUBLIC]);
    const told = formatHandover(ready, "/x-demo");
    assert.deepEqual(told.out, ["/x-demo answers 200 on the dev server; hand over:", "  localhost  http://localhost:8000/x-demo", `  LAN        http://${LAN}:8000/x-demo`, `  public     http://${PUBLIC}:8000/x-demo   answers only where a firewall opens 8000, to the viewer's IP only`]);
    assert.match(told.err[0], new RegExp(`^warning: ALLOWED_DEV_ORIGINS in \\.env\\.local lacks ${LAN.replaceAll(".", "\\.")}: a browser there gets a page that never hydrates; pnpm urls --write adds it`));
    assert.equal(told.exit, 0);

    const unasked = await handover({ root, route: "/x-demo", scripts, wait: false, lookupPublic: false, fs, fetch, interfaces: INTERFACES, up: async () => assert.fail("--no-wait asks nothing"), kill });
    assert.deepEqual([unasked.server, unasked.ready, unasked.status, unasked.urls.length], ["unasked", null, null, 2]);
    assert.match(formatHandover(unasked, "/x-demo").out[0], /not asked for \(--no-wait\)/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("formatHandover: a 5xx prints its tail and exits 1, a stale Turbopack cache adds the fix; a route that never answered exits 1 too", () => {
  const base = { origin: "http://localhost:8000", host: "localhost", port: 8000 };
  const failed = formatHandover({ base, server: "up", ready: false, status: 500, tail: "Error: Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'", reached: true, timeout: 120000, urls: [], missing: [] }, "/x-demo");
  assert.equal(failed.exit, 1);
  assert.deepEqual(failed.err.slice(0, 2), ["/x-demo answered 500 on http://localhost:8000:", "  Error: Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'"]);
  assert.match(failed.err[2], /pnpm kit serve --fix-cache restarts it with \.next\/dev and \.next\/cache\/turbopack cleared/);
  const lost = formatHandover({ base, server: "up", named: false, ready: false, status: 404, tail: null, reached: true, timedOut: true, timeout: 120000, urls: [], missing: [] }, "/x-demo");
  assert.deepEqual([lost.exit, lost.err[0]], [1, "/x-demo still answers 404 on this clone's next dev (http://localhost:8000) after 120 s (--timeout for longer)"]);
  const named = formatHandover({ base, server: "up", named: true, ready: false, status: 404, tail: null, reached: true, timedOut: true, timeout: 120000, urls: [], missing: [] }, "/x-demo");
  assert.deepEqual([named.exit, named.err[0]], [1, "/x-demo still answers 404 on http://localhost:8000 after 120 s: is the server on port 8000 this site's next dev? (.next/dev/lock names the one this site runs)"], "--url names any server: the question stays");
});

test("handover: another server on the port of scripts.dev — no lock, or a lock its pid outlived — is named at once: no wait, no URLs, exit 1", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "handover-"));
  const scripts = { dev: "next dev -p 8000" };
  const fetch = async (url) => assert.fail(`another server is asked nothing: ${url}`);
  const sleep = async () => assert.fail("another server is not waited on");
  try {
    for (const stale of [false, true]) {
      if (stale) writeLock(root, { pid: 4343, port: 8000 });
      const probe = answering(8000);
      const h = await handover({ root, route: "/x-demo", scripts, fs, fetch, interfaces: INTERFACES, up: probe.up, kill, sleep });
      assert.deepEqual([h.server, h.ready, h.status, h.urls, h.missing, h.base.port], ["other", false, null, [], [], 8000], stale ? "a stale lock" : "no lock");
      assert.deepEqual(probe.asked, [[8000, "localhost"]], "the port probed once: a stale lock fails on its pid first");
      const told = formatHandover(h, "/x-demo");
      assert.deepEqual([told.exit, told.out], [1, []]);
      assert.deepEqual(told.err, ["port 8000 answers, but not as this clone's next dev (.next/dev/lock names none running), so /x-demo is not served there: stop what holds the port (docs/dev-server.md § Stopping a server), or serve this clone on another port (pnpm kit serve --port <n> waits for /x-demo and prints its URLs)"]);
    }
    writeLock(root, { port: 8000 });
    const gone = answering();
    const stopped = await devServerFor({ root, scripts, fs, up: gone.up, kill });
    assert.deepEqual([stopped.server, gone.asked], ["down", [[8000, "localhost"], [8000, "localhost"]]], "a live pid whose port answers nothing: no server, whatever the lock says");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("handover: this clone's next dev on another port than scripts.dev names is the one asked, its port on every URL and named", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "handover-"));
  const scripts = { dev: "next dev -p 8000" };
  const asked = [];
  const fetch = async (url) => { asked.push(url); return { status: 200, text: async () => "" }; };
  try {
    writeLock(root, { port: 8100 });
    const probe = answering(8000, 8100);
    const h = await handover({ root, route: "/x-demo", scripts, lookupPublic: false, fs, fetch, interfaces: INTERFACES, up: probe.up, kill, sleep: async () => {} });
    assert.deepEqual([h.server, h.ready, h.base.origin, h.devPort], ["up", true, "http://localhost:8100", 8000]);
    assert.deepEqual(probe.asked, [[8100, "localhost"]], "the port of scripts.dev is not asked: whatever holds it is not this clone's");
    assert.deepEqual(asked, ["http://localhost:8100/x-demo"]);
    assert.deepEqual(formatHandover(h, "/x-demo").out, ["/x-demo answers 200 on this clone's next dev on port 8100 (package.json's scripts.dev names 8000); hand over:", "  localhost  http://localhost:8100/x-demo", `  LAN        http://${LAN}:8100/x-demo`]);

    const unasked = await handover({ root, route: "/x-demo", scripts, wait: false, lookupPublic: false, fs, fetch, interfaces: INTERFACES, up: async () => assert.fail("--no-wait asks nothing"), kill });
    assert.deepEqual([unasked.server, unasked.ready, unasked.urls[0].url], ["unasked", null, "http://localhost:8100/x-demo"], "--no-wait: the lock's live pid names the port");
    assert.equal(formatHandover(unasked, "/x-demo").out[0], "/x-demo not asked for (--no-wait); hand over, once it answers on this clone's next dev on port 8100 (package.json's scripts.dev names 8000):");
    const dead = (pid) => { throw Object.assign(new Error(`ESRCH ${pid}`), { code: "ESRCH" }); };
    assert.equal((await handover({ root, route: "/x-demo", scripts, wait: false, lookupPublic: false, fs, fetch, interfaces: INTERFACES, up: async () => assert.fail("--no-wait asks nothing"), kill: dead })).urls[0].url, "http://localhost:8000/x-demo", "--no-wait, a lock its pid outlived: the port of scripts.dev");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("handover: --url is whatever server it names — no lock read, asked and waited on even with this clone's next dev running elsewhere", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "handover-"));
  const scripts = { dev: "next dev -p 8000" };
  const asked = [];
  const fetch = async (url) => { asked.push(url); return { status: 200, text: async () => "" }; };
  try {
    writeLock(root, { port: 8100 });
    const probe = answering(41234);
    const h = await handover({ root, route: "/x-demo", url: "http://127.0.0.1:41234", scripts, lookupPublic: false, fs, fetch, interfaces: INTERFACES, up: probe.up, kill: () => assert.fail("--url reads no lock"), sleep: async () => {} });
    assert.deepEqual([h.server, h.named, h.ready, h.base.origin], ["up", true, true, "http://127.0.0.1:41234"]);
    assert.deepEqual(probe.asked, [[41234, "127.0.0.1"]]);
    assert.deepEqual(asked, ["http://127.0.0.1:41234/x-demo"]);
    assert.equal(formatHandover(h, "/x-demo").out[0], "/x-demo answers 200 on the dev server; hand over:", "no port named beside --url's");
    const none = await devServerFor({ root, url: "http://127.0.0.1:41234", scripts, fs, up: answering().up, kill: () => assert.fail("--url reads no lock") });
    assert.equal(none.server, "down", "--url's server not answering is down, not another's");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
