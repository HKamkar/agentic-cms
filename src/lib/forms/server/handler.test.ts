import assert from "node:assert/strict";
import { test } from "node:test";
import type { FormDefinition } from "../types.ts";
import { createFormHandler, type FormHandlerOptions } from "./handler.ts";
import { memoryRateLimiter } from "./rate-limit.ts";
import type { FormSink } from "./sink.ts";
import type { FormSubmission } from "./submission.ts";

const base = { name: "Contact", items: [{ type: "email", name: "email", label: "E-mail", required: true }], submit: { label: "Send", waitLabel: "Sending" }, messages: { success: "ok", error: "no" } } satisfies Omit<FormDefinition, "id" | "backend">;
const forms: Record<string, FormDefinition> = {
  contact: { ...base, id: "contact", backend: { kind: "endpoint", url: "/api/forms/contact" } },
  letter: { ...base, id: "letter", backend: { kind: "mailto", to: "hello@acme.example" } },
};

/** A sink that keeps what it receives, or fails when told to. */
function memorySink(fail = false) {
  const received: FormSubmission[] = [];
  const sink: FormSink = {
    async deliver(submission) {
      if (fail) throw new Error("the provider is down");
      received.push(submission);
    },
  };
  return { received, sink };
}

const handlerWith = (sink: FormHandlerOptions["sink"], options: Partial<FormHandlerOptions> = {}) => createFormHandler({ forms, sink, ...options });

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://site.example/api/forms/contact", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

async function answer(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  return { status: response.status, body: await response.json() };
}

const good = { values: { email: "ada@example.com" }, trap: "", elapsedMs: 5000, page: "https://site.example/contact?utm_source=news" };

test("a valid submission reaches the sink in the wire format", async () => {
  const { received, sink } = memorySink();
  assert.deepEqual(await answer(await handlerWith(sink)(post(good), "contact")), { status: 200, body: { ok: true } });
  assert.equal(received.length, 1);
  assert.deepEqual(received[0].values, { email: "ada@example.com" });
  assert.deepEqual(received[0].page.utm, { source: "news" });
});

test("a sink given as a function is read per request", async () => {
  const { received, sink } = memorySink();
  let reads = 0;
  const handle = handlerWith(() => (reads++, sink));
  await handle(post(good), "contact");
  await handle(post(good), "contact");
  assert.equal(reads, 2);
  assert.equal(received.length, 2);
});

test("a form that is unknown, or not an endpoint form, is not served", async () => {
  const handle = handlerWith(memorySink().sink);
  assert.equal((await handle(post(good), "nope")).status, 404);
  assert.equal((await handle(post(good), "letter")).status, 404);
});

test("only JSON, only up to the cap", async () => {
  const handle = handlerWith(memorySink().sink, { maxBodyBytes: 64 });
  assert.equal((await handle(post(good, { "content-type": "application/x-www-form-urlencoded" }), "contact")).status, 415);
  assert.equal((await handle(post({ ...good, values: { email: "a".repeat(80) } }), "contact")).status, 413);
  const lying = post({ ...good, values: { email: "a".repeat(80) } }, { "content-length": "10" });
  assert.equal((await handle(lying, "contact")).status, 413);
});

test("bad JSON and invalid fields are refused with the fields named", async () => {
  const handle = handlerWith(memorySink().sink);
  assert.deepEqual(await answer(await handle(post("{"), "contact")), { status: 400, body: { ok: false, error: "invalid_json" } });
  assert.deepEqual(await answer(await handle(post({ values: { email: "no" } }), "contact")), { status: 400, body: { ok: false, error: "invalid", fields: ["email"] } });
});

test("spam is answered as a success and delivered nowhere", async () => {
  const { received, sink } = memorySink();
  const handle = handlerWith(sink);
  assert.equal((await handle(post({ ...good, trap: "https://spam.example" }), "contact")).status, 200);
  assert.equal((await handle(post({ ...good, elapsedMs: 300 }), "contact")).status, 200);
  assert.equal(received.length, 0);
});

test("missing spam signals are not spam: a Form that sends no context still delivers", async () => {
  const { received, sink } = memorySink();
  await handlerWith(sink)(post({ values: good.values }), "contact");
  assert.equal(received.length, 1);
});

test("the rate limit counts per form and address", async () => {
  const handle = handlerWith(memorySink().sink, { rateLimiter: memoryRateLimiter({ limit: 1 }) });
  assert.equal((await handle(post(good), "contact")).status, 200);
  assert.equal((await handle(post(good), "contact")).status, 429);
  assert.equal((await handle(post(good, { "x-forwarded-for": "198.51.100.1" }), "contact")).status, 200);
});

test("no sink answers 503, a failing sink 502, and neither logs what was written", async (t) => {
  const logged: string[] = [];
  t.mock.method(console, "error", (line: string) => logged.push(line));
  assert.deepEqual(await answer(await handlerWith(undefined)(post(good), "contact")), { status: 503, body: { ok: false, error: "unconfigured" } });
  assert.deepEqual(await answer(await handlerWith(memorySink(true).sink)(post(good), "contact")), { status: 502, body: { ok: false, error: "delivery_failed" } });
  assert.equal(logged.length, 2);
  assert.ok(logged.every((line) => !line.includes("ada@example.com")));
});

test("two forms with one id are a configuration error", () => {
  assert.throws(() => createFormHandler({ forms: { a: forms.contact, b: forms.contact }, sink: undefined }), /two forms have the id "contact"/);
});
