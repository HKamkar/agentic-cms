// A route handed over to the owner: the wait until the dev server answers
// it, the error's tail when it answers 5xx, and the URLs to hand over with
// the hosts ALLOWED_DEV_ORIGINS lacks. A route `demo new` or `lab route` has
// just written answers 404 until next dev has seen its file, then compiles
// on the first request that reaches it, so the wait is the warm-up too: the
// owner's first look is neither a 404 nor a cold compile. `demo new`, `lab
// route` and `serve` print it; lib/hosts.mjs finds the addresses. fetch, the
// clock and the network come in, so a test stubs them.
import path from "node:path";
import { STALE_CACHE } from "./dev-server.mjs";
import { ENV_FILE, ORIGINS_KEY, devPort, isUp, lanAddresses, publicAddress, readOrigins, urlsOn } from "./hosts.mjs";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ANSI = /\u001b\[[0-9;]*m/g;
export const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Asks for the URL until it stops answering 404: { ready, status, tail, reached, timedOut }. Ready is an answer below
 * 500 (a page, a redirect). A 5xx is asked once more after a second (a file next dev is still taking in) and then
 * reported with its error's tail. No answer at all (a server starting or restarting) and a 404 are asked again every
 * `interval` ms until `timeout` ms have passed; `reached` says whether the server answered at all.
 */
export async function waitForRoute(url, { fetch = globalThis.fetch, timeout = 120000, interval = 500, sleep = pause, now = Date.now } = {}) {
  const end = now() + timeout;
  let status = null, asked5xx = false;
  for (;;) {
    const left = end - now();
    if (left <= 0) return { ready: false, status, tail: null, reached: status !== null, timedOut: true };
    let body = "";
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(left) });
      status = res.status;
      body = await res.text();
    } catch { await sleep(interval); continue; }
    if (status >= 500 && !asked5xx) { asked5xx = true; await sleep(1000); continue; }
    if (status >= 500) return { ready: false, status, tail: errorTail(body), reached: true, timedOut: false };
    if (status !== 404) return { ready: true, status, tail: null, reached: true, timedOut: false };
    await sleep(interval);
  }
}

/** The message of a compile error next dev renders as its pages-router error page: __NEXT_DATA__'s err. */
function nextDataError(body) {
  const data = body.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  try { return data ? JSON.parse(data[1]).err?.message ?? null : null; } catch { return null; }
}

/** The error a server component threw, from the page's flight data: a row `<id>:E{"name","message",…}`. */
function flightError(body) {
  let flight = "";
  for (const push of body.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try { const [kind, text] = JSON.parse(push[1]); if (kind === 1 && typeof text === "string") flight += text; } catch { /* another kind of row */ }
  }
  for (const row of flight.split("\n")) {
    const error = row.match(/^[0-9a-f]+:E(\{.*\})$/);
    try { const e = error && JSON.parse(error[1]); if (e?.message) return `${e.name ?? "Error"}: ${e.message}`; } catch { /* not JSON after all */ }
  }
  return null;
}

/** The first lines of the error a 5xx page carries, without colour codes; the page's text when it carries none Next writes. */
export function errorTail(body, { lines = 12 } = {}) {
  const text = nextDataError(body) ?? flightError(body) ?? body.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim().slice(-800);
  return text.replace(ANSI, "").split("\n").map((line) => line.trimEnd()).filter((line) => line.trim()).slice(0, lines).join("\n");
}

/** Where the dev server is: --url's origin, else localhost on the port of package.json's scripts.dev; null with neither. */
export function devBase({ url, scripts }) {
  if (url) { const u = new URL(url); return { origin: u.origin, host: u.hostname, port: Number(u.port) || (u.protocol === "https:" ? 443 : 80) }; }
  const port = devPort(scripts);
  return port ? { origin: `http://localhost:${port}`, host: "localhost", port } : null;
}

/** The URLs a route is handed over at: from a loopback base, localhost, each LAN address and the public one on its port; from any other, that base alone. */
export function routeUrls(base, route, { lan = [], publicIp = null } = {}) {
  if (!LOOPBACK.has(base.host)) return [{ where: base.host, url: `${base.origin}${route}` }];
  return urlsOn(base.port, { lan, publicIp }).map((u) => ({ ...u, url: `${u.url}${route}` }));
}

