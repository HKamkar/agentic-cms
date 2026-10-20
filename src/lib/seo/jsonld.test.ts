import assert from "node:assert/strict";
import { test } from "node:test";
import { createUrls, type SiteConfig } from "../site.ts";
import { createJsonLd } from "./jsonld.ts";
import { createPageJsonLd } from "./pageJsonLd.ts";

const SITE = {
  name: "Brand",
  shortName: "Brand",
  url: "https://brand.example",
  locale: "en",
  email: "hello@brand.example",
  logo: "/logo.svg",
  links: { home: "/", blog: "/blog", contact: "/#contact-form" },
  footer: { quickLinks: [], social: [{ label: "GitHub", href: "https://github.example/brand" }] },
} as unknown as SiteConfig;

const FAQ = [{ type: "faq", set: "general" }];
const ABOUT = {
  seo: { title: "About Brand", description: "Who Brand is.", path: "/about" },
  jsonld: { type: "AboutPage", organization: { description: "Brand.", foundingDate: "2026", foundingLocation: { locality: "City", country: "Land" }, slogan: "Files.", knowsAbout: [] } },
  sections: FAQ,
};
const CONTACT = {
  seo: { title: "Contact Brand", description: "Write to Brand.", path: "/contact" },
  jsonld: { type: "ContactPage", office: { streetAddress: "1 Street", locality: "City", postalCode: "0000", country: "Land" }, contacts: [{ type: "customer service", email: "hello@brand.example" }, { type: "press" }] },
  sections: FAQ,
};

/** The site's structured data builders over a stub of the content: the organisation, and the page blocks of an About and a Contact page. */
function ld(site: SiteConfig) {
  const urls = createUrls(site);
  const content = { getPage: (slug: string) => ({ seo: { breadcrumb: slug, path: `/${slug}` } }), getFaq: () => ({ items: [] }) };
  const { organizationLd } = createJsonLd({ site, urls, content: content as never });
  const pageJsonLd = createPageJsonLd({ site, urls, content: content as never, blog: { getAllPosts: () => [] } as never, organizationLd });
  return { organizationLd, about: pageJsonLd(ABOUT as never), contact: pageJsonLd(CONTACT as never) };
}

test("without guardEmail the organisation carries its address as text, as before the key", () => {
  const { organizationLd, about, contact } = ld(SITE);
  assert.deepEqual(organizationLd(), { "@type": "Organization", name: "Brand", logo: { "@type": "ImageObject", url: "https://brand.example/logo.svg" }, email: "hello@brand.example", sameAs: ["https://github.example/brand"] });
  assert.equal((about.about as Record<string, unknown>).email, "hello@brand.example");
  const org = contact.about as Record<string, unknown>;
  assert.equal(org.email, "hello@brand.example");
  assert.deepEqual(org.contactPoint, [
    { "@type": "ContactPoint", contactType: "customer service", email: "hello@brand.example" },
    { "@type": "ContactPoint", contactType: "press", url: "https://brand.example/contact" },
  ], "a contact without an address carries the page's URL");
  assert.deepEqual(ld({ ...SITE, guardEmail: { off: "printed on every invoice" } }).organizationLd(), organizationLd(), "off, with its reason: the same blocks");
});

test("with guardEmail on no block carries the address as text: a ContactPoint with the contact page's URL takes its place", () => {
  const { organizationLd, about, contact } = ld({ ...SITE, guardEmail: true });
  assert.deepEqual(organizationLd({ name: "Brand", url: true }), { "@type": "Organization", name: "Brand", url: "https://brand.example", logo: { "@type": "ImageObject", url: "https://brand.example/logo.svg" }, contactPoint: { "@type": "ContactPoint", url: "https://brand.example/#contact-form" }, sameAs: ["https://github.example/brand"] });
  assert.deepEqual((about.about as Record<string, unknown>).contactPoint, { "@type": "ContactPoint", url: "https://brand.example/#contact-form" });
  assert.deepEqual((contact.about as Record<string, unknown>).contactPoint, [
    { "@type": "ContactPoint", contactType: "customer service", url: "https://brand.example/contact" },
    { "@type": "ContactPoint", contactType: "press", url: "https://brand.example/contact" },
  ], "a contact's own address is left out too");
  for (const block of [organizationLd(), about, contact]) assert.doesNotMatch(JSON.stringify(block), /@brand\.example/);
  assert.deepEqual(ld({ ...SITE, email: undefined, guardEmail: true }).organizationLd().contactPoint, undefined, "no address, nothing in its place");
});
