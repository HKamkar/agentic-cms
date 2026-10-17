# Roadmap — 0.8.2: the engines hold, the rest stays open, and no Acme

> Plan, not started: it begins after the `v0.8.1` tag, and 0.9.0
> (`docs/roadmap-0.9.0.md`) follows it. Written 2026-10-17 from a survey of
> `develop` c9ac3ed, and revised the same day after the owner's review: the
> engines are enforced, everything else is guided and never blocked, and a
> new site starts without the example's brand. The decisions marked
> *(decide in the PR)* take the recommendation unless the review says
> otherwise.

Three problems came from building a site on the kit:

1. **A design round skipped the content engine.** Its route and candidates
   hard-coded every word of copy, and the winners became the site's
   sections. Nothing failed: a `*-demo` folder is exempt by name, and copy
   in `src/app` and `ui/` passes the lint. A page whose copy is in code
   can't be edited as a file, linted for voice, audited or upgraded.
2. **The example's sample content came along.** `init` copies the example as
   it is:
   - Acme as the brand in `site.ts`, and `hello@acme.example`;
   - an Acme logo;
   - the catalogue pages;
   - three posts about the kit itself;
   - reviews, use cases, FAQs and an author.

   Design rounds read a page's copy, so they designed around Acme, and the
   leftovers stayed in the designs.
3. **Nothing says which part to use.** There is no map, so an agent writes
   its own version of what the kit already has.

**What 0.8.2 does not do: ban workarounds.** A site may use its own motion
library, a canvas, a graphics tool or a script of its own. The kit warns and
names its own part, and the site keeps its choice with one line of reason.
Only the engines are required, because they are what make a page a file the
kit can check.

## Two tiers

| Tier | Parts | When a site goes around one |
|---|---|---|
| **Required:** the engines | **content:** every word a reader sees comes from `content/`, or from `site.ts`'s chrome, in pages, sections, patterns, `ui/`, layouts and the design-round and lab routes. **SEO:** the head, the metadata and the structured data come through `kit.seo`. **Forms:** the form engine and its endpoint. **Consent:** a tag that needs consent loads through `agentic-cms/consent`. **E-mail:** the guard is on whenever the site has an address | `pnpm lint` fails, and so do `pnpm build` and CI, naming the part to use. A real need is a named exception with its reason |
| **Preferred:** the libraries and the tools | motion (`agentic-cms/ix`); graphics (the lab, pre-rendered); images (`Media`, `EagerImage`, `placeholder`); icons (`Icon`); the styling tokens in `ui/` and `src/app`; the screenshot harness; the dev server and the setup | A warning names the kit's part and its doc, and the build passes. A site keeps its own with one reason line, which shows in review |

## The map, in four layers

Every part goes on one page, `docs/parts.md`: the need, the part, how to use
it, its tier, the check that holds it, and the exception key. The page has
four layers:

| Layer | Ships | Parts |
|---|---|---|
| The content engine | the pages | `agentic-cms/content`, the collections. On it: pages (`content/pages/`, the section registry), the post pipeline (`agentic-cms/blog`) and SEO (`agentic-cms/seo`). Beside it: forms (`agentic-cms/forms`, `/forms/server`) |
| Browser libraries | to the reader | `agentic-cms/ix`, `/components`, `/consent`, `/email`, `/cx` |
| Design tools | never | the lab, design rounds (`demo`), the screenshot harness (`visual-parity`, `parity`, `shot`, `probe`, `sheet`), icons, images (`placeholder`, the optimisers) |
| The site's commands | the build and the setup | `init`, `setup`, `urls`, `serve`; the build's gates (`lint`, `check`, `docs`, `seo`, `check-components`, `guard-email`, `critical-css`, `assemble`); `/loader`, `/eslint` |

Three names change:
- "Four engines" becomes **one content engine** with its layers.
- "Blog engine" becomes **the post pipeline**.
- The commands' group "build gates" splits into the gates the build runs by
  default and the steps a site turns on.

## What gets around the kit today

From a survey of every part, as `init` sets a site up:

