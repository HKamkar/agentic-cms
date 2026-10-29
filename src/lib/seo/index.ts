// The public surface of the SEO engine: the head builders and the structured
// data, composed for one site by createSeo(). The contract is README.md.
import type { ZodType } from "zod";
import type { Blog, Post, PostMeta } from "../blog/posts.ts";
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

/**
 * What the builders of one language read: its config, its URLs, its content
 * and its posts; `hasPosts`, whether it has a posts folder at all (a
 * language without one lists none, where the default language's must be
 * there).
 */
export type SeoScope<S extends ZodType<SectionLike> = ZodType<SectionLike>> = { site: SiteConfig; urls: Urls; content: Content<S>; blog: Blog; hasPosts?: () => boolean };

/** Every builder of one language, on its scope; `feed` is the path of the feed its heads link to. */
function buildersFor<S extends ZodType<SectionLike>>({ site, urls, content, blog }: SeoScope<S>, feed: string) {
  const jsonld = createJsonLd({ site, urls, content });
  return {
    ...createMetadata(site, urls, feed),
    rootMetadata: createRootMetadata(site, () => content.getPage("home").seo, feed),
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
  const hasPosts = (tag: string) => scoped(tag).hasPosts?.() ?? true;
  /** A language's published posts; none for a language with no posts folder. */
  const postsOf = (tag: string) => (hasPosts(tag) ? scoped(tag).blog.getAllPosts() : []);
  /** The feed a language's heads link to: its own when it has posts, else the site's. */
  const feedOf = (tag: string) => (locales.get(tag).isDefault || !hasPosts(tag) ? "/feed.xml" : locales.path(tag, "/feed.xml"));
  const made = new Map<string, ReturnType<typeof buildersFor<S>>>();
  const at = (tag: string) => made.get(tag) ?? made.set(tag, buildersFor(scoped(tag), feedOf(tag))).get(tag)!;
  const of = (path: string) => at(locales.of(path).locale);
  const languageOf = (post: PostMeta) => post.locale ?? locales.default.locale;
  const postPath = (post: PostMeta) => scoped(languageOf(post)).urls.postUrl(post.slug);
  const versions = createVersions(locales, (tag) => new Set([...scoped(tag).content.getPages().map((entry) => entry.data.seo.path), ...postsOf(tag).map((post) => scoped(tag).urls.postUrl(post.slug))]));
  const home = at(locales.default.locale);
  return {
    /** A page's head (`pageMetadata()` with the site's parts, in its language), with its other versions. */
    pageMetadata: (seo: PageSeo) => versions.withVersions(of(seo.path).pageMetadata(seo), seo.path),
    /** A post's head, in its language (`post.locale`), with its versions in the others. */
    postMetadata: (post: Post) => versions.withVersions(at(languageOf(post)).postMetadata(post), postPath(post)),
    unlistedMetadata,
    /** The root layout's head, in the language with the tag; the default language's without one. */
    rootMetadata: (tag: string = locales.default.locale) => at(tag).rootMetadata(),
    organizationLd: home.organizationLd,
    breadcrumbLd: home.breadcrumbLd,
    /** Home › page, the home page the page's language's. */
    pageBreadcrumb: (seo: PageSeo) => of(seo.path).pageBreadcrumb(seo),
    /** Home › Blog › post, in the post's language. */
    postBreadcrumb: (post: PostMeta) => at(languageOf(post)).postBreadcrumb(post),
    /** The page-type block, in the page's language. */
    pageJsonLd: (page: Page<S>) => of(page.seo.path).pageJsonLd(page),
    /** The BlogPosting and the FAQPage, in the post's language. */
    postJsonLd: (post: Post) => at(languageOf(post)).postJsonLd(post),
    postFaqJsonLd: (post: Post) => at(languageOf(post)).postFaqJsonLd(post),
    ...createRoutes({ site, urls, content, blog, locales, scope: scoped, languages: versions.languages, postsOf, feedOf }),
  };
}

export type Seo = ReturnType<typeof createSeo>;
