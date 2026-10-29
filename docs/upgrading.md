# Upgrading a site

What a site can rely on from one version to the next, and what may change
in any release, is [stability.md](stability.md).

A site pins the package by tag (`github:HKamkar/agentic-cms#v<x.y.z>`). From
0.9.0 on, one command in the site's root moves it to a release, with that
release's own code ([upgrade.md](upgrade.md)):

```bash
pnpm dlx --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v<next> upgrade --dry-run   # what it would change
pnpm dlx --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v<next> upgrade
```

It moves the pin, runs each migration of the releases in between, the
agent files' refresh, prints what is left by hand with its section below,
then runs `pnpm lint` and `pnpm test`. By hand, the same steps start:

```bash
pnpm add agentic-cms@github:HKamkar/agentic-cms#v<next>
pnpm install
pnpm exec agentic-cms init . --agent-files --check  # what differs from the kit's agent files
pnpm exec agentic-cms init . --agent-files          # the kit's lines in; the site's own kept; nothing to merge
```

Since 0.9.0 nothing of the kit's agent files is merged by hand: the kit's
skills are its plugins, read from the installed package; a rule is thin,
its kit block rewritten and the site's own lines after it kept; a Codex
stub is rewritten whatever it holds; the kit's keys in
`.claude/settings.json` are set and the site's others kept
([init.md § After a kit upgrade](init.md#after-a-kit-upgrade)).
`AGENTS.md` is the site's own from the day `init`
wrote it and is never rewritten: a release's new lines for it are listed
too. Then the release's own steps, `pnpm build`, `pnpm test`, and a new
baseline for the screenshot harness when the release changed what a capture
writes (`CHANGELOG.md` marks each such line **recapture baselines**).

## 0.8.4 → 0.9.0

Unreleased: on `develop` until 0.9.0. `upgrade` runs the 0.9.0 migration
(`scripts/migrations/0.9.0.mjs`), which takes each item below it can and
prints the rest.

- **The agent files move.** The first `init . --agent-files` on 0.9.0
  moves what 0.8 copied (`--check` calls each `legacy` until then): a
  design skill copy the site never touched goes, in both trees, since
  Claude Code reads the kit's from its `design` plugin and Codex from a
  stub; one the site edited becomes its own, `.claude/skills/<name>-site/`
  (or `.agents/skills/<name>-site/`), and the refresh lists each to keep or
  delete; each rule becomes thin, its own lines kept after the kit's block;
  `.agentic-cms/base/` goes; `.claude/settings.json` names the package's
  marketplace, `./node_modules/agentic-cms`, with `design@agentic-cms`
  enabled beside `editorial@agentic-cms`. Commit what it changed with the
  manifest.
- **The content schemas.** `upgrade` opens each YAML content file of the
  standard collections with its schema's line
  (`# yaml-language-server: $schema=…`), then runs the site's installed
  `agentic-cms schema --lines` and `agentic-cms docs`. Together they write
  `content/_schemas/`, the line of each collection of the site's own and
  the field tables. The build's `docs --check` fails until they are there;
  commit them. Where the installed command cannot run, `upgrade` prints the
  two commands as a step by hand ([schema.md](schema.md)).
- **The redirects.** `upgrade` writes the starter's empty
  `content/redirects.yaml`, which the engine now reads like every
  collection, and has the site's Next config return `redirectsFor()` from
  `redirects()`, placed as the template has it. A config with a
  `redirects()` of its own, or none the edit can find, is a step by hand:
  return `[...redirectsFor(), ...the site's own]`. Redirects the host held
  (a `_redirects` file, a dashboard's list) move into the file by hand
  ([redirects.md](redirects.md)).
- **By hand, `AGENTS.md` and `CLAUDE.md`.** They are the site's own, so
  the move leaves them. Replace what the 0.8 template copied into
  `AGENTS.md` — its sections on styling, gotchas and the parity harness,
  and the bullets that list the kit's docs — with the current template's
  table, "The kit's guides"
  (`node_modules/agentic-cms/templates/site/AGENTS.md`), and in both files
  say that the design skills come from the kit's plugin, not
  `.claude/skills/`.
- **The first session after the move** may start without the kit's
  skills: Claude Code points its registration of the marketplace at the
  package's folder as that session starts, and the next session has them
  ([gotchas.md § Claude Code](gotchas.md#claude-code)).

## 0.8.3 → 0.8.4

A site whose baseline has merged has nothing to do: its list only shrinks,
as before. A site still on the pull request that takes
[migrating-to-0.8.2.md](migrating-to-0.8.2.md)'s § 1, with a list an
earlier `check-site --baseline` wrote, moves the pin and runs
`--baseline` again: while the merge base has no list, it writes the list
from what the site holds now and keeps each entry's reason. A list emptied
by hand to get a new entry in, and its reasons put back, is no longer
needed.

## 0.8.2 → 0.8.3

An upgrade by [migrating-to-0.8.2.md](migrating-to-0.8.2.md) builds green
on its first day on either of its paths, 0.8.0's § 3.7 taken inside its
§ 1 included: what a site already has is recorded with its reason and
only shrinks, and new code meets the full rules. A site on 0.8.1 follows
that guide as before; a site on 0.8.2 moves the pin, runs `pnpm install`
and `init . --agent-files --check`, and takes what it reports. Then, in
the same pull request:

- **`pnpm exec agentic-cms check-site --baseline`, once.** The copy rule
  no longer reads a string of utility classes in a prop (`flex flex-col
  gap-6`), a camelCase name (`slideInLeft`), `preset` on the play-once
  layer's components or a class map's copy-named field (`text:
  "text-steel"`) as words, so a baseline that held such findings holds
  more than its file has, and the lint asks for the entry to shrink. The
  command shrinks it; a site with no baseline has nothing to do.
- **The composition rules join the baseline.** A section's raw element, a
  style, an arbitrary value, a second component in its file and an import
  against the layers (`react/forbid-elements`, `no-restricted-syntax`,
  `react/no-multi-comp`, `no-restricted-imports`) are what an existing
  site that takes 0.8.0's § 3.7 already has: `--baseline` writes them with
  the rest, and a processor on each listed file holds them in ESLint. A
  site that took 0.8.2 green has none to take, and its list stays as it is.
- **An empty `"baseline": []`** the merge base does not have, as a config
  copied from the package brings, is a first run: `--baseline` writes the
  whole list. A new site's list, committed, still takes nothing.
- **`eslint.config.mjs`** takes the template's `".claude/worktrees/**"` in
  its `globalIgnores` if it lacks it: ESLint otherwise lints every agent
  worktree's copy of the site.
- **CI:** `check-site` warns when the workflow that runs the lint on pull
  requests leaves out, in its `on.pull_request.branches`, a branch the
  site's pull requests go into (`develop` beside `main`): those pull
  requests get no checks. A build step that also deploys keeps the
  production build; `AGENTIC_CMS_PLACEHOLDERS: warn` goes on its
  pull-request runs alone, if anywhere.
- **The agent files.** The styling rule's tier line and the components
  rule's loosening line, both required, say the same now: in a section or
  a pattern no reason quiets a composition error, an inline disable there
  is loosening a rule, and the baseline holds what the site already had. A
  site that edited either rule merges the kit's line. The required check
  reads a block's words in any case, under a list marker of the site's own
  and among its own words; a `--diff` patch that does not apply is merged
  by hand ([init.md § After a kit upgrade](init.md#after-a-kit-upgrade)).

Nothing a reader sees changes, and nothing needs recapturing.

## 0.8.1 → 0.8.2

The engines are required, and none of the example's brand or sample
content stays in a site. [migrating-to-0.8.2.md](migrating-to-0.8.2.md) is
the guide. Its § 1 is the upgrade: the pin, the agent files, the gates,
ESLint reading the guard's config, and `agentic-cms check-site --baseline`,
which writes what the site holds now of the engines' findings and the
example's leftovers into `src/config/components.json`. Its CI stays green
on that list, which only shrinks after that, one pull request at a time.
The lines below are what changed.

A new site starts from a starter of its own name instead of the example
([init.md § The starter](init.md#the-starter)), and `init` lays a new site
out only with that name: `--name "<Site>"` is required, and without it
`init` exits 2 and writes nothing. Nothing changes for an existing site:
`init` on a site that has `content/` asks no name, and `--agent-files`
takes none. For an existing site nothing of its content changes either: `init` lays the starter's content and pictures out
only in a folder with no `content/` yet, and never rewrites a site's
`content/`, `public/`, `src/config/site.ts` or `src/config/forms.ts`,
`--force` included. Two things the content lint now reads, which a site
sees on its first build after the upgrade:

- **The kit example's brand fails** in a site at any time (`example-brand`):
  `Acme` as a word, `acme.example`, the example's author `acme-editorial`,
  in any file under `content/` and `src/config/` (but the guard's config),
  in an SVG's text and in a picture's name under `public/`. A site that kept
  the example's posts, its author, its logo or a line of its copy sees each
  named: replace it with the site's own, or delete it. A site whose own name
  is Acme keeps it; the example's domain and author still fail. Until each
  is replaced, the baseline the guide's § 1 writes holds them: the brand
  lines of a file it lists pass while the file has no more than its count
  ([migrating-to-0.8.2.md § 3](migrating-to-0.8.2.md#3-the-examples-leftovers)).
- **Placeholders** (`placeholder`): a string marked `(placeholder)`, or an
  address on a domain reserved for examples (`.example`, `.test`,
  `.invalid`, `localhost`, example.com), warns, and fails a production
  build: the build's content lint runs with `--production` once the site
  takes the gates (below). A CI `pnpm build` step that deploys nothing
  takes `env: { AGENTIC_CMS_PLACEHOLDERS: warn }`. `agentic-cms assemble`
  packages nothing while one remains.

The CI workflow `init` writes pins newer actions, the commits the kit's own
CI runs: `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0 and
`pnpm/action-setup` v6.1.0, the first to state support for pnpm 12, the
version a site's `packageManager` names. `init` never rewrites a site's
`.github/workflows/verify.yml`, so an existing site copies the three
`uses:` lines from `node_modules/agentic-cms/templates/site/verify.yml`;
its steps and their inputs stay as they are. The actions now run on Node 24
(a self-hosted runner needs v2.327.1 or later), and checkout v7 refuses to
check out a fork's pull request under `pull_request_target` or
`workflow_run` unless `allow-unsafe-pr-checkout: true`, triggers the
template does not use.

**The gates are on by default** ([init.md § The gates](init.md#the-gates)).
A new site's `pnpm lint` runs ESLint, then `agentic-cms check-site`, which
runs the component guard's passes and then holds the site as a whole: a
`*-demo` route `demo new` did not write, a round's pictures left after
`demo clean`, every exception added since the merge base (listed with its
reason; a file added to `inherited` fails), the gates in `package.json` and
in CI, and, as warnings, the site's own Playwright, `sharp` or `next dev`
script and a machine's address in `next.config.*`
([primitives.md § The whole site](primitives.md#the-whole-site-agentic-cms-check-site)).
Its `pnpm build` runs `pnpm lint` first, and `guard-email` last when its
`site.ts` turns `guardEmail` on (below). An existing site's `package.json`
is its own, so it moves to them by hand:

```json
"lint": "eslint; s=$?; agentic-cms check-site || s=1; exit $s",
"build": "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo"
```

with its own steps kept where they are (0.8.1's `agentic-cms lint` step
becomes `agentic-cms lint --production`; `agentic-cms init .` merges them
the same way, or refuses naming what to add, and also writes any file of
the example the site removed). Then `pnpm lint` and read what `check-site`
reports: a warning fails nothing and goes quiet with an `allow` entry of
`agentic-cms/site-tools` and its reason in `src/config/components.json`.
In `.github/workflows/verify.yml`, `fetch-depth: 0` under the checkout's
`with:` gives the check the history it compares the exceptions against;
without it CI says it compared nothing.

**The site's `AGENTS.md`** takes the template's new lines by hand, from
`node_modules/agentic-cms/templates/site/AGENTS.md`: the engines rule,
first among the rules (every word from `content/` or `site.ts`, heads from
`kit.seo`, forms from the form engine, tags through consent, and the rest
from `docs/parts.md` or with its reason); the sentence on `(placeholder)`
copy in the content bullet; and the verify bullet, with the gates and the
agent-file check's required lines. `--agent-files` brings the rules' tier
lines and the skills' closing `pnpm lint`
([init.md § What an edit keeps](init.md#what-an-edit-keeps)).

**The e-mail engine, behind a key** ([email.md](email.md)). A new site's
`src/config/site.ts` has `guardEmail: true`: no structured data carries its
address as text (a `ContactPoint` with the contact page's URL in its
place), no client component imports `site.ts`, the form's message and
recipient are tokens, and the build ends with `agentic-cms guard-email`.
Nothing changes for an existing site unless it adds the key: without it,
its structured data, its pages and its bundles are what they were, byte
for byte, and nothing asks it for the guard. To add it:

1. `guardEmail: true` in `site.ts`, beside `email`. The Organization blocks
   change at once: `email` gives way to a contact point
   ([the SEO contract](../src/lib/seo/README.md)), and a ContactPage's
   contact points carry its URL, so a contact's `email` in its page file
   can go.
2. No `"use client"` module imports `site.ts`
   (`grep -l '"use client"' -r src | xargs grep -l config/site` lists
   them): each takes what it shows as props from the server component that
   renders it. The kit's example passes the navbar its brand, links and
   words from the layout, the theme switch as its child, the consent
   banner its copy and the Cookie settings button its label.
3. A form's messages write `{email}` with `messages.email: site.email`, and
   the server component that renders the form passes
   `withEmailToken(definition)`; every other place the address shows is an
   `EmailLink` (`pnpm lint` already fails a `mailto:` built in code).
4. `&& agentic-cms guard-email` last in the `build` (`agentic-cms init .`
   merges it; `check-site` names it while it is missing), then
   `pnpm build`: the guard names each served file that still carries the
   address, and the fix. Prove the change with `visual-parity`: only the
   structured data and the bundles move, not a pixel.

A site whose address is public on purpose says so instead:
`guardEmail: { off: "<why>" }`, which `check-site` lists with its reason
once it is added. `false` alone fails `check-site`.

**Dependabot for the CI's actions.** `init` now writes
`.github/dependabot.yml`: the GitHub Actions alone, one grouped pull
request a month to the default branch, so the pins in `verify.yml` stay
current without a kit release. An existing site may copy
`node_modules/agentic-cms/templates/site/dependabot.yml` there as it is;
`init` never rewrites the site's copy.

## 0.8.0 → 0.8.1

The fixes from running the migration guide on two sites. Move the pin to
`#v0.8.1`, `pnpm install`, then `init . --agent-files --check`, and take
what it reports as § 1 of [migrating-to-0.8.0.md](migrating-to-0.8.0.md)
says. The design skill's card frame, the styling rule's and the design
skill's motion line, and the setup skill's flags changed. A rule the site
wrote before the manifest recorded its base is now measured against the
kit's text at the version it came from, so fewer files report `modified,
kit changed`, and a `--diff` with no base says so. If the site's ESLint
config has its own `no-restricted-imports` block over its component
folders, move it into `componentRules({ restrictedImports })`: that block
was replacing the kit's import bans for those files. A proof now retakes a
differing shot once: `FLAKY` when the difference doesn't reproduce,
`UNSTABLE` when it lies where two takes of one build differ. Both still
exit 1, so read the cause. A proof builds its own baseline, so nothing needs
recapturing.

## 0.7.6 → 0.8.0

The steps are in [migrating-to-0.8.0.md](migrating-to-0.8.0.md). § 1 moves
the tag and refreshes the agent files; every site takes it, and builds,
lints and proves identical after it. Everything after § 1 is a choice, step
by step, with what to delete if the site wrote its own version. A `--motion`
capture of a page with a loop writes fewer entries: **recapture baselines**
of `--motion` captures (§ 2).

## 0.7.5 → 0.7.6

Nothing to do: a voice block without `models.except` reads as before.

## 0.7.4 → 0.7.5

A security release (`CHANGELOG.md`). Move the site's `next` to 16.3.6 or
later, with its `eslint-config-next` beside it; pnpm warns on an older
`next` now that the package's peer range starts there:

```bash
pnpm add next@16.3.8 eslint-config-next@16.3.8
```

`image-size` comes patched with the package. Then `pnpm build`, and a proof
of the site's pages on the new `next` (`docs/visual-parity.md`).

The inline-SVG guard is stricter: a drawing that hides a script, a handler
or a `javascript:` URL now fails the build, which names the file and what
it found; take the code out of the drawing.

## 0.7.3 → 0.7.4

A fix to the lab's timeline (`CHANGELOG.md`): while it plays, the
animations it wraps run on the browser's clocks, and a copy far off
screen waits until it is scrolled back to; paused or scrubbed, every copy
holds one frame as before. Nothing to change in a site: a demo route's
`LabStudy` and `LabTimeline` take it with the package.

## 0.7.2 → 0.7.3

A fix to `critical-css` (`CHANGELOG.md`): it leaves a page as Next wrote
it but for the inlined rules and the stylesheet links, so `agentic-cms
seo` after it passes again. Nothing to change in a site; rebuild.

## 0.7.1 → 0.7.2

One new command, `agentic-cms critical-css` (`CHANGELOG.md`), and one new
dependency, `beasties`, which `pnpm install` brings. Nothing changes for a
site that does not run it. A site served as a Node server puts it right
after `next build` in its `build` script, before `seo` and `assemble`
([deploy.md](deploy.md#critical-css)); one whose pages carry a strict
Content-Security-Policy allows the stylesheet swap's inline `onload` by its
hash first. `agentic-cms critical-css --check` after the build names any
page that still waits for a stylesheet.

## 0.7.0 → 0.7.1

`Fx` gains `duration`, `distance` and `intro` (`CHANGELOG.md`). Nothing
changes for a site that does not use them. A site that gives its heroes'
copy `intro` copies the `ix-intro` block from the end of the package's
`src/styles/motion.css` into its own: the keyframes are the site's file,
as the start states are.

## 0.6.1 → 0.7.0

Two things: a visitor's choice seeded into every page's storage before its
scripts run ([visual-parity.md](visual-parity.md#a-visitors-choice-seeded)),
and consent in the package, `agentic-cms/consent` and its Google adapter
([consent.md](consent.md)). Nothing changes for a site that uses neither:
no seed, no init script, the same shots.

- **A site that shows something until a choice is stored** (a consent
  banner of its own, fixed over the page) adds `src/config/harness.ts`
  with the record a choice leaves (`{now}` where it carries a time) and
  **recaptures its baselines**: every capture is then seeded, and `compare`
  refuses a seeded capture against an unseeded one. `shot`, `probe`,
  `sheet` and `icons audit` are seeded too, on the build and on the dev
  server (a demo route, the lab route); `--no-storage` shows the first
  visit.
- **The site's `AGENTS.md`** takes the template's new clauses by hand (the
  harness section: the seed, both sides, `--no-storage`; the intro bullets:
  consent is the package's, the banner the site's); `--agent-files` brings
  the `design-proof` skill's.
- **A site with a consent implementation of its own** can replace it with
  the package's, its stored choices kept: the record is `{ analytics, at,
  version }`, so the same `storageKey` and `version` in the policy read
  every choice already stored.
  - The default: `consentDefaultScript(policy)` as a plain inline
    `<script>` near the top of `<body>` — not `next/script` with
    `beforeInteractive`, which Next's bootstrap can miss when its chunk
    arrives before the page's stylesheet (consent.md says why).
  - The tag: `<GoogleTag tagId policy />` (basic mode) in place of a
    component that mounted Google's own; the package puts the tag on the
    page itself and makes the same requests, so `@next/third-parties` can
    go if nothing else uses it.
  - The banner keeps its design and takes its state from
    `useConsent(policy)`; a settings button calls `openConsent()`.
  - Prove it with the site's own consent tests (the default script run in
    `node:vm` against `readChoice`) and a production check: nothing of
    Google's before a choice, the tag after Allow, nothing after Decline, a
    returning visitor's choice before the tag's config.
- **The example's new files reach a site only through `init`**: a site
  that wants consent and has none copies the pattern from
  [consent.md](consent.md) — `src/config/analytics.ts`, the three lines of
  the layout, a banner of its own design — and adds `src/config/harness.ts`
  if it has none, then **recaptures its baselines**.

## 0.6.0 → 0.6.1

Every ordinary form item: `url`, `number`, `date`, `select`, `radios`, one
`checkbox`, `hidden`, notes and groups, hints, prefill from the URL, the
optional marker and `{email}` in a message (the contract is
`src/lib/forms/README.md`, the overview [forms.md](forms.md)). Nothing
changes until a form uses them. The tag and the agent files:

```bash
pnpm add agentic-cms@github:HKamkar/agentic-cms#v0.6.1 && pnpm install
pnpm exec agentic-cms init . --agent-files
```

- **The form rule.** `.claude/rules/form-engine.md` gains the new field
  types and the `{email}` token; a site that edited its copy
  (`--agent-files` says `modified`) takes the two changed lines by hand.
- **An unchanged form stays pixel-identical.** A definition that uses
  none of the new options renders the same markup with the new primitives
  as with the old, on either backend, so baselines stay; prove the copy
  below with `visual-parity proof`. One thing reads differently: a `mailto`
  body now shows an option's label where it showed its value (the same text
  when they are equal, as in the example).
- **What a site with its own `src/components/ui/form/` copies from the
  kit** (under `node_modules/agentic-cms/src/components/ui/form/`; a site
  that restyled a primitive keeps its classes and takes the new props):
  - the new primitives: `NumberField.tsx`, `DateField.tsx`, `Select.tsx`,
    `RadioGroup.tsx`, `Checkbox.tsx`, `Choice.tsx`, `FormNote.tsx`,
    `FieldGroup.tsx`, `Hint.tsx`, `Marker.tsx`;
  - the changed ones: `TextField.tsx` (`url`, `minLength`, `pattern`,
    `inputMode`, `autoComplete`, `defaultValue`, the hint), `TextArea.tsx`
    (`rows`, `minLength`), `CheckboxGroup.tsx` (`Choice`, the hint, the
    marker, the defaults), `FieldWrap.tsx` (the hint and the marker) and
    `FieldRow.tsx` (`RowAlign`, which keeps a row's controls level when one
    of them has a hint);
  - in `Form.tsx`: `Items` (rows, notes and groups, and the marker), the new
    `case`s in `Field()`, `usePrefill` with the `ref` on the `<form>`, and
    `readFormValues` from `agentic-cms/forms` in place of the local
    `readValues`, which goes;
  - in `FormShell.tsx`: `Message`, which renders `{email}` through
    `EmailLink` with `messageParts`, and the `messages` prop typed as
    `FormDefinition["messages"]`.
- **A new type waits for its primitive.** A site's `Field()` without the
  type's `case` renders nothing for it — silently — and an endpoint form
  then refuses every submission that leaves a required one empty. Copy a
  type's primitive and its `case` before a definition uses it; `optionalMarker`,
  `hint`, notes, groups and `{email}` likewise need the files above.
- **Code over a definition** sees wider unions: `FormItem` holds notes and
  groups too (read fields with `fieldsOf`, which looks inside groups and
  rows), and `FieldDefinition` switches get the new types; `tsc` names each
  place. The wire format is still version 1.
- **The address in a message.** Write `{email}` in `messages.success` or
  `messages.error` and set `messages.email` (from the server-only module
  that holds the address, on a site that guards it); `withEmailToken`
  encodes it for any backend, and `guard-email` checks the build.

## 0.5.5 → 0.6.0

Forms can deliver: the `endpoint` backend, one route and a sink the site
chooses ([forms.md](forms.md)). Nothing changes until a form switches. The
tag and the agent files:

```bash
pnpm add agentic-cms@github:HKamkar/agentic-cms#v0.6.0 && pnpm install
pnpm exec agentic-cms init . --agent-files
```

- **The form rule.** `.claude/rules/form-engine.md` now covers
  `src/config/form-delivery.ts` and `src/app/api/forms/**` and drops "the
  site is static: backends run in the browser". A site that edited its copy
  (`--agent-files` says `modified`) takes the new paths and lines by hand;
  `AGENTS.md`'s scoped-rules table follows the rule's paths.
- **A `mailto` form is untouched**: same markup, same behaviour, baselines
  stay.
- **Code that reads a backend's fields** narrows first: `FormBackendConfig`
  is a union now, so `definition.backend.to` needs `backend.kind ===
  "mailto"` before it (`tsc` names each place; a test is the usual one).
  `FormBackend.submit` gains an optional third argument; a backend of the
  site's that ignores it needs no change.
- **To deliver through the endpoint**, take from the kit what `init` wrote
  only into new sites (it never overwrites a site's files; the sources are
  under `node_modules/agentic-cms/`):
  - `src/app/api/forms/[id]/route.ts` and `src/config/form-delivery.ts`, as
    they are;
  - the `FORM_WEBHOOK_URL` and `FORM_WEBHOOK_SECRET` lines of
    `.env.example`;
  - in `src/components/ui/form/Form.tsx`: `Trap`, `useShownAt`,
    `readContext`, the `{definition.backend.kind === "endpoint" && <Trap />}`
    line before the submit button and the `.catch` on `backend.submit`. A
    site with a restyled `Form.tsx` keeps its markup and adds these; the
    trap is absolutely placed, so the form's layout does not move (prove it
    with `visual-parity`).

  Then switch the form's backend, set the variables on the host (every
  slot or environment; [deploy.md](deploy.md)), and update the privacy
  notice ([forms.md](forms.md), "Switching a form over"). A site that
  switches before copying `Form.tsx` still delivers, without the spam
  screen.

## 0.5.4 → 0.5.5

Codex finds the rules, and the harness is faster and quieter. The tag and
the agent files:

```bash
pnpm add agentic-cms@github:HKamkar/agentic-cms#v0.5.5 && pnpm install
pnpm exec agentic-cms init . --agent-files
```

- **The scoped-rules table.** `--agent-files` now writes one block into
  the site's `AGENTS.md`: "Scoped rules for Claude Code and Codex", a row
  per rule of the site's `.claude/rules/` as they stand (its own edits
  included), put before the first `##` section and found by its markers
  wherever the site moves it; the rest of the file stays the site's. Codex
  reads `AGENTS.md` and nothing under `.claude/`, so this is how it finds
  the rules. `--check` reports the table `stale` or `missing`, and
  `AGENTS.md` `too big` past the 32 KiB Codex reads by default: a site near
  that moves procedures into linked docs (the table is a few hundred bytes
  a rule).
- **The `design-proof` skill** updates. The site template's `AGENTS.md`
  gained two clauses a site's own takes by hand: `pnpm kit visual-parity
  proof [--motion] [--states]` runs the baseline, the after capture and the
  compare in one; `pnpm kit visual-parity clean` keeps the newest captures
  (`--dry-run` first).
- **Third parties held back.** A capture of a build the harness serves
  holds other origins' scripts and connections (analytics, widgets,
  beacons); their images, fonts and stylesheets still load. A site whose
  look includes a third-party script's drawing — a chat bubble, a consent
  banner from another origin — recaptures its baselines, or captures with
  `--third-party allow` on both sides.
- **Everything else changes no shot:** the scroll-through steps on when the
  page is quiet (the same shots, faster), and `visual-parity proof` and
  `clean` are new. Baselines stay, unless the line above applies.

## 0.5.3 → 0.5.4

Faster captures; nothing a site has to change. Take the tag and the agent
files: the site template's `AGENTS.md` and the `design-proof` and
`design-graphics` skills now say to re-run a jittery motion frame with
`--fresh`, and a site's own `AGENTS.md` (never rewritten) that says to
re-run one takes the same word. What a capture does now:

- **Unchanged shots are reused.** A page-width whose build files are all
  the same bytes as when it was last photographed is copied from
  `.parity/shot-cache/` (gitignored with the rest of `.parity/`): the second
  capture of a proof takes the changed pages alone, and a `--ref` baseline
  taken again is seconds. `--fresh` takes everything again.
- **Several browsers.** `--jobs <n>`; by default every core but one, four at
  most, and two for `--motion`.
- **A template sampled.** `--sample <n>` photographs the first n posts (or
  pages of any dynamic route) and the compare leaves the rest out. Off by
  default.
- **Rules to update by hand.** A site's own `AGENTS.md` that says to run
  captures in the background or to narrow a proof with `--pages` to save
  time can drop that: capture the full set; only a first capture of a
  large site needs the background.
- **The same pixels.** Shots are identical to 0.5.3's, so baselines stay.
  `capture.json` gains `jobs`, `reused` and `timings`; `compare --json`
  read through a pipe now arrives whole.

## 0.5.2 → 0.5.3

A fix, nothing to change beyond the tag. The screenshot harness waited for
nothing before it switched images to `loading="eager"` in motion mode, and
against a dev server React reported that as a hydration mismatch — the
site's error, as far as a console could tell. It now waits until the page
has hydrated, in every mode and in `shot` and `probe`. No shot changes, so
baselines stay. A site on 0.5.1 takes the steps below, which apply to 0.5.3
unchanged.

## 0.5.1 → 0.5.2

What a site changes, in the order worth doing it. Everything not listed
works as before.

### 1. The tag, the install, the agent files

```bash
pnpm add agentic-cms@github:HKamkar/agentic-cms#v0.5.2 && pnpm install
pnpm exec agentic-cms init . --agent-files
```

The design skills update (`design-proof`, `design-options`,
`design-graphics`, `design-icons`). A site that edited its rules keeps them;
the one rule that changed is `.claude/rules/design.md`, whose demo line
now reads:

> A demo route (`src/app/<name>-demo/`, written by `pnpm kit demo new`) and
> everything the round created that the winner does not use go before the
> branch merges (`pnpm kit demo clean`, after promoting the winner;
> `--dry-run` first); the build's SEO audit fails on the route, which is the
> guard. A round's pictures live under `public/images/<name>-demo/`.

The site template's `AGENTS.md` gained these lines; a site adds the ones
that apply to its own:

- **Gotchas:** a Node server host is packaged by `pnpm kit assemble` as the
  build's last step, never by a hand-written `cp` (step 2); after a
  `pnpm build`, a dev server failing every page with `Can't resolve
  '@vercel/turbopack-next/internal/…'` needs `rm -rf .next/dev
  .next/cache/turbopack` and a restart.
- **Parity harness:** "never build, edit `public/` or move assets while a
  capture runs" becomes "a capture photographs a copy of the build, so after
  its `snapshot:` line the tree is free, but build the exact tree you mean
  to prove"; a `reflow` verdict is, per its `cause:` line, a section a
  fraction of a pixel taller, else a stacking context.

### 2. A Node server host: `assemble` in the build

A site on `output: "standalone"` replaces its own copy of `public/` and
`.next/static` into the package with the command, as the last step of its
build:

```json
"build": "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email && agentic-cms assemble",
"assemble": "agentic-cms assemble",
"preview": "pnpm build && HOSTNAME=0.0.0.0 PORT=8000 node .next/standalone/server.js"
```

Keeping an `assemble` script that calls the command keeps a deploy workflow
that runs `pnpm assemble` working unchanged. `agentic-cms assemble --check`
is the check alone, for CI. [deploy.md](deploy.md) is the guide. A site
that reads a `public/` file from server code at build time needs this most:
the file trace then creates the package's `public/` folder, and a copy that
names that folder as its target nests inside it.

### 3. The screenshot harness: recapture, and what reads differently

- **Recapture every baseline** with the new kit on both sides (`capture
  before --ref <base>` rebuilds its baseline with the new harness anyway): a
  static capture writes section geometry beside each shot, a page with an
  inline SMIL animation is photographed at its rest frame, and the motion
  inventory lists inline SMIL loops. A capture from 0.5.1 compared with one
  from 0.5.2 differs for those reasons alone.
- A ref sibling (`../<site>-ref-<sha>`) without the new build stamp is
  rebuilt once, then reused as before.
- A `--ref` baseline of a commit with a demo route now builds: the demo
  routes are removed from the throwaway worktree first. Every capture leaves
  `/…-demo` routes out unless `--pages` names one.
- `compare --pages /a,/b` judges those pages on both sides; a partial
  capture against a full one no longer lists every other page as `MISSING`.
- A `SIZE` or `CHANGED` page shot carries a `cause:` line: the section whose
  height changed, and by how much.
- A note in a site's rules that says to re-run a settled motion frame because
  an inline SVG loop jittered can go: inline SMIL is held now. An animated
  SVG shown through an `<img>` is still out of the harness's reach.

### 4. An inline loop: `InlineAnimation` and `readInlineSvg`

A site that wrote its own component to put a SMIL SVG inline and run its
clock in view moves to the kit's:

```ts
// the section registry: read when the page is built
import { readInlineSvg } from "agentic-cms/content";
"a-section": withData(ASection, () => ({ loop: readInlineSvg("public/images/…/loop.svg", { prefix: "a-section" }) })),

// the section (a client component)
import { InlineAnimation } from "agentic-cms/ix";
<InlineAnimation markup={loop} className="…" />
```

The component plays from the start on each entry into view, pauses off
screen and shows the svg's `data-rest` frame under reduced motion; the svg
fills the box from its own style attribute, so the site's own
`[&_svg]:h-full`-style classes are no longer needed. `readInlineSvg`
prefixes every id, so a site's code that looks the svg up by an id changes
to the prefixed one (a lookup by attribute, `svg[data-duration]`, is
unaffected). `lab render --out x.svg` now keeps `data-duration` and
`data-rest` on the root. Prove the section's pixels unchanged (static and
`--motion`, settled frames).

### 5. The lab, the design round, the sheet

- **`LabTimeline`** drives only what it wraps: the inline SVGs inside it
  and anything under `data-lab-drive`. A timeline wrapped around a whole
  section no longer replays the section's reveals; a candidate whose motion
  is HTML and CSS marks its moving part `data-lab-drive`.
- **`demo clean`** removes everything a round created that nothing else
  uses (a stage, a card face, `public/images/<name>-demo/`), keeps what the
  promoted section imports, and says why; `--dry-run` shows the lists. A
  demo written before 0.5.2 has no manifest and is cleaned as before. Name
  the demo you clean: `demo clean` without a name takes only the routes
  `demo new` wrote.
- **`sheet`** gives every inline SVG its cell's own ids, takes a size and a
  ground (`{ background, color }`) per cell, and a `files:` row shows a
  folder of SVGs at several sizes on several grounds — which replaces a
  preview script of a site's own.
- **`icons round new | publish | retire`** runs a set of the site's own
  icons as a round in the lab (`.parity/lab/rounds/<round>/`, kept by `lab
  clean`) — [icons.md](icons.md) § A round. A site with its own round
  scaffolding can move its next round onto it.

### 6. Verify

```bash
pnpm build && pnpm test && pnpm preview          # a standalone host: the images answer 200 from the package
pnpm kit visual-parity capture before --ref <the commit before the upgrade>
pnpm kit visual-parity capture after
pnpm kit visual-parity compare before after      # the upgrade alone moves no pixel of the site
```

The upgrade itself should move no pixel: the harness changed, not the
site's pages. A difference here is a site change the upgrade carried (step 4
is the only one that touches a page), or a site that relied on something
this release fixed.
