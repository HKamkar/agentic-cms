// setup with everything it touches passed in: an in-memory file system, a
// shell that records each command and answers as pnpm would, browsers that
// "install" into a set, a network of documentation-range addresses. Then
// scripts/setup.sh itself, run by bash against stub pnpm, corepack and npm
// on a PATH of their own. Nothing here installs anything or asks the real
// network.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DEPS_LINE, SetupError, parseEngines, setup } from "./setup.mjs";

const ROOT = "/site";
const EXAMPLE = "# Copy to .env.local\nALLOWED_DEV_ORIGINS=\n\nFORM_WEBHOOK_URL=\n";
const PKG = JSON.stringify({ name: "site", packageManager: "pnpm@12.4.1", scripts: { dev: "next dev -p 8000" } });

/** A file system in memory, rooted at /site, that remembers every write. */
function memfs(files = { "package.json": PKG, ".env.example": EXAMPLE }) {
  const store = new Map(Object.entries(files).map(([file, text]) => [path.join(ROOT, file), text]));
  const writes = [];
  return {
    store, writes,
    existsSync: (file) => store.has(file),
    readFileSync: (file) => { if (!store.has(file)) throw Object.assign(new Error(`ENOENT: ${file}`), { code: "ENOENT" }); return store.get(file); },
    writeFileSync: (file, text) => { writes.push(path.relative(ROOT, file)); store.set(file, String(text)); },
    copyFileSync: (from, to) => { writes.push(path.relative(ROOT, to)); store.set(to, store.get(from)); },
  };
}

/** The machine: which browsers are installed, whether WebKit's libraries are, what each pnpm script returns; exec records every command. */
function machine({ installed = [], libraries = false, scripts = {}, installStatus = 0, pnpm = "12.4.1" } = {}) {
  const state = { installed: new Set(installed), libraries, calls: [] };
  const exec = (command, args, { capture = false, env = {} } = {}) => {
    state.calls.push([...Object.entries(env).map(([key, value]) => `${key}=${value}`), command, ...args].join(" ").replace(process.execPath, "<node>"));
    if (command === "pnpm" && args[0] === "--version") return pnpm ? { status: 0, stdout: `${pnpm}\n` } : { status: null, stdout: "" };
    if (command === "pnpm" && args[1] === "playwright-core") { if (installStatus === 0) for (const e of args.slice(3)) state.installed.add(e); return { status: installStatus, stdout: "" }; }
    if (command === "sudo") { state.libraries = true; return { status: 0, stdout: "" }; }
    if (command === "pnpm") return { status: scripts[args[0]] ?? 0, stdout: capture ? "" : undefined };
    throw new Error(`unexpected command ${command}`);
  };
  const browsers = {
    cli: `${ROOT}/node_modules/playwright-core/cli.js`,
    path: (engine) => (state.installed.has(engine) ? `/cache/${engine}/exe` : null),
    launches: async (engine) => engine !== "webkit" || state.libraries,
  };
  return { state, exec, browsers };
}

const v4 = (address) => ({ address, family: "IPv4", internal: false });
const asked = [];
const NET = { interfaces: { lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }], eth0: [v4("192.0.2.10")], docker0: [v4("192.0.2.200")] }, fetch: async (url) => { asked.push(url); return { ok: true, text: async () => "203.0.113.5" }; }, up: async () => false };
const FLAGS = { check: false, build: false, browsers: true, engines: ["chromium", "webkit"], deps: false, public: true, port: undefined, labPort: 8001 };
const run = (m, fs, flags = {}, extra = {}) => setup({ root: ROOT, flags: { ...FLAGS, ...flags }, exec: m.exec, fs, browsers: m.browsers, net: NET, versions: { node: "26.8.2" }, platform: "linux", ...extra });
const plan = (report) => report.steps.map((s) => `${s.step}: ${s.status}`);

