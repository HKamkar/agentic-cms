---
paths:
  - "content/**"
  - "src/lib/content/**"
  - "scripts/content-*.mjs"
  - "scripts/lib/load-ts.mjs"
  - "scripts/lib/content-lint.mjs"
  - "plugin/**"
---

# Content engine — read `src/lib/content/README.md` before editing

- Build time only: `node:fs` in `read.ts`, every consumer prerendered. Never import `@/kit` or `content-engine-kit/content` from a `"use client"` module; pass entries down as props and import only types there.
- The seven standard collections are `createCollections({ sections })` in `src/lib/content/collections.ts`, their accessors `createContent()` in `index.ts`; a site composes both once with `createKit({ site, sections })` in `src/kit.ts` and reads `kit.collections` / `kit.content` — the engine never imports the site. A site's own collection is `defineCollection({ name, kind: "folder" | "list" | "map", dir | file, format?, schema })` returned from `createKit`'s `collections` option. A schema is `z.strictObject` of the helpers in `schema.ts` (`text`, `optional`, `dateOnly`, `isoTimestamp`, `ref`), `.describe()` last on every field and on the object; a bare zod schema carries its own `error` wording. Never `z.enum` for another collection's keys — `ref("name")`.
- Every problem is a `ContentError` naming file, path and problem (`content/blog/x.md: author "nobody" is not in content/authors.json (acme-editorial)`); never warn, never default. Derivations (fallbacks, computed fields) live with the consumer, not in the schema.
- One YAML dialect (1.2, via gray-matter's `yaml` engine and `yaml` itself): quote dates, write `true` / `false`. Files starting with `_` are ignored; the file name / map key / list index is the slug. Every collection has an annotated template in `content/_templates/` (posts: `content/blog/_template.md`) and a row in `content/README.md`.
- The field tables in the site's `content/README.md` are generated from the schemas' `.describe()` texts by `content-engine-kit docs` (`pnpm content:docs`); `pnpm build` runs `--check`, so after changing a schema run the command and commit the README with it.
- The module runs under plain Node (`pnpm test`, `pnpm content:check`, `scripts/lib/load-ts.mjs`): `import type` for types, no `enum`, no parameter properties, no namespaces, no `.tsx` or React anywhere in its import graph.
- A page is `content/pages/<slug>.yaml` (`seo`, `jsonld`, `sections`); its section types are `src/components/sections/schemas.ts` (zod only — never import React or a `.tsx` there) and their components are registered in `src/components/sections/render.tsx`. A section's schema holds copy only: every field described, card counts fixed where the design depends on them; presentation numbers (sizes, ratios, class strings) stay in the component, keyed by position. A section that shows a collection gets it from the registry's `withData()`, never by reading files in a client component.
- Voice and claim rules are `content/VOICE.md`: the prose and the fenced block between the `voice-rules` markers say the same thing, and the block is what `content-engine-kit lint` (`scripts/lib/content-lint.mjs`, first in `pnpm build`) enforces, with the SEO limits at the source, the post body's structure, the images on disk and the dates. The exact rules FAIL, the heuristics (voice-claim, voice-cloud) and the soft ranges WARN, and the content reports 0 of each as of 2026-09-16; a new rule that today's files break ships as WARN until the copy is fixed; every rule has a negative case in `scripts/content-lint.test.mjs`; a finding reads `LEVEL file rule: path problem`. The content jobs are the skills of the `editorial` plugin (`plugin/skills/`, agents in `plugin/agents/`): short, pointing at the docs, ending with the verify block and the points that stop for the user, and brand-neutral by rule (every brand fact is read from the repo or the workshop `content/editorial/workshop.yaml` names; a grep for the brand's name over `plugin/` stays empty).
- Verify = `pnpm lint` + `pnpm test` + `pnpm content:lint` + `pnpm build` (`pnpm content:check` is the schema-only loop); a rendering change is also proven with `content-engine-kit parity` / `content-engine-kit visual-parity`.
