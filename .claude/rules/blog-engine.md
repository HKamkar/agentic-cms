---
paths:
  - "src/lib/blog/**"
  - "content/blog/**"
  - "src/components/blog/**"
  - "src/app/blog-post/**"
  - "src/app/feed.xml/**"
---

# Blog engine — read `src/lib/blog/README.md` before editing

- Build time only: the content engine reads `content/blog` with `node:fs` at build time and `posts.ts` derives from it; every consumer prerendered. Never read `content/` at request time.
- The filename is the indexed URL (`/blog-post/<slug>`); files starting with `_` are ignored; `draft: true` hides a post from production only.
- Frontmatter is a validated contract: `postSchema` in `src/lib/content/collections.ts`. New field = schema field (a helper + `.describe()`) + `toPost()` mapping + `PostMeta` + README + `_template.md`. Never read `data.<key>` ad hoc. The pipeline is `createBlog(collections)` in `posts.ts`, read as `kit.blog` (`src/kit.ts`); `renderPostBody(post, { components, blocks })` takes the site's `mdxComponents` and `postBlocks`.
- Keep both `date` (editorial) and `publishedAt`/`updatedAt` (JSON-LD, RSS, sitemap). Do not merge them.
- Body conventions are load-bearing: `## Frequently asked questions` (accordion + FAQPage JSON-LD), `> blockquote` (pull-quote card), image-only paragraph (inline image block). Changing them changes every post.
- Posts are files and nothing else: no CMS, no importer. A new post starts from `content/blog/_template.md`; the index is a page file (`content/pages/blog.yaml`, a `blog-index` section), not a route of its own.
- Any rendering change: prove existing posts unchanged with `scripts/parity.sh` (markup) or `scripts/visual-parity.mjs` (pixels). Block styling lives in `src/components/blog/PostBody.tsx` + its module; `rehype-post-blocks.ts` takes the class names as options and knows none itself.
- SEO of a post: `seoTitle` ≤ 60 characters (the `<title>`; falls back to `title | <site.name>`), `seoDescription` 70–160 (falls back to the excerpt), `imageAlt` that describes the hero, `ogImage` defaults to the hero; the head comes from `postMetadata()`, `scripts/content-lint.mjs` checks these limits at the source (with the body's structure, the alts, the images on disk and the voice rules of `content/VOICE.md`) and `pnpm build` audits the rendered post (`src/lib/seo/README.md`). The procedures are the `editorial` plugin's `write-post`, `new-post`, `update-post` and `retire-content` (`plugin/skills/`).
