import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogCard } from "@/components/blog/BlogCard";
import { mdxComponents } from "@/components/blog/mdx";
import { PostBody, postBlocks } from "@/components/blog/PostBody";
import { eyebrowText } from "@/components/ui/Eyebrow";
import { Section } from "@/components/ui/Section";
import { kit } from "@/kit";
import { renderPostBody } from "agentic-cms/blog";
import { EagerImage, JsonLd } from "agentic-cms/components";

type Props = { params: Promise<{ slug: string }> };

const { blog, seo } = kit;
const { formatDate, getAllPosts, getPostBySlug, getRelatedPosts } = blog;

// Every post is rendered to static HTML at build time; unknown slugs 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  return post ? seo.postMetadata(post) : {};
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const body = await renderPostBody(post, { components: mdxComponents, blocks: postBlocks });
  const related = getRelatedPosts(post);
  const faqLd = seo.postFaqJsonLd(post);

  return (
    <>
      <JsonLd data={seo.postJsonLd(post)} />
      <JsonLd data={seo.postBreadcrumb(post)} />
      {faqLd && <JsonLd data={faqLd} />}

      <article>
        <Section type="post-hero" eyebrow="blog post" heading={post.title} headingAs="h1">
          {/* Above the fold in a server component: EagerImage keeps the preload hint out of the RSC payload. */}
          {post.image && <EagerImage src={post.image} width={1600} height={900} alt={post.imageAlt || ""} className="block h-auto w-full border border-ink" />}
        </Section>

        <Section type="post-body">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <p className={eyebrowText}>{formatDate(post.date)}</p>
            <p className="text-muted">
              {post.author.name} · {post.readingMinutes} min read
            </p>
          </div>
          <PostBody>{body}</PostBody>
        </Section>

        {related.length > 0 && (
          <Section type="post-related" heading="Read next">
            <ul className="grid gap-4 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.slug}>
                  <BlogCard post={p} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section type="post-author">
          <footer className="flex gap-4">
            {post.author.image && <img src={post.author.image} width={110} height={110} alt={post.author.imageAlt ?? ""} loading="lazy" className="size-28 border border-ink" />}
            <div className="flex flex-col gap-2">
              <p className="font-medium">{post.author.name}</p>
              {post.author.title && <p className="text-muted">{post.author.title}</p>}
              {post.author.bio && <p>{post.author.bio}</p>}
            </div>
          </footer>
        </Section>
      </article>
    </>
  );
}
