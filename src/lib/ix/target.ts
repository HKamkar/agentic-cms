/**
 * Selector for an animation target marked `data-ix="<name>"`, resolved inside
 * the animating component's root (see OnView). Animation hooks are attributes,
 * never styling classes, so restyling can't silently break a sequence.
 */
export const ix = (name: string) => `[data-ix="${name}"]`;
