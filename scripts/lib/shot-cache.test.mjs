import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CACHE_DIR, KEEP, digester, filesOf, harnessDigest, lookup, recordDeps, reuse, settingsKey, store } from "./shot-cache.mjs";

// A build as the harness serves it: a served path maps to a file under the root.
function build(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shot-cache-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}
const resolverOf = (root) => (served) => path.join(root, served === "/" ? "index.html" : served.slice(1));
const PAGE = { "index.html": '<html><script src="/app.js"></script>{"b":"BUILD-A"}</html>', "app.js": "js", "logo.svg": "<svg/>" };

// One shot of "/" stored from a capture directory, the way a capture stores it.
function shoot(site, key, buildId, capture) {
  const digestOf = digester(resolverOf(site), buildId);
  fs.mkdirSync(capture, { recursive: true });
  for (const f of ["home@390.png", "home@390.sections.json", "home@390--menu.png"]) fs.writeFileSync(path.join(capture, f), f);
  store(site, key, "home@390", recordDeps(["/", "/app.js", "/logo.svg", "/app.js"], digestOf, buildId), capture, filesOf(capture, "home@390"));
}

test("a shot is reused while every file it loaded has the same bytes, and taken again when one changes", () => {
  const site = build(PAGE);
  const key = settingsKey({ harness: "h1", browser: "c1", settings: { scheme: "light" } });
  shoot(site, key, "BUILD-A", path.join(site, "a"));
  const hit = lookup(site, key, "home@390", digester(resolverOf(site), "BUILD-A"), "BUILD-A");
  assert.deepEqual(hit.files, ["home@390--menu.png", "home@390.png", "home@390.sections.json"]);
  const into = path.join(site, "b");
  fs.mkdirSync(into);
  assert.equal(reuse(hit, into), 3);
  assert.equal(fs.readFileSync(path.join(into, "home@390.png"), "utf8"), "home@390.png");
  fs.writeFileSync(path.join(site, "logo.svg"), "<svg><circle/></svg>");
  assert.equal(lookup(site, key, "home@390", digester(resolverOf(site), "BUILD-A"), "BUILD-A"), null, "an image the page loads changed");
  fs.rmSync(site, { recursive: true, force: true });
});

test("another build of the same source hits: the build id is masked, in the files and in the paths", () => {
  const site = build({ ...PAGE, "_next/static/BUILD-A/_buildManifest.js": "self.__BUILD_MANIFEST={id:'BUILD-A'}" });
  const key = settingsKey({ harness: "h1", browser: "c1", settings: {} });
  const digestA = digester(resolverOf(site), "BUILD-A");
  const capture = path.join(site, "a");
  fs.mkdirSync(capture);
  fs.writeFileSync(path.join(capture, "home@390.png"), "png");
  store(site, key, "home@390", recordDeps(["/", "/_next/static/BUILD-A/_buildManifest.js"], digestA, "BUILD-A"), capture, ["home@390.png"]);
  // the rebuild: the same files, the new id wherever the old one was
  fs.renameSync(path.join(site, "_next/static/BUILD-A"), path.join(site, "_next/static/BUILD-B"));
  fs.writeFileSync(path.join(site, "_next/static/BUILD-B/_buildManifest.js"), "self.__BUILD_MANIFEST={id:'BUILD-B'}");
  fs.writeFileSync(path.join(site, "index.html"), PAGE["index.html"].replace("BUILD-A", "BUILD-B"));
  assert.ok(lookup(site, key, "home@390", digester(resolverOf(site), "BUILD-B"), "BUILD-B"), "the same page under a new build id");
  fs.writeFileSync(path.join(site, "index.html"), PAGE["index.html"].replace("BUILD-A", "BUILD-B").replace("<html>", "<html lang=en>"));
  assert.equal(lookup(site, key, "home@390", digester(resolverOf(site), "BUILD-B"), "BUILD-B"), null, "a real change still misses");
  fs.rmSync(site, { recursive: true, force: true });
});

test("the harness, the browser and the settings are part of the key; a missing file is recorded as missing", () => {
  const site = build(PAGE);
  const key = settingsKey({ harness: "h1", browser: "c1", settings: { scheme: "light" } });
  for (const other of [{ harness: "h2", browser: "c1", settings: { scheme: "light" } }, { harness: "h1", browser: "c2", settings: { scheme: "light" } }, { harness: "h1", browser: "c1", settings: { scheme: "dark" } }]) assert.notEqual(settingsKey(other), key);
  const digestOf = digester(resolverOf(site), null);
  assert.deepEqual(recordDeps(["/gone.svg"], digestOf, null), { "/gone.svg": null });
  const one = path.join(site, "h1.mjs"), two = path.join(site, "h2.mjs");
  fs.writeFileSync(one, "a"); fs.writeFileSync(two, "b");
  const before = harnessDigest([one, two]);
  fs.writeFileSync(two, "c");
  assert.notEqual(harnessDigest([one, two]), before, "a changed harness source retires the cache");
  fs.rmSync(site, { recursive: true, force: true });
});

test(`at most ${KEEP} entries per page-width, the least recently used going first; an entry whose shots are gone is not a hit`, () => {
  const site = build(PAGE);
  const key = "k";
  const capture = path.join(site, "c");
  fs.mkdirSync(capture);
  fs.writeFileSync(path.join(capture, "home@390.png"), "png");
  for (let i = 0; i < KEEP + 2; i++) {
    fs.writeFileSync(path.join(site, "app.js"), `js ${i}`);
    store(site, key, "home@390", recordDeps(["/app.js"], digester(resolverOf(site), null), null), capture, ["home@390.png"]);
    const entries = fs.readdirSync(path.join(site, CACHE_DIR, key, "home@390"));
    for (const [n, e] of entries.entries()) fs.utimesSync(path.join(site, CACHE_DIR, key, "home@390", e, "deps.json"), new Date(Date.now() - 1000 * (entries.length - n)), new Date(Date.now() - 1000 * (entries.length - n)));
  }
  assert.equal(fs.readdirSync(path.join(site, CACHE_DIR, key, "home@390")).length, KEEP);
  const hit = lookup(site, key, "home@390", digester(resolverOf(site), null), null);
  assert.ok(hit, "the latest state is kept");
  fs.rmSync(path.join(hit.dir, "home@390.png"));
  assert.equal(lookup(site, key, "home@390", digester(resolverOf(site), null), null), null);
  fs.rmSync(site, { recursive: true, force: true });
});

test("a page-width's files are its own: another width or page with a shared prefix is not", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shot-files-"));
  for (const f of ["home@390.png", "home@390--menu.png", "home@390.sections.json", "home@3900.png", "home@390x.png", "about@390.png"]) fs.writeFileSync(path.join(dir, f), "");
  assert.deepEqual(filesOf(dir, "home@390"), ["home@390--menu.png", "home@390.png", "home@390.sections.json"]);
  fs.rmSync(dir, { recursive: true, force: true });
});