| Part | Tier | Held today by | A bypass that fails nothing |
|---|---|---|---|
| Content in a design round | required | `demo new --section` reads the page's file | a hand-made `*-demo` route and candidates with every word hard-coded |
| Content in pages | required | the routes check; the copy rule in sections and patterns | copy in `ui/`, layouts or `not-found`; copy through any prop but the named six |
| SEO | required | the audit of the rendered page | a hand-written `metadata` export or JSON-LD block |
| Forms | required | no form elements in sections | a `ui/` component with its own `<form>` posting to a third party |
| Consent and analytics | required | instructions | a raw `next/script` analytics tag |
| E-mail | required | `guard-email`, if a site turns it on | a literal `mailto:` |
| The starter | required | nothing | Acme's name, domain, logo and sample content left in a site |
| Motion | preferred | `motion`/`framer-motion` banned; motion classes banned in sections | another animation library, without a word |
| Graphics, images, icons | preferred | `<img>` and `<svg>` banned in sections | `next/image`, a canvas, a pasted `<svg>` in `ui/`, without a word |
| Styling | preferred | arbitrary values banned in sections | `bg-[#…]` in `ui/` and `src/app`, without a word |
| Screenshots, dev server, setup | preferred | instructions | a site's own Playwright or dev script, without a word |
| The gates themselves | — | `pnpm lint` and CI | `next build` runs no ESLint; `init` keeps a site's own `lint` and `build`, gates dropped; `eslint-disable` with no reason; exceptions grow freely |
| Agent files | — | the manifest's hashes | `modified` passes, so a rule's key line can be deleted |

"Without a word" is the preferred tier's gap. The choice itself is allowed;
it should come with a reason someone can read.

## Decisions

| # | Question *(decide in the PR)* | Options | Recommendation |
|---|---|---|---|
| D1 | How far each tier reaches | (a) sections and patterns only, as today; (b) the required rules fail across all of `src/`, design-round and lab routes included, and the preferred rules warn across all of `src/`; (c) everything fails everywhere (the first draft) | **(b).** The engines hold everywhere, and creativity is never blocked. |
| D2 | Inline disables | (a) allowed with no reason, as today; (b) none at all; (c) allowed with a description (`-- reason`), and the guard lists them | **(c).** A workaround is fine; a silent one is not. |
| D3 | Exceptions | (a) free, as today; (b) each needs a reason and every added one is printed. `inherited` and the baseline, an existing site's engine bypasses, only shrink | **(b).** |
| D4 | The lint in `pnpm build` | (a) the build runs no ESLint, as today; (b) the build runs `pnpm lint` first, where warnings never fail it | **(b).** Agents run the build more often than the lint. |
| D5 | `guard-email` | (a) a site turns it on, as today; (b) on in the build whenever `site.ts` has an address | **(b).** |
| D6 | Where the site-wide checks live | (a) `check-components` grows to check the whole site; (b) a new command, `check-site`, runs the components pass and the new ones, and `check-components` stays | **(b).** |
| D7 | Edited agent files | (a) `modified` passes, as today; (b) lines the kit marks required must stay | **(b).** |
| D8 | The starter | (a) the example as it is, as today; (b) a clean starter: `init --name` puts the site's name and domain where the example says Acme, with one home page whose copy is marked as placeholder and a neutral logo placeholder. None of the example's own content or pictures go in: no posts, reviews, use cases, FAQs, author, catalogue pages, or images under `public/images/` but the wireframe's neutral placeholders. There is no option to bring them back; the example stays readable in the kit's own repository | **(b).** A new site's design starts from the site, never from Acme. |
| D9 | Placeholder copy and the example's brand | (a) nothing marks them, as today; (b) the starter marks its copy as placeholder, and the content lint WARNs on it in development and FAILs in a production build. The example's brand (`Acme`, `acme.example`, the Acme asset names) FAILs in a site at any time | **(b).** No placeholder ships, and a design round sees what it has to replace. |

## The jobs

Each job updates every doc its change reaches, in the same pull request.
Job 8 is the last pass over all of them.

