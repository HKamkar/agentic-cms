import { absoluteUrl, postUrl, site } from "@/config/site";
import type { PostMeta } from "@/lib/blog/posts";
import { getPage } from "@/lib/content";
import type { PageSeo } from "./types.ts";

export type Crumb = { name: string; path: string };

/** The organisation as a page's publisher or provider: name, logo, e-mail and profiles, one definition for every page. */
export function organizationLd({ name = site.shortName, url = false }: { name?: string; url?: boolean } = {}) {
  return {
    "@type": "Organization",
    name,
    ...(url ? { url: site.url } : {}),
    logo: { "@type": "ImageObject", url: absoluteUrl(site.logo) },
    email: site.email,
    sameAs: site.footer.social.map((s) => s.href),
  };
}

/**
 * BreadcrumbList structured data for a trail (home first, the page itself
 * last). Google shows it under the result in place of the URL.
 */
export function breadcrumbLd(trail: Crumb[]) {
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

const crumb = (slug: string): Crumb => ({ name: getPage(slug).seo.breadcrumb, path: getPage(slug).seo.path });

/** Home › page. */
export const pageBreadcrumb = (seo: PageSeo) => breadcrumbLd([crumb("home"), { name: seo.breadcrumb, path: seo.path }]);

/** Home › Blog › post. */
export const postBreadcrumb = (post: PostMeta) => breadcrumbLd([crumb("home"), crumb("blog"), { name: post.title, path: postUrl(post.slug) }]);
