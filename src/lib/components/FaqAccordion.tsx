"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The site's FAQ accordion behaviour, unchanged: every h3 in a `[data-faq]`
 * block toggles the paragraphs that follow it; all answers start collapsed.
 * The open state is `aria-expanded` on the question and `data-open` on its
 * answers; the site's post body styles draw both.
 */
export function FaqAccordion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cleanups: Array<() => void> = [];
    root.querySelectorAll<HTMLElement>("[data-faq] h3").forEach((q) => {
      q.setAttribute("role", "button");
      q.setAttribute("aria-expanded", "false");
      q.setAttribute("tabindex", "0");
      const answers: HTMLElement[] = [];
      let sibling = q.nextElementSibling as HTMLElement | null;
      while (sibling && sibling.tagName !== "H3") {
        if (sibling.tagName === "P") answers.push(sibling);
        sibling = sibling.nextElementSibling as HTMLElement | null;
      }
      const toggle = () => {
        const open = q.getAttribute("aria-expanded") !== "true";
        q.setAttribute("aria-expanded", open ? "true" : "false");
        answers.forEach((a) => a.toggleAttribute("data-open", open));
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      };
      q.addEventListener("click", toggle);
      q.addEventListener("keydown", onKey);
      cleanups.push(() => {
        q.removeEventListener("click", toggle);
        q.removeEventListener("keydown", onKey);
      });
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
