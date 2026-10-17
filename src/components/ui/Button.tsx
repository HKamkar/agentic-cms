import Link from "next/link";
import { cx, variants, type VariantProps } from "agentic-cms/cx";

/** The button's looks: a new one is a new option here, never a styled link in a section. */
export const button = variants({
  base: "inline-flex items-center justify-center border border-line px-5 py-2.5 font-medium no-underline",
  variants: { variant: { solid: "bg-ink text-on-ink", outline: "bg-panel text-ink" } },
  defaults: { variant: "solid" },
});

export type ButtonVariant = NonNullable<VariantProps<typeof button>["variant"]>;

/** The button's classes on their own, for a real `<button>` (a form's submit, `OutlineButton`). */
export const buttonClass = (variant: ButtonVariant = "solid") => button({ variant });

type Props = {
  href: string;
  label: string;
  variant?: ButtonVariant;
  current?: boolean;
  className?: string;
};

/**
 * The call to action, always a link: an internal href renders next/link, an
 * absolute one a plain `<a>`. A form's submit is a real `<button>` wearing
 * `buttonClass` (ui/form/SubmitButton); a choice on the page is
 * `OutlineButton`; an icon alone is `IconButton`.
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
