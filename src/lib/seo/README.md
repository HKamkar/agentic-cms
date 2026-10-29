# SEO contract

Every page and post ships with a complete, correct search and social surface,
and the build proves it. SEO is a layer of the content engine
(`agentic-cms/seo`, `kit.seo`) and one of the engines a site must use
(`docs/parts.md`). This document is the contract; the enforcement is the
types in `types.ts`, the helpers in `metadata.ts` / `jsonld.ts`,
`agentic-cms/head` in `pnpm lint` (a head of the site's own), the content
lint's `seo-title` and `seo-description` at the source, and
`agentic-cms seo`, which `pnpm build` runs after `next build` and which
fails the build (and therefore `pnpm preview` and `pnpm run deploy`) on a
structural problem.

## Rules that must not break

1. **A page is a file, `content/pages/<slug>.yaml`**, validated by the
   content engine (`pageSchema` in `src/lib/content/collections.ts`). Its
   `seo` block declares `path`, `title`, `description`, `ogImage`,
   `updated`, `breadcrumb`, `changeFrequency`, `priority` (`PageSeo`); a
   field missing or wrong fails the build with the file and the field
   named. Its `jsonld` block declares the copy of its structured data; its
   `sections` list is what it shows (`src/components/sections/`).
2. **`src/app/[[...slug]]/page.tsx` renders every page file** — the head
   from `kit.seo.pageMetadata(page.seo)`, nothing hand-written: that is
   the exact title, the description, the canonical, Open Graph with the
   1200×630 image, the Twitter card. Posts get `kit.seo.postMetadata(post)`
   from the post page; the root layout's `metadata` is
   `kit.seo.rootMetadata()` (the origin, the title template with the home
   page's title, its description, Open Graph's name and `site.ogLocale`,
   the feed); a design round's or the lab's route is
   `kit.seo.unlistedMetadata()` (`noindex`). Never build these by hand:
   `pnpm lint` fails any other `metadata` or `generateMetadata`, and a
   `<head>`, `<title>`, `<meta>`, canonical `<link>` or JSON-LD `<script>`
   of the site's own (`agentic-cms/head`, `docs/primitives.md` §
   Enforced). `kit.seo` is `createSeo({ site, urls, content, blog })`,
   composed once by `createKit()` in the site's `src/kit.ts`; nothing here
   imports the site.
