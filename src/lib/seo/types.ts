// The SEO contract of a page: what the `seo` block of every page file
// (content/pages/<slug>.yaml) declares, as the content engine validates it
// (pageSeoSchema in src/lib/content/collections.ts). pageMetadata() and
// pageBreadcrumb() build the head tags and structured data from it,
// sitemap.ts lists it, and scripts/check-seo.mjs audits the prerendered
// result after every build.

export type { ChangeFrequency, PageSeo } from "@/lib/content";
