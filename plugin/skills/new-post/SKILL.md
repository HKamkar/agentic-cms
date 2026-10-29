---
name: new-post
description: Add a blog post to content/blog/ as a draft, from a brief, a draft file or the workshop's drafts, with its images, frontmatter and the load-bearing body conventions, then prove it with the content lint and the build. Use when asked to add, create or import a post, bring a draft into the site, or publish a draft; to write one from scratch, write-post runs first and hands off here.
argument-hint: <slug> [path to the draft or brief]
---

# New post

The repo is the current directory. The post is `content/blog/<slug>.md`;
the filename is the URL `<postPrefix>/<slug>` (`src/config/site.ts`),
permanent once pushed. It ships as `draft: true`; the user flips it.

## Read first

`content/README.md` (the door), `content/VOICE.md` (the voice and claims:
how the brand is spelled, what is never said, the calls to action),
`content/blog/_template.md` (every field annotated, the image names and
sizes, the closing paragraph), the frontmatter's JSON Schema
`content/_schemas/posts.json` (every key a post may hold, which are
required, what each says), `src/lib/blog/README.md` § Body pipeline
(the conventions the renderer keys off), the keys of
`content/categories.json` and `content/authors.json`, the draft or brief
the user named, and `content/editorial/workshop.yaml` if it exists (its
`drafts` role is where a draft written outside the repo would be).

## Steps

1. **The slug.** Lowercase words and hyphens, the topic first. Stop and
   confirm it with the user if it was not given; check that
   `content/blog/<slug>.md` and `public/images/blog/<slug>/` do not exist.
2. **The file.** Copy `content/blog/_template.md` to `content/blog/<slug>.md`
   and drop the template's comments. Frontmatter: `title`; `excerpt` of 30–40
   words that does not repeat the title; `date` quoted; `category` and
   `author` as keys of the two registries; `seoTitle` of 60 characters or
   fewer, the topic first and ` | ` + the site's name last (the layout's
   title template, `site.name`); `seoDescription` of 70–160; 3–8
   `keywords`; 2–3 `related` slugs that exist; `draft: true`; no
   `publishedAt` yet.
3. **The images.** The three files the template names under
   `public/images/blog/<slug>/`, at the sizes its comments give, then the
   optimise command from the package's `scripts/README.md` (`pnpm kit
   optimize-webp`); `image` / `imageAlt`,
   `thumbnail` / `thumbnailAlt` (a sentence saying what each shows) and
   `ogImage` = the hero. Without images yet, leave the fields out (they are
   optional) and say so; the lint's `body-image` rule wants the figure's
   file, so keep the figure paragraph out until it exists.
4. **The body.** From a draft file: keep the body from its first `##`
   through the FAQ section; drop an H1, a provenance note, an appendix
   (their SEO fields are frontmatter now); rename a `## FAQ` to the
   template's FAQ heading. Written here: under `content/VOICE.md`. Either
   way: headings start at `##` and never jump a level; one `> "…"` lifted
   verbatim (the pull-quote card); the figure as an image alone in its
   paragraph with a real alt; the FAQ heading exactly as the template has
   it, with 3–5 `###` questions each answered by a paragraph; internal
   links site-relative (`<postPrefix>/other-slug`); the brand as
   `VOICE.md` spells it; the closing paragraph with the site's call to
   action as the template shows it.
5. **Lint until clean.** `pnpm content:check` first (what no schema
   checks: the refs, the excerpt-or-description rule), then
   `pnpm content:lint`: fix every `FAIL`; read every `WARN` on the new file
   and fix it or say why it stays.
6. **Verify** (below). Drafts render in `pnpm dev` only; to see the post in
   the built site (`pnpm preview`, or `pnpm start`), flip `draft` in the
   working tree, build, look, flip back.
7. **Commit** `Post: <title>` on the repo's working branch. Publishing is
   the user's: they set `draft: false` and `publishedAt` (now, ISO), then
   push.

## In another language

In a site in several languages (`site.locales`), a post in another
language is `content/blog/<prefix>/<slug>.md`: the original's slug when
it translates one, its `author` and `category` keys in the language's
registries (`authors.<prefix>.json`, `categories.<prefix>.json`), its FAQ
under the language's `faqHeading`, its pictures the original's. Drafting
the translation of a default post is `translate`; a language with no
posts yet also needs its blog page and its post template and feed routes
(`docs/locales.md` § Posts), which are the user's call.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # 0 failures; read every WARN
pnpm preview                                                # pnpm start where the site has none; open <postPrefix>/<slug>; then stop it
git push                                                    # when the user says
```

## Stop for the user

The slug and the title (step 1); missing images (step 3); flipping
`draft` and setting `publishedAt`; the push.
