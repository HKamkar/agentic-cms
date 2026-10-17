# Roadmap — 0.8.2: one map of the kit, and no way around it

> Plan, not started: it begins after the `v0.8.1` tag, and 0.9.0
> (`docs/roadmap-0.9.0.md`) follows it. Written 2026-10-17 from a survey of
> `develop` c9ac3ed. The decisions marked *(decide in the PR)* take the
> recommendation unless the review says otherwise.

The kit has these parts:

- **One content engine.** Pages, the post pipeline and SEO sit on it, and
  forms sit beside it.
- **Libraries that ship to the browser:** motion, components, consent,
  e-mail and `cx`.
- **Design tools:** the lab, design rounds, the screenshot harness, icons
  and images.
- **The site's own commands:** setup, serving and the build's gates.

A site's agent can still write its own version of almost any of these, and
nothing fails. Today's checks reach sections and patterns; everything else
is an instruction. When nothing stops it, an agent takes the shorter road,
and the result is a site the kit can't upgrade or prove.

0.8.2 does two things:

1. **Organizes.** Every part is named once, in one of four layers, on one
   page, `docs/parts.md`: the need, the part, how to use it, and the check
   that holds it. The README, the docs index, the commands, both `AGENTS.md`
   and the rules all follow that page.
2. **Enforces.** On a site from `init`, a hand-written version of a part
   fails `pnpm lint`, and so `pnpm build` and CI, with a message naming the
   part to use. A site that really needs its own has a named exception with
   a reason, which shows in review and never grows silently.

**The target.** On a site from `init`, every bypass in the table below fails
`pnpm lint` and names the part to use. An existing site adopts the checks
with a baseline that only shrinks.

## The four layers

| Layer | Ships | Parts |
|---|---|---|
| The content engine | the pages | `agentic-cms/content`, the collections. On it: pages (`content/pages/`, the section registry), the post pipeline (`agentic-cms/blog`) and SEO (`agentic-cms/seo`: head, structured data, the audit). Beside it: forms (`agentic-cms/forms`, `/forms/server`) |
| Browser libraries | to the reader | `agentic-cms/ix` (motion: replay and play-once), `/components`, `/consent`, `/email`, `/cx` |
| Design tools | never | the lab (`lab`, `agentic-cms/lab`), design rounds (`demo`), the screenshot harness (`visual-parity`, `parity`, `shot`, `probe`, `sheet`), icons (`icons`), images (`placeholder`, the optimisers) |
| The site's commands | the build and the setup | `init`, `setup`, `urls`, `serve`; the build's gates (`lint`, `check`, `docs`, `seo`, `check-components`, `guard-email`, `critical-css`, `assemble`); `/loader`, `/eslint` |

Three names change:
- "Four engines" becomes **one content engine** with its layers.
- `src/lib/blog/README.md`'s "Blog engine" becomes **the post pipeline**.
- The commands' group "build gates" splits into the gates the build runs by
  default and the steps a site turns on.

## What gets around the kit today

From a survey of every part, as `init` sets a site up:

| Part | Held today by | A bypass that fails nothing |
|---|---|---|
| Pages | the routes check; the copy rule in sections and patterns | copy in `ui/`, layouts or `not-found`; copy through any prop but the named six; a hand route with any exception reason |
| SEO | the audit of the rendered page | a hand-written `metadata` export or JSON-LD block with the right fields |
| Forms | no form elements in sections | a `ui/` component with its own `<form>` and a `fetch` to a third party |
| Consent and analytics | instructions | a raw `next/script` analytics tag in the layout |
| E-mail | `guard-email`, which a site must turn on | a literal `mailto:`, anywhere |
| Images | `<img>` banned in sections; the audit's size and alt | `next/image`; an eager `<img>` in a server component outside `EagerImage` |
| Motion | `motion` and `framer-motion` banned; motion classes banned in sections | `gsap` and the like; a site's own observer or `requestAnimationFrame` hooks; transitions in `ui/` and `src/app` |
| Styling | the theme's resets; arbitrary values banned in sections | `bg-[#…]` or `style={{ color }}` in `ui/` and `src/app`; raw hex in a CSS module |
| Graphics | a skill's instruction | three, d3, pixi or lottie in a component; a `<canvas>` |
| Icons | `<svg>` banned in sections | a pasted `<svg>` in `ui/`, a pattern or the layout; emoji |
| Design rounds | `*-demo` exempt by name; `noindex` fails the build | a hand-made `*-demo` route; a round's leftover pictures |
| Screenshots, dev server, setup | instructions | a site's own Playwright or dev script; a machine address in `next.config` |
| The gates themselves | `pnpm lint` and CI only | `next build` runs no ESLint; `init` keeps a site's own `lint` and `build` scripts, gates dropped; `/* eslint-disable */`; `exceptions` and `inherited` grow freely; the site's `src/lib/**` is ignored |
| Agent files | the manifest's hashes | `modified` passes, so a site can delete a rule's key line and stay green |

