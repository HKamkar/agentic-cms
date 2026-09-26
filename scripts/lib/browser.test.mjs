import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DEMO_ROUTE, capturePages, sampleRoutes, templatesOf } from "./browser.mjs";

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
