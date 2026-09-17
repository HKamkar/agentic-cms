# Blog engine

Turns markdown files in `content/blog/` into the blog index, the post pages,
the RSS feed and the sitemap — all at build time. This document is the
complete contract; read it before changing anything in `src/lib/blog/`,
`content/`, `src/components/blog/` or the blog routes.

## Rules that must not break

1. **Build time only.** The content engine (`src/lib/content/README.md`)
   reads `content/blog` with `node:fs`; `posts.ts` derives from what it
   returns. Every consumer is statically generated; nothing here may run at
   request time (the Cloudflare Worker has no filesystem).
2. **The filename is the URL.** `content/blog/<slug>.md` → `/blog-post/<slug>`.
   Those URLs are indexed by Google; never rename a file without a redirect.
3. **Files starting with `_` are ignored** (that is how `_template.md` stays
   unpublished). `draft: true` hides a post from production builds only.
4. **Two dates, both kept.** `date` is the editorial date readers see;
   `publishedAt` / `updatedAt` are ISO timestamps that feed `datePublished` /
   `dateModified` in the JSON-LD, the feed and the sitemap, so a post imported
   from an older site keeps the timestamps search engines already have. Never
   "clean them up" into one.
5. **Body conventions are load-bearing.** A `##` heading containing
   "frequently asked" or "faq" produces the accordion and the FAQPage JSON-LD;
   a `> blockquote` becomes the pull-quote card; an image alone in a paragraph
   becomes the inline image block. Renaming the heading silently removes both
   FAQ outputs.
6. **Frontmatter is validated.** Unknown keys, missing required fields,
   unknown category/author keys, bad dates and unknown `related` slugs fail the
   build: the contract is `postSchema` in `src/lib/content/collections.ts`
   (the error format is the engine's, one line per problem naming the file
   and the field). Extend the schema, never read a new `data.*` key ad hoc.
7. **Posts are files, nothing else.** There is no CMS and no importer; a new
   post starts from `content/blog/_template.md`.

## Files

