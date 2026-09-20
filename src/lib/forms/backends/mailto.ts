import type { FormBackend, SubmitResult } from "../backend.ts";
import { resolveRecipient } from "../email-token.ts";
import { fieldsOf, type FormDefinition, type FormValues } from "../types.ts";

/**
 * Zero-infrastructure fallback: opens the visitor's mail client with the
 * submission as the message body. Nothing is sent by the site itself, so the
 * result is "ok" as soon as the mail client has been handed the draft. The
 * recipient may be a token (withEmailToken); it is resolved here, at submit.
 */
export class MailtoBackend implements FormBackend {
  constructor(private readonly config: { to: string; subject?: string }) {}

  async submit(form: FormDefinition, values: FormValues): Promise<SubmitResult> {
    const lines = fieldsOf(form).map((field) => `${field.label}: ${formatValue(values[field.name])}`);
    const subject = encodeURIComponent(this.config.subject ?? form.name);
    const body = encodeURIComponent(lines.join("\n"));
    window.location.assign(`mailto:${resolveRecipient(this.config.to)}?subject=${subject}&body=${body}`);
    return { ok: true };
  }
}

const formatValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value.join(", ") : (value ?? ""));
