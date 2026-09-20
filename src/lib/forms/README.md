# Form engine

Forms are data. A `FormDefinition` in `src/config/forms.ts` describes the
fields, the copy and the delivery backend; `<Form definition={forms.x} />`
renders it with the field primitives and submits it through a swappable
backend. Adding a landing-page form means adding a definition, not writing
components. This document is the complete contract.

## Rules that must not break

1. **Definitions are config, checked by the compiler.** `forms.ts` uses
   `satisfies Record<string, FormDefinition>`; a wrong field type or a missing
   key fails `tsc`/`pnpm build`. Never bypass the types with casts.
2. **The primitives own their styling.** `src/components/ui/form/` renders
   semantic controls (real `<label>`s, a `role="group"` for checkboxes) with
   Tailwind utilities; the shared control classes are `control` in `field.ts`
   and the submit wears `buttonClass()` from `ui/Button`. Restyle there, never
   through config.
3. **Validation is native**: `required` and `type="email"` on
   the controls. Do not add a client-side validation library.
4. **Backends are the only place that talks to the outside world.** Field
   components and the engine never call `fetch`; delivery goes through
   `createFormBackend(definition.backend).submit(...)`.
5. **The site is static.** A backend runs in the browser (POST to a form
   service, `mailto:`); a first-party API route would make the Worker dynamic
   and is a deliberate architectural decision, not a quick fix.

## Files

| File | Role |
|---|---|
| `src/config/forms.ts` | Every form on the site (`forms.contact`, …). |
| `src/lib/forms/types.ts` | `FormDefinition`, `FieldDefinition` (`text` / `email` / `tel` / `textarea` / `checkboxes`), `FormRow`, `FormBackendConfig`, `FormValues`; helpers `isRow`, `fieldsOf`, `fieldId`. |
| `src/lib/forms/backend.ts` | `FormBackend` interface (`submit(form, values) → SubmitResult`) and the factory `createFormBackend(config)`. |
| `src/lib/forms/backends/mailto.ts` | `MailtoBackend`: opens the visitor's mail client with the submission as the body. Zero infrastructure; the site itself sends nothing. |
| `src/components/ui/form/Form.tsx` | The engine (client component): renders items, reads values, calls the backend, drives `idle → submitting → done \| fail`. |
| `src/components/ui/form/FormShell.tsx` | The form plus its success and error blocks and their show/hide behaviour. |
| `src/components/ui/form/FieldRow.tsx`, `FieldWrap.tsx`, `field.ts` | Two-column row; `<label>` + control column; the shared control classes. |
| `src/components/ui/form/TextField.tsx`, `TextArea.tsx`, `CheckboxGroup.tsx` | The controls. The checkbox is the browser's own, tinted to the one ink colour with `accent-ink`. |
| `src/components/ui/form/SubmitButton.tsx` | A real `<button type="submit">` wearing `buttonClass("solid")`, disabled while the submission is in flight. |
| `src/components/contact/ContactForm.tsx` | Example consumer: the `contact-form` section, which renders `<Form>` with the definition its page file names. |

## Definition contract

```ts
type FormDefinition = {
  id: string;                                   // <form id>, prefixes field ids
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

type FormBackendConfig = { kind: "mailto"; to: string; subject?: string };
```

`name` is the key in the submitted values; checkbox groups always submit a
`string[]`, everything else a `string`. Field ids are `${form.id}-${field.name}`.

## Recipes

**Add a form to a page.** Add an entry to `forms.ts`. A page file then names
it: a `contact-form` section's `form` field is a key of `forms.ts` (the
schema rejects any other value). A section of its own renders
`<Form definition={forms.myForm} />` inside whatever markup it needs (see
`ContactForm.tsx`). Nothing else.

**Add a field type** (e.g. `select`). Add the variant to `FieldDefinition` in
`types.ts`, create `src/components/ui/form/Select.tsx` on the `control`
classes, add the `case` in `Field()` in `Form.tsx`, document it here and in
`src/components/README.md`.

**Add a backend** (e.g. a form service). Add the variant to
`FormBackendConfig` in `types.ts` (`{ kind: "endpoint"; url: string }`), create
`src/lib/forms/backends/endpoint.ts` implementing `FormBackend` (POST JSON or
form-encoded, return `{ ok: false, error }` on non-2xx), add the `case` in
`createFormBackend()`, then switch forms by editing their `backend` in
`forms.ts`. Secrets never go in config; use a public endpoint id or a Worker
route.

**Change copy or fields of the contact form.** Edit `forms.contact` only.

## Recipes

- **The recipient as a token.** A site that keeps its address out of served
  files (`docs/email.md`) wraps the definition in the server component that
  renders the form: `<Form definition={withEmailToken(forms.contact)} />`.
  The mailto backend resolves the token at submit (`resolveRecipient`); a
  plain address passes through; other backends are untouched.

## Status

`mailto` is the only backend wired. Its "success" means the mail client was
opened with a draft, so the contact form's success message is optimistic
until a real service is configured.
