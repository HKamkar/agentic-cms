import assert from "node:assert/strict";
import { test } from "node:test";
import type { SiteConfig } from "../site.ts";
import { createRootMetadata, unlistedMetadata } from "./metadata.ts";
import type { PageSeo } from "./types.ts";

const SITE = { name: "Brand", shortName: "Brand", url: "https://brand.example", locale: "en", ogLocale: "en_US" } as SiteConfig;
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

test("unlistedMetadata: a route no search engine lists — noindex, and nothing else", () => {
  assert.deepEqual(unlistedMetadata(), { robots: { index: false } });
});
