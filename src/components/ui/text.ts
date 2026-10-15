// Small text helpers for primitives and sections. No React, so they load in
// server components and under node:test alike.

/** U+2011, the non-breaking hyphen: it looks like "-" and never ends a line. */
const NON_BREAKING_HYPHEN = "‑";

/**
 * Keeps hyphenated words whole ("built-in", "end-to-end"): each hyphen
 * between two letters or digits becomes a non-breaking one, so a line never
 * breaks inside the word. A spaced dash and a leading or trailing hyphen
 * stay as they are.
 */
export function keepWords(text: string): string {
  return text.replace(/(?<=[\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu, NON_BREAKING_HYPHEN);
}
