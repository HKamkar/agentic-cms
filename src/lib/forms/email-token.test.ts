import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeEmail } from "../email.ts";
import { resolveRecipient, withEmailToken } from "./email-token.ts";
import type { FormDefinition } from "./types.ts";

const form: FormDefinition = { id: "contact", name: "Contact", items: [{ name: "email", label: "E-mail", type: "email", required: true }], submit: { label: "Send", waitLabel: "Sending" }, messages: { success: "ok", error: "no" }, backend: { kind: "mailto", to: "hello@acme.example", subject: "Contact" } };

test("withEmailToken encodes a mailto recipient and leaves the rest of the definition alone", () => {
  const guarded = withEmailToken(form);
  assert.equal(guarded.backend.kind, "mailto");
  assert.notEqual(guarded.backend.to, "hello@acme.example");
  assert.ok(!guarded.backend.to.includes("@"));
  assert.equal(guarded.backend.subject, "Contact");
  assert.deepEqual(guarded.items, form.items);
  assert.equal(form.backend.to, "hello@acme.example", "the original is untouched");
  assert.equal(withEmailToken(guarded).backend.to, guarded.backend.to, "idempotent: a token is not encoded twice");
});

test("resolveRecipient gives the address back for a token and passes a plain address through", () => {
  assert.equal(resolveRecipient(encodeEmail("hello@acme.example")), "hello@acme.example");
  assert.equal(resolveRecipient("hello@acme.example"), "hello@acme.example");
});
