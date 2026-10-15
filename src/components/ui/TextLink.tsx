import Link from "next/link";
import type { ReactNode } from "react";

const isExternal = (href: string) => /^https?:\/\//.test(href);

type Props = { href: string; className?: string; children: ReactNode };

/**
 * A link in running copy, so a section never writes `<a>`: a path or an
 * anchor goes through next/link, an http(s) address opens in a new tab
 * (`noopener noreferrer`), anything else (`mailto:`, `tel:`) is a plain link.
 * It keeps the page's underline (base.css). A link that looks like a button
 * is `Button`; a link in the chrome is `NavLink`.
 */
export function TextLink({ href, className, children }: Props) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}
