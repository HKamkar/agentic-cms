import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogCard } from "@/components/blog/BlogCard";
import { PostBody } from "@/components/blog/PostBody";
import { JsonLd } from "@/components/JsonLd";
import { EagerImage } from "@/components/ui/EagerImage";
import { eyebrowText } from "@/components/ui/Eyebrow";
import { Section } from "@/components/ui/Section";
import { absoluteUrl, postUrl, site } from "@/config/site";
import { extractFaq } from "@/lib/blog/faq";
import { renderPostBody } from "@/lib/blog/markdown";
import { formatDate, getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog/posts";
import { postBreadcrumb } from "@/lib/seo/jsonld";
import { postMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ slug: string }> };

// Every post is rendered to static HTML at build time; unknown slugs 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  return post ? postMetadata(post) : {};
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const body = await renderPostBody(post);
  const related = getRelatedPosts(post);
  const faq = extractFaq(post.body);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url: absoluteUrl(postUrl(post.slug)),
    image: post.image ? { "@type": "ImageObject", url: absoluteUrl(post.image) } : undefined,
    author: {
      "@type": "Person",
      name: post.author.name,
      image: post.author.image ? { "@type": "ImageObject", url: absoluteUrl(post.author.image) } : undefined,
      jobTitle: post.author.title,
      description: post.author.bio,
    },
    publisher: {
      "@type": "Organization",
      name: site.name,
      logo: { "@type": "ImageObject", url: absoluteUrl(site.logo) },
    },
    datePublished: post.publishedAt ?? post.date,
    dateModified: post.updatedAt ?? post.publishedAt ?? post.date,
    inLanguage: site.locale,
    articleSection: post.category.name.toUpperCase(),
    keywords: post.keywords.join(", "),
  };

  const faqLd =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
        }
      : null;

  return (
    <>
      <JsonLd data={articleLd} />
      <JsonLd data={postBreadcrumb(post)} />
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
