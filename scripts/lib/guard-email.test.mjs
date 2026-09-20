import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { domainPattern, scanServed } from "./guard-email.mjs";

function site(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guard-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}

test("the pattern escapes every dot and matches an address at the domain only", () => {
  const re = domainPattern(["acme.co.uk"]);
  assert.ok(re.test("hello@acme.co.uk"));
  assert.ok(!re.test("hello@acmeXcoXuk"));
  assert.ok(!re.test("hello@other.example"));
  assert.ok(domainPattern(["a.example", "b.example"]).test("x@b.example"));
});

test("served files with an address are found, with the addresses; a token, another domain and unscanned kinds pass", () => {
  const root = site({
    ".next/server/app/index.html": "<p>Write to hello@acme.example or sales@acme.example</p>",
    ".next/server/app/index.rsc": '["hello@acme.example"]',
    ".next/server/app/contact.segment.rsc": "token aGVsbG8=",
    ".next/server/app/feed.xml.body": "<author>news@acme.example</author>",
    ".next/static/chunks/app.js": 'const to="support@acme.example"',
    ".next/static/chunks/other.js": 'const to="someone@other.example"',
    ".next/server/app/index.png": "hello@acme.example",
    "public/x.html": "public is not served from the build: hello@acme.example",
  });
  const result = scanServed(root, ["acme.example"]);
  assert.equal(result.scanned, 6);
  assert.deepEqual(result.hits.map((h) => [h.file, h.addresses]), [
    [".next/server/app/feed.xml.body", ["news@acme.example"]],
    [".next/server/app/index.html", ["hello@acme.example", "sales@acme.example"]],
    [".next/server/app/index.rsc", ["hello@acme.example"]],
    [".next/static/chunks/app.js", ["support@acme.example"]],
  ]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a site without a build scans nothing and says so", () => {
  const root = site({ "public/x.txt": "x" });
  const result = scanServed(root, ["acme.example"]);
  assert.equal(result.scanned, 0);
  assert.deepEqual(result.hits, []);
  fs.rmSync(root, { recursive: true, force: true });
});
