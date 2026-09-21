---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "public/images/**"
---

# Design — the look is the owner's; these are the invariants of how it lands

- Read `STANDARD.md` before writing markup or CSS, and §8 before "fixing" anything that looks odd: it may be a decision, with its reason and date.
- The `design` skill is the loop (tokens → chrome → sections → motion; per element candidates → the owner's pick → build → prove → record); `design-options` puts candidates in front of the owner (a sheet for static ones, a demo route for live ones); `design-measure` turns a screenshot claim into numbers before an edit; `design-proof` captures a baseline (`capture --ref`) and reads the compare; `design-icons` gives a site its icons as families (Lucide, Simple Icons, the site's marks from primitives); `design-graphics` draws the site's own graphics as SVG in the lab (`pnpm kit lab`) and ships them pre-rendered — a file under `public/images/` or inline `Icon` data — with the lab removed after. No design change merges without the owner's look on the dev server and a proof.
- Tokens only in `@theme static`; a colour becomes a token at its second use; radius, shadow, blur and easing are tokens, never magic numbers in a utility. Shared chrome once in `src/components/ui/`; a section's cards are its own.
- One instance means the class: a look chosen for one element is applied to every element of its kind in the same job.
- A demo route (`src/app/<name>-demo/`) and every losing candidate go before the branch merges; the build's SEO audit fails on the route, which is the guard.
- A design change is its own commit and says so; a refactor moves no pixel and proves it.
