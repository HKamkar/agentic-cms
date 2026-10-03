"use client";

import { useAnimate } from "motion/react";
import Link from "next/link";
import { createElement, useEffect, type CSSProperties, type ElementType, type ReactNode } from "react";
import { ease } from "./easing.ts";
import { useMainBreakpoint, useReducedMotionPref } from "./useMainBreakpoint.ts";
import { useReveal } from "./useReveal.ts";

/**
 * The classic "scroll into view" reveals (slide in / grow in / fade in),
 * reproduced with the same numbers: 1000ms, ease-out-quart, 100px travel,
 * trigger when the element is `offset`% into the viewport, replayed on each
 * entry after the element has left the viewport entirely (the element snaps
 * back to its start pose, then animates; see useReveal). `duration` and
 * `distance` change the numbers.
 *
 * `mq="main"` limits the effect to desktop (>= 992px), like a design tool's
 * breakpoint setting: smaller screens render the element as-is.
 *
 * `intro` is for the first screen — a hero's copy. A scroll reveal holds its
 * start pose until the scripts have loaded and hydrated, which on a phone
 * left a hero's text unseen for seconds; with `intro` the first entrance is
 * played by CSS from the first frame (the `ix-intro` keyframes in the site's
 * src/styles/motion.css, which read the numbers from custom properties) and
 * only the replays are Motion's. It plays at every width (`mq` aside), and
 * under reduced motion or without scripts the element simply shows.
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

/** Each preset's start pose at the default 100px travel. */
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
  /** milliseconds the animation takes (default 1000) */
  duration?: number;
  /** pixels a slide travels (default 100) */
  distance?: number;
  /** trigger offset from the bottom of the viewport, in % (default 12) */
  offset?: number;
  /** "main" = desktop only, like a design tool's breakpoint toggle */
  mq?: "all" | "main";
  /** the first entrance by CSS from the first frame, for the first screen's copy */
  intro?: boolean;
  /** tag name, or "link" for a next/link anchor */
  as?: ElementType | "link";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  [attr: string]: unknown;
};

type Pose = { opacity: number; x: number; y: number; scale: number };
type Animate = ReturnType<typeof useAnimate<HTMLElement>>[1];

/** A preset's start pose at a travel of `distance` pixels. */
function startPose(preset: FxPreset, distance: number): Pose {
  const { x = 0, y = 0, scale = 1 } = START[preset];
  return { opacity: 0, x: (x * distance) / 100, y: (y * distance) / 100, scale };
}

/** Snaps back to the start pose, then plays; a play runs to its end even if the element leaves meanwhile. Returns the effect's cleanup. */
function play(el: HTMLElement, animate: Animate, start: Pose, delay: number, duration: number) {
  let cancelled = false;
  let controls: ReturnType<Animate> | undefined;
  (async () => {
    await animate(el, start, { duration: 0 });
    if (cancelled) return;
    controls = animate(el, { opacity: 1, x: 0, y: 0, scale: 1 }, { duration: duration / 1000, ease: ease("outQuart"), delay: delay / 1000 });
  })();
  return () => {
    cancelled = true;
    controls?.stop();
  };
}

/** The class that holds the element before its first play: the intro's keyframes, or the reveal's start state. */
function startClass(preset: FxPreset, mq: "all" | "main", intro: boolean, introPlaying: boolean) {
  if (intro) return introPlaying ? `ix-intro ix-intro--${preset}` : "";
  return mq === "main" ? `ix-main-init--${preset}` : `ix-init--${preset}`;
}

export function Fx({ preset = "slideInBottom", delay = 0, duration = 1000, distance = 100, offset = 12, mq = "all", intro = false, as = "div", className = "", style, children, ...rest }: Props) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const plays = useReveal(scope, offset);
  const isMain = useMainBreakpoint();
  const reduce = useReducedMotionPref();
  // The intro's CSS plays the first entrance; from the first replay the element is Motion's, like any Fx.
  const introPlaying = intro && plays <= 1;
  const enabled = intro || mq === "all" || isMain === true;

  useEffect(() => {
    if (!enabled || !scope.current) return;
    if (reduce) {
      animate(scope.current, { opacity: 1, x: 0, y: 0, scale: 1 }, { duration: 0 });
      return;
    }
    if (!plays) return;
    if (introPlaying) return;
    return play(scope.current, animate, startPose(preset, distance), delay, duration);
  }, [plays, enabled, reduce, introPlaying, preset, delay, duration, distance, animate, scope]);

  const numbers = intro ? ({ "--ix-delay": `${delay}ms`, "--ix-duration": `${duration}ms`, "--ix-distance": `${distance}px`, ...style } as CSSProperties) : style;
  const Tag: ElementType = as === "link" ? Link : as;
  return createElement(Tag, { ref: scope, className: `${startClass(preset, mq, intro, introPlaying)} ${className}`.trim(), style: numbers, ...rest }, children);
}
