import assert from "node:assert/strict";
import { test } from "node:test";
import { createFormBackend } from "../backend.ts";
import type { FormDefinition } from "../types.ts";
import { EndpointBackend } from "./endpoint.ts";

const form: FormDefinition = { id: "contact", name: "Contact", items: [{ name: "email", label: "E-mail", type: "email", required: true }], submit: { label: "Send", waitLabel: "Sending" }, messages: { success: "ok", error: "no" }, backend: { kind: "endpoint", url: "/api/forms/contact" } };

/** A fetch that records its calls and answers with `respond`. */
function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  }) as typeof fetch;
  return { calls, fetcher };
}

test("the factory builds an endpoint backend for an endpoint form", () => {
  assert.ok(createFormBackend(form.backend) instanceof EndpointBackend);
});

test("posts the values and the spam signals as JSON to the form's URL", async () => {
  const { calls, fetcher } = fakeFetch(() => Response.json({ ok: true }));
  const result = await new EndpointBackend({ url: "/api/forms/contact" }, fetcher).submit(form, { email: "a@b.example" }, { trap: "", elapsedMs: 4200 });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].url, "/api/forms/contact");
  assert.equal(calls[0].init.method, "POST");
  assert.equal((calls[0].init.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { values: { email: "a@b.example" }, trap: "", elapsedMs: 4200 });
});

test("a refusal reads the server's error, or the status when there is none", async () => {
  const refused = new EndpointBackend({ url: "/x" }, fakeFetch(() => Response.json({ ok: false, error: "invalid" }, { status: 400 })).fetcher);
  assert.deepEqual(await refused.submit(form, {}), { ok: false, error: "invalid" });
  const broken = new EndpointBackend({ url: "/x" }, fakeFetch(() => new Response("<html>", { status: 500 })).fetcher);
  assert.deepEqual(await broken.submit(form, {}), { ok: false, error: "HTTP 500" });
});

test("a network failure is a failed submission, never a throw", async () => {
  const offline = new EndpointBackend({ url: "/x" }, fakeFetch(() => Promise.reject(new TypeError("fetch failed"))).fetcher);
  assert.deepEqual(await offline.submit(form, {}), { ok: false, error: "fetch failed" });
});