## Decisions

| # | Question *(decide in the PR)* | Options | Recommendation |
|---|---|---|---|
| D1 | Where the lint rules reach | (a) sections and patterns, as today; (b) every file under `src/`, where an element or import is allowed only in the component that owns it, named in `components.json` (`owners`: `<img>` in `Media` and `EagerImage`, `<form>` in the form components, `<svg>` in `Icon`, `next/script` in the consent adapter) | **(b).** One place is allowed to do a thing, and every other file is refused. |
| D2 | Inline disables | (a) allowed, as today; (b) `noInlineConfig` in the preset, so exceptions live only in `components.json`; (c) allowed with a required description | **(b).** A disable comment is the cheapest bypass an agent has. |
| D3 | Exceptions | (a) free, as today; (b) each needs a reason, every added one is printed by the guard, and `inherited` and the baseline only shrink, checked against the merge base | **(b).** |
| D4 | The gates in `pnpm build` | (a) the build stays content lint, `next build` and the audit, as today; (b) the build runs `pnpm lint` first | **(b).** Agents run the build more often than the lint, and it costs seconds. |
| D5 | `guard-email` | (a) a site turns it on, as today; (b) on in the build whenever `site.ts` has an address | **(b).** |
| D6 | Where the site-wide checks live | (a) `check-components` grows to check the whole site; (b) a new command, `check-site`, runs the components pass and the new ones, and `check-components` stays as its components pass | **(b).** The old name no longer says what it checks, and nothing breaks. |
| D7 | Edited agent files | (a) `modified` passes, as today; (b) lines the kit marks required must stay, and the check fails when one is gone | **(b).** |

## The jobs

Each job updates every doc its change reaches, in the same pull request.
Job 7 is the last pass over all of them.

| # | Job | What it changes |
|---|---|---|
| 0 | This plan into the repo | `docs/roadmap-0.8.2.md` |
| 1 | The map | `docs/parts.md`; the four layers; the names |
| 2 | Lint every bypass in code | `agentic-cms/eslint` across `src/` |
| 3 | The guard checks the whole site | `check-site`: `scripts/`, the config, `package.json`, design rounds, exceptions |
| 4 | Gates on by default | `init`: the build runs the lint, `guard-email` on, scripts merged and never dropped |
| 5 | Agents told the way | the template `AGENTS.md`, the rules, the skills, the agent-file check |
| 6 | Existing sites adopt | the baseline; `docs/migrating-to-0.8.2.md` |
| 7 | The docs sweep | the README and every doc, on the map |
| R | Release 0.8.2 | after the gate on two sites |
| S | The sites follow | each in its own session |

### 0 — This plan into the repo

This file, reviewed in its own pull request, with the decisions recorded as
**Decided:**.

### 1 — The map

- **`docs/parts.md`.** One row per need, grouped by the four layers:
  - the need: a page, a post, a head tag, structured data, a form, an
    analytics tag, an e-mail address on a page, an image above the fold, a
    placeholder, motion, an icon, a graphic, a design candidate, a
    screenshot or a proof, a dev server and its URLs, the setup of a clone;
  - the part that meets it, and how to use it: the import or the command,
    and its doc;
  - the check that holds it: the lint rule, the guard's pass, or the build
    step;
  - the exception key, for a site that really needs its own.
- **The partial maps point to it.** `docs/primitives.md`'s "Provided by the
  kit", `docs/gotchas.md`'s "Where the kit already covers a trap" and
  `docs/design.md`'s "What works by default" link to it instead of
  repeating it.
- **A test keeps it complete.** Every export, every command in `SPECS`, and
  every rule the preset and the guard define must appear on it.
- **The names:**
  - one content engine, everywhere;
  - "the post pipeline" in `src/lib/blog/README.md` and every mention;
  - the specs' `group` values follow the layers, and `docs/commands.md`
    follows through `pnpm docs:commands`.
- **0.9.0's job 6** (the public surface) adds its stable/experimental column
  to this page instead of writing a page of its own.

### 2 — Lint every bypass in code

The rules reach every file under `src/` (D1). An element or an import is
allowed only in the component that owns it, and each message names the part
to use and its doc.