/** The hosts of those URLs that ALLOWED_DEV_ORIGINS in .env.local does not list; localhost needs no entry. */
export function missingOrigins(root, urls, fs) {
  const file = path.join(root, ENV_FILE);
  const listed = readOrigins(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
  return [...new Set(urls.map((u) => new URL(u.url).hostname))].filter((host) => !LOOPBACK.has(host) && !listed.includes(host));
}

/**
 * A route just written, handed over: whether a dev server listens (on --url, else the port of scripts.dev), the wait
 * until the route answers (none with `wait` false), and its URLs with the hosts the origins lack.
 * { base, server: up|down|unasked, ready: true|false|null, status, tail, reached, timedOut, timeout, urls, missing }
 */
export async function handover({ root, route, url, scripts, wait = true, timeout = 120000, lookupPublic = true, fs, fetch = globalThis.fetch, interfaces, up = isUp, sleep, now }) {
  const base = devBase({ url, scripts });
  const result = { base, server: "down", ready: false, status: null, tail: null, reached: false, timedOut: false, timeout, urls: [], missing: [] };
  if (!base || (wait && !(await up(base.port, { host: base.host })))) return result;
  const lan = lanAddresses(interfaces);
  const publicIp = lookupPublic && LOOPBACK.has(base.host) ? await publicAddress({ fetch }) : null;
  const urls = routeUrls(base, route, { lan, publicIp });
  const listed = { ...result, urls, missing: missingOrigins(root, urls, fs) };
  if (!wait) return { ...listed, server: "unasked", ready: null };
  return { ...listed, server: "up", ...(await waitForRoute(`${base.origin}${route}`, { fetch, timeout, sleep, now })) };
}

/** The line a stale Turbopack cache gets, wherever it shows. */
export const STALE_CACHE_FIX = "next dev is reading the caches a production build left (docs/design.md § When the dev server will not serve): pnpm kit serve --fix-cache restarts it with .next/dev and .next/cache/turbopack cleared — or stop it, rm -rf .next/dev .next/cache/turbopack, and start it again";
const firewall = (port) => `answers only where a firewall opens ${port}, to the viewer's IP only`;

/** The hand-over for a person: { out, err, exit } — the URLs on stdout; a failure, an error's tail and each missing origin on stderr; exit 1 when the route failed. */
export function formatHandover(h, route) {
  const out = [], err = [];
  if (h.server === "down") {
    out.push(`no dev server answers ${h.base ? `on port ${h.base.port}` : "(package.json's scripts.dev names no port; --url names a server)"}: pnpm kit serve starts it, waits for ${route} and prints the URLs to hand over`);
    return { out, err, exit: 0 };
  }
  if (h.ready === false) {
    if (h.tail !== null) err.push(`${route} answered ${h.status} on ${h.base.origin}:`, ...h.tail.split("\n").map((line) => `  ${line}`));
    else if (h.reached) err.push(`${route} still answers ${h.status} on ${h.base.origin} after ${Math.round(h.timeout / 1000)} s: is the server on port ${h.base.port} this site's next dev? (.next/dev/lock names the one this site runs)`);
    else err.push(`${h.base.origin} did not answer ${route} within ${Math.round(h.timeout / 1000)} s (--timeout for longer)`);
    if (STALE_CACHE.test(h.tail ?? "")) err.push(STALE_CACHE_FIX);
    return { out, err, exit: 1 };
  }
  out.push(h.ready ? `${route} answers ${h.status} on the dev server; hand over:` : `${route} not asked for (--no-wait); hand over, once it answers:`);
  for (const u of h.urls) out.push(`  ${u.where.padEnd(10)} ${u.url}${u.where === "public" ? `   ${firewall(h.base.port)}` : ""}`);
  for (const host of h.missing) err.push(`warning: ${ORIGINS_KEY} in ${ENV_FILE} lacks ${host}: a browser there gets a page that never hydrates; pnpm urls --write adds it (then restart the dev server)`);
  return { out, err, exit: 0 };
}