test("the step plan on a fresh clone: browsers installed, WebKit's libraries left for the owner, .env.local and its origins written, lint and test run", async () => {
  const m = machine();
  const fsys = memfs();
  const report = await run(m, fsys);
  assert.deepEqual(plan(report), ["node: ok", "pnpm: ok", "browsers: done", "webkit libraries: todo", "env: done", "origins: done", "verify: done", "verify: done", "verify: skipped"]);
  assert.deepEqual(m.state.calls, ["pnpm --version", "pnpm exec playwright-core install chromium webkit", "pnpm lint", "pnpm test"]);
  assert.equal(report.exit, 0);
  assert.equal(report.ready, false, "ready but for the owner's step");
  assert.deepEqual(report.todo, [DEPS_LINE]);
  assert.match(report.steps[3].detail, /WebKit does not launch: it needs system libraries, which take sudo \(Chromium works without them\): run the line, or setup --deps/);
  assert.equal(fsys.store.get(`${ROOT}/.env.local`), "# Copy to .env.local\nALLOWED_DEV_ORIGINS=192.0.2.10,203.0.113.5\n\nFORM_WEBHOOK_URL=\n", "copied from the example, then this machine's LAN and public addresses: never the bridge");
  assert.deepEqual(fsys.writes, [".env.local", ".env.local"]);
  assert.equal(report.urls.dev.port, 8000, "the port from scripts.dev");
  assert.deepEqual(report.urls.dev.urls.map((u) => u.url), ["http://localhost:8000", "http://192.0.2.10:8000", "http://203.0.113.5:8000"]);
});

test("a re-run keeps everything and installs nothing: only the version check, the lint and the tests run", async () => {
  const m = machine({ installed: ["chromium", "webkit"], libraries: true });
  const fsys = memfs({ "package.json": PKG, ".env.example": EXAMPLE, ".env.local": "ALLOWED_DEV_ORIGINS=192.0.2.10,203.0.113.5\nGOOGLE_TAG_ID=\n" });
  const report = await run(m, fsys);
  assert.deepEqual(plan(report), ["node: ok", "pnpm: ok", "browsers: ok", "webkit libraries: ok", "env: ok", "origins: ok", "verify: done", "verify: done", "verify: skipped"]);
  assert.deepEqual(m.state.calls, ["pnpm --version", "pnpm lint", "pnpm test"]);
  assert.deepEqual(fsys.writes, [], "nothing written");
  assert.equal(report.exit, 0);
  assert.equal(report.ready, true);
  assert.deepEqual(report.todo, []);
});

test("--check reports every gap, writes nothing and runs nothing but the version check; a ready clone checks clean", async () => {
  const m = machine();
  const fsys = memfs();
  const report = await run(m, fsys, { check: true });
  assert.deepEqual(plan(report), ["node: ok", "pnpm: ok", "browsers: gap", "env: gap", "origins: gap", "dev port: ok", "verify: skipped"]);
  assert.deepEqual(m.state.calls, ["pnpm --version"]);
  assert.deepEqual(fsys.writes, []);
  assert.equal(report.exit, 1);
  assert.deepEqual(report.todo, ["pnpm exec playwright-core install chromium webkit", "cp .env.example .env.local", "pnpm urls --write"]);
  assert.equal(report.steps.find((s) => s.step === "dev port").detail, "8000 is free for pnpm dev");

  const ready = machine({ installed: ["chromium", "webkit"], libraries: false });
  const done = memfs({ "package.json": PKG, ".env.local": "ALLOWED_DEV_ORIGINS=192.0.2.10,203.0.113.5\n" });
  const nearly = await run(ready, done, { check: true });
  assert.deepEqual(plan(nearly), ["node: ok", "pnpm: ok", "browsers: ok", "webkit libraries: todo", "env: ok", "origins: ok", "dev port: ok", "verify: skipped"]);
  assert.equal(nearly.exit, 1, "the owner's step is a gap to --check");
  ready.state.libraries = true;
  const clean = await run(ready, done, { check: true });
  assert.equal(clean.exit, 0);
  assert.equal(clean.ready, true);

  const devPortDetail = (report) => report.steps.find((s) => s.step === "dev port").detail;
  const held = await run(ready, done, { check: true }, { net: { ...NET, up: async (port) => port === 8000 } });
  assert.equal(devPortDetail(held), "8000 answers, but not as this clone's next dev: pnpm dev needs the port, so stop what holds it first (docs/dev-server.md § Stopping a server)", "another checkout's server, no lock here");
  assert.deepEqual([held.urls.dev.up, held.urls.dev.own], [true, false]);
  const kill = (pid) => { if (pid !== 4242) throw Object.assign(new Error("ESRCH"), { code: "ESRCH" }); };
  done.store.set(`${ROOT}/.next/dev/lock`, JSON.stringify({ pid: 4242, port: 8000 }));
  const own = await run(ready, done, { check: true }, { net: { ...NET, up: async (port) => port === 8000, kill } });
  assert.equal(devPortDetail(own), "this clone's next dev runs on 8000");
  assert.equal(own.exit, 0);
  assert.deepEqual(done.writes, []);
});

