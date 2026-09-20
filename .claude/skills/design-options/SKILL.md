---
name: design-options
description: Put design candidates in front of the owner so they pick by row - static ones (icons, marks, chips, palettes, type samples) on one rendered sheet with `pnpm kit sheet`, live ones (a footer, a menu, a card with hover or motion) on a throwaway demo route on the dev server - at the real size on the real background, the current version beside them. Use when the owner has to choose a look, when asked for options, variants, alternatives or "show me a few", or before building any element whose look is not yet decided.
argument-hint: <what to show candidates for> [how many]
---

# Design options

A design decision is the owner's; the job is to make it a pick, not a
conversation. Candidates are rendered, labelled and comparable — the owner
answers with a letter and a number ("B2", "the alternate", "A but with C's
mark") — and one round of candidates is followed by one build, not by a
second round.

## Read first

`STANDARD.md` §1 (the tokens the candidates must be drawn in) and §4 (the
icon families, if the candidates are marks); the component or the asset the
candidates replace, and where it renders (`grep -rn` the file name under
`src/`); `docs/shot-probe-sheet.md` § sheet.

## Which kind

- **Static** — a mark, an icon set, a chip, a palette swatch, a type
  sample: a **sheet**. One picture the owner reads in the chat.
- **Live** — anything with a state or a motion (a footer's reveal, a menu
  opening, a card's hover, a hero's choreography), or anything that must be
  judged in the page's own flow: a **demo route** the owner opens on the dev
  server, on a phone if that is where it matters.

## A sheet

1. Inventory the class first: every place the element appears (`pnpm kit
   probe / --select "<its selector>" --all`, and the other pages), so the
   candidates cover the whole family, not one instance.
2. Write the spec, `.parity/<name>.yaml`: the first row is `now` (what the
   site renders today, as `img:` from the build); each further row one
   direction with two to five cells; `size` the pixel size the section
   really renders the element at; `background` and `color` the section's
   real ones (a token, `var(--color-paper)`, or the hex). A candidate is an
   SVG file, inline SVG, markup with the site's utilities, or a served path.
3. `pnpm kit sheet .parity/<name>.yaml` and hand over
   `.parity/sheets/<name>.png` with one line per row saying what it is.
4. The pick names the row and cell. Build exactly that; do not blend rows
   unless the owner asked for the blend.

## A demo route

1. `src/app/<name>-demo/page.tsx`, a server component with `export const
   metadata = { robots: { index: false } }`, rendering each candidate as a
   labelled block — a mono chip with the letter and one line on what
   differs — in the section's real container, the current version **last**.
   Candidates are real components on the branch (a `FooterA.tsx`,
   `FooterB.tsx` beside the current `Footer.tsx`), so the winner is a rename
   away and the losers are a delete.
2. `pnpm dev` and hand over the URL of the route, at the widths that matter.
3. Iterate on the route, not in prose: a "more transparent" is a change on
   the route and a second look, in the same round.
4. After the pick: the winner replaces the component, the route and the
   losing files are deleted **before** the branch is pushed for a merge
   (`pnpm build` fails a route without an `seo` block, which is the guard).

## The rules of a good sheet

- Real size, real background, real colour: a mark at 64 px on white
  flatters a mark that lives at 24 px on midnight.
- The current version is always there, first on a sheet and last on a
  route: a pick is a comparison.
- Two to four rows. More is a survey, not a choice.
- Every candidate means what it sits beside: an icon for "one-line
  migration" says migration, not "something technical".
- A sheet pick is a direction, the dev-server look is the decision: build
  the pick, show it in place, ask, then merge.

## Stop for the user

The pick; the look at the built candidate on the dev server; the merge.
