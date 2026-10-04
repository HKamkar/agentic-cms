import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { mountTimeline, timelineControlsHtml, timelineScript } from "./timeline.ts";

// A stub page: the controls, one SVG root with its own clock, one CSS
// animation inside it, a hand-cranked requestAnimationFrame over a fake
// now, and an IntersectionObserver the test reports to. Every write to an
// animation's time is counted: playing, the frames must not make any.
type Listener = () => void;
function control() {
  const listeners: Record<string, Listener[]> = {};
  return {
    textContent: "", disabled: false, value: "0", max: "1", attrs: {} as Record<string, string>,
    setAttribute(name: string, value: string) { this.attrs[name] = value; },
    addEventListener(type: string, fn: Listener, { signal }: { signal: AbortSignal }) {
      (listeners[type] ??= []).push(fn);
      signal.addEventListener("abort", () => { listeners[type] = listeners[type].filter((f) => f !== fn); });
    },
    fire(type: string) { for (const fn of listeners[type] ?? []) fn(); },
  };
}
// An element of the stub page: `closest` answers from the selectors it (or an ancestor) matches; `own` are the animations on it.
const element = (matches: Record<string, unknown>, own: unknown[] = [], parentElement: unknown = null) => ({ closest: (s: string) => matches[s] ?? null, getAnimations: () => own, parentElement });
function animation(target: unknown, iterations = Infinity, duration = 1000) {
  let time: number | null = 0;
  return {
    paused: false, writes: 0,
    get currentTime() { return time; },
    set currentTime(t: number | null) { time = t; this.writes += 1; },
    effect: { target, getComputedTiming: () => ({ delay: 0, duration, iterations, endTime: duration * iterations }) },
    pause() { this.paused = true; },
    play() { this.paused = false; },
  };
}
function page({ duration = "2", extra = [] as ReturnType<typeof animation>[] } = {}) {
  const [button, again, slider, readout] = [control(), control(), control(), control()];
  const inner = new Set<unknown>();
  const svg = {
    time: -1, paused: false, sets: 0, parentElement: { closest: () => null },
    contains: (el: unknown) => inner.has(el), getAnimations: () => [],
    getAttribute: (name: string) => (name === "data-duration" ? duration : null),
    pauseAnimations() { this.paused = true; }, unpauseAnimations() { this.paused = false; },
    setCurrentTime(t: number) { this.time = t; this.sets += 1; },
  };
  // the CSS animation of a shape inside the SVG: driven
  const shape = element({ svg });
  inner.add(shape);
  const css = animation(shape);
  const byRole: Record<string, unknown> = { "[data-lab-play]": button, "[data-lab-replay]": again, "[data-lab-time]": slider, "[data-lab-readout]": readout };
  const controls = { querySelector: (selector: string) => byRole[selector] };
  const inside = new Set<unknown>();
  const root = { querySelector: (s: string) => (s === "[data-lab-controls]" ? controls : null), querySelectorAll: (s: string) => (s === "svg" ? [svg] : []), getAnimations: () => [css, ...extra], contains: (el: unknown) => inside.has(el) };
  return { root: root as unknown as HTMLElement, button, again, slider, readout, svg, css, inside };
}

