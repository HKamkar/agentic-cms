import type { MetadataRoute } from "next";
import { absoluteUrl, postUrl, site } from "@/config/site";
import { getAllPosts } from "@/lib/blog/posts";
import { getPages } from "@/lib/content";

/** Every page file (its `updated` is the lastmod) and every published post. */
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const latestPost = posts[0] ? new Date(posts[0].updatedAt ?? posts[0].date) : undefined;
  const seo = getPages().map((entry) => entry.data.seo);
  return [
    ...seo.map((page) => ({
      url: absoluteUrl(page.path),
      // The blog index changes whenever a post does.
      lastModified: page.path === site.links.blog && latestPost ? latestPost : new Date(page.updated),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...posts.map((p) => ({
      url: absoluteUrl(postUrl(p.slug)),
      lastModified: new Date(p.updatedAt ?? p.publishedAt ?? p.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
