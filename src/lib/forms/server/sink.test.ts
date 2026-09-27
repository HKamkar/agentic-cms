import assert from "node:assert/strict";
import { test } from "node:test";
import type { FormDefinition } from "../types.ts";
import { signFormBody, verifyFormSignature } from "./signature.ts";
import { createFormSink } from "./sink.ts";
import { buildSubmission } from "./submission.ts";

const form: FormDefinition = { id: "contact", name: "Contact", items: [{ type: "email", name: "email", label: "E-mail", required: true }], submit: { label: "Send", waitLabel: "Sending" }, messages: { success: "ok", error: "no" }, backend: { kind: "endpoint", url: "/api/forms/contact" } };
const submission = buildSubmission(form, { email: "ada@example.com" }, { page: "https://site.example/offer?utm_source=news&utm_campaign=spring", referrer: "javascript:alert(1)" });

function fakeFetch(status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(null, { status });
  }) as typeof fetch;
  return { calls, fetcher };
}

test("the wire format: version, id, the fields with their labels, the page and its UTM tags", () => {
  assert.equal(submission.version, 1);
  assert.match(submission.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(submission.form, { id: "contact", name: "Contact" });
  assert.deepEqual(submission.fields, [{ name: "email", label: "E-mail", value: "ada@example.com" }]);
  assert.deepEqual(submission.page, { url: "https://site.example/offer?utm_source=news&utm_campaign=spring", referrer: undefined, utm: { source: "news", campaign: "spring" } });
  assert.ok(!Number.isNaN(Date.parse(submission.submittedAt)));
});

test("the wire format's fields: out of groups, in order, a checkbox labelled with its link, values as sent", () => {
  const grouped: FormDefinition = { ...form, items: [{ note: "Not a field" }, { group: "Optional", items: [{ type: "checkbox", name: "terms", label: "I agree to the", link: { label: "terms", href: "/terms" }, value: "yes" }] }, { type: "select", name: "size", label: "Size", options: [{ value: "l", label: "Large" }] }] };
  assert.deepEqual(buildSubmission(grouped, { terms: "yes", size: "l" }).fields, [
    { name: "terms", label: "I agree to the terms", value: "yes" },
    { name: "size", label: "Size", value: "l" },
  ]);
});

test("the webhook posts the submission signed, and the signature verifies", async () => {
  const { calls, fetcher } = fakeFetch();
  await createFormSink({ kind: "webhook", url: "https://hooks.example/in", secret: "s3cret", headers: { Authorization: "Bearer k" } }, fetcher).deliver(submission);
  const { url, init } = calls[0];
  const headers = init.headers as Record<string, string>;
  assert.equal(url, "https://hooks.example/in");
  assert.equal(init.redirect, "manual");
  assert.equal(headers.Authorization, "Bearer k");
  assert.equal(headers["X-Form-Submission-Id"], submission.id);
  assert.deepEqual(JSON.parse(init.body as string), JSON.parse(JSON.stringify(submission)));
  const signed = { body: init.body as string, timestamp: headers["X-Form-Timestamp"], signature: headers["X-Form-Signature"] };
  assert.equal(await verifyFormSignature("s3cret", signed), true);
  assert.equal(await verifyFormSignature("other", signed), false);
  assert.equal(await verifyFormSignature("s3cret", { ...signed, body: signed.body.replace("ada", "eve") }), false);
});

test("without a secret the webhook sends no signature", async () => {
  const { calls, fetcher } = fakeFetch();
  await createFormSink({ kind: "webhook", url: "https://hooks.example/in" }, fetcher).deliver(submission);
  assert.equal((calls[0].init.headers as Record<string, string>)["X-Form-Signature"], undefined);
});

test("a redirect or an error status is a failed delivery", async () => {
  await assert.rejects(createFormSink({ kind: "webhook", url: "https://hooks.example/in" }, fakeFetch(302).fetcher).deliver(submission), /302/);
  await assert.rejects(createFormSink({ kind: "webhook", url: "https://hooks.example/in" }, fakeFetch(500).fetcher).deliver(submission), /500/);
});

test("a signature outside the tolerance, or malformed, does not verify", async () => {
  const body = "{}";
  const signature = await signFormBody("s3cret", "1000", body);
  assert.equal(await verifyFormSignature("s3cret", { body, timestamp: "1000", signature }, { now: 1000_000 }), true);
  assert.equal(await verifyFormSignature("s3cret", { body, timestamp: "1000", signature }, { now: 1400_000 }), false);
  assert.equal(await verifyFormSignature("s3cret", { body, timestamp: "1000", signature: "sha256=zz" }, { now: 1000_000 }), false);
  assert.equal(await verifyFormSignature("s3cret", { body, timestamp: null, signature }), false);
});
