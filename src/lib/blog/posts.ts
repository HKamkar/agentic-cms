// Turns the `posts` collection (content/blog/*.md|mdx, read and validated
// by the content engine at build time — src/lib/content/README.md) into the
// Post objects the blog pages render: every derived field, the sort order
// and the related-post logic live here. Nothing runs at request time: every
// page that uses this is statically generated (generateStaticParams), so the
// Cloudflare Worker only ever serves pre-rendered HTML. The frontmatter
// contract is `postSchema` in src/lib/content/collections.ts; the pipeline
// is documented in ./README.md.

import { collections, readCollection, readEntry, type Author as AuthorData, type Category as CategoryData, type MarkdownEntry, type PostFrontmatter } from "@/lib/content";

export type Author = { slug: string } & AuthorData;

export type Category = { slug: string } & CategoryData;

export type PostMeta = {
  slug: string;
  title: string;
  excerpt: string;
  /** Editorial date shown to readers, YYYY-MM-DD */
  date: string;
  category: Category;
  author: Author;
  image?: string;
  imageAlt?: string;
  thumbnail?: string;
  thumbnailAlt?: string;
  ogImage?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords: string[];
  related: string[];
  source?: string;
  /** ISO timestamps, carried over from an imported post's structured data (datePublished / dateModified) */
  publishedAt?: string;
  updatedAt?: string;
  readingMinutes: number;
  format: "md" | "mdx";
  /** `draft: true` keeps a post out of production builds (still visible in `next dev`) */
  draft: boolean;
};

export type Post = PostMeta & { body: string };

const WORDS_PER_MINUTE = 225;

export function getAuthor(slug: string): Author {
  return { slug, ...readEntry(collections.authors, slug).data };
}

export function getCategory(slug: string): Category {
  return { slug, ...readEntry(collections.categories, slug).data };
}

export function getAllCategories(): Category[] {
  return readCollection(collections.categories).map((entry) => ({ slug: entry.slug, ...entry.data }));
}

function toPost(entry: MarkdownEntry<PostFrontmatter>): Post {
  const fm = entry.data;
  const words = entry.body.split(/\s+/).filter(Boolean).length;
  let updatedAt = fm.updatedAt;
  // An imported post can carry a dateModified earlier than datePublished; never publish that.
  if (fm.publishedAt && updatedAt && updatedAt < fm.publishedAt) updatedAt = fm.publishedAt;

  return {
    slug: entry.slug,
    title: fm.title,
    excerpt: fm.excerpt ?? fm.seoDescription ?? "",
    date: fm.date,
    category: getCategory(fm.category),
    author: getAuthor(fm.author),
    image: fm.image,
    imageAlt: fm.imageAlt ?? "",
    thumbnail: fm.thumbnail ?? fm.image,
    thumbnailAlt: fm.thumbnailAlt ?? "",
    // Social previews want ~1.91:1: the hero (1600×900) before the card.
    ogImage: fm.ogImage ?? fm.image ?? fm.thumbnail,
    seoTitle: fm.seoTitle,
    seoDescription: fm.seoDescription,
    keywords: fm.keywords ?? [],
    related: fm.related ?? [],
    source: fm.source,
    publishedAt: fm.publishedAt,
    updatedAt,
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    format: entry.format,
    draft: fm.draft ?? false,
    body: entry.body,
  };
}

/**
 * All posts, newest first. Drafts (`draft: true`) are skipped in production
 * builds. Not memoised here: the engine caches the validated entries per
 * build worker, and re-deriving eleven posts costs nothing, while in
 * `next dev` an edited file then shows on reload.
 */
export function getAllPosts(): Post[] {
  const posts = readCollection(collections.posts)
    .map(toPost)
    .filter((p) => !(p.draft && process.env.NODE_ENV === "production"));
  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const pa = a.publishedAt ?? "";
    const pb = b.publishedAt ?? "";
    if (pa !== pb) return pa < pb ? 1 : -1;
    return a.title.localeCompare(b.title);
  });
  return posts;
}

export function getPostBySlug(slug: string): Post | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}

export function getPostsByCategory(category: string): Post[] {
  return getAllPosts().filter((p) => p.category.slug === category);
}

/** Related posts: the frontmatter list first, topped up with same-category, then newest. */
export function getRelatedPosts(post: Post, count = 3): Post[] {
  const all = getAllPosts().filter((p) => p.slug !== post.slug);
  const picked: Post[] = [];
  const push = (p: Post | undefined) => {
    if (p && !picked.includes(p) && picked.length < count) picked.push(p);
  };
  post.related.forEach((slug) => push(all.find((p) => p.slug === slug)));
  all.filter((p) => p.category.slug === post.category.slug).forEach(push);
  all.forEach(push);
  return picked;
}

export function formatDate(iso: string, locale = "en-US"): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
