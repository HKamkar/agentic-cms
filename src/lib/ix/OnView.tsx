"use client";

import { useAnimate, type AnimationSequence } from "motion/react";
import { createElement, useEffect, type CSSProperties, type ElementType, type ReactNode } from "react";
import { useMainBreakpoint, useReducedMotionPref } from "./useMainBreakpoint.ts";
import { useReveal } from "./useReveal.ts";

/**
 * Runs a Motion animation sequence scoped to this element each time it
 * scrolls into view after having left the viewport entirely (a "scroll into
 * view" trigger with a custom action list; see useReveal). `build` receives
 * the element and returns the sequence; selectors in the sequence are
 * resolved inside the element. `once` plays it a single time.
 */
export function OnView({
  build,
  once = false,
  offset = 0,
  mq = "all",
  as = "div",
  className,
  style,
  children,
  ...rest
}: {
  build: (root: HTMLElement) => AnimationSequence;
  once?: boolean;
  offset?: number;
  mq?: "all" | "main";
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  [attr: string]: unknown;
}) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const plays = useReveal(scope, offset, once);
  const isMain = useMainBreakpoint();
  const reduce = useReducedMotionPref();
  const enabled = mq === "all" || isMain === true;

  useEffect(() => {
    if (!enabled || !plays || !scope.current) return;
    const controls = animate(build(scope.current));
    // Reduced motion: the elements still have to end where the sequence
    // leaves them (their start states hide them), just without the journey.
    if (reduce) controls.complete();
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plays, enabled, reduce]);

  return createElement(as, { ref: scope, className, style, ...rest }, children);
}
