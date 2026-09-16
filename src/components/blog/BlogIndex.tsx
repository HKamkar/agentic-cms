import { BlogCard } from "@/components/blog/BlogCard";
import { BlogHero } from "@/components/blog/BlogHero";
import type { SectionProps } from "@/components/sections/schemas";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";
import type { PostMeta } from "@/lib/blog/posts";

type Props = SectionProps<"blog-index"> & { posts: PostMeta[] };

/** The blog index: the hero, then every published post as a card, newest first; the button is the current page. */
export function BlogIndex({ label, heading, listEyebrow, listHeading, cta, posts }: Props) {
  return (
    <>
      <BlogHero type="blog-index" label={label} title={heading} />
      <Section type="blog-index-list" eyebrow={listEyebrow} heading={listHeading}>
        <Button href={site.links.blog} label={cta} current />
        <ul className="mt-6 grid gap-4 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <BlogCard post={post} excerpt />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
