// The clock of a page that holds one scene, as an inline script (no
// library): window.lab seeks, pauses and plays every animation on the page —
// SMIL through each root <svg>'s own timeline, CSS and Web Animations
// through document.getAnimations(). The lab's bare page carries it: `lab
// render` sets it frame by frame, and the lab's own page frames each scene
// in one and drives every frame's window.lab from its timeline
// (timeline.ts).

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
