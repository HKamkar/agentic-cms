---
paths:
  - "content/**"
  - "src/kit.ts"
  - "src/kit.test.ts"
  - "src/components/sections/schemas.ts"
  - "src/components/sections/render.tsx"
---

# Content engine — read `node_modules/agentic-cms/src/lib/content/README.md` before editing

- The engine is the pinned package, composed once in `src/kit.ts` (`createKit({ site, sections })`); the app and the command line read `kit.collections`, `kit.content`, `kit.blog`, `kit.seo`. Never patch `node_modules`: an engine change is a kit pull request, then a bumped tag here.
- Build time only: never import `@/kit` or `agentic-cms/content` from a `"use client"` module; pass entries down as props and import only types there. Nothing reads `content/` at request time.
- The seven standard collections (posts, authors, categories, reviews, faqs, use cases, pages) are the kit's; a collection of the site's own is a `defineCollection(…)` returned from `createKit`'s `collections` option. A schema is `z.strictObject` of the kit's helpers (`text`, `optional`, `dateOnly`, `isoTimestamp`, `ref`), `.describe()` last on every field; never `z.enum` for another collection's keys — `ref("name")`.
- Every problem is a `ContentError` naming file, path and problem; never warn, never default. Derivations live with the consumer, not in the schema.
- One YAML dialect (1.2): quote dates, write `true` / `false`. Files starting with `_` are ignored; the file name / map key / list index is the slug. Every collection has an annotated template in `content/_templates/` and a row in `content/README.md`.
- The field tables in `content/README.md` are generated from the schemas by `pnpm content:docs`; `pnpm build` checks them — after a schema change, run the command and commit the README with it.
- `src/kit.ts` and everything it imports (`src/config/site.ts`, `src/config/forms.ts`, `src/components/sections/schemas.ts`) run under plain Node through `agentic-cms/loader`: `import type` for types, no `enum`, no parameter properties, no `.tsx` or React in that import graph.
- A page is `content/pages/<slug>.yaml` (`seo`, `jsonld`, `sections`); its section types are the schemas in `schemas.ts` (copy only, every field described, card counts fixed where the design depends on them) and their components are registered in `render.tsx`. Presentation (sizes, delays, class strings) stays in the component, keyed by position.
- Voice and claim rules are `content/VOICE.md`: the prose and the fenced block say the same thing, and the block is what `agentic-cms lint` (first in `pnpm build`) enforces. A FAIL stops the build; a WARN is read and fixed or explained.
- Verify = `pnpm lint` + `pnpm test` + `pnpm content:lint` + `pnpm build` (`pnpm content:check` is the schema-only loop).
