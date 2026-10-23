import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { canonical, collectionEntries, exampleLeftovers, readExampleFiles, sha256 } from "./leftovers.mjs";

const KIT = path.resolve(import.meta.dirname, "../..");
const REVIEW = { name: "A. Customer", role: "Their role", quote: '"Words."', photo: "/images/home/review-1.webp" };
const PICTURE = "RIFF-a-picture-of-the-example";

/** A list as tools/example-files.mjs writes it, of a post, a picture and a review. */
const LIST = readExampleFiles({
  paths: ["content/blog/how-a-post-is-built.md", "content/pages/sections-about.yaml"],
  files: [{ path: "public/images/home/review-1.webp", size: Buffer.byteLength(PICTURE), sha256: sha256(PICTURE) }],
  entries: [{ file: "content/reviews.yaml", sha256: sha256(canonical(REVIEW)) }],
});

/** A scratch site on disk with `files`, removed after `fn`. */
function scratch(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "leftovers-"));
  try {
    for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
    return fn(root);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const lines = (found) => found.map(({ rule, file, problem }) => `${rule} ${file}: ${problem}`);

test("an entry hashes by what it says, whatever the order of its keys; a collection's entries are a list's items, a map's keys, an FAQ set's items", () => {
  assert.equal(canonical({ b: [1, { d: 2, c: 3 }], a: "x" }), canonical({ a: "x", b: [1, { c: 3, d: 2 }] }));
  assert.deepEqual(collectionEntries("content/reviews.yaml", "- name: A\n  role: B\n- name: C\n").map(({ at, label }) => `${at} ${label}`), ["[0] A", "[1] C"]);
  assert.deepEqual(collectionEntries("content/authors.json", '{ "team": { "name": "The team" } }').map(({ at, label }) => `${at} ${label}`), ["team team"]);
  assert.deepEqual(collectionEntries("content/faqs/general.yaml", "items:\n  - question: Why?\n    answer: Because.\n").map(({ at, label }) => `${at} ${label}`), ["[0] Why?"]);
  assert.deepEqual(collectionEntries("content/reviews.yaml", "- [unclosed\n"), []);
});

test("the leftovers: the example's own paths, its bytes under any name, its entries among the site's own, its brand by line (never in the guard's config, whose baseline names them)", () => {
  const own = { name: "B. Buyer", role: "Ours", quote: '"Ours."', photo: "/images/home/b.webp" };
  const found = scratch({
    "content/blog/how-a-post-is-built.md": "---\ntitle: Rewritten, still the example's post\n---\n",
    "content/blog/ours.md": "---\ntitle: Ours\n---\n",
    "content/reviews.yaml": `- ${JSON.stringify(own)}\n- ${JSON.stringify(REVIEW)}\n`,
    "public/images/team/portrait.webp": PICTURE,
    "public/images/home/review-1.webp": "a picture of the site's own at the example's name",
    "public/images/brand/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"><title>Acme</title></svg>',
    "src/config/site.ts": 'export const site = { name: "Ours", email: "hello@acme.example" };\n',
    "content/README.md": "The kit's door, which a site keeps.\n",
    "src/config/components.json": JSON.stringify({ baseline: [{ file: "public/images/authors/acme-editorial.webp", rule: "example-brand", count: 1, reason: "" }] }),
  }, (root) => exampleLeftovers({ root, list: LIST, siteName: "Ours" }));
  assert.deepEqual(lines(found), [
    "example-content content/blog/how-a-post-is-built.md: one of the example's posts, at the path the example shipped it",
    'example-content content/reviews.yaml: entry [1] (A. Customer) is one of the example\'s',
    'example-brand public/images/brand/logo.svg:1: "Acme" is the kit example\'s brand',
    "example-content public/images/team/portrait.webp: a copy of the example's public/images/home/review-1.webp",
    'example-brand src/config/site.ts:1: "acme.example" is the kit example\'s domain',
  ]);
  assert.ok(found.every((f) => f.check === "leftovers" && f.fix));
  assert.match(found[0].fix, /\/editorial:retire-content/);
});

test("a site that keeps nothing of the example has no leftovers: the starter, laid out as it is, and a site named like the example", () => {
  assert.deepEqual(exampleLeftovers({ root: path.join(KIT, "templates/starter") }), []);
  assert.deepEqual(scratch({ "content/pages/home.yaml": "title: Acme Tools\n" }, (root) => exampleLeftovers({ root, list: LIST, siteName: "Acme Tools" })), []);
});

test("the shipped list knows the example's posts and catalogue pages by path, and its reviews, use cases, FAQ set and author by entry", () => {
  const list = JSON.parse(fs.readFileSync(path.join(KIT, "scripts/lib/example-files.json"), "utf8"));
  assert.deepEqual(list.releases.at(-1), "v0.8.1", "the last release whose init copied the example");
  assert.deepEqual(list.paths.filter((p) => p.startsWith("content/blog/")).length, 3);
  assert.ok(list.paths.some((p) => /^content\/pages\/sections-/.test(p)));
  assert.deepEqual([...new Set(list.entries.map((e) => e.file))].sort(), ["content/authors.json", "content/faqs/general.yaml", "content/reviews.yaml", "content/use-cases.yaml"]);
  assert.ok(list.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256) && f.size > 0 && !/^content\/(?:README|VOICE)\.md$|^content\/(?:_templates|editorial)\/|categories\.json$/.test(f.path)), "the kit's docs, templates and categories are no sample");
});
