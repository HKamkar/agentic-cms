// The README npm shows: every picture and link on the version's tag, and the
// repository's own README back as it was.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { absolute, bases, named, relative, relativeRefs } from "./npm-readme.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const README = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const BASES = bases({ repository: { url: "git+https://github.com/o/r.git" }, version: "1.2.3" });
const RAW = "https://raw.githubusercontent.com/o/r/v1.2.3/", BLOB = "https://github.com/o/r/blob/v1.2.3/";

test("a picture goes to the raw file and a link to the page, both on the version's tag", () => {
  for (const [from, to] of [
    ['<img src="docs/a.webp">', `<img src="${RAW}docs/a.webp">`],
    ['<source srcset="docs/b.webp">', `<source srcset="${RAW}docs/b.webp">`],
    ["![a](docs/a.png)", `![a](${RAW}docs/a.png)`],
    ["[guide](docs/a.md#the-part)", `[guide](${BLOB}docs/a.md#the-part)`],
    ['<a href="LICENSE">', `<a href="${BLOB}LICENSE">`],
    ["[![b](docs/b.svg)](docs/b.md)", `[![b](${RAW}docs/b.svg)](${BLOB}docs/b.md)`],
  ]) assert.equal(absolute(from, BASES), to);
});

test("an address, an anchor and code stay as they are", () => {
  for (const text of ["[x](https://e.example/a)", "[x](#start)", "[x](mailto:a@e.example)", '<img src="https://e.example/a.png">', '<a href="#b">', "`[x](docs/a.md)`", '```html\n<img src="docs/a.webp">\n```\n'])
    assert.equal(absolute(text, BASES), text);
});

test("this README is relative in the repository, every path a file, and a pack leaves it as it was", () => {
  const at = bases(MANIFEST), packed = absolute(README, at);
  assert.ok(relativeRefs(README).length > 20);
  for (const ref of relativeRefs(README)) assert.ok(fs.existsSync(path.join(ROOT, ref.split("#")[0])), `${ref} is a file`);
  assert.deepEqual(named(README, at), [], "no pack left it absolute: git checkout README.md");
  assert.deepEqual(relativeRefs(packed), []);
  assert.equal(relative(packed, at), README);
});
