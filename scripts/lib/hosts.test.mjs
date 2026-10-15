// The addresses and the origins with the network stubbed: an interfaces
// fixture, a fetch that answers as the services would, a port probe that
// says what the test tells it. Every address is from the documentation
// ranges (RFC 5737); nothing here asks the real network.
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { devPort, formatUrls, hostname, isIPv4, isUp, lanAddresses, publicAddress, readOrigins, urlsReport, writeOrigins } from "./hosts.mjs";
import { lanUrls } from "./lab-server.mjs";

const v4 = (address, internal = false) => ({ address, family: "IPv4", internal, netmask: "255.255.255.0", mac: "00:00:00:00:00:00", cidr: `${address}/24` });
const INTERFACES = {
  lo: [v4("127.0.0.1", true), { address: "::1", family: "IPv6", internal: true }],
  eth0: [v4("192.0.2.10"), { address: "fe80::1", family: "IPv6", internal: false }],
  wlan0: [v4("198.51.100.7")],
  docker0: [v4("192.0.2.200")],
  "br-1a2b3c": [v4("192.0.2.201")],
  veth9f8e: [v4("192.0.2.202")],
  virbr0: [v4("192.0.2.203")],
  utun3: [v4("192.0.2.204")],
  awdl0: [v4("192.0.2.205")],
  llw0: [v4("192.0.2.206")],
  en1: [{ address: "192.0.2.10", family: 4, internal: false }],
};

/** A fetch that answers each service URL with the given body (or throws for "down"), and records what was asked. */
function fakeFetch(answers) {
  const asked = [];
  const fetch = async (url, { signal } = {}) => {
    asked.push({ url, timed: signal instanceof AbortSignal });
    const answer = answers[url];
    if (answer === undefined || answer === "down") throw new TypeError("fetch failed");
    return { ok: answer.status ? answer.status < 400 : true, text: async () => answer.body ?? answer };
  };
  return { fetch, asked };
}

test("lanAddresses: IPv4 on real interfaces only, each once — no loopback, container or VM bridge, tunnel or peer link", () => {
  assert.deepEqual(lanAddresses(INTERFACES), ["192.0.2.10", "198.51.100.7"]);
  assert.deepEqual(lanAddresses({}), []);
  assert.deepEqual(lanAddresses({ eth0: undefined }), [], "an interface the system lists without addresses");
  assert.deepEqual(lanUrls(8001, INTERFACES), ["http://192.0.2.10:8001", "http://198.51.100.7:8001"], "the lab server lists the same addresses");
});

test("publicAddress: the first service that answers with an IPv4 address, each asked with a timeout; null when none does", async () => {
  const first = fakeFetch({ "https://api.ipify.org": "203.0.113.5\n" });
  assert.equal(await publicAddress({ fetch: first.fetch }), "203.0.113.5");
  assert.deepEqual(first.asked, [{ url: "https://api.ipify.org", timed: true }], "the second is not asked once the first answers");

  const fallback = fakeFetch({ "https://api.ipify.org": "down", "https://ifconfig.me/ip": "203.0.113.6" });
  assert.equal(await publicAddress({ fetch: fallback.fetch }), "203.0.113.6");
  assert.deepEqual(fallback.asked.map((a) => a.url), ["https://api.ipify.org", "https://ifconfig.me/ip"]);

  const junk = fakeFetch({ "https://api.ipify.org": "<html>rate limited</html>", "https://ifconfig.me/ip": { status: 503, body: "203.0.113.9" } });
  assert.equal(await publicAddress({ fetch: junk.fetch }), null, "a page that is not an address, and an error status, are no answer");
  assert.equal(await publicAddress({ fetch: fakeFetch({}).fetch }), null, "offline");
  assert.ok(isIPv4("203.0.113.255") && !isIPv4("203.0.113.256") && !isIPv4("2001:db8::1") && !isIPv4("203.0.113"));
});

test("isUp: true while something listens on the port, false once it stops", async () => {
  const server = net.createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  assert.equal(await isUp(port, { host: "127.0.0.1" }), true);
  await new Promise((resolve) => server.close(resolve));
  assert.equal(await isUp(port, { host: "127.0.0.1" }), false);
});

test("devPort: the -p of the dev script, --port and PORT= too, else next dev's 3000; null when no next dev runs", () => {
  assert.equal(devPort({ dev: "next dev -p 8000" }), 8000);
  assert.equal(devPort({ dev: "next dev --port 8100 --turbopack" }), 8100);
  assert.equal(devPort({ dev: "next dev --port=8200" }), 8200);
  assert.equal(devPort({ dev: "PORT=8300 next dev" }), 8300);
  assert.equal(devPort({ dev: "next dev" }), 3000);
  assert.equal(devPort({ dev: "vite" }), null);
  assert.equal(devPort({}), null);
  assert.equal(devPort(), null);
});

