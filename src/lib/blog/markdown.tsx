import { compileMDX } from "next-mdx-remote/rsc";
import { nodeTypes } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { mdxComponents } from "@/components/blog/mdx";
import { postBlocks } from "@/components/blog/PostBody";
import rehypePostImages from "./rehype-post-images.ts";
import rehypePostBlocks from "./rehype-post-blocks.ts";
import type { Post } from "./posts.ts";

/**
 * Renders a post body to React in the post template's block structure.
 * - `.md`  : markdown (GFM) with raw HTML allowed, which is what the imported
 *            posts are.
 * - `.mdx` : full MDX, so a post can import and use React components.
 */
export async function renderPostBody(post: Post) {
  const isMd = post.format === "md";
  const { content } = await compileMDX({
    source: post.body,
    components: mdxComponents,
    options: {
      mdxOptions: {
        format: isMd ? "md" : "mdx",
        remarkPlugins: [remarkGfm],
        rehypePlugins: isMd ? [[rehypeRaw, { passThrough: [...nodeTypes] }], rehypeSlug, [rehypePostBlocks, { classes: postBlocks }], rehypePostImages] : [rehypeSlug, [rehypePostBlocks, { classes: postBlocks }], rehypePostImages],
      },
    },
  });
  return content;
}
