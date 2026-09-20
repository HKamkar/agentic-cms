---
paths:
  - "src/app/**"
  - "src/config/site.ts"
  - "src/kit.ts"
  - "content/blog/**"
  - "content/pages/**"
---

# SEO — read `node_modules/agentic-cms/src/lib/seo/README.md` before editing

- A page is `content/pages/<slug>.yaml`: its `seo` block feeds `kit.seo.pageMetadata()` and `pageBreadcrumb()`, its `jsonld` block `pageJsonLd()`. Never hand-write head tags.
- The limits the audit enforces: title 60 (fail at 70) and unique across pages, description 70–160, one `<h1>`, every `<img>` with alt, width and height, an OG image 1200×630 at `public/images/<path-with-hyphens>-og.jpg`, structured data only for what is on the page, every internal link resolving.
- `pnpm build` ends with `agentic-cms seo` over every prerendered page and fails on a missing or wrong field; never loosen a rule to pass it. Public URLs match what search engines have indexed and do not change without redirects.
