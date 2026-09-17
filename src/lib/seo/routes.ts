// The three routes every site serves the same way, as functions of the
// site's pages and posts: the sitemap, the RSS feed and robots.txt. The
// route files under src/app stay one line each (src/app/sitemap.ts,
// src/app/feed.xml/route.ts, src/app/robots.ts).

import type { MetadataRoute } from "next";
import type { ZodType } from "zod";
import type { Blog } from "../blog/posts.ts";
import type { Content, SectionLike } from "../content/index.ts";
import type { SiteConfig, Urls } from "../site.ts";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function createRoutes<S extends ZodType<SectionLike>>({ site, urls, content, blog }: { site: SiteConfig; urls: Urls; content: Content<S>; blog: Blog }) {
  const { absoluteUrl, postUrl } = urls;

  /** Every page file (its `updated` is the lastmod) and every published post. */
  function sitemap(): MetadataRoute.Sitemap {
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

  /** RSS 2.0 of every published post, as the Response a route handler returns (rendered once at build time: `dynamic = "force-static"`). */
  function feed(): Response {
    const items = blog
      .getAllPosts()
      .map(
        (p) => `    <item>
      <title>${escape(p.title)}</title>
      <link>${absoluteUrl(postUrl(p.slug))}</link>
      <guid isPermaLink="true">${absoluteUrl(postUrl(p.slug))}</guid>
      <pubDate>${new Date(p.publishedAt ?? `${p.date}T00:00:00Z`).toUTCString()}</pubDate>
      <category>${escape(p.category.name)}</category>
      <description>${escape(p.excerpt)}</description>
    </item>`,
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(content.getPage("blog").seo.title)}</title>
    <link>${absoluteUrl(site.links.blog)}</link>
    <description>${escape(site.description)}</description>
    <language>${site.locale}</language>
    <atom:link href="${absoluteUrl("/feed.xml")}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
    return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
  }

  /** Everything allowed, the sitemap named. */
  function robots(): MetadataRoute.Robots {
    return {
      rules: { userAgent: "*", allow: "/" },
      sitemap: absoluteUrl("/sitemap.xml"),
    };
  }

  return { sitemap, feed, robots };
}