| File | Role |
|---|---|
| `content/blog/*.md`, `*.mdx` | One post per file. `.md` = GFM markdown with raw HTML allowed (a raw `<figure><div><img></div></figure>` renders full width, which is how an imported post keeps its markup); `.mdx` = MDX, may import React components. |
| `content/blog/_template.md` | Every frontmatter field with guidance; copy it to start a post. |
| `content/authors.json`, `content/categories.json` | Registries (the `authors` / `categories` collections). Frontmatter `author` / `category` must be keys here. |
| `public/images/blog/<slug>/` | A post's images, self-hosted. |
| `src/lib/content/collections.ts` | `postSchema`, `authorSchema`, `categorySchema` and the three collection definitions — the contract and its validation (the engine: `src/lib/content/README.md`). |
| `src/lib/blog/posts.ts` | The post pipeline: `createBlog(collections)` reads the site's registry through `readCollection` / `readEntry`, derives fields, sorts, and returns `getAllPosts`, `getPostBySlug`, `getPostsByCategory`, `getRelatedPosts`, `getAuthor`, `getCategory`, `getAllCategories`, `formatDate` — what a site reads as `kit.blog`; the `Post` / `PostMeta` / `Author` / `Category` types. `posts.test.ts` covers it. |
| `src/lib/blog/markdown.tsx` | `renderPostBody(post, { components, blocks })`: markdown/MDX → React through `next-mdx-remote/rsc` with `remark-gfm`, `rehype-raw` (`.md` only), `rehype-slug`, `rehypePostBlocks` (with the site's block classes) and `rehypePostImages`; the site passes its `mdxComponents` and `postBlocks`. |
| `src/lib/blog/index.ts` | The public surface, `content-engine-kit/blog`: the above plus `extractFaq` and the two rehype plugins. |
| `src/lib/blog/rehype-post-blocks.ts` | Reshapes the rendered body into the post template's blocks (see "Body pipeline"); the class names come in as options. |
| `src/lib/blog/rehype-post-images.ts` | Every `<img>` in a body loads lazily, raw HTML ones included (they all sit below the hero; eager, they would also be preloaded by pages that merely prefetch the post), and gets its `width`/`height` from the file under `public/`, so the page reserves the space. |
| `src/lib/blog/faq.ts` | `extractFaq(markdown)`: the Q/A pairs for FAQPage JSON-LD, using the same heading convention. |
| `src/components/blog/mdx.tsx` | Element overrides for post bodies: internal links via `next/link`, and the `fx` wrapper `rehype-post-blocks` emits, which renders as the element it names (a fork that adds reveals maps it to `ix/Fx` instead). |
| `src/components/blog/PostBody.tsx`, `PostBody.module.css` | `postBlocks`: the classes of the four block kinds; the module holds a body's element rules (paragraph, heading and list margins, the bullet, the full-width figure) and the FAQ accordion's styles. `<PostBody>` wraps a rendered body. |
| `src/components/blog/BlogCard.tsx` | The post card; index (with excerpt) and "Read next". |
| `src/components/blog/BlogHero.tsx` | The index's hero, also the 404 page's frame. |
| `src/lib/components/FaqAccordion.tsx` | The blog template's custom FAQ behaviour (click an `h3` in a `[data-faq]` block to toggle its paragraphs; `aria-expanded` / `data-open` carry the state). |
| `content/pages/blog.yaml`, `src/components/blog/BlogIndex.tsx` | The index is a page file with one `blog-index` section (its copy, its `Blog` JSON-LD); the section component takes every published post, newest first, from the registry's `withData()`. There is no `src/app/blog/` route. |
| `src/app/blog-post/[slug]/page.tsx` | Post page: `generateStaticParams` + `dynamicParams = false`, metadata from frontmatter (`kit.seo.postMetadata`: Open Graph `article` with published/modified time, author, section and tags), BlogPosting + BreadcrumbList + FAQPage JSON-LD (`kit.seo.postJsonLd`, `postBreadcrumb`, `postFaqJsonLd`), body, "Read next". |
| `src/app/feed.xml/route.ts` | RSS 2.0, `force-static`: `kit.seo.feed()`. |
| `src/app/sitemap.ts` | `kit.seo.sitemap()`: every page file and every post, the post's `lastModified` from `updatedAt ?? publishedAt ?? date`. |

## Frontmatter contract

Enforced by `postSchema` (`src/lib/content/collections.ts`); every field's
`.describe()` there says the same as this table.

| Key | Type | Required | Used for |
|---|---|---|---|
| `title` | string | yes | H1, card title, `<title>` (unless `seoTitle`), JSON-LD headline |
| `excerpt` | string | yes, unless `seoDescription` | card text, meta description fallback, RSS description, JSON-LD description |
| `date` | `YYYY-MM-DD` (quote it) | yes | date shown to readers; primary sort key (newest first) |
| `category` | key of `categories.json` | yes | eyebrow label, `articleSection`, related-post fallback |
| `author` | key of `authors.json` | yes | byline, author card, JSON-LD author |
| `image`, `imageAlt` | string | no | hero image on the post page, JSON-LD image |
| `thumbnail`, `thumbnailAlt` | string | no (defaults to `image`) | card image |
| `ogImage` | string | no (defaults to `image`, then `thumbnail`) | Open Graph / Twitter image; previews want about 1.91:1 and at least 1200 px wide, which the hero is |
| `seoTitle` | string | no (default `title \| <site.name>`) | exact `<title>` and og:title; 60 characters or fewer |
| `seoDescription` | string | no (default `excerpt`) | meta description, 70–160 characters |
| `keywords` | string[] | no | `<meta keywords>`, JSON-LD keywords |
| `related` | string[] of slugs | no | "Read next", topped up by same category, then newest; every slug must exist |
| `source` | string | no | provenance note (e.g. the URL an imported post came from) |
| `publishedAt`, `updatedAt` | ISO timestamp | no | JSON-LD `datePublished` / `dateModified`, RSS `pubDate`, sitemap `lastModified`; `updatedAt` earlier than `publishedAt` is clamped (and the lint warns) |
| `draft` | boolean | no | `true` → excluded from production builds |

Derived, not declared: `slug` (filename), `readingMinutes` (225 wpm),
`format` (`md` / `mdx`), `body`.

Sort order: `date` desc, then `publishedAt` desc, then title.

## Body pipeline

`renderPostBody(post, { components, blocks })` → `compileMDX` → rehype tree →
`rehypePostBlocks` groups the top-level nodes into the blocks of the post
template, with the classes `postBlocks` (in `PostBody.tsx`, passed in as
`blocks`) gives each:

| Markdown | Block emitted |
|---|---|
| a run of ordinary content | `run`: a `div` with the module's `.prose` element rules |
| `> blockquote` | `quote` + `quoteInner`: the pull-quote card (quote icon + text) |
| paragraph containing only an image | `image` + `imageWrap`: the framed inline image |
| `## Frequently asked questions` … until the next `##` | `faqHeading` on the h2 + `faq` on a `div[data-faq]` (the accordion) |

Every block is emitted inside an `<fx>` element carrying the template's
staggered delays; `mdxComponents` renders it as the element it names, so the
wireframe has no reveals and a fork that wants them maps `fx` to `Fx` (`content-engine-kit/ix`)
instead. `FaqAccordion` (client) attaches the toggle behaviour to the
`[data-faq]` block after hydration; `extractFaq` produces the same Q/A pairs
for the FAQPage JSON-LD from the raw markdown.

### Body rules the lint enforces

`content-engine-kit lint` (first in `pnpm build`; `pnpm content:lint`)
reads every post's body and fails the build when: a heading is `#` (the
title is the H1) or jumps a level (`##` to `####`); the FAQ `##` has no
`###` question under it, holds a heading that is not `###`, or has a `###`
without an answer paragraph; an image has no `alt` attribute, an empty or
slot-naming alt ("Supporting illustration for …"), does not exist under
`public/`, is external, or sits outside `public/images/blog/<slug>/`; a
body line contains an em dash, a model name, a banned word or pattern of
`content/VOICE.md`, or the brand without its mark or miscased. It warns
on a claim word near a regulation with the brand as the subject and on a
cloud named as what the stack runs on. The frontmatter gets the same treatment: it fails on
`imageAlt` missing while `image` is set (and the thumbnail pair), a
slot-naming alt, fewer than 3 or more than 8 keywords, an excerpt outside
30–40 words, `updatedAt` before `publishedAt`, a `date` that is not a
calendar day; it warns on `seoTitle` over 60 (or `title` + the
11-character suffix), `seoDescription` outside 70–160, a future date, a
draft older than 30 days.