test("readOrigins: the hostnames of the line, as next dev compares them — no scheme, port or path; quotes and a comment taken off", () => {
  assert.deepEqual(readOrigins(""), []);
  assert.deepEqual(readOrigins("FORM_WEBHOOK_URL=\n"), []);
  assert.deepEqual(readOrigins("ALLOWED_DEV_ORIGINS=\n"), []);
  assert.deepEqual(readOrigins("ALLOWED_DEV_ORIGINS=192.0.2.10, http://198.51.100.7:8000/x ,dev.example.test\n"), ["192.0.2.10", "198.51.100.7", "dev.example.test"]);
  assert.deepEqual(readOrigins('export ALLOWED_DEV_ORIGINS="192.0.2.10,192.0.2.10"\n'), ["192.0.2.10"]);
  assert.deepEqual(readOrigins("ALLOWED_DEV_ORIGINS=192.0.2.10 # the VM\n"), ["192.0.2.10"]);
  assert.equal(hostname(" HTTPS://Dev.Example.TEST:8443/path?q "), "dev.example.test");
});

test("writeOrigins: adds the missing hostnames in place, keeps every other line, and a second run changes nothing", () => {
  const env = "# Copy to .env.local\nALLOWED_DEV_ORIGINS=192.0.2.10\n\nFORM_WEBHOOK_URL=\n";
  const once = writeOrigins(env, ["192.0.2.10", "203.0.113.5"]);
  assert.equal(once, "# Copy to .env.local\nALLOWED_DEV_ORIGINS=192.0.2.10,203.0.113.5\n\nFORM_WEBHOOK_URL=\n");
  assert.equal(writeOrigins(once, ["192.0.2.10", "203.0.113.5"]), once, "idempotent");
  assert.equal(writeOrigins(env, ["192.0.2.10"]), env, "nothing missing: the same text, byte for byte");

  assert.equal(writeOrigins("ALLOWED_DEV_ORIGINS=\nGOOGLE_TAG_ID=\n", ["192.0.2.10"]), "ALLOWED_DEV_ORIGINS=192.0.2.10\nGOOGLE_TAG_ID=\n", "the example's empty key filled");
  assert.equal(writeOrigins("FORM_WEBHOOK_URL=", ["192.0.2.10"]), "FORM_WEBHOOK_URL=\nALLOWED_DEV_ORIGINS=192.0.2.10\n", "no key: appended on a line of its own");
  assert.equal(writeOrigins("", ["192.0.2.10"]), "ALLOWED_DEV_ORIGINS=192.0.2.10\n");
  assert.equal(writeOrigins("export ALLOWED_DEV_ORIGINS=http://192.0.2.10:8000\n", ["203.0.113.5:8000"]), "export ALLOWED_DEV_ORIGINS=192.0.2.10,203.0.113.5\n", "hostnames only, the export kept");
  assert.equal(writeOrigins("A=1\n", []), "A=1\n", "no hosts: nothing written");
});

/** A folder for one report: .env.example as the kit ships its key, .env.local as given. */
function site({ envLocal, example = "# Copy to .env.local\nALLOWED_DEV_ORIGINS=\n\nFORM_WEBHOOK_URL=\n" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "urls-"));
  if (example !== null) fs.writeFileSync(path.join(root, ".env.example"), example);
  if (envLocal !== undefined) fs.writeFileSync(path.join(root, ".env.local"), envLocal);
  return root;
}
const net0 = { interfaces: INTERFACES, fetch: fakeFetch({ "https://api.ipify.org": "203.0.113.5" }).fetch, up: async (port) => port === 8000 };

