"use client";

// One element of the play-once layer: it enters once, the first time it is
// seen, and never again on a second scroll or a hover (Fx replays on each
// entry instead; STANDARD.md §7 says which to choose). At rest — no scripts,
// reduced motion, the harness's static captures — it is simply there. No
// JSX: createElement, so it renders under node:test too.
import { createElement, type CSSProperties, type ElementType, type ReactNode } from "react";
import { part, type PartKind } from "./parts.ts";
import { useMotionRoot } from "./useMotionRoot.ts";

export type RevealEffect = Extract<PartKind, "fade" | "rise" | "scale">;

export type RevealProps = {
  /** how it enters: `rise` (default), `fade` or `scale` */
  effect?: RevealEffect;
  /** milliseconds after its root plays */
  delay?: number;
  /** for copy on the first screen: the entrance starts with the first paint, so the scripts loading never leave it blank */
  intro?: boolean;
  /** the element it renders (default `div`) */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  [attr: string]: unknown;
};

/** One element that enters once, when it first scrolls into view (or from the first frame, with `intro`). */
export function Reveal({ effect = "rise", delay = 0, intro = false, as = "div", style, children, ...rest }: RevealProps) {
  const ref = useMotionRoot<HTMLElement>();
  return createElement(as, { ...rest, ...part(effect, delay, { style }), ref, "data-motion-root": "", "data-intro": intro ? "" : undefined }, children);
}
