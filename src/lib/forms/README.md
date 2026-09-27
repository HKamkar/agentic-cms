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
   semantic controls (real `<label>`s, a `<fieldset>` and `<legend>` for
   radios and groups, a `role="group"` for checkboxes) with Tailwind
   utilities; the shared control classes are `control` in `field.ts` and the
   submit wears `buttonClass()` from `ui/Button`. Restyle there, never
   through config.
3. **Validation is native** in the browser: the controls' own attributes
   (`required`, `type`, `minlength`, `maxlength`, `pattern`, `min`, `max`,
   `step`). Do not add a client-side validation library. The endpoint
   repeats the same checks on the server (`rules.ts`), never stricter, so a
   visitor the browser lets through is never refused there, and anything
   else is refused by field name.
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
| `src/lib/forms/types.ts` | `FormDefinition`, `FieldDefinition` (below), the items that are not fields (`FormRow`, `FormNote`, `FormGroup`), `FormBackendConfig`, `FormValues`, `EndpointPayload`; helpers `isRow`, `isNote`, `isGroup`, `fieldsOf` (every field, out of rows and groups), `fieldId`, `fieldLabel`; `TRAP_FIELD`, the honeypot's name. |
| `src/lib/forms/rules.ts` | `acceptValue(field, value)`: what each control lets through, after the HTML standard — the one definition the server's validation and the prefill share. |
| `src/lib/forms/values.ts` | `readFormValues(definition, formData)`, the values a `<Form>` submits; `queryValues`, `applyValues` and `prefillFromQuery`, the prefill from a URL. |
| `src/lib/forms/backend.ts` | `FormBackend` interface (`submit(form, values, context?) → SubmitResult`), `SubmitContext` and the factory `createFormBackend(config)`. |
| `src/lib/forms/backends/mailto.ts` | `MailtoBackend`: opens the visitor's mail client with the submission as the body (`mailtoBody`: a line per field, option labels rather than values). Zero infrastructure; the site itself sends nothing. |
| `src/lib/forms/email-token.ts` | `withEmailToken`, `resolveRecipient`, `messageParts`: the recipient and the messages' address as tokens (below). |
| `src/lib/forms/backends/endpoint.ts` | `EndpointBackend`: posts the values, the spam signals and the page as JSON to the form's route; never throws. |
| `src/lib/forms/server/` | `agentic-cms/forms/server`, for the route only: `handler.ts` (`createFormHandler`), `validate.ts`, `submission.ts` (the wire format), `rate-limit.ts` (`memoryRateLimiter`, `clientIp`), `sink.ts` + `sinks/` (`webhook`, `log`), `signature.ts` (`signFormBody`, `verifyFormSignature`). |
| `src/app/api/forms/[id]/route.ts` | The route: `POST` hands the request to the handler. |
| `src/config/form-delivery.ts` | `formSink()`: the destination, read from the environment per request. |
| `src/components/ui/form/Form.tsx` | The engine (client component): renders the items, a `case` per field type in `Field()`, prefills from the URL after hydration, reads the values (`readFormValues`), calls the backend, drives `idle → submitting → done \| fail`; for an endpoint form also the honeypot and the time on screen. |
| `src/components/ui/form/FormShell.tsx` | The form plus its success and error blocks and their show/hide behaviour; `{email}` in a message renders through `EmailLink`. |
| `src/components/ui/form/FieldRow.tsx`, `FieldWrap.tsx`, `Hint.tsx`, `Marker.tsx`, `field.ts` | Two-column row; `<label>` + hint + control column; the hint and the optional marker; the shared control classes. |
| `src/components/ui/form/TextField.tsx`, `NumberField.tsx`, `DateField.tsx`, `TextArea.tsx`, `Select.tsx`, `RadioGroup.tsx`, `CheckboxGroup.tsx`, `Checkbox.tsx`, `Choice.tsx` | The controls, one per type (`TextField` takes the four text-like types; a hidden field is a bare input in `Field()`). Radios and checkboxes are the browser's own, tinted to the one ink colour with `accent-ink`; the select's arrow is a drawn chevron. |
| `src/components/ui/form/FormNote.tsx`, `FieldGroup.tsx` | The items that are not fields: a line of text with its link, a fieldset with its legend. |
| `src/components/ui/form/SubmitButton.tsx` | A real `<button type="submit">` wearing `buttonClass("solid")`, disabled while the submission is in flight. |
| `src/components/contact/ContactForm.tsx` | Example consumer: the `contact-form` section, which renders `<Form>` with the definition its page file names. |

