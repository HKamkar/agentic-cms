import Link from "next/link";
import { eyebrowText } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
import { Media } from "@/components/ui/Media";
import { panel } from "@/components/ui/Panel";
import { kit } from "@/kit";
import { formatDate, type PostMeta } from "agentic-cms/blog";
import { cx } from "agentic-cms/cx";

/** A post card: thumbnail, category, date and title, plus the excerpt on the index. The whole card is the link, so it wears the panel as a class; a post in another language links under its prefix and dates in it. */
export function BlogCard({ post, excerpt = false }: { post: PostMeta; excerpt?: boolean }) {
  return (
    <Link href={kit.urls.postUrl(post.slug, post.locale)} className={cx(panel(), "flex h-full flex-col gap-3 p-4 no-underline")}>
      {post.thumbnail && <Media src={post.thumbnail} width={820} height={696} alt={post.thumbnailAlt || post.imageAlt || ""} />}
      <p className={eyebrowText}>{post.category.name}</p>
      <p className="text-muted">{formatDate(post.date, post.locale)}</p>
      <Heading as="h3" size="h4">{post.title}</Heading>
      {excerpt && <p>{post.excerpt}</p>}
    </Link>
  );
}