| # | Job | What it changes |
|---|---|---|
| 0 | This plan into the repo | `docs/roadmap-0.8.2.md` |
| 1 | The map | `docs/parts.md`, with each part's tier; the four layers; the names |
| 2 | The engines enforced | the required rules across `src/`, design-round routes included |
| 3 | The rest guided | the preferred rules as warnings, and reasons in place of silence |
| 4 | `check-site` and the gates on by default | the whole site checked; the build runs the lint; `init` merges the gates |
| 5 | A starter without Acme | `init --name`, a clean starter, placeholders marked, the example's brand refused |
| 6 | Agents told the way | the template `AGENTS.md`, the rules, the skills, the agent-file check |
| 7 | Existing sites adopt | a baseline for engine bypasses; Acme leftovers listed; `docs/migrating-to-0.8.2.md` |
| 8 | The docs sweep | the README and every doc, on the map |
| R | Release 0.8.2 | after the gate on two sites |
| S | The sites follow | each in its own session |

### 0 — This plan into the repo

This file, reviewed in its own pull request, with the decisions recorded as
**Decided:**.

### 1 — The map

- **`docs/parts.md`.** One row per need, grouped by the four layers:
  - the need: a page, a post, a design candidate, a head tag, structured
    data, a form, an analytics tag, an e-mail address on a page, an image
    above the fold, a placeholder, motion, an icon, a graphic, a screenshot
    or a proof, a dev server and its URLs, the setup of a clone;
  - the part that meets it, and how to use it: the import or the command,
    and its doc;
  - its tier (required or preferred);
  - the check that holds it;
  - the exception key.
- **The partial maps point to it.** `docs/primitives.md`, `docs/gotchas.md`
  and `docs/design.md` link to it instead of repeating it.
- **A test keeps it complete.** Every export, command and rule must appear on
  it.
- **The names:** one content engine; "the post pipeline"; the specs'
  `group` values follow the layers, and `pnpm docs:commands` follows them.
- **0.9.0's job 6** adds its stable/experimental column to this page.

### 2 — The engines enforced

The required rules fail across `src/` (D1), and each message names the
part and its doc.

- **Copy.** Any string a reader sees counts as copy: a JSX child, or an
  attribute other than class names, ids, routes and the like, not only the
  six named props. It must come from a content file, through props, or
  from `site.ts`'s chrome, everywhere:
  - in sections, patterns, `ui/`, layouts and `not-found`;
  - in a design round's route and candidates, which read the page's copy
    from its content file, as `demo new --section` already does;
  - in a showcase, whose copy also comes from a content file.

  Symbols, `aria-hidden` decoration and the named decorations still pass.
- **The head.** No `<head>`, `<title>`, `<meta>`, canonical `<link>` or
  `application/ld+json` script outside the kit's own. A route's metadata
  comes from `kit.seo`.
- **Forms.** `<form>` only in the form components. No server action and no
  absolute-URL `fetch` in a component.
- **Tags.** `next/script` and a third-party `<script src>` only in the
  consent adapter that owns them.
- **E-mail.** No `mailto:` literal; `EmailLink` instead.
- **The preset holds:**
  - the guard fails when a later ESLint block has replaced one of the
    kit's required rules, the flat-config trap 0.8.1 closed for
    `no-restricted-imports`;
  - the site's `src/lib/**` is linted;
  - an inline disable needs its description (D2).

Each rule gets tests for what passes and what fails. The example passes,
and so does pack-smoke's fresh site.

### 3 — The rest guided

The preferred rules warn across `src/`, naming the kit's part:

- **Motion:** an animation library other than `agentic-cms/ix`; a site's own
  `requestAnimationFrame` or observer-driven animation; a transition
  utility or style outside the motion layer.
- **Graphics:** a rendering library or a `<canvas>`. The lab ships graphics
  pre-rendered (`docs/lab.md`).
- **Images:** `next/image`, or an eager `<img>` outside `EagerImage`.
- **Icons:** an `<svg>` outside `Icon`.
- **Styling:** an arbitrary value or a style colour outside the tokens.

A site keeps its own with one reason line: an `allow` entry in
`components.json` (`{ rule, files, reason }`), or an inline disable with
its description. A warning with a reason is quiet. A warning without one
stays in the lint's output, so the review sees it. A warning never fails
the build.

### 4 — `check-site` and the gates on by default

`check-site` (D6) runs `check-components`' passes and adds these:

- **Design rounds:**
  - a `*-demo` route that `demo new` did not write fails;
  - a round's pictures left after `demo clean` fail.
