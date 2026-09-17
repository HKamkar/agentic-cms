// The public surface of the SEO engine: the head builders and the structured
// data, composed for one site by createSeo(). The contract is README.md.
import type { ZodType } from "zod";
import type { Blog } from "../blog/posts.ts";
import type { Content, SectionLike } from "../content/index.ts";
import type { SiteConfig, Urls } from "../site.ts";
import { createJsonLd } from "./jsonld.ts";
import { createMetadata } from "./metadata.ts";
import { createPageJsonLd } from "./pageJsonLd.ts";
import { createPostJsonLd } from "./postJsonLd.ts";
import { createRoutes } from "./routes.ts";

export { pageMetadata } from "./metadata.ts";
export type { Crumb } from "./jsonld.ts";
export type { ChangeFrequency, PageSeo } from "./types.ts";

/** Everything a page or a post puts in its head and its structured data, and the sitemap, the feed and robots.txt, for one site. */
export function createSeo<S extends ZodType<SectionLike>>({ site, urls, content, blog }: { site: SiteConfig; urls: Urls; content: Content<S>; blog: Blog }) {
  const jsonld = createJsonLd({ site, urls, content });
  const pageJsonLd = createPageJsonLd({ site, urls, content, blog, organizationLd: jsonld.organizationLd });
  return { ...createMetadata(urls), ...jsonld, pageJsonLd, ...createPostJsonLd({ site, urls }), ...createRoutes({ site, urls, content, blog }) };
}

export type Seo = ReturnType<typeof createSeo>;
