// The browser's own checks, repeated on the server: whatever <Form> lets
// through passes here (a visitor refused here would only see the generic
// error message), anything else is refused by field name. Keys the
// definition does not name are dropped, so a submission holds exactly its
// form's fields.
import { fieldsOf, type CheckboxGroupField, type FieldDefinition, type FormDefinition, type FormValues, type TextAreaField, type TextField } from "../types.ts";

export type Validation = { ok: true; values: FormValues } | { ok: false; fields: string[] };

// The HTML standard's "valid e-mail address": what an <input type="email"> accepts.
const EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** The submitted values checked against the form's definition: the clean values, or the names of the fields that fail. */
export function validateSubmission(form: FormDefinition, input: unknown): Validation {
  const submitted = isRecord(input) ? input : {};
  const values: FormValues = {};
  const failed: string[] = [];
  for (const field of fieldsOf(form)) {
    const value = readField(field, submitted[field.name]);
    if (value === undefined) failed.push(field.name);
    else values[field.name] = value;
  }
  return failed.length > 0 ? { ok: false, fields: failed } : { ok: true, values };
}

/** A field's value as the browser would have sent it, or undefined where the browser would have refused it. */
function readField(field: FieldDefinition, value: unknown): string | string[] | undefined {
  return field.type === "checkboxes" ? readChoices(field, value) : readText(field, value ?? "");
}

/** Line breaks count as one character, as the browser counts them for maxlength, whichever way they were sent. */
function readText(field: TextField | TextAreaField, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\r\n?/g, "\n");
  if (field.maxLength !== undefined && text.length > field.maxLength) return undefined;
  if (field.required && text === "") return undefined;
  if (field.type === "email" && text !== "" && !EMAIL.test(text)) return undefined;
  return text;
}

/** A checkbox group is never required (the control does not set it); every value must be one of its options. */
function readChoices(field: CheckboxGroupField, value: unknown): string[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((choice) => typeof choice === "string")) return undefined;
  const allowed = new Set(field.options.map((option) => option.value));
  return value.every((choice) => allowed.has(choice)) ? [...new Set(value)] : undefined;
}

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
