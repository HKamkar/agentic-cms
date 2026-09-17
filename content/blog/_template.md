---
# Copy this file to <slug>.md — the filename is the URL: /blog-post/<slug>.
# Files starting with "_" are ignored by the loader, so this template never publishes.
# Every field is checked at build time (postSchema in src/lib/content/collections.ts); a bad value fails the build.

title: Post title, shown in the H1 and on cards                 # required
excerpt: >-                                                     # required unless seoDescription is set; 30-40 reader-focused words for cards
  What the reader gets from this post, without repeating the title.
date: '2026-01-31'                                              # required, YYYY-MM-DD — the editorial date readers see; quote it
category: guides                                                # required — a key of content/categories.json
author: acme-editorial                                          # required — a key of content/authors.json
# A picture that does not exist yet starts as a wireframe placeholder:
# pnpm kit placeholder <path> <width> <height>
image: /images/blog/<slug>/<slug>-hero.webp                     # hero image, a WebP of 1600x900; run pnpm kit optimize-webp on the folder
imageAlt: What the hero image shows, in a sentence
thumbnail: /images/blog/<slug>/<slug>-card.webp                 # card image (820x696); defaults to image
thumbnailAlt: What the card image shows, in a sentence
# ogImage: the social image; defaults to the hero, which is already ≥1200 px wide
# and inside the 1.6-2.0 ratio previews want, so leave it out unless you have a
# picture made for sharing. A figure inside the body is 1600x900 like the hero.
seoTitle: Exact <title> for search, 60 characters or fewer; defaults to "title | Acme"
seoDescription: Meta description, 70-160 characters; defaults to excerpt
keywords: [content engine, static site, markdown]
related: [other-slug, another-slug]                              # 2-3 slugs that must exist; topped up by category, then newest
# publishedAt / updatedAt: ISO timestamps for JSON-LD datePublished / dateModified.
# Set publishedAt once when the post first goes live (an imported post keeps the
# timestamp it was published with); add updatedAt only after editing a published
# post. Never "clean up" the two dates.
publishedAt: '2026-01-31T09:00:00.000Z'
# draft: true                                                    # keeps the post out of production builds (still visible in pnpm dev)
---

Opening paragraph(s). Markdown (GFM); raw HTML is allowed in `.md`, React
components in `.mdx`. Headings inside the body start at `##`.

## First section

Body text. Internal links use site-relative paths (`/blog-post/other-slug`).

> "A short, memorable line lifted verbatim from the post."

The blockquote above becomes the pull-quote card of the post template.

![What the figure shows, in a sentence](/images/blog/<slug>/<slug>-mid.webp)

An image alone in its paragraph becomes the inline image block.

## Last section

The closing paragraph, before the FAQ, ends with the site's call to action:
[Get in touch](/#contact-form) to talk it through.

## Frequently asked questions

A `##` heading containing "frequently asked" or "faq" turns everything until
the next `##` into the accordion and the FAQPage JSON-LD. Rename it and both
silently disappear.

### A question, as an H3?

The answer: one or more paragraphs.

### Another question?

Its answer.
