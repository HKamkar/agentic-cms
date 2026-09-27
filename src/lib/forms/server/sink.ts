import { LogSink } from "./sinks/log.ts";
import { WebhookSink } from "./sinks/webhook.ts";
import type { FormSubmission } from "./submission.ts";

/**
 * Delivers a validated submission to wherever the site keeps them. Throws
 * when it could not, and the handler answers 502. A provider's own API is a
 * sink the site writes against this interface; the kit ships the two that
 * name no provider.
 */
export interface FormSink {
  deliver(submission: FormSubmission): Promise<void>;
}

/**
 * `webhook` posts each submission as JSON to a URL (an automation platform,
 * a CRM's inbound hook, a function of the site's), signed when a secret is
 * set; `log` prints it, for development only.
 */
export type FormSinkConfig = { kind: "webhook"; url: string; secret?: string; headers?: Record<string, string> } | { kind: "log" };

/** Builds the sink a config asks for. A new kind is a case here and a class in ./sinks. */
export function createFormSink(config: FormSinkConfig, fetcher?: typeof fetch): FormSink {
  switch (config.kind) {
    case "webhook":
      return new WebhookSink(config, fetcher);
    case "log":
      return new LogSink();
  }
}
