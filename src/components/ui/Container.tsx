import type { ReactNode } from "react";
import { cx } from "agentic-cms/cx";

type Props = {
  className?: string;
  children: ReactNode;
};

/** The centred page column — one width for every section, so nothing on the page sets its own. */
export function Container({ className, children }: Props) {
  return <div className={cx("mx-auto w-full max-w-page px-4", className)}>{children}</div>;
}
