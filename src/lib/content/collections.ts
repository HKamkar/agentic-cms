// The site's content contract: every collection under content/, with the
// schema each entry must satisfy. This is configuration in the sense of
// frontmatter.ts before it — the rules a file has to meet — not engine code;
// the engine (read.ts, schema.ts) knows nothing about posts or authors.
// Descriptions are the documentation: content/README.md's field tables are
// generated from them, so say what a field is and where it shows, and state
// a constraint or a derived default as a fact.

import { z } from "zod";
import { sectionSchema } from "@/components/sections/schemas";
import { defineCollection } from "./define";
import { dateOnly, isoTimestamp, optional, ref, text } from "./schema";

export const authorSchema = z
  .strictObject({
    name: text().describe("Shown in the byline, the author card and as the JSON-LD author"),
    title: optional(text()).describe("Role line under the name on the author card"),
    bio: optional(text()).describe("One or two sentences on the author card"),
    image: optional(text()).describe("Portrait under public/images/authors/"),
    imageAlt: optional(text()).describe("What the portrait shows"),
  })
  .describe("An author of posts; the key of content/authors.json is the slug a post's `author` names");

export const categorySchema = z
  .strictObject({
    name: text().describe("The label shown as the post's eyebrow and articleSection"),
  })
  .describe("A post category; the key of content/categories.json is the slug a post's `category` names");

export const postSchema = z
  .strictObject({
    title: text().describe("The H1 and card title, the <title> unless seoTitle is set, and the JSON-LD headline"),
    excerpt: optional(text()).describe("Card text, meta description fallback, RSS and JSON-LD description; 30–40 reader-focused words; required unless seoDescription is set"),
    date: dateOnly().describe("The editorial date readers see, YYYY-MM-DD (quote it); the primary sort key, newest first"),
    category: ref("categories").describe("The eyebrow label and articleSection, also the related-post fallback"),
    author: ref("authors").describe("The byline, the author card and the JSON-LD author"),
    image: optional(text()).describe("Hero image on the post page and the JSON-LD image, under public/images/blog/<slug>/"),
    imageAlt: optional(text()).describe("What the hero image shows, in a sentence"),
    thumbnail: optional(text()).describe("Card image (820×696); defaults to image"),
    thumbnailAlt: optional(text()).describe("What the card image shows"),
    ogImage: optional(text()).describe("Open Graph / Twitter image, about 1.91:1 and at least 1200 px wide; defaults to image, then thumbnail"),
    seoTitle: optional(text()).describe("The exact <title> and og:title, 60 characters or fewer; defaults to the title followed by \" | \" and the site's name"),
    seoDescription: optional(text()).describe("Meta description, 70–160 characters; defaults to excerpt"),
    keywords: optional(z.array(z.string({ error: "must be a string" }), { error: "must be a list of strings" })).describe("<meta keywords> and the JSON-LD keywords"),
    related: optional(z.array(ref("posts"), { error: "must be a list of strings" })).describe("Slugs shown first under \"Read next\", topped up by same category, then newest; every slug must exist, drafts included"),
    source: optional(text()).describe("Provenance note, e.g. the URL an imported post came from"),
    publishedAt: optional(isoTimestamp()).describe("ISO timestamp for JSON-LD datePublished, the RSS pubDate and the sitemap; set once when the post first goes live"),
    updatedAt: optional(isoTimestamp()).describe("ISO timestamp for JSON-LD dateModified; add it only after editing a published post (a value before publishedAt is clamped by posts.ts)"),
    draft: z.boolean({ error: "must be true or false" }).optional().describe("true keeps the post out of production builds; pnpm dev still renders it"),
  })
  .refine((post) => post.excerpt || post.seoDescription, { path: ["excerpt"], error: "is required (or seoDescription as a fallback)" })
  .describe("A post's frontmatter: content/blog/<slug>.md, where the filename is the URL /blog-post/<slug>");

