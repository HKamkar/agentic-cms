import type { FormBackend, SubmitResult } from "../backend.ts";
import { resolveRecipient } from "../email-token.ts";
import { fieldLabel, fieldsOf, type FieldDefinition, type FormDefinition, type FormValues } from "../types.ts";

/**
 * Zero-infrastructure fallback: opens the visitor's mail client with the
 * submission as the message body. Nothing is sent by the site itself, so the
 * result is "ok" as soon as the mail client has been handed the draft. The
 * recipient may be a token (withEmailToken); it is resolved here, at submit.
 */
export class MailtoBackend implements FormBackend {
  private readonly config: { to: string; subject?: string };

  constructor(config: { to: string; subject?: string }) {
    this.config = config;
  }

  async submit(form: FormDefinition, values: FormValues): Promise<SubmitResult> {
    const subject = encodeURIComponent(this.config.subject ?? form.name);
    const body = encodeURIComponent(mailtoBody(form, values));
    window.location.assign(`mailto:${resolveRecipient(this.config.to)}?subject=${subject}&body=${body}`);
    return { ok: true };
  }
}

/** One line per field, as the visitor was asked: its label, and an option's label rather than its value. */
export function mailtoBody(form: FormDefinition, values: FormValues): string {
  return fieldsOf(form)
    .map((field) => `${fieldLabel(field)}: ${shownValue(field, values[field.name])}`)
    .join("\n");
}

function shownValue(field: FieldDefinition, value: string | string[] | undefined): string {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const labelOf = (choice: string) => ("options" in field ? field.options.find((option) => option.value === choice)?.label : undefined) ?? choice;
  return values.map(labelOf).join(", ");
}
