# Form engine

Forms are data. A `FormDefinition` in `src/config/forms.ts` describes the
fields, the copy and the delivery backend; `<Form definition={forms.x} />`
renders it with the field primitives and submits it through a swappable
backend. Adding a landing-page form means adding a definition, not writing
components. A form delivers one of two ways: `mailto` opens the visitor's
mail client, `endpoint` posts to a route of the site, which checks the
submission and hands it to the site's **sink** — a webhook, or a provider's
API behind the same interface. This document is the complete contract; the
guide for switching a site over is `docs/forms.md`.

## Rules that must not break

1. **Definitions are config, checked by the compiler.** `forms.ts` uses
   `satisfies Record<string, FormDefinition>`; a wrong field type or a missing
   key fails `tsc`/`pnpm build`. Never bypass the types with casts.
2. **The primitives own their styling.** `src/components/ui/form/` renders
   semantic controls (real `<label>`s, a `role="group"` for checkboxes) with
   Tailwind utilities; the shared control classes are `control` in `field.ts`
   and the submit wears `buttonClass()` from `ui/Button`. Restyle there, never
   through config.
3. **Validation is native** in the browser: `required` and `type="email"` on
   the controls. Do not add a client-side validation library. The endpoint
   repeats the same checks on the server, no stricter, so a visitor the
   browser lets through is never refused there.
4. **Backends and sinks are the only places that talk to the outside
   world.** Field components and the engine never call `fetch`; the browser
   delivers through `createFormBackend(definition.backend).submit(...)`, the
   route through its sink.
5. **Pages stay prerendered; the endpoint is one route.** A site that uses
   `endpoint` forms has one dynamic route, `src/app/api/forms/[id]/route.ts`,
   and nothing else runs at request time. The destination and its secrets
   live on the server — in the environment, read by
   `src/config/form-delivery.ts` — never in `forms.ts`, whose definitions
   reach the browser.
6. **The kit names no provider.** It ships the mechanism and two sinks that
   work with anything (a signed webhook, a development log); which service
   receives a site's submissions is the site's choice, made in its
   environment or in a `FormSink` of its own.

## Files

| File | Role |
|---|---|
| `src/config/forms.ts` | Every form on the site (`forms.contact`, …). |
| `src/lib/forms/types.ts` | `FormDefinition`, `FieldDefinition` (`text` / `email` / `tel` / `textarea` / `checkboxes`), `FormRow`, `FormBackendConfig`, `FormValues`, `EndpointPayload`; helpers `isRow`, `fieldsOf`, `fieldId`; `TRAP_FIELD`, the honeypot's name. |
| `src/lib/forms/backend.ts` | `FormBackend` interface (`submit(form, values, context?) → SubmitResult`), `SubmitContext` and the factory `createFormBackend(config)`. |
| `src/lib/forms/backends/mailto.ts` | `MailtoBackend`: opens the visitor's mail client with the submission as the body. Zero infrastructure; the site itself sends nothing. |
| `src/lib/forms/backends/endpoint.ts` | `EndpointBackend`: posts the values, the spam signals and the page as JSON to the form's route; never throws. |
| `src/lib/forms/server/` | `agentic-cms/forms/server`, for the route only: `handler.ts` (`createFormHandler`), `validate.ts`, `submission.ts` (the wire format), `rate-limit.ts` (`memoryRateLimiter`, `clientIp`), `sink.ts` + `sinks/` (`webhook`, `log`), `signature.ts` (`signFormBody`, `verifyFormSignature`). |
| `src/app/api/forms/[id]/route.ts` | The route: `POST` hands the request to the handler. |
| `src/config/form-delivery.ts` | `formSink()`: the destination, read from the environment per request. |
| `src/components/ui/form/Form.tsx` | The engine (client component): renders items, reads values, calls the backend, drives `idle → submitting → done \| fail`; for an endpoint form also the honeypot and the time on screen. |
| `src/components/ui/form/FormShell.tsx` | The form plus its success and error blocks and their show/hide behaviour. |
| `src/components/ui/form/FieldRow.tsx`, `FieldWrap.tsx`, `field.ts` | Two-column row; `<label>` + control column; the shared control classes. |
| `src/components/ui/form/TextField.tsx`, `TextArea.tsx`, `CheckboxGroup.tsx` | The controls. The checkbox is the browser's own, tinted to the one ink colour with `accent-ink`. |
| `src/components/ui/form/SubmitButton.tsx` | A real `<button type="submit">` wearing `buttonClass("solid")`, disabled while the submission is in flight. |
| `src/components/contact/ContactForm.tsx` | Example consumer: the `contact-form` section, which renders `<Form>` with the definition its page file names. |

