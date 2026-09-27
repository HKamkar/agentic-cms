import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeEmail } from "../email.ts";
import { messageParts, resolveRecipient, withEmailToken } from "./email-token.ts";
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

test("withEmailToken leaves an endpoint form without an address alone", () => {
  const endpoint: FormDefinition = { ...form, backend: { kind: "endpoint", url: "/api/forms/contact" } };
  assert.equal(withEmailToken(endpoint), endpoint);
});

test("withEmailToken encodes the messages' address for any backend, once", () => {
  const endpoint: FormDefinition = { ...form, messages: { success: "ok", error: "Write to {email}.", email: "hello@acme.example" }, backend: { kind: "endpoint", url: "/api/forms/contact" } };
  const guarded = withEmailToken(endpoint);
  assert.equal(guarded.messages.email, encodeEmail("hello@acme.example"));
  assert.equal(guarded.messages.error, "Write to {email}.");
  assert.deepEqual(guarded.backend, endpoint.backend);
  assert.equal(endpoint.messages.email, "hello@acme.example", "the original is untouched");
  assert.equal(withEmailToken(guarded), guarded, "idempotent");
  const both = withEmailToken({ ...form, messages: endpoint.messages });
  assert.equal(mailtoOf(both).to, both.messages.email);
  assert.ok(!JSON.stringify(both).includes("@"), "no address left anywhere in the definition");
});

test("messageParts splits a message at {email}, as a token; without an address the slot stays", () => {
  const token = encodeEmail("hello@acme.example");
  assert.deepEqual(messageParts("Write to {email}.", "hello@acme.example"), ["Write to ", { token }, "."]);
  assert.deepEqual(messageParts("{email} or {email}", token), [{ token }, " or ", { token }]);
  assert.deepEqual(messageParts("Thank you.", token), ["Thank you."]);
  assert.deepEqual(messageParts("Write to {email}."), ["Write to {email}."]);
});

test("resolveRecipient gives the address back for a token and passes a plain address through", () => {
  assert.equal(resolveRecipient(encodeEmail("hello@acme.example")), "hello@acme.example");
  assert.equal(resolveRecipient("hello@acme.example"), "hello@acme.example");
});
