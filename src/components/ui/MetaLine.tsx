import { cx } from "agentic-cms/cx";

/** Small uppercase metadata as a class string, for a label that is not a `MetaLine` (a table's head, a chart's axis). */
export const metaLabel = "font-label text-h6 uppercase tracking-label text-muted";

/**
 * A line of small uppercase metadata: a post's category, date and reading
 * time. The items are separated by a dot that assistive technology skips;
 * an empty item is left out.
 */
export function MetaLine({ items, className }: { items: string[]; className?: string }) {
  return (
    <p className={cx(metaLabel, className)}>
      {items.filter(Boolean).map((item, i) => (
        <span key={`${i}-${item}`}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {item}
        </span>
      ))}
    </p>
  );
}
