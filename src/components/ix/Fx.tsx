"use client";

import { useAnimate, useInView } from "motion/react";
import Link from "next/link";
import { createElement, useEffect, type CSSProperties, type ElementType, type ReactNode } from "react";
import { ease } from "./easing";
import { useMainBreakpoint, useReducedMotionPref } from "./useMainBreakpoint";

/**
 * The classic "scroll into view" reveals (slide in / grow in / fade in),
 * reproduced with the same numbers: 1000ms, ease-out-quart, 100px travel,
 * trigger when the element is `offset`% into the viewport, replayed on every
 * entry (the element snaps back to its start pose, then animates).
 *
 * `mq="main"` limits the effect to desktop (>= 992px), like a design tool's
 * breakpoint setting: smaller screens render the element as-is.
 */

export type FxPreset =
  | "slideInBottom"
  | "slideInTop"
  | "slideInLeft"
  | "slideInRight"
  | "slideInTopLeft"
  | "slideInTopRight"
  | "slideInBottomLeft"
  | "slideInBottomRight"
  | "growIn"
  | "fadeIn";

const START: Record<FxPreset, { x?: number; y?: number; scale?: number }> = {
  slideInBottom: { x: 0, y: 100 },
  slideInTop: { x: 0, y: -100 },
  slideInLeft: { x: -100, y: 0 },
  slideInRight: { x: 100, y: 0 },
  slideInTopLeft: { x: -100, y: -100 },
  slideInTopRight: { x: 100, y: -100 },
  slideInBottomLeft: { x: -100, y: 100 },
  slideInBottomRight: { x: 100, y: 100 },
  growIn: { scale: 0.75 },
  fadeIn: {},
};

type Props = {
  preset?: FxPreset;
  /** milliseconds before the animation starts, once triggered */
  delay?: number;
  /** trigger offset from the bottom of the viewport, in % (default 12) */
  offset?: number;
  /** "main" = desktop only, like a design tool's breakpoint toggle */
  mq?: "all" | "main";
  /** tag name, or "link" for a next/link anchor */
  as?: ElementType | "link";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  [attr: string]: unknown;
};

export function Fx({ preset = "slideInBottom", delay = 0, offset = 12, mq = "all", as = "div", className = "", style, children, ...rest }: Props) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const inView = useInView(scope, { margin: `0px 0px ${-offset}% 0px` });
  const isMain = useMainBreakpoint();
  const reduce = useReducedMotionPref();
  const enabled = mq === "all" || isMain === true;

  useEffect(() => {
    if (!enabled || !scope.current) return;
    if (reduce) {
      animate(scope.current, { opacity: 1, x: 0, y: 0, scale: 1 }, { duration: 0 });
      return;
    }
    if (!inView) return;
    const el = scope.current;
    const start = { opacity: 0, x: 0, y: 0, scale: 1, ...START[preset] };
    let cancelled = false;
    let controls: ReturnType<typeof animate> | undefined;
    (async () => {
      // Snap back to the start pose, then play: the reveal replays on every entry.
      await animate(el, start, { duration: 0 });
      if (cancelled) return;
      controls = animate(el, { opacity: 1, x: 0, y: 0, scale: 1 }, { duration: 1, ease: ease("outQuart"), delay: delay / 1000 });
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [inView, enabled, reduce, preset, delay, animate, scope]);

  const initClass = mq === "main" ? `ix-main-init--${preset}` : `ix-init--${preset}`;
  const Tag: ElementType = as === "link" ? Link : as;
  return createElement(Tag, { ref: scope, className: `${initClass} ${className}`.trim(), style, ...rest }, children);
}
