import assert from "node:assert/strict";
import { test } from "node:test";
import type { FormDefinition } from "../types.ts";
import { mailtoBody } from "./mailto.ts";

const options = [
  { value: "s", label: "Small" },
  { value: "l", label: "Large" },
];

const form: FormDefinition = {
  id: "offer",
  name: "Offer",
  items: [
    { row: [{ type: "text", name: "name", label: "Name" }, { type: "number", name: "seats", label: "Seats" }] },
    { note: "A note is not a field" },
    { type: "select", name: "size", label: "Size", options, placeholder: "Choose" },
    { type: "radios", name: "plan", label: "Plan", options },
    { type: "checkboxes", name: "extras", label: "Extras", options },
    { group: "Optional", items: [{ type: "checkbox", name: "terms", label: "I agree to the", link: { label: "terms", href: "/terms" }, value: "yes" }] },
    { type: "hidden", name: "campaign", label: "Campaign", value: "spring" },
  ],
  submit: { label: "Send", waitLabel: "Sending" },
  messages: { success: "ok", error: "no" },
  backend: { kind: "mailto", to: "hello@acme.example" },
};

test("the mailto body: a line per field, option labels rather than values, a checkbox's label with its link", () => {
  const body = mailtoBody(form, { name: "Ada", seats: "3", size: "l", plan: "", extras: ["s", "l"], terms: "yes", campaign: "spring" });
  assert.equal(body, ["Name: Ada", "Seats: 3", "Size: Large", "Plan: ", "Extras: Small, Large", "I agree to the terms: yes", "Campaign: spring"].join("\n"));
});
