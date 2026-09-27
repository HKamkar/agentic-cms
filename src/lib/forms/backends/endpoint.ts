import type { FormBackend, SubmitContext, SubmitResult } from "../backend.ts";
import type { EndpointPayload, FormDefinition, FormValues } from "../types.ts";

/**
 * Posts the submission as JSON to a route of the site (`/api/forms/<id>`),
 * where agentic-cms/forms/server validates it and hands it to the site's
 * sink. Never throws: a network failure is a failed submission, so the form
 * shows its error message instead of waiting for ever.
 */
export class EndpointBackend implements FormBackend {
  private readonly url: string;
  private readonly fetch: typeof fetch;

  constructor(config: { url: string }, fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    this.url = config.url;
    this.fetch = fetcher;
  }

  async submit(_form: FormDefinition, values: FormValues, context: SubmitContext = {}): Promise<SubmitResult> {
    try {
      const response = await this.fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payloadOf(values, context)),
      });
      return response.ok ? { ok: true } : { ok: false, error: await errorOf(response) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "network error" };
    }
  }
}

/** The page it was sent from rides along, so a landing page's UTM tags reach the sink. */
function payloadOf(values: FormValues, context: SubmitContext): EndpointPayload {
  const page = globalThis.location?.href;
  const referrer = globalThis.document?.referrer || undefined;
  return { values, trap: context.trap, elapsedMs: context.elapsedMs, page, referrer };
}

async function errorOf(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
}
