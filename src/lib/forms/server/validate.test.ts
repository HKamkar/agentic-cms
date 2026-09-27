import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldsOf, type FieldDefinition, type FormDefinition } from "../types.ts";
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

/** A form of one field, and whether it takes a value. */
const one = (field: FieldDefinition): FormDefinition => ({ ...form, items: [field] });
const accepts = (definition: FormDefinition, value: unknown) => validateSubmission(definition, { [fieldsOf(definition)[0].name]: value }).ok;

test("text: minLength counts only a value that was entered, pattern is anchored and compiled with the v flag", () => {
  const code = one({ type: "text", name: "code", label: "Code", minLength: 3, pattern: "[a-z]+" });
  assert.equal(accepts(code, ""), true);
  assert.equal(accepts(code, "ab"), false);
  assert.equal(accepts(code, "abc"), true);
  assert.equal(accepts(code, "abc1"), false, "anchored: the whole value matches");
  assert.equal(accepts(one({ type: "text", name: "code", label: "Code", pattern: "[\\p{L}--[a-z]]+" }), "ÄB"), true, "v-flag set subtraction");
  assert.equal(accepts(one({ type: "text", name: "code", label: "Code", pattern: "[(]" }), "anything"), true, "a pattern the v flag cannot compile constrains nothing");
});

test("url: what the URL parser takes, as the browser's check is", () => {
  const site = one({ type: "url", name: "site", label: "Site" });
  assert.equal(accepts(site, "https://acme.example/a?b"), true);
  assert.equal(accepts(site, "mailto:x"), true);
  assert.equal(accepts(site, "acme.example"), false);
  assert.equal(accepts(site, ""), true);
});

test("number: the float syntax, min and max, and the step from its base", () => {
  const count = one({ type: "number", name: "n", label: "N", min: 1, max: 10 });
  for (const ok of ["", "1", "10", "5", "1e1"]) assert.equal(accepts(count, ok), true, ok);
  for (const bad of ["0", "11", "2.5", "1.", "+3", "abc", "0x3", "Infinity", "1e400"]) assert.equal(accepts(count, bad), false, bad);
  const cents = one({ type: "number", name: "n", label: "N", step: 0.01 });
  assert.equal(accepts(cents, "0.3"), true, "a decimal step forgives float error");
  assert.equal(accepts(cents, "19.99"), true);
  assert.equal(accepts(cents, "0.005"), false);
  const odd = one({ type: "number", name: "n", label: "N", min: 1, step: 2 });
  assert.equal(accepts(odd, "3"), true, "the step counts from min");
  assert.equal(accepts(odd, "4"), false);
  const fromDefault = one({ type: "number", name: "n", label: "N", step: 5, defaultValue: 2 });
  assert.equal(accepts(fromDefault, "-3"), true, "without min, from the default value");
  assert.equal(accepts(fromDefault, "5"), false);
  assert.equal(accepts(one({ type: "number", name: "n", label: "N", step: "any" }), "3.14159"), true);
  assert.equal(accepts(one({ type: "number", name: "n", label: "N", required: true }), ""), false);
});

test("date: a real day, as YYYY-MM-DD, between min and max", () => {
  const day = one({ type: "date", name: "d", label: "D", min: "2026-01-01", max: "2026-12-31" });
  for (const ok of ["", "2026-01-01", "2026-12-31", "2026-02-28"]) assert.equal(accepts(day, ok), true, ok);
  for (const bad of ["2025-12-31", "2027-01-01", "2026-02-29", "2026-13-01", "2026-1-1", "01/02/2026"]) assert.equal(accepts(day, bad), false, bad);
  assert.equal(accepts(one({ type: "date", name: "d", label: "D" }), "2028-02-29"), true, "a leap day");
  assert.equal(accepts(one({ type: "date", name: "d", label: "D" }), "0000-01-01"), false, "no year 0");
  assert.equal(accepts(one({ type: "date", name: "d", label: "D", min: "not a date" }), "1999-01-01"), true, "a min that is not a date constrains nothing");
});

test("textarea: minLength and maxLength, pattern-free", () => {
  const note = one({ type: "textarea", name: "t", label: "T", minLength: 3, rows: 4 });
  assert.equal(accepts(note, "ab"), false);
  assert.equal(accepts(note, "a\r\nb"), true, "CRLF counts as one character, the value is three long");
});

const topics = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

test("select: one of its options; the placeholder's empty value only when it has one and is not required", () => {
  const withPlaceholder = one({ type: "select", name: "s", label: "S", options: topics, placeholder: "Choose" });
  assert.equal(accepts(withPlaceholder, ""), true);
  assert.equal(accepts(withPlaceholder, "b"), true);
  assert.equal(accepts(withPlaceholder, "c"), false);
  assert.equal(accepts(one({ type: "select", name: "s", label: "S", options: topics, placeholder: "Choose", required: true }), ""), false);
  assert.equal(accepts(one({ type: "select", name: "s", label: "S", options: topics }), ""), false, "without a placeholder the browser always sends an option");
});

test("radios: one of its options, or none when not required", () => {
  const choice = one({ type: "radios", name: "r", label: "R", options: topics });
  assert.equal(accepts(choice, undefined), true);
  assert.equal(accepts(choice, "a"), true);
  assert.equal(accepts(choice, "z"), false);
  assert.equal(accepts(choice, ["a"]), false);
  assert.equal(accepts(one({ type: "radios", name: "r", label: "R", options: topics, required: true }), ""), false);
});

test("checkbox: its own value or nothing; required means ticked", () => {
  const consent = one({ type: "checkbox", name: "c", label: "I agree to the", link: { label: "terms", href: "/terms" }, value: "yes", required: true });
  assert.equal(accepts(consent, "yes"), true);
  assert.equal(accepts(consent, ""), false);
  assert.equal(accepts(consent, "on"), false);
  const optIn = one({ type: "checkbox", name: "c", label: "News", value: "yes" });
  assert.equal(accepts(optIn, undefined), true);
});

test("hidden: the definition's value, whatever the client sent", () => {
  const campaign = one({ type: "hidden", name: "campaign", label: "Campaign", value: "spring" });
  assert.deepEqual(validateSubmission(campaign, { campaign: "forged" }), { ok: true, values: { campaign: "spring" } });
  assert.deepEqual(validateSubmission(campaign, {}), { ok: true, values: { campaign: "spring" } });
});

test("fields inside groups are validated, notes submit nothing", () => {
  const grouped: FormDefinition = {
    ...form,
    items: [{ note: "Read this first", link: { label: "here", href: "/x" } }, { group: "Optional", items: [{ row: [{ type: "text", name: "role", label: "Role", maxLength: 3 }] }, { type: "email", name: "email", label: "E-mail" }] }],
  };
  assert.deepEqual(validateSubmission(grouped, { role: "CTO", note: "x" }), { ok: true, values: { role: "CTO", email: "" } });
  assert.deepEqual(validateSubmission(grouped, { role: "Chief" }), { ok: false, fields: ["role"] });
});
