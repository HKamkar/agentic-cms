// The browser's own checks, repeated on the server: whatever <Form> lets
// through passes here (a visitor refused here would only see the generic
// error message), anything else is refused by field name. Keys the
// definition does not name are dropped, so a submission holds exactly its
// form's fields. The rules per field type are ../rules.ts.
import { acceptValue } from "../rules.ts";
import { fieldsOf, type FormDefinition, type FormValues } from "../types.ts";

export type Validation = { ok: true; values: FormValues } | { ok: false; fields: string[] };

/** The submitted values checked against the form's definition: the clean values, or the names of the fields that fail. */
export function validateSubmission(form: FormDefinition, input: unknown): Validation {
  const submitted = isRecord(input) ? input : {};
  const values: FormValues = {};
  const failed: string[] = [];
  for (const field of fieldsOf(form)) {
    const value = acceptValue(field, submitted[field.name]);
    if (value === undefined) failed.push(field.name);
    else values[field.name] = value;
  }
  return failed.length > 0 ? { ok: false, fields: failed } : { ok: true, values };
}

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