test("the origins written while another checkout's server holds the dev port: no restart named, since that server reads its own .env.local; this clone's own next dev gets one", async () => {
  const kill = (pid) => { if (pid !== 4242) throw Object.assign(new Error("ESRCH"), { code: "ESRCH" }); };
  const net = { ...NET, up: async (port) => port === 8000, kill };
  const originsDetail = (report) => report.steps.find((s) => s.step === "origins").detail;
  const other = await run(machine({ installed: ["chromium", "webkit"], libraries: true }), memfs(), {}, { net });
  assert.equal(originsDetail(other), "added 192.0.2.10, 203.0.113.5 to ALLOWED_DEV_ORIGINS");
  const mine = memfs({ "package.json": PKG, ".env.example": EXAMPLE, ".next/dev/lock": JSON.stringify({ pid: 4242, port: 8000 }) });
  const own = await run(machine({ installed: ["chromium", "webkit"], libraries: true }), mine, {}, { net });
  assert.equal(originsDetail(own), "added 192.0.2.10, 203.0.113.5 to ALLOWED_DEV_ORIGINS; restart the dev server to apply it");
});

test("--deps installs WebKit's libraries with sudo, through this Node and playwright-core's cli, and checks WebKit launches after", async () => {
  const m = machine({ installed: ["chromium", "webkit"] });
  const report = await run(m, memfs({ "package.json": PKG, ".env.local": "ALLOWED_DEV_ORIGINS=192.0.2.10,203.0.113.5\n" }), { deps: true });
  assert.ok(m.state.calls.includes(`sudo <node> ${ROOT}/node_modules/playwright-core/cli.js install-deps webkit`));
  assert.deepEqual(report.steps.find((s) => s.step === "webkit libraries"), { step: "webkit libraries", status: "done", detail: "installed; WebKit launches" });
  assert.equal(report.ready, true);
});

test("--build verifies with pnpm build too; a failing step stops the verify there and exits 1", async () => {
  const built = machine({ installed: ["chromium"] });
  const env = { "package.json": PKG, ".env.local": "ALLOWED_DEV_ORIGINS=192.0.2.10,203.0.113.5\n" };
  assert.deepEqual((await run(built, memfs(env), { build: true, engines: ["chromium"] })).steps.filter((s) => s.step === "verify").map((s) => s.detail), ["pnpm lint", "pnpm test", "pnpm build"]);
  assert.ok(built.state.calls.includes("AGENTIC_CMS_PLACEHOLDERS=warn pnpm build"), "the verify build deploys nothing: a new site's placeholders stay warnings, as in its CI");
  const failing = machine({ installed: ["chromium"], scripts: { test: 1 } });
  const report = await run(failing, memfs(env), { build: true, engines: ["chromium"] });
  assert.equal(report.exit, 1);
  assert.deepEqual(report.steps.at(-1), { step: "verify", status: "failed", detail: "pnpm test failed: its output is above; fix the cause, then run setup again", command: "pnpm test" });
  assert.ok(!failing.state.calls.some((call) => call.endsWith("pnpm build")), "nothing after the failure");
});

