/** Joins class names, skipping the falsy ones: `cx(styles.card, active && "is-active", className)`. */
export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");
