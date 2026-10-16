import { cx } from "agentic-cms/cx";

/**
 * The tag in a box's corner that names what drew it — a section's type, a
 * group's variant — so a reader of the wireframe sees which component
 * renders what. Decorative: the box's own heading carries the meaning.
 */
export function TypeTag({ label, className }: { label: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("inline-block border border-line bg-fill px-2 font-label text-h6", className)}>
      {label}
    </span>
  );
}
