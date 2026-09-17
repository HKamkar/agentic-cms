// Turns the `posts` collection (content/blog/*.md|mdx, read and validated
// by the content engine at build time — src/lib/content/README.md) into the
// Post objects the blog pages render: every derived field, the sort order
// and the related-post logic live here. Nothing runs at request time: every
// page that uses this is statically generated (generateStaticParams), so the
// Cloudflare Worker only ever serves pre-rendered HTML. The frontmatter
// contract is `postSchema` in src/lib/content/collections.ts; the pipeline
// is documented in ./README.md. createBlog() takes the site's registry, so
// the functions read the site's posts and nobody else's.

import { readCollection, readEntry, type Author as AuthorData, type Category as CategoryData, type Collections, type MarkdownEntry, type PostFrontmatter } from "../content/index.ts";

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

/** The post pipeline over a site's registry: the posts, their registries, the sort and the related-post logic. */
export function createBlog(collections: Pick<Collections, "authors" | "categories" | "posts">) {
  const getAuthor = (slug: string): Author => ({ slug, ...readEntry(collections.authors, slug).data });

  const getCategory = (slug: string): Category => ({ slug, ...readEntry(collections.categories, slug).data });

  const getAllCategories = (): Category[] => readCollection(collections.categories).map((entry) => ({ slug: entry.slug, ...entry.data }));

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
   * build worker, and re-deriving a dozen posts costs nothing, while in
   * `next dev` an edited file then shows on reload.
   */
  function getAllPosts(): Post[] {
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

  const getPostBySlug = (slug: string): Post | undefined => getAllPosts().find((p) => p.slug === slug);

  const getPostsByCategory = (category: string): Post[] => getAllPosts().filter((p) => p.category.slug === category);

  /** Related posts: the frontmatter list first, topped up with same-category, then newest. */
  function getRelatedPosts(post: Post, count = 3): Post[] {
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

  return { getAuthor, getCategory, getAllCategories, getAllPosts, getPostBySlug, getPostsByCategory, getRelatedPosts, formatDate };
}

export type Blog = ReturnType<typeof createBlog>;

export function formatDate(iso: string, locale = "en-US"): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
