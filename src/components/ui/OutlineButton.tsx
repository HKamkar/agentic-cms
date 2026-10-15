import type { MouseEventHandler } from "react";
import { cx } from "agentic-cms/cx";
import { buttonClass } from "./Button";

type Props = {
  label: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** a toggle's state, read out as pressed or not; left out, the button is not a toggle */
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * A choice on the page (a filter, a toggle, a step, a consent answer): a real
 * `<button>` in the outline look, never a call to action, which is `Button`,
 * a link. Used from a client component, since it takes `onClick`.
 */
export function OutlineButton({ label, onClick, pressed, disabled, className }: Props) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} className={cx(buttonClass("outline"), className)}>
      {label}
    </button>
  );
}
