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
import { checkPagePaths, collectionsIn, createLocales, type Locales } from "./locales.ts";
import { createSeo } from "./seo/index.ts";
import { createUrls, type SiteConfig } from "./site.ts";

export type { SiteConfig, SiteLink, SiteLocale, Urls } from "./site.ts";
export type { Locale, Locales } from "./locales.ts";
export { isPreview, PREVIEW_ENV } from "./preview.ts";

export type KitOptions<S extends ZodType<SectionLike>, C extends Collections<S>> = {
  /** The site's config, data only (src/config/site.ts). */
  site: SiteConfig;
  /** The union of the site's page section schemas (src/components/sections/schemas.ts). */
  sections: S;
  /** A site with collections of its own returns the standard eight plus them; the lint, the docs and the status read them all. */
  collections?: (standard: Collections<S>) => C;
};

export function createKit<S extends ZodType<SectionLike>, C extends Collections<S> = Collections<S>>({ site, sections, collections: extend }: KitOptions<S, C>) {
  const urls = createUrls(site);
  const locales = createLocales(site);
  const standard = createCollections({ sections });
  const collections = (extend ? extend(standard) : standard) as C;
  const content = localizedContent(locales, collections);
  const blog = localizedBlog(locales, collections);
  const seo = createSeo({ site, urls, content, blog });
  return { site, urls, locales, collections, content, blog, seo };
}

/** Memoised per locale: the accessors of each language are made once. */
function perLocale<T>(locales: Locales, make: (tag: string) => T): (tag: string) => T {
  const made = new Map<string, T>();
  return (tag) => {
    locales.get(tag);
    if (!made.has(tag)) made.set(tag, make(tag));
    return made.get(tag)!;
  };
}

/**
 * The content accessors of the default language, and `in(tag)`, another
 * language's over its translated collections (src/lib/locales.ts). A site
 * with locales has its page files checked for where they sit; one without
 * reads exactly what it did.
 */
function localizedContent<S extends ZodType<SectionLike>>(locales: Locales, collections: Collections<S>) {
  const plain = perLocale(locales, (tag) => createContent(collectionsIn(locales, collections, tag)));
  const checked = perLocale(locales, (tag) => {
    const accessors = plain(tag);
    if (locales.all.length === 1) return accessors;
    const getPages = () => {
      const pages = accessors.getPages();
      checkPagePaths(locales, tag, pages, () => plain(locales.default.locale).getPages());
      return pages;
    };
    const getPage = (slug: string) => {
      getPages();
      return accessors.getPage(slug);
    };
    return { ...accessors, getPages, getPage };
  });
  return { ...checked(locales.default.locale), in: checked };
}

/** The post pipeline of the default language, and `in(tag)`, another language's over its translated posts, authors and categories. */
function localizedBlog(locales: Locales, collections: Collections) {
  const blogIn = perLocale(locales, (tag) => createBlog(collectionsIn(locales, collections, tag)));
  return { ...blogIn(locales.default.locale), in: blogIn };
}

export type Kit<S extends ZodType<SectionLike> = ZodType<SectionLike>, C extends Collections<S> = Collections<S>> = ReturnType<typeof createKit<S, C>>;
