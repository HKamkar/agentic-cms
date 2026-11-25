---
name: design-story
description: Design a motion story - one page told as a continuous, scroll-driven live scene (a story home page, a product told in chapters, a cinematic landing page) while every other page stays regular - without dropping frames. Covers whether the page should have one, the study of work at that level, the storyboard, scenes built in rounds that are photographed and looked at, the frame budget measured in every round, the governor, the still version for reduced motion and weak devices, and the owner's look on real devices. Use when asked for a story, an animated or cinematic home page, scrollytelling, a 3D scene, WebGL, "like that site", or when such a page drops frames.
argument-hint: <the story or the page> [a reference] [what drops frames]
---

# Design story

A motion story is the one thing the kit lets a page draw live, and only on
a page that asks for it. Everything else about the site stays as it is:
content in files, words in the HTML, other pages pre-rendered and loading
nothing of it. The guide, with the number behind every rule, is
`docs/motion-story.md` (`node_modules/agentic-cms/docs/motion-story.md` on
a site that installs the kit); the code to start from is
[references/steady-frames.md](references/steady-frames.md). The kit ships
no story engine: the site owns the scene, and `agentic-cms story` holds it
to the rules a machine can judge (the guide's § The check).

## Read first

`docs/motion-story.md` in full, its budget above all; `STANDARD.md` §1 (the
tokens the scene takes its colours from), §7 (motion) and §8; the page's
file in `content/pages/` (the words exist before the scene); the site's
`src/config/components.json` (what it already allows). For a page that
drops frames: step 5 first, before any change.

## Steps

1. **Ask whether the page should have one.** A story costs the reader
   graphics time and the site a piece of software to keep. It earns that
   when the page has one thing to say that is better watched than read. A
   section that should enter nicely is `agentic-cms/ix`; a loop or a mark is
   `design-graphics`. When the owner wants a story, agree four things
   before drawing: the one idea, the page it lives on, the reference they
   mean, and the devices it must be smooth on.
2. **Study the reference in its own terms.** Read what it ships and watch
   it frame by frame: what is drawn (lines, particles, surfaces, glass), how
   bright, what the light does, where the camera goes, what each stretch of
   scroll makes happen, how one chapter becomes the next, how the words
   arrive. Write it as a list of techniques with their numbers. Techniques
   carry over; its artwork, words, names and code never do. Skipping this
   step is how a first version comes out flat.
3. **The language and the storyboard, in one message.** First one sentence
   for how everything is drawn: the marks (hairlines, fibres, points), the
   hues a chapter, the one accent, how dim, and what is never drawn. Abstract
   and minimal is the default; a texture, a material or a photograph's
   realism is a decision of the owner's. Then a table: chapter, the event the
   scroll carries through it, what the one living object does, the camera's
   keys, the words (from the page's file), the hand-over to the next. Four
   to seven chapters; two to four screens each; a headline after each scene.
   The owner edits it in words before anything is drawn.
4. **Build in rounds, and look.** On a throwaway route (`pnpm kit demo
   new`) with the engine in one folder, the marks and the hook the check
   draws with (the guide's § The check: `data-story`, `window.__story`).
   Start from the structure in the reference file: worker
   geometry, fixed targets, shared frame values, a warm-up, the governor.
   After every change photograph the same positions, every chapter and
   every transition, in Chromium and in WebKit (`pnpm kit story <page> --only
   blank,engines --out .parity/story` writes the two sheets), and at 390 too
   (`pnpm kit shot`), and look: too bright, too glowy, too flat, out of the
   language, words on a bright patch, a label over a label, a card out of the window,
   an empty frame, a hand-over that cuts, two engines that differ (the
   guide's § Safari). A scene the owner approves is **frozen**: its random
   numbers get a stream of their own, its frames are kept, and every later
   round proves them identical. Expect eight rounds, not two. Every brightness,
   speed and camera key is a value in one table, so a round is an edit, not
   a rewrite.
5. **Measure in every round**, not at the end. Where the frame goes, pass by
   pass; what the words cost with the drawing off; script a frame on a
   slowed processor; the first frame of each chapter against its third; the
   setup's long tasks; the first picture, with only the first scene made
   before it; the path of every card while it can be read. The budget is
   the guide's table, and `pnpm kit story <page>` holds what a machine can
   judge of it. A round that breaks it is not done: take the cost out of what nobody sees (full-screen
   passes, samples, pixels) before taking out detail.
6. **The governor and the ways down.** The picture's size follows the frame
   time; a fast screen gets an even half rate before a poor picture; then
   fewer details; then the still version. Prove each step: run it on a
   software renderer and watch it go down to the stills; run it on simulated
   devices, a limit of 30 a second among them (Safari's low power mode).
7. **The still version is part of the design.** One picture a chapter in a
   normal document, the same words, for reduced motion, no graphics card, no
   WebGL; all the words without JavaScript. It is what the screenshot
   harness photographs, so `design-proof` covers it.
8. **On the page.** A section type whose copy is in the page file; the words
   rendered on the server; the engine imported on demand after they are on
   screen, its CSS rendered by the section, so no other page downloads
   either (check the other pages' scripts before and after). Name the
   exceptions in `src/config/components.json`, `allow` for
   `agentic-cms/graphics` and `agentic-cms/motion` on the engine's files,
   with the reason.
9. **The owner's look, on their devices.** Hand over the URL with the frame
   readout behind its button, and ask for the numbers from a laptop, a
   phone, Safari and Firefox while scrolling through every chapter. A
   machine without a graphics card gives proportions, never a frame rate,
   and the report says so.
10. **Close.** The route and the losers go (`pnpm kit demo clean`), the
    budget and the decisions are recorded in `STANDARD.md` §7, and the
    change merges as its own design change.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build
pnpm kit story <the page> --out .parity/story   # every rule, both engines; look at the sheets
pnpm kit visual-parity proof     # the stills, and that no other page moved
```

A broken rule is fixed in the story, never by leaving it out with `--only`
or `--engines chromium`. The site's CI runs the same command on every pull
request. <!-- required -->

The budget's table filled in with measured numbers, what was measured on
which machine, and what was not checked.

End the procedure with `pnpm lint`, 0 failures, after the last edit: it
holds the engines in every file (copy, head, forms, tags, e-mail) and the
library's placement, and a failure is fixed at its source, never by
loosening a rule. <!-- required -->

## Stop for the user

Whether to build one (step 1); the storyboard (step 3); the look after the
first full round, and any round the owner asks to see (step 4); the numbers
from their devices (step 9); the merge.
