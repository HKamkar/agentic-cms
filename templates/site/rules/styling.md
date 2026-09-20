---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
---

# Styling — read `STANDARD.md` before writing markup or CSS; these are the invariants

- Utilities for layout, spacing, type, colour, visibility and hover/focus; a `<Name>.module.css` next to the component only for what utilities cannot say (layered or gradient backgrounds, keyframes, backdrop filters, a static transform on an animated element). Plain CSS, no `@apply`, breakpoints spelled out, joined to utilities with `cx()`.
- Tokens only in the `@theme static` block of `src/app/globals.css`; per-breakpoint values in `src/styles/base.css`. A colour becomes a token at its second use. The type scale is the site's (`text-h1`…`text-h6`, `text-body`), never `text-base` / `text-sm`. One colour utility per property per element.
- Preflight zeroes margins, paddings, borders and list markers: never `m-0`, `p-0`, `list-none`. Decorative elements are real `aria-hidden` elements, not pseudo-elements. Interactive things are real `<button>`s and links; never `outline-none` on anything a keyboard reaches.
- Animation targets are `data-ix` attributes through `ix(name)`, never a styling class; start states live in `src/styles/motion.css`; no `translate-*` / `rotate-*` / `scale-*` utility on an element the reveal library moves; every animated component checks `useReducedMotionPref()`; a sequence longer than two seconds declares `data-settle` on its section.
- Images stay `<img>` with `width`, `height` and `alt`; above the fold in a server component `EagerImage` (`agentic-cms/components`), everything else `loading="lazy"`; assets under `public/images/<page>/` or `public/images/ui/`.
- Any change that must not move a pixel proves it: `pnpm kit visual-parity capture before --ref develop`, `capture after`, `compare` clean (`--motion` when animation code, targets or transitions change; `--states` when hover / focus / checked / open change). A design change is its own commit and says so.
