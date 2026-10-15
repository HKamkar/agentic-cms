import { EagerImage } from "agentic-cms/components";
import { cx } from "agentic-cms/cx";

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
};

/**
 * A picture the copy describes, so a section never writes `<img>`: full
 * width at its own ratio (`h-auto`, since base.css reverts preflight's
 * height), lazy below the fold and eager above it. A picture not drawn yet
 * is `Placeholder`.
 */
export function Media({ src, alt, width, height, eager = false, framed = true, className }: Props) {
  const cls = cx("block h-auto w-full", framed && "border border-line", className);
  return eager ? (
    <EagerImage src={src} alt={alt} width={width} height={height} className={cls} />
  ) : (
    <img src={src} alt={alt} width={width} height={height} loading="lazy" className={cls} />
  );
}
