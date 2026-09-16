import Link from "next/link";
import { createElement, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import type { MDXComponents } from "mdx/types";

type FxProps = { as?: ElementType; delay?: number | string; children?: ReactNode; [attr: string]: unknown };

/** What the `<fx>` wrapper keeps for itself; everything else is the element's own (className, data-faq, id). */
const WRAPPER_PROPS = ["as", "delay", "children"];

// Element overrides applied to every post body (both .md and .mdx).
export const mdxComponents: MDXComponents = {
  // rehype-post-blocks wraps every block it builds in <fx as="…" delay="…">.
  // The wireframe has no reveals, so the wrapper renders as the element it
  // names, carrying the block's own attributes; the delay goes nowhere.
  fx: (props: FxProps) => {
    const { as = "div", children } = props;
    return createElement(as, Object.fromEntries(Object.entries(props).filter(([attr]) => !WRAPPER_PROPS.includes(attr))), children);
  },
  a: ({ href = "", children, ...rest }: ComponentPropsWithoutRef<"a">) => {
    if (href.startsWith("/") || href.startsWith("#")) {
      return (
        <Link href={href} {...rest}>
          {children}
        </Link>
      );
    }
    const external = /^https?:\/\//.test(href);
    return (
      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
        {children}
      </a>
    );
  },
} as MDXComponents;
