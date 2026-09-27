import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeEmail } from "../email.ts";
import { resolveRecipient, withEmailToken } from "./email-token.ts";
import type { FormDefinition } from "./types.ts";

const mailto = { kind: "mailto", to: "hello@acme.example", subject: "Contact" } as const;
const form: FormDefinition = { id: "contact", name: "Contact", items: [{ name: "email", label: "E-mail", type: "email", required: true }], submit: { label: "Send", waitLabel: "Sending" }, messages: { success: "ok", error: "no" }, backend: mailto };

/** The mailto backend of a definition, or a failed test. */
function mailtoOf(definition: FormDefinition) {
  assert.equal(definition.backend.kind, "mailto");
  if (definition.backend.kind !== "mailto") throw new Error("unreachable");
  return definition.backend;
}

test("withEmailToken encodes a mailto recipient and leaves the rest of the definition alone", () => {
  const guarded = withEmailToken(form);
  const backend = mailtoOf(guarded);
  assert.notEqual(backend.to, "hello@acme.example");
  assert.ok(!backend.to.includes("@"));
  assert.equal(backend.subject, "Contact");
  assert.deepEqual(guarded.items, form.items);
  assert.equal(mailtoOf(form).to, "hello@acme.example", "the original is untouched");
  assert.equal(mailtoOf(withEmailToken(guarded)).to, backend.to, "idempotent: a token is not encoded twice");
});

test("withEmailToken leaves an endpoint form alone", () => {
  const endpoint: FormDefinition = { ...form, backend: { kind: "endpoint", url: "/api/forms/contact" } };
  assert.equal(withEmailToken(endpoint), endpoint);
});

test("resolveRecipient gives the address back for a token and passes a plain address through", () => {
  assert.equal(resolveRecipient(encodeEmail("hello@acme.example")), "hello@acme.example");
  assert.equal(resolveRecipient("hello@acme.example"), "hello@acme.example");
});
