// One case per rule of the post contract (the rules src/lib/blog/frontmatter.ts
// enforced), each asserting the message names the file and the field.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { kit } from "@/kit";
import { readCollection } from "./read";
import { expectContentError, postTree, VALID_POST, withContent } from "./test-helpers";

// The example site's registry: its section union is what the pages test asserts on.
const { collections } = kit;
const posts = () => readCollection(collections.posts);
const fails = (frontmatter: string, ...fragments: string[]) => withContent(postTree(frontmatter), () => expectContentError(posts, ...fragments));
const passes = (frontmatter: string) => withContent(postTree(frontmatter), () => posts()[0].data);
const without = (key: string) => VALID_POST.split("\n").filter((l) => !l.startsWith(`${key}:`)).join("\n");

describe("the post contract", () => {
  test("a valid post, and the registries, read", () => {
    withContent(postTree(VALID_POST), () => {
      assert.deepEqual(posts()[0].data, { title: "A post", excerpt: "What the reader gets.", date: "2026-05-02", category: "fintech", author: "h-kamkar" });
      assert.deepEqual(readCollection(collections.authors).map((e) => e.slug), ["h-kamkar"]);
      assert.deepEqual(readCollection(collections.categories).map((e) => e.slug), ["fintech", "private-ai"]);
    });
  });

  test("required fields", () => {
    fails(without("title"), "content/blog/x.md: title is required");
    fails(without("category"), "content/blog/x.md: category is required");
    fails(without("author"), "content/blog/x.md: author is required");
    fails(without("date"), "content/blog/x.md: date is required (YYYY-MM-DD)");
    fails(without("excerpt"), "content/blog/x.md: excerpt is required (or seoDescription as a fallback)");
    assert.equal(passes(`${without("excerpt")}\nseoDescription: A description instead.`).seoDescription, "A description instead.");
  });

  test("strings must be non-empty and are kept untrimmed", () => {
    fails(`${VALID_POST}\nseoTitle: ""`, "content/blog/x.md: seoTitle must be a non-empty string");
    fails(`${VALID_POST}\nseoTitle: "   "`, "content/blog/x.md: seoTitle must be a non-empty string");
    fails(`${without("title")}\ntitle: 5`, "content/blog/x.md: title must be a non-empty string");
    assert.equal(passes(`${VALID_POST}\nseoTitle: " padded "`).seoTitle, " padded ");
  });

  test("null means absent for the optional strings, lists and timestamps; not for date and draft", () => {
    const data = passes(`${VALID_POST}\nimage: null\nkeywords: null\npublishedAt: null`);
    assert.equal("image" in data && data.image !== undefined, false);
    assert.equal(data.keywords, undefined);
    assert.equal(data.publishedAt, undefined);
    fails(`${without("title")}\ntitle: null`, "content/blog/x.md: title is required");
    fails(`${without("date")}\ndate: null`, 'content/blog/x.md: date "null" must be a valid YYYY-MM-DD');
    fails(`${VALID_POST}\ndraft: null`, "content/blog/x.md: draft must be true or false");
  });

  test("lists", () => {
    fails(`${VALID_POST}\nkeywords: nope`, "content/blog/x.md: keywords must be a list of strings");
    fails(`${VALID_POST}\nkeywords: [a, 2]`, "content/blog/x.md: keywords[1] must be a string");
    fails(`${VALID_POST}\nrelated: nope`, "content/blog/x.md: related must be a list of strings");
    fails(`${VALID_POST}\nrelated: [x, 5]`, "content/blog/x.md: related[1] must be a non-empty string");
    assert.deepEqual(passes(`${VALID_POST}\nkeywords: [a, ""]`).keywords, ["a", ""]);
  });

  test("references: category and author must be registry keys, related must be existing files (drafts count)", () => {
    fails(`${without("category")}\ncategory: legal`, 'content/blog/x.md: category "legal" is not in content/categories.json (fintech, private-ai)');
    fails(`${without("author")}\nauthor: nobody`, 'content/blog/x.md: author "nobody" is not in content/authors.json (h-kamkar)');
    fails(`${VALID_POST}\nrelated: [x, gone]`, 'content/blog/x.md: related[1] "gone" is not in content/blog (x)');
    withContent({ ...postTree(`${VALID_POST}\nrelated: [y]`), ...postTree(`${VALID_POST}\ndraft: true`, "y.md") }, () => assert.equal(posts().length, 2));
  });

  test("dates", () => {
    fails(`${without("date")}\ndate: "2026-13-40"`, 'content/blog/x.md: date "2026-13-40" must be a valid YYYY-MM-DD');
    fails(`${without("date")}\ndate: 20260502`, 'content/blog/x.md: date "20260502" must be a valid YYYY-MM-DD');
    assert.equal(passes(`${without("date")}\ndate: 2026-05-02`).date, "2026-05-02"); // unquoted stays text under YAML 1.2
    fails(`${VALID_POST}\npublishedAt: nope`, 'content/blog/x.md: publishedAt "nope" must be an ISO timestamp');
    const data = passes(`${VALID_POST}\npublishedAt: "2026-01-02T03:04:05+02:00"\nupdatedAt: "2025-12-31T00:00:00Z"`);
    assert.equal(data.publishedAt, "2026-01-02T01:04:05.000Z"); // normalised
    assert.equal(data.updatedAt, "2025-12-31T00:00:00.000Z"); // the clamp is posts.ts's job, not the schema's
  });

  test("draft is a boolean; YAML 1.2 keeps `yes` a string", () => {
    assert.equal(passes(`${VALID_POST}\ndraft: true`).draft, true);
    fails(`${VALID_POST}\ndraft: yes`, "content/blog/x.md: draft must be true or false");
  });

  test("unknown keys are rejected with the allowed list", () => {
    fails(`${VALID_POST}\nfoo: 1`, "content/blog/x.md: unknown key(s) foo; allowed: title, excerpt, date, category, author, image, imageAlt, thumbnail, thumbnailAlt, ogImage, seoTitle, seoDescription, keywords, related, source, publishedAt, updatedAt, draft");
  });

  test("the object-level refine is skipped while a field issue is present; an unknown key alone does not hide it", () => {
    const hidden = fails(`${without("excerpt")}\nseoTitle: ""`, "content/blog/x.md: seoTitle must be a non-empty string");
    assert.equal(hidden.issues.length, 1);
    fails(`${without("excerpt")}\nfoo: 1`, "content/blog/x.md: unknown key(s) foo", "content/blog/x.md: excerpt is required (or seoDescription as a fallback)");
  });

  test("pages: the seo block, the structured data and the sections are validated as one file", () => {
    const registries = { "authors.json": JSON.stringify({ "h-kamkar": { name: "H" } }), "categories.json": JSON.stringify({ fintech: { name: "F" } }), "faqs/about.yaml": "items:\n  - question: q\n    answer: a\n" };
    const page = (body: string) => ({ ...registries, "pages/x.yaml": body });
    const seo = 'seo:\n  path: /x\n  title: T\n  description: D\n  ogImage: /images/x-og.jpg\n  updated: "2026-09-15"\n  breadcrumb: X\n';
    const jsonld = "jsonld:\n  type: Blog\n";
    const faq = "  - type: faq\n    set: about\n    eyebrow: e\n    heading: h\n    variant: about\n";
    const readPages = () => readCollection(collections.pages);
    withContent(page(`${seo}${jsonld}sections:\n${faq}`), () => assert.equal(readPages()[0].data.sections[0].type, "faq"));
    withContent(page(`${seo}${jsonld}sections:\n  - type: nope\n`), () => expectContentError(readPages, "content/pages/x.yaml: sections[0].type must be one of home-hero, "));
    withContent(page(`${seo}${jsonld}sections:\n${faq}    foo: 1\n`), () => expectContentError(readPages, "content/pages/x.yaml: sections[0] unknown key(s) foo"));
    withContent(page(`${seo}${jsonld}sections:\n${faq.replace("set: about", "set: abou")}`), () => expectContentError(readPages, 'content/pages/x.yaml: sections[0].set "abou" is not in content/faqs (about)'));
    withContent(page(`${seo.replace("path: /x", "path: x/")}${jsonld}sections:\n${faq}`), () => expectContentError(readPages, "content/pages/x.yaml: seo.path must be / or /lowercase-words, without a trailing slash"));
    withContent(page(`${seo}${jsonld}sections:\n  - type: about-benefits\n    eyebrow: e\n    heading: h\n    cards:\n      - icon: i\n        title: t\n        text: x\n`), () => expectContentError(readPages, "content/pages/x.yaml: sections[0].cards must have exactly 3 cards"));
    withContent(page(`${seo}jsonld:\n  type: Nope\nsections:\n${faq}`), () => expectContentError(readPages, "content/pages/x.yaml: jsonld.type must be one of WebPage, AboutPage, ContactPage, Blog"));
    // A sentence with a colon in a section's list of copy: YAML read it as a key, and the message says which line and what to do.
    const strategy = "  - type: about-strategy\n    eyebrow: e\n    heading: h\n    text: t\n    beliefsHeading: b\n    cta:\n      label: l\n      href: /x\n    beliefs:\n";
    const belief = (line: string) => `      - ${line}\n`;
    withContent(page(`${seo}${jsonld}sections:\n${strategy}${belief("One file per page: the page is the file.")}${belief("b").repeat(3)}`), () =>
      expectContentError(readPages, 'content/pages/x.yaml: sections[0].beliefs[0] is a mapping, not text: the line contains ": ", which YAML reads as a key — quote it ("One file per page: the page is the file.")'),
    );
    // A WebPage describes software only when it carries an application: a notice or a policy is the type alone, and organization without one is an error.
    withContent(page(`${seo}jsonld:\n  type: WebPage\nsections:\n${faq}`), () => assert.equal(readPages()[0].data.jsonld.type, "WebPage"));
    withContent(page(`${seo}jsonld:\n  type: WebPage\n  organization: provider\nsections:\n${faq}`), () =>
      expectContentError(readPages, "content/pages/x.yaml: jsonld.organization belongs to the application: drop it, or add the application it describes"),
    );
    withContent(page(`${seo}${jsonld}sections:\n  - type: group\n    variant: use-cases-upper\n    sections:\n${faq.replace(/^/gm, "    ").replace("set: about", "set: abou")}`), () =>
      expectContentError(readPages, 'content/pages/x.yaml: sections[0].sections[0].set "abou" is not in content/faqs (about)'),
    );
  });

  test("no message carries zod's default wording", () => {
    const cases = [without("title"), `${without("title")}\ntitle: null`, `${without("title")}\ntitle: 5`, `${VALID_POST}\nkeywords: 3`, `${VALID_POST}\nrelated: [1]`, `${VALID_POST}\ndraft: 2`, `${without("date")}\ndate: []`];
    for (const frontmatter of cases) {
      const error = fails(frontmatter, "content/blog/x.md: ");
      assert.doesNotMatch(error.message, /Invalid input|expected .*, received/, error.message);
    }
  });
});
