"use client";

// A choreography of the play-once layer: when the sequence is first seen,
// each element inside it that part() marked plays once, after its own delay,
// and its loops run only while it is on screen — a drawing that builds up in
// steps, say. No JSX: createElement, so it renders under node:test too.
import { createElement, type ElementType, type ReactNode } from "react";
import { useMotionRoot } from "./useMotionRoot.ts";

export type SequenceProps = {
  /** the element it renders (default `div`; `svg` for a drawing) */
  as?: ElementType;
  /** the milliseconds the whole sequence takes, when over two seconds: data-settle, which the harness's settled frame waits for */
  settle?: number;
  className?: string;
  children?: ReactNode;
  [attr: string]: unknown;
};

/** Plays the parts inside it once, when it first scrolls into view. */
export function Sequence({ as = "div", settle, children, ...rest }: SequenceProps) {
  const ref = useMotionRoot<Element>();
  return createElement(as, { ...rest, ref, "data-motion-root": "", "data-settle": settle }, children);
}
