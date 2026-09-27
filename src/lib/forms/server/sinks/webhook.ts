import { signFormBody } from "../signature.ts";
import type { FormSink } from "../sink.ts";
import type { FormSubmission } from "../submission.ts";

const TIMEOUT_MS = 10_000;

type WebhookConfig = { url: string; secret?: string; headers?: Record<string, string> };

/**
 * Posts the submission as JSON. Redirects are not followed — a redirected
 * POST arrives as a body-less GET whose 200 would read as delivered — so
 * anything but a 2xx is a failure.
 */
export class WebhookSink implements FormSink {
  private readonly config: WebhookConfig;
  private readonly fetch: typeof fetch;

  constructor(config: WebhookConfig, fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    this.config = config;
    this.fetch = fetcher;
  }

  async deliver(submission: FormSubmission): Promise<void> {
    const body = JSON.stringify(submission);
    const response = await this.fetch(this.config.url, {
      method: "POST",
      headers: await this.headersFor(submission, body),
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`the webhook answered ${response.status}`);
  }

  /** The site's own headers first (an API key a provider asks for), then the ones the format fixes. */
  private async headersFor(submission: FormSubmission, body: string): Promise<Record<string, string>> {
    const headers = { ...this.config.headers, "Content-Type": "application/json", "X-Form-Submission-Id": submission.id };
    if (!this.config.secret) return headers;
    const timestamp = String(Math.floor(Date.now() / 1000));
    return { ...headers, "X-Form-Timestamp": timestamp, "X-Form-Signature": await signFormBody(this.config.secret, timestamp, body) };
  }
}
