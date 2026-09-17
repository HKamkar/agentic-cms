import Link from "next/link";
import { cx } from "content-engine-kit/cx";

export type ButtonVariant = "solid" | "outline";

const box = "inline-flex items-center justify-center border border-ink px-5 py-2.5 font-medium no-underline";

/** The button's classes on their own, for a real `<button>` (a form's submit). */
export const buttonClass = (variant: ButtonVariant = "solid") => box + (variant === "solid" ? " bg-ink text-paper" : " bg-paper text-ink");

type Props = {
  href: string;
  label: string;
  variant?: ButtonVariant;
  current?: boolean;
  className?: string;
};

/**
 * The site's button, always a link: an internal href renders next/link, an
 * absolute one a plain `<a>`. A form's submit is a real `<button>` wearing
 * `buttonClass` (ui/form/SubmitButton).
 */
export function Button({ href, label, variant = "solid", current = false, className }: Props) {
  const cls = cx(buttonClass(variant), className);
  return href.startsWith("/") ? (
    <Link href={href} className={cls} aria-current={current ? "page" : undefined}>
      {label}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {label}
    </a>
  );
}
