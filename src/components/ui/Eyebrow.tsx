import { cx } from "agentic-cms/cx";

/** The label's own type, for a label that is not an `<Eyebrow>` (a card's category, a post's date). */
export const eyebrowText = "inline-block border border-ink bg-fill px-2 py-0.5 font-label text-h6 uppercase";

type Props = {
  label: string;
  className?: string;
};

/** The small boxed label above a heading. */
export function Eyebrow({ label, className }: Props) {
  return <p className={cx(eyebrowText, className)}>{label}</p>;
}
