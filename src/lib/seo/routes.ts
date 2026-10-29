// The three routes every site serves the same way, as functions of the
// site's pages and posts: the sitemap, the RSS feed and robots.txt. The
// route files under src/app stay one line each (src/app/sitemap.ts,
// src/app/feed.xml/route.ts, src/app/robots.ts).

import type { MetadataRoute } from "next";
import type { ZodType } from "zod";
import type { Blog } from "../blog/posts.ts";
import type { Content, SectionLike } from "../content/index.ts";
import { createLocales, type Locales } from "../locales.ts";
import { isPreview } from "../preview.ts";
import type { SiteConfig, Urls } from "../site.ts";
import type { SeoScope } from "./index.ts";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The default language's config, URLs, content and posts; for a site in several languages, its locales, each one's scope and a page's alternates (createSeo()). */
type Deps<S extends ZodType<SectionLike>> = {
  site: SiteConfig;
  urls: Urls;
  content: Content<S>;
  blog: Blog;
  locales?: Locales;
  scope?: (tag: string) => SeoScope<S>;
  languages?: (path: string) => Record<string, string> | undefined;
};

export function createRoutes<S extends ZodType<SectionLike>>({ site, urls, content, blog, locales = createLocales(site), scope = () => ({ site, urls, content, blog }), languages = () => undefined }: Deps<S>) {
  const { absoluteUrl, postUrl } = urls;

  /** The page's sitemap alternates: every version as an absolute URL, x-default among them; none for a page in one language. */
  function alternatesOf(path: string) {
    const versions = languages(path);
    return versions ? { alternates: { languages: Object.fromEntries(Object.entries(versions).map(([tag, version]) => [tag, absoluteUrl(version)])) } } : {};
  }

  /** A language's page files (`updated` is the lastmod; its blog index's, its newest post's), each with its alternates. */
  function pageEntries({ site: language, content, blog: posts }: SeoScope<S>): MetadataRoute.Sitemap {
    const newest = () => {
      const [latest] = posts.getAllPosts();
      return latest ? new Date(latest.updatedAt ?? latest.date) : undefined;
    };
    return content.getPages().map(({ data: { seo: page } }) => ({
      url: absoluteUrl(page.path),
      // The blog index changes whenever a post does.
      lastModified: (page.path === language.links.blog ? newest() : undefined) ?? new Date(page.updated),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      ...alternatesOf(page.path),
    }));
  }

  /** Every page file of every language and every published post. */
  function sitemap(): MetadataRoute.Sitemap {
    const posts = blog.getAllPosts();
    return [
      ...locales.all.flatMap((locale) => pageEntries(scope(locale.locale))),
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

  /** Everything allowed, the sitemap named; in a preview build (AGENTIC_CMS_PREVIEW=1), everything disallowed. */
  function robots(): MetadataRoute.Robots {
    return {
      rules: isPreview() ? { userAgent: "*", disallow: "/" } : { userAgent: "*", allow: "/" },
      sitemap: absoluteUrl("/sitemap.xml"),
    };
  }

  return { sitemap, feed, robots };
}
