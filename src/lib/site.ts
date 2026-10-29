// What the engine knows about the site, and nothing more: the brand, the
// origin, the address, the prefix of the post URLs, the lists the
// structured data, the feed and the harness read, and the languages it
// serves besides its default one. A site declares it once
// (src/config/site.ts: data, `as const satisfies SiteConfig`) and hands it
// to createKit(); no module of the engine imports it.

export type SiteLink = { readonly label: string; readonly href: string };

export type SiteConfig = {
  /** The brand as it reads in titles and structured data, with its mark if it has one. */
  readonly name: string;
  /** The brand without its mark: the ItemList's items, the contact page's organisation. */
  readonly shortName: string;
  /** The origin without a trailing slash: canonicals, the sitemap, the feed. */
  readonly url: string;
  /** The `lang` of the page and the feed's language. */
  readonly locale: string;
  /** The Open Graph locale, language_TERRITORY (`en_US`): every page's og:locale, from the root layout's and the kit's page and post heads; left out, none. */
  readonly ogLocale?: string;
  readonly tagline: string;
  /** The feed's description. */
  readonly description: string;
  /** The site's e-mail address: the footer's link, a form's recipient, and — unless `guardEmail` is on — the `email` of the structured data. */
  readonly email?: string;
  /**
   * Whether the address stays out of every served file (docs/email.md).
   * `true`: no structured data carries it as text (a ContactPoint with the
   * contact page's URL takes its place) and the build runs `agentic-cms
   * guard-email`; what `agentic-cms init` writes for a new site.
   * `{ off: "<why>" }`: the address public on purpose, an exception
   * `agentic-cms check-site` prints with its reason. Left out, as before
   * 0.8.2: the address in the structured data, and no guard asked for.
   */
  readonly guardEmail?: true | { readonly off: string };
  /** The brand mark, a path under public/. */
  readonly logo: string;
  readonly address: readonly string[];
  /** The URL prefix of a post, "/blog-post"; the route folder under src/app follows it. */
  readonly postPrefix: string;
  /** The heading that starts a post's FAQ, its accordion and its FAQPage (`## Frequently asked questions`): an H2 whose text contains it; left out, one that says "frequently asked" or "faq". */
  readonly faqHeading?: string;
  /** Site-relative; `blog` is the index the sitemap and the feed name. */
  readonly links: { readonly home: string; readonly blog: string; readonly contact: string; readonly [key: string]: string };
  readonly nav: readonly SiteLink[];
  readonly signIn: SiteLink;
  readonly cta: SiteLink;
  readonly footer: { readonly quickLinks: readonly SiteLink[]; readonly social: readonly SiteLink[] };
  /**
   * The languages the site serves besides its default one (`locale`), each
   * under its prefix with the default's slugs (docs/locales.md);
   * experimental. Left out, the site has one language, as before.
   */
  readonly locales?: readonly SiteLocale[];
};

/**
 * A language the site serves besides its default one: its pages under
 * /<prefix>/ with the default's slugs (/about → /de/about), its content
 * beside the default's, its copy of the config's words and links here.
 */
export type SiteLocale = {
  /** The language tag, BCP 47 (`de`, `pt-BR`): the pages' `lang`, their hreflang and the feed's language. */
  readonly locale: string;
  /** The first segment of every URL in the language, a lowercase tag (`de`, `pt-br`): /de, /de/about. */
  readonly prefix: string;
  /** The Open Graph locale, language_TERRITORY (`de_DE`): the og:locale of every page in the language. */
  readonly ogLocale: string;
  /** The site's tagline in the language. */
  readonly tagline: string;
  /** The feed's description in the language. */
  readonly description: string;
  /** The site's links in the language, under its prefix (`/de/blog`). */
  readonly links: SiteConfig["links"];
  readonly nav: readonly SiteLink[];
  readonly signIn: SiteLink;
  readonly cta: SiteLink;
  readonly footer: SiteConfig["footer"];
  /** The heading that starts a post's FAQ in the language (`Häufige Fragen`): an H2 whose text contains it; left out, the default language's. */
  readonly faqHeading?: string;
};

/** The two URL helpers everything that links to a page or a post uses. */
export function createUrls(site: SiteConfig) {
  return {
    /** The site-relative URL of a post. */
    postUrl: (slug: string) => `${site.postPrefix}/${slug}`,
    /** A site-relative path as an absolute URL on the site's origin. */
    absoluteUrl: (path: string) => new URL(path, site.url).toString(),
  };
}

export type Urls = ReturnType<typeof createUrls>;
