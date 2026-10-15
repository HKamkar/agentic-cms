import type { MouseEventHandler, ReactNode } from "react";
import { cx, variants, type VariantProps } from "agentic-cms/cx";

/** The icon button's looks: a 44 px square on the hairline; a new look is a new option here. */
export const iconButton = variants({
  base: "inline-flex size-11 shrink-0 items-center justify-center border border-line",
  variants: { variant: { outline: "bg-panel text-ink", solid: "bg-ink text-on-ink" } },
  defaults: { variant: "outline" },
});

type Props = {
  /** what it does, read out in place of the icon and shown as its tooltip: required, since the icon says nothing to a screen reader */
  label: string;
  /** the icon (`Icon` from agentic-cms/components), rendered `aria-hidden` */
  icon: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** a toggle's state; left out, the button is not a toggle */
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
} & VariantProps<typeof iconButton>;

/**
 * A button that shows only an icon: a carousel's arrows, a dialog's close.
 * 44 px, so a finger hits it. Used from a client component, since it takes
 * `onClick`.
 */
export function IconButton({ label, icon, onClick, pressed, disabled, variant, className }: Props) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-label={label} title={label} className={cx(iconButton({ variant }), className)}>
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
    </button>
  );
}
