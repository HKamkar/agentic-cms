---
name: design-options
description: Run a design round the way it works - the owner says what they want or what looks wrong, the agent brainstorms three to five ideas in one message, the owner picks which to build, the agent builds them as real components on a throwaway demo route (`pnpm kit demo new`) in the section's real frame with the page's real copy on the site's own theme, the current version last, the owner looks on the dev server and picks by letter or edits the pick in words, and on the owner's word the winner becomes the section, generic pieces leave for `src/components/ui/`, the route and the losers go (`pnpm kit demo clean`). Use when the owner asks for a design, says a section "looks empty", "looks like a template", asks for options, variants, alternatives, "show me a few", or before building any element whose look is not yet decided; static candidates (a mark, a palette, a type sample) go on a sheet (`pnpm kit sheet`) inside the same round.
argument-hint: <what to design, or what looks wrong> [the section or element]
---

# Design options — the round

A design decision is the owner's; the round makes it a pick, not a
conversation. Six steps, three stops, and the candidates are always real:
components on the branch, in the section's real frame, with the page's real
copy, on the site's own theme (the demo route renders inside the site's
layout: its tokens and its chrome, in each scheme the profile names), the
current version after them. The command is `pnpm kit demo`; the guide is `docs/design.md`
§ The round (`node_modules/agentic-cms/docs/design.md` on a site that
installs the kit).

## Read first

`STANDARD.md` §1 (the tokens a candidate draws in), §6 (the section's
anatomy) and §8; `src/components/README.md` (what the library already has
— a candidate reuses before it invents); the section's component (from
the registry, `src/components/sections/render.tsx`) and its page file
(`content/pages/<slug>.yaml`, the copy every candidate must carry); the
site's motion rules (`AGENTS.md` § Styling) when an idea moves.

## Steps

1. **The ask.** The owner asks for a design or says what looks wrong
   ("this section looks empty", "redesign the closing band"). Read the
   section and its copy before answering; the copy is what the candidates
   are for. Copy that is still the starter's placeholder, or the kit
   example's brand, is no copy to design around (`pnpm content:lint` lists
   both; `demo new` names them before it writes the round): **stop** and
   get the real copy first, from the owner or `/editorial:new-page` (the
   `design` skill § The copy first).
2. **Ideas, three to five, one message.** Each one line: what it shows,
   what moves and why the motion is the meaning (or that nothing moves),
   what it reuses from the library. No building yet. **Stop for the
   owner** — they pick which to build ("A and B", "all of them"). An ask
   that already said to build every idea skips this stop: no second
   selection question.
3. **The pick of what to build.** Only the picked ideas become candidates;
   "all" is every idea, none trimmed.
4. **Build the candidates.** `pnpm kit demo new <name> --section <type>`
   for a section, `--component <file>` for a piece of the chrome (a
   footer, a navbar, a button — its copy is the site's config, so its
   candidates take no props); both together for a section whose component
   is not in the registry. It writes `src/app/<name>-demo/page.tsx` and one
   candidate per letter — a copy of that component beside it
   (`<Name>A.tsx`, `<Name>B.tsx`) to edit into its idea — and the route
   shows each candidate inside the site's own layout, lettered with the one
   line from step 2 (fill the `note` in), the current version last; a
   section's candidates carry the page's copy, read from its file on every
   render. Copy a candidate
   needs that the page does not yet have goes into the page file and its
   schema now, never into code or SVG text. A static candidate (a mark, a
   palette, a type sample) goes on a sheet (`pnpm kit sheet`,
   `docs/shot-probe-sheet.md`) in the same round. A candidate that moves
   gets the lab's timeline on the route, so the owner can pause, step and
   replay it: `--timeline` wraps every block (each candidate and the
   current version) in `<LabTimeline label><div data-lab-drive>`, and
   `<LabStudy file>` shows an animated file — the timeline drives inline
   SVGs and anything marked `data-lab-drive`, never the reveals around
   them, and motion that plays once when seen plays at once under it
   (`docs/lab.md` § Inspecting motion). A review page that is not one
   section's candidates (the library's primitives, a motion layer's parts)
   is `demo new <name> --showcase --component <file>…`, which `demo clean`
   removes like a round. Start the dev server where it can be stopped
   (`pnpm kit serve`: next dev and the lab, every URL in one table); with
   it running, `demo new` waits until the route answers and prints its
   URLs. Hand over the URLs it printed: the LAN or public one for a
   phone, with its hostname in `ALLOWED_DEV_ORIGINS` (a warning names one
   that is missing; `pnpm kit serve --write-origins` adds it;
   `docs/dev-server.md`), a public one only where the firewall opens the
   port to the viewer's IP only, the candidates measured at the site's
   widths and their interactions run in WebKit too, and what the machine
   cannot show named for the owner's Safari (`docs/browsers.md`; the
   checklist is `docs/design.md` § Handing over and merging). Your own
   look at it is
   `pnpm kit shot /<name>-demo --url <dev server>`, seeded like a capture, so a banner the site shows until a
   visitor's choice is stored stays closed over the candidates (the owner
   closes it once in their own browser). A dev server that fails every
   page with `Can't resolve '@vercel/turbopack-next/internal/…'` after a
   `pnpm build` is reading the build's caches: `pnpm kit serve --fix-cache`
   restarts it with them cleared (`docs/design.md` § When the dev server
   will not serve).
