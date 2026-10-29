# A site in several languages

A site has one default language at its root and may serve others, each
under its own prefix with the same slugs: `/about` in the default language
is `/de/about` in German. Every page is prerendered in every language it
exists in, and nothing reads the visitor's browser language: a reader
lands on the URL a link or a search result gave them, and a page names its
other versions for search engines. Experimental
([stability.md](stability.md)): its names and its layout may change in
any release.

A site without `site.locales` has one language and behaves as it always
did.

## The config

The default language is `site.locale` and `site.ogLocale`, as before. Each
other language is an entry of `site.locales` in `src/config/site.ts`,
which carries its tag, its prefix, its Open Graph locale and its copy of
the config's words and links (`SiteLocale`):

```ts
locales: [
  {
    locale: "de",                 // the language tag: lang, hreflang, the feed's language
    prefix: "de",                 // every URL in the language starts with /de
    ogLocale: "de_DE",
    tagline: "…",                 // the config's words, in the language
    description: "…",
    links: { home: "/de", blog: "/de/blog", contact: "/de#contact-form" },
    nav: [{ label: "Startseite", href: "/de" }, …],
    signIn: { label: "Anmelden", href: "https://app.my-site.example" },
    cta: { label: "Kontakt", href: "/de#contact-form" },
    footer: { quickLinks: […], social: […] },
  },
],
```

`createKit()` checks each entry when the kit is made and throws, naming
the entry and the field, on a missing tag or Open Graph locale, the
default language listed again, a tag or a prefix listed twice, and a
prefix that is not a lowercase language tag (`de`, `pt-br`) or is a route
of the site's own (`api`, the first segment of `postPrefix`).

## The chrome's words

The chrome's words — the skip link, the navbar's and the theme switch's
labels, the footer's titles, the 404, the post template — and the consent
banner's are `chrome` and `consentBanner` in `src/config/site.ts`, the
default language's. Each other language adds its block to `copy` in the
same file, keyed by its tag, its 404's links under its own prefix:

```ts
const copy: Record<string, { chrome: ChromeWords; consentBanner: ConsentWords }> = {
  [site.locale]: { chrome, consentBanner },
  de: { chrome: { skipLink: "Zum Inhalt", … }, consentBanner: { title: "Analyse-Cookies", … } },
};
```

`copyFor(tag)` is what the layout, the footer, the 404 and the post
template read, and it fails the build for a language with no block. The
document every page is, `ui/SiteLayout` — `<html lang>`, the scripts, the
header, the footer — takes the language's config (`kit.locales.site(tag)`)
and its words, so each language's root layout is one line. A section that
links to another page of the site takes the link from the registry in the
page's language (`ctaHref`), never from `src/config/site.ts`, and a
section that shows a collection reads the language's translation of it.

## The content

A translation sits beside the default's file and pairs with it by slug.
Nothing is filled from the default language: a translation a page reads
and nobody wrote fails the build, naming the file it looked for.

| The default's | Its translation into `de` |
|---|---|
| a folder's file, `content/pages/about.yaml`, `content/faqs/about.yaml`, `content/blog/<slug>.md` | the same name under the prefix: `content/pages/de/about.yaml`, `content/faqs/de/about.yaml`, `content/blog/de/<slug>.md` |
| a file, `content/reviews.yaml`, `content/use-cases.yaml`, `content/authors.json`, `content/categories.json` | the prefix before the extension: `content/reviews.de.yaml`, `content/authors.de.json` |
| `content/redirects.yaml` | none: one list for every language, its paths with their prefix |

A page in another language translates the default page of its file name
and sits at that page's path under the prefix: `content/pages/de/about.yaml`
says `path: /de/about` when `content/pages/about.yaml` says `/about`, and
`/de` for the home page. Each has its own `seo` block, in the language:
its title, description, Open Graph image and breadcrumb name. The engine
fails a page in another language with no default page of its name, one at
another path, and a default page under a language's prefix. A default
page with no translation is simply absent from that language.

A post in another language is `content/blog/<prefix>/<slug>.md`, with the
default post's slug; its author and its category are read from the
language's registries, `content/authors.<prefix>.json` and
`content/categories.<prefix>.json`, keyed as the default's are.

## Reading it