let now = 0, frames: (((t: number) => void) | null)[] = [], reduce = false;
type Watcher = { report: (entries: { target: unknown; isIntersecting: boolean }[]) => void; seen: Set<unknown>; disconnected: boolean };
let watchers: Watcher[] = [];
const saved = { performance: Object.getOwnPropertyDescriptor(globalThis, "performance") };
/** Advances the fake clock to `t` ms and runs the frame callbacks that were pending. */
const at = (t: number) => { now = t; const due = frames; frames = []; for (const fn of due) fn?.(t); };
const pending = () => frames.filter(Boolean).length;
/** Reports `target` coming on screen or leaving it, as the browser would after a scroll. */
const sight = (target: unknown, isIntersecting: boolean) => { for (const w of watchers) if (w.seen.has(target)) w.report([{ target, isIntersecting }]); };
const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-9;
beforeEach(() => {
  now = 0; frames = []; reduce = false; watchers = [];
  Object.defineProperty(globalThis, "performance", { value: { now: () => now }, configurable: true });
  Object.assign(globalThis, {
    requestAnimationFrame: (fn: (t: number) => void) => frames.push(fn),
    cancelAnimationFrame: (id: number) => { frames[id - 1] = null; },
    matchMedia: (query: string) => ({ matches: reduce && query.includes("reduce") }),
    IntersectionObserver: class {
      seen = new Set<unknown>();
      disconnected = false;
      report: Watcher["report"];
      constructor(report: Watcher["report"]) { this.report = report; watchers.push(this); }
      observe(el: unknown) { this.seen.add(el); }
      disconnect() { this.disconnected = true; this.seen.clear(); }
    },
  });
});
afterEach(() => {
  if (saved.performance) Object.defineProperty(globalThis, "performance", saved.performance);
  for (const name of ["requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "IntersectionObserver"]) delete (globalThis as Record<string, unknown>)[name];
});

test("the timeline drives what it wraps — the SVG's animations and a [data-lab-drive] subtree inside it — and leaves the page's reveals alone, in the clock and in the cycle", () => {
  const drive = element({});
  const reveal = animation(element({}), 1, 9000);
  const html = animation(element({ "[data-lab-drive]": drive }));
  const outer = animation(element({ "[data-lab-drive]": element({}) }));
  const p = page({ duration: "0", extra: [reveal, html, outer] });
  p.inside.add(drive);
  const t = mountTimeline(p.root, { autoplay: false });
  assert.equal(t.duration(), 1, "the 9 s reveal is not the cycle; the driven 1 s animations are");
  t.seek(0.5);
  assert.deepEqual([p.css.currentTime, html.currentTime], [500, 500], "inside the SVG, and under data-lab-drive in the root: driven");
  t.play();
  at(300);
  t.pause();
  assert.deepEqual([reveal.writes, reveal.paused], [0, false], "a reveal of the page: its own clock, never set");
  assert.deepEqual([outer.writes, outer.paused], [0, false], "a data-lab-drive above the root is not this timeline's");
  t.destroy();
});

test("playing, every copy runs on its own clock from one start and the frames write the controls alone; a pause holds every copy on the frame, a seek moves them all, play resumes from there, a cycle's end and a replay set them going together again", () => {
  const p = page();
  const t = mountTimeline(p.root);
  assert.deepEqual([p.button.textContent, p.slider.max, p.readout.textContent], ["Pause", "2", "0.00 s / 2.00 s"], "the cycle from data-duration");
  assert.deepEqual([p.svg.paused, p.svg.time, p.svg.sets, p.css.paused, p.css.currentTime, p.css.writes], [false, 0, 1, false, 0, 1], "set going once, from 0, together");
  at(500);
  at(1000);
  assert.deepEqual([p.svg.sets, p.css.writes, p.svg.paused, p.css.paused], [1, 1, false, false], "no frame writes to an animation");
  assert.deepEqual([t.time(), p.slider.value, p.readout.textContent], [1, "1", "1.00 s / 2.00 s"], "the controls follow the elapsed time");
  p.button.fire("click");
  assert.deepEqual([p.button.textContent, pending(), p.svg.paused, p.svg.time, p.css.paused, p.css.currentTime], ["Play", 0, true, 1, true, 1000], "paused: every copy held on the frame, no frame callback left");
  at(1500);
  assert.equal(p.svg.time, 1, "the frame stays where it was paused");
  p.slider.value = "1.23";
  p.slider.fire("input");
  assert.deepEqual([p.svg.time, p.css.currentTime, p.readout.textContent, p.slider.attrs["aria-valuetext"], p.button.textContent], [1.23, 1230, "1.23 s / 2.00 s", "1.23 of 2.00 seconds", "Play"]);
  p.slider.value = "1.24";
  p.slider.fire("input");
  assert.equal(p.svg.time, 1.24, "an arrow key's 0.01 s");
  p.button.fire("click");
  assert.deepEqual([p.svg.time, p.svg.paused, p.css.currentTime, p.css.paused], [1.24, false, 1240, false], "resumed from 1.24, every copy");
  const sets = p.svg.sets;
  at(1600);
  assert.ok(near(t.time(), 1.34) && p.svg.sets === sets, `on from 1.24 without a write: ${t.time()}`);
  at(2300);
  assert.ok(near(p.svg.time, 0.04) && near(p.css.currentTime, 40) && p.svg.sets === sets + 1 && !p.svg.paused, `the cycle's end sets every copy going together again: ${p.svg.time}`);
  p.again.fire("click");
  assert.deepEqual([p.svg.time, p.svg.paused, p.button.textContent], [0, false, "Pause"]);
  at(2550);
  assert.equal(t.time(), 0.25, "replay runs from zero");
});

test("the range follows every frame, the readout keeps a slower pace; a press on the range freezes the frame before it moves", () => {
  const p = page();
  mountTimeline(p.root);
  at(40);
  at(80);
  assert.deepEqual([p.slider.value, p.readout.textContent], ["0.08", "0.00 s / 2.00 s"], "the range moves every frame, the readout waits");
  at(160);
  at(200);
  assert.deepEqual([p.slider.value, p.readout.textContent], ["0.2", "0.16 s / 2.00 s"], "at most one readout per 100 ms");
  p.slider.fire("pointerdown");
  assert.deepEqual([p.button.textContent, pending(), p.svg.paused, p.svg.time, p.readout.textContent], ["Play", 0, true, 0.2, "0.20 s / 2.00 s"], "frozen where it was, and the readout says so at once");
});

test("a copy off screen stops while the timeline plays and joins its time on the way back; paused, it is held on the frame with the rest; a part that moves itself is watched through its parent", () => {
  const parent = element({});
  const drive: ReturnType<typeof element> = element({ "[data-lab-drive]": undefined }, [], parent);
  const slide = animation(drive);
  Object.assign(drive, { closest: (s: string) => (s === "[data-lab-drive]" ? drive : null), getAnimations: () => [slide] });
  const p = page({ extra: [slide] });
  p.inside.add(drive);
  const t = mountTimeline(p.root);
  const [watcher] = watchers;
  assert.ok(watcher.seen.has(p.svg), "the copy's own box is watched");
  assert.ok(watcher.seen.has(parent) && !watcher.seen.has(drive), "an element that moves itself is watched through its parent, which does not move, so its own motion never stops it");
  at(300);
  sight(p.svg, false);
  assert.deepEqual([p.svg.paused, p.css.paused, slide.paused], [true, true, false], "off screen: the SVG stops with the animations inside it; the rest plays on");
  at(1000);
  sight(p.svg, true);
  assert.deepEqual([p.svg.paused, p.svg.time, p.css.paused, p.css.currentTime], [false, 1, false, 1000], "back: set going from the timeline's time");
  sight(p.svg, false);
  p.button.fire("click");
  assert.deepEqual([p.svg.paused, p.svg.time, slide.currentTime], [true, 1, 1000], "paused: held on the frame with the rest, off screen too");
  p.button.fire("click");
  assert.deepEqual([p.svg.paused, slide.paused], [true, false], "play leaves it stopped until it comes back");
  t.destroy();
  assert.equal(watcher.disconnected, true, "destroy() ends the watch");
});

test("a finite animation past its end holds its last frame when the timeline plays on from there, and runs again from the cycle's start", () => {
  const drive = element({});
  const once = animation(element({ "[data-lab-drive]": drive }), 1, 500);
  const p = page({ extra: [once] });
  p.inside.add(drive);
  const t = mountTimeline(p.root, { autoplay: false });
  t.seek(1);
  t.play();
  assert.deepEqual([once.currentTime, once.paused, p.css.paused], [1000, true, false], "not rewound by play()");
  at(1100);
  assert.ok(near(once.currentTime, 100) && !once.paused, `the next cycle plays it from its start: ${once.currentTime}`);
  t.destroy();
});

test("reduced motion: the timeline waits on its first frame until Play; a cycle of 0 disables the controls", () => {
  reduce = true;
  const p = page();
  const t = mountTimeline(p.root);
  assert.deepEqual([p.button.textContent, pending(), p.svg.time, p.svg.paused, p.css.paused], ["Play", 0, 0, true, true]);
  p.button.fire("click");
  at(300);
  assert.deepEqual([p.svg.paused, t.time()], [false, 0.3], "an explicit Play still plays");
  reduce = false;
  const none = page({ duration: "0" });
  (none.root as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [];
  mountTimeline(none.root);
  assert.deepEqual([none.button.disabled, none.again.disabled, none.slider.disabled, pending()], [true, true, true, 1], "only the other timeline's frame is pending");
});

test("two timelines are independent, a declared cycle wins over the file's, and destroy() leaves no listener, frame or watch behind", () => {
  const a = page(), b = page({ duration: "4" });
  const ta = mountTimeline(a.root, { duration: 1 });
  const tb = mountTimeline(b.root);
  assert.deepEqual([ta.duration(), tb.duration()], [1, 4]);
  a.button.fire("click");
  at(700);
  assert.deepEqual([a.svg.paused, a.svg.time, b.svg.paused, tb.time()], [true, 0, false, 0.7], "pausing one leaves the other playing");
  ta.destroy();
  tb.destroy();
  assert.equal(pending(), 0);
  assert.ok(watchers.every((w) => w.disconnected));
  b.button.fire("click");
  a.slider.value = "0.5";
  a.slider.fire("input");
  assert.deepEqual([b.button.textContent, a.svg.time], ["Play", 0], "no listener answers after destroy()");
});

test("the controls' markup and the inline script: labelled, 0.01 s steps, the cycle shown; mountTimeline's own source, runnable on a page without React", () => {
  assert.equal(timelineControlsHtml({ duration: 2.5 }), '<button type="button" data-lab-play>Play</button><button type="button" data-lab-replay>Replay</button><input type="range" data-lab-time min="0" max="2.5" step="0.01" value="0" aria-label="Time" aria-valuetext="0.00 of 2.50 seconds"><span data-lab-readout>0.00 s / 2.50 s</span>');
  const script = timelineScript("[data-lab-timeline]", { duration: 2 });
  assert.match(script, /^\(function mountTimeline\(root[\s\S]*\)\(document\.querySelector\("\[data-lab-timeline\]"\), \{"duration":2\}\);$/);
  const mount = new Function(`return ${script.slice(1, script.lastIndexOf(")(document"))}`)() as typeof mountTimeline;
  const p = page();
  const t = mount(p.root, { duration: 2 });
  at(250);
  assert.deepEqual([t.time(), p.svg.paused], [0.25, false], "the inlined source runs on its own: it names nothing outside its body");
  t.pause();
  assert.equal(p.svg.time, 0.25);
});
