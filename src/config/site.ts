// Single place for everything brand- and site-specific. The blog engine reads
// from here; swapping the brand means editing this file and the tokens in
// src/app/globals.css.
//
// Every page is a file, content/pages/<slug>.yaml (the SEO contract,
// src/lib/seo/README.md): its seo block is the sitemap entry, the breadcrumb
// name and what the build-time SEO audit expects to exist.

export const site = {
  name: "Acme",
  shortName: "Acme",
  url: "https://acme.example",
  locale: "en",
  tagline: "A site kit whose pages, posts and copy are files the build checks.",
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
} as const;

export const postUrl = (slug: string) => `${site.postPrefix}/${slug}`;
export const absoluteUrl = (path: string) => new URL(path, site.url).toString();
