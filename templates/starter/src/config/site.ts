// Single place for everything brand- and site-specific. The post pipeline reads
// from here; swapping the brand means editing this file and the tokens in
// src/app/globals.css.
//
// Every page is a file, content/pages/<slug>.yaml (the SEO contract,
// src/lib/seo/README.md): its seo block is the sitemap entry, the breadcrumb
// name and what the build-time SEO audit expects to exist.
//
// `agentic-cms init` wrote this file for a new site: the name is the one it
// was given; a string that starts with the placeholder marker, and an address
// on a domain reserved for examples (.example), stand in for the site's own
// until it has them. `pnpm content:lint` lists what is left by line, and a
// production build (`pnpm build`) fails while any remains.
//
// The address is the server's alone (guardEmail, docs/email.md): no client
// component imports this file, whose whole text a bundle would carry. The
// layout and the footer, server components, hand the chrome's client
// components what they show as props.

import type { SiteConfig } from "agentic-cms";

export const site = {
  name: "{{name}}",
  shortName: "{{name}}",
  url: "{{url}}",
  locale: "en",
  ogLocale: "en_US",
  tagline: "(placeholder) What {{name}} does, in one sentence: the line under the brand in the footer.",
  description: "(placeholder) What a reader finds on {{name}}, in one or two sentences: the description of the feed.",
  email: "{{email}}",
  // No structured data carries the address as text (a ContactPoint with the
  // contact page's URL in its place) and the build runs guard-email; an
  // address public on purpose is { off: "<why>" }.
  guardEmail: true,
  logo: "/images/brand/{{slug}}-logo.svg",
  address: ["(placeholder) The street and number", "(placeholder) The city"],

  // Post URLs are /blog-post/<slug>; the route folder under src/app depends
  // on this prefix, so changing it means moving the folder and redirecting.
  postPrefix: "/blog-post",

  // Every page is served by this app; keep entries relative. The home page
  // carries the anchors (each section's id is its type), so the contact
  // form is reached in place rather than on a page of its own.
  links: {
    home: "/",
    blog: "/blog",
    contact: "/#contact-form",
  },
  nav: [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/#contact-form" },
  ],
  // The navbar's sign-in link: a stand-in on a reserved domain until the
  // site has one to link to, or a design without it.
  signIn: { label: "Sign in", href: "https://app.{{slug}}.example" },
  cta: { label: "Get in touch", href: "/#contact-form" },

  footer: {
    quickLinks: [
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/#contact-form" },
    ],
    // The site's profiles, absolute URLs; the stand-in goes once the real
    // ones are in (an empty list is fine: the structured data names none).
    social: [{ label: "LinkedIn", href: "https://linkedin.example/company/{{slug}}" }],
  },
} as const satisfies SiteConfig;

/** What the chrome says, in any language: the shape of `chrome` and of each language's block in `copy`. */
type ChromeWords = {
  skipLink: string;
  navbar: { label: string; menu: string };
  themeToggle: { system: string; light: string; dark: string };
  footer: { quickLinks: string; social: string };
  notFound: { label: string; title: string; text: readonly (string | { label: string; href: string })[] };
  post: { eyebrow: string; readingTime: (minutes: number) => string; related: string };
};

/** What the consent banner says, in any language. */
type ConsentWords = { title: string; text: string; decline: string; allow: string; settings: string };

/**
 * The chrome's own words: what the layout, the header, the footer, the 404
 * and the post template say around a page's copy (the page's is its file in
 * content/pages/, a post's its markdown; the consent banner's is
 * consentBanner, below). A sentence with links in it is its parts in reading
 * order, text and links, so the words around the links are written here too
 * and a translation can reorder them; a line with a number in it is a
 * function of the number.
 */
export const chrome = {
  /** The link a keyboard reaches first, to skip the header (app/layout.tsx). */
  skipLink: "Skip to content",
  /** ui/Navbar: the name of its navigation landmark, and the button that discloses the links below 992px. */
  navbar: { label: "Main", menu: "Menu" },
  /** ui/ThemeToggle's label in each of its three states. */
  themeToggle: { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" },
  /** ui/Footer's column titles, over footer.quickLinks and footer.social. */
  footer: { quickLinks: "Quick links", social: "Follow us" },
  /** app/not-found.tsx: the hero's label and heading, and the sentence under them. */
  notFound: {
    label: "404",
    title: "We couldn't find that page.",
    text: ["The page may have moved. ", { label: "Browse the latest posts", href: site.links.blog }, " or head ", { label: "home", href: site.links.home }, "."],
  },
  /** The post template (app/blog-post/[slug]/page.tsx): the hero's eyebrow, the reading time beside the author, the related posts' heading. */
  post: {
    eyebrow: "blog post",
    readingTime: (minutes: number) => `${minutes} min read`,
    related: "Read next",
  },
} as const satisfies ChromeWords;

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
} as const satisfies ConsentWords;

/**
 * The chrome's and the consent banner's words in each of the site's
 * languages, keyed by its tag: the default language's are the two above. A
 * language of site.locales adds its block, its 404's links under its own
 * prefix (docs/locales.md).
 */
const copy: Record<string, { chrome: ChromeWords; consentBanner: ConsentWords }> = {
  [site.locale]: { chrome, consentBanner },
};

/** The chrome's and the banner's words in the language with the tag: what the layout, the footer, the 404 and the post template read. */
export function copyFor(locale: string) {
  const words = copy[locale];
  if (!words) throw new Error(`src/config/site.ts: no words for the chrome in "${locale}" — a language of site.locales adds its block to copy`);
  return words;
}