test("--no-browsers skips them, --engines chromium leaves WebKit alone, --no-public asks no service, and a Mac launches nothing to check", async () => {
  const none = machine();
  const skipped = await run(none, memfs(), { browsers: false });
  assert.deepEqual(skipped.steps.find((s) => s.step === "browsers"), { step: "browsers", status: "skipped", detail: "--no-browsers: shot, probe, sheet, visual-parity and lab render need Chromium" });
  assert.ok(!none.state.calls.some((c) => c.includes("playwright-core")));

  const chromium = machine();
  const one = await run(chromium, memfs(), { engines: ["chromium"] });
  assert.ok(chromium.state.calls.includes("pnpm exec playwright-core install chromium"));
  assert.ok(!one.steps.some((s) => s.step === "webkit libraries"));

  asked.length = 0;
  const offline = await run(machine({ installed: ["chromium", "webkit"], libraries: true }), memfs(), { public: false });
  assert.deepEqual(asked, []);
  assert.equal(offline.steps.find((s) => s.step === "origins").detail, "added 192.0.2.10 to ALLOWED_DEV_ORIGINS");

  const mac = await run(machine({ installed: ["chromium", "webkit"] }), memfs(), {}, { platform: "darwin" });
  assert.ok(!mac.steps.some((s) => s.step === "webkit libraries"), "no system libraries to install outside Linux");
});

test("the environment stops setup at the first missing piece, with exit 2 and what to run", async () => {
  const stop = async (opts, flags = {}, extra = {}) => { const m = machine(opts.machine); const r = await run(m, memfs(opts.files), flags, extra); return { last: r.steps.at(-1), exit: r.exit, calls: m.state.calls }; };
  const old = await stop({}, {}, { versions: { node: "22.17.1" } });
  assert.deepEqual([old.exit, old.last.step, old.last.detail], [2, "node", "Node 22.17.1 is too old: the kit needs 22.18 or newer (the version .nvmrc names)"]);
  assert.deepEqual(old.calls, []);
  assert.equal((await stop({}, {}, { versions: { node: "22.18.0" } })).exit, 0, "22.18 is enough");
  const nowhere = await stop({ files: {} });
  assert.deepEqual([nowhere.exit, nowhere.last.detail], [2, "no package.json here: run setup in the site's root"]);
  const nopnpm = await stop({ machine: { pnpm: null } });
  assert.deepEqual([nopnpm.exit, nopnpm.last.command], [2, "bash scripts/setup.sh"]);
  const offline = await stop({ machine: { installStatus: 1 } });
  assert.deepEqual([offline.exit, offline.last.step, offline.last.command], [2, "browsers", "pnpm exec playwright-core install chromium webkit"]);
  const m = machine();
  const nopw = await setup({ root: ROOT, flags: FLAGS, exec: m.exec, fs: memfs(), browsers: { ...m.browsers, cli: null }, net: NET, versions: { node: "26.8.2" }, platform: "linux" });
  assert.deepEqual([nopw.exit, nopw.steps.at(-1).command], [2, "pnpm add -D playwright-core"]);
});

test("parseEngines: the kit's order whatever the flag's; an engine it does not drive is a usage error", () => {
  assert.deepEqual(parseEngines("webkit,chromium"), ["chromium", "webkit"]);
  assert.deepEqual(parseEngines(" WebKit "), ["webkit"]);
  assert.throws(() => parseEngines("chromium,firefox"), SetupError);
  assert.throws(() => parseEngines(","), /--engines is a list of chromium, webkit, not ,/);
});

