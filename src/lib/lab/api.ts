// The clock of a page that holds one scene, as an inline script (no
// library): window.lab seeks, pauses and plays every animation on the page —
// SMIL through each root <svg>'s own timeline, CSS and Web Animations
// through document.getAnimations(). The lab's bare page carries it: `lab
// render` sets it frame by frame, and the lab's own page frames each scene
// in one, whose timeline (timeline.ts) seeks every frame's window.lab and
// plays it from there. A finite animation already past its end is not
// played: play() would rewind it to its first frame. As on the timeline, an
// animation once seen stays — a finished CSS animation whose fill is none
// or backwards leaves getAnimations(), so a render that read the duration
// or a frame after it missed it — with its fill pinned to both, so past its
// end it holds its last frame. It is looked for when the script runs, on
// every animationstart (one that starts and ends between two calls) and on
// every call; a cancelled one, or one whose element left the page, drops
// out. The bare page is the lab's, never a shipped one.

/** window.lab: duration() in seconds (an infinite loop counts one cycle; data-duration on a root wins), seek(t), play(), pause(), time(). */
export const LAB_API = `window.lab = (() => {
  const roots = () => [...document.querySelectorAll("svg")].filter((s) => !s.parentElement.closest("svg"));
  const seen = new Set();
  function anims() {
    for (const a of document.getAnimations()) if (!seen.has(a)) { a.effect?.updateTiming({ fill: "both" }); seen.add(a); }
    for (const a of seen) if (a.playState === "idle" || !a.effect?.target?.isConnected) seen.delete(a);
    return [...seen];
  }
  anims();
  document.addEventListener("animationstart", anims);
  const declared = () => roots().map((s) => Number(s.dataset.duration)).find((n) => n > 0) || 0;
  function duration() {
    let max = declared();
    if (max) return max;
    for (const a of anims()) { const t = a.effect.getComputedTiming(); const n = t.iterations === Infinity ? 1 : (t.iterations || 1); max = Math.max(max, ((Number(t.delay) || 0) + (Number(t.duration) || 0) * n) / 1000); }
    for (const el of document.querySelectorAll("animate, animateTransform, animateMotion, set")) { try { const d = el.getSimpleDuration(); if (Number.isFinite(d)) max = Math.max(max, d); } catch {} }
    return max || 1;
  }
  function seek(t) { for (const s of roots()) { s.pauseAnimations(); s.setCurrentTime(t); } for (const a of anims()) { a.pause(); a.currentTime = t * 1000; } return t; }
  function play() { for (const s of roots()) s.unpauseAnimations(); for (const a of anims()) if (a.currentTime < a.effect.getComputedTiming().endTime) a.play(); }
  function pause() { for (const s of roots()) s.pauseAnimations(); for (const a of anims()) a.pause(); }
  function time() { const s = roots()[0]; return s ? s.getCurrentTime() : 0; }
  return { duration, seek, play, pause, time };
})();`;
