"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const isExternal = (href: string) => /^https?:\/\//.test(href);

/**
 * A link in the chrome. It marks itself `aria-current="page"` only when its
 * href is exactly the path in the address bar, so a section anchor or an
 * off-site link is never the current page.
 */
export function NavLink({ href, label, className }: { href: string; label: string; className?: string }) {
  const pathname = usePathname();
  return isExternal(href) ? (
    <a href={href} className={className}>
      {label}
    </a>
  ) : (
    <Link href={href} className={className} aria-current={href === pathname ? "page" : undefined}>
      {label}
    </Link>
  );
}
