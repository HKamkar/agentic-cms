---
title: Pages are files
excerpt: >-
  A page on this CMS is one YAML file with three blocks. An SEO block, a
  structured-data block and a list of sections in order. Here is what each block
  holds and what the build does with it.
date: '2026-09-09'
category: guides
author: acme-editorial
image: /images/blog/pages-are-files/pages-are-files-hero.webp
imageAlt: A wide grey placeholder standing in for the hero illustration of this post
thumbnail: /images/blog/pages-are-files/pages-are-files-card.webp
thumbnailAlt: A grey placeholder standing in for the card image of this post
seoTitle: Pages are files | Acme
seoDescription: A page here is one YAML file with three blocks. The SEO block, the structured data, and the sections in order, all checked before a route renders.
keywords: [page as a file, YAML, section types, structured data, SEO audit]
related: [how-a-post-is-built, the-voice-file-and-the-lint]
publishedAt: '2026-09-09T09:00:00.000Z'
updatedAt: '2026-09-18T12:48:48.000Z'
---

A page on this site is `content/pages/<slug>.yaml`. The file name is only a key.
The route comes from `seo.path` inside it, and the file holds three blocks.
Adding a page means adding a file, and nothing in `src/` has to change for it.

## The seo block is the head of the page

`seo` declares the route, the exact title, the meta description, the social
image, the date the copy last changed, and the name the page goes by in a
breadcrumb. Those six fields become the title tag, the canonical, the Open
Graph and Twitter tags, the breadcrumb structured data and the sitemap entry;
two optional ones, the change frequency and the priority, are sitemap hints.
None of it is written by hand in a component, and a page that leaves a field out
fails the build with the file and the field named.

The audit that runs after the build reads the rendered HTML back and checks the
result rather than the intent. It fails a duplicate title, a description outside
fifty to two hundred characters, a canonical that does not match the route, a
social image narrower than 1200 pixels, a page with two H1 elements, and an
internal link that matches no page and no file. The page file is where you fix
any of it.

## The jsonld block is the structured data

The second block says what kind of page this is, and carries the copy its
structured data needs. A `WebPage` describes the application and may list the
use-case cards as an `ItemList`. An `AboutPage` carries the organization. A
`ContactPage` carries the postal address and the contact points. A `Blog`
declares nothing, because every post is already a file.

The page file says what is true, and the builders decide how to say it in
schema.org. That split is deliberate. Marking up something the page does not show
is the fastest way to lose a rich result, so an `AboutPage` without a FAQ section
throws at build time rather than emitting an empty `FAQPage`.

> "The page file says what is true, and the builders decide how to say it in schema.org."

## The sections are the page

The third block is a list. Each entry has a `type` and the copy that type takes.
There are twenty-five types in this repository, and each one is a schema in
`src/components/sections/schemas.ts` beside the component that renders it. A hero
takes an eyebrow, a heading, a paragraph and a button label. A card section takes
an exact number of cards, because the layout is written for that number,
so a fourth card is a design change rather than a copy edit.

![A wide grey placeholder standing in for a figure inside this post](/images/blog/pages-are-files/pages-are-files-mid.webp)

What stays out of the page file matters as much. Image sizes, class strings
and placeholder ratios live in the component, keyed by position.
The file carries words and image paths. That is the line that lets a writer edit
a page without reading React, and a designer restyle a section without touching
content.

The four pages under `/sections` in this site exist to show the types the landing
page does not use, with copy that names each slot. Read them beside
[how a post is built](/blog-post/how-a-post-is-built) and the shape of the whole
tree falls out. The rest of the writing is on the [blog](/blog).

Start from `content/_templates/page.yaml`, pick the sections, run the lint and
the build, and look at the result at every width before you call it done.
[Get in touch](/#contact-form) if a section type you need is missing.

## Frequently asked questions

### Does a new page need code?

Not if it is made of section types that already exist. A new section type does
need three things in one commit, though. A schema, a component, and an entry in
the registry that ties them together.

### How does the page get into the navigation?

It does not, automatically. The nav, the footer links and the named links in
`src/config/site.ts` are separate lists, and a page joins the ones it belongs in.
The sitemap is the exception, since it follows the page files on its own.

### Can one page hold two of the same section type?

Yes. The sections are a list, not a map, and a type may appear more than once.
A group wrapper can also hold several sections under one background.

### What if I need to change a route?

Treat it as a URL change, because it is one. The old path is what search engines
and other people's links point at, so it needs a redirect before the page file
moves.
