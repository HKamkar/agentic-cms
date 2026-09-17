// The engine, composed for one site. A site calls createKit() once, in
// src/kit.ts, with its config and its section union, and reads everything
// through the result: the collections, the content accessors, the post
// pipeline, the head and structured-data builders, the URL helpers. Server
// code only (the content engine reads node:fs); a client component gets what
// it needs as props. Nothing in src/lib imports the site.
import type { ZodType } from "zod";
// From posts.ts, not the blog barrel: the barrel reaches markdown.tsx, and this
// module has to load under plain Node (the tests, the CLI), which has no JSX.
import { createBlog } from "./blog/posts.ts";
import { createCollections, createContent, type Collections, type SectionLike } from "./content/index.ts";
import { createSeo } from "./seo/index.ts";
import { createUrls, type SiteConfig } from "./site.ts";

export type { SiteConfig, SiteLink, Urls } from "./site.ts";

export type KitOptions<S extends ZodType<SectionLike>, C extends Collections<S>> = {
  /** The site's config, data only (src/config/site.ts). */
  site: SiteConfig;
  /** The union of the site's page section schemas (src/components/sections/schemas.ts). */
  sections: S;
  /** A site with collections of its own returns the standard seven plus them; the lint, the docs and the status read them all. */
  collections?: (standard: Collections<S>) => C;
};

export function createKit<S extends ZodType<SectionLike>, C extends Collections<S> = Collections<S>>({ site, sections, collections: extend }: KitOptions<S, C>) {
  const urls = createUrls(site);
  const standard = createCollections({ sections });
  const collections = (extend ? extend(standard) : standard) as C;
  const content = createContent(collections);
  const blog = createBlog(collections);
  const seo = createSeo({ site, urls, content, blog });
  return { site, urls, collections, content, blog, seo };
}

export type Kit<S extends ZodType<SectionLike> = ZodType<SectionLike>, C extends Collections<S> = Collections<S>> = ReturnType<typeof createKit<S, C>>;
