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
  `design-proof` (the pixel proof before a merge). [skills.md](skills.md)
  says what each does.
- **The commands** every skill calls: `shot`, `probe`, `sheet`
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
   background with the current version beside them: a sheet (`pnpm kit
   sheet`) for static things, a throwaway demo route on the dev server for
   anything with a state or a motion.
2. **The pick** is the owner's, by row ("B2", "the alternate"). A pick from
   a sheet is a direction; the owner's look at the built thing on the dev
   server is the decision. One preview round, one build.
3. **Build it**: tokens in `@theme static`, utilities in the component, a
   module only for what utilities cannot say; one instance means the class,
   so the look goes to every element of its kind in the same job.
4. **Prove it**: a baseline of the commit it started from (`capture --ref
   develop`), a capture after, a compare read as a report — clean outside
   the change, `shift` where a section grew.
5. **Record it**: the oddities into §8 with their reason and date, the new
   token or family into the section it belongs to, the new shared component
   into the catalogue.

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
