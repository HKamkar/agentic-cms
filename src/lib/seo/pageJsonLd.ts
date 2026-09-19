// The page-type structured data block of a page file (content/pages/*.yaml):
// what its `jsonld` block declares, joined with what the page shows — the
// FAQ set of its `faq` section, the use-case cards of its `use-case-cards`
// section, every published post for the blog — and the organisation
// details from the site's config. One builder per page type; the shapes are
// the ones the hand-written page files carried before pages became files.
// The engine reads three section types by role and leaves the rest to the
// site: `faq` carries `set`, `group` carries `sections`, `use-case-cards`
// only has to be there.

import type { ZodType } from "zod";
import type { Blog } from "../blog/posts.ts";
import type { Content, Page, PageJsonLd, SectionLike } from "../content/index.ts";
import type { SiteConfig, Urls } from "../site.ts";
import type { createJsonLd } from "./jsonld.ts";

type FaqSection = SectionLike & { type: "faq"; set: string };
type GroupSection = SectionLike & { type: "group"; sections: SectionLike[] };
type Deps<S extends ZodType<SectionLike>> = { site: SiteConfig; urls: Urls; content: Content<S>; blog: Blog; organizationLd: ReturnType<typeof createJsonLd>["organizationLd"] };

/** The first section of a type, looking inside group wrappers. */
function findSection(sections: SectionLike[], type: string): SectionLike | undefined {
  for (const section of sections) {
    if (section.type === type) return section;
    if (section.type === "group") {
      const inner = findSection((section as GroupSection).sections, type);
      if (inner) return inner;
    }
  }
  return undefined;
}

/** `pageJsonLd(page)`: the page-type block of a page file, for <JsonLd>. */
export function createPageJsonLd<S extends ZodType<SectionLike>>({ site, urls, content, blog, organizationLd }: Deps<S>) {
  const { absoluteUrl, postUrl } = urls;
  type SitePage = Page<S>;

  function faqPage(page: SitePage) {
    const faq = findSection(page.sections, "faq") as FaqSection | undefined;
    if (!faq) throw new Error(`${page.seo.path}: a ${page.jsonld.type} needs a faq section for its FAQPage`);
    return {
      "@type": "FAQPage",
      mainEntity: content.getFaq(faq.set).items.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
    };
  }

  function webPage(page: SitePage, jsonld: Extract<PageJsonLd, { type: "WebPage" }>) {
    const { application, itemList, organization } = jsonld;
    return {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.seo.title,
      description: page.seo.description,
      url: absoluteUrl(page.seo.path),
      inLanguage: site.locale,
      about: {
        "@type": "SoftwareApplication",
        name: application.name,
        applicationCategory: "BusinessApplication",
        description: application.description,
        operatingSystem: application.operatingSystem,
        offers: { "@type": "Offer", description: application.offer },
        featureList: application.featureList,
        ...(application.signIn ? { url: site.signIn.href, sameAs: site.footer.social.map((s) => s.href) } : {}),
        ...(organization === "provider" ? { provider: organizationLd({ name: site.name, url: true }) } : {}),
      },
      ...(itemList
        ? {
            mainEntity: {
              "@type": "ItemList",
              name: itemList.name,
              description: itemList.description,
              itemListElement: content.getUseCases().map((uc, i) => ({
                "@type": "ListItem",
                position: i + 1,
                // the ItemList names the brand plainly, without its mark (the shape the page carried before it was a file)
                item: { "@type": "Service", name: uc.sector, description: `${uc.title} ${uc.text}`.replace(site.name, site.shortName) },
              })),
            },
          }
        : {}),
      ...(organization === "publisher" ? { publisher: organizationLd() } : {}),
    };
  }

  function aboutPage(page: SitePage, jsonld: Extract<PageJsonLd, { type: "AboutPage" }>) {
    const { organization } = jsonld;
    return {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: page.seo.title,
      url: absoluteUrl(page.seo.path),
      inLanguage: site.locale,
      description: page.seo.description,
      about: {
        "@type": "Organization",
        "@id": `${site.url}/#organization`,
        name: site.name,
        description: organization.description,
        foundingDate: organization.foundingDate,
        foundingLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: organization.foundingLocation.locality, addressCountry: organization.foundingLocation.country } },
        slogan: organization.slogan,
        logo: { "@type": "ImageObject", url: absoluteUrl(site.logo) },
        ...(site.email ? { email: site.email } : {}),
        sameAs: site.footer.social.map((s) => s.href),
        url: site.url,
        knowsAbout: organization.knowsAbout,
      },
      mainEntity: faqPage(page),
    };
  }

  function contactPage(page: SitePage, jsonld: Extract<PageJsonLd, { type: "ContactPage" }>) {
    const { office, contacts } = jsonld;
    return {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: `Contact ${site.name}`,
      description: page.seo.description,
      url: absoluteUrl(page.seo.path),
      inLanguage: site.locale,
      about: {
        "@type": "Organization",
        name: site.shortName,
        ...(site.email ? { email: site.email } : {}),
        address: { "@type": "PostalAddress", streetAddress: office.streetAddress, addressLocality: office.locality, postalCode: office.postalCode, addressCountry: office.country },
        logo: { "@type": "ImageObject", url: absoluteUrl(site.logo) },
        sameAs: site.footer.social.map((s) => s.href),
        contactPoint: contacts.map((contact) => ({ "@type": "ContactPoint", contactType: contact.type, ...(contact.email ? { email: contact.email } : { url: absoluteUrl(page.seo.path) }) })),
      },
      mainEntity: faqPage(page),
    };
  }

  function blogPage(page: SitePage) {
    return {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: page.seo.title,
      description: page.seo.description,
      url: absoluteUrl(page.seo.path),
      publisher: organizationLd(),
      blogPost: blog.getAllPosts().map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        description: p.excerpt,
        url: absoluteUrl(postUrl(p.slug)),
        image: p.thumbnail ? absoluteUrl(p.thumbnail) : undefined,
        keywords: p.keywords.join(", "),
        articleSection: p.category.name.toUpperCase(),
      })),
    };
  }

  return function pageJsonLd(page: SitePage): Record<string, unknown> {
    const { jsonld } = page;
    switch (jsonld.type) {
      case "WebPage":
        return webPage(page, jsonld);
      case "AboutPage":
        return aboutPage(page, jsonld);
      case "ContactPage":
        return contactPage(page, jsonld);
      case "Blog":
        return blogPage(page);
    }
  };
}
