import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

const isExternal = (href: string) => /^https?:\/\//.test(href);

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode };

/**
 * A link in running copy, so a section never writes `<a>`: a path or an
 * anchor goes through next/link, an http(s) address opens in a new tab
 * (`noopener noreferrer`), anything else (`mailto:`, `tel:`) is a plain link.
 * Every other attribute passes through (a post body's `id`, `title`, aria).
 * It keeps the page's underline (base.css). A link that looks like a button
 * is `Button`; a link in the chrome is `NavLink`.
 */
export function TextLink({ href, children, ...rest }: Props) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
      {children}
    </a>
  );
}