- **Copy.** In sections and patterns, any string a reader sees counts as
  copy: a JSX child, or an attribute other than class names, ids, routes and
  the like, not only the six named props. In `ui/`, layouts and `not-found`,
  copy comes from props or `site.ts`'s chrome.
- **The head.** No `<head>`, `<title>`, `<meta>`, canonical `<link>` or
  `application/ld+json` script outside the kit's own. A route's metadata
  comes from `kit.seo`.
- **Forms.** `<form>` only in the form components. No server action and no
  absolute-URL `fetch` in a component.
- **Tags.** `next/script` and a third-party `<script src>` only in the
  consent adapter that owns them.
- **E-mail.** No `mailto:` literal; `EmailLink` instead.
- **Images.** No `next/image`. `<img>` only in `Media` and `EagerImage`.
- **Motion:**
  - no animation library but `agentic-cms/ix` (gsap, react-spring, animejs,
    lottie-web, popmotion, and the list the preset keeps);
  - no `el.animate()`, `requestAnimationFrame` or observer-driven animation
    outside the motion layer;
  - no `transition-*`, `duration-*` or `animate-*` utility and no inline
    `transition` or `animation` style anywhere, as the styling rule already
    says.
- **Styling.** No arbitrary value (`bg-[#…]`, `rounded-[…]`, `shadow-[…]`)
  and no `style={{ color }}` anywhere under `src/`.
- **Graphics.** No three, d3, pixi, p5 or other rendering library: graphics
  ship pre-rendered (`docs/lab.md`). `<canvas>` only in an owner.
- **Icons.** `<svg>` only in `Icon` and its owners. Emoji in copy becomes a
  content-lint FAIL.
- **The preset's own blocks:**
  - `noInlineConfig` (D2);
  - the guard reads the resolved config of one sample file per layer, and
    fails when a later block has replaced one of the kit's rules. This is
    the flat-config trap 0.8.1 fixed for `no-restricted-imports`, closed
    for every rule.
- **The site's `src/lib/**`** is linted. Today the kit's own `ignores`
  reaches sites.

Each rule gets tests for what passes and what fails. The example passes,
and pack-smoke's fresh site passes.

### 3 — The guard checks the whole site

`check-site` (D6) runs `check-components`' passes and adds these:

- **`scripts/`.** A site script that imports Playwright or Puppeteer, runs
  sharp over `public/`, starts `next dev` or writes the dev origins is
  refused, naming the command to use (`visual-parity`, `shot`,
  `placeholder`, the optimisers, `serve`, `urls --write`), unless it is an
  exception.
- **`package.json`.** `lint` and `build` must hold the kit's gates. A
  missing gate fails; today `init` keeps a site's own scripts silently.
- **The config.** No machine address in `next.config.*`: the dev origins
  come from `ALLOWED_DEV_ORIGINS`. This is the site's form of hygiene's
  address rule.
- **CI.** The site's `verify.yml` runs the lint, the tests, the build and
  the agent-file check.
- **Design rounds.** A `*-demo` route that `demo new` did not write (it has
  no `demo.json`) fails, and so do a round's pictures under
  `public/images/<name>-demo/` once the round is cleaned.
- **Exceptions (D3).** Each has a reason, and every added one is printed.
  `inherited` and the baseline only shrink against the merge base.

It follows the command contract: a spec, tests, its doc, `pnpm
docs:commands`.

### 4 — Gates on by default

- **What `pnpm build` runs** in a site from `init`: `pnpm lint` first (D4),
  then the content lint, the docs check, `next build`, the SEO audit, and
  `guard-email` (D5).
- **An existing `package.json`.** `init` merges its gates into the site's
  `lint` and `build`, or refuses and names what to add. It never drops them
  silently.
- **What `init` writes:** `components.json` with `owners`, and the ESLint
  config with the preset last and `noInlineConfig`.
- **pack-smoke.** A fresh site passes, and a fixture holding one example of
  each bypass in the table fails each one with its message.

### 5 — Agents told the way

- **The template `AGENTS.md`** gets one always-loaded rule, within its
  budget of 16,384 bytes (about 1.2 KB is free): "Before building anything
  a site needs, find it in `docs/parts.md` (under `node_modules/agentic-cms/`).
  Use the kit's part. If the kit has none, stop and ask; never hand-roll it,
  and never weaken a check to pass one: a real need is a named exception
  with its reason." The kit's `AGENTS.md` carries the same rule.
