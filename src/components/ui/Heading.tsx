import type { ReactNode } from "react";
import { cx, variants, type VariantProps } from "agentic-cms/cx";
import { Reveal, type RevealEffect } from "agentic-cms/ix";

/** The heading's sizes, apart from its level: `auto` is the level's own size (base.css). */
export const heading = variants({
  variants: { size: { auto: "", h1: "text-h1", h2: "text-h2", h3: "text-h3", h4: "text-h4", h5: "text-h5", h6: "text-h6" } },
  defaults: { size: "auto" },
});

type Props = {
  /** its level in the page's outline (h2 unless told otherwise) */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** how it enters, once, through the play-once layer's `Reveal`: `rise`, `fade` or `scale`; none by default */
  entrance?: RevealEffect;
  /** with an entrance: the first screen's heading, played by CSS from the first frame */
  intro?: boolean;
  /** with an entrance: milliseconds after it is first seen */
  delay?: number;
  className?: string;
  children: ReactNode;
} & VariantProps<typeof heading>;

/**
 * A page or section heading. `as` is its level; `size` is how big it looks
 * when that differs (an `h3` set at `h4` size), and its type otherwise comes
 * from base.css. `entrance` makes it a `Reveal` that plays once; the
 * wireframe passes none, so nothing moves.
 */
export function Heading({ as: Tag = "h2", size, entrance, intro, delay, className, children }: Props) {
  const cls = cx(heading({ size }), className) || undefined;
  if (!entrance) return <Tag className={cls}>{children}</Tag>;
  return (
    <Reveal as={Tag} effect={entrance} intro={intro} delay={delay} className={cls}>
      {children}
    </Reveal>
  );
}
