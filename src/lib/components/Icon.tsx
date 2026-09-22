// An inline SVG icon from path data, in the current colour: a line icon
// (`kind: "stroke"`, one or more paths, the stroke width the site's) or a
// mark (`kind: "fill"`, one path), on the 24 grid unless the data carries
// its own `viewBox`. The data comes from the site's own map
// (`agentic-cms icons add lucide:<name> | si:<slug> | file:<name>` writes
// src/config/icons.ts from the sets the site installs and its own drawings);
// the kit ships no icon data. Decorative by default (aria-hidden); with a
// `title` it is an image with a name. Server-safe: no hooks, no client
// directive.
import type { SVGProps } from "react";

export type IconData = { kind: "stroke" | "fill"; d: string | readonly string[]; viewBox?: string; title?: string };

export function Icon({ kind, d, viewBox = "0 0 24 24", size = 24, strokeWidth = 1.6, className, title, ...rest }: IconData & { size?: number; strokeWidth?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, "d" | "kind" | "viewBox">) {
  const paths = typeof d === "string" ? [d] : d;
  const paint = kind === "fill" ? { fill: "currentColor" } : { fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox={viewBox} width={size} height={size} className={className} {...paint} {...(title ? { role: "img" } : { "aria-hidden": true })} {...rest}>
      {title ? <title>{title}</title> : null}
      {paths.map((path, i) => (
        <path key={i} d={path} />
      ))}
    </svg>
  );
}
