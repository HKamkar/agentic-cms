// The one timeline every animated preview in the kit is inspected with — the
// lab's own page, the lab route's scenes, a demo route's studies: play /
// pause, replay, a range over one cycle, the time and the cycle in seconds.
// A timeline drives everything inside its root from one clock: each SVG's
// own timeline is paused and set with setCurrentTime(), each CSS animation
// paused and set by currentTime, each lab frame (an iframe exposing
// window.lab) sought — so the copies of one animation at several sizes,
// grounds and colours show the same frame, where free-running SVG timelines
// drift (WebKit advances visible and offscreen ones differently). Two
// timelines on a page are independent: their own controls, their own cycle.
// An animated SVG inside an <img> is out of reach (its document is not the
// page's), which is why inspection uses inline copies.
//
// mountTimeline is self-contained on purpose — no reference outside its own
// body — because two hosts run it: LabTimeline calls it from a ref, and
// the lab's served page, which has no React, inlines its source
// (timelineScript()).

export type TimelineOptions = {
  /** One cycle in seconds, from the scene's metadata or source; 0 or absent: measured from what the root holds. */
  duration?: number;
  /** Start playing (default: yes, unless the reader prefers reduced motion). */
  autoplay?: boolean;
};

export type Timeline = { play(): void; pause(): void; seek(t: number): void; replay(): void; time(): number; duration(): number; destroy(): void };

/** The controls' styles, scoped to a timeline root: 44 px targets for a finger, a visible focus ring, tabular figures. */
export const TIMELINE_CSS = `[data-lab-timeline] .lab-timeline { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0 0 1rem; font: .75rem/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
[data-lab-timeline] .lab-timeline button { font: inherit; color: inherit; background: none; border: 1px solid currentColor; min-height: 2.75rem; padding: 0 .875rem; cursor: pointer; touch-action: manipulation; }
[data-lab-timeline] .lab-timeline input[type="range"] { flex: 1 1 12rem; min-width: 0; max-width: 28rem; height: 2.75rem; margin: 0; accent-color: currentColor; touch-action: pan-y; }
[data-lab-timeline] .lab-timeline :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
[data-lab-timeline] .lab-timeline :disabled { opacity: .5; cursor: default; }
[data-lab-timeline] .lab-timeline [data-lab-readout] { min-width: 14ch; font-variant-numeric: tabular-nums; }`;

/** The controls inside a `.lab-timeline[data-lab-controls]` element: play / pause, replay, the range over one cycle (0.01 s a key press), the readout. */
export function timelineControlsHtml({ duration = 0 }: { duration?: number } = {}): string {
  const span = duration > 0 ? duration : 0;
  return `<button type="button" data-lab-play>Play</button><button type="button" data-lab-replay>Replay</button><input type="range" data-lab-time min="0" max="${span || 1}" step="0.01" value="0" aria-label="Time" aria-valuetext="0.00 of ${span.toFixed(2)} seconds"><span data-lab-readout>0.00 s / ${span.toFixed(2)} s</span>`;
}

