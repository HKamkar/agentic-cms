import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { z } from "zod";
import { createKit } from "./index.ts";
import { checkLocales, createLocales } from "./locales.ts";
import { expectContentError, postTree, VALID_POST, withContent } from "./content/test-helpers.ts";
import type { SiteConfig, SiteLocale } from "./site.ts";

const LINKS = { home: "/", blog: "/blog", contact: "/#contact" };
const SITE = { name: "Brand", shortName: "Brand", url: "https://brand.example", locale: "en", ogLocale: "en_US", tagline: "What Brand does.", description: "Notes from Brand.", logo: "/logo.svg", address: [], postPrefix: "/blog-post", links: LINKS, nav: [], signIn: { label: "Sign in", href: "https://app.brand.example" }, cta: { label: "Write to us", href: "/#contact" }, footer: { quickLinks: [], social: [] } } satisfies SiteConfig;
const DE: SiteLocale = { locale: "de", prefix: "de", ogLocale: "de_DE", tagline: "Was Brand tut.", description: "Notizen von Brand.", links: { home: "/de", blog: "/de/blog", contact: "/de#contact" }, nav: [], signIn: { label: "Anmelden", href: "https://app.brand.example" }, cta: { label: "Schreiben Sie uns", href: "/de#contact" }, footer: { quickLinks: [], social: [] } };
const WITH_DE = { ...SITE, locales: [DE] };

const sections = z.strictObject({ type: z.literal("text"), body: z.string() });
const page = (path: string, title = `Page at ${path}`) => `seo:\n  path: "${path}"\n  title: "${title}"\n  description: A page of the test site, long enough for the schema.\n  ogImage: /og.jpg\n  updated: "2026-01-02"\n  breadcrumb: Page\njsonld:\n  type: WebPage\nsections:\n  - type: text\n    body: Words.\n`;