export const reviewSchema = z
  .strictObject({
    name: text().describe("The reviewer, shown under the quote"),
    role: text().describe("Their role, shown in brackets after the name"),
    quote: text().describe("The quote as it reads on the slide, with its own quotation marks"),
    photo: text().describe("Portrait under public/images/home/ (about 80×80)"),
    photoAlt: optional(text()).describe("What the portrait shows; leave it out while the portrait is decorative"),
  })
  .describe("A client review on the home page slider, in slide order");

export const faqSchema = z
  .strictObject({
    items: z
      .array(
        z.strictObject({
          question: text().describe("The question, shown as the item's heading"),
          answer: text().describe("The answer, one paragraph, shown when the item opens"),
        }),
        { error: "must be a list of entries" },
      )
      .min(1, { error: "must have at least one entry" })
      .describe("The questions in order; each opens to its answer"),
  })
  .describe("A FAQ set: one file per page that shows one, the file name is the key the page reads it by");

export const useCaseSchema = z
  .strictObject({
    sector: text().describe("The tag above the title (Life sciences, Finance and banking, …)"),
    title: text().describe("The card title"),
    text: text().describe("The paragraph under the rule"),
    icon: text().describe("Illustration under public/images/use-cases/"),
  })
  .describe("A use-case card on the Use cases page, in order; the same list is the page's ItemList structured data");

const CHANGE_FREQUENCIES = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"] as const;

export const pageSeoSchema = z
  .strictObject({
    path: text()
      .refine((path) => path === "/" || /^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(path), { error: "must be / or /lowercase-words, without a trailing slash" })
      .describe("The route: / for the home page, else /lowercase-words; indexed once published, never changed without a redirect"),
    title: text().describe("The exact <title> and og:title: the topic first, the brand last, 60 characters or fewer, unique across pages"),
    description: text().describe("The meta description: the page's promise in one sentence, 70–160 characters"),
    ogImage: text().describe("The social image, a 1200×630 JPEG under public/images/, e.g. /images/home-og.jpg"),
    updated: dateOnly().describe("The date the content last changed, YYYY-MM-DD (quote it); the sitemap's lastmod — bump it with the copy, not on refactors"),
    breadcrumb: text().describe("The page's name in the breadcrumb trail and its structured data"),
    changeFrequency: z.enum(CHANGE_FREQUENCIES, { error: `must be one of ${CHANGE_FREQUENCIES.join(", ")}` }).optional().describe("The sitemap's changefreq hint"),
    priority: z.number({ error: "must be a number between 0 and 1" }).min(0, { error: "must be between 0 and 1" }).max(1, { error: "must be between 0 and 1" }).optional().describe("The sitemap's priority hint, 0–1"),
  })
  .describe("The SEO block: the <title>, meta description, canonical, Open Graph image, sitemap entry and breadcrumb name");

const application = z
  .strictObject({
    name: text().describe("The SoftwareApplication's name as it should read in structured data"),
    description: text().describe("One sentence on what the application is"),
    operatingSystem: text().describe("The operatingSystem value, e.g. On-premise"),
    offer: text().describe("The offer's description (no price)"),
    featureList: z.array(text(), { error: "must be a list of features" }).min(1, { error: "must have at least one feature" }).describe("The featureList, one short line each"),
    signIn: z.boolean({ error: "must be true or false" }).optional().describe("true adds the sign-in URL and the social profiles to the application"),
  })
  .describe("The SoftwareApplication the page is about");

