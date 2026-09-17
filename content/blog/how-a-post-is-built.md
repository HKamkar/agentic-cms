---
title: How a post is built
excerpt: >-
  Every part of a post on this kit is a file or a convention inside that file.
  The two dates, the three images, the pull quote, the FAQ heading and the
  closing line, in the order you meet them.
date: '2026-09-03'
category: guides
author: acme-editorial
image: /images/blog/how-a-post-is-built/how-a-post-is-built-hero.webp
imageAlt: A wide grey placeholder standing in for the hero illustration of this post
thumbnail: /images/blog/how-a-post-is-built/how-a-post-is-built-card.webp
thumbnailAlt: A grey placeholder standing in for the card image of this post
seoTitle: How a post is built | Acme
seoDescription: What a post on this kit is made of, in order. The frontmatter and its two dates, the three images, the pull quote and the FAQ heading.
keywords: [content engine, blog post, frontmatter, markdown, static site]
related: [pages-are-files, the-voice-file-and-the-lint]
publishedAt: '2026-09-03T09:00:00.000Z'
updatedAt: '2026-09-17T10:00:00.000Z'
---

A post is one markdown file in `content/blog/`, served at the route its name
spells: `how-a-post-is-built.md` is `/blog-post/how-a-post-is-built` and stays
there. The filename is the URL, so naming the file is a decision and not a side
effect. Everything else about the post is either a field in the frontmatter
or a convention the body follows.

## The frontmatter is the contract

The block at the top of the file is parsed as YAML and checked against a schema
before anything renders. A missing title fails the build. An unknown key fails
the build, which is what makes a typo visible instead of silent. An author or a
category that is not in the registries fails with the list of keys that would
have worked.

Four fields carry the search surface. `seoTitle` is the exact page title, and
the lint warns over 60 characters. `seoDescription` is the meta description, and
it warns outside 70 to 160. `keywords` becomes the meta keywords and the article
tags, three to eight of them. `excerpt` is the card text and the RSS description,
and here the lint fails outside 30 to 40 words, because a card that runs longer
breaks the grid it sits in.

> "The filename is the URL, so naming the file is a decision and not a side effect."

## Two dates, both kept

`date` is the editorial date a reader sees and the key the index sorts on.
`publishedAt` is an ISO timestamp, and it feeds `datePublished` in the structured
data, the `pubDate` in the feed and the last-modified date in the sitemap. The
pair looks redundant until a post is imported from somewhere else, or edited
years later, and the reader's date and the machine's date stop agreeing.

A post edited after publication gets `updatedAt`, and only then. An `updatedAt`
earlier than `publishedAt` fails the lint, and the post pipeline clamps it, so a
careless edit cannot walk a published date backwards.

## Three images, named for their slots

The images of a post live in `public/images/blog/<slug>/` and nowhere else. The
hero is 1600 by 900, the card image 820 by 696, and any figure in the body 1600
by 900 again. The social image falls back to the hero, which is already the right
shape for a preview.

![A wide grey placeholder standing in for a figure inside this post](/images/blog/how-a-post-is-built/how-a-post-is-built-mid.webp)

Each one carries alt text that says what the picture shows. The lint fails an alt
that names the slot rather than the picture, fails an image that sits outside the
post's folder, and warns about a file in that folder no post references, so the
folder never fills up with leftovers. Placeholders come from
`pnpm kit placeholder <path> <width> <height>` while the real pictures are
still being made.

## The conventions inside the body

Body headings start at `##`, because the title is the page's H1, and they never
skip a level. A blockquote becomes the pull-quote card. An image alone in its
paragraph becomes the framed inline block. A `##` heading containing the words
"frequently asked" turns everything under it into the accordion and into FAQPage
structured data at the same time. Rename that heading and both disappear without
a word, which is the one convention worth memorizing.

The other files a post leans on get the same treatment, and
[pages are files](/blog-post/pages-are-files) covers the page side of it. The
[blog index](/blog) lists every published post, newest first, from the same
frontmatter.

Every one of these conventions is a line in `content/blog/_template.md`, which is
the fastest way to see them all at once. [Get in touch](/#contact-form) if you
want a second pair of eyes on a draft.

## Frequently asked questions

### Where do I start a new post?

Copy `content/blog/_template.md` to `content/blog/<slug>.md`. The template
carries every frontmatter field with a comment on what it is for, and a body that
demonstrates each convention once.

### How do I keep a post out of the site while I write it?

Set `draft: true`. The post is still rendered by `pnpm dev`, so you can read it in
place, and it is left out of production builds. The lint warns once a draft is
more than thirty days old.

### What happens if I rename the file?

The URL changes, and any link or search result pointing at the old one breaks.
Rename a published post only with a redirect in place. Retiring a post is the
safer move, since the file keeps its slug and the URL comes back the day the post
does, instead of being lost to a rename.

### Do I have to write the FAQ section?

No. It is a convention, not a requirement. When the heading is there, the lint
insists that it holds `###` questions and that each question has an answer
paragraph under it, because an empty accordion is worse than none.
