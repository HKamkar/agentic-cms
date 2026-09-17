import { kit } from "@/kit";

const { site, content, blog } = kit;
const { absoluteUrl, postUrl } = kit.urls;

// Rendered once at build time and served as a static asset.
export const dynamic = "force-static";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const posts = blog.getAllPosts();
  const items = posts
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