describe("checkLocales: the config's locales, checked when the kit is made", () => {
  const fails = (entry: Partial<SiteLocale>, fragment: string) => assert.throws(() => checkLocales({ ...SITE, locales: [{ ...DE, ...entry }] }), (error: Error) => error.message.includes(fragment));
  test("a site without locales, and one with a well-formed one, pass", () => {
    checkLocales(SITE);
    checkLocales(WITH_DE);
    checkLocales({ ...SITE, locales: [DE, { ...DE, locale: "pt-BR", prefix: "pt-br", ogLocale: "pt_BR" }] });
  });
  test("each entry names the field it gets wrong", () => {
    fails({ locale: "" }, "site.locales[0].locale is required");
    fails({ locale: "en" }, 'site.locales[0].locale "en" is the default language, site.locale');
    fails({ prefix: "De" }, 'site.locales[0].prefix "De" must be a lowercase language tag');
    fails({ prefix: "deutsch" }, "must be a lowercase language tag");
    fails({ prefix: "api" }, 'site.locales[0].prefix "api" is a route of the site\'s own');
    fails({ ogLocale: "" }, "site.locales[0].ogLocale is required");
    assert.throws(() => checkLocales({ ...SITE, locales: [DE, { ...DE, locale: "de-AT" }] }), /site\.locales\[1\]\.prefix "de" is listed twice/);
    assert.throws(() => checkLocales({ ...SITE, locales: [DE, DE] }), /site\.locales\[1\]\.locale "de" is listed twice/);
    assert.throws(() => checkLocales({ ...SITE, postPrefix: "/de", locales: [DE] }), /is a route of the site's own/);
  });
});

describe("createLocales: where each language's pages, words and content are", () => {
  const locales = createLocales(WITH_DE);
  test("the default language at the root, the others under their prefix", () => {
    assert.deepEqual(locales.all.map(({ locale, prefix, isDefault }) => [locale, prefix, isDefault]), [["en", "", true], ["de", "de", false]]);
    assert.deepEqual(["/", "/about", "/de", "/de/about", "/de#contact", "/design", "/deals/de"].map((path) => locales.of(path).locale), ["en", "en", "de", "de", "de", "en", "en"]);
    assert.deepEqual([locales.path("de", "/"), locales.path("de", "/about"), locales.path("en", "/about")], ["/de", "/de/about", "/about"]);
    assert.deepEqual([locales.unprefixed("/de"), locales.unprefixed("/de/about"), locales.unprefixed("/about")], ["/", "/about", "/about"]);
    assert.throws(() => locales.get("fr"), /no locale "fr": the site has en, de/);
  });
  test("a language's config: its words and links in place of the default's, the rest the site's", () => {
    const de = locales.site("de");
    assert.deepEqual([de.locale, de.ogLocale, de.tagline, de.links.blog, de.name, de.url], ["de", "de_DE", "Was Brand tut.", "/de/blog", "Brand", "https://brand.example"]);
    assert.equal(locales.site("de"), de, "one config per language");
    assert.equal(locales.site("en"), WITH_DE);
  });
  test("a collection's translation: a folder's under its prefix, a file's with the prefix before the extension, once per language", () => {
    const pages = { name: "pages", kind: "folder" as const, dir: "pages", format: "yaml" as const, schema: z.object({}) };
    const authors = { name: "authors", kind: "map" as const, file: "authors.json", schema: z.object({}) };
    assert.equal(locales.collection(pages, "en"), pages);
    assert.deepEqual([locales.collection(pages, "de").dir, locales.collection(pages, "de").name], ["pages/de", "pages.de"]);
    assert.equal(locales.collection(authors, "de").file, "authors.de.json");
    assert.equal(locales.collection(pages, "de"), locales.collection(pages, "de"));
  });
});

describe("the kit's content in a language", () => {
  const TREE = {
    "pages/home.yaml": page("/"),
    "pages/about.yaml": page("/about"),
    "pages/de/home.yaml": page("/de", "Startseite"),
    "reviews.yaml": "- name: Ann\n  role: Editor\n  quote: Good.\n  photo: /ann.jpg\n",
    "reviews.de.yaml": "- name: Ann\n  role: Redakteurin\n  quote: Gut.\n  photo: /ann.jpg\n",
    "redirects.yaml": "- from: /old\n  to: /\n",
  };
  const kitWith = (site: SiteConfig) => createKit({ site, sections });

  test("a site without locales reads what it did, and its one language by its tag", () => {
    withContent(TREE, () => {
      const kit = kitWith(SITE);
      assert.deepEqual(kit.content.getPages().map((entry) => entry.data.seo.path), ["/about", "/"]);
      assert.deepEqual(kit.content.in("en").getPages().map((entry) => entry.data.seo.path), ["/about", "/"]);
      assert.throws(() => kit.content.in("de"), /no locale "de"/);
    });
  });

  test("another language reads its translations, and only them", () => {
    withContent(TREE, () => {
      const de = kitWith(WITH_DE).content.in("de");
      assert.deepEqual(de.getPages().map((entry) => [entry.file, entry.data.seo.path]), [["content/pages/de/home.yaml", "/de"]]);
      assert.equal(de.getPage("home").seo.title, "Startseite");
      assert.equal(de.getReviews()[0].role, "Redakteurin");
      expectContentError(() => de.getPage("about"), 'content/pages/de: no entry "about" (home)');
      expectContentError(() => de.getFaq("about"), "content/faqs/de: no such directory");
      expectContentError(() => de.getUseCases(), "content/use-cases.de.yaml: no such file");
      assert.deepEqual(de.getRedirects(), [{ from: "/old", to: "/" }], "the redirects are one list for every language");
    });
  });

  test("a page file out of place fails, naming it", () => {
    const fails = (files: Record<string, string>, tag: string, ...fragments: string[]) => withContent({ ...TREE, ...files }, () => expectContentError(() => kitWith(WITH_DE).content.in(tag).getPages(), ...fragments));
    fails({ "pages/de/about.yaml": page("/about") }, "de", 'content/pages/de/about.yaml: seo.path "/about" must be "/de/about", the path of content/pages/about.yaml under /de');
    fails({ "pages/de/contact.yaml": page("/de/contact") }, "de", "content/pages/de/contact.yaml: translates no page: content/pages/contact.yaml does not exist");
    fails({ "pages/legal.yaml": page("/de/legal") }, "en", 'content/pages/legal.yaml: seo.path "/de/legal" is under /de, the prefix of de: a page in that language is content/pages/de/<slug>.yaml');
  });

  test("a language's posts: its folder under content/blog/, its own authors and categories", () => {
    const de = (frontmatter: string) => ({ ...postTree(VALID_POST), "blog/de/x.md": `---\n${frontmatter}\n---\n\nText.\n`, "authors.de.json": JSON.stringify({ "h-kamkar": { name: "H. Kamkar", title: "Redaktion" } }), "categories.de.json": JSON.stringify({ fintech: { name: "Finanztechnik" } }) });
    withContent(de(VALID_POST.replace("title: A post", "title: Ein Beitrag")), () => {
      const posts = kitWith(WITH_DE).blog.in("de").getAllPosts();
      assert.deepEqual(posts.map((post) => [post.slug, post.title, post.category.name, post.author.title]), [["x", "Ein Beitrag", "Finanztechnik", "Redaktion"]]);
      assert.deepEqual(kitWith(WITH_DE).blog.getAllPosts().map((post) => post.title), ["A post"]);
    });
    withContent(de(VALID_POST.replace("category: fintech", "category: private-ai")), () => {
      expectContentError(() => kitWith(WITH_DE).blog.in("de").getAllPosts(), 'content/categories.de.json: no entry "private-ai" (fintech)');
    });
  });
});
