// The structured data of a post page: the BlogPosting block from the post's
// frontmatter and registries, and the FAQPage block from the questions in
// its body (src/lib/blog/faq.ts), which the accordion shows.

import { extractFaq } from "../blog/faq.ts";
import type { Post } from "../blog/posts.ts";
import type { SiteConfig, Urls } from "../site.ts";

export function createPostJsonLd({ site, urls }: { site: SiteConfig; urls: Urls }) {
  const { absoluteUrl, postUrl } = urls;

  /** The complete BlogPosting: headline, description, URL, image, author, publisher, both dates, section and keywords. */
  function postJsonLd(post: Post): Record<string, unknown> {
    return {
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
  }

  /** The FAQPage of the post's "Frequently asked questions" section, or null when the body has none. */
  function postFaqJsonLd(post: Post): Record<string, unknown> | null {
    const faq = extractFaq(post.body);
    if (faq.length === 0) return null;
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    };
  }

  return { postJsonLd, postFaqJsonLd };
}
