---
name: design
description: Design a site built on agentic-cms, from the wireframe to a look of its own or from one look to the next - tokens first, then the chrome, then the sections - one element at a time through candidates the owner picks from, a build on the dev server the owner looks at, and a pixel proof before anything merges. Use when asked to design, restyle, theme, brand, redesign or "make it look like" anything on the site, or to start designing a site from scratch.
argument-hint: [what to design: the whole site, a section, the chrome, the tokens]
---

# Design

The repo is the current directory: a site on `agentic-cms`, its design in
`STANDARD.md` (the tokens, the type, the markup rules, the section anatomy,
the motion, the register of decisions that look like bugs) and in
`src/components/`; the engine, the content and the SEO are not the design
and do not change here. The owner decides what it looks like; this skill's
job is to make each decision cheap to take and impossible to lose.

## Read first

`STANDARD.md` in full (what exists, and §8, the decisions that must not be
"fixed"); `src/components/README.md` (the catalogue: one implementation per
shared element, cards per section); `src/app/globals.css` (the `@theme
static` block, the only place a token lives) and `src/styles/base.css`;
`AGENTS.md` § Styling; `docs/design.md` of the kit
(`node_modules/agentic-cms/docs/design.md` on a site that installs it).
Then look, not guess: `pnpm build` and `pnpm kit shot / --width 1440`,
`--width 390`, one shot per page the job touches (`.parity/shots/`).

## The order

Design lands in this order, each step its own branch, its own look on the
dev server and its own commit; never all at once.

1. **Tokens.** Colours (each a `light-dark()` pair so both themes follow),
   the fonts (self-hosted or system; the build fetches nothing), the type
   scale, the spacing rhythm, and — re-enabled as tokens, not utilities —
   radius, shadow, blur, easing. A colour becomes a token at its second use.
   The wireframe's four colours are the seed; a design has more, named for
   what they are for (`paper`, `ink`, `accent`), never for their hue.
2. **The chrome.** The navbar, the footer, the buttons, the title block:
   shared once in `src/components/ui/`, never pasted into a page. Every
   state (hover, focus, current page, open menu) is part of it.
3. **The sections**, one at a time, in the order a visitor meets them. Each
   section's cards are its own; a card is not a generic component.
4. **Motion**, last, with the reveal library (`agentic-cms/ix`): start
   states in `src/styles/motion.css`, `data-ix` targets, every animated
   component honouring `useReducedMotionPref()`; a sequence longer than two
   seconds declares `data-settle` on its section.

## The loop, per element

1. **Candidates.** Two to four, never one: the `design-options` skill —
   static candidates (marks, chips, palettes) on a sheet (`pnpm kit sheet`),
   live ones (a footer, a menu, a hover) on a throwaway demo route the owner
   opens on the dev server. Rendered at the real size, on the real
   background, the current version last for comparison.
2. **The pick.** The owner names a row ("B", "the alternate", "A with B's
   icons"). A pick from a sheet is a direction; the owner's look at the
   built thing on the dev server is the decision. One preview round, one
   build; a question in the chat beats another round of candidates.
3. **Build it** on the branch: tokens in `globals.css`, utilities in the
   component, a `<Name>.module.css` only for what utilities cannot say,
   decorative elements as real `aria-hidden` elements, icons as SVG. One
   instance means the class: a look the owner chose for one card is applied
   to every card of its kind in the same job (`pnpm kit probe` and `grep`
   find them all first).
4. **Prove it**: the `design-proof` skill. A change that must not move a
   pixel elsewhere shows it (`visual-parity` clean outside the changed
   section, the `SIZE` verdict `shift` where a section grew); a design
   change is its own commit and says so in the message.
5. **Record it.** Anything that looks like a bug on purpose (an element at
   `opacity: 0` until JavaScript runs, the outer cards hidden at a width, a
   glow only above 1440 px) goes into `STANDARD.md` §8 with the reason and
   the date; a new token, family or rule goes into the section it belongs
   to; a new shared component into `src/components/README.md`.

## Rules that survive every look

- Utilities for layout, spacing, type, colour, visibility, hover and focus;
  tokens only in `@theme static`; one colour utility per property per
  element; never `text-base` / `text-sm` — the type scale is the site's.
- Images stay `<img>` with `width`, `height` and `alt`; above the fold in a
  server component `EagerImage`; below it `loading="lazy"`.
- Nothing hides until JavaScript runs unless a reveal owns it, and then the
  HTML a crawler receives is complete.
- A demo route never merges (it has no `seo` block; the build fails on it,
  on purpose). The design's throwaway files go with the branch.
- Public URLs never change for a look.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build    # 0 failures
pnpm kit visual-parity capture before --ref develop && pnpm kit visual-parity capture after && pnpm kit visual-parity compare before after --json
pnpm dev                                                      # the owner's look; stop it afterwards
```

## Stop for the user

Every pick (step 2); the dev-server look before a merge; any change to a
public URL, to the content or to the SEO fields — those are not design.
