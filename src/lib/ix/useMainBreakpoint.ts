"use client";

import { useEffect, useState } from "react";

/**
 * The "main" breakpoint (>= 992px), the desktop layout. `null` until mounted so server and
 * first client render agree.
 */
export function useMainBreakpoint(): boolean | null {
  const [main, setMain] = useState<boolean | null>(null);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 992px)");
    const update = () => setMain(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return main;
}

export function useReducedMotionPref(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduce;
}
