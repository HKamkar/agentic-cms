// The public surface of the content engine: import from "@/lib/content"
// (server code only — readCollection uses node:fs, which a client component
// cannot bundle; pass entries down as props). The contract is README.md.
// A site builds its registry once, from its section union, and reads it
// through the accessors createContent() returns; createKit() does both.

import type { ZodType } from "zod";
import type { Author, Category, Collections, Faq, Page, Review, SectionLike, UseCase } from "./collections.ts";
import type { Entry } from "./define.ts";
import { readCollection, readEntry } from "./read.ts";

export { ContentError, formatPath, type ContentIssue } from "./errors.ts";
export { defineCollection, lookup, contentRoot, type CollectionDef, type DataOf, type Entry, type EntryOf, type Format, type MarkdownEntry } from "./define.ts";
export { readCollection, readEntry, slugsOf, sourceOf } from "./read.ts";
export { readInlineSvg } from "./inline-svg.ts";
export { text, optional, dateOnly, isoTimestamp, ref } from "./schema.ts";
export {
  createCollections,
  pageSchema,
  authorSchema,
  categorySchema,
  postSchema,
  reviewSchema,
  faqSchema,
  useCaseSchema,
  pageSeoSchema,
  jsonldSchema,
  type Author,
  type Category,
  type ChangeFrequency,
  type Collections,
  type Faq,
  type Page,
  type PageJsonLd,
  type PageSeo,
  type PostFrontmatter,
  type Review,
  type SectionLike,
  type UseCase,
} from "./collections.ts";

/** The typed accessors over a site's registry: every collection as the pages read it. */
export function createContent<S extends ZodType<SectionLike>>(collections: Collections<S>) {
  return {
    /** Every author, slug = key of content/authors.json. */
    getAuthors: (): Entry<Author>[] => readCollection(collections.authors),
    /** Every category, slug = key of content/categories.json. */
    getCategories: (): Entry<Category>[] => readCollection(collections.categories),
    /** The reviews, in slide order. */
    getReviews: (): Review[] => readCollection(collections.reviews).map((entry) => entry.data),
    /** The FAQ set content/faqs/<slug>.yaml; a slug nobody wrote fails the build naming the ones that exist. */
    getFaq: (slug: string): Faq => readEntry(collections.faqs, slug).data,
    /** The use-case cards, in order. */
    getUseCases: (): UseCase[] => readCollection(collections.useCases).map((entry) => entry.data),
    /** Every page file, in folder order (the sitemap's order); `data.seo.path` is the route. */
    getPages: (): Entry<Page<S>>[] => readCollection(collections.pages),
    /** The page content/pages/<slug>.yaml; a slug nobody wrote fails the build naming the ones that exist. */
    getPage: (slug: string): Page<S> => readEntry(collections.pages, slug).data,
  };
}

export type Content<S extends ZodType<SectionLike> = ZodType<SectionLike>> = ReturnType<typeof createContent<S>>;
