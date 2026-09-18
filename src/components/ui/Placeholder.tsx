import { cx } from "agentic-cms/cx";

/**
 * The stand-in for a picture: a crossed box at the ratio the real image will
 * have, labelled with what belongs there. Decorative on purpose — it says
 * nothing a screen reader needs, and the section around it carries the
 * meaning the picture would.
 */
export function Placeholder({ label = "illustration", ratio, className }: { label?: string; ratio: string; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("relative border border-ink bg-fill", ratio, className)}>
      <svg className="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute top-1 left-1 font-label text-h6 text-muted">{label}</span>
    </div>
  );
}
