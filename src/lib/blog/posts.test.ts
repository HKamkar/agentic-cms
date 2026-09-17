// The post pipeline on top of the content engine: the derived fields, the
// sort, the related-post logic — on the real posts and on scratch fixtures.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ContentError } from "@/lib/content";
import { postTree, VALID_POST, withContent } from "@/lib/content/test-helpers";
import { kit } from "@/kit";

const { formatDate, getAllCategories, getAllPosts, getAuthor, getPostBySlug, getRelatedPosts } = kit.blog;

// The real tree is asserted on its invariants, never on its size: a new post
// or category must not fail the suite (the content skills run it).
describe("the real posts", () => {
  test("the example posts are there, newest first, publishedAt breaking the date tie", () => {
    const posts = getAllPosts();
    assert.ok(posts.length >= 3);
    for (const slug of ["how-a-post-is-built", "pages-are-files", "the-voice-file-and-the-lint"]) assert.ok(posts.some((post) => post.slug === slug));
    for (let i = 1; i < posts.length; i += 1) {
      assert.ok(posts[i - 1].date >= posts[i].date);
      if (posts[i - 1].date === posts[i].date) assert.ok((posts[i - 1].publishedAt ?? "") >= (posts[i].publishedAt ?? ""));
    }
  });

  test("related posts start with the frontmatter list, then the category, then the newest", () => {
    const anatomy = getPostBySlug("how-a-post-is-built");
    assert.ok(anatomy);
    const related = getRelatedPosts(anatomy);
    assert.equal(related.length, 2);
    assert.deepEqual(related.map((post) => post.slug), anatomy.related);
    // With one slug listed, the second pick comes from the category pass; asking
    // for three runs the newest pass too, which exhausts the example corpus.
    const others = getAllPosts().filter((post) => post.slug !== anatomy.slug);
    const sameCategory = others.find((post) => post.category.slug === anatomy.category.slug && post.slug !== anatomy.related[1]);
    const listedOnly = { ...anatomy, related: [anatomy.related[1]] };
    const filled = getRelatedPosts(listedOnly, 3);
    assert.equal(filled[0].slug, anatomy.related[1]);
    assert.equal(filled[1].slug, sameCategory?.slug);
    assert.deepEqual([...filled.map((post) => post.slug)].sort(), others.map((post) => post.slug).sort());
  });

  test("registries and dates", () => {
    assert.equal(getAuthor("acme-editorial").name, "Acme Editorial");
    assert.ok(getAllCategories().length >= 2);
    assert.equal(formatDate("2026-05-02"), "May 2, 2026");
    assert.equal(formatDate("not a date"), "not a date");
  });
});

describe("derivations", () => {
  test("an updatedAt before publishedAt is clamped to it", () => {
    withContent(postTree(`${VALID_POST}\npublishedAt: "2026-05-07T09:17:56.845Z"\nupdatedAt: "2026-05-06T22:46:08.352Z"`), () => {
      const [post] = getAllPosts();
      assert.equal(post.updatedAt, "2026-05-07T09:17:56.845Z");
    });
  });
  test("fallbacks: excerpt from seoDescription, thumbnail and ogImage from image, empty alts, reading time at least one minute", () => {
    const frontmatter = `${VALID_POST.replace("excerpt: What the reader gets.", "seoDescription: The description.")}\nimage: /images/blog/x/hero.webp`;
    withContent(postTree(frontmatter), () => {
      const [post] = getAllPosts();
      assert.equal(post.excerpt, "The description.");
      assert.equal(post.thumbnail, "/images/blog/x/hero.webp");
      assert.equal(post.ogImage, "/images/blog/x/hero.webp");
      assert.deepEqual([post.imageAlt, post.thumbnailAlt, post.keywords, post.related, post.draft, post.format], ["", "", [], [], false, "md"]);
      assert.equal(post.readingMinutes, 1);
      assert.equal(post.category.name, "Fintech");
    });
  });

  test("outside a production build a draft is listed, flagged", () => {
    withContent(postTree(`${VALID_POST}\ndraft: true`), () => assert.equal(getAllPosts()[0].draft, true));
  });

  test("a bad post surfaces as the engine's ContentError", () => {
    withContent(postTree(VALID_POST.replace("author: h-kamkar", "author: nobody")), () => {
      assert.throws(getAllPosts, (error: unknown) => error instanceof ContentError && error.message === 'content/blog/x.md: author "nobody" is not in content/authors.json (h-kamkar)');
    });
  });
});
