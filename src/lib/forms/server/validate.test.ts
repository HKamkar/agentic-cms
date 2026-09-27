import assert from "node:assert/strict";
import { test } from "node:test";
import type { FormDefinition } from "../types.ts";
import { validateSubmission } from "./validate.ts";

const form: FormDefinition = {
  id: "contact",
  name: "Contact",
  items: [
    { row: [{ type: "text", name: "name", label: "Name", required: true, maxLength: 5 }, { type: "email", name: "email", label: "E-mail", required: true }] },
    { type: "textarea", name: "message", label: "Message", maxLength: 6 },
    { type: "checkboxes", name: "topics", label: "Topics", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
  ],
  submit: { label: "Send", waitLabel: "Sending" },
  messages: { success: "ok", error: "no" },
  backend: { kind: "endpoint", url: "/api/forms/contact" },
};

const valid = { name: "Ada", email: "ada@example.com", message: "Hi", topics: ["a"] };

test("a submission the browser would send passes, keys the form does not name are dropped", () => {
  assert.deepEqual(validateSubmission(form, { ...valid, extra: "x" }), { ok: true, values: valid });
});

test("missing optional fields read as the browser sends them: empty text, no choices", () => {
  assert.deepEqual(validateSubmission(form, { name: "Ada", email: "ada@example.com" }), { ok: true, values: { name: "Ada", email: "ada@example.com", message: "", topics: [] } });
});

test("each failing field is named", () => {
  const result = validateSubmission(form, { name: "", email: "not an address", message: "far too long", topics: ["c"] });
  assert.deepEqual(result, { ok: false, fields: ["name", "email", "message", "topics"] });
});

test("wrong types fail, and so does a body that is not an object", () => {
  assert.deepEqual(validateSubmission(form, { ...valid, name: ["Ada"], topics: "a" }), { ok: false, fields: ["name", "topics"] });
  assert.deepEqual(validateSubmission(form, "Ada"), { ok: false, fields: ["name", "email"] });
});

test("a CRLF line break counts as one character, as the browser counts it for maxlength", () => {
  const result = validateSubmission(form, { ...valid, message: "ab\r\ncd" });
  assert.deepEqual(result, { ok: true, values: { ...valid, message: "ab\ncd" } });
});

test("a checkbox group is never required and repeats collapse", () => {
  assert.deepEqual(validateSubmission(form, { ...valid, topics: [] }), { ok: true, values: { ...valid, topics: [] } });
  assert.deepEqual(validateSubmission(form, { ...valid, topics: ["b", "b"] }), { ok: true, values: { ...valid, topics: ["b"] } });
});

test("an optional e-mail field may stay empty", () => {
  const optional: FormDefinition = { ...form, items: [{ type: "email", name: "email", label: "E-mail" }] };
  assert.deepEqual(validateSubmission(optional, { email: "" }), { ok: true, values: { email: "" } });
});
