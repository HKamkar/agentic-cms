import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { z } from "zod";
import { defineCollection } from "./define";
import { readCollection, readEntry, slugsOf } from "./read";
import { optional, ref, text } from "./schema";
import { expectContentError, withContent } from "./test-helpers";

const thing = z.strictObject({ name: text(), note: optional(text()) });
const folderYaml = defineCollection({ name: "t-folder", kind: "folder", dir: "things", format: "yaml", schema: thing });
const folderMd = defineCollection({ name: "t-notes", kind: "folder", dir: "notes", format: "markdown", schema: thing });
const list = defineCollection({ name: "t-list", kind: "list", file: "things.yaml", schema: thing });
const map = defineCollection({ name: "t-map", kind: "map", file: "things.json", schema: thing });
const prose = defineCollection({ name: "t-prose", kind: "folder", dir: "prose", format: "yaml", schema: z.strictObject({ name: text(), paragraphs: optional(z.array(text())) }) });
const nested = defineCollection({
  name: "t-nested",
  kind: "folder",
  dir: "sets",
  format: "yaml",
  schema: z.strictObject({ items: z.array(z.strictObject({ question: text(), answer: text() })), owner: ref("t-map") }),
});

describe("kinds and slugs", () => {
  test("a folder of YAML files: slug = stem, sorted by name, _ files, subdirectories and other extensions ignored", () => {
    withContent(
      { "things/b.yaml": "name: B", "things/a.yml": "name: A", "things/_draft.yaml": "name: no", "things/c.md": "name: no", "things/sub/d.yaml": "name: no" },
      () => {
        const entries = readCollection(folderYaml);
        assert.deepEqual(entries.map((e) => [e.slug, e.file, e.data.name]), [["a", "content/things/a.yml", "A"], ["b", "content/things/b.yaml", "B"]]);
      },
    );
  });

  test("a folder of markdown files carries body and format", () => {
    withContent({ "notes/n.md": "---\nname: N\n---\n\nHello.\n", "notes/m.mdx": "---\nname: M\n---\nHi" }, () => {
      const [m, n] = readCollection(folderMd);
      assert.deepEqual([m.slug, m.format, m.body], ["m", "mdx", "Hi"]);
      assert.deepEqual([n.slug, n.format, n.body], ["n", "md", "\nHello.\n"]);
    });
  });

  test("a list file: slug = index as text, file = the list file", () => {
    withContent({ "things.yaml": "- name: first\n- name: second\n" }, () => {
      const entries = readCollection(list);
      assert.deepEqual(entries.map((e) => [e.slug, e.file]), [["0", "content/things.yaml"], ["1", "content/things.yaml"]]);
    });
  });

  test("a map file: slug = key", () => {
    withContent({ "things.json": JSON.stringify({ one: { name: "One" }, two: { name: "Two" } }) }, () => {
      assert.deepEqual(readCollection(map).map((e) => e.slug), ["one", "two"]);
      assert.deepEqual(slugsOf(map), ["one", "two"]);
    });
  });

  test("readEntry finds by slug and names the known slugs when it cannot", () => {
    withContent({ "things.json": JSON.stringify({ one: { name: "One" }, two: { name: "Two" } }) }, () => {
      assert.equal(readEntry(map, "two").data.name, "Two");
      expectContentError(() => readEntry(map, "tow"), 'content/things.json: no entry "tow" (one, two)');
    });
  });

  test("nothing is cached outside production builds", () => {
    withContent({ "things.yaml": "- name: first\n" }, () => assert.equal(readCollection(list).length, 1));
    withContent({ "things.yaml": "- name: first\n- name: second\n" }, () => assert.equal(readCollection(list).length, 2));
  });
});

