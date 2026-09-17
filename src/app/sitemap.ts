import type { MetadataRoute } from "next";
import { kit } from "@/kit";

const { site, content, blog } = kit;
const { absoluteUrl, postUrl } = kit.urls;

/** Every page file (its `updated` is the lastmod) and every published post. */
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = blog.getAllPosts();
  const latestPost = posts[0] ? new Date(posts[0].updatedAt ?? posts[0].date) : undefined;
  const seo = content.getPages().map((entry) => entry.data.seo);
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
