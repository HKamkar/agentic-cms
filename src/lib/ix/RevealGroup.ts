"use client";

// A group of the play-once layer whose direct children enter in turn, once,
// when the group is first seen — the items of a list, the cells of a grid. Each child must be an element that takes `style` and a data
// attribute (an `li`, a `div`, a component that passes both through). No
// JSX: createElement, so it renders under node:test too.
import { Children, cloneElement, createElement, isValidElement, type CSSProperties, type ElementType, type ReactNode } from "react";
import { part, staggerDelay, type PartKind } from "./parts.ts";
import { useMotionRoot } from "./useMotionRoot.ts";

export type RevealGroupEffect = Extract<PartKind, "fade" | "rise" | "scale" | "pop">;

export type RevealGroupProps = {
  /** how each child enters: `rise` (default), `fade`, `scale` or `pop` */
  effect?: RevealGroupEffect;
  /** milliseconds before the first child */
  delay?: number;
  /** milliseconds between two children (default the site's --motion-stagger) */
  step?: number;
  /** the element it renders (default `div`; `ul` for a list of `li`) */
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  [attr: string]: unknown;
};

type Styled = { style?: CSSProperties };

/** Its children enter one after another, once, when the group first scrolls into view. */
export function RevealGroup({ effect = "rise", delay = 0, step, as = "div", children, ...rest }: RevealGroupProps) {
  const ref = useMotionRoot<HTMLElement>();
  const items = Children.toArray(children).map((child, index) => {
    if (!isValidElement<Styled>(child)) return child;
    const { style, ...attrs } = part(effect, 0, { style: child.props.style });
    return cloneElement(child, { ...attrs, style: { ...style, "--d": staggerDelay(index, delay, step) } } as Styled);
  });
  return createElement(as, { ...rest, ref, "data-motion-root": "" }, items);
}
