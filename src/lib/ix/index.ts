// The motion library, two layers. The reveals on Motion replay on each
// entry: scroll-into-view reveals and sequences (Fx, OnView), an inline SMIL
// animation that plays in view, and the breakpoint and reduced-motion hooks
// they check. The play-once layer plays each root once, by CSS, when it is
// first seen: Reveal, RevealGroup, Sequence, part() and motionScript().
// The start states and keyframes either layer animates from are the
// site's (src/styles/motion.css); STANDARD.md §7 says which to choose.
export { Fx, type FxPreset } from "./Fx.tsx";
export { InlineAnimation, fillBox, type InlineAnimationProps } from "./InlineAnimation.ts";
export { OnView } from "./OnView.tsx";
export { ease, EASE, type EaseName } from "./easing.ts";
export { ix } from "./target.ts";
export { useMainBreakpoint, useReducedMotionPref } from "./useMainBreakpoint.ts";
export { useReveal } from "./useReveal.ts";
export { part, staggerDelay, PART_KINDS, LOOP_KINDS, type PartKind, type PartOptions, type PartProps } from "./parts.ts";
export { useMotionRoot } from "./useMotionRoot.ts";
export { Reveal, type RevealEffect, type RevealProps } from "./Reveal.ts";
export { RevealGroup, type RevealGroupEffect, type RevealGroupProps } from "./RevealGroup.ts";
export { Sequence, type SequenceProps } from "./Sequence.ts";
export { motionScript } from "./motionScript.ts";
