// The parts of the play-once layer: what an element does when its root plays
// (Reveal, RevealGroup, Sequence), as the attributes the site's motion.css
// reads. Plain functions, no React at run time, so a server component can
// spread a part and node:test loads it. The numbers a part carries are its
// kind and its delay; every duration, curve and distance is the site's
// (`--motion-*`, `--ease-*`).
import type { CSSProperties } from "react";

/**
 * - `fade`, `rise`, `scale`: an entrance — opacity alone, with a climb of --motion-travel, or from just under full size
 * - `pop`: an entrance from a small size that overshoots a little, for a small mark
 * - `draw`: a stroke traced along its path (its root measures the length, --len)
 * - `grow`: widens from its left edge, for a bar
 * - `dim`: starts at full opacity and settles at --dim (0.16 unless given), for what is set back
 * - `flow`, `pulse`, `breathe`: loops, running only while their root is on screen
 */
export type PartKind = "fade" | "rise" | "scale" | "pop" | "draw" | "grow" | "dim" | "flow" | "pulse" | "breathe";

export const PART_KINDS: readonly PartKind[] = ["fade", "rise", "scale", "pop", "draw", "grow", "dim", "flow", "pulse", "breathe"];

/** The kinds that run in a loop instead of playing once. */
export const LOOP_KINDS: readonly PartKind[] = ["flow", "pulse", "breathe"];

export type PartOptions = {
  /** what a `dim` part fades back to, 0 to 1 */
  dim?: number;
  /** the element's own style, kept beside the part's variables */
  style?: CSSProperties;
};

export type PartProps = { "data-part": PartKind; style: CSSProperties };

/**
 * The props that make an element a part: spread them on it.
 * `<path {...part("draw", 400)} d="…" />` draws the path 400 ms after its root plays.
 */
export function part(kind: PartKind, delayMs = 0, { dim, style }: PartOptions = {}): PartProps {
  if (!PART_KINDS.includes(kind)) throw new Error(`part: unknown kind "${kind}" (${PART_KINDS.join(", ")})`);
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error(`part: the delay is milliseconds, 0 or more (got ${delayMs})`);
  const vars: Record<string, string> = { "--d": `${Math.round(delayMs)}ms` };
  if (dim !== undefined) vars["--dim"] = String(Math.min(1, Math.max(0, dim)));
  return { "data-part": kind, style: { ...style, ...vars } as CSSProperties };
}

/** The delay of the i-th item of a stagger: `delayMs` plus i steps, a step being `stepMs` or the site's --motion-stagger. */
export function staggerDelay(index: number, delayMs = 0, stepMs?: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error(`staggerDelay: the index is 0, 1, 2… (got ${index})`);
  return stepMs === undefined ? `calc(${delayMs}ms + ${index} * var(--motion-stagger))` : `${delayMs + index * stepMs}ms`;
}
