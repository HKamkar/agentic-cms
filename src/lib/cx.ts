/** Joins class names, skipping the falsy ones: `cx(styles.card, active && "is-active", className)`. */
export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

// How a component declares its looks: one typed map, so a new look is one
// line in it, never a copy of the component. No React, so it loads under
// node:test and in server components alike.
//
//   const button = variants({
//     base: "inline-flex border border-line",
//     variants: { variant: { solid: "bg-ink text-on-ink", outline: "bg-panel text-ink" } },
//     defaults: { variant: "solid" },
//   });
//   button({ variant: "outline" })   // "inline-flex border border-line bg-panel text-ink"
//   type ButtonLook = VariantProps<typeof button>;   // { variant?: "solid" | "outline" }

type VariantMap = Record<string, Record<string, string>>;
type Choice<V extends VariantMap> = { [K in keyof V]?: keyof V[K] & string };

type VariantConfig<V extends VariantMap> = {
  /** the classes every look shares */
  base?: string;
  /** each axis (variant, size, tone…) and its options' classes */
  variants: V;
  /** the option each axis takes when the caller names none */
  defaults: { [K in keyof V]: keyof V[K] & string };
  /** classes for a combination of options, after the axes' own */
  compound?: ReadonlyArray<{ when: Choice<V>; className: string }>;
};

/** The props a `variants()` function takes: each of its axes, optional. */
export type VariantProps<F> = F extends (choice?: infer P) => string ? NonNullable<P> : never;

/**
 * A component's looks as one function: the base, each axis's option (or its
 * default), then every compound that matches. An option an axis lacks throws,
 * naming the ones it has — a default when the looks are declared, a choice
 * when they are asked for.
 */
export function variants<V extends VariantMap>(config: VariantConfig<V>) {
  const axes = Object.keys(config.variants) as Array<keyof V & string>;
  const classesOf = (axis: keyof V & string, option: string) => {
    if (!Object.hasOwn(config.variants[axis], option)) {
      throw new Error(`variants: "${option}" is not an option of ${axis} (${Object.keys(config.variants[axis]).join(", ")})`);
    }
    return config.variants[axis][option];
  };
  for (const axis of axes) classesOf(axis, config.defaults[axis]);
  return (choice: Choice<V> = {}): string => {
    const picked = Object.fromEntries(axes.map((axis) => [axis, choice[axis] ?? config.defaults[axis]])) as Record<keyof V, string>;
    const compounds = (config.compound ?? []).filter(({ when }) => Object.entries(when).every(([axis, option]) => picked[axis] === option));
    return cx(config.base, ...axes.map((axis) => classesOf(axis, picked[axis])), ...compounds.map((compound) => compound.className));
  };
}
