---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "public/images/**"
---

# Design — the look is the owner's; these are the invariants of how it lands

- Read `STANDARD.md` before writing markup or CSS, and §8 before "fixing" anything that looks odd: it may be a decision, with its reason and date.
- The `design` skill is the loop (tokens → chrome → sections → motion; per element candidates → the owner's pick → build → prove → record); `design-options` runs the round — ideas, the owner's pick of what to build, candidates as real components on a demo route (`pnpm kit demo new`) in the section's frame with the page's copy on the site's theme, the current version last, the pick by letter or in words, the winner built and the generic pieces moved to `ui/`; `design-measure` turns a screenshot claim into numbers before an edit; `design-proof` captures a baseline (`capture --ref`) and reads the compare; `design-icons` gives a site its icons as families (Lucide, Simple Icons, the site's marks from primitives); `design-graphics` draws the site's own graphics as SVG in the lab (`pnpm kit lab`) and ships them pre-rendered — a file under `public/images/` or inline `Icon` data — with the lab removed after. No design change merges without the owner's look on the dev server and a proof.
- Tokens only in `@theme static`; a colour becomes a token at its second use; radius, shadow, blur and easing are tokens, never magic numbers in a utility. Shared chrome once in `src/components/ui/`; a section's cards are its own.
- One instance means the class: a look chosen for one element is applied to every element of its kind in the same job.
- A demo route (`src/app/<name>-demo/`, written by `pnpm kit demo new`) and everything the round created that the winner does not use go before the branch merges (`pnpm kit demo clean`, after promoting the winner; `--dry-run` first); the build's SEO audit fails on the route, which is the guard. A round's pictures live under `public/images/<name>-demo/`. A candidate's graphic is the meaning of the copy beside it; what is generic leaves the section for `ui/` in the same job.
- A design change is its own commit and says so; a refactor moves no pixel and proves it.
