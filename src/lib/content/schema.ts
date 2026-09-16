// The vocabulary content fields are declared with. Each helper reproduces
// one rule of the old frontmatter validator so a wrong value fails the build
// with the same words it did before: a required text, a text that may be
// left out (null or absent both mean "not set"), a YYYY-MM-DD date, an ISO
// timestamp normalised the way JSON-LD wants it, and a reference to an entry
// of another collection. Every helper carries its own error wording, so
// zod's default messages never reach a build log, and the date helpers name
// their type in .meta() for the generated field tables. Call .describe() on the
// outermost schema of a field: a wrapper such as .optional() or .array()
// starts a new schema without the description (.refine() and .check() keep it).

import { z } from "zod";
import { lookup } from "./define";
import { slugsOf, sourceOf } from "./read";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A non-empty string, returned untrimmed. Missing → "is required"; empty or whitespace → "must be a non-empty string". */
export function text(): z.ZodString {
  return z
    .string({ error: (issue) => (issue.input == null ? "is required" : "must be a non-empty string") })
    // abort: a blank field must not let the object-level refine (excerpt-or-seoDescription) add a second, misleading line.
    .refine((value) => value.trim().length > 0, { error: "must be a non-empty string", abort: true });
}

/** A field that may be left out: null and undefined both become undefined (a key with no value is no key). */
export function optional<S extends z.ZodType>(schema: S) {
  return schema.nullish().transform((value) => value ?? undefined);
}

/** "YYYY-MM-DD" as text, quoted in YAML. Checked as a real calendar date (Date.parse rolls 2026-02-30 over, as before). */
export function dateOnly() {
  const invalid = (input: unknown) => `"${String(input)}" must be a valid YYYY-MM-DD`;
  return z
    .string({ error: (issue) => (issue.input === undefined ? "is required (YYYY-MM-DD)" : invalid(issue.input)) })
    .refine((value) => DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), { error: (issue) => invalid(issue.input) })
    .meta({ type: "YYYY-MM-DD" });
}

/** Anything Date can parse, normalised to toISOString() so datePublished / dateModified always read the same. */
export function isoTimestamp() {
  return z
    .unknown()
    .transform((value, ctx) => {
      const parsed = new Date(value instanceof Date ? value : String(value));
      if (Number.isNaN(parsed.getTime())) {
        ctx.issues.push({ code: "custom", input: value, message: `"${String(value)}" must be an ISO timestamp` });
        return z.NEVER;
      }
      return parsed.toISOString();
    })
    .meta({ type: "ISO timestamp" });
}

/**
 * The slug of an entry in another collection (or this one: posts.related →
 * posts). Checked against the target's slug listing without validating it,
 * so a self-reference cannot recurse. The check never runs on a type
 * failure; text() already names those. meta({ ref }) is for the docs.
 */
export function ref(collection: string): z.ZodString {
  return text()
    .check((ctx) => {
      const target = lookup(collection);
      const known = slugsOf(target);
      if (known.includes(ctx.value)) return;
      ctx.issues.push({ code: "custom", input: ctx.value, message: `"${ctx.value}" is not in ${sourceOf(target)} (${known.join(", ")})` });
    })
    .meta({ ref: collection });
}
