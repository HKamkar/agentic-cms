---
name: new-page
description: Add a site page as content/pages/<slug>.yaml made of existing section types, with its SEO block, structured data and OG image, then prove it with the lint, the build and a visual capture. Use when asked to add, create or scaffold a page, a landing page or a route on the site.
argument-hint: <slug> [what the page is for]
---

# New page

The repo is the current directory. A page is a file:
`content/pages/<slug>.yaml` with its `seo` block (the route, permanent
once pushed), its `jsonld` block and its sections in order, rendered
through the section registry. A page made of existing section types
needs no code.

## Read first

`content/README.md` "Add a page", `content/_templates/page.yaml`,
`src/lib/content/README.md` § pages (every section type and its fields),
one existing file in `content/pages/` as a worked example,
`src/lib/seo/README.md` (the head, the structured data, the OG image),
`content/VOICE.md`, `src/config/site.ts`.

## Steps

1. **The route and the sections.** Confirm `seo.path` with the user and list
   the sections by type, chosen from the registry tables only. A section
   type that does not exist is code (a schema, a component, a registry
   entry; the repo's design document says how): stop and say so.
2. **The file.** Copy the template to `content/pages/<slug>.yaml`. `seo`:
   `title` of 60 characters or fewer and unique across pages, `description`
   of 70–160, `ogImage`, `updated` today (quoted), `breadcrumb`; `jsonld` by
   page type; sections with real copy under `content/VOICE.md` (the brand
   as it spells it; eyebrows as the existing pages carry them). Card
   counts are part of the design where the build says "must have exactly
   N".
3. **The images.** The OG image as `src/lib/seo/README.md` specifies it
   (`public/images/<slug>-og.jpg`, 1200×630); section images and icons
   under `public/images/<slug>/`, optimised (`scripts/README.md`), each
   with an alt that says what it shows.
4. **The chrome.** Only if the page belongs there: add it to `links`, `nav`
   and `footer.quickLinks` in `src/config/site.ts` (three separate lists).
5. **Lint until clean.** `pnpm content:lint`: fix every `FAIL`; read the
   `WARN` lines on the new file.
6. **Verify** (below), then look at the page at every width: `node
   scripts/visual-parity.mjs capture <slug>-new --pages /<slug>` and open
   the eight shots in `.parity/visual/<slug>-new/` (a new page has no
   baseline; this is inspection). If `site.ts` changed, `scripts/parity.sh`
   before and after must differ only in the nav and footer of the other
   pages.
7. **Commit** `Page: /<slug>` on the repo's working branch.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # 0 failures; the SEO audit covers the new route
pnpm preview                                                # open /<slug>; then stop it
git push                                                    # when the user says
```

## Stop for the user

The route and the section list (step 1); any change to `src/config/site.ts`;
the push.
