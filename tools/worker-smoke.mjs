#!/usr/bin/env node
// Runs the example's real Cloudflare Worker and compares what it answers with
// what the build prerendered. Nothing else in CI starts the Worker, and one
// that answers 500 on every page passes the lint, the tests and the build
// (docs/deploy.md § Cloudflare Workers): the adapter bundles the server after
// `next build` has finished, and a pair of versions that do not fit shows
// only when the bundle runs.
//
// It builds with OpenNext (`opennextjs-cloudflare build`, which runs the
// site's own `pnpm build`), serves the result in workerd on a free port, asks,
// and stops it. The answers are compared byte for byte with the files under
// .next/server/app, because a wrong page can answer 200, and because the same
// bytes prove it is this Worker that answered and not another server on the
// port. Exit 1 with one line per wrong answer and the end of the Worker's log,
// 2 when there is no build to compare with or the Worker cannot be built.
//
//   node tools/worker-smoke.mjs [--no-build]    (pnpm test:worker; --no-build serves the .open-next that is there)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { freePort } from "../scripts/lib/dev-server.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const HOST = "127.0.0.1";
const START_SECONDS = 90;
const REQUEST_MS = 20_000;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
const unique = (list) => [...new Set(list)];

/** The prerendered files with one extension, as [URL path, bytes]; Next's own pages (/_not-found, /_global-error) left out. */
function prerendered(app, extension) {
  return walk(app).filter((file) => file.endsWith(extension))
    .map((file) => [`/${path.relative(app, file).split(path.sep).join("/").slice(0, -extension.length)}`.replace(/^\/index$/, "/"), fs.readFileSync(file)])
    .filter(([url]) => !url.startsWith("/_"));
}

/** The redirects that name one exact path: a pattern has no single URL to ask for. */
const exactRedirects = (manifest) => manifest.redirects.filter((redirect) => !redirect.internal && !/[:*()]/.test(redirect.source));

/** What the Worker must answer, read from the finished build: [{ what, url, init?, status, body?, contains?, location? }]. */
export function expectations(root) {
  const app = path.join(root, ".next/server/app");
  if (!fs.existsSync(app)) return [];
  const pages = prerendered(app, ".html");
  if (!pages.length) return [];
  const files = unique(pages.flatMap(([, html]) => [...html.toString().matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((match) => match[1])));
  const redirects = exactRedirects(JSON.parse(fs.readFileSync(path.join(root, ".next/routes-manifest.json"), "utf8")));
  return [
    ...[...pages, ...prerendered(app, ".body")].map(([url, body]) => ({ what: url, url, status: 200, body })),
    ...files.map((url) => ({ what: url, url, status: 200 })),
    ...redirects.map(({ source, destination, statusCode }) => ({ what: `the redirect ${source}`, url: source, status: statusCode, location: destination })),
    { what: "an unknown page", url: "/no-such-page-worker-smoke", status: 404, contains: "<html" },
    { what: "the image optimiser, which is off", url: "/_next/image?url=%2Ficon.png&w=64&q=75", status: 404 },
    { what: "the form endpoint, an unknown form", url: "/api/forms/no-such-form", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, status: 404, contains: '"unknown_form"' },
  ];
}

const pathOf = (location, base) => { const url = new URL(location, base); return url.origin === new URL(base).origin ? url.pathname + url.search : url.href; };

/** Why an answer is wrong, or null: the status first, then the bytes, the text or the place it sends to. */
export function problem(want, got, base) {
  if (got.status !== want.status) return `answered ${got.status}, not ${want.status}`;
  if (want.body && !got.body.equals(want.body)) return `answered ${got.status} with ${got.body.length} bytes that are not the ${want.body.length} the build prerendered`;
  if (want.contains && !got.body.includes(want.contains)) return `answered ${got.status} without ${want.contains}`;
  if (want.location && (!got.location || pathOf(got.location, base) !== want.location)) return `sends to ${got.location ?? "nowhere"}, not ${want.location}`;
  return null;
}

async function ask(base, { url, init }) {
  const response = await fetch(base + url, { redirect: "manual", signal: AbortSignal.timeout(REQUEST_MS), ...init });
  return { status: response.status, location: response.headers.get("location"), body: Buffer.from(await response.arrayBuffer()) };
}

/** Every wrong answer, as one line each; [] when the server at `base` answers as the build says. */
export async function wrongAnswers(base, wanted) {
  const out = [];
  for (const want of wanted) {
    const why = await ask(base, want).then((got) => problem(want, got, base), (error) => `gave no answer (${error.cause?.code ?? error.name})`);
    if (why) out.push(`${want.what}: ${why}`);
  }
  return out;
}

/** The last lines of a log, its colours and empty lines taken out. */
export function tail(log, lines = 30) {
  // eslint-disable-next-line no-control-regex -- the escape codes a terminal colours with
  return log.replace(/\u001b\[[0-9;]*m/g, "").split("\n").filter((line) => line.trim()).slice(-lines).map((line) => line.slice(0, 300)).join("\n");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The built Worker in workerd on a port: { log(), started, stop() }, `started` false when it died or never listened. */
async function serveWorker(port) {
  const child = spawn("pnpm", ["exec", "opennextjs-cloudflare", "preview", "--ip", HOST, "--port", String(port)], { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  let log = "", dead = false;
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => { log += data; });
  child.on("exit", () => { dead = true; });
  // the group: pnpm, OpenNext, wrangler and workerd are four processes
  const stop = () => { try { process.kill(-child.pid, "SIGTERM"); } catch { /* it is gone */ } };
  process.once("exit", stop);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => process.exit(1));
  let started = false;
  for (let second = 0; second < START_SECONDS && !started && !dead; second++) started = await ask(`http://${HOST}:${port}`, { url: "/robots.txt" }).then(() => true, () => sleep(1000).then(() => false));
  return { log: () => log, started, stop };
}

async function main(argv) {
  const unknown = argv.filter((arg) => arg !== "--no-build");
  if (unknown.length) { console.error(`worker-smoke: unknown argument ${unknown[0]}; only --no-build`); return 2; }
  if (!argv.includes("--no-build") && spawnSync("pnpm", ["exec", "opennextjs-cloudflare", "build"], { cwd: ROOT, stdio: "inherit" }).status !== 0) { console.error("worker-smoke: the Worker did not build"); return 2; }
  const wanted = expectations(ROOT);
  if (!wanted.length) { console.error("worker-smoke: no prerendered page under .next/server/app to compare with; run it without --no-build"); return 2; }
  const port = await freePort(HOST), base = `http://${HOST}:${port}`;
  const worker = await serveWorker(port);
  const wrong = worker.started ? await wrongAnswers(base, wanted) : ["the Worker did not start"];
  worker.stop();
  for (const line of wrong) console.error(`worker-smoke: ${line}`);
  if (wrong.length) { console.error(`worker-smoke: ${worker.started ? `${wrong.length} of ${wanted.length} answers wrong` : "nothing asked"}; the end of the Worker's log:\n${tail(worker.log())}`); return 1; }
  console.log(`worker-smoke: the Worker answers as the build says, ${wanted.length} answers, ${wanted.filter(({ body }) => body).length} of them byte for byte`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) process.exit(await main(process.argv.slice(2)));
