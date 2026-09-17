// The public surface of the blog engine: the post pipeline over a site's
// registry (createBlog), the body renderer, the FAQ extractor and the two
// rehype plugins. The contract is README.md.
export { createBlog, formatDate, type Author, type Blog, type Category, type Post, type PostMeta } from "./posts.ts";
export { renderPostBody, type PostBodyOptions } from "./markdown.tsx";
// The type of the element overrides a site passes in, re-exported so the site needs no @types/mdx of its own.
export type { MDXComponents } from "mdx/types";
export { extractFaq, type FaqItem } from "./faq.ts";
export { default as rehypePostBlocks, type PostBlockClasses } from "./rehype-post-blocks.ts";
export { default as rehypePostImages } from "./rehype-post-images.ts";