test("urlsReport: the URLs on every address, which server answers, the origins it lacks — and --write fills them from .env.example, once", async () => {
  const root = site();
  try {
    const before = await urlsReport({ root, port: 8000, labPort: 8001, fs, ...net0 });
    assert.deepEqual(before.addresses, { lan: ["192.0.2.10", "198.51.100.7"], public: "203.0.113.5", publicLookedUp: true });
    assert.deepEqual(before.dev, { port: 8000, up: true, urls: [{ where: "localhost", url: "http://localhost:8000" }, { where: "LAN", url: "http://192.0.2.10:8000" }, { where: "LAN", url: "http://198.51.100.7:8000" }, { where: "public", url: "http://203.0.113.5:8000" }] });
    assert.equal(before.lab.up, false);
    assert.deepEqual(before.origins, { file: ".env.local", exists: false, listed: [], missing: ["192.0.2.10", "198.51.100.7", "203.0.113.5"], written: [] });
    assert.equal(fs.existsSync(path.join(root, ".env.local")), false, "without --write nothing is written");
    const text = formatUrls(before).join("\n");
    assert.match(text, /^dev server, port 8000: running\n {2}localhost {2}http:\/\/localhost:8000\n/);
    assert.match(text, /public {5}http:\/\/203\.0\.113\.5:8000 {3}answers only where a firewall opens 8000, to the viewer's IP only/);
    assert.match(text, /lab, port 8001: not running \(pnpm kit lab serve starts it\)/);
    assert.match(text, /\.env\.local is missing, so ALLOWED_DEV_ORIGINS lacks 192\.0\.2\.10, 198\.51\.100\.7, 203\.0\.113\.5: a browser there gets a page that never hydrates\. pnpm urls --write adds them/);

    const written = await urlsReport({ root, port: 8000, labPort: 8001, write: true, fs, ...net0 });
    assert.deepEqual(written.origins.written, ["192.0.2.10", "198.51.100.7", "203.0.113.5"]);
    assert.equal(fs.readFileSync(path.join(root, ".env.local"), "utf8"), "# Copy to .env.local\nALLOWED_DEV_ORIGINS=192.0.2.10,198.51.100.7,203.0.113.5\n\nFORM_WEBHOOK_URL=\n", "made from .env.example, its other lines kept");
    assert.match(formatUrls(written).join("\n"), /added 192\.0\.2\.10, 198\.51\.100\.7, 203\.0\.113\.5 to ALLOWED_DEV_ORIGINS in \.env\.local; restart the dev server to apply it$/);

    const mtime = fs.statSync(path.join(root, ".env.local")).mtimeMs;
    const again = await urlsReport({ root, port: 8000, labPort: 8001, write: true, fs, ...net0 });
    assert.deepEqual(again.origins, { file: ".env.local", exists: true, listed: ["192.0.2.10", "198.51.100.7", "203.0.113.5"], missing: [], written: [] });
    assert.equal(fs.statSync(path.join(root, ".env.local")).mtimeMs, mtime, "a re-run writes nothing");
    assert.match(formatUrls(again).join("\n"), /ALLOWED_DEV_ORIGINS in \.env\.local covers every address above$/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("urlsReport --no-public asks no service, and the public address is neither a URL nor a missing origin; a running lab lists its URLs", async () => {
  const root = site({ envLocal: "GOOGLE_TAG_ID=\nALLOWED_DEV_ORIGINS=192.0.2.10\n" });
  const quiet = fakeFetch({ "https://api.ipify.org": "203.0.113.5" });
  try {
    const report = await urlsReport({ root, port: 8100, labPort: 8101, lookupPublic: false, fs, interfaces: INTERFACES, fetch: quiet.fetch, up: async () => true });
    assert.deepEqual(quiet.asked, []);
    assert.deepEqual(report.addresses, { lan: ["192.0.2.10", "198.51.100.7"], public: null, publicLookedUp: false });
    assert.deepEqual(report.origins.missing, ["198.51.100.7"]);
    const text = formatUrls(report).join("\n");
    assert.match(text, /public {5}not looked up \(--no-public\)/);
    assert.match(text, /lab, port 8101: running, each scene at \/scene\/<name>\n {2}localhost {2}http:\/\/localhost:8101\n {2}LAN {8}http:\/\/192\.0\.2\.10:8101/);
    assert.match(text, /ALLOWED_DEV_ORIGINS in \.env\.local lacks 198\.51\.100\.7:/);
    const written = await urlsReport({ root, port: 8100, labPort: 8101, lookupPublic: false, write: true, fs, interfaces: INTERFACES, fetch: quiet.fetch, up: async () => false });
    assert.equal(fs.readFileSync(path.join(root, ".env.local"), "utf8"), "GOOGLE_TAG_ID=\nALLOWED_DEV_ORIGINS=192.0.2.10,198.51.100.7\n");
    assert.doesNotMatch(formatUrls(written).join("\n"), /restart/, "no server running: nothing to restart");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("urlsReport offline, on a machine with no LAN: nothing to cover, nothing written, the public address said not found", async () => {
  const root = site({ example: null });
  try {
    const report = await urlsReport({ root, port: 8000, labPort: 8001, write: true, fs, interfaces: { lo: INTERFACES.lo }, fetch: fakeFetch({}).fetch, up: async () => false });
    assert.deepEqual(report.origins, { file: ".env.local", exists: false, listed: [], missing: [], written: [] });
    assert.equal(fs.existsSync(path.join(root, ".env.local")), false);
    assert.match(formatUrls(report).join("\n"), /public {5}not found \(offline\?\)/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
