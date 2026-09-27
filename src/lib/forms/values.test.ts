import assert from "node:assert/strict";
import { test } from "node:test";
import type { FormDefinition } from "./types.ts";
import { applyValues, queryValues, readFormValues } from "./values.ts";

const options = [
  { value: "small", label: "Small" },
  { value: "large", label: "Large" },
];

const form: FormDefinition = {
  id: "offer",
  name: "Offer",
  items: [
    { note: "No form needed for a quote", link: { label: "Prices", href: "/prices" } },
    { row: [{ type: "text", name: "name", label: "Name", maxLength: 5, fromQuery: "name" }, { type: "email", name: "email", label: "E-mail", fromQuery: "email" }] },
    { type: "select", name: "size", label: "Size", options, placeholder: "Choose", fromQuery: "size" },
    { type: "radios", name: "plan", label: "Plan", options, fromQuery: "plan" },
    { type: "checkboxes", name: "extras", label: "Extras", options, fromQuery: "extra" },
    { type: "number", name: "seats", label: "Seats", min: 1, max: 9, fromQuery: "seats" },
    { group: "Optional", items: [{ type: "checkbox", name: "news", label: "News", value: "yes", fromQuery: "news" }, { type: "date", name: "start", label: "Start", fromQuery: "start" }] },
    { type: "hidden", name: "campaign", label: "Campaign", value: "spring" },
  ],
  submit: { label: "Send", waitLabel: "Sending" },
  messages: { success: "ok", error: "no" },
  backend: { kind: "endpoint", url: "/api/forms/offer" },
};

test("readFormValues: every field once, in the shapes the server reads", () => {
  const data = new FormData();
  data.append("name", "Ada");
  data.append("size", "large");
  data.append("extras", "small");
  data.append("extras", "large");
  data.append("campaign", "forged");
  data.append("unrelated", "x");
  assert.deepEqual(readFormValues(form, data), { name: "Ada", email: "", size: "large", plan: "", extras: ["small", "large"], seats: "", news: "", start: "", campaign: "spring" });
});

test("queryValues: only a value the field would take, options for choices", () => {
  const search = "?name=Ada&email=nope&size=large&plan=medium&extra=small&extra=huge&extra=small&seats=12&news=yes&start=2026-02-30&campaign=forged";
  assert.deepEqual(queryValues(form, search), { name: "Ada", size: "large", extras: ["small"], news: "yes" });
  assert.deepEqual(queryValues(form, new URLSearchParams({ name: "Adalbert", seats: "3", start: "2026-02-28" })), { seats: "3", start: "2026-02-28" }, "too long for maxLength");
  assert.deepEqual(queryValues(form, ""), {});
});

test("applyValues: sets a text control's value and ticks the radio or the boxes that carry it", () => {
  const text = { tagName: "INPUT", type: "text", value: "" };
  const select = { tagName: "SELECT", type: "select-one", value: "" };
  const radios = [
    { type: "radio", value: "small", checked: true },
    { type: "radio", value: "large", checked: false },
  ];
  const boxes = [
    { type: "checkbox", value: "small", checked: false },
    { type: "checkbox", value: "large", checked: false },
  ];
  const box = { tagName: "INPUT", type: "checkbox", value: "yes", checked: false };
  const controls: Record<string, unknown> = { name: text, size: select, plan: radios, extras: boxes, news: box };
  applyValues({ elements: { namedItem: (name: string) => controls[name] ?? null } }, { name: "Ada", size: "large", plan: "large", extras: ["large"], news: "yes", missing: "x" });
  assert.equal(text.value, "Ada");
  assert.equal(select.value, "large");
  assert.deepEqual(radios.map((r) => r.checked), [false, true]);
  assert.deepEqual(boxes.map((b) => b.checked), [false, true]);
  assert.equal(box.checked, true);
});
