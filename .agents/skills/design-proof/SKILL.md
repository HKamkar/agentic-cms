---
name: design-proof
description: Prove a change on the site's pixels with the screenshot harness - a baseline of the commit it starts from, a capture after, a compare read as a report - so a refactor shows it moved nothing and a design change shows it moved only what it meant to. Use before any merge that touches src/, styles or images, when asked to prove, verify, check parity or "make sure nothing else changed", and after a `SIZE`, `CHANGED` or `reflow` line needs reading.
argument-hint: [pages or sections the change touches]
---

# Design proof

The harness is `agentic-cms visual-parity` (`docs/visual-parity.md` of the
kit — the modes, the file names, the waits, the traps — and
`docs/commands.md` for the flags). A proof is two captures and one compare;
the compare's report says what moved, where, and whether the rest of the
page survived.

## Read first

`docs/visual-parity.md` § Reading a compare; the change's diff (`git diff
develop --stat`) to know which pages and sections it can touch; whether
anything animates (`grep -rl "agentic-cms/ix" src/components`), which
decides whether `--motion` is part of the proof.

## Steps

1. **The baseline**, from the exact commit the change starts from, never
   from a checkout that moved on:

   ```bash
   pnpm kit visual-parity capture before --ref develop            # or the branch's base commit; its demo routes are left out
   ```

   (A served build standing in for a commit — `--url` — has its `git log
   -1` printed first.) With reveals in use, also `--motion`; with hover,
   focus, checked or open states touched, also `--states`; with a dark
   theme, `--scheme dark`. A long run goes in the background; the capture is
   finished when `.parity/visual/<label>/capture.json` exists.
2. **The change**, built exactly as it will be committed (`pnpm build`;
   nothing edited after it), then:

   ```bash
   pnpm kit visual-parity capture after
   pnpm kit visual-parity compare before after --json
   ```

   `--pages /a,/b` on both while iterating on one page; the full set once
   before the merge. A page whose build files did not change is copied from
   `.parity/shots` rather than taken again, so the second capture of a proof
   takes the changed pages alone; a site with many pages of one template
   (posts) can pass `--sample <n>` to both captures to photograph n of them.
3. **Read the report** (`report.json`, or the lines):
   - `ok` everywhere: a refactor proved. Say so with the counts.
   - `CHANGED` on the pages the change touches, `rows` inside the changed
     section: expected; look at the diff image once to confirm the rows are
     the section's.
   - `SIZE … shift`: the section grew or shrank and everything below moved
     intact — the crops (`<name>.before.png`, `.after.png`) show the band;
     expected for a design change that changes a height.
   - `SIZE … reflow`, or `CHANGED` rows on every text line below one
     section: first read the `cause:` line under it — a section whose
     height changed by a fraction of a pixel moves everything below by that
     fraction and repaints it; fix or accept that height. Without a cause,
     something changed how the compositor paints the whole page —
     usually a new stacking context (`position: relative`, a `z-index`, a
     `transform`) on a section whose animated elements overflow it.
     `pnpm kit probe / --select "<the section>"` prints the stacking chain;
     keep the utility to the breakpoint that needs it.
   - `CHANGED` on a mid-flight motion frame (`--s03-500`, 20–30 %): timing
     jitter is possible; re-run the after capture once with `--fresh` (else
     an unchanged page is copied from `.parity/shots`, the same frame
     again), and identical on the re-run is accepted. A settled or static frame never jitters (an inline
     SMIL loop is held at its `data-rest` there, and at each frame's own
     time mid-flight; a loop that still differs lacks `data-rest` or ships
     as an `<img>`, which no capture can hold).
   - A settled motion frame that keeps differing where a sequence runs long:
     the section declares `data-settle="<ms>"` (`STANDARD.md` §7).
   - `MISSING`: a page appeared or disappeared, or the compare lacks the
     `--pages` the capture had (with it, only the named pages are judged,
     on both sides).
4. **Say what the proof says**, in numbers: how many files, which
   differed, the verdicts, and why each difference is the change. A design
   change is its own commit and says so.

## Traps

- Build the exact tree you mean to prove before capturing. The capture
  photographs a copy of that build; after its `snapshot:` line the tree is
  free to build and edit.
- Commit each proven state before the next change.
- `.parity/` is gitignored and grows fast; delete old labels.
- A baseline built for the wrong sha proves nothing: the sha is in
  `meta.json` and on the compare's first line.

## Stop for the user

A `reflow` or a difference outside the change's pages that the report does
not explain; the merge.
