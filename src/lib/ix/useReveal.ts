"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * When a scroll-into-view effect should play: once the element is `offset`%
 * into the viewport, and again only after it has left the viewport
 * entirely. Scrolling an element that is still partly on screen back and
 * forth across the trigger line does not replay it — on a phone a tall
 * block crosses that line constantly, and a replay in plain sight reads as
 * a glitch. `once` never re-arms. Returns the number of plays so far; an
 * effect keyed on it runs each play to its end.
 */
export function useReveal(scope: RefObject<HTMLElement | null>, offset: number, once = false): number {
  const inView = useInView(scope, { margin: `0px 0px ${-offset}% 0px` });
  const visible = useInView(scope);
  const armed = useRef(true);
  const [plays, setPlays] = useState(0);

  useEffect(() => {
    if (!inView || !armed.current) return;
    armed.current = false;
    setPlays((n) => n + 1);
  }, [inView]);

  useEffect(() => {
    if (!visible && !once) armed.current = true;
  }, [visible, once]);

  return plays;
}
