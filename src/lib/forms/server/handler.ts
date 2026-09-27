// The route's work: a site's src/app/api/forms/[id]/route.ts hands each POST
// to the handler this builds. It answers every request with JSON and
// `Cache-Control: no-store`; the endpoint backend reads `ok` and `error`.
import type { EndpointPayload, FormDefinition } from "../types.ts";
import { clientIp, memoryRateLimiter, type RateLimiter } from "./rate-limit.ts";
import type { FormSink } from "./sink.ts";
import { buildSubmission, type FormSubmission } from "./submission.ts";
import { isRecord, validateSubmission } from "./validate.ts";

export type FormHandlerOptions = {
  /** Every form of the site (src/config/forms.ts); only `endpoint` forms are served. */
  forms: Record<string, FormDefinition>;
  /** Where submissions go. A function is called per request, so a Worker's env is read when it exists; undefined answers 503. */
  sink: FormSink | (() => FormSink | undefined) | undefined;
  rateLimiter?: RateLimiter;
  clientIp?: (request: Request) => string;
  /** A submission sent sooner after the form appeared is a bot's. Browsers autofill, so keep it short. */
  minElapsedMs?: number;
  maxBodyBytes?: number;
};

export type FormHandler = (request: Request, formId: string) => Promise<Response>;

/** One handler per process: it holds the rate limiter's memory. */
export function createFormHandler(options: FormHandlerOptions): FormHandler {
  const forms = indexById(options.forms);
  const { rateLimiter = memoryRateLimiter(), minElapsedMs = 1500, maxBodyBytes = 32 * 1024 } = options;
  const addressOf = options.clientIp ?? clientIp;
  return async (request, formId) => {
    const form = forms.get(formId);
    if (form?.backend.kind !== "endpoint") return reply(404, "unknown_form");
    if (!isJson(request)) return reply(415, "json_only");
    const text = await readCapped(request, maxBodyBytes);
    if (text === undefined) return reply(413, "too_large");
    if (!rateLimiter.allow(`${form.id} ${addressOf(request)}`)) return reply(429, "rate_limited");
    const payload = parsePayload(text);
    if (!payload) return reply(400, "invalid_json");
    const checked = validateSubmission(form, payload.values);
    if (!checked.ok) return reply(400, "invalid", { fields: checked.fields });
    // A bot is told it succeeded, so it has nothing to learn from.
    if (isSpam(payload, minElapsedMs)) return reply(200);
    const sink = typeof options.sink === "function" ? options.sink() : options.sink;
    return deliver(sink, buildSubmission(form, checked.values, payload));
  };
}

function indexById(forms: Record<string, FormDefinition>): Map<string, FormDefinition> {
  const byId = new Map<string, FormDefinition>();
  for (const form of Object.values(forms)) {
    if (byId.has(form.id)) throw new Error(`createFormHandler: two forms have the id "${form.id}"`);
    byId.set(form.id, form);
  }
  return byId;
}

/** JSON only: a cross-site page cannot send it without a CORS preflight, which this route never answers. */
const isJson = (request: Request) => request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";

/** The body as text, or undefined past the cap — refused by its declared length first, counted as it streams in case the length lied. */
async function readCapped(request: Request, maxBytes: number): Promise<string | undefined> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return undefined;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > maxBytes) return void (await reader.cancel());
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

function parsePayload(text: string): EndpointPayload | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? (value as EndpointPayload) : undefined;
  } catch {
    return undefined;
  }
}

/** Missing signals are not spam: a site whose <Form> sends no context must not lose its submissions. */
function isSpam(payload: EndpointPayload, minElapsedMs: number): boolean {
  const trapped = typeof payload.trap === "string" && payload.trap !== "";
  const hurried = typeof payload.elapsedMs === "number" && Number.isFinite(payload.elapsedMs) && payload.elapsedMs < minElapsedMs;
  return trapped || hurried;
}

/** The log names the form and the submission, never what was written. */
async function deliver(sink: FormSink | undefined, submission: FormSubmission): Promise<Response> {
  if (!sink) {
    console.error(`[forms] ${submission.form.id}: no sink configured; ${submission.id} was not delivered`);
    return reply(503, "unconfigured");
  }
  try {
    await sink.deliver(submission);
    return reply(200);
  } catch (error) {
    console.error(`[forms] ${submission.form.id}: delivering ${submission.id} failed: ${error instanceof Error ? error.message : String(error)}`);
    return reply(502, "delivery_failed");
  }
}

function reply(status: number, error?: string, detail: Record<string, unknown> = {}): Response {
  const body = error ? { ok: false, error, ...detail } : { ok: true };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