## Recipes

**Add a post.** Copy `content/blog/_template.md` to `content/blog/<slug>.md`,
fill the frontmatter, put images in `public/images/blog/<slug>/` — wireframe
stand-ins from `pnpm kit placeholder <out> <width> <height>` (hero and
mid 1600×900, card 820×696), real ones through `pnpm kit optimize-webp
public/images/blog/<slug>` (lossy WebP at quality 80; design exports are
usually lossless and 3-5x larger) — and write the body with the conventions
above. `pnpm build` validates it; `pnpm dev` shows drafts too.

**Add a category or author.** Add the key to `content/categories.json` /
`content/authors.json`; the frontmatter may use it immediately.

**Add a frontmatter field.** Add it to `postSchema` in
`src/lib/content/collections.ts` with one of the schema helpers and a
`.describe()`, map it in `toPost()` in `posts.ts` (`PostMeta` type + return
object), document it here and in `_template.md`, then use it in the
page/metadata. `pnpm test` runs the contract's tests.

**Add a body block type.** Add a detector and an emitter in
`rehype-post-blocks.ts`, its classes to `postBlocks` in `PostBody.tsx`
(utilities, or a rule in `PostBody.module.css` for what needs CSS proper),
and document the markdown convention here and in `_template.md`.

**Change how posts render.** `src/app/blog-post/[slug]/page.tsx` for the page
frame, `mdxComponents` for element overrides, `rehype-post-blocks.ts` for
block structure, `PostBody` for the styling. Prove existing posts are
unchanged with `content-engine-kit parity` (markup) or `content-engine-kit visual-parity`
(pixels, when the styling changes).
