"use client";

// How a root of the play-once layer knows when to play. One observer for the
// whole page plays a root once, the first time it is 12 % into the viewport
// from the bottom (data-play), and then forgets it: no replay on a second
// scroll or a hover. A second one, without the margin, keeps data-visible on
// a root with loops while any of it is on screen, so its loops (flow, pulse,
// breathe) cost nothing while nobody can see them; it also plays a root that
// starts in the last 12 % of a screen's height of the page, which can never
// get 12 % into the viewport and would otherwise stay hidden. The site's
// motion.css does the rest, and hides nothing until motionScript() has armed
// the page.
import { useCallback } from "react";

/**
 * Makes an element a motion root: measures the stroke of every `draw` part
 * (--len), then plays it at once under a lab timeline (whose clock it is,
 * docs/lab.md § Inspecting motion) or where IntersectionObserver is missing,
 * and otherwise watches it until it plays. Returns what stops the watching.
 * Self-contained, every helper inside, so the browser tests run it as a
 * string; the page's pair of observers is kept on its document.
 */
export function armMotionRoot(el: Element): (() => void) | undefined {
  const draws = [...el.querySelectorAll<SVGGeometryElement>('[data-part="draw"]')];
  if (el.matches('[data-part="draw"]')) draws.push(el as SVGGeometryElement);
  for (const draw of draws) if (typeof draw.getTotalLength === "function") draw.style.setProperty("--len", String(Math.ceil(draw.getTotalLength() + 2)));
  if (el.closest("[data-lab-timeline]") || typeof IntersectionObserver === "undefined") {
    el.setAttribute("data-play", "");
    return undefined;
  }
  type Observers = { play: IntersectionObserver; visible: IntersectionObserver };
  const loops = '[data-part="flow"], [data-part="pulse"], [data-part="breathe"]';
  const key = Symbol.for("agentic-cms/ix motion roots");
  const holder = el.ownerDocument as unknown as Record<symbol, Observers | undefined>;
  const observers = (holder[key] ??= (() => {
    const play = (root: Element) => {
      root.setAttribute("data-play", "");
      shared.play.unobserve(root);
      if (!root.querySelector(loops)) shared.visible.unobserve(root);
    };
    /** Whether the root starts below the line 12 % of a screen above the page's end, where the play margin never reaches. */
    const pastTheLine = (root: Element) => {
      const view = root.ownerDocument.defaultView;
      if (!view) return false;
      return root.getBoundingClientRect().top + view.scrollY >= root.ownerDocument.documentElement.scrollHeight - 0.12 * view.innerHeight - 1;
    };
    const shared: Observers = {
      play: new IntersectionObserver((entries) => {
        for (const entry of entries) if (entry.isIntersecting) play(entry.target);
      }, { rootMargin: "0px 0px -12% 0px" }),
      visible: new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const root = entry.target;
          if (root.querySelector(loops)) root.toggleAttribute("data-visible", entry.isIntersecting);
          if (entry.isIntersecting && !root.hasAttribute("data-play") && pastTheLine(root)) play(root);
        }
      }),
    };
    return shared;
  })());
  if (!el.hasAttribute("data-play")) observers.play.observe(el);
  if (!el.hasAttribute("data-play") || el.querySelector(loops)) observers.visible.observe(el);
  return () => {
    observers.play.unobserve(el);
    observers.visible.unobserve(el);
  };
}

/** A ref callback that makes its element a motion root (armMotionRoot) and stops watching it when it unmounts. */
export function useMotionRoot<T extends Element>(): (el: T | null) => (() => void) | undefined {
  return useCallback((el: T | null) => (el ? armMotionRoot(el) : undefined), []);
}