- **Exceptions (D3):** each has a reason, and every added one is printed;
  `inherited` and the baseline only shrink.
- **`package.json`:** `lint` and `build` hold the kit's gates.
- **CI:** the site's `verify.yml` runs the lint, the tests, the build and
  the agent-file check.
- **The site's own tools** (preferred, so these are warnings):
  - a script that drives Playwright, sharp over `public/`, or `next dev`;
  - a machine address in `next.config.*`.

  Each warning names the kit's command.

On a site from `init`:

- **The build** runs `pnpm lint` first (D4), then the content lint, the docs
  check, `next build`, the SEO audit and `guard-email` (D5).
- **An existing `package.json`:** `init` merges the gates into the site's
  `lint` and `build`, or refuses and names what to add. It never drops them
  silently.
- **pack-smoke** builds a fixture with one example of each bypass. Each
  required one fails with its message, and each preferred one warns.

### 5 — A starter without Acme

- **`init --name "<Site>"`.** The name defaults to the folder's name. It
  goes where the example says Acme: `site.ts`'s name, short name and
  description, the domain and its address, the logo's alt text and file
  name.
- **The starter's content (D8):**
  - one home page, with the section types the wireframe renders, its copy
    marked as placeholder;
  - the blog index;
  - a neutral logo placeholder;
  - `content/_templates/` for everything else.

  None of the example's own posts, reviews, use cases, FAQs, author or
  `/sections/*` catalogue pages, and none of the example's pictures (the
  author portrait, the posts' images, the catalogue's). No option brings
  them back; whoever wants to read the example reads it in the kit's
  repository.
- **The placeholder marker and the lint (D9):**
  - each placeholder string or page carries the marker;
  - the content lint WARNs on it in development and FAILs in a production
    build, naming each file and field;
  - the example's brand (`Acme`, `acme.example`, the Acme asset names) FAILs
    in a site at any time;
  - `/editorial:new-page` and the editorial skills replace placeholders and
    remove the marker.
- **Design rounds start from real copy.** A round on a page that still holds
  placeholder copy says so before it starts, and the design skill gets the
  copy first, from the owner or `/editorial:new-page`. It never designs
  around a placeholder or the example's brand.
- **The tests:**
  - `init` with and without `--name`, and a fresh site with no `Acme`, no
    `acme.example` and none of the example's files, which a test checks;
  - the lint's WARN and FAIL;
  - pack-smoke's fresh site builds in development and fails a production
    build until its placeholders are replaced.

### 6 — Agents told the way

- **The template `AGENTS.md`** gets one always-loaded rule, within its
  budget of 16,384 bytes (about 1.2 KB is free): "The engines are required:
  every word a reader sees comes from `content/` or `site.ts`, in pages,
  sections, components and design rounds alike; heads come from `kit.seo`,
  forms from the form engine, tags through consent. For everything else,
  find the kit's part in `docs/parts.md` and prefer it; if you use your
  own, write its reason in one line. Never weaken a check to pass it." The
  kit's `AGENTS.md` carries the same rule.
- **Each scoped rule** ends with its part, its tier and its check.
- **The skills** end their procedures with `pnpm lint`. The design skills
  start a round from the page's content file and never write copy into a
  candidate.
- **The agent-file check** (D7) fails when a line the kit marks required is
  gone, and it tracks `.claude/settings.json`, so the plugin stays enabled.

### 7 — Existing sites adopt

- **`agentic-cms check-site --baseline`** writes the site's current engine
  bypasses into `components.json` (`baseline`), so its CI stays green.
  Each entry is then moved onto its engine, one pull request at a time, and
  the list only shrinks (D3). Preferred-tier warnings are not baselined:
  they stay warnings until each gets a reason or is replaced.
- **The example's leftovers.** `check-site` lists what is left of Acme, the
  example's brand and its sample content, so each can be replaced or
  deleted.
