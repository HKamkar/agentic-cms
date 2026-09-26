import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkPackage, complete, copyInto, hasPackage, packageDir } from "./assemble.mjs";

function site(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "assemble-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}

// A standalone build as next build leaves it: server.js, and the one public file server code read at build time, already traced into the package.
const BUILD = {
  ".next/standalone/server.js": "// server",
  ".next/standalone/public/images/platform/loop.svg": "<svg>loop</svg>",
  "public/images/platform/loop.svg": "<svg>loop</svg>",
  "public/images/hero.webp": "webp",
  "public/favicon.ico": "ico",
  ".next/static/chunks/app.js": "js",
  ".next/static/css/app.css": "css",
};

test("the incident: public/ is copied into the folder the trace already made, never nested inside it, and the package is complete", () => {
  const root = site(BUILD);
  assert.ok(hasPackage(root));
  const { removed } = copyInto(root);
  assert.deepEqual(removed, []);
  assert.ok(!fs.existsSync(path.join(root, ".next/standalone/public/public")));
  for (const file of ["public/images/hero.webp", "public/favicon.ico", "public/images/platform/loop.svg", ".next/static/chunks/app.js", ".next/static/css/app.css"]) assert.ok(fs.existsSync(path.join(root, ".next/standalone", file)), file);
  const report = checkPackage(root);
  assert.ok(complete(report));
  assert.equal(report.package, ".next/standalone");
  assert.deepEqual(report.parts.map((p) => [p.from, p.files]), [["public", 3], [".next/static", 2]]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a check before the copy names every file that is missing from the package", () => {
  const root = site(BUILD);
  const report = checkPackage(root);
  assert.ok(!complete(report));
  assert.deepEqual(report.missing, [".next/standalone/public/favicon.ico", ".next/standalone/public/images/hero.webp", ".next/standalone/.next/static/chunks/app.js", ".next/standalone/.next/static/css/app.css"]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a copy nested inside its folder is reported, and the copy removes it", () => {
  const root = site({ ...BUILD, ".next/standalone/public/public/images/hero.webp": "webp" });
  assert.deepEqual(checkPackage(root).nested, [".next/standalone/public/public"]);
  assert.deepEqual(copyInto(root).removed, [".next/standalone/public/public"]);
  const report = checkPackage(root);
  assert.ok(complete(report));
  assert.deepEqual(report.extra, [], "the nested copy is not counted twice as extra files");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a site whose own public/ holds a public/ folder is not a nested copy", () => {
  const root = site({ ...BUILD, "public/public/readme.txt": "a folder of the site's own" });
  copyInto(root);
  const report = checkPackage(root);
  assert.deepEqual(report.nested, []);
  assert.ok(complete(report));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a file whose bytes differ from its source is named; a file with no source is extra, not a failure", () => {
  const root = site(BUILD);
  copyInto(root);
  fs.writeFileSync(path.join(root, ".next/standalone/public/favicon.ico"), "ic0");
  fs.writeFileSync(path.join(root, ".next/standalone/public/stale.txt"), "left by an earlier copy");
  const report = checkPackage(root);
  assert.deepEqual(report.differ, [".next/standalone/public/favicon.ico"]);
  assert.deepEqual(report.extra, [".next/standalone/public/stale.txt"]);
  assert.ok(!complete(report));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a site without .next/static, or without public/, packages what it has", () => {
  const root = site({ ".next/standalone/server.js": "// server", "public/robots.txt": "User-agent: *" });
  copyInto(root);
  const report = checkPackage(root);
  assert.ok(complete(report));
  assert.deepEqual(report.parts.map((p) => p.from), ["public"]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("the package sits at relativeAppDir when the trace root lies above the site; no server.js means no package", () => {
  const root = site({ ".next/required-server-files.json": JSON.stringify({ relativeAppDir: "apps/web" }), ".next/standalone/apps/web/server.js": "// server", "public/a.txt": "a" });
  assert.equal(packageDir(root), path.join(root, ".next/standalone/apps/web"));
  copyInto(root);
  assert.ok(fs.existsSync(path.join(root, ".next/standalone/apps/web/public/a.txt")));
  assert.ok(complete(checkPackage(root)));
  const bare = site({ "public/a.txt": "a" });
  assert.ok(!hasPackage(bare));
  for (const dir of [root, bare]) fs.rmSync(dir, { recursive: true, force: true });
});