## Definition contract

```ts
type FormDefinition = {
  id: string;                                   // <form id>, prefixes field ids, names the endpoint's route
  name: string;                                 // human name; mailto uses it as the subject fallback
  items: (FieldDefinition | { row: FieldDefinition[] })[];
  submit: { label: string; waitLabel: string }; // button text; waitLabel while submitting
  messages: { success: string; error: string }; // shown in the done / fail blocks
  backend: FormBackendConfig;                   // where submissions go
};

type FieldDefinition =
  | { type: "text" | "email" | "tel"; name; label; placeholder?; maxLength?; required? }
  | { type: "textarea";               name; label; placeholder?; maxLength?; required? }
  | { type: "checkboxes";             name; label; options: { value; label }[]; required? };

type FormBackendConfig =
  | { kind: "mailto"; to: string; subject?: string }
  | { kind: "endpoint"; url: string };          // the site's route: "/api/forms/<id>"
```

`name` is the key in the submitted values; checkbox groups always submit a
`string[]`, everything else a `string`. Field ids are `${form.id}-${field.name}`.

## The endpoint

**In the browser.** `EndpointBackend` posts `EndpointPayload` —
`{ values, trap, elapsedMs, page, referrer }` — as `application/json` to
the form's `url`. `trap` is the content of the honeypot input `<Form>`
renders for endpoint forms only (named `TRAP_FIELD`, hidden from people and
from assistive technology, out of the tab order); `elapsedMs` is the time
since the form mounted; `page` is `location.href`, so a landing page's UTM
tags travel. A refusal or a network failure resolves to `{ ok: false }`, and
the form shows its error message.

**On the server.** The route is one line around the handler:

```ts
// src/app/api/forms/[id]/route.ts
const handle = createFormHandler({ forms, sink: formSink });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, (await params).id);
}
```

