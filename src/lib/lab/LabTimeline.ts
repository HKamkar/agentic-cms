"use client";

// The timeline as a client component, for a route: the controls rendered as
// markup React never touches again (the timeline owns them after mount, so
// the server's HTML and the client's agree), the previews as children, and
// mountTimeline() called when the element attaches and destroyed with it
// (a callback ref with a cleanup: no ref is read during render). The
// animation it wraps — inline SVGs, their SMIL and CSS, and HTML/CSS motion
// under a data-lab-drive attribute — runs on its one clock; the page's
// reveals around it keep theirs, and another LabTimeline has its own. An <img> of
// an animated file cannot be driven: put the SVG inline (LabStudy does). No
// JSX: createElement, like LabScenes, so it renders under node:test too.
import { createElement as h, useCallback, type ReactNode } from "react";
import { TIMELINE_CSS, mountTimeline, timelineControlsHtml } from "./timeline.ts";

export type LabTimelineProps = {
  /** What the timeline drives, for the group's accessible name: "Candidate A", "mark". */
  label: string;
  /** One cycle in seconds, from the scene's metadata or source (sceneDuration()); 0: measured in the browser. */
  duration?: number;
  /** Start playing (default: yes, unless the reader prefers reduced motion). */
  autoplay?: boolean;
  /** The previews: every copy of one animation, at its sizes, on its grounds. */
  children?: ReactNode;
};

/** One animation's previews under one clock, with play / pause, replay and a range over one cycle. */
export function LabTimeline({ label, duration = 0, autoplay, children }: LabTimelineProps) {
  const attach = useCallback((root: HTMLDivElement | null) => {
    if (!root) return;
    const timeline = mountTimeline(root, { duration, autoplay });
    return () => timeline.destroy();
  }, [duration, autoplay]);
  return h("div", { ref: attach, "data-lab-timeline": "", role: "group", "aria-label": `${label}: timeline` },
    h("style", { dangerouslySetInnerHTML: { __html: TIMELINE_CSS } }),
    h("div", { className: "lab-timeline", "data-lab-controls": "", dangerouslySetInnerHTML: { __html: timelineControlsHtml({ duration }) } }),
    children,
  );
}
