"use client";

// The scrubber of the lab's route, as a client component: play / pause, a
// frame back, the range, a frame forward, the readout — React state wired
// to window.lab (the clock the inline LAB_API script defines) in an effect,
// so the server's markup and the client's agree and hydration is clean. The
// lab's own served page has no React and keeps the string controls of
// api.ts (labControls()). No JSX: createElement, like LabScenes, so the
// route renders under node:test too.
import { createElement as h, useCallback, useEffect, useState, type ChangeEvent } from "react";

type LabApi = { duration(): number; seek(t: number): number; play(): void; pause(): void; time(): number };
declare global { interface Window { lab?: LabApi } }

const FRAME = 1 / 30;
const TICK_MS = 100;

/** The scrubber over every animation on the page; `duration` when the page knows it (0: ask window.lab). */
export function LabControls({ duration: declared = 0 }: { duration?: number }) {
  const [duration, setDuration] = useState(declared);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);

  // The tick reads the clock and, on its first run, the duration; it is
  // re-armed when play/pause flips, so no ref is needed for the state.
  useEffect(() => {
    const lab = window.lab;
    if (!lab) return;
    const tick = setInterval(() => {
      const span = declared || lab.duration();
      setDuration(span);
      if (playing && span) setTime(lab.time() % span);
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [declared, playing]);

  const pause = useCallback(() => { setPlaying(false); window.lab?.pause(); }, []);
  const play = useCallback(() => { setPlaying(true); window.lab?.play(); }, []);
  const seek = useCallback((t: number) => { const clamped = Math.max(0, Math.min(duration, t)); pause(); window.lab?.seek(clamped); setTime(clamped); }, [duration, pause]);

  return h("div", { className: "lab-controls" },
    h("button", { id: "lab-toggle", type: "button", onClick: () => (playing ? pause() : play()) }, playing ? "pause" : "play"),
    h("button", { id: "lab-back", type: "button", onClick: () => seek(time - FRAME) }, "◀"),
    h("input", { id: "lab-time", type: "range", min: 0, max: duration || 1, step: 1 / 60, value: time, onChange: (event: ChangeEvent<HTMLInputElement>) => seek(Number(event.target.value)) }),
    h("button", { id: "lab-forward", type: "button", onClick: () => seek(time + FRAME) }, "▶"),
    h("span", { id: "lab-readout" }, `${time.toFixed(2)}s / ${duration.toFixed(2)}s`),
  );
}
