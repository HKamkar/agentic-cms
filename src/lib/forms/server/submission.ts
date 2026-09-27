// What a sink receives: version 1 of the wire format, the same for every
// sink and every provider. A receiver keys on `version`; `id` lets it drop a
// submission it already has (a visitor who resends after a slow answer).
import { fieldsOf, type FormDefinition, type FormValues } from "../types.ts";

const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;
const MAX_URL = 2048;
const MAX_UTM = 256;

export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;

export type FormSubmission = {
  version: 1;
  id: string;
  form: { id: string; name: string };
  /** ISO 8601, the server's clock. */
  submittedAt: string;
  /** The values in the form's order with their labels, for a receiver that shows them as they were asked. */
  fields: { name: string; label: string; value: string | string[] }[];
  values: FormValues;
  /** The page the form was sent from and its UTM tags, when the browser said. */
  page: { url?: string; referrer?: string; utm: Utm };
};

/** Where the payload says it came from; untrusted, so read as unknown. */
export type SubmittedFrom = { page?: unknown; referrer?: unknown };

/** A validated submission in the wire format. */
export function buildSubmission(form: FormDefinition, values: FormValues, from: SubmittedFrom = {}): FormSubmission {
  const url = httpUrl(from.page);
  return {
    version: 1,
    id: crypto.randomUUID(),
    form: { id: form.id, name: form.name },
    submittedAt: new Date().toISOString(),
    fields: fieldsOf(form).map((field) => ({ name: field.name, label: field.label, value: values[field.name] ?? "" })),
    values,
    page: { url, referrer: httpUrl(from.referrer), utm: utmOf(url) },
  };
}

/** An http(s) URL of a sane length, or nothing. */
function httpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > MAX_URL || !URL.canParse(value)) return undefined;
  const { protocol } = new URL(value);
  return protocol === "https:" || protocol === "http:" ? value : undefined;
}

function utmOf(url: string | undefined): Utm {
  const utm: Utm = {};
  if (!url) return utm;
  const params = new URL(url).searchParams;
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`);
    if (value) utm[key] = value.slice(0, MAX_UTM);
  }
  return utm;
}
