// lab route and lab clean through the bin, in a throwaway site root: the
// route written from the template, refused twice, removed with the lab, and
// a site's own page at that path left alone; another server on the dev port
// named instead of waited on; lab serve's --sizes, given and not.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const BIN = path.resolve(import.meta.dirname, "../bin/agentic-cms.mjs");
const run = (root, args) => spawnSync(process.execPath, [BIN, "lab", ...args], { cwd: root, encoding: "utf8" });
const ROUTE = "src/app/lab-demo/page.tsx";

test("lab route writes the template once (--force again); lab clean removes the lab and the kit's route, keeps a site's own", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lab-route-"));
  try {
    const first = run(root, ["route", "--json"]);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(JSON.parse(first.stdout), { file: ROUTE, path: "/lab-demo", urls: [], ready: false, status: null }, "no dev server (no package.json here): nothing asked");
    assert.match(run(root, ["route", "--force"]).stdout, /no dev server answers \(package\.json's scripts\.dev names no port; --url names a server\): pnpm kit serve starts it, waits for \/lab-demo and prints the URLs to hand over/);
    const page = fs.readFileSync(path.join(root, ROUTE), "utf8");
    assert.match(page, /import \{ LabScenes \} from "agentic-cms\/lab";/);
    assert.match(page, /export const metadata = kit\.seo\.unlistedMetadata\(\);/, "noindex, from kit.seo as every route's head");
    assert.doesNotMatch(page, /force-dynamic/, "a static route, so the build's SEO audit sees it — the guard");
    assert.match(page, /<LabScenes \/>/, "on LabScenes' own grounds (LAB_GROUNDS: the page, a white card) until the site passes its own");
    const again = run(root, ["route"]);
    assert.equal(again.status, 2);
    assert.match(again.stderr, /src\/app\/lab-demo\/page\.tsx exists; edit it, or pass --force/);
    assert.equal(run(root, ["route", "--force"]).status, 0);

    assert.equal(run(root, ["new", "spin", "--kind", "loop"]).status, 0);
    fs.mkdirSync(path.join(root, ".next/dev/types"), { recursive: true });
    fs.writeFileSync(path.join(root, ".next/dev/types/validator.ts"), '// Validate ../../../src/app/lab-demo/page.tsx\nconst handler = {} as typeof import("../../../src/app/lab-demo/page.js")\n');
    const clean = run(root, ["clean", "--json"]);
    assert.equal(clean.status, 0, clean.stderr);
    assert.deepEqual(JSON.parse(clean.stdout), { removed: [".parity/lab", "src/app/lab-demo", ".next/dev/types/validator.ts"], kept: [] });
    assert.ok(!fs.existsSync(path.join(root, ".parity/lab")) && !fs.existsSync(path.join(root, "src/app/lab-demo")) && !fs.existsSync(path.join(root, ".next/dev/types/validator.ts")), "next dev's stale route types go too");
    fs.writeFileSync(path.join(root, ".next/dev/types/validator.ts"), "// Validate ../../../src/app/page.tsx\n");
    assert.deepEqual(JSON.parse(run(root, ["clean", "--json"]).stdout), { removed: [], kept: [] }, "a validator that does not name the route stays");

    fs.mkdirSync(path.join(root, "src/app/lab-demo"), { recursive: true });
    fs.writeFileSync(path.join(root, ROUTE), "export default function Own() { return null; }\n");
    const kept = run(root, ["clean", "--json"]);
    assert.deepEqual(JSON.parse(kept.stdout), { removed: [], kept: [ROUTE] });
    assert.match(run(root, ["clean"]).stdout, /nothing to remove; src\/app\/lab-demo\/page\.tsx kept \(not the kit's route/);
    assert.ok(fs.existsSync(path.join(root, ROUTE)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("lab route: another server on the port of scripts.dev is named at once, its route asked of nobody, exit 1; the route stays written", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lab-"));
  const asked = [];
  const server = http.createServer((req, res) => { asked.push(req.url); res.writeHead(404); res.end(); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { dev: `next dev -p ${port}` } }));
    const r = await new Promise((resolve) => {
      const child = spawn(process.execPath, [BIN, "lab", "route", "--no-public"], { cwd: root });
      let stdout = "", stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("exit", (status) => resolve({ status, stdout, stderr }));
    });
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, new RegExp(`^port ${port} answers, but not as this clone's next dev \\(\\.next/dev/lock names none running\\), so /lab-demo is not served there: stop what holds the port`));
    assert.deepEqual(asked, []);
    assert.ok(fs.existsSync(path.join(root, ROUTE)));
  } finally { await new Promise((resolve) => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
});

/** lab serve on a free loopback port until the page is read: { body } of `page`, and what serve printed ({ out }) at { base }. */
async function servePage(root, args, page) {
  const child = spawn(process.execPath, [BIN, "lab", "serve", "--host", "127.0.0.1", "--port", "0", ...args], { cwd: root });
  try {
    const { base, out } = await new Promise((resolve, reject) => {
      let text = "";
      child.stdout.on("data", (chunk) => { text += chunk; const url = text.match(/http:\/\/127\.0\.0\.1:\d+/); if (url && /hand over each scene's own page|no scene yet/.test(text)) resolve({ base: url[0], out: text }); });
      child.on("exit", (code) => reject(new Error(`lab serve exited ${code}`)));
    });
    return { body: await (await fetch(`${base}${page}`)).text(), out, base };
  } finally { child.kill("SIGTERM"); }
}

test("lab serve: --sizes applies to a scene of any width; without it a wide scene shows at its own size; a bad size exits 2", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lab-serve-"));
  try {
    fs.mkdirSync(path.join(root, ".parity/lab"), { recursive: true });
    fs.writeFileSync(path.join(root, ".parity/lab/wide.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100"><rect/></svg>');
    const given = await servePage(root, ["--sizes", "32,160"], "/scene/wide");
    assert.match(given.body, /width=32&pad=8[\s\S]*width=160&pad=8[\s\S]*width=400&pad=8/);
    assert.ok(given.out.includes(`hand over each scene's own page:\n       wide  ${given.base}/scene/wide\n`), `each scene's URL printed:\n${given.out}`);
    const plain = await servePage(root, [], "/scene/wide");
    assert.doesNotMatch(plain.body, /width=(24|40|64)&pad=8/, "the icon sizes are for an icon-sized scene");
    const bad = run(root, ["serve", "--sizes", "32,big"]);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /--sizes: big is not a size in whole pixels/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("lab clean keeps an icon round and names it; everything else of the lab goes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lab-rounds-"));
  try {
    for (const file of [".parity/lab/spin.svg", ".parity/lab/rounds/modules/round.yaml", ".parity/lab/rounds/modules/graph-A.svg", ".parity/lab/scratch/notes.svg"]) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), "<svg/>"); }
    const r = run(root, ["clean", "--json"]);
    assert.deepEqual(JSON.parse(r.stdout), { removed: [".parity/lab/scratch", ".parity/lab/spin.svg"], kept: [".parity/lab/rounds/modules"] });
    assert.ok(fs.existsSync(path.join(root, ".parity/lab/rounds/modules/graph-A.svg")));
    assert.match(run(root, ["clean"]).stdout, /nothing to remove; \.parity\/lab\/rounds\/modules kept \(an icon round: agentic-cms icons round retire modules\)/);
    assert.match(run(root, ["clean", "--help"]).stdout, /all but an icon round in progress/, "the help says so too");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
