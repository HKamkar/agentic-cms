import type { Metadata } from "next";
import { isPreview } from "../preview.ts";
import type { Post } from "../blog/posts.ts";
import type { SiteConfig, Urls } from "../site.ts";
import type { PageSeo } from "./types.ts";

/**
 * The complete head of a page from its seo block: exact title, description,
 * canonical, Open Graph with the 1200×630 image, Twitter card. The route
 * returns `pageMetadata(page.seo)` from generateMetadata and nothing else;
 * the layout's metadataBase makes the paths absolute.
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
 * The head every page starts from, the root layout's `metadata`: the
 * metadataBase (the site's origin, so a page's paths become absolute), the
 * title template (`%s | <site.name>`) with the home page's title as its
 * default, the home page's description, the site's Open Graph name and
 * locale, the Twitter card, and the link to the feed. `home` reads the home
 * page's seo block when the layout is rendered, not when the kit is made. A
 * preview build (AGENTIC_CMS_PREVIEW=1) adds noindex, nofollow, which every
 * page inherits: a preview is never indexed.
 */
export function createRootMetadata(site: SiteConfig, home: () => PageSeo) {
  return function rootMetadata(): Metadata {
    const { title, description } = home();
    return {
      metadataBase: new URL(site.url),
      title: { default: title, template: `%s | ${site.name}` },
      description,
      openGraph: { type: "website", siteName: site.name, ...(site.ogLocale ? { locale: site.ogLocale } : {}) },
      twitter: { card: "summary_large_image" },
      alternates: { types: { "application/rss+xml": `${site.url}/feed.xml` } },
      ...(isPreview() ? { robots: { index: false, follow: false } } : {}),
    };
  };
}

/** The head builders that need the site's URLs. */
export function createMetadata({ postUrl }: Urls) {
  /**
   * The head of a post from its frontmatter: the SEO title (or `title | brand`
   * through the layout template), description, canonical, Open Graph article
   * with its dates, author, section and tags, Twitter card.
   */
  function postMetadata(post: Post): Metadata {
    const description = post.seoDescription ?? post.excerpt;
    const url = postUrl(post.slug);
    const title = post.seoTitle ?? post.title;
    return {
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
  }

  return { pageMetadata, postMetadata, unlistedMetadata };
}
