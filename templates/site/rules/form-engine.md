---
paths:
  - "src/components/ui/form/**"
  - "src/config/forms.ts"
  - "src/config/form-delivery.ts"
  - "src/app/api/forms/**"
---

# Forms — read `node_modules/agentic-cms/src/lib/forms/README.md` before editing

- Forms are data: a `FormDefinition` in `src/config/forms.ts` (`satisfies Record<string, FormDefinition>`) says which fields exist and where a submission goes; the field components own their styling and never call the network.
- The field types, notes, groups, the optional marker and `fromQuery` are in the kit's contract; a type is used only once the site's `src/components/ui/form/` has its primitive and its `case` in `Field()` (the kit's `docs/upgrading.md` lists them per release). A new field type or backend is a kit change plus a local `case`; native validation first, and the values are read with the kit's `readFormValues`. An `endpoint` form posts to `src/app/api/forms/[id]/route.ts`, the one route that runs at request time; any other request-time code is an architectural decision to write down in `PLAN.md`.
- Where endpoint forms deliver is `src/config/form-delivery.ts`, from the environment, read per request; `forms.ts` never imports it, and no secret or destination goes in `forms.ts`. A provider's API is a `FormSink` of the site's (`docs/forms.md` in the kit); the privacy notice names the provider.
- The recipient of a `mailto` form, and the address `{email}` stands for in a form's messages (`messages.email`), are never plain text in a served file when the site guards its address (the kit's `withEmailToken`, `FormShell` rendering `{email}` through `EmailLink`; `agentic-cms guard-email` in the build).