## Definition contract

```ts
type FormDefinition = {
  id: string;                                   // <form id>, prefixes field ids, names the endpoint's route
  name: string;                                 // human name; mailto uses it as the subject fallback
  items: FormItem[];                            // fields, rows, notes and groups, in order
  optionalMarker?: string;                      // after the label of every field that is not required: "(optional)"
  submit: { label: string; waitLabel: string }; // button text; waitLabel while submitting
  messages: { success: string; error: string; email?: string };  // `{email}` in a message stands for `email`
  backend: FormBackendConfig;                   // where submissions go
};

type FormItem =
  | FieldDefinition
  | { row: FieldDefinition[] }                                    // side by side; stacked on phones
  | { note: string; link?: { label; href } }                      // a line of text; submits nothing
  | { group: string; items: (FieldDefinition | FormRow | FormNote)[]; optionalMarker?: false };  // a fieldset; the legend is `group`

// On every field but hidden: name, label, required?, hint?; and where the control has them,
// defaultValue? (defaultChecked? on a checkbox), fromQuery? and autocomplete?.
type FieldDefinition =
  | { type: "text" | "email" | "tel" | "url"; placeholder?; minLength?; maxLength?; pattern?; inputMode?; autocomplete?; defaultValue?: string; fromQuery? }
  | { type: "number";     placeholder?; min?: number; max?: number; step?: number | "any"; autocomplete?; defaultValue?: number; fromQuery? }
  | { type: "date";       min?; max?; autocomplete?; defaultValue?; fromQuery? }            // YYYY-MM-DD
  | { type: "textarea";   placeholder?; rows?; minLength?; maxLength?; autocomplete?; defaultValue?; fromQuery? }
  | { type: "select";     options: { value; label }[]; placeholder?; autocomplete?; defaultValue?; fromQuery? }
  | { type: "radios";     options: { value; label }[]; defaultValue?; fromQuery? }
  | { type: "checkboxes"; options: { value; label }[]; defaultValue?: string[]; fromQuery? }
  | { type: "checkbox";   value: string; link?: { label; href }; defaultChecked?; fromQuery? }
  | { type: "hidden";     name; label; value: string };             // no required, hint or prefill

type FormBackendConfig =
  | { kind: "mailto"; to: string; subject?: string }
  | { kind: "endpoint"; url: string };          // the site's route: "/api/forms/<id>"
```

`name` is the key in the submitted values; a checkbox group always submits
a `string[]`, everything else a `string`. Field ids are
`${form.id}-${field.name}`.

**Every type, in one form** (the example site's own fields are
`forms.contact`):

```ts
{
  id: "quote",
  name: "Quote request",
  optionalMarker: "(optional)",
  items: [
    { note: "Only a quick question?", link: { label: "The FAQ may answer it.", href: "/#faq" } },
    { row: [
      { type: "text", name: "name", label: "Name", required: true, maxLength: 256, autocomplete: "name" },
      { type: "email", name: "email", label: "Email", required: true, autocomplete: "email", hint: "We reply to this address." },
    ] },
    { row: [
      { type: "text", name: "company", label: "Company", required: true, autocomplete: "organization" },
      { type: "url", name: "site", label: "Website", placeholder: "https://", autocomplete: "url" },
    ] },
    { type: "select", name: "topic", label: "Topic", placeholder: "Choose one", required: true, fromQuery: "topic",
      options: [{ value: "hosting", label: "Hosting a site" }, { value: "design", label: "A design of its own" }] },
    { type: "radios", name: "size", label: "Team size", required: true,
      options: [{ value: "1-10", label: "1–10" }, { value: "11+", label: "11 or more" }] },
    { row: [
      { type: "number", name: "seats", label: "Seats", min: 1, max: 500, defaultValue: 5 },
      { type: "date", name: "start", label: "Start date", min: "2026-10-01" },
    ] },
    { type: "textarea", name: "message", label: "Your message", required: true, rows: 5, minLength: 20, maxLength: 5000 },
    { type: "checkbox", name: "consent", label: "I have read the", link: { label: "privacy notice", href: "/privacy" }, value: "yes", required: true },
    { group: "Optional", optionalMarker: false, items: [
      { type: "text", name: "title", label: "Job title", autocomplete: "organization-title" },
      { type: "tel", name: "phone", label: "Phone", pattern: "[0-9 +\\(\\)\\-]{6,}", autocomplete: "tel" },
      { type: "checkboxes", name: "extras", label: "Also interested in", options: [{ value: "training", label: "Training" }] },
      { type: "checkbox", name: "news", label: "Send me the monthly newsletter", value: "yes" },
    ] },
    { type: "hidden", name: "campaign", label: "Campaign", value: "autumn" },
  ],
  submit: { label: "Send", waitLabel: "Sending..." },
  messages: { success: "Thank you.", error: "Something went wrong. Please email us directly at {email}.", email: contact.email },
  backend: { kind: "endpoint", url: "/api/forms/quote" },
}
```

