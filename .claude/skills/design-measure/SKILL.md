---
name: design-measure
description: Turn a screenshot claim ("unaligned", "too big", "appears too early", "looks broken", "cut off") into numbers before editing anything - the element's box, computed styles, stacking contexts, reveal state and timeline from `pnpm kit probe`, a crop from `pnpm kit shot` - so the fix follows the measurement. Use whenever the owner sends a screenshot or describes what a page looks like, and before touching any layout, spacing, size, z-index or timing.
argument-hint: <the claim> [page] [what the element is]
---

# Design measure

A screenshot is a symptom. The diagnosis is a measurement, and the fix is
whatever the measurement says; eyeballing a picture and guessing a utility
costs a round trip per guess. `docs/shot-probe-sheet.md` has the commands.

## Read first

The page's section component and its module (`src/components/<page>/`), and
`STANDARD.md` §8 first — the thing that "looks broken" may be a decision.

## Steps

1. **Name the element** from the claim: the section by its heading
   (`--heading "<words from the screenshot>"`), the element by a selector
   (`--select`), and the width the owner was looking at (a phone screenshot
   is 390 or 393 wide; a desktop one 1440 or 1920).
2. **Measure it**:

   ```bash
   pnpm kit probe /<page> --heading "<heading>" --width 390            # box, computed styles, stacking, pending reveals
   pnpm kit probe /<page> --select "<selector>" --all --width 390       # every instance of the class
   pnpm kit probe /<page> --select "<selector>" --motion --timeline 3000 --every 200   # when it appears, and how far it travels
   pnpm kit shot /<page> --heading "<heading>" --width 390 --scale 2     # the crop, for the owner and for you
   ```

   Against the dev server while iterating: `--url http://localhost:8000`
   (use the hostname the dev server allows; a page that does not hydrate
   measures un-hydrated markup).
3. **Read the numbers against the claim**:
   - "Unaligned" / "a gap": the boxes of the element and its neighbour, in
     `pageBox`; the difference is the fix, in the spacing scale.
   - "Too big" / "too small": `box.width` against the design's number and
     against the viewport; a `%`, `vw` or `max-` rule is usually the cause.
   - "Appears too early" / "never appears": `reveals.pending` after the
     page is prepared (under reduced motion the list must be empty — an
     element still there has a start pose it never leaves), and the
     `--timeline` under `--motion` (when opacity leaves 0, when transform
     reaches `none`).
   - "Cut off" / "behind": `computed.overflow` on the ancestors, and the
     `stacking` chain — the nearest context with a `z-index` decides who
     is on top.
   - "Looks broken" on a small mark: `renderedWidth` against the drawing's
     stroke; thin strokes below ~40 px do not survive; solid shapes do.
   - The same claim on one instance is a claim on the class: `--all`, and
     the other pages the element lives on, before fixing any.
4. **Fix from the numbers**, then measure again the same way; the second
   measurement is the proof the claim is gone, before the `design-proof`
   capture proves nothing else moved.
5. Say what was measured and what it showed, in numbers, before saying what
   changed.

## Stop for the user

A claim the numbers contradict (the element is where the design says; the
owner may want the design changed); a fix that would touch `STANDARD.md` §8.