- **Each scoped rule** ends with its part and the check that holds it.
- **The skills** (design, the design-* skills, setup, the editorial skills)
  end their procedures with `pnpm lint`.
- **The agent-file check** (D7) fails when a line the kit marks required is
  gone. It also tracks `.claude/settings.json`, so the plugin stays enabled.

### 6 — Existing sites adopt

- **`agentic-cms check-site --baseline`** writes the site's current bypasses
  into `components.json` (`baseline`), so its CI goes green at once. Each
  entry is then given a reason or replaced, and the list only shrinks (D3).
- **`docs/migrating-to-0.8.2.md`:**
  - § 1: the upgrade and the baseline;
  - § 2: each bypass replaced by its part, one pull request each, proven
    identical;
  - § 3: deleting what the kit replaced.
- **`docs/upgrading.md`** gets `0.8.1 → 0.8.2`.

### 7 — The docs sweep

Every place that teaches a part follows the map, and the old advice goes:

- **`README.md`.** The loop and the parts sections describe the four layers,
  and "four engines" goes. Commands and Map follow the new groups. Start
  your own site says what fails, and why.
- **`docs/README.md`.** The index is grouped by the four layers instead of
  one flat list.
- **The kit's `AGENTS.md` and `templates/site/AGENTS.md`:**
  - the map rule;
  - "Four engines carry their full contract" becomes the content engine and
    its layers;
  - the verify lines carry the new gates.
- **The rules.** `.claude/rules/*` and `templates/site/rules/*`, then
  `pnpm docs:rules`.
- **The skills.** `.claude/skills/*`, then `pnpm skills:sync`.
- **The other contracts:** `STANDARD.md`, `src/components/README.md`,
  `content/README.md`, `plugin/README.md` and the READMEs in `src/lib/*/`.
- **Every guide:** `primitives`, `gotchas`, `design`, `init`, `setup`,
  `dev-server`, `skills`, `visual-parity`, `lab`, `icons`, `forms`,
  `consent`, `email`, `deploy`, and `commands`, which is generated.
- **`PLAN.md`:** the phase, at the release.
- **The check.** A grep for the retired terms ("four engines", "Blog engine",
  "build gates") comes back empty, and `pnpm hygiene` passes.

### R — Release 0.8.2

1. **The gate is the owner's,** run in each site's own sessions: § 1 of
   `docs/migrating-to-0.8.2.md` with the baseline, CI green, and a proof
   identical. Findings come back as kit fixes.
2. **The release,** as for 0.8.0:
   - the release commit and the release PR, which the owner merges;
   - the tag;
   - the `PLAN.md` phase.

### S — The sites follow

Each site, in its own session, replaces its baseline one pull request at a
time.

## Order

```
after v0.8.1   [0 plan]
Lane A         [1 map] ─────────────────────────────┐
Lane B         [2 lint] → [3 guard] → [4 init gates] → [6 adopt]
               [5 agents] after 1 and 3              └→ [7 sweep] last
then           gate → R → S
```

The jobs overlap in these files; whichever pull request lands second
rebases:

- `scripts/lib/component-lint.mjs`: job 2;
- `scripts/lib/check-components.mjs` and the new `check-site`: jobs 3 and 6;
- `scripts/lib/init.mjs`: jobs 4 and 6;
- `templates/site/AGENTS.md`: jobs 5 and 7;
- every doc: each job touches its own lines, and job 7 sweeps.

## Risks and how each is held

- **A rule refuses legitimate code.**
  - *Hold:* each rule is tested on the example and pack-smoke's fresh site;
    a real need is an exception with its reason; the gate runs on two sites
    before the release.
- **A wider lint breaks existing sites on upgrade.**
  - *Hold:* the baseline (job 6) keeps their CI green, and it only shrinks.
- **The template `AGENTS.md` goes over its budget.**
  - *Hold:* one rule and a pointer; the map lives in `docs/`.
- **The rules drift from the map.**
  - *Hold:* the completeness test (job 1).
- **The checks slow down the build.**
  - *Hold:* the lint takes seconds; measure it in job 4.

## Verification — the end state

- **Every bypass fails.** On a site from `init`, each bypass in the survey
  table fails `pnpm lint` and `pnpm build`, naming the part to use;
  pack-smoke's bypass fixture proves it.
- **Existing sites stay green.** A site upgraded with the baseline passes,
  and its baseline only shrinks.
- **The map is complete.** `docs/parts.md` lists every export, command and
  check, and its test keeps it that way.
- **The docs agree.** The README and every doc describe the four layers, and
  the grep for the retired terms is empty.
