// The page-type structured data block of a page file (content/pages/*.yaml):
// what its `jsonld` block declares, joined with what the page shows — the
// FAQ set of its `faq` section, the use-case cards of its `use-case-cards`
// section, every published post for the blog — and the organisation
// details from site.ts. One builder per page type; the shapes are the ones
// the hand-written page files carried before pages became files.

import { absoluteUrl, postUrl, site } from "@/config/site";
import { getFaq, getUseCases, type Page, type PageJsonLd } from "@/lib/content";
import { getAllPosts } from "@/lib/blog/posts";
import { organizationLd } from "./jsonld";

type Section = Page["sections"][number];

/** The first section of a type, looking inside group wrappers. */
function findSection<T extends Section["type"]>(sections: Section[], type: T): Extract<Section, { type: T }> | undefined {
  for (const section of sections) {
    if (section.type === type) return section as Extract<Section, { type: T }>;
    if (section.type === "group") {
      const inner = findSection(section.sections, type);
      if (inner) return inner;
    }
  }
  return undefined;
}

function faqPage(page: Page) {
  const faq = findSection(page.sections, "faq");
  if (!faq) throw new Error(`${page.seo.path}: a ${page.jsonld.type} needs a faq section for its FAQPage`);
  return {
    "@type": "FAQPage",
    mainEntity: getFaq(faq.set).items.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };
}

function webPage(page: Page, jsonld: Extract<PageJsonLd, { type: "WebPage" }>) {
  const { application, itemList, organization } = jsonld;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.seo.title,
    description: page.seo.description,
    url: absoluteUrl(page.seo.path),
    inLanguage: "en",
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
            itemListElement: getUseCases().map((uc, i) => ({
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

function aboutPage(page: Page, jsonld: Extract<PageJsonLd, { type: "AboutPage" }>) {
  const { organization } = jsonld;
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: page.seo.title,
    url: absoluteUrl(page.seo.path),
    inLanguage: "en",
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
      email: site.email,
      sameAs: site.footer.social.map((s) => s.href),
      url: site.url,
      knowsAbout: organization.knowsAbout,
    },
    mainEntity: faqPage(page),
  };
}

function contactPage(page: Page, jsonld: Extract<PageJsonLd, { type: "ContactPage" }>) {
  const { office, contacts } = jsonld;
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact ${site.name}`,
    description: page.seo.description,
    url: absoluteUrl(page.seo.path),
    inLanguage: "en",
    about: {
      "@type": "Organization",
      name: site.shortName,
      email: site.email,
      address: { "@type": "PostalAddress", streetAddress: office.streetAddress, addressLocality: office.locality, postalCode: office.postalCode, addressCountry: office.country },
      logo: { "@type": "ImageObject", url: absoluteUrl(site.logo) },
      sameAs: site.footer.social.map((s) => s.href),
      contactPoint: contacts.map((contact) => ({ "@type": "ContactPoint", contactType: contact.type, email: contact.email })),
    },
    mainEntity: faqPage(page),
  };
}

function blog(page: Page) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: page.seo.title,
    description: page.seo.description,
    url: absoluteUrl(page.seo.path),
    publisher: organizationLd(),
    blogPost: getAllPosts().map((p) => ({
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

/** The page-type block of a page file, for <JsonLd>. */
export function pageJsonLd(page: Page): Record<string, unknown> {
  const { jsonld } = page;
  switch (jsonld.type) {
    case "WebPage":
      return webPage(page, jsonld);
    case "AboutPage":
      return aboutPage(page, jsonld);
    case "ContactPage":
      return contactPage(page, jsonld);
    case "Blog":
      return blog(page);
  }
}
