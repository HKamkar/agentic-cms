import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { snapshotBuild, treeState } from "./snapshot.mjs";

function site(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}

test("the build and public/ are copied in the layout the static server reads; the rest of .next is not", () => {
  const root = site({ ".next/BUILD_ID": "b1", ".next/server/app/index.html": "<h1>home</h1>", ".next/server/app/index.rsc": "rsc", ".next/static/chunks/a.js": "js", ".next/cache/big.bin": "cache", "public/images/mark.svg": "<svg/>", "src/app/page.tsx": "source" });
  const dest = path.join(root, ".parity/snapshots/x");
  const result = snapshotBuild(root, dest);
  assert.equal(result.dir, dest);
  assert.equal(result.files, 4);
  assert.equal(result.bytes, "<h1>home</h1>".length + 3 + 2 + 6);
  for (const file of [".next/server/app/index.html", ".next/server/app/index.rsc", ".next/static/chunks/a.js", "public/images/mark.svg"]) assert.ok(fs.existsSync(path.join(dest, file)), file);
  assert.ok(!fs.existsSync(path.join(dest, ".next/cache")));
  assert.ok(!fs.existsSync(path.join(dest, "src")));
  fs.writeFileSync(path.join(root, "public/images/mark.svg"), "<svg>changed</svg>");
  assert.equal(fs.readFileSync(path.join(dest, "public/images/mark.svg"), "utf8"), "<svg/>", "an edit after the snapshot does not reach it");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a build without .next/static or BUILD_ID is copied; a second snapshot replaces the first", () => {
  const root = site({ ".next/server/app/index.html": "a", "public/x.txt": "x" });
  const dest = path.join(root, ".parity/snapshots/x");
  fs.mkdirSync(path.join(dest, "stale"), { recursive: true });
  assert.equal(snapshotBuild(root, dest).files, 2);
  assert.ok(!fs.existsSync(path.join(dest, "stale")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("no build is an error naming the fix", () => {
  const root = site({ "public/x.txt": "x" });
  assert.throws(() => snapshotBuild(root, path.join(root, ".parity/snapshots/x")), /no production build: run `pnpm build` first/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a build that changes while it is being copied fails the snapshot and leaves no half copy", () => {
  const root = site({ ".next/BUILD_ID": "b1", ".next/server/app/index.html": "a" });
  const dest = path.join(root, ".parity/snapshots/x");
  // cpSync is synchronous, so a concurrent build is simulated by a BUILD_ID that reads differently the second time
  const read = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = (file, ...rest) => (String(file).endsWith("BUILD_ID") ? (reads++ ? "b2" : "b1") : read(file, ...rest));
  try { assert.throws(() => snapshotBuild(root, dest), /the build changed while it was being copied/); } finally { fs.readFileSync = read; }
  assert.ok(!fs.existsSync(dest));
  fs.rmSync(root, { recursive: true, force: true });
});

test("treeState: HEAD and whether the checkout has changes; null outside git", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const fake = (porcelain) => (command, args) => (args[0] === "rev-parse" ? `${sha}\n` : porcelain);
  assert.deepEqual(treeState("/x", fake("")), { head: sha, dirty: false });
  assert.deepEqual(treeState("/x", fake(" M src/app/page.tsx\n")), { head: sha, dirty: true });
  assert.equal(treeState("/x", () => { throw new Error("not a git repository"); }), null);
});
