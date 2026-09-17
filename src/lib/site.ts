// What the engine knows about the site, and nothing more: the brand, the
// origin, the address, the prefix of the post URLs, and the lists the
// structured data, the feed and the harness read. A site declares it once
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
  readonly tagline: string;
  /** The feed's description. */
  readonly description: string;
  readonly email: string;
  /** The brand mark, a path under public/. */
  readonly logo: string;
  readonly address: readonly string[];
  /** The URL prefix of a post, "/blog-post"; the route folder under src/app follows it. */
  readonly postPrefix: string;
  /** Site-relative; `blog` is the index the sitemap and the feed name. */
  readonly links: { readonly home: string; readonly blog: string; readonly contact: string; readonly [key: string]: string };
  readonly nav: readonly SiteLink[];
  readonly signIn: SiteLink;
  readonly cta: SiteLink;
  readonly footer: { readonly quickLinks: readonly SiteLink[]; readonly social: readonly SiteLink[] };
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
