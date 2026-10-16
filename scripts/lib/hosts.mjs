// The addresses a browser opens the site on, found on the machine that
// serves it, when they are needed: who develops where differs, and so does
// the address, so none is ever written into the repo (docs/dev-server.md).
// This machine's LAN addresses (its real interfaces, not loopback or a
// container's bridge), its public address, whether a server answers on a
// port and whether that is this clone's own next dev (its lock, read as
// serve reads it: another checkout's server on the same port is not it),
// and ALLOWED_DEV_ORIGINS in the gitignored .env.local: the hostnames
// `next dev` serves its scripts to besides localhost, without which a page
// opened from another device renders and never hydrates. `agentic-cms urls`
// prints them and `setup` writes the origins through urlsReport(); the lab
// server lists its LAN URLs from lanAddresses().
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { DEV_LOCK, ownDevServer } from "./dev-server.mjs";

/** Interfaces that are not the machine's network: loopback, container and VM bridges, macOS's tunnels and peer-to-peer links. */
export const SKIPPED_INTERFACES = /^(lo|docker|br-|veth|virbr|utun|awdl|llw)/;

/** This machine's IPv4 addresses on real interfaces, in the order the system lists them. */
export function lanAddresses(interfaces = os.networkInterfaces()) {
  const addresses = Object.entries(interfaces)
    .filter(([name]) => !SKIPPED_INTERFACES.test(name))
    .flatMap(([, list]) => list ?? [])
    .filter((a) => (a.family === "IPv4" || a.family === 4) && !a.internal)
    .map((a) => a.address);
  return [...new Set(addresses)];
}

/** Two services that answer with the caller's public IPv4 address as plain text; the second is asked when the first fails. */
export const PUBLIC_SERVICES = ["https://api.ipify.org", "https://ifconfig.me/ip"];
const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);
export const isIPv4 = (text) => IPV4.test(text);

/** The machine's public IPv4 address, from the first service that answers with one within `timeout` ms; null offline. */
export async function publicAddress({ fetch = globalThis.fetch, timeout = 4000, services = PUBLIC_SERVICES } = {}) {
  for (const url of services) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      const ip = res.ok ? (await res.text()).trim() : "";
      if (isIPv4(ip)) return ip;
    } catch { /* offline, or that service is down: the next one */ }
  }
  return null;
}

