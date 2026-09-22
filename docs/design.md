# Designing on agentic-cms

The kit ships a wireframe, not a look: four colours, one border, grey
placeholders, no motion. A site's design is what a site brings — and the
kit's job is to make bringing it cheap for the agent that does the work:
one command per recurring job, numbers before pictures, and the process
written down as skills that are there from the first session with nothing
to install.

## What works by default

A checkout of this repo, or a site laid out by `agentic-cms init`, carries:

- **The skills**, in `.claude/skills/` (Claude Code) and `.agents/skills/`
  (Codex), identical, auto-discovered from the checkout — no plugin, no
  install: `design` (the loop), `design-options` (candidates the owner picks
  from), `design-measure` (a screenshot claim turned into numbers),
  `design-icons` (icons as families), `design-graphics` (the site's own
  drawings, SVG in the lab, shipped pre-rendered), `design-proof` (the pixel
  proof before a merge). [skills.md](skills.md) says what each does.
- **The commands** every skill calls: `demo` (the round's route), `shot`, `probe`, `sheet`
  ([shot-probe-sheet.md](shot-probe-sheet.md)) and `visual-parity` with
  `--ref`, `--json` and a compare that says what moved
  ([visual-parity.md](visual-parity.md)).
- **The rules**, path-scoped (`.claude/rules/`), and `AGENTS.md`, which
  every agent reads; `STANDARD.md`, where the design lives and where §8
  keeps the decisions that look like bugs on purpose.

## The loop

Design lands tokens first, then the chrome, then the sections, then motion
— each on its own branch, with its own look on the dev server and its own
commit. Per element:

1. **Candidates**, two to four, rendered at the real size on the real
   background with the current version after them: a sheet (`pnpm kit
   sheet`) for static things, a throwaway demo route on the dev server for
   anything with a state or a motion — the round below.
2. **The pick** is the owner's, by row ("B2", "the alternate") or by letter.
   A pick from a sheet is a direction; the owner's look at the built thing
   on the dev server is the decision. One preview round, one build.
3. **Build it**: tokens in `@theme static`, utilities in the component, a
   module only for what utilities cannot say; one instance means the class,
   so the look goes to every element of its kind in the same job.
4. **Prove it**: a baseline of the commit it started from (`capture --ref
   develop`), a capture after, a compare read as a report — clean outside
   the change, `shift` where a section grew.
5. **Record it**: the oddities into §8 with their reason and date, the new
   token or family into the section it belongs to, the new shared component
   into the catalogue.

## The round

How a section gets its design, as it runs in practice (the
`design-options` skill is the procedure; `pnpm kit demo` the command):

1. **The ask.** The owner asks for a design or says what looks wrong:
   "this section looks empty", "redesign the closing band".
2. **Ideas.** The agent brainstorms three to five in one message, each one
   line — what it shows, what moves and why the motion is the meaning, what
   it reuses from the library. *Stop:* the owner picks which to build ("A
   and B", "all of them").
3. **The pick of what to build.**
4. **The candidates, real.** `pnpm kit demo new <name> --section <type>`
   writes `src/app/<name>-demo/page.tsx` (`robots: { index: false }`) and a
   candidate per letter — a copy of the section's component beside it,
   `<Name>A.tsx`, `<Name>B.tsx`, edited into its idea. The route reads the
   page's copy from its file on every render and shows each candidate in
   the section's real frame **inside the site's own layout** — its tokens,
   its chrome, its theme toggle, so a design is judged against the theme
   it will live in — lettered with one line on what differs, and the
   current version last. The agent hands over the dev-server URL.
5. **The look.** The owner looks on desktop and phone and picks by letter,
   or edits the pick in words: "merge B and C", "no icons", "change the
   radio colour too", "better wording for that row". Every "more" is an
   edit on the route inside the round — a change to the candidate's file
   and a second look — not a new round and not prose. *Stop:* the pick.
6. **Build it**, on the owner's word ("build it", "make it the section's
   card"): the winner becomes the real component; its copy moves into the
   page file's schema (nothing left in code or SVG text); every generic
   piece — a control, a table, a card, a meter — leaves the section for
   `src/components/ui/` and the catalogue; `pnpm kit demo clean <name>`
   removes the route, the losing candidates and next dev's stale route
   types; the docs and the verify block follow; the branch is shown on the
   dev server once more. *Stop:* the look before the merge.

The rules that make a round work: a candidate's graphic is the meaning of
the copy beside it (a meter fills because the copy is about a threshold —
never a relabelled cycling bar); two to four candidates, the current
version last, every one with the page's real copy; a "more" is an edit
inside the round; what is generic leaves the section for the library in
the same job; the route and the losers never merge — the build's SEO audit
fails a route without a `seo` block, which is the guard.

A worked example, from a site's week of rounds. The owner: "the two-offers
card looks like a slide". Ideas: A a switch that hops the platform block
between the two hostings, B a toggle that swaps the rows, C the comparison
table from the deck, a row per difference. "Build all three." `pnpm kit
demo new offers --section home-choose-us`; three candidates in the section's
frame with the home page's copy, the current card last. The owner, on the
phone: "B and C merged — a radio picks the offer and the table shows that
one; no marks; the offer's colour on the thumb". Two edits on the route,
one more look. "Make it the section's card." The card became the
component; its rows moved into `home.yaml` and the section's schema; the
radio and the table left as `ui/RadioPill` and `ui/FactTable` with their
props in the catalogue; `demo clean offers`; the verify block; the proof;
the merge. The next round, on the closing band, went the same way and left
`ui/GlassCard` and `ui/Meter` behind — the library grows from picks, not
from plans.

## Measure, don't guess

A screenshot is a symptom. "Unaligned", "too big", "appears too early",
"looks broken" are each a measurement (`pnpm kit probe`: the box, the
computed styles, the stacking chain, the pending reveals, a timeline) and a
crop (`pnpm kit shot`); the fix follows the numbers, and the second
measurement is the proof the claim is gone before the harness proves
nothing else moved.

## What stays out of the kit

No design: the kit carries behaviour (the reveal library, the components
that carry no look — `EagerImage`, `JsonLd`, `FaqAccordion`), never a
styled element. No site's name, palette or copy. The wireframe under
`src/` is an example a site replaces, not a theme it extends.
