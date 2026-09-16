// The easing names of a design tool's interaction engine -> cubic-bezier tuples.
export const EASE = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  outQuad: [0.25, 0.46, 0.45, 0.94],
  outQuart: [0.165, 0.84, 0.44, 1],
  inOutCirc: [0.785, 0.135, 0.15, 0.86],
  inOutQuad: [0.455, 0.03, 0.515, 0.955],
  outCubic: [0.215, 0.61, 0.355, 1],
} as const;

export type EaseName = keyof typeof EASE;
export const ease = (name: EaseName): [number, number, number, number] => [...EASE[name]] as [number, number, number, number];