/** Whether something accepts a connection on the port: a TCP connect, no request, so a dev server compiles nothing for it. */
export function isUp(port, { host = "localhost", timeout = 1500 } = {}) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (up) => { socket.destroy(); resolve(up); };
    socket.setTimeout(timeout, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/** The port `next dev` listens on, from the site's dev script: its -p / --port (or PORT=), else Next's own 3000; null when the script runs no next dev. */
export function devPort(scripts = {}) {
  const dev = scripts.dev ?? "";
  const flag = dev.match(/(?:^|\s)(?:-p|--port)(?:\s+|=)(\d{2,5})\b/) ?? dev.match(/(?:^|\s)PORT=(\d{2,5})\b/);
  if (flag) return Number(flag[1]);
  return /\bnext\s+dev\b/.test(dev) ? 3000 : null;
}

// ---- ALLOWED_DEV_ORIGINS in .env.local --------------------------------------
export const ORIGINS_KEY = "ALLOWED_DEV_ORIGINS";
export const ENV_FILE = ".env.local";
const ORIGINS_LINE = new RegExp(`^([ \\t]*(?:export[ \\t]+)?${ORIGINS_KEY}[ \\t]*=)(.*)$`, "m");

/** A value as the hostname next dev compares: no scheme, no port, no path, lower case. */
export function hostname(value) {
  const bare = value.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/?#]/)[0];
  return bare.replace(/:\d+$/, "").toLowerCase();
}

/** The line's value as dotenv reads it: quotes taken off, an unquoted value's trailing comment dropped. */
function originsValue(raw) {
  const value = raw.trim();
  const quoted = value.match(/^(["'])(.*)\1$/);
  return quoted ? quoted[2] : value.replace(/\s+#.*$/, "");
}

const unique = (list) => [...new Set(list)];

/** The hostnames ALLOWED_DEV_ORIGINS lists in the file's text; [] when the key is absent. */
export function readOrigins(text = "") {
  const line = text.match(ORIGINS_LINE);
  return line ? unique(originsValue(line[2]).split(",").map(hostname).filter(Boolean)) : [];
}

/** The text with `hosts` added to ALLOWED_DEV_ORIGINS — the line rewritten in place, as hostnames, or appended — and every other line as it was; the same text when nothing is missing. */
export function writeOrigins(text = "", hosts = []) {
  const listed = readOrigins(text);
  const missing = unique(hosts.map(hostname).filter(Boolean)).filter((h) => !listed.includes(h));
  if (!missing.length) return text;
  const value = [...listed, ...missing].join(",");
  if (ORIGINS_LINE.test(text)) return text.replace(ORIGINS_LINE, (_, key) => `${key}${value}`);
  return `${text}${text && !text.endsWith("\n") ? "\n" : ""}${ORIGINS_KEY}=${value}\n`;
}

// ---- the report `urls` prints and `setup` ends with ---------------------------
/** The URLs a port answers on from each kind of host: localhost, each LAN address, the public one. */
export const urlsOn = (port, { lan, publicIp }) => [
  { where: "localhost", url: `http://localhost:${port}` },
  ...lan.map((ip) => ({ where: "LAN", url: `http://${ip}:${port}` })),
  ...(publicIp ? [{ where: "public", url: `http://${publicIp}:${port}` }] : []),
];

/**
 * The origins .env.local lists against the hosts a browser will open; with
 * `write`, the missing ones added (from .env.example when .env.local is
 * absent). { file, exists, listed, missing, written }.
 */
export function originsStatus({ root, hosts, write = false, fs }) {
  const file = path.join(root, ENV_FILE);
  const exists = fs.existsSync(file);
  const text = exists ? fs.readFileSync(file, "utf8") : "";
  const listed = readOrigins(text);
  const missing = hosts.filter((h) => !listed.includes(h));
  if (!write || !missing.length) return { file: ENV_FILE, exists, listed, missing, written: [] };
  const example = path.join(root, ".env.example");
  const base = exists ? text : fs.existsSync(example) ? fs.readFileSync(example, "utf8") : "";
  fs.writeFileSync(file, writeOrigins(base, hosts));
  return { file: ENV_FILE, exists: true, listed: [...listed, ...missing], missing: [], written: missing };
}

/**
 * The dev port: `up` when anything answers there, `own` when that is this
 * clone's next dev, `ownPort` the port this clone's next dev runs on,
 * wherever that is (null when none runs).
 */
async function devPortStatus(port, { root, fs, up, kill }) {
  const [own, answers] = await Promise.all([ownDevServer({ root, fs, up, kill }), port ? up(port) : false]);
  return { up: answers, own: Boolean(own && port && own.port === port), ownPort: own?.port ?? null };
}

/**
 * Everything `urls` reports: the addresses, the dev server's and the lab's
 * URLs, whether each answers and whether the dev port's is this clone's
 * next dev, and the origins (written with `write`). The network and the
 * processes come in — interfaces, fetch, isUp, kill — so a test stubs them.
 */
export async function urlsReport({ root, port, labPort, lookupPublic = true, write = false, fs, interfaces, fetch, up = isUp, kill = process.kill }) {
  const lan = lanAddresses(interfaces);
  const [publicIp, dev, labUp] = await Promise.all([lookupPublic ? publicAddress({ fetch }) : null, devPortStatus(port, { root, fs, up, kill }), up(labPort)]);
  const origins = originsStatus({ root, hosts: unique([...lan, ...(publicIp ? [publicIp] : [])]), write, fs });
  return {
    addresses: { lan, public: publicIp, publicLookedUp: lookupPublic },
    dev: { port, ...dev, urls: port ? urlsOn(port, { lan, publicIp }) : [] },
    lab: { port: labPort, up: labUp, urls: urlsOn(labPort, { lan, publicIp }) },
    origins,
  };
}

/** The report as lines for a person: the dev server's URLs, the lab's, the origins and what to do about a missing one. */
export function formatUrls(report) {
  const { dev, lab, addresses, origins } = report;
  const pad = (where) => where.padEnd(10);
  const firewall = (port) => `answers only where a firewall opens ${port}, to the viewer's IP only`;
  const lines = [];
  if (dev.port) {
    lines.push(`dev server, port ${dev.port}: ${devState(dev)}`);
    for (const u of dev.urls) lines.push(`  ${pad(u.where)} ${u.url}${u.where === "public" ? `   ${firewall(dev.port)}` : ""}`);
  } else lines.push("dev server: no port found (package.json's scripts.dev runs no next dev): pass --port");
  if (!addresses.public) lines.push(`  ${pad("public")} ${addresses.publicLookedUp ? "not found (offline?)" : "not looked up (--no-public)"}`);
  if (lab.up) {
    lines.push(`lab, port ${lab.port}: running, each scene at /scene/<name>`);
    for (const u of lab.urls) lines.push(`  ${pad(u.where)} ${u.url}`);
  } else lines.push(`lab, port ${lab.port}: not running (pnpm kit lab serve starts it); /scene/<name> on the same hosts`);
  lines.push("", originsLine(origins, Boolean(dev.ownPort)));
  return lines;
}

/** The dev port in words: this clone's next dev running, something else answering (never this clone's to restart), or nothing; and where this clone's runs when that is another port. */
function devState(dev) {
  const elsewhere = dev.ownPort && !dev.own ? `; this clone's next dev runs on port ${dev.ownPort} (pnpm urls --port ${dev.ownPort})` : "";
  if (dev.own) return "running";
  if (dev.up) return `answers, but not as this clone's next dev (${DEV_LOCK} names none on it)${elsewhere || ": stop what holds it before pnpm dev (docs/dev-server.md § Stopping a server), or serve this clone on another port (pnpm kit serve --port <n>)"}`;
  return `not running${elsewhere || " (pnpm dev starts it)"}`;
}

/** The origins in words; a restart named only while this clone's next dev runs, on whichever port, since nothing else reads its .env.local. */
function originsLine(origins, ownRunning) {
  const where = `${ORIGINS_KEY} in ${origins.file}`;
  const restart = ownRunning ? "; restart the dev server to apply it" : "";
  if (origins.written.length) return `added ${origins.written.join(", ")} to ${where}${restart}`;
  if (!origins.missing.length) return `${where} covers every address above`;
  const lacks = origins.exists ? `${where} lacks ${origins.missing.join(", ")}` : `${origins.file} is missing, so ${ORIGINS_KEY} lacks ${origins.missing.join(", ")}`;
  return `${lacks}: a browser there gets a page that never hydrates. pnpm urls --write adds them${ownRunning ? " (then restart the dev server)" : ""}`;
}
