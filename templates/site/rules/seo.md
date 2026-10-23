---
paths:
  - "src/app/**"
  - "src/config/site.ts"
  - "src/kit.ts"
  - "content/blog/**"
  - "content/pages/**"
---

# SEO — read `node_modules/agentic-cms/src/lib/seo/README.md` before editing

- A page is `content/pages/<slug>.yaml`: its `seo` block feeds `kit.seo.pageMetadata()` and `pageBreadcrumb()`, its `jsonld` block `pageJsonLd()`. Never hand-write head tags. The root layout's `metadata` is `kit.seo.rootMetadata()`, a post's `postMetadata()`, a design round's or the lab's route `unlistedMetadata()`; `pnpm lint` fails any other `metadata`, `generateMetadata` or head element (`agentic-cms/head`). <!-- required -->
- The limits the audit enforces: title 60 (fail at 70) and unique across pages, description 70–160, one `<h1>`, every `<img>` with alt, width and height, an OG image 1200×630 at `public/images/<path-with-hyphens>-og.jpg`, structured data only for what is on the page, every internal link resolving.
- `pnpm build` ends with `agentic-cms seo` over every prerendered page and fails on a missing or wrong field; never loosen a rule to pass it. Public URLs match what search engines have indexed and do not change without redirects. <!-- required -->
- **Tier:** SEO, a layer of the content engine (`agentic-cms/seo`, `kit.seo`) — required: `pnpm lint` fails a head of the site's own (`agentic-cms/head`), `agentic-cms lint` the SEO fields at the source (`seo-title`, `seo-description`) and `pnpm build` a prerendered page out of line (`agentic-cms seo`). <!-- required -->
