// The reveal library: scroll-into-view reveals and sequences on Motion, an
// inline SMIL animation that plays in view, and the breakpoint and
// reduced-motion hooks they check. Client components; the
// start states they animate from are the site's (src/styles/motion.css).
export { Fx, type FxPreset } from "./Fx.tsx";
export { InlineAnimation, fillBox, type InlineAnimationProps } from "./InlineAnimation.ts";
export { OnView } from "./OnView.tsx";
export { ease, EASE, type EaseName } from "./easing.ts";
export { ix } from "./target.ts";
export { useMainBreakpoint, useReducedMotionPref } from "./useMainBreakpoint.ts";
export { useReveal } from "./useReveal.ts";
