---
paths:
  - "src/lib/forms/**"
  - "src/components/ui/form/**"
  - "src/config/forms.ts"
---

# Form engine — read `src/lib/forms/README.md` before editing

- Forms are data in `src/config/forms.ts` (`satisfies Record<string, FormDefinition>`); the compiler validates them. A new form is a new entry, not a new component.
- Field components own their styling (Tailwind utilities and the shared `control` classes in `field.ts`) and never call the network; delivery goes through `createFormBackend()`.
- New field type = variant in `types.ts` + component in `ui/form/` + `case` in `Form.tsx` `Field()` + docs. New backend = `kind` in `FormBackendConfig` + class in `backends/` + `case` in the factory + docs.
- Validation stays native (`required`, `type="email"`); no validation library.
- The site is static: backends run in the browser. A first-party API route is an architectural decision to raise, not to slip in.
