---
paths:
  - "src/app/**"
  - "src/components/**"
  - "content/pages/**"
---

# Pages — a page is a content file, never a hand-written route

- Every page is `content/pages/<slug>.yaml` (its `seo` block, its `jsonld`, its sections in order), rendered by the catch-all route, `src/app/[[...slug]]/page.tsx`, through the section registry, `src/components/sections/render.tsx`; its URL is its `seo.path`. Never write a `page.tsx` for a page: the sitemap, the SEO audit and the content lint read the page files.
- A new page is `/editorial:new-page`, or `content/_templates/page.yaml` by hand: a file, no route. A new section type is three things in one commit: its schema in `src/components/sections/schemas.ts` (copy only, every field described), its component in a section folder, its entry in `render.tsx`.
- Copy (headings, body, labels, alt text, the SEO fields) is content, never code. A section takes it as props from its page's file, a pattern from its section; presentation (sizes, ratios, class strings) stays in the component, keyed by position. The chrome is configured in `src/config/site.ts`, a form in `src/config/forms.ts`; nothing else in `src/config/` holds copy.
- A route outside the content engine (the post template, the form endpoint, the feed, a design round's `*-demo`, the lab's `lab-demo`) is an exception with a reason. Where the site runs the guard, `src/config/components.json` names each under `exceptions` with that reason (a `*-demo` folder is one by its name), and `pnpm lint` fails a route folder named nowhere, an exception with no reason, and copy written in a section or a pattern (a symbol, an `aria-hidden` decoration and the labels of `Placeholder` and `TypeTag` pass). Adding an exception loosens the guard: its own pull request, said so in its title.
- A site whose pages are hand-written moves them one page per commit, each proven identical: `node_modules/agentic-cms/docs/migrating-to-0.8.0.md` § 3.9.
