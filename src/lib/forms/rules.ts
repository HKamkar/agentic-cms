// What each control lets through, after the HTML standard: the one
// definition of a field's valid value, shared by the server's validation
// (server/validate.ts) and the prefill from a URL (values.ts), so neither is
// stricter than the other or than the browser. Types only, so the server
// half imports it without the client barrel.
import type { CheckboxField, CheckboxGroupField, DateField, FieldDefinition, NumberField, RadioGroupField, SelectField, TextAreaField, TextField } from "./types.ts";

// The HTML standard's "valid e-mail address": what an <input type="email"> accepts.
const EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// A "valid floating-point number": what an <input type="number"> submits.
const FLOAT = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/;
// A "valid date string": what an <input type="date"> submits.
const DATE = /^(\d{4,})-(\d{2})-(\d{2})$/;

/** A field's value as the browser would have sent it, or undefined where the browser would have refused it. `value` is untrusted; missing reads as nothing entered. */
export function acceptValue(field: FieldDefinition, value: unknown): string | string[] | undefined {
  switch (field.type) {
    case "text":
    case "email":
    case "tel":
    case "url":
    case "textarea":
      return readText(field, value ?? "");
    case "number":
      return readNumber(field, value ?? "");
    case "date":
      return readDate(field, value ?? "");
    case "select":
    case "radios":
      return readChoice(field, value ?? "");
    case "checkbox":
      return readCheckbox(field, value ?? "");
    case "checkboxes":
      return readChoices(field, value);
    case "hidden":
      // The definition's value, whatever was sent: a client cannot relabel a campaign.
      return field.value;
  }
}

/** Line breaks count as one character, as the browser counts them for maxlength and minlength, whichever way they were sent. */
function readText(field: TextField | TextAreaField, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\r\n?/g, "\n");
  if (text === "") return field.required ? undefined : text;
  if (field.maxLength !== undefined && text.length > field.maxLength) return undefined;
  if (field.minLength !== undefined && text.length < field.minLength) return undefined;
  if (field.type === "textarea") return text;
  if (field.pattern !== undefined && !matchesPattern(field.pattern, text)) return undefined;
  if (field.type === "email" && !EMAIL.test(text)) return undefined;
  if (field.type === "url" && !URL.canParse(text)) return undefined;
  return text;
}

/** The pattern as the browser compiles it: anchored, with the v flag; one that does not compile constrains nothing. */
function matchesPattern(pattern: string, text: string): boolean {
  let regexp: RegExp;
  try {
    regexp = new RegExp(`^(?:${pattern})$`, "v");
  } catch {
    return true;
  }
  return regexp.test(text);
}

function readNumber(field: NumberField, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "") return field.required ? undefined : value;
  const number = Number(value);
  if (!FLOAT.test(value) || !Number.isFinite(number)) return undefined;
  if (field.min !== undefined && number < field.min) return undefined;
  if (field.max !== undefined && number > field.max) return undefined;
  return onStep(field, number) ? value : undefined;
}

/**
 * The HTML step check: the step base is `min`, else the default value, else
 * zero, and the default step is 1. The float error a decimal step leaves is
 * forgiven up to a step's 2⁻²⁴, as Chromium forgives it.
 */
function onStep(field: NumberField, number: number): boolean {
  if (field.step === "any") return true;
  const step = field.step !== undefined && field.step > 0 ? field.step : 1;
  const remainder = Math.abs((number - (field.min ?? field.defaultValue ?? 0)) % step);
  const tolerance = step / 2 ** 24;
  return remainder <= tolerance || remainder >= step - tolerance;
}

function readDate(field: DateField, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "") return field.required ? undefined : value;
  const date = parseDate(value);
  if (!date) return undefined;
  const min = field.min === undefined ? undefined : parseDate(field.min);
  const max = field.max === undefined ? undefined : parseDate(field.max);
  if (min && compareDates(date, min) < 0) return undefined;
  if (max && compareDates(date, max) > 0) return undefined;
  return value;
}

/** A valid date string's year, month and day, or undefined: a real day of a year after 0. A `min` or `max` that is not one constrains nothing. */
function parseDate(text: string): [number, number, number] | undefined {
  const match = DATE.exec(text);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return undefined;
  return [year, month, day];
}

function daysIn(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const compareDates = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** One of the options; "" is nothing chosen — a radio group with none ticked, a select on its placeholder — and fails `required`. */
function readChoice(field: SelectField | RadioGroupField, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "") return field.required || (field.type === "select" && field.placeholder === undefined) ? undefined : value;
  return field.options.some((option) => option.value === value) ? value : undefined;
}

/** Its own value when ticked, "" when not. */
function readCheckbox(field: CheckboxField, value: unknown): string | undefined {
  if (value === "") return field.required ? undefined : value;
  return value === field.value ? value : undefined;
}

/** A checkbox group is never required (the control does not set it); every value must be one of its options. */
function readChoices(field: CheckboxGroupField, value: unknown): string[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((choice) => typeof choice === "string")) return undefined;
  const allowed = new Set(field.options.map((option) => option.value));
  return value.every((choice) => allowed.has(choice)) ? [...new Set(value)] : undefined;
}
