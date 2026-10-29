// The public surface of the SEO engine: the head builders and the structured
// data, composed for one site by createSeo(). The contract is README.md.
import type { ZodType } from "zod";
import type { Blog } from "../blog/posts.ts";
import type { Content, Page, SectionLike } from "../content/index.ts";
import { createLocales, type Locales } from "../locales.ts";
import type { SiteConfig, Urls } from "../site.ts";
import { createJsonLd } from "./jsonld.ts";
import { createMetadata, createRootMetadata, unlistedMetadata } from "./metadata.ts";
import { createPageJsonLd } from "./pageJsonLd.ts";
import { createPostJsonLd } from "./postJsonLd.ts";
import { createRoutes } from "./routes.ts";
import type { PageSeo } from "./types.ts";
import { createVersions } from "./versions.ts";

export { pageMetadata, unlistedMetadata } from "./metadata.ts";
export type { Crumb } from "./jsonld.ts";
export type { ChangeFrequency, PageSeo } from "./types.ts";

/** What the builders of one language read: its config, its URLs, its content and its posts. */
export type SeoScope<S extends ZodType<SectionLike> = ZodType<SectionLike>> = { site: SiteConfig; urls: Urls; content: Content<S>; blog: Blog };

/** Every builder of one language, on its scope. */
function buildersFor<S extends ZodType<SectionLike>>({ site, urls, content, blog }: SeoScope<S>) {
  const jsonld = createJsonLd({ site, urls, content });
  return {
    ...createMetadata(site, urls),
    rootMetadata: createRootMetadata(site, () => content.getPage("home").seo),
    ...jsonld,
    pageJsonLd: createPageJsonLd({ site, urls, content, blog, organizationLd: jsonld.organizationLd }),
    ...createPostJsonLd({ site, urls }),
  };
}

/**
 * Everything a page or a post puts in its head and its structured data, and
 * the sitemap, the feed and robots.txt, for one site. A site in several
 * languages (`site.locales`) passes its `locales` and the `scope` of each
 * language (createKit() does): a page's builders are its language's, found
 * from its path, and its head and its sitemap entry name its other versions.
 */
export function createSeo<S extends ZodType<SectionLike>>({ site, urls, content, blog, locales = createLocales(site), scope }: SeoScope<S> & { locales?: Locales; scope?: (tag: string) => SeoScope<S> }) {
  const scoped = (tag: string): SeoScope<S> => (scope ? scope(tag) : { site, urls, content, blog });
  const made = new Map<string, ReturnType<typeof buildersFor<S>>>();
  const at = (tag: string) => made.get(tag) ?? made.set(tag, buildersFor(scoped(tag))).get(tag)!;
  const of = (path: string) => at(locales.of(path).locale);
  const versions = createVersions(locales, (tag) => new Set(scoped(tag).content.getPages().map((entry) => entry.data.seo.path)));
  const home = at(locales.default.locale);
  return {
    /** A page's head (`pageMetadata()` with the site's parts, in its language), with its other versions. */
    pageMetadata: (seo: PageSeo) => versions.withVersions(of(seo.path).pageMetadata(seo), seo.path),
    postMetadata: home.postMetadata,
    unlistedMetadata,
    /** The root layout's head, in the language with the tag; the default language's without one. */
    rootMetadata: (tag: string = locales.default.locale) => at(tag).rootMetadata(),
    organizationLd: home.organizationLd,
    breadcrumbLd: home.breadcrumbLd,
    /** Home › page, the home page the page's language's. */
    pageBreadcrumb: (seo: PageSeo) => of(seo.path).pageBreadcrumb(seo),
    postBreadcrumb: home.postBreadcrumb,
    /** The page-type block, in the page's language. */
    pageJsonLd: (page: Page<S>) => of(page.seo.path).pageJsonLd(page),
    postJsonLd: home.postJsonLd,
    postFaqJsonLd: home.postFaqJsonLd,
    ...createRoutes({ site, urls, content, blog, locales, scope: scoped, languages: versions.languages }),
  };
}

export type Seo = ReturnType<typeof createSeo>;
