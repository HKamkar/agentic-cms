"use client";

// One of the site's own animated SVGs (SMIL), put inline so the page runs
// its clock — which an <img> keeps to itself. It waits on its first frame
// until it scrolls into view, plays from the start on each entry (once it
// has left the viewport entirely, as the reveals do: useReveal), pauses
// while off screen, and shows its rest frame — the svg's data-rest, in
// seconds, the frame the screenshot harness holds too — to a reader who
// prefers reduced motion. Decorative, so aria-hidden. The markup is a file of
// the site's, read when the page is built (readInlineSvg, agentic-cms/content),
// never user input. The svg fills the box from its own style attribute, so
// the first paint needs no stylesheet of the site's. No JSX: createElement,
// so it renders under node:test too.
import { createElement as h, useEffect, useMemo, useState } from "react";
import { useInView } from "motion/react";
import { useReducedMotionPref } from "./useMainBreakpoint.ts";
import { useReveal } from "./useReveal.ts";

export type InlineAnimationProps = {
  /** The SVG's markup: readInlineSvg(file, { prefix }) in the section's resolve or a server component. */
  markup: string;
  /** Classes of the box (its size, its ratio); the svg fills it. */
  className?: string;
  /** How far into the viewport, in percent, the box is before the loop starts (useReveal's offset); 0 by default. */
  offset?: number;
};

const FILL = "display:block;width:100%;height:100%";
/** The markup with its root svg filling the box: the fill put first in its style attribute, or given one. */
export const fillBox = (markup: string): string => markup.replace(/<svg\b([^>]*)>/, (tag, attrs: string) => (/\sstyle="/.test(attrs) ? tag.replace(/\sstyle="/, ` style="${FILL};`) : `<svg style="${FILL}"${attrs}>`));

/** An inline SMIL animation that plays in view, pauses off screen and rests under reduced motion. */
export function InlineAnimation({ markup, className, offset = 0 }: InlineAnimationProps) {
  // The box as state, and as the ref object the in-view hooks watch: nothing reads a ref during render.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const box = useMemo(() => ({ current: el }), [el]);
  const reduce = useReducedMotionPref();
  const plays = useReveal(box, offset);
  const visible = useInView(box);
  // Each play starts the clock from 0; under reduced motion it stands on the rest frame.
  useEffect(() => {
    const svg = el?.querySelector("svg");
    if (!svg) return;
    if (reduce || !plays) svg.pauseAnimations();
    else svg.unpauseAnimations();
    svg.setCurrentTime(reduce ? Number(svg.dataset.rest ?? 0) : 0);
  }, [el, reduce, plays]);
  // Off screen the clock stops, so the loop resumes where the reader left it.
  useEffect(() => {
    const svg = el?.querySelector("svg");
    if (!svg || reduce || !plays) return;
    if (visible) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [el, visible, reduce, plays]);
  return h("div", { ref: setEl, "aria-hidden": "true", className, dangerouslySetInnerHTML: { __html: fillBox(markup) } });
}
