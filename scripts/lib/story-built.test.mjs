// The half of a story's check that reads the build: the story's own markup,
// its scripts' weight, and the pages that load them without telling one.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { engineScripts, storyFindings, storyOf } from "./story-built.mjs";

const WORDS = "<h2>The first scene</h2><p>A light stands over a dark sea, and waits for the morning to come.</p>";
const story = (inside = WORDS, canvas = '<canvas aria-hidden="true"></canvas>') => `<main><div class="track" data-story=""><div data-story-stage="">${canvas}<div>${inside}</div></div></div><p>After it.</p></main>`;
const page = (route, html, scripts = []) => ({ route, html: `<html><body>${html}${scripts.map((src) => `<script src="${src}" async=""></script>`).join("")}</body></html>` });

/** A build whose chunks are the sources given; removed after `read`. */
function build(chunks, read) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "story-built-")), dir = path.join(root, ".next/static/chunks");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, source] of Object.entries(chunks)) fs.writeFileSync(path.join(dir, name), source);
  try { return read(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const ENGINE = 'const g=c.getContext("webgl2",{alpha:!1});g.drawArrays(5,0,4);';
const rules = (found) => found.map(({ route, rule }) => `${route} ${rule}`);

test("storyOf: the element with data-story, whole; a stage alone is none", () => {
  assert.equal(storyOf('<div data-story-stage=""><p>x</p></div>'), null);
  assert.equal(storyOf('<section><div data-story="true"><div>a</div><div>b</div></div><div>c</div></section>'), '<div data-story="true"><div>a</div><div>b</div></div>');
  assert.equal(storyOf("<main data-story><h1>x</h1></main>"), "<main data-story><h1>x</h1></main>");
});

test("no story: nothing is read and nothing is said, whatever the scripts are", () => {
  build({ "a.js": ENGINE.repeat(9000) }, (root) => assert.deepEqual(storyFindings(root, [page("/", "<h1>x</h1>", ["/_next/static/chunks/a.js"])]), []));
});

test("a story with its words, its canvas hidden and an engine of its own passes", () => {
  build({ "main.js": "console.log(1)", "story.js": ENGINE }, (root) => {
    assert.deepEqual(engineScripts(root).map(({ url }) => url), ["/_next/static/chunks/story.js"]);
    assert.deepEqual(storyFindings(root, [page("/", story(), ["/_next/static/chunks/main.js"]), page("/blog", "<h1>Blog</h1>", ["/_next/static/chunks/main.js"])]), []);
  });
});

test("the words are missing, a canvas is read out", () => {
  build({}, (root) => {
    assert.deepEqual(rules(storyFindings(root, [page("/", story("", "<canvas></canvas>"))])), ["/ story-words", "/ story-canvas"]);
    assert.deepEqual(rules(storyFindings(root, [page("/", story("<h2>One</h2><script>const words = 'a heading and a lot of text that nobody reads in a script'</script>"))])), ["/ story-words"], "a script's text is not a reader's");
  });
});

test("an engine over 60 KB compressed, and an engine every page downloads", () => {
  const heavy = `${ENGINE}//${crypto.randomBytes(70 * 1024).toString("base64")}`;
  build({ "story.js": heavy }, (root) => {
    const found = storyFindings(root, [page("/", story())]);
    assert.deepEqual(rules(found), ["/ story-weight"]);
    assert.match(found[0].msg, /KB compressed \(at most 60\): story\.js/);
  });
  build({ "shared.js": ENGINE }, (root) => {
    const found = storyFindings(root, [page("/", story(), ["/_next/static/chunks/shared.js"]), page("/blog", "<h1>Blog</h1>", ["/_next/static/chunks/shared.js?dpl=1"])]);
    assert.deepEqual(rules(found), ["/blog story-scripts"]);
    assert.match(found[0].msg, /import it on the story's page alone/);
  });
});
