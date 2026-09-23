// lab route and lab clean through the bin, in a throwaway site root: the
// route written from the template, refused twice, removed with the lab, and
// a site's own page at that path left alone; lab serve's --sizes, given and
// not.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
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
    assert.deepEqual(JSON.parse(first.stdout), { file: ROUTE, path: "/lab-demo" });
    const page = fs.readFileSync(path.join(root, ROUTE), "utf8");
    assert.match(page, /import \{ LabScenes, type Ground \} from "agentic-cms\/lab";/);
    assert.match(page, /robots: \{ index: false \}/);
    assert.doesNotMatch(page, /force-dynamic/, "a static route, so the build's SEO audit sees it — the guard");
    assert.match(page, /label: "the page"[\s\S]*label: "white card"/);
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

/** lab serve on a free loopback port until the page is read; the body of `page`. */
async function servePage(root, args, page) {
  const child = spawn(process.execPath, [BIN, "lab", "serve", "--host", "127.0.0.1", "--port", "0", ...args], { cwd: root });
  try {
    const base = await new Promise((resolve, reject) => {
      let out = "";
      child.stdout.on("data", (chunk) => { out += chunk; const url = out.match(/http:\/\/127\.0\.0\.1:\d+/); if (url) resolve(url[0]); });
      child.on("exit", (code) => reject(new Error(`lab serve exited ${code}`)));
    });
    return await (await fetch(`${base}${page}`)).text();
  } finally { child.kill("SIGTERM"); }
}

test("lab serve: --sizes applies to a scene of any width; without it a wide scene shows at its own size; a bad size exits 2", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lab-serve-"));
  try {
    fs.mkdirSync(path.join(root, ".parity/lab"), { recursive: true });
    fs.writeFileSync(path.join(root, ".parity/lab/wide.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100"><rect/></svg>');
    const given = await servePage(root, ["--sizes", "32,160"], "/scene/wide");
    assert.match(given, /width=32&pad=8[\s\S]*width=160&pad=8[\s\S]*width=400&pad=8/);
    const plain = await servePage(root, [], "/scene/wide");
    assert.doesNotMatch(plain, /width=(24|40|64)&pad=8/, "the icon sizes are for an icon-sized scene");
    const bad = run(root, ["serve", "--sizes", "32,big"]);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /--sizes: big is not a size in whole pixels/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
