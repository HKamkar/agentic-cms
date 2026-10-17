import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DEMO_ROUTE, ENGINES, NO_BUILD, capturePages, isLoop, sampleRoutes, templatesOf, webkitPath } from "./browser.mjs";

test("a capture leaves the demo routes out of the build's pages, unless --pages names one", () => {
  const routes = ["/", "/_not-found", "/blog", "/hero-demo", "/lab-demo", "/sections/about", "/x-demo/nested", "/demo", "/demos"];
  assert.deepEqual(capturePages(routes), ["/", "/_not-found", "/blog", "/sections/about", "/demo", "/demos"]);
  assert.deepEqual(capturePages(routes, ["/hero-demo"]), ["/hero-demo"], "asked for by name: photographed");
  assert.ok(DEMO_ROUTE.test("/lab-demo") && !DEMO_ROUTE.test("/blog-post/a-demo-of-x"));
});

test("--sample: a template's first n routes in route order, every other route kept; a catch-all is no template", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "templates-"));
  fs.mkdirSync(path.join(root, ".next"));
  const routes = { "/": "/[[...slug]]", "/blog": "/[[...slug]]", "/about": null, "/docs/a/b": "/docs/[...rest]", "/blog-post/c": "/blog-post/[slug]", "/blog-post/a": "/blog-post/[slug]", "/blog-post/b": "/blog-post/[slug]", "/team/x": "/team/[who]", "/team/y": "/team/[who]" };
  fs.writeFileSync(path.join(root, ".next/prerender-manifest.json"), JSON.stringify({ routes: Object.fromEntries(Object.entries(routes).map(([route, srcRoute]) => [route, { srcRoute }])) }));
  const templates = templatesOf(root);
  assert.deepEqual([...templates.keys()].sort(), ["/blog-post/a", "/blog-post/b", "/blog-post/c", "/team/x", "/team/y"], "the catch-alls and a page of its own are no template");
  assert.deepEqual(sampleRoutes(Object.keys(routes), templates, 1), { pages: ["/", "/about", "/blog", "/blog-post/a", "/docs/a/b", "/team/x"], skipped: ["/blog-post/b", "/blog-post/c", "/team/y"] });
  assert.deepEqual(sampleRoutes(Object.keys(routes), templates, 2).skipped, ["/blog-post/c"]);
  assert.deepEqual(templatesOf(path.join(root, "nowhere")), new Map(), "no manifest: nothing is sampled");
  fs.rmSync(root, { recursive: true, force: true });
});

test("webkitPath: playwright-core's own WebKit build first, else the newest webkit-<n> in the cache that has its launcher; null when none", () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), "pw-cache-"));
  const build = (name, file) => { fs.mkdirSync(path.join(cache, name), { recursive: true }); if (file) fs.writeFileSync(path.join(cache, name, file), ""); return path.join(cache, name, file ?? ""); };
  try {
    const none = { webkit: { executablePath: () => path.join(cache, "webkit-9999/pw_run.sh") } };
    assert.equal(webkitPath({ caches: [cache], pw: none }), null, "an empty cache, and the build playwright-core names not installed");
    build("webkit-2100", "pw_run.sh");
    const newest = build("webkit-2300", "pw_run.sh");
    build("webkit-2400");
    build("chromium-1243", "pw_run.sh");
    assert.equal(webkitPath({ caches: [cache], pw: none }), newest, "the newest build with a launcher; a half-installed folder is passed over");
    const own = build("webkit-2200", "pw_run.sh");
    assert.equal(webkitPath({ caches: [cache], pw: { webkit: { executablePath: () => own } } }), own, "the build this playwright-core speaks to wins over a newer one");
    assert.equal(webkitPath({ caches: [path.join(cache, "nowhere"), cache], pw: null }), newest, "without playwright-core loaded: the cache alone");
    assert.deepEqual(ENGINES, ["chromium", "webkit"]);
    assert.match(NO_BUILD.chromium, /^agentic-cms: no Chromium build found — run `bash scripts\/setup\.sh`/);
    assert.match(NO_BUILD.webkit, /no WebKit build found — run `bash scripts\/setup\.sh`/);
  } finally { fs.rmSync(cache, { recursive: true, force: true }); }
});

test("isLoop: an animation the DevTools protocol reports without a finite iteration count is a loop, however it says so", () => {
  for (const iterations of [undefined, null, Infinity, "Infinity", Number.NaN]) assert.equal(isLoop(iterations), true, String(iterations));
  for (const iterations of [1, 3, 0.5, 0]) assert.equal(isLoop(iterations), false, String(iterations));
});
