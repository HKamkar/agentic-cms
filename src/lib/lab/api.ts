// The clock of a page that shows scenes, as inline scripts (no library):
// window.lab seeks, pauses and plays every animation on the page — SMIL
// through each root <svg>'s own timeline, CSS and Web Animations through
// document.getAnimations() — and the controls drive it from a scrubber. The
// lab's own page frames each scene in an iframe (so two copies of one scene
// never share ids) and drives every frame's window.lab; the route inside
// the site inlines the scenes and drives its own document.

/** window.lab: duration() in seconds (an infinite loop counts one cycle; data-duration on a root wins), seek(t), play(), pause(), time(). */
export const LAB_API = `window.lab = (() => {
  const roots = () => [...document.querySelectorAll("svg")].filter((s) => !s.parentElement.closest("svg"));
  const anims = () => document.getAnimations();
  const declared = () => roots().map((s) => Number(s.dataset.duration)).find((n) => n > 0) || 0;
  function duration() {
    let max = declared();
    if (max) return max;
    for (const a of anims()) { const t = a.effect.getComputedTiming(); const n = t.iterations === Infinity ? 1 : (t.iterations || 1); max = Math.max(max, ((Number(t.delay) || 0) + (Number(t.duration) || 0) * n) / 1000); }
    for (const el of document.querySelectorAll("animate, animateTransform, animateMotion, set")) { try { const d = el.getSimpleDuration(); if (Number.isFinite(d)) max = Math.max(max, d); } catch {} }
    return max || 1;
  }
  function seek(t) { for (const s of roots()) { s.pauseAnimations(); s.setCurrentTime(t); } for (const a of anims()) { a.pause(); a.currentTime = t * 1000; } return t; }
  function play() { for (const s of roots()) s.unpauseAnimations(); for (const a of anims()) a.play(); }
  function pause() { for (const s of roots()) s.pauseAnimations(); for (const a of anims()) a.pause(); }
  function time() { const s = roots()[0]; return s ? s.getCurrentTime() : 0; }
  return { duration, seek, play, pause, time };
})();`;

/** The controls' markup: play/pause, a frame back, the scrubber, a frame forward, the readout. */
export const LAB_CONTROLS_HTML = `<div class="lab-controls"><button id="lab-toggle" type="button">pause</button><button id="lab-back" type="button">◀</button><input id="lab-time" type="range" min="0" max="1" step="0.0166" value="0"><button id="lab-forward" type="button">▶</button><span id="lab-readout">0.00s</span></div>`;

/** The controls' script for a page without React (the lab's own): `frames` drives the window.lab of every iframe.lab-frame, otherwise the page's own window.lab; `duration` when the page knows it. The route uses LabControls instead. */
export function labControls({ frames = false, duration = 0 }: { frames?: boolean; duration?: number } = {}): string {
  const targets = frames ? `const frames = [...document.querySelectorAll("iframe.lab-frame")]; const api = () => frames.map((f) => f.contentWindow && f.contentWindow.lab).filter(Boolean); const onReady = (fn) => frames.forEach((f) => f.addEventListener("load", fn));` : `const api = () => (window.lab ? [window.lab] : []); const onReady = (fn) => fn();`;
  return `(() => {
  ${targets}
  const range = document.getElementById("lab-time"), readout = document.getElementById("lab-readout"), toggle = document.getElementById("lab-toggle");
  if (!range) return;
  let duration = ${Number(duration) || 0}, playing = true;
  const show = (t) => { readout.textContent = t.toFixed(2) + "s / " + duration.toFixed(2) + "s"; };
  const ready = () => { const a = api()[0]; if (!a) return; duration = duration || a.duration(); range.max = duration; range.step = 1 / 60; show(0); };
  onReady(ready);
  const seekAll = (t) => { t = Math.max(0, Math.min(duration, t)); api().forEach((a) => a.seek(t)); range.value = t; show(t); };
  const pause = () => { playing = false; api().forEach((a) => a.pause()); toggle.textContent = "play"; };
  const play = () => { playing = true; api().forEach((a) => a.play()); toggle.textContent = "pause"; };
  toggle.onclick = () => (playing ? pause() : play());
  range.oninput = () => { pause(); seekAll(Number(range.value)); };
  document.getElementById("lab-back").onclick = () => { pause(); seekAll(Number(range.value) - 1 / 30); };
  document.getElementById("lab-forward").onclick = () => { pause(); seekAll(Number(range.value) + 1 / 30); };
  setInterval(() => { if (!playing || !duration) return; const a = api()[0]; if (!a) return; const t = a.time() % duration; range.value = t; show(t); }, 100);
})();`;
}
