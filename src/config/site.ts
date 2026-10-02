// Single place for everything brand- and site-specific. The blog engine reads
// from here; swapping the brand means editing this file and the tokens in
// src/app/globals.css.
//
// Every page is a file, content/pages/<slug>.yaml (the SEO contract,
// src/lib/seo/README.md): its seo block is the sitemap entry, the breadcrumb
// name and what the build-time SEO audit expects to exist.

import type { SiteConfig } from "agentic-cms";

export const site = {
  name: "Acme",
  shortName: "Acme",
  url: "https://acme.example",
  locale: "en",
  tagline: "A CMS whose editor is an AI agent. Pages, posts and copy are files the build checks.",
  description: "Notes from the Acme team on running a site whose content lives in files: pages as YAML, posts as markdown, and the checks that read them on every build.",
  email: "hello@acme.example",
  logo: "/images/brand/logo.svg",
  address: ["1 Example Street", "Example City"],

  // Post URLs are /blog-post/<slug>; the route folder under src/app depends
  // on this prefix, so changing it means moving the folder and redirecting.
  postPrefix: "/blog-post",

  // Every page is served by this app; keep entries relative. The landing page
  // carries the anchors (each section's id is its type), so the contact form
  // and the use-case cards are reached in place rather than on a page of
  // their own.
  links: {
    home: "/",
    blog: "/blog",
    contact: "/#contact-form",
  },
  nav: [
    { label: "Home", href: "/" },
    { label: "Use cases", href: "/#use-case-cards" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/#contact-form" },
  ],
  signIn: { label: "Sign in", href: "https://app.acme.example" },
  cta: { label: "Get in touch", href: "/#contact-form" },

  footer: {
    quickLinks: [
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/#contact-form" },
      { label: "Sections: home", href: "/sections/home" },
      { label: "Sections: about", href: "/sections/about" },
      { label: "Sections: use cases", href: "/sections/use-cases" },
      { label: "Sections: contact", href: "/sections/contact" },
    ],
    // Nothing real is linked: the audit only asks that a sameAs is absolute.
    social: [
      { label: "LinkedIn", href: "https://linkedin.example/company/acme" },
      { label: "GitHub", href: "https://github.example/acme" },
    ],
  },
} as const satisfies SiteConfig;

/**
 * The consent banner's copy (ui/ConsentBanner; the mechanics are
 * agentic-cms/consent and src/config/analytics.ts). The banner shows only
 * when a Google tag id is set, and says what it asks: the tag, the cookies,
 * what declining means, where to change the answer — `settings`, the label of
 * the footer button that opens the banner again. Decline and Allow are equal
 * by rule. Raise analytics.consent.version when what this asks changes.
 */
export const consentBanner = {
  title: "Analytics cookies",
  text: "May we measure visits with Google Analytics? It sets cookies on your device. Decline, and nothing about your visit is sent to Google. Change your answer at any time with Cookie settings, at the bottom of every page.",
  decline: "Decline",
  allow: "Allow",
  settings: "Cookie settings",
} as const;
