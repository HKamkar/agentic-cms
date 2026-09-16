import type { ReactNode } from "react";
import type { PostBlockClasses } from "@/lib/blog/rehype-post-blocks";
import { cx } from "@/lib/cx";
import { FaqAccordion } from "./FaqAccordion";
import styles from "./PostBody.module.css";

/**
 * The class names rehype-post-blocks puts on the blocks it builds from a
 * post's markdown, so the styling of a body lives here with the component
 * that renders it: utilities for the block layout, PostBody.module.css for
 * the element rules inside a run and for the accordion, which is the only
 * thing that hides an answer.
 */
export const postBlocks: PostBlockClasses = {
  run: styles.prose,
  quote: "my-8 border border-ink p-6",
  quoteInner: "flex items-start gap-4 max-sm:flex-col",
  quoteIcon: "/images/blog/ui/quote.svg",
  quoteText: "text-h4 font-medium",
  image: "my-8",
  imageWrap: "border border-ink",
  imageImg: "inline-block h-auto w-full align-middle",
  faqHeading: "mt-12 mb-4",
  faq: cx(styles.faq, "mb-8 border border-ink"),
};

/** A rendered post body: the blocks from rehype-post-blocks, with the FAQ accordion wired up. */
export function PostBody({ children }: { children: ReactNode }) {
  return <FaqAccordion>{children}</FaqAccordion>;
}
