// The Worker's check (worker-smoke.mjs) without a Worker: a small build and a
// server that answers as it, then as each way a Worker goes wrong. The check
// itself runs in CI's worker job. Run with `pnpm test`.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { expectations, problem, tail, wrongAnswers } from "./worker-smoke.mjs";

const REPO = path.resolve(import.meta.dirname, "..");
const PAGE = '<!DOCTYPE html><html><script src="/_next/static/chunks/a.js"></script><link href="/_next/static/chunks/a.css"/>home</html>';
const REDIRECTS = [
  { source: "/:path+/", destination: "/:path+", internal: true, statusCode: 308 },
  { source: "/old", destination: "/blog", statusCode: 308 },
  { source: "/docs/:slug", destination: "/blog/:slug", statusCode: 308 },
];

/** A build as Next leaves it: two pages, Next's own, a feed, the routes manifest; gone after the test. */
function build(t, { pages = { "index.html": PAGE, "blog.html": "<html>blog</html>", "blog-post/one.html": "<html>one</html>", "_not-found.html": "<html>404</html>" } } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "worker-smoke-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, text] of Object.entries({ ...pages, "feed.xml.body": "<rss/>", "feed.xml.meta": "{}" })) {
    fs.mkdirSync(path.join(root, ".next/server/app", path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(root, ".next/server/app", file), text);
  }
  fs.writeFileSync(path.join(root, ".next/routes-manifest.json"), JSON.stringify({ redirects: REDIRECTS }));
  return root;
}

const GOOD = {
  "/": [200, PAGE], "/blog": [200, "<html>blog</html>"], "/blog-post/one": [200, "<html>one</html>"], "/feed.xml": [200, "<rss/>"],
  "/_next/static/chunks/a.js": [200, "a"], "/_next/static/chunks/a.css": [200, "a"], "/old": [308, "", { location: "/blog" }],
  "/api/forms/no-such-form": [404, '{"ok":false,"error":"unknown_form"}'],
};

/** What a server that answers from the table gets wrong of the build: the lines, its answers over `GOOD`'s. */
async function wrong(t, changed = {}, other = [404, "<!DOCTYPE html><html>none</html>"]) {
  const answers = { ...GOOD, ...changed };
  const server = http.createServer((req, res) => { const [status, body, headers] = answers[req.url.split("?")[0]] ?? other; res.writeHead(status, headers).end(body); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  return wrongAnswers(`http://127.0.0.1:${server.address().port}`, expectations(build(t)));
}

test("the build says what to ask: its pages and files with their bytes, the scripts and styles they load, the redirects that name one path, and the answers that are not pages", (t) => {
  const wanted = expectations(build(t));
  assert.deepEqual(wanted.filter(({ body }) => body).map(({ url }) => url).sort(), ["/", "/blog", "/blog-post/one", "/feed.xml"], "Next's own pages are not asked for");
  assert.deepEqual(wanted.filter(({ url }) => url.startsWith("/_next/static/")).map(({ url }) => url), ["/_next/static/chunks/a.js", "/_next/static/chunks/a.css"]);
  assert.deepEqual(wanted.filter(({ location }) => location).map(({ url, location }) => [url, location]), [["/old", "/blog"]], "neither Next's own nor a pattern");
  assert.deepEqual(wanted.filter(({ status }) => status === 404).length, 3);
  assert.deepEqual(expectations(build(t, { pages: {} })), [], "a build without a page says nothing, which main() refuses");
  assert.deepEqual(expectations(path.join(os.tmpdir(), "no-build-here")), []);
});

test("a server that answers as the build says has nothing wrong", async (t) => {
  assert.deepEqual(await wrong(t), []);
});

test("a page that answers 200 with other bytes is wrong, as is one that answers 500", async (t) => {
  assert.deepEqual(await wrong(t, { "/blog": [200, "<html>stale</html>"] }), ["/blog: answered 200 with 18 bytes that are not the 17 the build prerendered"]);
  assert.deepEqual(await wrong(t, { "/": [500, "loadManifest"], "/feed.xml": [500, ""] }), ["/: answered 500, not 200", "/feed.xml: answered 500, not 200"]);
});

test("a server that is not ours is wrong even where every status is right", async (t) => {
  const other = Object.fromEntries(Object.keys(GOOD).map((url) => [url, [200, "<html>another project</html>"]]));
  const lines = await wrong(t, other, [200, "<html>another project</html>"]);
  assert.equal(lines.filter((line) => /not the \d+ the build prerendered/.test(line)).length, 4, lines.join("\n"));
  assert.ok(lines.includes("an unknown page: answered 200, not 404"));
});

test("a script that is missing, a redirect that goes elsewhere or nowhere, an image optimiser that is on and a form endpoint that is down are each wrong", async (t) => {
  assert.deepEqual(await wrong(t, { "/_next/static/chunks/a.js": [404, ""] }), ["/_next/static/chunks/a.js: answered 404, not 200"]);
  assert.deepEqual(await wrong(t, { "/old": [308, "", { location: "/else" }] }), ["the redirect /old: sends to /else, not /blog"]);
  assert.deepEqual(await wrong(t, { "/old": [308, ""] }), ["the redirect /old: sends to nowhere, not /blog"]);
  assert.deepEqual(await wrong(t, { "/_next/image": [200, "png"] }), ["the image optimiser, which is off: answered 200, not 404"]);
  assert.deepEqual(await wrong(t, { "/api/forms/no-such-form": [404, "<html>404</html>"] }), ['the form endpoint, an unknown form: answered 404 without "unknown_form"']);
});

test("an absolute redirect is the same place on this host and another one on any other", () => {
  const want = { what: "r", url: "/old", status: 308, location: "/blog" }, got = (location) => ({ status: 308, location, body: Buffer.alloc(0) });
  assert.equal(problem(want, got("http://127.0.0.1:1/blog"), "http://127.0.0.1:1"), null);
  assert.match(problem(want, got("https://elsewhere.example/blog"), "http://127.0.0.1:1"), /sends to https:\/\/elsewhere\.example\/blog/);
});

test("a server that is gone is wrong once per question, never an exception", async (t) => {
  const lines = await wrongAnswers("http://127.0.0.1:1", expectations(build(t)));
  assert.equal(lines.length, expectations(build(t)).length);
  assert.match(lines[0], /gave no answer/);
});

test("the log's end: its colours and empty lines gone, its long lines cut", () => {
  assert.equal(tail("a\n\n\u001b[31mb\u001b[0m\n" + "c".repeat(400) + "\n", 2), `b\n${"c".repeat(300)}`);
});

test("CI runs it on every pull request and on both branches, in a job of its own that has a time limit", () => {
  const { on, jobs } = parseYaml(fs.readFileSync(path.join(REPO, ".github/workflows/verify.yml"), "utf8"));
  assert.ok("pull_request" in on);
  assert.deepEqual(on.push.branches, ["develop", "main"]);
  assert.equal(jobs.worker.if, undefined);
  assert.equal(jobs.worker["timeout-minutes"], 10);
  assert.equal(jobs.worker.steps.at(-1).run, "pnpm test:worker");
  assert.equal(JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8")).scripts["test:worker"], "node tools/worker-smoke.mjs");
});