`createFormHandler({ forms, sink, rateLimiter?, clientIp?, minElapsedMs?,
maxBodyBytes? })` builds one handler per process (it holds the rate
limiter's memory); `sink` is a `FormSink`, or a function returning one per
request (a Worker's environment exists only then), or `undefined`. Every
answer is JSON with `Cache-Control: no-store`, in this order:

| Status | `error` | When |
|---|---|---|
| 404 | `unknown_form` | No form has that `id`, or its backend is not `endpoint`. |
| 415 | `json_only` | The body is not `application/json` — which a cross-site page cannot send without a CORS preflight this route never answers. |
| 413 | `too_large` | Past `maxBodyBytes` (32 KiB), by its declared length or as it streams in. |
| 429 | `rate_limited` | Over the limit for that form and address (5 per 10 minutes by default). |
| 400 | `invalid_json`, `invalid` (+ `fields`) | Not a JSON object; fields the browser would have refused, by name. |
| 200 | — | Spam: the honeypot filled, or sent less than `minElapsedMs` (1.5 s) after the form appeared. Told it succeeded, delivered nowhere. A missing signal is not spam. |
| 503 | `unconfigured` | No sink. |
| 502 | `delivery_failed` | The sink threw. |
| 200 | — | Delivered. |

The server log names the form and the submission's `id` on a failure, never
what was written.

**Validation** (`validateSubmission`) repeats the browser: text fields are
strings, `required` means not empty, `maxLength` counts a CRLF line break as
one character, an `email` field matches the HTML standard's pattern, a
checkbox group is never required and holds only its options' values. Keys
the definition does not name are dropped.

**The rate limit** (`memoryRateLimiter`) is a fixed window per form and
address in the server's memory, bounded to 10 000 keys: it counts per
instance, and per isolate on Workers, so it slows a script down rather than
enforcing a quota. A site that needs a hard limit passes a `RateLimiter` of
its own over a shared store. The address (`clientIp`) is the rightmost
`X-Forwarded-For` hop, the one the host's proxy appended (App Service,
Cloudflare); a site behind another proxy of its own passes its own reader.

## The wire format (version 1)

What every sink receives, and what the webhook posts:

```ts
type FormSubmission = {
  version: 1;
  id: string;                                   // a UUID: drop a submission you already have
  form: { id: string; name: string };
  submittedAt: string;                          // ISO 8601, the server's clock
  fields: { name: string; label: string; value: string | string[] }[];  // in the form's order
  values: Record<string, string | string[]>;
  page: { url?: string; referrer?: string; utm: { source?; medium?; campaign?; term?; content? } };
};
```

`page` holds only http(s) URLs up to 2048 characters; the UTM tags are read
from `page.url`. A change to this shape is a new `version`.

## Sinks

```ts
interface FormSink { deliver(submission: FormSubmission): Promise<void> }   // throws when it could not
type FormSinkConfig =
  | { kind: "webhook"; url: string; secret?: string; headers?: Record<string, string> }
  | { kind: "log" };
```

- **`webhook`** posts the submission as JSON with `X-Form-Submission-Id`,
  the site's `headers` (an API key a receiver asks for) and, with a
  `secret`, `X-Form-Timestamp` (Unix seconds) and `X-Form-Signature:
  sha256=<hex>` — HMAC-SHA256 of `` `${timestamp}.${body}` ``. It follows no
  redirect (a redirected POST would arrive as a body-less GET) and waits
  10 s; anything but a 2xx throws. Any service that accepts a webhook takes
  it as it is: an automation platform, a CRM's inbound hook, a function of
  the site's.
- **`log`** prints each submission to the server's log. Development only.
- **A provider's own API** is a class implementing `FormSink` in a server
  module of the site's (`src/server/`, say), mapping the wire format onto
  the provider's fields; `formSink()` returns it (`docs/forms.md` has one).

**Verifying the signature** in a receiver: recompute the HMAC over the raw
body as received, compare in constant time, and refuse a timestamp more
than 300 s from now. In JavaScript that is `verifyFormSignature(secret, {
body, timestamp, signature })` from `agentic-cms/forms/server`.

## Recipes

**Add a form to a page.** Add an entry to `forms.ts`. A page file then names
it: a `contact-form` section's `form` field is a key of `forms.ts` (the
schema rejects any other value). A section of its own renders
`<Form definition={forms.myForm} />` inside whatever markup it needs (see
`ContactForm.tsx`). Nothing else.

**Deliver a form to a provider.** Set its backend to `{ kind: "endpoint",
url: "/api/forms/<its id>" }`, then point the environment at the provider:
`FORM_WEBHOOK_URL` and `FORM_WEBHOOK_SECRET`, which `form-delivery.ts`
reads. Every endpoint form shares the route and the sink; a sink that sends
forms to different places branches on `submission.form.id`. Say so in the
privacy notice (`docs/forms.md`).

**Add a field type** (e.g. `select`). Add the variant to `FieldDefinition` in
`types.ts`, create `src/components/ui/form/Select.tsx` on the `control`
classes, add the `case` in `Field()` in `Form.tsx`, teach
`server/validate.ts` what the browser accepts from it, document it here and
in `src/components/README.md`.

**Add a sink kind** the kit ships. Only a kind that names no provider
belongs in the kit (rule 6): add the variant to `FormSinkConfig`, a class in
`server/sinks/`, the `case` in `createFormSink()`, a test and a line here.
A provider's sink stays in the site.

**Add a backend.** Add the variant to `FormBackendConfig` in `types.ts`, a
class implementing `FormBackend` in `backends/` that never throws, and the
`case` in `createFormBackend()`.

**The recipient as a token.** A site that keeps its address out of served
files (`docs/email.md`) wraps the definition in the server component that
renders the form: `<Form definition={withEmailToken(forms.contact)} />`.
The mailto backend resolves the token at submit (`resolveRecipient`); a
plain address passes through; other backends are untouched.

**Change copy or fields of the contact form.** Edit `forms.contact` only.

## Status

Both backends are wired. A `mailto` form's "success" means the mail client
was opened with a draft; an `endpoint` form's means the sink accepted it.
The example's contact form ships on `mailto`, and its route and
`form-delivery.ts` are ready for the switch.
