---
paths:
  - "src/components/ui/form/**"
  - "src/config/forms.ts"
---

# Forms — read `node_modules/agentic-cms/src/lib/forms/README.md` before editing

- Forms are data: a `FormDefinition` in `src/config/forms.ts` (`satisfies Record<string, FormDefinition>`) says which fields exist and where a submission goes; the field components own their styling and never call the network.
- A new field type or backend is a kit change plus a local `case`; native validation first; a backend runs in the browser, and an API route is an architectural decision to write down in `PLAN.md`.
- The recipient of a `mailto` form is never plain text in a served file when the site guards its address (the kit's `withEmailToken` and `EmailLink`; `agentic-cms guard-email` in the build).
