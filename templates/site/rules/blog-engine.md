---
paths:
  - "content/blog/**"
  - "src/components/blog/**"
  - "src/app/blog-post/**"
  - "src/app/feed.xml/**"
---

# The post pipeline — read `node_modules/agentic-cms/src/lib/blog/README.md` before editing

- Build time only; the filename is the URL (`/blog-post/<slug>` unless `site.postPrefix` says otherwise); the frontmatter is the kit's `postSchema`.
- Two dates on purpose: `date` is the editorial date readers see; `publishedAt` is the structured data's timestamp and never changes once a post is live; an edit sets `updatedAt`. <!-- required -->
- Body conventions are load-bearing: the FAQ accordion and the FAQPage structured data key off a `## Frequently asked questions` heading with `###` questions; a `> blockquote` is the pull-quote card; an image on its own line is the inline image block. Headings start at `##` and never jump a level. `draft: true` only hides in production builds; `_`-prefixed files are skipped. <!-- required -->
- Images live under `public/images/blog/<slug>/`, optimised (`pnpm kit optimize-webp`), each with an alt that says what it shows; post bodies get `loading="lazy"` and their sizes from the pipeline.
- A rendering change to the post template is proven with `pnpm kit parity` (markup) and `pnpm kit visual-parity` (pixels).
- **Tier:** the post pipeline, a layer of the content engine (`agentic-cms/blog`) — required: `next build` fails a post its schema refuses, `agentic-cms lint --production` (in `pnpm build`, after the lint) a body or a field out of line (`heading-level`, `faq-structure`, `body-image`, `excerpt-words`, `keywords-count`, `date-order`) and `agentic-cms seo` a rendered post. <!-- required -->