describe("files that cannot be read", () => {
  test("missing directory, missing file, empty file, wrong top-level shape", () => {
    withContent({}, () => expectContentError(() => readCollection(folderYaml), "content/things: no such directory"));
    withContent({}, () => expectContentError(() => readCollection(list), "content/things.yaml: no such file"));
    withContent({ "things.yaml": "" }, () => expectContentError(() => readCollection(list), "content/things.yaml: is empty"));
    withContent({ "things.yaml": "name: x" }, () => expectContentError(() => readCollection(list), "content/things.yaml: must be a list of entries"));
    withContent({ "things.json": "[]" }, () => expectContentError(() => readCollection(map), "content/things.json: must be a mapping of entries keyed by slug"));
    withContent({ "things/a.yaml": "" }, () => expectContentError(() => readCollection(folderYaml), "content/things/a.yaml: is empty"));
  });

  test("syntax errors name the file and the parser", () => {
    withContent({ "things.json": "{" }, () => expectContentError(() => readCollection(map), "content/things.json: invalid JSON: "));
    withContent({ "things/a.yaml": "name: [\n" }, () => expectContentError(() => readCollection(folderYaml), "content/things/a.yaml: invalid YAML: "));
    withContent({ "notes/n.md": "---\nname: [\n---\n" }, () => expectContentError(() => readCollection(folderMd), "content/notes/n.md: invalid frontmatter: "));
    withContent({ "notes/n.md": "---\njust text\n---\n" }, () => expectContentError(() => readCollection(folderMd), "content/notes/n.md: frontmatter must be a mapping"));
  });

  test("a colon in a mapping value dies in the parser, which keeps its line and gains the fix", () => {
    withContent({ "things/a.yaml": "name: A\nnote: a note: of two halves\n" }, () =>
      expectContentError(
        () => readCollection(folderYaml),
        "content/things/a.yaml: invalid YAML: Nested mappings are not allowed in compact mappings at line 2",
        'a line that contains ": " is read as a key — quote the text',
      ),
    );
    withContent({ "notes/n.md": "---\nname: A\nnote: a note: of two halves\n---\n" }, () =>
      expectContentError(() => readCollection(folderMd), "content/notes/n.md: invalid frontmatter: Nested mappings are not allowed", 'quote the text'),
    );
    withContent({ "things/a.yaml": 'name: A\nnote: "a note: of two halves"\n' }, () => assert.equal(readCollection(folderYaml)[0].data.note, "a note: of two halves"));
  });

  test("two files with one stem", () => {
    withContent({ "notes/n.md": "---\nname: N\n---\n", "notes/n.mdx": "---\nname: N\n---\n" }, () =>
      expectContentError(() => readCollection(folderMd), 'content/notes: duplicate slug "n" (n.md, n.mdx)'),
    );
  });
});

describe("the colon trap", () => {
  test("a text field that YAML read as a mapping names the trap, the line and the fix", () => {
    withContent({ "prose/a.yaml": "name: A\nparagraphs:\n  - Every request carries technical data: an IP address and a browser.\n" }, () =>
      expectContentError(
        () => readCollection(prose),
        'content/prose/a.yaml: paragraphs[0] is a mapping, not text: the line contains ": ", which YAML reads as a key — quote it ("Every request carries technical data: an IP address and a browser.")',
      ),
    );
    withContent({ "prose/a.yaml": 'name: A\nparagraphs:\n  - "Every request carries technical data: an IP address and a browser."\n' }, () =>
      assert.equal(readCollection(prose)[0].data.paragraphs?.[0], "Every request carries technical data: an IP address and a browser."),
    );
  });

  test("a whole list read as mappings says so, and a mapping the trap cannot explain still says it is not text", () => {
    withContent({ "prose/a.yaml": "name:\n  - A name: of two halves\n  - Another: one\n" }, () =>
      expectContentError(() => readCollection(prose), 'content/prose/a.yaml: name is a list of mappings, not text: the line contains ": ", which YAML reads as a key — quote it ("A name: of two halves")'),
    );
    withContent({ "prose/a.yaml": "name:\n  first: A\n  second: B\n" }, () =>
      expectContentError(() => readCollection(prose), 'content/prose/a.yaml: name is a mapping, not text: a line that contains ": " is read as a key — quote the text'),
    );
  });

  test("a mapping where a mapping belongs is untouched", () => {
    withContent({ "things.json": JSON.stringify({ one: { name: "One" } }), "sets/a.yaml": "owner: one\nitems:\n  - question: q\n" }, () => {
      const error = expectContentError(() => readCollection(nested), "content/sets/a.yaml: items[0].answer");
      assert.doesNotMatch(error.message, /quote it|is a mapping, not text/, error.message);
    });
  });
});