- **`docs/migrating-to-0.8.2.md`:**
  - § 1: the upgrade and the baseline;
  - § 2: hard-coded copy moved into content files, page by page, proven
    identical (0.8.0's § 3.9 shows how);
  - § 3: the Acme leftovers;
  - § 4: the preferred tier's reasons.
- **`docs/upgrading.md`** gets `0.8.1 → 0.8.2`.

### 8 — The docs sweep

Every place that teaches a part follows the map, and the old advice goes:

- **`README.md`.** The loop and the parts sections describe the layers and
  the two tiers, and "four engines" goes. Commands and Map follow the new
  groups. Start your own site gets `init --name`, the placeholders and
  what fails.
- **`docs/README.md`.** The index is grouped by the four layers instead of
  one flat list.
- **The kit's `AGENTS.md` and `templates/site/AGENTS.md`:** the rule; the
  content engine and its layers; the verify lines with the new gates.
- **The rules.** `.claude/rules/*` and `templates/site/rules/*`, then
  `pnpm docs:rules`.
- **The skills.** `.claude/skills/*`, then `pnpm skills:sync`.
- **The other contracts:** `STANDARD.md`, `src/components/README.md`,
  `content/README.md`, `plugin/README.md` and the READMEs in `src/lib/*/`.
- **Every guide:** `primitives`, `gotchas`, `design`, `init`, `setup`,
  `dev-server`, `skills`, `visual-parity`, `lab`, `icons`, `forms`,
  `consent`, `email`, `deploy`, and `commands`, which is generated.
- **`PLAN.md`:** the phase, at the release.
- **The check.** A grep for the retired terms ("four engines", "Blog
  engine", "build gates") comes back empty, and `pnpm hygiene` passes.

### R — Release 0.8.2

1. **The gate is the owner's,** run in each site's own sessions: § 1 of
   `docs/migrating-to-0.8.2.md` with the baseline, CI green, and a proof
   identical. Findings come back as kit fixes.
2. **The release,** as for 0.8.0:
   - the release commit and the release PR, which the owner merges;
   - the tag;
   - the `PLAN.md` phase.

### S — The sites follow

Each site, in its own session, moves its baseline onto the engines one pull
request at a time, and clears the Acme leftovers.

## Order

```
after v0.8.1   [0 plan]
Lane A         [1 map] → [6 agents] ──────────────────────────────┐
Lane B         [2 engines] → [3 guided] → [4 check-site, gates] → [7 adopt] → [8 sweep] last
Lane C         [5 starter]
then           gate → R → S
```

The jobs overlap in these files; whichever pull request lands second
rebases:

- `scripts/lib/component-lint.mjs`: jobs 2 and 3;
- `scripts/lib/check-components.mjs` and the new `check-site`: jobs 4 and 7;
- `scripts/lib/init.mjs`: jobs 4 and 5;
- `scripts/lib/content-lint.mjs`: job 5;
- `templates/site/AGENTS.md`: jobs 6 and 8;
- every doc: each job touches its own lines, and job 8 sweeps.

## Risks and how each is held

- **A rule refuses legitimate code.**
  - *Hold:* only the engines fail. Everything else warns, and a reason
    quiets it.
- **The copy rule reads a class name or a route as copy.**
  - *Hold:* tests on the example, pack-smoke's fresh site and the bypass
    fixture; the attributes it skips are listed in the rule's doc.
- **A wider lint breaks existing sites on upgrade.**
  - *Hold:* the baseline (job 7) keeps their CI green, and it only shrinks.
- **A clean starter loses what the example taught.**
  - *Hold:* the example stays in the kit's own repository, where the docs
    link to it; nothing of it is copied into a site.
- **The template `AGENTS.md` goes over its budget.**
  - *Hold:* one rule and a pointer; the map lives in `docs/`.

## Verification — the end state

- **The engines hold.** On a site from `init`, hard-coded copy anywhere
  under `src/` (a design round included), a hand-written head, a form or a
  tag outside its engine, and a `mailto:` each fail `pnpm lint` and `pnpm
  build`, naming the part.
- **The rest stays open.** Each preferred bypass warns and names the kit's
  part, and a reason quiets it. None fails the build.
- **No Acme.** A new site has no Acme and none of the example's sample
  content. A production build fails while placeholder copy remains.
- **Existing sites stay green.** A site upgraded with the baseline passes,
  and its baseline only shrinks.
- **The map is complete, and the docs agree.** `docs/parts.md` lists every
  part with its tier, and the grep for the retired terms is empty.