export const jsonldSchema = z
  .discriminatedUnion(
    "type",
    [
      z
        .strictObject({
          type: z.literal("WebPage").describe("The schema.org page type"),
          application,
          itemList: optional(
            z.strictObject({
              name: text().describe("The list's name"),
              description: text().describe("The list's description"),
            }),
          ).describe("An ItemList of the page's use-case cards (needs a use-case-cards section)"),
          organization: z.enum(["provider", "publisher"], { error: "must be provider or publisher" }).describe("How the organisation is attached: as the page's provider (with its URL) or its publisher"),
        })
        .describe("A WebPage about the software (the home and Use cases pages)"),
      z
        .strictObject({
          type: z.literal("AboutPage").describe("The schema.org page type"),
          organization: z
            .strictObject({
              description: text().describe("One sentence on the organisation"),
              foundingDate: dateOnly().describe("The founding date, YYYY-MM-DD"),
              foundingLocation: z.strictObject({ locality: text().describe("The city"), country: text().describe("The two-letter country code") }).describe("Where it was founded"),
              slogan: text().describe("The slogan"),
              knowsAbout: z.array(text(), { error: "must be a list of topics" }).min(1, { error: "must have at least one topic" }).describe("The topics the organisation knows about"),
            })
            .describe("The organisation the page is about; name, logo, e-mail and profiles come from site.ts"),
        })
        .describe("An AboutPage about the organisation, with the page's FAQ as its FAQPage (needs a faq section)"),
      z
        .strictObject({
          type: z.literal("ContactPage").describe("The schema.org page type"),
          office: z
            .strictObject({
              streetAddress: text().describe("Street and number"),
              locality: text().describe("The city"),
              postalCode: text().describe("The postal code"),
              country: text().describe("The two-letter country code"),
            })
            .describe("The postal address"),
          contacts: z
            .array(z.strictObject({ type: text().describe("The contactType, e.g. customer service"), email: text().describe("The e-mail address") }), { error: "must be a list of contacts" })
            .min(1, { error: "must have at least one contact" })
            .describe("The contact points"),
        })
        .describe("A ContactPage with the organisation's address and contact points, and the page's FAQ as its FAQPage (needs a faq section)"),
      z.strictObject({ type: z.literal("Blog").describe("The schema.org page type") }).describe("A Blog listing every published post (nothing to declare)"),
    ],
    { error: () => "must be one of WebPage, AboutPage, ContactPage, Blog" },
  )
  .describe("The page's structured data: the copy of its JSON-LD block by page type");

export const pageSchema = z
  .strictObject({
    seo: pageSeoSchema,
    jsonld: jsonldSchema,
    sections: z.array(sectionSchema, { error: "must be a list of sections" }).min(1, { error: "must have at least one section" }).describe("The sections in order, each a `type` and its copy"),
  })
  .describe("A page: content/pages/<slug>.yaml — its SEO block, its structured data, and its sections in order (seo.path is the route; the file name is only the key)");

export type Author = z.output<typeof authorSchema>;
export type Category = z.output<typeof categorySchema>;
export type PostFrontmatter = z.output<typeof postSchema>;
export type Review = z.output<typeof reviewSchema>;
export type Faq = z.output<typeof faqSchema>;
export type UseCase = z.output<typeof useCaseSchema>;
export type PageSeo = z.output<typeof pageSeoSchema>;
export type ChangeFrequency = (typeof CHANGE_FREQUENCIES)[number];
export type PageJsonLd = z.output<typeof jsonldSchema>;
export type Page = z.output<typeof pageSchema>;

export const authors = defineCollection({ name: "authors", kind: "map", file: "authors.json", schema: authorSchema });
export const categories = defineCollection({ name: "categories", kind: "map", file: "categories.json", schema: categorySchema });
export const posts = defineCollection({ name: "posts", kind: "folder", dir: "blog", format: "markdown", schema: postSchema });
export const reviews = defineCollection({ name: "reviews", kind: "list", file: "reviews.yaml", schema: reviewSchema });
export const faqs = defineCollection({ name: "faqs", kind: "folder", dir: "faqs", format: "yaml", schema: faqSchema });
export const useCases = defineCollection({ name: "useCases", kind: "list", file: "use-cases.yaml", schema: useCaseSchema });
export const pages = defineCollection({ name: "pages", kind: "folder", dir: "pages", format: "yaml", schema: pageSchema });

/** Every collection, in the order scripts read and document them. */
export const collections = { authors, categories, posts, reviews, faqs, useCases, pages };
