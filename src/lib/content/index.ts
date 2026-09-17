// The public surface of the content engine: import from "@/lib/content"
// (server code only — readCollection uses node:fs, which a client component
// cannot bundle; pass entries down as props). The contract is README.md.

import { collections, type Author, type Category, type Faq, type Page, type Review, type UseCase } from "./collections.ts";
import type { Entry } from "./define.ts";
import { readCollection, readEntry } from "./read.ts";

export { ContentError, type ContentIssue } from "./errors.ts";
export { defineCollection, contentRoot, type CollectionDef, type DataOf, type Entry, type EntryOf, type Format, type MarkdownEntry } from "./define.ts";
export { readCollection, readEntry } from "./read.ts";
export { text, optional, dateOnly, isoTimestamp, ref } from "./schema.ts";
export {
  collections,
  authorSchema,
  categorySchema,
  postSchema,
  reviewSchema,
  faqSchema,
  useCaseSchema,
  pageSeoSchema,
  jsonldSchema,
  pageSchema,
  type Author,
  type Category,
  type ChangeFrequency,
  type Faq,
  type Page,
  type PageJsonLd,
  type PageSeo,
  type PostFrontmatter,
  type Review,
  type UseCase,
} from "./collections.ts";

/** Every author, slug = key of content/authors.json. */
export const getAuthors = (): Entry<Author>[] => readCollection(collections.authors);

/** Every category, slug = key of content/categories.json. */
export const getCategories = (): Entry<Category>[] => readCollection(collections.categories);

/** The home page reviews, in slide order. */
export const getReviews = (): Review[] => readCollection(collections.reviews).map((entry) => entry.data);

/** The FAQ set content/faqs/<slug>.yaml; a slug nobody wrote fails the build naming the ones that exist. */
export const getFaq = (slug: string): Faq => readEntry(collections.faqs, slug).data;

/** The use-case cards, in order. */
export const getUseCases = (): UseCase[] => readCollection(collections.useCases).map((entry) => entry.data);

/** Every page file, in folder order (the sitemap's order); `data.seo.path` is the route. */
export const getPages = (): Entry<Page>[] => readCollection(collections.pages);

/** The page content/pages/<slug>.yaml; a slug nobody wrote fails the build naming the ones that exist. */
export const getPage = (slug: string): Page => readEntry(collections.pages, slug).data;
