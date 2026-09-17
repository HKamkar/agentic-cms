import type { Metadata } from "next";
import type { Post } from "../blog/posts.ts";
import type { Urls } from "../site.ts";
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

  return { pageMetadata, postMetadata };
}
