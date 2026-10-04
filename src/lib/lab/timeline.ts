// The one timeline every animated preview in the kit is inspected with — the
// lab's own page, the lab route's scenes, a demo route's studies: play /
// pause, replay, a range over one cycle, the time and the cycle in seconds.
// Paused or scrubbed, a timeline holds every copy of the animation it wraps
// on one frame: each inline SVG's own timeline paused and set with
// setCurrentTime(), each CSS or Web Animation of an element inside an SVG —
// or inside a [data-lab-drive] subtree, for HTML/CSS motion — paused and
// set by currentTime, each lab frame (an iframe exposing window.lab)
// sought. Playing, it sets them going from one time together and lets each
// run on its own clock (the browser composites a transform or an opacity
// without the page's help), and sets them going together again at every
// cycle's start, so copies that drift apart meet there (WebKit advances
// visible and offscreen SVG timelines differently). It used to set every
// one on every frame, which repainted them all, every frame, on screen or
// not. A copy off screen stops while the timeline plays and joins its time
// again on its way back. Nothing else under the root is touched: a reveal
// of the page around it (Fx, OnView) keeps its own clock, where driving it
// replayed the reveal every cycle and folded it flat on a scrub. Two
// timelines on a page are independent: their own controls, their own
// cycle. An animated SVG inside an <img> is out of reach (its document is
// not the page's), which is why inspection uses inline copies.
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

