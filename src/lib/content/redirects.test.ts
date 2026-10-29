// redirectsFor(): content/redirects.yaml as next.config.ts's redirects()
// returns it — permanent unless an entry says false — and a file its schema
// refuses failing as the build would, naming the entry.
import assert from "node:assert/strict";
import { test } from "node:test";
import { redirectsFor } from "./redirects.ts";
import { expectContentError, withContent } from "./test-helpers.ts";

test("each entry as Next takes it: source, destination, permanent unless it says false", () => {
  const file = "- from: /old-blog\n  to: /blog\n- from: /promo\n  to: https://nimbus.dev/offer\n  permanent: false\n";
  withContent({ "redirects.yaml": file }, () => {
    assert.deepEqual(redirectsFor(), [
      { source: "/old-blog", destination: "/blog", permanent: true },
      { source: "/promo", destination: "https://nimbus.dev/offer", permanent: false },
    ]);
  });
  withContent({ "redirects.yaml": "[]\n" }, () => assert.deepEqual(redirectsFor(), [], "none yet"));
});

test("a file the schema refuses, or none, fails the config as it would the build", () => {
  withContent({ "redirects.yaml": "- from: /old/\n  to: /blog\n" }, () => expectContentError(() => redirectsFor(), "content/redirects.yaml", "[0].from must be a path the site no longer answers"));
  withContent({ "redirects.yaml": "- from: /old\n  to: /blog\n  status: 301\n" }, () => expectContentError(() => redirectsFor(), "content/redirects.yaml", "[0]", "status"));
  withContent({}, () => expectContentError(() => redirectsFor(), "content/redirects.yaml", "no such file"));
});
