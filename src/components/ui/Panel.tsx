import type { HTMLAttributes } from "react";
import { cx, variants, type VariantProps } from "agentic-cms/cx";

/**
 * The site's surfaces. `solid` is a panel: the hairline, the panel radius
 * and shadow, each a role token, and no ground of its own in the wireframe
 * (a design that gives panels a face adds `bg-panel` here). `dashed`
 * outlines a group of panels. A new surface is a new option here, never a
 * bordered `<div>` in a section. `panel()` is the frame as a class string,
 * for an element a component has to draw itself (a card that is a link, a
 * dialog with a ref).
 */
export const panel = variants({
  variants: {
    variant: {
      solid: "border border-line rounded-panel shadow-panel",
      dashed: "border border-dashed border-line rounded-panel",
    },
  },
  defaults: { variant: "solid" },
});

export type PanelVariant = NonNullable<VariantProps<typeof panel>["variant"]>;

type Props = HTMLAttributes<HTMLElement> & {
  /** the element it draws: a `div`, or the `li` of a card list */
  as?: "div" | "li" | "article" | "aside";
  variant?: PanelVariant;
};

/**
 * A surface around content: a section's box, a card's frame, the footer.
 * Any attribute passes through (`id`, `data-section`, aria); `className`
 * adds the layout and the spacing inside, never a look of its own.
 */
export function Panel({ as: Tag = "div", variant, className, ...rest }: Props) {
  return <Tag className={cx(panel({ variant }), className)} {...rest} />;
}