`kit.locales` is the site's languages: `all` (the default one first, its
prefix `""`), `default`, `get(tag)`, `of(path)` (the language of a path),
`path(tag, path)` (a default path in the language: `/about` →
`/de/about`), `unprefixed(path)`, `site(tag)` (the config as the language
reads it: its words and links in place of the default's) and
`collection(def, tag)` (a collection's translation).

`kit.content` and `kit.blog` read the default language, as before;
`kit.content.in(tag)` and `kit.blog.in(tag)` read another one, with the
same accessors.

## The routes

`<html lang>` is set where the document is: in a root layout. A site in
one language has one, `src/app/layout.tsx`. A site in several has one per
language, each prerendering its pages with its language's `lang`, so
nothing is decided at request time: the default language's tree moves
into a route group, which changes no URL, and each other language has a
folder named its prefix.

```text
src/app/
  (default)/layout.tsx              the default language's root layout
  (default)/[[...slug]]/page.tsx    its pages
  (default)/blog-post/[slug]/       its posts
  (default)/not-found.tsx           what notFound() renders there
  de/layout.tsx                     the German root layout: LOCALE = "de"
  de/[[...slug]]/page.tsx           the German pages: LOCALE = "de"
  de/blog-post/[slug]/page.tsx      the German posts: LOCALE = "de"
  de/feed.xml/route.ts              the German feed: LOCALE = "de"
  global-not-found.tsx              the 404 of a path no page answers
  globals.css, robots.ts, sitemap.ts, feed.xml/, api/, icon.png
```

A language's layout and catch-all are copies of the default's with
`LOCALE` set to its tag: the layout renders `SiteLayout` with the
language's config and words and takes `kit.seo.rootMetadata(LOCALE)`; the
catch-all builds the language's pages (`kit.content.in(LOCALE)`), each at
its path under the prefix, and renders their sections in the language. The
placement guard (`check-site`) holds a language's copy of a route as the
route itself, and a route group as the app folder; a language
`site.locales` does not declare is no language to it.

With no root layout at `src/app`, a path no page answers needs a document
of its own: `src/app/global-not-found.tsx`, in the default language, which
`next.config.ts` turns on with `experimental: { globalNotFound: true }`.
A page that calls `notFound()` still renders its tree's `not-found.tsx`.

<!-- locales: src/app/global-not-found.tsx -->
```tsx
// The 404 of a site in several languages (docs/locales.md): with a root
// layout per language, none at src/app wraps a not-found page, so a path no
// page answers gets this whole document, in the default language.
// next.config.ts turns it on: experimental: { globalNotFound: true }.
import type { Viewport } from "next";
import { SiteLayout } from "@/components/ui/SiteLayout";
import { copyFor, site } from "@/config/site";
import { kit } from "@/kit";
import NotFound from "./(default)/not-found";
import "./globals.css";

export const metadata = kit.seo.rootMetadata();

export const viewport: Viewport = { colorScheme: "light dark" };

export default function GlobalNotFound() {
  return (
    <SiteLayout site={kit.locales.site(site.locale)} words={copyFor(site.locale)}>
      <NotFound />
    </SiteLayout>
  );
}
```

A design round's route and the lab's go into the default language's route
group (`demo new`, `lab route`), so they render inside the site's document
at the same URL.

## Adding a language

1. Its entry in `site.locales` and its block in `copy`, both in
   `src/config/site.ts` (above).
2. Its pages, each the translation of a default page: `content/pages/<prefix>/<slug>.yaml`,
   with its `seo` block in the language and its path under the prefix
   (`/editorial:translate` drafts one); its voice block,
   `content/VOICE.<prefix>.md`; the translation of each collection a page
   of it reads (a FAQ set, the reviews, the use cases).
3. A form's words are its definition's in `src/config/forms.ts`: a page in
   the language names a definition written in it (`form: contact-de`).
4. The first language added moves the default language's routes into
   `src/app/(default)/` (its layout's stylesheet import becomes
   `../globals.css`), adds `src/app/global-not-found.tsx` and
   `experimental: { globalNotFound: true }` in `next.config.ts`; each
   language then copies the layout and the catch-all into
   `src/app/<prefix>/` with `LOCALE` its tag, and a language with posts
   the post template and the feed too.
5. `pnpm build`: the content lint, the build and the SEO audit hold every
   step above.

## Posts

A post in another language is `content/blog/<prefix>/<slug>.md`, served
at `/<prefix>/blog-post/<slug>`. It pairs with the default language's post
of its slug, when there is one: their heads and their sitemap entries name
each other. A post with no translation is simply absent from the
language. Its frontmatter is the default's schema: its `author` and its
`category` are keys of the language's registries,
`content/authors.<prefix>.json` and `content/categories.<prefix>.json`
(and of the default's), and its `related` names default posts' slugs, of
which the language shows the ones it has. Its pictures are the default's,
under `public/images/blog/<slug>/`; its alt texts are its own.

`kit.blog.in(tag)` reads a language's posts: each carries `locale`, so the
card links under the prefix (`kit.urls.postUrl(slug, locale)`) and dates
in the language (`formatDate(date, locale)`), and `kit.seo`'s post
builders write its head, breadcrumb and structured data in it. The FAQ
starts at the language's heading: `faqHeading` in its `site.locales`
entry (`Häufige Fragen`), which the accordion, the FAQPage and the lint
read.

A language with posts has its blog page, `content/pages/<prefix>/blog.yaml`,
and two more routes: the post template and the feed, copies of the
default's with `LOCALE` its tag, in `src/app/<prefix>/blog-post/[slug]/`
and `src/app/<prefix>/feed.xml/`. Its pages then link to its feed. A
language whose blog page or posts folder is missing fails the build where
it reads them (its index, its feed); the sitemap lists the posts each
language has.

## Translating

A translation is drafted by an agent and checked by a native speaker of
the language before it ships. `/editorial:translate` (the `editorial`
plugin) drafts a page, a post or a collection beside its original, with
its `seo` block written for the language's readers, lints it, and lists
what the native speaker reads first: the headings and the calls to
action, every claim and figure, the idioms, the terms the language's
other pages translate differently. A post stays `draft: true` until then;
a page is committed on the user's word that someone checked it.

A legal text — a privacy policy, terms, an imprint — is translated, never
rewritten: sentence by sentence, its structure and its defined terms
kept, nothing added or left out, no obligation changed, every term with
no settled equivalent listed for the native speaker and a lawyer for the
language's market.

When an original changes, its translations fall behind: the lint's
`translation-stale` warns on a page whose original's `updated`, or a post
whose original's last date, is later than its own, and
`/editorial:translate` brings it up to date from what changed.

## The voice and the lint

Each language has its voice block, `content/VOICE.<prefix>.md`:
`VOICE.md`'s prose and its fenced block written for the language — the
banned words and patterns, the claim words and their subject, the model
and cloud rules — in its words. `agentic-cms lint` fails a declared
language without one and lints each translation with its language's block
and every rule that is not a voice rule (the SEO lengths, the dates, the
alt pairs, the pictures, a post's structure under the language's FAQ
heading, the placeholders), and warns on a translation older than its
original (`translation-stale`). The alt-weak heuristic reads English, so
it holds the default language's files alone. The lint also holds the
redirects against every language's pages and posts, fails a page file out
of place as the engine does, and warns on a translation into a language
`site.locales` does not declare (a folder or a file nothing reads).

`agentic-cms check` reads each translation on disk and where each
language's page files sit; `agentic-cms schema --lines` opens a translated
YAML file with its collection's schema line (`../../_schemas/pages.json`
from `content/pages/de/`); the site check's retired pass warns on a page
or a post of any language whose URL went without a redirect.

## The head and the sitemap

`kit.seo` finds a page's language from its path, so a route calls the
same builders in every language. `pageMetadata(page.seo)` is the page's
head in its language: its `og:locale` is the language's `ogLocale`, and a
page that exists in more than one language names each version as an
hreflang alternate — itself among them — with `x-default` for the default
language's version, and lists the other versions' Open Graph locales
(`og:locale:alternate`). A page in one language names none, which is why a
site without locales writes the head it always did. `pageBreadcrumb()`
starts at the language's home page, `pageJsonLd()` says the language in
`inLanguage`, and `rootMetadata(tag)` is a language's root layout head:
its home page's title and description, its `og:locale`.

The sitemap lists every language's pages and posts, and each entry of
one in several languages carries the same alternates as its head
(`<xhtml:link rel="alternate" hreflang="…">`).

No page redirects by the visitor's language, and nothing reads
`Accept-Language`: every URL answers with the page it names, and search
engines pick the version for a reader from the alternates.

## What the build checks

`agentic-cms seo`, the last step of `pnpm build`, holds each page's
languages from the build alone (`scripts/lib/hreflang.mjs`): a page's
versions are the built routes at its path in each language. In a site with
languages it fails a page whose `lang` or `og:locale` is not its
language's, or whose head lacks `og:site_name` or the feed link (a site in
one language gets these as warnings: a head written by hand passed without
them before 0.9.0); a page built in more than one language whose hreflang
alternates miss a version, the page itself or `x-default`, name one twice,
point at another URL than the version's, at a tag the site has not or at a
version that is not built, or are not named back by the version they name;
a page built in one language that names any; and a sitemap entry whose
alternates are not its page's.
