import { compileMDX } from "next-mdx-remote/rsc";
import { nodeTypes } from "@mdx-js/mdx";
import type { MDXComponents } from "mdx/types";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypePostImages from "./rehype-post-images.ts";
import rehypePostBlocks, { type PostBlockClasses } from "./rehype-post-blocks.ts";
import type { Post } from "./posts.ts";

/** What the site brings to a body: its element overrides (the `fx` wrapper, links) and the class names of the four blocks. */
export type PostBodyOptions = { components: MDXComponents; blocks: PostBlockClasses };

/**
 * Renders a post body to React in the post template's block structure.
 * - `.md`  : markdown (GFM) with raw HTML allowed, which is what an imported
 *            post is.
 * - `.mdx` : full MDX, so a post can import and use React components.
 */
export async function renderPostBody(post: Post, { components, blocks }: PostBodyOptions) {
  const isMd = post.format === "md";
  const { content } = await compileMDX({
    source: post.body,
    components,
    options: {
      mdxOptions: {
        format: isMd ? "md" : "mdx",
        remarkPlugins: [remarkGfm],
        rehypePlugins: isMd ? [[rehypeRaw, { passThrough: [...nodeTypes] }], rehypeSlug, [rehypePostBlocks, { classes: blocks }], rehypePostImages] : [rehypeSlug, [rehypePostBlocks, { classes: blocks }], rehypePostImages],
      },
    },
  });
  return content;
}