// ---- scripts/setup.sh, run by bash against stubs ------------------------------
const SETUP_SH = path.resolve(import.meta.dirname, "../../templates/site/setup.sh");
const posix = process.platform !== "win32";
const which = (name) => { try { return execFileSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" }).trim(); } catch { return null; } };
const BASH = posix && which("bash");

/** A site with scripts/setup.sh and a PATH of its own: node (real, or a stub reporting `node`), the tools the script calls, and stubs for pnpm, corepack and npm that log their arguments. */
function shSite({ lock = true, node = null, tools = ["pnpm"], execStatus = 0 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-sh-"));
  const bin = path.join(dir, "bin"), log = path.join(dir, "calls.log");
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(bin);
  fs.copyFileSync(SETUP_SH, path.join(dir, "scripts/setup.sh"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "site", packageManager: "pnpm@12.4.1+sha512.abc" }));
  if (lock) fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  for (const tool of ["dirname", "chmod"]) fs.symlinkSync(which(tool), path.join(bin, tool));
  const stub = (name, body) => fs.writeFileSync(path.join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${log}"\n${body}\n`, { mode: 0o755 });
  const pnpm = `if [ "$1" = "--version" ]; then echo 12.4.1; fi\nif [ "$1" = "exec" ]; then exit ${execStatus}; fi\nexit 0`;
  const makePnpm = `printf '%s\\n' '#!/bin/sh' 'echo "pnpm $*" >> "${log}"' '[ "$1" = "--version" ] && echo 12.4.1' 'exit 0' > "${bin}/pnpm" && chmod +x "${bin}/pnpm"`;
  if (tools.includes("pnpm")) stub("pnpm", pnpm);
  if (tools.includes("corepack")) stub("corepack", `if [ "$1 $2" = "enable pnpm" ]; then ${makePnpm}; fi`);
  if (tools.includes("npm")) stub("npm", makePnpm);
  if (node) fs.writeFileSync(path.join(bin, "node"), `#!/bin/sh\nif [ "$1" = "-p" ] && [ "$2" = "process.versions.node" ]; then echo ${node}; exit 0; fi\nexec "${process.execPath}" "$@"\n`, { mode: 0o755 });
  else fs.symlinkSync(process.execPath, path.join(bin, "node"));
  const runSh = (...args) => { const r = spawnSync(BASH, [path.join(dir, "scripts/setup.sh"), ...args], { env: { PATH: bin, HOME: dir }, encoding: "utf8" }); return { ...r, calls: fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [] }; };
  return { dir, run: runSh, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test("setup.sh: Node checked, pnpm found, the frozen install, then agentic-cms setup with the flags passed through and its exit code kept", { skip: BASH ? false : "no bash" }, () => {
  const site = shSite();
  try {
    const r = site.run("--check", "--no-public");
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.calls, ["pnpm --version", "pnpm install --frozen-lockfile", "pnpm exec agentic-cms setup --check --no-public"]);
    assert.match(r.stdout, /^✓ Node \d+\.\d+\.\d+\n✓ pnpm 12\.4\.1 \(package\.json pins 12\.4\.1\)\n/);
  } finally { site.done(); }
  const failing = shSite({ execStatus: 1 });
  try { assert.equal(failing.run().status, 1, "exec: agentic-cms setup's exit is the script's"); } finally { failing.done(); }
});

test("setup.sh on a fresh site from init: no lockfile yet, so the install writes one", { skip: BASH ? false : "no bash" }, () => {
  const site = shSite({ lock: false });
  try { assert.deepEqual(site.run().calls, ["pnpm --version", "pnpm install", "pnpm exec agentic-cms setup"]); } finally { site.done(); }
});

test("setup.sh without pnpm: corepack enables it, or, on a Node with no corepack, npm installs the pinned version", { skip: BASH ? false : "no bash" }, () => {
  const corepack = shSite({ tools: ["corepack", "npm"] });
  try {
    const r = corepack.run();
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.calls.slice(0, 2), ["corepack enable pnpm", "pnpm --version"]);
    assert.match(r.stdout, /✓ pnpm enabled through corepack/);
  } finally { corepack.done(); }
  const npm = shSite({ tools: ["npm"] });
  try {
    const r = npm.run();
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.calls.slice(0, 2), ["npm install -g pnpm@12.4.1", "pnpm --version"], "the version without its hash");
  } finally { npm.done(); }
  const nothing = shSite({ tools: [] });
  try {
    const r = nothing.run();
    assert.equal(r.status, 2);
    assert.match(r.stderr, /could not install pnpm: run 'npm install -g pnpm@12\.4\.1'/);
  } finally { nothing.done(); }
});

test("setup.sh stops on a Node older than 22.18, before anything is installed", { skip: BASH ? false : "no bash" }, () => {
  const site = shSite({ node: "22.17.1" });
  try {
    const r = site.run();
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Node 22\.17\.1 is too old: the site needs 22\.18 or newer/);
    assert.deepEqual(r.calls, []);
  } finally { site.done(); }
  const enough = shSite({ node: "22.18.0" });
  try { assert.equal(enough.run().status, 0); } finally { enough.done(); }
});
