---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
---

# Styling — read `STANDARD.md` before writing markup or CSS; these are the invariants

- Utilities for layout, spacing, type, colour, visibility and hover/focus; a `<Name>.module.css` next to the component only for what utilities cannot say (layered or gradient backgrounds, keyframes, backdrop filters, a static transform on an animated element). Plain CSS, no `@apply`, breakpoints spelled out, joined to utilities with `cx()`.
- Tokens only in the `@theme static` block of `src/app/globals.css`; per-breakpoint values in `src/styles/base.css`. A component asks for a colour, a radius or a shadow by its role where the site has one (a site from `init` starts with `panel`, `line`, `on-ink`, `rounded-panel`, `rounded-control`, `shadow-panel`, `shadow-glow`) and names a value only where no role does; a new role is a token first, and a colour becomes a token at its second use. The type scale is the site's (`text-h1`…`text-h6`, `text-body`), never `text-base` / `text-sm`. One colour utility per property per element.
- The site is designed, looked at and measured at its widths — the profile's, `widths` in `src/config/harness.ts`; for a new site four: 390, 768, 1440 and 1920. Nothing that moves widens the page at any of them.
- Preflight zeroes margins, paddings, borders and list markers: never `m-0`, `p-0`, `list-none`. Decorative elements are real `aria-hidden` elements, not pseudo-elements. Interactive things are real `<button>`s and links; never `outline-none` on anything a keyboard reaches.
- Motion is `agentic-cms/ix`, in two layers (`STANDARD.md` §7 says which to choose); their start states and keyframes live in `src/styles/motion.css`, and no `translate-*` / `rotate-*` / `scale-*` utility sits on an element either layer moves.
- The play-once layer (`Reveal`, `RevealGroup`, `Sequence`, `part()`): a root plays once, when it first enters the viewport, never on a hover or a second scroll; loops run only on screen; nothing is hidden unless `motionScript()` armed the page; the first screen's copy uses `intro`; curves and durations are the `--ease-*` / `--motion-*` tokens; a section's motion is its parts, never a transition or animation class; a sequence longer than two seconds says `settle`.
- The reveals that replay on re-entry (`Fx`, `OnView`): animation targets are `data-ix` attributes through `ix(name)`, never a styling class; every animated component checks `useReducedMotionPref()`; a sequence longer than two seconds declares `data-settle` on its section.
- Images stay `<img>` with `width`, `height` and `alt`; above the fold in a server component `EagerImage` (`agentic-cms/components`), everything else `loading="lazy"`; assets under `public/images/<page>/` or `public/images/ui/`.
- Any change that must not move a pixel proves it, once built: `pnpm kit visual-parity proof` — the baseline of develop, the tree and the compare, at the profile's widths and in each scheme it names — clean (`--motion` when animation code, targets or transitions change; `--states` when hover / focus / checked / open change). A design change is its own commit and says so.
