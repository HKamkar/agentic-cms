---
paths:
  - "src/app/**"
  - "src/config/site.ts"
  - "src/lib/seo/**"
  - "content/blog/**"
  - "content/pages/**"
---

# SEO — read `src/lib/seo/README.md` before adding or editing a page or post

- A page is a file, `content/pages/<slug>.yaml`: its `seo` block (`path`, `title`, `description`, `ogImage`, `updated`, `breadcrumb`, `changeFrequency`, `priority`), its `jsonld` block (the copy of its structured data by page type) and its `sections`. `src/app/[[...slug]]/page.tsx` renders every page file with `kit.seo.pageMetadata()`, `pageBreadcrumb()` and `pageJsonLd()` (`kit.seo` is `createSeo()` composed in `src/kit.ts`; the engine never imports the site). Never hand-write title, description, canonical, Open Graph or Twitter tags, and never add a `page.tsx` for a page made of existing sections. Posts: `kit.seo.postMetadata(post)` / `postBreadcrumb(post)`.
- Title ≤ 60 characters, topic first, unique per page; description 70–160 characters, one sentence with the page's promise; exactly one `<h1>`, `<h2>` for sections, `<h3>` inside (never an `<h3>` before the first `<h2>`); every `<img>` has `alt` (empty when decorative), `width` and `height`; OG image 1200×630 JPEG at `public/images/<path-with-hyphens>-og.jpg` (`/sections/about` → `sections-about-og.jpg`; `node scripts/placeholder.mjs` writes a stand-in).
- Structured data describes what is on the page — no reviews, ratings or offers that are not real, no self-ratings. Organisation blocks come from `organizationLd()`.
- Sitemap and breadcrumbs follow from the page files; bump `seo.updated` when the content changes; internal links go only to pages that exist, with descriptive text; a public URL never changes without a redirect.
- `pnpm build` runs `scripts/check-seo.mjs`: fix every FAIL, read every WARN; never loosen a rule to pass.
