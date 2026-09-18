import Link from "next/link";
import { eyebrowText } from "@/components/ui/Eyebrow";
import { kit } from "@/kit";
import { formatDate, type PostMeta } from "agentic-cms/blog";

/** A post card: thumbnail, category, date and title, plus the excerpt on the index. */
export function BlogCard({ post, excerpt = false }: { post: PostMeta; excerpt?: boolean }) {
  return (
    <Link href={kit.urls.postUrl(post.slug)} className="flex h-full flex-col gap-3 border border-ink p-4 no-underline">
      {post.thumbnail && <img src={post.thumbnail} width={820} height={696} alt={post.thumbnailAlt || post.imageAlt} loading="lazy" className="block h-auto w-full border border-ink" />}
      <p className={eyebrowText}>{post.category.name}</p>
      <p className="text-muted">{formatDate(post.date)}</p>
      <h3 className="text-h4">{post.title}</h3>
      {excerpt && <p>{post.excerpt}</p>}
    </Link>
  );
}