describe("issues and paths", () => {
  test("an entry that is not a mapping, in a list and in a map", () => {
    withContent({ "things.yaml": "- name: ok\n- just text\n" }, () => expectContentError(() => readCollection(list), "content/things.yaml: [1] must be a mapping"));
    withContent({ "things.json": JSON.stringify({ one: "text" }) }, () => expectContentError(() => readCollection(map), "content/things.json: one must be a mapping"));
  });

  test("paths are prefixed by the entry's index or key", () => {
    withContent({ "things.yaml": "- name: ok\n- note: only\n" }, () => expectContentError(() => readCollection(list), "content/things.yaml: [1].name is required"));
    withContent({ "things.json": JSON.stringify({ one: { name: "" } }) }, () => expectContentError(() => readCollection(map), "content/things.json: one.name must be a non-empty string"));
  });

  test("unknown keys list the allowed ones at the top level only", () => {
    withContent({ "things.json": JSON.stringify({ one: { name: "One", twitter: "x" } }) }, () =>
      expectContentError(() => readCollection(map), "content/things.json: one unknown key(s) twitter; allowed: name, note"),
    );
    withContent({ "things.json": JSON.stringify({ one: { name: "One" } }), "sets/s.yaml": "owner: one\nitems:\n  - question: q\n    answer: a\n    extra: 1\n" }, () => {
      const error = expectContentError(() => readCollection(nested), "content/sets/s.yaml: items[0] unknown key(s) extra");
      assert.doesNotMatch(error.message, /allowed:/);
    });
  });

  test("every issue of a file is reported, one line each, the first as path/problem", () => {
    withContent({ "things.yaml": "- note: only\n  extra: 1\n" }, () => {
      const error = expectContentError(() => readCollection(list), "content/things.yaml: [0].name is required", "content/things.yaml: [0] unknown key(s) extra");
      assert.deepEqual([error.file, error.path, error.problem, error.issues.length], ["content/things.yaml", "[0].name", "is required", 2]);
    });
  });

  test("nested paths and references inside arrays", () => {
    const owner = JSON.stringify({ one: { name: "One" } });
    withContent({ "things.json": owner, "sets/s.yaml": "owner: one\nitems:\n  - question: q\n    answer: ''\n" }, () =>
      expectContentError(() => readCollection(nested), "content/sets/s.yaml: items[0].answer must be a non-empty string"),
    );
    withContent({ "things.json": owner, "sets/s.yaml": "owner: two\nitems: []\n" }, () =>
      expectContentError(() => readCollection(nested), 'content/sets/s.yaml: owner "two" is not in content/things.json (one)'),
    );
  });
});

describe("references", () => {
  test("a ref to an unregistered collection or to a list is a programmer error, not a ContentError", () => {
    const bad = defineCollection({ name: "t-bad", kind: "list", file: "bad.yaml", schema: z.strictObject({ to: ref("t-nobody") }) });
    withContent({ "bad.yaml": "- to: x\n" }, () => assert.throws(() => readCollection(bad), /no collection named "t-nobody"/));
    const toList = defineCollection({ name: "t-to-list", kind: "list", file: "to.yaml", schema: z.strictObject({ to: ref("t-list") }) });
    withContent({ "to.yaml": "- to: x\n" }, () => assert.throws(() => readCollection(toList), /a list collection has no slugs/));
  });

  test("a self-reference checks the folder listing, drafts and all, without recursing", () => {
    const self = defineCollection({ name: "t-self", kind: "folder", dir: "self", format: "yaml", schema: z.strictObject({ next: optional(ref("t-self")) }) });
    withContent({ "self/a.yaml": "next: b", "self/b.yaml": "next: a", "self/_t.yaml": "next: a" }, () => assert.equal(readCollection(self).length, 2));
    withContent({ "self/a.yaml": "next: c" }, () => expectContentError(() => readCollection(self), 'content/self/a.yaml: next "c" is not in content/self (a)'));
  });
});