3. **Structured data**: the same route emits `kit.seo.pageBreadcrumb(page.seo)`
   for every inner page (posts `postBreadcrumb(post)`) and the page-type
   block from `pageJsonLd(page)` (`WebPage`, `AboutPage`, `ContactPage`,
   `Blog`; posts `BlogPosting`, `FAQPage`) through `<JsonLd>`. Organisation
   blocks come from `organizationLd()`; the FAQPage and ItemList parts come
   from the page's own `faq` / `use-case-cards` sections and their
   collections (the engine reads a `faq` section's `set`, a `group`'s
   `sections`, and looks for `use-case-cards` by type; every other section
   is the site's).
   A `WebPage` describes software only when its block carries an
   `application`: a notice or a policy declares `type: WebPage` and nothing
   else, and the block is then the page itself (name, description, url,
   language) beside the breadcrumb the route already emits.
   Mark up only what is on the page; never reviews, ratings or offers that
   are not real, and no ratings of the brand by the brand (Google ignores
   self-serving ones).
   The organisation's address follows `site.guardEmail`
   (`docs/email.md`). Without the key, or with `{ off: "<why>" }`, every
   Organization block — `organizationLd()` (the provider, the publisher of
   a page and of the Blog), the AboutPage's `about`, the ContactPage's
   organisation — carries `site.email` as `email`, and a ContactPage's
   contact point its contact's `email`:

   ```json
   { "@type": "Organization", "name": "My Site", "logo": { … }, "email": "hello@my-site.com", "sameAs": [ … ] }
   ```

   With `guardEmail: true` no block carries an address as text: in
   `organizationLd()` and the AboutPage's `about` a `ContactPoint` with the
   contact page's URL (`site.links.contact`) takes the `email`'s place; a
   ContactPage's organisation drops its `email`, and every one of its
   contact points carries that page's `url`, a contact's own `email` left
   out:

   ```json
   { "@type": "Organization", "name": "My Site", "logo": { … }, "contactPoint": { "@type": "ContactPoint", "url": "https://my-site.com/#contact-form" }, "sameAs": [ … ] }
   ```

   A site without `site.email` gets neither. Google needs no e-mail for any
   rich result. With the key on, the build ends with `agentic-cms
   guard-email`, which fails a served file that still carries the address.
4. **The sitemap follows from the page files and the published posts**;
   nothing is added by hand. `updated` is the page's last-modified date —
   bump it when the content changes, not on refactors.
5. **URLs are permanent.** A public URL never changes without a redirect, an
   entry of `content/redirects.yaml` that `next.config.ts` serves
   (`docs/redirects.md`); a new page's `path` is lowercase, hyphenated,
   without a trailing slash.
6. **`pnpm build` must pass** with zero `FAIL` lines from `check-seo`; read
   every `WARN` and fix what you can. Do not weaken a rule to get a build
   through; fix the page.

## What the audit checks, per prerendered page

| Rule | Fails | Warns |
|---|---|---|
| title | missing, empty, duplicated on another page, > 70 characters | > 60 |
| description | missing, empty, duplicated, < 50 or > 200 characters | < 70 or > 160 |
| canonical | missing, not `site.url` + the route, trailing slash, more than one | |
| Open Graph | `og:title` / `og:description` / `og:url` / `og:image` / `og:type` missing; `og:url` ≠ canonical; the image file missing under `public/`, narrower than 1200 px, or with a ratio outside 1.6–2.0 | |
| Twitter | `twitter:card` missing | |
| headings | not exactly one `<h1>`; an `<h3>` before any `<h2>` | |
| images | an `<img>` without `alt` (empty is fine for decoration) or without `width`/`height` | |
| html | no `lang` | |
| JSON-LD | a block that does not parse, no `@context`, a relative `url`/`item`/`sameAs`, an inner page without `BreadcrumbList`, a post without `BlogPosting` (headline, datePublished, author, publisher, image) | |
| robots | an indexable page with `noindex`; the 404 without it; in a preview build (`AGENTIC_CMS_PREVIEW=1`, `docs/preview.md`), a page without `noindex` and a `robots.txt` that does not disallow everything | |
| sitemap | an indexable route missing, listed twice, or a URL with no built page; a URL `content/redirects.yaml` redirects; `lastmod` invalid or in the future; `robots.txt` without the sitemap | |
| links | an internal `href` that matches no page and no file in `public/` | |

`pnpm kit seo --strict` turns warnings into failures;
`--report` also writes `.parity/seo-report.txt`.

## Writing the fields

- **Title**: the page's topic first, the brand last; 60 characters or
  fewer. A page file's `seo.title` is used exactly (`title: { absolute }`); a
  post without a `seoTitle` gets `title | <site.name>` from the layout
  template. Every page a different title.
- **Description**: one sentence, 70–160 characters, saying what the reader
  gets on this page; no quotation marks, no keyword lists.
- **`<h1>`**: exactly one, the page's topic in plain words; `<h2>` for the
  sections in order, `<h3>` inside them. The audit fails an `<h3>` before the
  first `<h2>`, so a section that opens with cards and no heading of its own
  gives those cards `<h2>`.
- **`alt`**: what an informative image shows, in a sentence; empty for
  decorative images (glows, shapes, portraits used as ornament). Never the
  file name, never "image of".
- **Open Graph image**: `public/images/<path-with-hyphens>-og.jpg`
  (`/sections/about` → `sections-about-og.jpg`), 1200×630 JPEG, carrying the
  brand mark and the page's message; `pnpm kit placeholder
  public/images/<name>-og.jpg 1200 630` writes a wireframe stand-in. A post's
  defaults to its hero (1600×900).
- **Internal links**: descriptive link text (what the reader will find),
  site-relative paths, and only to pages that exist.
- **Structured data**: the page-type block describes the page; keep names,
  descriptions and dates in sync with the visible content.

## Files

| File | Role |
|---|---|
| `src/lib/seo/index.ts` | `createSeo({ site, urls, content, blog })`: everything below, composed for one site (`kit.seo`) |
| `src/lib/seo/types.ts` | `PageSeo` (the `seo` block's type, from the schema) |
| `src/lib/seo/metadata.ts` | `pageMetadata()` and `unlistedMetadata()` (need no site), `createMetadata(urls)` → `postMetadata()`, `createRootMetadata(site, home)` → `rootMetadata()` |
| `src/lib/seo/jsonld.ts` | `createJsonLd({ site, urls, content })` → `organizationLd()`, `breadcrumbLd()`, `pageBreadcrumb()`, `postBreadcrumb()` |
| `src/lib/seo/pageJsonLd.ts` | `createPageJsonLd(…)` → `pageJsonLd()`: the page-type block from a page file's `jsonld` block and its sections |
| `src/lib/seo/postJsonLd.ts` | `createPostJsonLd(…)` → `postJsonLd()` (the BlogPosting), `postFaqJsonLd()` (the FAQPage from the body's questions, or null) |
| `src/lib/seo/routes.ts` | `createRoutes(…)` → `sitemap()`, `feed()` (a Response), `robots()`: what `src/app/sitemap.ts`, `src/app/feed.xml/route.ts` and `src/app/robots.ts` return |
| `src/lib/site.ts` | `SiteConfig`, what the engine reads of `src/config/site.ts`; `createUrls(site)` → `postUrl()`, `absoluteUrl()` (`kit.urls`) |
| `content/pages/*.yaml` | the pages: `seo`, `jsonld`, `sections` (`content/README.md`, template `content/_templates/page.yaml`) |
| `src/app/[[...slug]]/page.tsx` | the route that renders every page file |
| `src/app/sitemap.ts`, `src/app/robots.ts` | built from the page files and the posts |
| `src/lib/blog/rehype-post-images.ts` | post images get `width`/`height` and `loading="lazy"` |
| `agentic-cms seo` | the audit, run by `pnpm build` |

## Recipes

**Add a page.** Copy `content/_templates/page.yaml` to
`content/pages/<slug>.yaml`: the `seo` block (its `path` is the route),
the `jsonld` block for its page type, its sections from the section
types tabled in `src/lib/content/README.md`; add the OG image; add the
page to `nav`, `links` and `footer.quickLinks` in `src/config/site.ts` if
it belongs there; `pnpm build`. No code for a page made of existing
sections; a new section type is a schema in
`src/components/sections/schemas.ts`, a component, and a registry entry
in `src/components/sections/render.tsx`.

**Change a page's copy.** Edit the page file, bump `seo.updated`, `pnpm build`.

**Add a post.** `content/blog/_template.md`; the post pipeline validates the
frontmatter and the audit checks the rendered post.
