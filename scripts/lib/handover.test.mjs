// The hand-over of a route: the wait loop against a fetch stub and a fake
// clock, the error's tail from the two pages next dev answers a 5xx with,
// the URLs on each host, and the hosts the origins lack. The addresses are
// the documentation ranges (RFC 5737).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { devBase, errorTail, formatHandover, handover, missingOrigins, routeUrls, waitForRoute } from "./handover.mjs";

const LAN = "192.0.2.10", PUBLIC = "203.0.113.7";
const INTERFACES = { lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }], eth0: [{ family: "IPv4", address: LAN, internal: false }], docker0: [{ family: "IPv4", address: "198.51.100.1", internal: false }] };

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

test("handover: no server asks nothing; a running one is asked until the route answers; --no-wait lists the URLs and asks nothing; the public address through the fetch stub", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "handover-"));
  const scripts = { dev: "next dev -p 8000" };
  try {
    let asked = 0;
    const fetch = async (url) => (url.startsWith("https://api.ipify.org") ? { ok: true, status: 200, text: async () => `${PUBLIC}\n` } : (asked++, { status: asked < 3 ? 404 : 200, text: async () => "" }));
    const sleep = async () => {};
    const down = await handover({ root, route: "/x-demo", scripts, fs, fetch, interfaces: INTERFACES, up: async () => false, sleep });
    assert.deepEqual([down.server, down.ready, down.status, down.urls, asked], ["down", false, null, [], 0]);
    assert.match(formatHandover(down, "/x-demo").out[0], /^no dev server answers on port 8000: pnpm kit serve starts it, waits for \/x-demo and prints the URLs to hand over$/);

    let port;
    const up = async (p, { host }) => { port = [p, host]; return true; };
    const ready = await handover({ root, route: "/x-demo", scripts, fs, fetch, interfaces: INTERFACES, up, sleep });
    assert.deepEqual(port, [8000, "localhost"]);
    assert.deepEqual([ready.server, ready.ready, ready.status, asked], ["up", true, 200, 3]);
    assert.deepEqual(ready.urls.map((u) => u.url), ["http://localhost:8000/x-demo", `http://${LAN}:8000/x-demo`, `http://${PUBLIC}:8000/x-demo`], "no container bridge");
    assert.deepEqual(ready.missing, [LAN, PUBLIC]);
    const told = formatHandover(ready, "/x-demo");
    assert.deepEqual(told.out, ["/x-demo answers 200 on the dev server; hand over:", "  localhost  http://localhost:8000/x-demo", `  LAN        http://${LAN}:8000/x-demo`, `  public     http://${PUBLIC}:8000/x-demo   answers only where a firewall opens 8000, to the viewer's IP only`]);
    assert.match(told.err[0], new RegExp(`^warning: ALLOWED_DEV_ORIGINS in \\.env\\.local lacks ${LAN.replaceAll(".", "\\.")}: a browser there gets a page that never hydrates; pnpm urls --write adds it`));
    assert.equal(told.exit, 0);

    const unasked = await handover({ root, route: "/x-demo", scripts, wait: false, lookupPublic: false, fs, fetch, interfaces: INTERFACES, up: async () => assert.fail("--no-wait asks nothing") });
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
  const lost = formatHandover({ base, server: "up", ready: false, status: 404, tail: null, reached: true, timedOut: true, timeout: 120000, urls: [], missing: [] }, "/x-demo");
  assert.deepEqual([lost.exit, lost.err[0]], [1, "/x-demo still answers 404 on http://localhost:8000 after 120 s: is the server on port 8000 this site's next dev? (.next/dev/lock names the one this site runs)"]);
});