/** Wires the timeline whose root is `root` (it holds a [data-lab-controls] element and the previews) and starts it; the returned destroy() removes every listener, the frame callback and the watch on what is off screen. */
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

  // What the timeline sets: the outermost SVGs (their SMIL), the CSS and Web Animations of what is inside an SVG or a [data-lab-drive] subtree of the root, every lab frame.
  type Lab = { seek(t: number): number; play(): void; pause(): void; duration(): number };
  const svgs = () => [...root.querySelectorAll("svg")].filter((svg) => !svg.parentElement?.closest("svg"));
  const frames = () => [...root.querySelectorAll("iframe")].flatMap((el) => { try { const lab = (el.contentWindow as (Window & { lab?: Lab }) | null)?.lab; return lab ? [{ el, lab }] : []; } catch { return []; } });
  const driven = (el: Element | null | undefined) => { if (!el) return false; if (el.closest("svg")) return true; const mark = el.closest("[data-lab-drive]"); return Boolean(mark && root.contains(mark)); };
  const animations = () => (typeof root.getAnimations === "function" ? root.getAnimations({ subtree: true }).filter((a) => driven((a.effect as KeyframeEffect | null)?.target)) : []);

  // Each thing it sets as a part: held on a frame (seek), set going from one (run), stopped where it is (stop). Its box is
  // what says whether it is on screen — its outermost SVG, its data-lab-drive element or its frame, or the nearest
  // ancestor of that which does not move itself, so nothing is stopped where its own motion took it.
  type Part = { box: Element; seek(t: number): void; run(t: number): void; stop(): void };
  const watched = (el: Element) => { let box = el; while (box !== root && box.parentElement && box.getAnimations().length) box = box.parentElement; return box; };
  function parts(): Part[] {
    const outer = svgs();
    const list: Part[] = outer.map((svg) => ({ box: watched(svg), seek: (t) => { svg.pauseAnimations(); svg.setCurrentTime(t); }, run: (t) => { svg.setCurrentTime(t); svg.unpauseAnimations(); }, stop: () => svg.pauseAnimations() }));
    for (const a of animations()) {
      const target = (a.effect as KeyframeEffect).target as Element;
      const end = Number(a.effect?.getComputedTiming().endTime ?? Infinity);
      const unit = outer.find((svg) => svg.contains(target)) ?? target.closest("[data-lab-drive]") ?? target;
      // Past its end a finite animation holds its last frame until the next cycle: play() would rewind it.
      list.push({ box: watched(unit), seek: (t) => { a.pause(); a.currentTime = t * 1000; }, run: (t) => { a.currentTime = t * 1000; if (t * 1000 < end) a.play(); else a.pause(); }, stop: () => a.pause() });
    }
    for (const { el, lab } of frames()) list.push({ box: watched(el), seek: (t) => { lab.seek(t); }, run: (t) => { lab.seek(t); lab.play(); }, stop: () => lab.pause() });
    return list;
  }

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
    for (const { lab } of frames()) max = Math.max(max, lab.duration() || 0);
    return max;
  }
  const clock = (now: number) => (offset + Math.max(0, now - startedAt) / 1000) % span;
  // Every copy on one frame, paused: at rest, on pause, on a scrub or a step, before a replay.
  function hold(t: number) {
    current = t;
    for (const part of parts()) part.seek(t);
  }
  // Every copy that is not off screen set going from `t` at `now`, together; from there each runs on its own clock.
  function go(t: number, now: number) {
    current = offset = t;
    startedAt = now;
    for (const part of parts()) {
      watcher?.observe(part.box);
      if (!away.has(part.box)) part.run(t);
    }
  }
  // A copy that leaves the screen (and half a screen around it) stops while the timeline plays; on its way back it is set going from the timeline's time.
  const away = new WeakSet<Element>();
  const watcher = typeof IntersectionObserver === "function" ? new IntersectionObserver(moved, { rootMargin: "50%" }) : null;
  function moved(entries: IntersectionObserverEntry[]) {
    const changed = new Set<Element>();
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting === !away.has(target)) continue;
      if (isIntersecting) away.delete(target);
      else away.add(target);
      changed.add(target);
    }
    if (!playing || !changed.size) return;
    const t = clock(performance.now());
    for (const part of parts()) {
      if (!changed.has(part.box)) continue;
      if (away.has(part.box)) part.stop();
      else part.run(t);
    }
  }
  function show(t: number) {
    slider.value = String(t);
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
  // The frame callback writes the controls alone; the animations run on. A cycle's end sets every copy going from the same time again.
  function tick(now: number) {
    const elapsed = offset + Math.max(0, now - startedAt) / 1000;
    if (elapsed >= span) go(elapsed % span, now);
    else current = elapsed;
    slider.value = String(current);
    if (now - readAt >= READOUT_MS) { show(current); readAt = now; }
    frame = requestAnimationFrame(tick);
  }
  function play() {
    if (!span || playing) return;
    playing = true;
    button.textContent = "Pause";
    go(current >= span ? 0 : current, performance.now());
    readAt = 0;
    frame = requestAnimationFrame(tick);
  }
  function halt() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    playing = false;
    button.textContent = "Play";
  }
  function pause() {
    if (playing) hold(clock(performance.now()));
    halt();
    show(current);
  }
  function seek(t: number) {
    halt();
    hold(Math.max(0, Math.min(span, t)));
    show(current);
  }
  function replay() { seek(0); play(); }

  listen(button, "click", () => (playing ? pause() : play()));
  listen(again, "click", replay);
  // A press on the range freezes the frame before it moves; every change (a drag, a tap, an arrow key) seeks.
  listen(slider, "pointerdown", pause);
  listen(slider, "input", () => seek(Number(slider.value)));
  // A lab frame loads after the page: measure again when nothing was declared, and put it on the timeline's time.
  for (const el of root.querySelectorAll("iframe")) listen(el, "load", () => {
    if (!options.duration) setSpan(measure());
    if (playing) return go(clock(performance.now()), performance.now());
    hold(current);
    if (autoplay && current === 0) play();
  });

  setSpan(options.duration || measure());
  if (autoplay && span) play();
  else seek(0);
  return { play, pause, seek, replay, time: () => current, duration: () => span, destroy: () => { pause(); watcher?.disconnect(); events.abort(); } };
}

/** The inline script that mounts a timeline on a page without React (the lab's own): mountTimeline's own source, called on the root `selector` names. */
export function timelineScript(selector: string, options: TimelineOptions = {}): string {
  return `(${String(mountTimeline)})(document.querySelector(${JSON.stringify(selector)}), ${JSON.stringify(options)});`;
}
