import { EndpointBackend } from "./backends/endpoint.ts";
import { MailtoBackend } from "./backends/mailto.ts";
import type { FormBackendConfig, FormDefinition, FormValues } from "./types.ts";

export type SubmitResult = { ok: true } | { ok: false; error: string };

/**
 * What the page knows besides the values: the honeypot's content and how long
 * the form was on screen before it was sent. Spam signals for the endpoint;
 * a backend that has no use for them ignores them.
 */
export type SubmitContext = { trap?: string; elapsedMs?: number };

/** Delivers a submitted form somewhere. Callers only see this interface. */
export interface FormBackend {
  submit(form: FormDefinition, values: FormValues, context?: SubmitContext): Promise<SubmitResult>;
}

/**
 * Builds the backend a form's config asks for. Adding one means a new `kind`
 * in FormBackendConfig, a class in ./backends and a case here; forms pick it
 * by editing src/config/forms.ts.
 */
export function createFormBackend(config: FormBackendConfig): FormBackend {
  switch (config.kind) {
    case "mailto":
      return new MailtoBackend(config);
    case "endpoint":
      return new EndpointBackend(config);
  }
}