5. **The look and the pick.** The owner looks on desktop and phone and
   picks by letter, or edits the pick in words ("merge B and C", "no
   icons", "change the radio colour too", "better wording for that row").
   Every "more" is an edit on the route inside the round — a change to the
   candidate's file and a second look — never a new round of candidates and
   never prose. Alternatives the owner asks for beside a candidate they
   liked join the same route under the next letters: every candidate
   already shown keeps its file and its letter, and an approved one is not
   touched (an experiment on it is a copy under a new letter). **Stop for
   the owner** — the pick.
6. **Build it, on the owner's word** ("build it", "make it the section's
   card"). The winner becomes the real component (its file replaces the
   section's, or its markup moves in); its copy lives in the page file's
   schema, nothing left in code or SVG text; every generic piece — a
   control, a table, a card, a meter — leaves the section for
   `src/components/ui/` and the catalogue in the same job; `pnpm kit demo
   clean <name>` removes the route, the losing candidates and next dev's
   stale route types; the docs follow (`STANDARD.md` §5/§7 when a piece or a
   motion is new, the catalogue, `content/README.md` when the schema grew);
   the verify block runs; `design-proof` proves the pages; and the branch
   is shown on the dev server once more. **Stop for the owner** — the look
   before the merge.

## The rules of a good round

- A candidate's graphic is the meaning of the copy beside it: what moves
  is what the sentence says (a meter fills because the copy is about a
  threshold), never a relabelled cycling bar or a decoration a different
  sentence would fit as well.
- Two to four candidates on the route, the current version last; more is
  a survey, not a choice — unless the owner asked for every idea. Every
  candidate carries the page's real copy.
- A round starts from the page's content file and never writes copy into
  a candidate: the candidates take the page's copy from its file (`demo
  new --section` reads it on every render), and copy the page lacks goes
  into the page file and its schema first; `agentic-cms/copy` fails copy
  in code, a round's route and its candidates included. <!-- required -->
- A "more" is an edit inside the round, and alternatives the owner asks
  for are added to the same route, the candidates already shown left as
  they are. The round ends with a pick, not with a set nobody asked for.
- What is generic leaves the section for the library in the same job, and
  goes into the catalogue with its props; the section composes it. Cards
  stay the section's own.
- Rejected and unapproved candidates are deleted, never archived, moved
  aside or kept "for later": `demo clean` takes them with the route, and
  no commit carries one.
- The route and the losers never merge: the build's SEO audit fails a route
  without a `seo` block, which is the guard; `demo clean` is the last step
  before the verify block. It removes what the round created that nothing
  else imports — candidates, their stages and card faces, the round's
  pictures under `public/images/<name>-demo/` — so promote the winner (and
  move its approved artwork out of that folder) first; `demo clean <name>
  --dry-run` lists what would go and what stays, and why.

## Verify

End the procedure with `pnpm lint`, 0 failures, after the last edit: it
holds the engines in every file (copy, head, forms, tags, e-mail) and the
library's placement, and a failure is fixed at its source, never by
loosening a rule. <!-- required -->

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # no *-demo route left: the SEO audit would fail it
pnpm kit demo clean && git status --short                   # nothing of the round but the winner and the library pieces
pnpm kit visual-parity capture before --ref develop && pnpm build && pnpm kit visual-parity capture after && pnpm kit visual-parity compare before after --json
```

## Stop for the user

After the ideas (step 2: which to build, unless the ask already said all
of them); after the look (step 5: the
pick, or the edit in words); after the build (step 6: the look on the dev
server before the merge). Never merge on a sheet pick alone.
