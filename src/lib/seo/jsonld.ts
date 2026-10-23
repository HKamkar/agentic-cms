import type { PostMeta } from "../blog/posts.ts";
import type { Content } from "../content/index.ts";
import type { SiteConfig, Urls } from "../site.ts";
import type { PageSeo } from "./types.ts";

export type Crumb = { name: string; path: string };

/** Whether the site keeps its address out of every served file (`guardEmail: true`, docs/email.md). */
export const guardsEmail = (site: SiteConfig) => site.guardEmail === true;

/**
 * The organisation's address in its blocks: `email` as text, or, when the
 * site guards its address, a ContactPoint with the contact page's URL in its
 * place; nothing for a site without one.
 */
export function organizationEmailLd(site: SiteConfig, absoluteUrl: Urls["absoluteUrl"]) {
  if (!site.email) return {};
  return guardsEmail(site) ? { contactPoint: { "@type": "ContactPoint", url: absoluteUrl(site.links.contact) } } : { email: site.email };
}

/** The organisation and breadcrumb blocks every page shares, built on the site's config; the trails start at the `home` and `blog` page files. */
export function createJsonLd({ site, urls, content }: { site: SiteConfig; urls: Urls; content: Pick<Content, "getPage"> }) {
  const { absoluteUrl, postUrl } = urls;

  /** The organisation as a page's publisher or provider: name, logo, e-mail (or its contact point) and profiles, one definition for every page. */
  function organizationLd({ name = site.shortName, url = false }: { name?: string; url?: boolean } = {}) {
    return {
      "@type": "Organization",
      name,
      ...(url ? { url: site.url } : {}),
      logo: { "@type": "ImageObject", url: absoluteUrl(site.logo) },
      ...organizationEmailLd(site, absoluteUrl),
      sameAs: site.footer.social.map((s) => s.href),
    };
  }

  /**
   * BreadcrumbList structured data for a trail (home first, the page itself
   * last). Google shows it under the result in place of the URL.
   */
  function breadcrumbLd(trail: Crumb[]) {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: trail.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        item: absoluteUrl(crumb.path),
      })),
    };
  }

  const crumb = (slug: string): Crumb => {
    const { seo } = content.getPage(slug);
    return { name: seo.breadcrumb, path: seo.path };
  };

  /** Home › page. */
  const pageBreadcrumb = (seo: PageSeo) => breadcrumbLd([crumb("home"), { name: seo.breadcrumb, path: seo.path }]);

  /** Home › Blog › post. */
  const postBreadcrumb = (post: PostMeta) => breadcrumbLd([crumb("home"), crumb("blog"), { name: post.title, path: postUrl(post.slug) }]);

  return { organizationLd, breadcrumbLd, pageBreadcrumb, postBreadcrumb };
}
