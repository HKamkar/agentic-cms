// The three routes every site serves the same way, as functions of the
// site's pages and posts: the sitemap, the RSS feed and robots.txt. The
// route files under src/app stay one line each (src/app/sitemap.ts,
// src/app/feed.xml/route.ts, src/app/robots.ts).

import type { MetadataRoute } from "next";
import type { ZodType } from "zod";
import type { Blog, Post } from "../blog/posts.ts";
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
  /** A language's published posts, none for one with no posts folder; its feed's path. */
  postsOf?: (tag: string) => Post[];
  feedOf?: (tag: string) => string;
};

export function createRoutes<S extends ZodType<SectionLike>>({ site, urls, content, blog, locales = createLocales(site), scope = () => ({ site, urls, content, blog }), languages = () => undefined, postsOf = () => blog.getAllPosts(), feedOf = () => "/feed.xml" }: Deps<S>) {
  const { absoluteUrl } = urls;

  /** The page's sitemap alternates: every version as an absolute URL, x-default among them; none for a page in one language. */
  function alternatesOf(path: string) {
    const versions = languages(path);
    return versions ? { alternates: { languages: Object.fromEntries(Object.entries(versions).map(([tag, version]) => [tag, absoluteUrl(version)])) } } : {};
  }

  /** A language's page files (`updated` is the lastmod; its blog index's, its newest post's), each with its alternates. */
  function pageEntries(tag: string): MetadataRoute.Sitemap {
    const { site: language, content } = scope(tag);
    const newest = () => {
      const [latest] = postsOf(tag);
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

  /** A language's published posts as sitemap entries, each with its alternates. */
  function postEntries(tag: string): MetadataRoute.Sitemap {
    const { urls: language } = scope(tag);
    return postsOf(tag).map((p) => ({
      url: absoluteUrl(language.postUrl(p.slug)),
      lastModified: new Date(p.updatedAt ?? p.publishedAt ?? p.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
      ...alternatesOf(language.postUrl(p.slug)),
    }));
  }

  /** Every page file and every published post, of every language. */
  function sitemap(): MetadataRoute.Sitemap {
    const tags = locales.all.map((locale) => locale.locale);
    return [...tags.flatMap(pageEntries), ...tags.flatMap(postEntries)];
  }

  /**
   * RSS 2.0 of every published post of a language (the default one's
   * without a tag), as the Response a route handler returns (rendered once
   * at build time: `dynamic = "force-static"`). A language's feed reads its
   * posts folder and its blog page, and fails without them.
   */
  function feed(tag: string = locales.default.locale): Response {
    const { site: language, urls: languageUrls, content: languageContent, blog: posts } = scope(tag);
    const items = posts
      .getAllPosts()
      .map(
        (p) => `    <item>
      <title>${escape(p.title)}</title>
      <link>${absoluteUrl(languageUrls.postUrl(p.slug))}</link>
      <guid isPermaLink="true">${absoluteUrl(languageUrls.postUrl(p.slug))}</guid>
      <pubDate>${new Date(p.publishedAt ?? `${p.date}T00:00:00Z`).toUTCString()}</pubDate>
      <category>${escape(p.category.name)}</category>
      <description>${escape(p.excerpt)}</description>
    </item>`,
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(languageContent.getPage("blog").seo.title)}</title>
    <link>${absoluteUrl(language.links.blog)}</link>
    <description>${escape(language.description)}</description>
    <language>${language.locale}</language>
    <atom:link href="${absoluteUrl(feedOf(tag))}" rel="self" type="application/rss+xml" />
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
