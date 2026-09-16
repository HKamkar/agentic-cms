import type { ReactNode } from "react";

type Props = {
  as?: "h1" | "h2" | "h3";
  className?: string;
  children: ReactNode;
};

/** A page or section heading (h2 unless told otherwise); its type comes from base.css. */
export function Heading({ as: Tag = "h2", className, children }: Props) {
  return <Tag className={className}>{children}</Tag>;
}
