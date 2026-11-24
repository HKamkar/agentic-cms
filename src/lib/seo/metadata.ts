import type { Metadata } from "next";
import { isPreview } from "../preview.ts";
import type { Post } from "../blog/posts.ts";
import type { SiteConfig, Urls } from "../site.ts";
import type { PageSeo } from "./types.ts";

/**
 * A page's own head from its seo block: exact title, description,
 * canonical, Open Graph with the 1200×630 image, Twitter card. It needs no
 * site, so it carries none of the site's parts: the route returns
 * `kit.seo.pageMetadata(page.seo)`, which adds them (`withSiteHead()`), from
 * generateMetadata and nothing else; the layout's metadataBase makes the
 * paths absolute.
 */
export function pageMetadata(seo: PageSeo): Metadata {
  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: { canonical: seo.path },
    openGraph: {
      type: "website",
      title: seo.title,
      description: seo.description,
      url: seo.path,
      images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, images: [seo.ogImage] },
  };
}

/**
 * The head of a route no search engine lists — a design round's, a
 * showcase, the lab's: `noindex`, and nothing else of its own (the root
 * layout's template still names it).
 */
export function unlistedMetadata(): Metadata {
  return { robots: { index: false } };
}

/**
 * What every page's head shares with the root layout's: Open Graph's site
 * name and locale, and the link to the feed — `feed`, the language's own
 * (/de/feed.xml) in a language with posts, else the site's.
 */
function siteHead(site: SiteConfig, feed = "/feed.xml") {
  return {
    openGraph: { siteName: site.name, ...(site.ogLocale ? { locale: site.ogLocale } : {}) },
    alternates: { types: { "application/rss+xml": `${site.url}${feed}` } },
  };
}

/**
 * A page's or a post's head with the site's parts merged in. Next merges a
 * route's metadata into the layout's one key deep: a page's `openGraph` and
 * `alternates` replace the layout's whole, so without this a page would
 * lose og:site_name, og:locale and the feed link the root layout declares.
 */
function withSiteHead(site: SiteConfig, metadata: Metadata, feed?: string): Metadata {
  const shared = siteHead(site, feed);
  return { ...metadata, openGraph: { ...shared.openGraph, ...metadata.openGraph }, alternates: { ...shared.alternates, ...metadata.alternates } };
}

/**
 * The head every page starts from, the root layout's `metadata`: the
 * metadataBase (the site's origin, so a page's paths become absolute), the
 * title template (`%s | <site.name>`) with the home page's title as its
 * default, the home page's description, the site's Open Graph name and
 * locale, the Twitter card, and the link to the feed. `home` reads the home
 * page's seo block when the layout is rendered, not when the kit is made. A
 * preview build (AGENTIC_CMS_PREVIEW=1) adds noindex, nofollow, which every
 * page inherits: a preview is never indexed.
 */
export function createRootMetadata(site: SiteConfig, home: () => PageSeo, feed?: string) {
  return function rootMetadata(): Metadata {
    const { title, description } = home();
    return {
      metadataBase: new URL(site.url),
      title: { default: title, template: `%s | ${site.name}` },
      description,
      openGraph: { type: "website", ...siteHead(site, feed).openGraph },
      twitter: { card: "summary_large_image" },
      alternates: siteHead(site, feed).alternates,
      ...(isPreview() ? { robots: { index: false, follow: false } } : {}),
    };
  };
}

/** The head builders of a page and a post, with the site's parts in each; `feed` the language's feed (siteHead()). */
export function createMetadata(site: SiteConfig, { postUrl }: Urls, feed?: string) {
  /**
   * The head of a post from its frontmatter: the SEO title (or `title | brand`
   * through the layout template), description, canonical, Open Graph article
   * with its dates, author, section and tags, Twitter card, and the site's
   * parts.
   */
  function postMetadata(post: Post): Metadata {
    const description = post.seoDescription ?? post.excerpt;
    const url = postUrl(post.slug);
    const title = post.seoTitle ?? post.title;
    const head: Metadata = {
      title: post.seoTitle ? { absolute: post.seoTitle } : post.title,
      description,
      keywords: post.keywords,
      alternates: { canonical: url },
      openGraph: {
        type: "article",
        title,
        description,
        url,
        images: post.ogImage ? [{ url: post.ogImage }] : undefined,
        publishedTime: post.publishedAt ?? post.date,
        modifiedTime: post.updatedAt ?? post.publishedAt ?? post.date,
        authors: [post.author.name],
        section: post.category.name,
        tags: post.keywords,
      },
      twitter: { card: "summary_large_image", title, description, images: post.ogImage ? [post.ogImage] : undefined },
    };
    return withSiteHead(site, head, feed);
  }

  /** A page's head from its seo block (`pageMetadata()`), with the site's parts. */
  const sitePageMetadata = (seo: PageSeo): Metadata => withSiteHead(site, pageMetadata(seo), feed);

  return { pageMetadata: sitePageMetadata, postMetadata, unlistedMetadata };
}