**What each type does.**

- **Text-like** (`text`, `email`, `tel`, `url`) take `minLength`,
  `maxLength`, `pattern` (the whole value must match; the browser compiles
  it with the `v` flag, so a `-` or a `(` inside `[…]` is escaped) and
  `inputMode`, the keyboard a phone shows.
- **`number`** takes `min`, `max` and `step` (`"any"` for none). The step
  counts from `min`, else from `defaultValue`, else from 0 — the HTML step
  base — so `min: 1, step: 2` takes odd numbers only.
- **`date`** is the browser's date picker; `min`, `max` and the value are
  `YYYY-MM-DD` whatever the reader's locale shows.
- **`textarea`** takes `rows` (its height; without them it keeps the
  design's minimum) and `minLength`.
- **`select`** takes a `placeholder`, rendered as an empty first option, so
  `required` means a real choice. Without one the first option is chosen
  from the start and `required` asks nothing. An option's value is never
  empty. One choice only; a multiple choice is `checkboxes`.
- **`radios`** is a fieldset whose legend is the label; `required` asks for
  one of them.
- **`checkboxes`** submits the values ticked, possibly none: it is never
  required.
- **`checkbox`** is one box, for consent or an opt-in: it submits `value`
  when ticked and `""` when not, and `required` means ticked. Its label may
  end in a `link`, which opens in a new tab (what the visitor typed stays)
  and never ticks the box. Consent is not pre-ticked: leave
  `defaultChecked` off a consent box.
- **`hidden`** carries a fixed value (a campaign, an offer, a variant of
  the form). The server keeps the definition's value whatever the client
  sends; its `label` names it in the mailto body and the wire format.

**On every field.** `hint` is help text under the label, joined to the
control by `aria-describedby` (in a row, the neighbour's control drops to
stay level). `autocomplete` is the HTML autofill token (`name`, `email`,
`organization`, `organization-title`, `tel`, `url`, …; the type lists the
ones a form asks for, credentials and payment left out), where HTML applies
it: not on radios or checkboxes. `defaultValue` (`defaultChecked` on a
checkbox) is the control's first value; a select's or a radio group's is
one of its options.

**`fromQuery`** prefills a field from the page's URL: `fromQuery: "topic"`
and a link to `/sections/contact?topic=design` choose that option. The value is taken
only when the field would accept it — one of its options for a select, a
radio group or a checkbox group (`?extra=a&extra=b`), its own `value` for a
checkbox, a valid value within its limits for the rest — and anything else
is ignored. It is read in the browser after hydration
(`prefillFromQuery`), never with `useSearchParams`, so every page stays
prerendered.

**The optional marker.** Most fields of a lead form are required, so the
few that are not carry the mark: with `optionalMarker: "(optional)"`, every
field that is not `required` shows it after its label, muted, inside the
`<label>` or `<legend>`, so a screen reader reads it with the name. Set it
on a form that mixes required and optional fields. A group whose legend
already says so ("Optional") sets `optionalMarker: false`; unset, nothing is
shown.

**Notes and groups.** A note is a line of text inside the form with an
optional link at its end ("Only a quick question?" + a link to the FAQ); it
submits nothing. A group is a fieldset with a legend around fields, rows and
notes (not another group). Neither adds a line to the mailto body or the
wire format; the fields inside them do, in order.

**The e-mail address in a message.** `{email}` in `messages.success` or
`messages.error` renders `messages.email` as a link, for either backend. On
a site that keeps its address out of served files, `withEmailToken()` makes
it a token and `FormShell` renders it through `EmailLink` (below). Without
`messages.email` the slot shows as written.

**Out of scope, and why.** The set is what an ordinary contact or
landing-page form needs, all of it validated natively and delivered through
both backends. Left out on purpose:

- **File upload.** `mailto` cannot attach a file, wire format version 1
  carries strings only, and storing files (size limits, scanning,
  retention) is a provider's job: link to the provider's own upload page.
- **Conditional fields** (show X when Y) and **multi-step forms**. Both
  need state and rules beyond native validation, and a condition language in
  the definition; a form that branches is two forms, or a page of its own.
- **Multiple select.** Checkboxes say the same, visibly and without a
  modifier key.
- **password**, **range** and **color**. A password does not belong in a
  mail body or a webhook; a range shows no value without script; a colour
  is no contact form's question. `time`, `datetime-local`, `month`, `week`
  and `search` are not in the set either: a lead form asks for a day
  (`date`), and `datetime-local` carries no time zone.

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

**Validation** (`validateSubmission`) repeats the browser, field by field
(`acceptValue` in `rules.ts`, after the HTML standard), and names each field
that fails:

| Type | Accepted |
|---|---|
| every one | a string (a checkbox group: an array of strings); `required` means not empty |
| text-like, `textarea` | `minLength` (only once something is entered) and `maxLength`, a CRLF line break counting as one character; `pattern` against the whole value, compiled with the `v` flag (a pattern that does not compile constrains nothing, as in the browser) |
| `email` | the HTML standard's valid e-mail address |
| `url` | what the URL parser takes (`URL.canParse`), which is the browser's check |
| `number` | a valid floating-point number (`-1.5`, `2e3`; not `+1` or `1.`), within `min` and `max`, on the step from its base (a decimal step's float error forgiven up to step / 2²⁴, as Chromium does) |
| `date` | a real day as `YYYY-MM-DD` (leap years counted), within `min` and `max` |
| `select`, `radios` | one of the options; `""` (nothing chosen) unless required, and for a select only when it has a placeholder |
| `checkbox` | its `value`, or `""` unless required |
| `checkboxes` | only its options' values, repeats collapsed; never required |
| `hidden` | the definition's value, whatever was sent |

Keys the definition does not name are dropped.

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
from `page.url`. `fields` holds every field, out of rows and groups (a
hidden one too), with its label as the reader saw it (a checkbox's ends in
its link's text) and the raw value; notes add nothing. A change to this
shape is a new `version`.

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

**Add a field type.** Add the variant to `FieldDefinition` in `types.ts`,
teach `acceptValue` in `rules.ts` what the browser lets through from it
(the server and the prefill both read it), `readFormValues` in `values.ts`
its shape when it is not one string, and `mailtoBody` its line when the value
is not what a reader should see; create its primitive in
`src/components/ui/form/` on the `control` classes, add the `case` in
`Field()` in `Form.tsx`, write the tests and document it here and in
`src/components/README.md`. A type that needs anything but `string |
string[]` changes the wire format: that is a new `version`.

**Prefill a form from a link.** Give the field `fromQuery: "<param>"` and
link to the page with `?<param>=<value>`: a service card's "Ask about this"
links to `/sections/contact?topic=design`. Only a value the field accepts is
taken.

**Add a sink kind** the kit ships. Only a kind that names no provider
belongs in the kit (rule 6): add the variant to `FormSinkConfig`, a class in
`server/sinks/`, the `case` in `createFormSink()`, a test and a line here.
A provider's sink stays in the site.

**Add a backend.** Add the variant to `FormBackendConfig` in `types.ts`, a
class implementing `FormBackend` in `backends/` that never throws, and the
`case` in `createFormBackend()`.

**The address as a token.** A site that keeps its address out of served
files (`docs/email.md`) wraps the definition in the server component that
renders the form: `<Form definition={withEmailToken(forms.contact)} />`.
It encodes a `mailto` backend's recipient, which the backend resolves at
submit (`resolveRecipient`; a plain address passes through), and
`messages.email` for any backend, which `FormShell` renders where a message
says `{email}` (`messageParts` splits it, `EmailLink` draws it). The
address never crosses to the browser as text; `agentic-cms guard-email`
checks the build.

**Change copy or fields of the contact form.** Edit `forms.contact` only.

## Status

Both backends are wired. A `mailto` form's "success" means the mail client
was opened with a draft; an `endpoint` form's means the sink accepted it.
The example's contact form ships on `mailto`, and its route and
`form-delivery.ts` are ready for the switch.
