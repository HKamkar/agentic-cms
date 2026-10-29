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

## The voice and the lint

Each language has its voice block, `content/VOICE.<prefix>.md`:
`VOICE.md`'s prose and its fenced block written for the language — the
banned words and patterns, the claim words and their subject, the model
and cloud rules — in its words. `agentic-cms lint` fails a declared
language without one and lints each translation with its language's block
and every rule that is not a voice rule (the SEO lengths, the dates, the
alt pairs, the pictures, a post's structure, the placeholders). The
alt-weak heuristic reads English, so it holds the default language's
files alone. The lint also holds the redirects against every language's
pages and posts, fails a page file out of place as the engine does, and
warns on a translation into a language `site.locales` does not declare
(a folder or a file nothing reads).

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

The sitemap lists every language's pages, and each entry of a page in
several languages carries the same alternates as its head
(`<xhtml:link rel="alternate" hreflang="…">`).

No page redirects by the visitor's language, and nothing reads
`Accept-Language`: every URL answers with the page it names, and search
engines pick the version for a reader from the alternates.

## What the build checks

`agentic-cms seo`, the last step of `pnpm build`, holds each page's
languages from the build alone (`scripts/lib/hreflang.mjs`): a page's
versions are the built routes at its path in each language. In a site
with languages it fails a page whose `lang` or `og:locale` is not its
language's, or whose head lacks `og:site_name` or the feed link (a site in
one language gets these as warnings: a head written by hand passed without
them before 0.9.0); a page built in
more than one language whose hreflang alternates miss a version, the page
itself or `x-default`, name one twice, point at another URL than the
version's, at a tag the site has not or at a version that is not built,
or are not named back by the version they name; a page built in one
language that names any; and a sitemap entry whose alternates are not its
page's.