/** Wires the timeline whose root is `root` (it holds a [data-lab-controls] element and the previews) and starts it; the returned destroy() removes every listener and the frame callback. */
export function mountTimeline(root: HTMLElement, options: TimelineOptions = {}): Timeline {
  const READOUT_MS = 100;
  const controls = root.querySelector("[data-lab-controls]") as HTMLElement;
  const button = controls.querySelector("[data-lab-play]") as HTMLButtonElement;
  const again = controls.querySelector("[data-lab-replay]") as HTMLButtonElement;
  const slider = controls.querySelector("[data-lab-time]") as HTMLInputElement;
  const readout = controls.querySelector("[data-lab-readout]") as HTMLElement;
  const events = new AbortController();
  const listen = (target: EventTarget, type: string, fn: () => void) => target.addEventListener(type, fn, { signal: events.signal });
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const autoplay = options.autoplay ?? !reduce;
  let span = 0, current = 0, offset = 0, startedAt = 0, readAt = 0, frame = 0, playing = false;

  // What the clock drives: the outermost SVGs (their SMIL), every CSS animation under the root, every lab frame.
  const svgs = () => [...root.querySelectorAll("svg")].filter((svg) => !svg.parentElement?.closest("svg"));
  const frames = () => [...root.querySelectorAll("iframe")].flatMap((f) => { try { const lab = (f.contentWindow as (Window & { lab?: { seek(t: number): number; duration(): number } }) | null)?.lab; return lab ? [lab] : []; } catch { return []; } });
  const animations = () => (typeof root.getAnimations === "function" ? root.getAnimations({ subtree: true }) : []);

  function measure(): number {
    let max = 0;
    for (const svg of svgs()) max = Math.max(max, Number(svg.getAttribute("data-duration")) || 0);
    if (max) return max;
    for (const a of animations()) {
      const t = a.effect?.getComputedTiming();
      if (t) max = Math.max(max, ((Number(t.delay) || 0) + (Number(t.duration) || 0) * (t.iterations === Infinity ? 1 : t.iterations || 1)) / 1000);
    }
    for (const el of root.querySelectorAll("animate, animateTransform, animateMotion, set")) {
      try { const d = (el as SVGAnimationElement).getSimpleDuration(); if (Number.isFinite(d)) max = Math.max(max, d); } catch { /* an indefinite duration */ }
    }
    for (const lab of frames()) max = Math.max(max, lab.duration() || 0);
    return max;
  }
  function apply(t: number) {
    current = t;
    for (const svg of svgs()) { svg.pauseAnimations(); svg.setCurrentTime(t); }
    for (const a of animations()) { a.pause(); a.currentTime = t * 1000; }
    for (const lab of frames()) lab.seek(t);
    slider.value = String(t);
  }
  function show(t: number) {
    const text = `${t.toFixed(2)} s / ${span.toFixed(2)} s`;
    if (readout.textContent !== text) readout.textContent = text;
    slider.setAttribute("aria-valuetext", `${t.toFixed(2)} of ${span.toFixed(2)} seconds`);
  }
  function setSpan(seconds: number) {
    span = seconds > 0 ? seconds : 0;
    slider.max = String(span || 1);
    for (const control of [button, again, slider]) control.disabled = !span;
    show(Math.min(current, span));
  }
  function tick(now: number) {
    apply((offset + (now - startedAt) / 1000) % span);
    if (now - readAt >= READOUT_MS) { show(current); readAt = now; }
    frame = requestAnimationFrame(tick);
  }
  function play() {
    if (!span || playing) return;
    playing = true;
    offset = current >= span ? 0 : current;
    startedAt = performance.now();
    readAt = 0;
    button.textContent = "Pause";
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    playing = false;
    button.textContent = "Play";
    show(current);
  }
  function seek(t: number) {
    pause();
    apply(Math.max(0, Math.min(span, t)));
    show(current);
  }
  function replay() { seek(0); play(); }

  listen(button, "click", () => (playing ? pause() : play()));
  listen(again, "click", replay);
  // A press on the range freezes the frame before it moves; every change (a drag, a tap, an arrow key) seeks.
  listen(slider, "pointerdown", pause);
  listen(slider, "input", () => seek(Number(slider.value)));
  // A lab frame loads after the page: measure again when nothing was declared, and put it on the clock.
  for (const f of root.querySelectorAll("iframe")) listen(f, "load", () => { if (!options.duration) setSpan(measure()); if (playing) return; apply(current); if (autoplay && current === 0) play(); });

  setSpan(options.duration || measure());
  apply(0);
  if (autoplay) play();
  else pause();
  return { play, pause, seek, replay, time: () => current, duration: () => span, destroy: () => { pause(); events.abort(); } };
}

/** The inline script that mounts a timeline on a page without React (the lab's own): mountTimeline's own source, called on the root `selector` names. */
export function timelineScript(selector: string, options: TimelineOptions = {}): string {
  return `(${String(mountTimeline)})(document.querySelector(${JSON.stringify(selector)}), ${JSON.stringify(options)});`;
}
