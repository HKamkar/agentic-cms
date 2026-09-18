---
name: update-post
description: Edit a published or draft post in content/blog/ (copy, frontmatter, images), keeping the two dates and the URL intact, then prove it with the content lint and the build. Use when asked to update, revise, fix, reword, retitle or re-image a post, or to change its SEO fields; a rewrite that needs an outline and a critique is write-post in revise mode.
argument-hint: <slug> [what changes]
---

# Update post

The repo is the current directory. The post is `content/blog/<slug>.md`.
Its filename is an indexed URL and never changes; its two dates have
different jobs (`src/lib/blog/README.md` § Frontmatter): `date` is the
editorial date readers see, `publishedAt` the JSON-LD `datePublished`,
`updatedAt` the `dateModified`.

## Read first

The post file, `content/VOICE.md`, `src/lib/blog/README.md`, and
`git log --oneline -- content/blog/<slug>.md` for what changed before.

## Steps

1. **The edit.** Change the copy or the field the user asked for and
   nothing else; the conventions of `new-post` step 4 still hold (the FAQ
   heading is load-bearing: renaming it silently removes the accordion and
   its structured data).
2. **The dates.** If the post has `publishedAt`, set `updatedAt` to now
   (`date -u +%FT%T.000Z`); never touch `publishedAt`, `date` or the
   filename. A draft gets no `updatedAt`.
3. **Images.** New or replaced files go in `public/images/blog/<slug>/`,
   named and optimised as `content/blog/_template.md` and
   the package's `scripts/README.md` say (`pnpm kit optimize-webp`); delete what
   the edit left behind (the lint's `image-orphan` rule names it).
4. **Lint until clean.** `pnpm content:lint`: fix every `FAIL`; the `WARN`
   lines on this file are the ones to read.
5. **Verify** (below); `pnpm kit parity` is not for a content edit (the
   page is supposed to change), but read `check-seo`'s lines for the route
   in the build log.
6. **Commit** `Post: <slug>: <what changed>` on the repo's working branch.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # 0 failures; read every WARN
pnpm preview                                                # open <postPrefix>/<slug>; then stop it
git push                                                    # when the user says
```

## Stop for the user

A change to the title, the category or the FAQ heading (each has an SEO
consequence); any request to rename the file (an indexed URL needs a
redirect on the host: stop unless the repo documents one); the push.
