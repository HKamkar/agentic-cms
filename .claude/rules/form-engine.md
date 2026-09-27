---
paths:
  - "src/lib/forms/**"
  - "src/components/ui/form/**"
  - "src/config/forms.ts"
  - "src/config/form-delivery.ts"
  - "src/app/api/forms/**"
---

# Form engine — read `src/lib/forms/README.md` before editing

- Forms are data in `src/config/forms.ts` (`satisfies Record<string, FormDefinition>`); the compiler validates them. A new form is a new entry, not a new component.
- Field components own their styling (Tailwind utilities and the shared `control` classes in `field.ts`) and never call the network; the browser delivers through `createFormBackend()`, the route through its sink.
- New field type = variant in `types.ts` + what the browser accepts in `rules.ts` (the server and the prefill share it) + its shape in `readFormValues` and its line in `mailtoBody` when they differ + component in `ui/form/` + `case` in `Form.tsx` `Field()` + tests + docs. Values stay `string | string[]` (wire format version 1); a type that needs more is a new version. New backend = `kind` in `FormBackendConfig` + class in `backends/` (never throws) + `case` in the factory + docs. New sink kind = `kind` in `FormSinkConfig` + class in `server/sinks/` + `case` in `createFormSink()` + docs — only a kind that names no provider.
- Validation stays native in the browser (the controls' own attributes), no validation library; the server repeats it after the HTML standard, never stricter. Prefill from the URL (`fromQuery`) happens in the browser after hydration, never with `useSearchParams`.
- Every message and note is config; `{email}` in a message is `messages.email`, a token through `withEmailToken` and `EmailLink`, never text in a served file on a site that guards its address.
- Pages stay prerendered: `src/app/api/forms/[id]/route.ts` is the one route that runs at request time. `agentic-cms/forms/server` uses Web APIs only (Node and Workers) and imports nothing from the client barrel.
- The destination and its secrets come from the environment, read per request in `src/config/form-delivery.ts`; `forms.ts` (it reaches the browser, and `createKit` loads it in plain Node) never imports it.
- The kit names no provider: a provider's API is a `FormSink` in the site.
