import assert from "node:assert/strict";
import { test } from "node:test";
import { faqPost, pageWith, statesFor } from "./states.mjs";

// A site's kit as the states read it: its config, two page files and three posts, one with a FAQ.
const kit = (posts) => ({
  site: { cta: { label: "Get in touch" }, nav: [{ href: "/", label: "Home" }, { href: "/about", label: "About" }], footer: { quickLinks: [{ label: "Home" }, { label: "Blog" }] }, links: { blog: "/blog" } },
  content: { getPages: () => [{ data: { seo: { path: "/" }, sections: [{ type: "hero" }] } }, { data: { seo: { path: "/contact" }, sections: [{ type: "group", sections: [{ type: "contact-form" }, { type: "faq" }] }] } }] },
  blog: { getPostBySlug: (slug) => posts[slug] },
  seo: { postFaqJsonLd: (post) => (post.faq ? { "@type": "FAQPage" } : null) },
});
const ROUTES = ["/", "/blog", "/blog-post/a", "/blog-post/b", "/blog-post/c", "/contact"];

test("the post state is on the first post, in route order, whose body has a FAQ; with none, the row is dropped and the others stay", () => {
  const withFaq = kit({ a: { faq: false }, b: { faq: true }, c: { faq: true } });
  assert.equal(faqPost(withFaq, ROUTES), "/blog-post/b", "not the first post: the first with a FAQ");
  assert.equal(statesFor(withFaq, ROUTES).find((s) => s.name === "post-faq-open").page, "/blog-post/b");
  const none = kit({ a: {}, b: {}, c: {} });
  assert.equal(faqPost(none, ROUTES), undefined);
  assert.deepEqual(statesFor(none, ROUTES).map((s) => s.name), ["cta-hover", "nav-link-hover", "footer-link-hover", "card-hover", "field-focus", "checkbox-checked", "faq-open"], "a build whose posts have no FAQ: no post state, where it used to time out on the first post");
  assert.equal(faqPost(kit({ b: { faq: true } }), ["/blog-post/a", "/blog-post/b"]), "/blog-post/b", "a route the tree's content does not know (a --ref build's post) is passed over");
  assert.equal(faqPost(withFaq, ["/", "/blog"]), undefined, "a build without posts");
});

test("the form and FAQ states are on the first page file with that section, inside a group too; every row has its page, a target and an act", () => {
  const site = kit({});
  assert.equal(pageWith(site, "contact-form"), "/contact");
  assert.equal(pageWith(site, "faq"), "/contact", "a section inside a group wrapper");
  assert.equal(pageWith(site, "pricing"), undefined);
  for (const state of statesFor(site, ROUTES)) {
    assert.ok(state.page && state.width === 1440, state.name);
    assert.equal(typeof state.target, "function", `${state.name}: a target the capture checks for before it acts`);
    assert.equal(typeof state.act, "function", state.name);
  }
});
