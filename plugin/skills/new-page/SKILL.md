---
name: new-page
description: Add a site page as content/pages/<slug>.yaml made of existing section types, with its SEO block, structured data and OG image, or write the real copy of a page that still holds placeholder copy, then prove it with the lint, the build and a visual capture. Use when asked to add, create or scaffold a page, a landing page or a route on the site, or to write or replace a page's placeholder copy (a site's starter home page and blog index).
argument-hint: <slug> [what the page is for]
---

# New page

The repo is the current directory. A page is a file:
`content/pages/<slug>.yaml` with its `seo` block (the route, permanent
once pushed), its `jsonld` block and its sections in order, rendered
through the section registry. A page made of existing section types
needs no code. A page that exists with placeholder copy — a site laid out
by `agentic-cms init` starts with its home page and its blog index so,
each string starting with the marker `(placeholder)` and saying what goes
there — is written here too: the file stays, its copy becomes the site's.

## Read first

`content/README.md` "Add a page", `content/_templates/page.yaml`,
`content/README.md` § Fields › `pages` (every section type and its fields),
one existing file in `content/pages/` as a worked example,
`src/lib/seo/README.md` (the head, the structured data, the OG image; the
engine's docs, under `node_modules/agentic-cms/` on a site that
installs the package),
`content/VOICE.md`, `src/config/site.ts`.

## Steps

1. **The route and the sections.** Confirm `seo.path` with the user and list
   the sections by type, chosen from the registry tables only. A section
   type that does not exist is code (a schema, a component, a registry
   entry; the repo's design document says how): stop and say so.
2. **The file.** For a page with placeholder copy, keep its file, its
   route and its sections unless the user changes them, and replace every
   string that starts with `(placeholder)` with the site's own copy — the
   marker goes with the string it replaces, never left in front of real
   copy — and every address on a domain reserved for examples (`.example`)
   with the site's own; then, on the user's word, the placeholder lines of
   `src/config/site.ts` (the tagline, the description, the address, the
   sign-in link, the profiles). Real copy comes from the user or the brief,
   never invented: a figure, a name or an address the user has not given
   stays a question. A new page: copy the template to
   `content/pages/<slug>.yaml`. `seo`:
   `title` of 60 characters or fewer and unique across pages, `description`
   of 70–160, `ogImage`, `updated` today (quoted), `breadcrumb`; `jsonld` by
   page type; sections with real copy under `content/VOICE.md` (the brand
   as it spells it; eyebrows as the existing pages carry them). Card
   counts are part of the design where the build says "must have exactly
   N".
3. **The images.** The OG image as the engine's `src/lib/seo/README.md` specifies it
   (`public/images/<slug>-og.jpg`, 1200×630); section images and icons
   under `public/images/<slug>/`, optimised (`pnpm kit optimize-webp`; the
   package's `scripts/README.md`), each
   with an alt that says what it shows.
4. **The chrome.** Only if the page belongs there: add it to `links`, `nav`
   and `footer.quickLinks` in `src/config/site.ts` (three separate lists).
5. **Lint until clean.** `pnpm content:lint`: fix every `FAIL`; read the
   `WARN` lines on the new file; no `placeholder` line left on it (a
   production build fails while one remains).
6. **Verify** (below), then look at the page at every width: `pnpm kit
   visual-parity capture <slug>-new --pages /<slug>` and open its shots,
   one per width of the site's profile, in `.parity/visual/<slug>-new/` (a
   new page has no baseline; this
   is inspection). If `site.ts` changed, `pnpm kit parity` before and after
   must differ only in the nav and footer of the other pages.
7. **Commit** `Page: /<slug>` on the repo's working branch.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # 0 failures; the SEO audit covers the new route
pnpm preview                                                # pnpm start where the site has none; open /<slug>; then stop it
git push                                                    # when the user says
```

## Stop for the user

The route and the section list (step 1); copy the user has not given (a
figure, a name, an address); any change to `src/config/site.ts`; the push.
