import { EagerImage } from "agentic-cms/components";
import { cx, variants, type VariantProps } from "agentic-cms/cx";

/**
 * The box a picture is drawn in: `fill` is the column's width at the file's
 * own ratio (`h-auto`, since base.css reverts preflight's height); `icon` is
 * a card's 64 px icon, `portrait` a review's 80 px portrait.
 */
export const media = variants({
  base: "block",
  variants: { size: { fill: "h-auto w-full", icon: "size-16", portrait: "size-20" } },
  defaults: { size: "fill" },
});

type Props = {
  src: string;
  /** what the picture shows, for whoever cannot see it; `""` only for a decorative picture */
  alt: string;
  /** the file's own size in px: the layout reserves the box before it loads */
  width: number;
  height: number;
  /** above the fold: loaded at once, through `EagerImage`, so it stays out of other pages' prefetches; lazy otherwise */
  eager?: boolean;
  /** the hairline around it (default); `false` where a frame around it already draws one */
  framed?: boolean;
  className?: string;
} & VariantProps<typeof media>;

/**
 * A picture the copy describes, so a section never writes `<img>`: in the
 * box its `size` names, lazy below the fold and eager above it. A picture
 * not drawn yet is `Placeholder`.
 */
export function Media({ src, alt, width, height, eager = false, framed = true, size, className }: Props) {
  const cls = cx(media({ size }), framed && "border border-line", className);
  return eager ? (
    <EagerImage src={src} alt={alt} width={width} height={height} className={cls} />
  ) : (
    <img src={src} alt={alt} width={width} height={height} loading="lazy" className={cls} />
  );
}
