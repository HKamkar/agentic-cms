import assert from "node:assert/strict";
import { test } from "node:test";
import type { Post } from "../blog/posts.ts";
import { createUrls, type SiteConfig } from "../site.ts";
import { createMetadata, createRootMetadata, pageMetadata, unlistedMetadata } from "./metadata.ts";
import type { PageSeo } from "./types.ts";

const SITE = { name: "Brand", shortName: "Brand", url: "https://brand.example", locale: "en", ogLocale: "en_US", postPrefix: "/blog-post" } as SiteConfig;
const HOME = { title: "Brand: what it does", description: "What a reader finds on the home page, in one sentence." } as PageSeo;

test("rootMetadata: the root layout's head — the origin, the title template with the home page's title, its description, Open Graph's name and locale, the card, the feed — reading the home page when called", () => {
  let reads = 0;
  const rootMetadata = createRootMetadata(SITE, () => { reads += 1; return HOME; });
  assert.equal(reads, 0, "nothing read when the kit is made");
  assert.deepEqual(rootMetadata(), {
    metadataBase: new URL("https://brand.example"),
    title: { default: "Brand: what it does", template: "%s | Brand" },
    description: "What a reader finds on the home page, in one sentence.",
    openGraph: { type: "website", siteName: "Brand", locale: "en_US" },
    twitter: { card: "summary_large_image" },
    alternates: { types: { "application/rss+xml": "https://brand.example/feed.xml" } },
  });
  assert.equal(reads, 1);
  assert.deepEqual(createRootMetadata({ ...SITE, ogLocale: undefined }, () => HOME)().openGraph, { type: "website", siteName: "Brand" }, "no og:locale without one");
});

const PAGE = { path: "/about", title: "About Brand", description: "Who builds Brand, and why, in one sentence.", ogImage: "/images/about-og.jpg" } as PageSeo;
const POST = { slug: "first-post", title: "First post", excerpt: "What the post says.", date: "2026-01-02", author: { name: "Ann" }, category: { name: "Notes" }, keywords: [] } as unknown as Post;

test("pageMetadata: a page's own head, which needs no site and names none", () => {
  const { openGraph, alternates } = pageMetadata(PAGE);
  assert.deepEqual(alternates, { canonical: "/about" });
  assert.equal((openGraph as { siteName?: string }).siteName, undefined);
});

test("kit's pageMetadata and postMetadata: the layout's Open Graph name and locale and the feed link stay, since a route's openGraph and alternates replace the layout's", () => {
  const head = createMetadata(SITE, createUrls(SITE));
  const page = head.pageMetadata(PAGE);
  assert.deepEqual(page.openGraph, { siteName: "Brand", locale: "en_US", type: "website", title: "About Brand", description: "Who builds Brand, and why, in one sentence.", url: "/about", images: [{ url: "/images/about-og.jpg", width: 1200, height: 630 }] });
  assert.deepEqual(page.alternates, { types: { "application/rss+xml": "https://brand.example/feed.xml" }, canonical: "/about" });
  const post = head.postMetadata(POST);
  assert.deepEqual([(post.openGraph as { type: string }).type, (post.openGraph as { siteName: string }).siteName, (post.openGraph as { locale: string }).locale], ["article", "Brand", "en_US"]);
  assert.deepEqual(post.alternates, { types: { "application/rss+xml": "https://brand.example/feed.xml" }, canonical: "/blog-post/first-post" });
  const bare = createMetadata({ ...SITE, ogLocale: undefined }, createUrls(SITE)).pageMetadata(PAGE).openGraph as { locale?: string };
  assert.equal(bare.locale, undefined, "no og:locale without one");
});

test("unlistedMetadata: a route no search engine lists — noindex, and nothing else", () => {
  assert.deepEqual(unlistedMetadata(), { robots: { index: false } });
});
