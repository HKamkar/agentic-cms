import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { mountTimeline, timelineControlsHtml, timelineScript } from "./timeline.ts";

// A stub page: the controls, one SVG root with its own clock, one CSS
// animation, and a hand-cranked requestAnimationFrame over a fake now.
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
function page({ duration = "2" } = {}) {
  const [button, again, slider, readout] = [control(), control(), control(), control()];
  const svg = { time: -1, paused: false, parentElement: { closest: () => null }, getAttribute: (name: string) => (name === "data-duration" ? duration : null), pauseAnimations() { this.paused = true; }, setCurrentTime(t: number) { this.time = t; } };
  const css = { currentTime: 0 as number | null, paused: false, effect: null, pause() { this.paused = true; } };
  const byRole: Record<string, unknown> = { "[data-lab-play]": button, "[data-lab-replay]": again, "[data-lab-time]": slider, "[data-lab-readout]": readout };
  const controls = { querySelector: (selector: string) => byRole[selector] };
  const root = { querySelector: (s: string) => (s === "[data-lab-controls]" ? controls : null), querySelectorAll: (s: string) => (s === "svg" ? [svg] : []), getAnimations: () => [css] };
  return { root: root as unknown as HTMLElement, button, again, slider, readout, svg, css };
}

let now = 0, frames: (((t: number) => void) | null)[] = [], reduce = false;
const saved = { performance: Object.getOwnPropertyDescriptor(globalThis, "performance") };
/** Advances the fake clock to `t` ms and runs the frame callbacks that were pending. */
const at = (t: number) => { now = t; const due = frames; frames = []; for (const fn of due) fn?.(t); };
const pending = () => frames.filter(Boolean).length;
beforeEach(() => {
  now = 0; frames = []; reduce = false;
  Object.defineProperty(globalThis, "performance", { value: { now: () => now }, configurable: true });
  Object.assign(globalThis, {
    requestAnimationFrame: (fn: (t: number) => void) => frames.push(fn),
    cancelAnimationFrame: (id: number) => { frames[id - 1] = null; },
    matchMedia: (query: string) => ({ matches: reduce && query.includes("reduce") }),
  });
});
afterEach(() => {
  if (saved.performance) Object.defineProperty(globalThis, "performance", saved.performance);
  for (const name of ["requestAnimationFrame", "cancelAnimationFrame", "matchMedia"]) delete (globalThis as Record<string, unknown>)[name];
});

test("the timeline plays every preview from one clock, pauses on the frame, seeks to the hundredth, resumes from there, wraps, replays from zero", () => {
  const p = page();
  mountTimeline(p.root);
  assert.deepEqual([p.button.textContent, p.slider.max, p.readout.textContent, p.svg.paused, p.svg.time], ["Pause", "2", "0.00 s / 2.00 s", true, 0], "the cycle from data-duration, every SVG clock paused and driven");
  at(500);
  assert.deepEqual([p.svg.time, p.css.currentTime, p.css.paused, p.slider.value, p.readout.textContent], [0.5, 500, true, "0.5", "0.50 s / 2.00 s"]);
  p.button.fire("click");
  assert.deepEqual([p.button.textContent, pending()], ["Play", 0], "paused: no frame callback left");
  at(1500);
  assert.equal(p.svg.time, 0.5, "the frame stays where it was paused");
  p.slider.value = "1.23";
  p.slider.fire("input");
  assert.deepEqual([p.svg.time, p.css.currentTime, p.readout.textContent, p.slider.attrs["aria-valuetext"], p.button.textContent], [1.23, 1230, "1.23 s / 2.00 s", "1.23 of 2.00 seconds", "Play"]);
  p.slider.value = "1.24";
  p.slider.fire("input");
  assert.equal(p.svg.time, 1.24, "an arrow key's 0.01 s");
  p.button.fire("click");
  at(1600);
  assert.ok(Math.abs(p.svg.time - 1.34) < 1e-9, `resumed from 1.24: ${p.svg.time}`);
  at(2500);
  assert.ok(Math.abs(p.svg.time - 0.24) < 1e-9, `wrapped at the cycle's end: ${p.svg.time}`);
  p.again.fire("click");
  assert.deepEqual([p.svg.time, p.button.textContent], [0, "Pause"]);
  at(2750);
  assert.equal(p.svg.time, 0.25, "replay runs from zero");
});

test("a press on the range freezes the frame before it moves; the readout keeps a slower pace than the frames", () => {
  const p = page();
  mountTimeline(p.root);
  at(40);
  at(80);
  assert.deepEqual([p.svg.time, p.readout.textContent], [0.08, "0.00 s / 2.00 s"], "the frames move every tick, the readout waits");
  at(160);
  at(200);
  assert.deepEqual([p.svg.time, p.readout.textContent], [0.2, "0.16 s / 2.00 s"], "at most one readout per 100 ms");
  p.slider.fire("pointerdown");
  assert.deepEqual([p.button.textContent, pending(), p.svg.time, p.readout.textContent], ["Play", 0, 0.2, "0.20 s / 2.00 s"], "frozen where it was, and the readout says so at once");
});

test("reduced motion: the timeline waits on its first frame until Play; a cycle of 0 disables the controls", () => {
  reduce = true;
  const p = page();
  mountTimeline(p.root);
  assert.deepEqual([p.button.textContent, pending(), p.svg.time], ["Play", 0, 0]);
  p.button.fire("click");
  at(300);
  assert.equal(p.svg.time, 0.3, "an explicit Play still plays");
  reduce = false;
  const none = page({ duration: "0" });
  (none.root as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [];
  mountTimeline(none.root);
  assert.deepEqual([none.button.disabled, none.again.disabled, none.slider.disabled, pending()], [true, true, true, 1], "only the other timeline's frame is pending");
});

test("two timelines are independent, a declared cycle wins over the file's, and destroy() leaves no listener or frame behind", () => {
  const a = page(), b = page({ duration: "4" });
  const ta = mountTimeline(a.root, { duration: 1 });
  const tb = mountTimeline(b.root);
  assert.deepEqual([ta.duration(), tb.duration()], [1, 4]);
  a.button.fire("click");
  at(700);
  assert.deepEqual([a.svg.time, b.svg.time], [0, 0.7], "pausing one leaves the other playing");
  ta.destroy();
  tb.destroy();
  assert.equal(pending(), 0);
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
  mount(p.root, { duration: 2 });
  at(250);
  assert.equal(p.svg.time, 0.25, "the inlined source runs on its own: it names nothing outside its body");
});
