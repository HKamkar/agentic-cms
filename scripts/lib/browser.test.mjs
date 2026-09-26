import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_ROUTE, capturePages } from "./browser.mjs";

test("a capture leaves the demo routes out of the build's pages, unless --pages names one", () => {
  const routes = ["/", "/_not-found", "/blog", "/hero-demo", "/lab-demo", "/sections/about", "/x-demo/nested", "/demo", "/demos"];
  assert.deepEqual(capturePages(routes), ["/", "/_not-found", "/blog", "/sections/about", "/demo", "/demos"]);
  assert.deepEqual(capturePages(routes, ["/hero-demo"]), ["/hero-demo"], "asked for by name: photographed");
  assert.ok(DEMO_ROUTE.test("/lab-demo") && !DEMO_ROUTE.test("/blog-post/a-demo-of-x"));
});
