// The rules a site's starter is held by: the placeholder marker, the
// domains reserved for examples, the kit example's brand, the kit told by its
// package name, and the placeholders read by line for a reader that does not
// load the site (assemble) and by field from a parsed file (demo new).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { copyNotes, exampleBrandIn, exampleBrandLeftovers, hasPlaceholder, isKit, onReservedDomain, placeholderLines, placeholdersAllowed } from "./placeholders.mjs";

const tree = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "placeholders-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
};

test("the marker, in any case, anywhere in a string", () => {
  assert.ok(hasPlaceholder("(placeholder) The heading"));
  assert.ok(hasPlaceholder("A line, (Placeholder) in it"));
  assert.ok(!hasPlaceholder("a placeholder image"));
});

test("a URL, an address or a domain on a domain reserved for examples; a real one is not", () => {
  for (const value of ["https://my-site.example", "https://app.my-site.example/x", "hello@my-site.example", "my-site.example/blog", "https://example.com", "http://localhost:8000", "https://x.test", "https://x.invalid"]) assert.ok(onReservedDomain(value), value);
  for (const value of ["https://my-site.com", "hello@my-site.com", "my-site.com/blog", "/images/home/x.webp", "an example, in prose", "(placeholder) A line"]) assert.ok(!onReservedDomain(value), value);
});

test("the kit example's brand: its domain and author in any case, its name as the example spells it, a word; never a site's own name", () => {
  assert.equal(exampleBrandIn("written by Acme"), "Acme");
  assert.equal(exampleBrandIn("hello@ACME.example"), "ACME.example");
  assert.equal(exampleBrandIn("/images/authors/acme-editorial.webp"), "acme-editorial");
  for (const text of ["ACME certificates", "Acmes", "acmeology"]) assert.equal(exampleBrandIn(text), null, text);
  assert.equal(exampleBrandIn("Acme Labs builds", { siteName: "Acme Labs" }), null);
  assert.equal(exampleBrandIn("hello@acme.example", { siteName: "Acme Labs" }), "acme.example");
});

test("the kit is told by its package name; the environment of a run that deploys nothing keeps placeholders warnings", () => {
  assert.ok(isKit(tree({ "package.json": '{ "name": "agentic-cms" }' })));
  assert.ok(!isKit(tree({ "package.json": '{ "name": "my-site" }' })));
  assert.ok(!isKit(tree({})));
  assert.ok(placeholdersAllowed({ AGENTIC_CMS_PLACEHOLDERS: "warn" }));
  assert.ok(!placeholdersAllowed({}) && !placeholdersAllowed({ AGENTIC_CMS_PLACEHOLDERS: "1" }));
});

test("by line: the marker in a content file a build reads and in the config, a reserved domain in site.ts; never a comment, a file starting with _, the door, the voice file or the editorial plan", () => {
  const root = tree({
    "content/pages/home.yaml": '# strings start with "(placeholder)"\nseo:\n  title: "(placeholder) The title"\n',
    "content/_templates/page.yaml": 'title: "(placeholder) never read"\n',
    "content/README.md": "A string marked `(placeholder)` is the starter's.\n",
    "content/editorial/backlog.md": "- (placeholder) an idea\n",
    "content/blog/x.md": "---\n# a frontmatter comment on (placeholder)\ntitle: A post\n---\n\n## (placeholder) A heading is copy\n",
    "src/config/site.ts": '// "(placeholder)" marks one\nexport const site = {\n  url: "https://my-site.example",\n  tagline: "(placeholder) The line.",\n};\n',
  });
  assert.deepEqual(placeholderLines(root), [
    { file: "content/blog/x.md", path: "line 6", value: "## (placeholder) A heading is copy", domain: false },
    { file: "content/pages/home.yaml", path: "line 3 (title)", value: 'title: "(placeholder) The title"', domain: false },
    { file: "src/config/site.ts", path: "line 3 (url)", value: "https://my-site.example", domain: true },
    { file: "src/config/site.ts", path: "line 4 (tagline)", value: 'tagline: "(placeholder) The line.",', domain: false },
  ]);
  assert.equal(placeholderLines(root, { content: false }).length, 2, "the config alone");
  fs.writeFileSync(path.join(root, "package.json"), '{ "name": "agentic-cms" }');
  assert.deepEqual(placeholderLines(root).map((p) => p.path), ["line 6", "line 3 (title)", "line 4 (tagline)"], "in the kit, the example's domain is the example's");
});

test("by field, from a parsed file: the placeholders and the brand, the domain and the brand left alone in the kit", () => {
  const page = { seo: { title: "(placeholder) A title" }, sections: [{ heading: "Built by Acme", cards: [{ value: "hello@x.example" }] }] };
  assert.deepEqual(copyNotes(page), { placeholders: ["seo.title", "sections[0].cards[0].value"], brand: ["sections[0].heading"] });
  assert.deepEqual(copyNotes(page, { kit: true }), { placeholders: ["seo.title"], brand: [] });
});

test("the brand left in a site: by line in its content, config and SVGs, and by a picture's name", () => {
  const root = tree({ "content/blog/x.md": "---\nauthor: acme-editorial\n---\n", "public/images/authors/acme-editorial.webp": "x", "public/images/brand/logo.svg": "<svg><text>Acme</text></svg>", "src/config/site.ts": "export const site = { name: \"Nimbus\" };\n" });
  assert.deepEqual(exampleBrandLeftovers(root, { siteName: "Nimbus" }).map(({ file, path: p, found }) => `${file} ${p} ${found}`), ["public/images/authors/acme-editorial.webp  acme-editorial", "content/blog/x.md line 2 acme-editorial", "public/images/brand/logo.svg line 1 Acme"]);
});
