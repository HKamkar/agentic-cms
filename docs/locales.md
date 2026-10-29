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
