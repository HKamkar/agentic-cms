# Migrating a site from 0.8.1 to 0.8.2

This is for a site on agentic-cms 0.8.1. In 0.8.2 the engines are required:
- every word a reader sees comes from `content/` or `site.ts`;
- the head comes from `kit.seo`;
- forms go through the form engine;
- tags load through consent;
- an address on a page goes through `EmailLink`.

None of the kit example's brand or sample content stays in a site.

A site that kept a bypass or a leftover would fail its CI on the new
release. § 1 writes what the site has now into a **baseline**, so the
upgrade changes nothing a reader sees and CI stays green. After that, each
entry moves onto its engine in a pull request of its own, and the list
only shrinks.

| § | Step | Who | Effort |
|---|---|---|---|
| 1 | Upgrade, and the baseline | every site | an hour |
| 2 | Hard-coded copy into content files, sections onto the library | a site whose baseline holds engine or composition entries | an hour per page |
| 3 | The example's leftovers | a site that kept any of the example | minutes per file |
| 4 | The preferred tier's reasons | a site whose lint warns | minutes per warning |
| 5 | The e-mail key | a site with an address in `site.ts` | an hour |
| 6 | Check | every site | a proof |

## Before you start

- **Start from a clean tree** on a branch off `develop`
  (`chore/agentic-cms-0.8.2`), with `develop` pushed: § 1's proof and the
  baseline's check compare against it.
- **Know what the site runs.** Does `src/config/components.json` exist?
  Does `eslint.config.mjs` spread `componentRules()`? A site that never
  took [0.8.0's § 3.7](migrating-to-0.8.0.md#37-the-component-library-enforced)
  has neither. Its lint never sees the engines, so it takes § 3.7 inside
  § 1 below, before the baseline: the guard's config copied from
  `node_modules/agentic-cms/src/config/components.json` and set to the
  site's layers, `componentRules()` in `eslint.config.mjs`. Its sections
  then meet the composition rules for the first time, and what they break
  goes into the baseline with the rest, so the upgrade stays green.
- **Read § 1 through once.** Its steps go in one pull request, the one
  that takes 0.8.2. That pull request is the only one that may add a
  baseline.

## 1. Upgrade, and the baseline (required)

```bash
# package.json: "agentic-cms": "github:HKamkar/agentic-cms#v0.8.3"
pnpm install
pnpm exec agentic-cms init . --agent-files --check   # what will change, writes nothing
pnpm exec agentic-cms init . --agent-files           # the rules, the skills, the rules table
```

**Pin.** Pin `#v0.8.3`, the first release this guide builds green on
either of its paths: 0.8.2's baseline left out the composition rules, so
a site that takes § 3.7 inside § 1 failed its lint there
([upgrading.md § 0.8.2 → 0.8.3](upgrading.md#082--083)). A site that
runs this guide as a release's gate pins the release commit instead,
`github:HKamkar/agentic-cms#<sha>`, and moves to the tag once it exists.

**The agent files.** `--agent-files` brings each rule's tier line, the
components rule's engines and each skill's closing `pnpm lint`. It
rewrites no more of `AGENTS.md` than its scoped-rules table, so the
engines rule at the top of the site's `AGENTS.md` goes in by hand, from
`node_modules/agentic-cms/templates/site/AGENTS.md`, as
[upgrading.md](upgrading.md) lists. It keeps a file you edited, as
[init.md § After a kit upgrade](init.md#after-a-kit-upgrade) says (`--diff`,
merge, `--accept`). An edited file must keep the lines the kit marks
required (`<!-- required -->`), and `.claude/settings.json` must keep
enabling the editorial plugin. Otherwise `--check` fails it,
`modified, required gone` ([init.md § What an edit keeps](init.md#what-an-edit-keeps)).

**The gates.** `package.json` is the site's own, so put the gates in by hand,
keeping your own steps where they are:

```json
"lint": "eslint; s=$?; agentic-cms check-site || s=1; exit $s",
"build": "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo"
```

0.8.1's build began `agentic-cms lint &&`. That step becomes
`agentic-cms lint --production`, one run and not two. `agentic-cms init .`
merges the two scripts the same way, but it also writes back every file of
the example's code that the site removed. Run it only if you then read
`git status` and delete what it brought back.

In the workflow that runs the lint on pull requests (`.github/workflows/verify.yml`
in a site from `init`; a site's own may also deploy), `fetch-depth: 0`
under the checkout's `with:` gives the site check the history it compares
the exceptions and the baseline against. Without it, CI says it compared
nothing. Its `on.pull_request` takes every branch, as the template's does,
or names each one the site's pull requests go into, `develop` as well as
`main`: a branch it leaves out gets no checks on its pull requests, the
gate's among them, and `check-site` warns of it. The three new action pins
are in [upgrading.md](upgrading.md).

`env: { AGENTIC_CMS_PLACEHOLDERS: warn }` goes on a build step that deploys
nothing. A step that builds and deploys takes none: what it deploys is a
production build, which fails while a placeholder remains, as it should.
An existing site seldom holds one (the content lint names each, § 1's
check below) and replaces it in this pull request. Where its pull requests
must build while one remains, the step sets the variable on those runs
alone: `AGENTIC_CMS_PLACEHOLDERS: ${{ github.event_name == 'pull_request' && 'warn' || '' }}`.

**ESLint reads the guard's config.** The allow list and the baseline are
written once, in `src/config/components.json`. The file that owns a part
the engines keep out of code is named in both files. `eslint.config.mjs`
gets four changes:

```js
import { readFileSync } from "node:fs";
// …
// The preferred rules a file keeps its own choice of, and the baseline the site took 0.8.2 with: written once, in the guard's config.
const { allow = [], baseline = [] } = JSON.parse(readFileSync(new URL("./src/config/components.json", import.meta.url), "utf8"));
// …
  ...componentRules({
    // … the site's layers, as before
    owners: { forms: ["src/components/ui/form/Form.tsx"], images: ["src/components/ui/Media.tsx"] },
    allow,
    baseline,
  }),
// …
  globalIgnores([
    // … the site's own
    // Agent worktrees checked out inside the repo (gitignored): each is a copy of the site.
    ".claude/worktrees/**",
  ]),
```

The last is the template's own. Without it, ESLint lints every agent
worktree's copy of the site as well, and with `componentRules()` that runs
for minutes where the site alone takes seconds.

`src/config/components.json` names the same owners, each with its reason:

```json
"owners": {
  "forms": { "src/components/ui/form/Form.tsx": "the form engine's renderer: the one <form>, posting each definition of src/config/forms.ts through its backend" },
  "images": { "src/components/ui/Media.tsx": "the picture primitive: every <img> a section shows, lazy, or eager through EagerImage above the fold" }
}
```

These are the example's two primitives, which an 0.8.1 site has. A site
that renamed or replaced one names its own file, and a site with a consent
adapter of its own names it under `tags`
([primitives.md § Enforced](primitives.md#the-engines-required-across-src)).
An owner is the engine's own file, never a bypass. Name the owners before
the baseline, or the baseline would hold the form engine itself.

**Write the baseline:**

```bash
pnpm exec agentic-cms check-site --baseline
```

It lints the site as `pnpm lint` does, with no baseline. It writes what
the site holds into the guard's config as `baseline`. The first time, the
whole list: the config has none, or an empty `"baseline": []` the merge
base does not have (a config copied from the package for § 3.7 brings
one). A list the base has, even an empty one, is never written again from
scratch: it only shrinks.

```json
"baseline": [
  { "file": "src/app/layout.tsx", "rule": "agentic-cms/head", "count": 1, "reason": "" },
  { "file": "src/components/ui/Footer.tsx", "rule": "agentic-cms/email", "count": 1, "reason": "" },
  { "file": "src/components/home/Hero.tsx", "rule": "react/forbid-elements", "count": 2, "reason": "" },
  { "file": "content/blog/pages-are-files.md", "rule": "example-content", "count": 1, "reason": "" }
]
```

Each entry is one file, one rule, and how many findings of that rule the
file holds. The command prints every finding under its entry, and says
what it left out. Fill in each `reason` with why the entry is still there
("the launch post, until its successor is written"). The review reads it,
and an empty one is a warning that fails nothing.

| The baseline takes | It never takes |
|---|---|
| the engines' findings: `agentic-cms/copy`, `head`, `forms`, `tags`, `email` | the preferred tier's warnings (§ 4): they stay warnings until each gets a reason or is replaced |
| the composition rules' on a section, a pattern and the layers' imports: `no-restricted-syntax` (a style, an arbitrary value, a visual or motion class), `react/forbid-elements` (a raw element), `react/no-multi-comp` (two components in one file), `no-restricted-imports` (an import against the layers) | a warning of any rule: a baseline holds errors alone |
| `rounds`: a `*-demo` route `demo new` did not write, a round's pictures left behind | the gates (`scripts`, `ci`), the config's own passes (`preset`, `owners`, `allow`, `routes`' reasons, `inherited`), an inline disable of a required rule without its reason (`disables`): each is fixed in this pull request |
| the example's leftovers: `example-brand` (its name, domain or author in a line) and `example-content` (its posts, catalogue pages, pictures and collection entries) | a placeholder (`(placeholder)`, or an address on a domain reserved for examples): a production build fails on it, so the site writes its own |

`--baseline` exits 1 while something it does not take is left, and names
each one with its fix. The usual ones:
- a gate missing from `package.json` (above);
- an inline `eslint-disable` that turns off every rule with no reason
  after `--`;
- an `ignores` glob added without its `$ignores` reason.

Fix them and run it again. Running it again changes nothing that is
already written.

**The baseline from here on.** It only shrinks.
- **This pull request** is the one that adds the list: `check-site`
  lists each entry as added since the merge base.
- **Later pull requests** can't add an entry or raise a count: the site
  check fails either against the merge base.
- **In a baselined file**, an engine or a composition rule stays quiet
  while the file holds no more than its count. One more, and every
  finding of that rule in the file fails, with a line on the count.
  Fewer, and the rule asks for the entry to shrink, so a fixed finding
  can't make room for a new one. `check-site --baseline` shrinks the list
  to what is left, and never grows it.
- **A file the baseline does not list**, a new one above all, meets every
  rule in full.
- **A site laid out by `init` 0.8.2** starts with `"baseline": []` and
  takes nothing.

**Check:**
- `pnpm lint`, `pnpm test` and `pnpm build` pass.
- `pnpm exec agentic-cms init . --agent-files --check` is clean.
- The baseline is committed with the upgrade.
- A proof against `develop` is identical: the baseline changes no page.

```bash
pnpm kit visual-parity proof migrate --ref develop --build --all-pages
```

## 2. Hard-coded copy into content files

**Why:** a word written in code can't be edited as a file, linted against
`content/VOICE.md`, or audited, and a design round designs around it. Each
engine entry in the baseline is a part of the site the kit can't check yet.

**Do,** one page, or one entry, per pull request, each proven before the
next:
1. **See what the entry holds.** Take the entry out of `baseline`, or
   lower its count, and run `pnpm lint`. ESLint names each finding with
   the place it goes.
2. **Move each finding onto its engine, or the library:**
   - **Copy in a section** goes to a field of the page's file,
     `content/pages/<slug>.yaml`, with its schema in
     `src/components/sections/schemas.ts`, and reaches the component as
     a prop.
   - **Copy in a primitive** comes in as props from the section that uses
     it.
   - **Copy in a layout, the chrome or `not-found`** goes in `site.ts`'s
     chrome.
   - **A route with its copy inside** becomes a page file: [0.8.0's § 3.9,
     Pages as content files](migrating-to-0.8.0.md#39-pages-as-content-files),
     step by step.
   - **A head:** the root layout's `metadata` is `kit.seo.rootMetadata()`,
     a page's comes from its file's `seo` block, and a round's route uses
     `unlistedMetadata()` ([the SEO contract](../src/lib/seo/README.md)).
   - **A form** is a definition in `src/config/forms.ts` that `Form`
     renders ([forms.md](forms.md)).
   - **A tag** loads through its consent adapter, `GoogleTag` for
     Google's ([consent.md](consent.md)).
   - **An address** is `<EmailLink token={encodeEmail(address)} />`
     ([email.md](email.md)).
   - **A section the composition rules fail** is rebuilt from the
     library: `Heading`, `TextLink`, `Button` and `Media` for its raw
     elements, a token in `globals.css` for a value the scale lacks, a
     variant of a primitive for a look of its own, and a second component
     in the file moved to `ui/` with its catalogue entry
     ([the components rule](../templates/site/rules/components.md)).
3. **Shrink the list** with `pnpm exec agentic-cms check-site --baseline`:
   the entry is gone, or holds what is left.
4. **Prove the page against the commit before,** then commit the move
   and the shrunk list together:

   ```bash
   pnpm kit visual-parity proof copy-<slug> --ref HEAD --pages /<path> --build
   ```

A change that touches the chrome or a primitive reaches every page: prove
it with one page per template (the design-proof skill says how), not one
page alone.

**Check:** the proof is identical, `pnpm lint` passes, and the entry is
gone or lower.

## 3. The example's leftovers

**Why:** up to 0.8.1, `init` copied the example's content and pictures into
every new site: Acme's brand, three posts about the kit, its author, its
reviews, use cases and FAQ set, the `/sections/*` catalogue pages, its
logo. Design rounds read a page's copy, so a round designs around what it
finds. 0.8.2 lays a new site out from a starter of its own, and the site
check lists what is left of the example in an existing one.

**What `check-site` finds** (its `leftovers` pass; the list of everything
the example shipped from 0.2.0 to 0.8.1 is in the package):

| Rule | Finds | By |
|---|---|---|
| `example-brand` | `Acme` as a word, `acme.example`, the author `acme-editorial`, under `content/` and `src/config/`, in an SVG's text, in a picture's name. A site named Acme keeps its name | line, or the file's name. The content lint fails the same lines in the build |
| `example-content` | the example's posts and catalogue pages | their path, whatever the site made of them |
| | a picture, a post, a page or a collection file the example shipped | its bytes, under any name |
| | a review, a use case, an FAQ or the author the example shipped, among the site's own | the entry's content |

The kit's own docs and templates under `content/` (`README.md`, `VOICE.md`,
`_templates/`, `editorial/`) are no leftovers, and neither are the
categories. The brand rule still reads them. The kit's brand-neutral
copies are in `node_modules/agentic-cms/content/`; a site's voice file
starts from its `_templates/VOICE.md`, with the site's name in place of
the example's.

**Do,** a few files per pull request:
- **The site's own replaces each one.** For a post, that is
  `/editorial:write-post` or `/editorial:new-post`; for a page's copy,
  `/editorial:new-page`. Or delete it.
- **A post at a live URL is retired, never just deleted.**
  `/editorial:retire-content` makes it a draft, and its URL stays
  indexed. A catalogue page that is live goes with a redirect. Its
  pictures go with it: the content lint's `image-orphan` names a picture
  folder whose post is gone.
- **The logo, the author's portrait and the review pictures** are the
  site's own, or `pnpm kit placeholder` stand-ins until they are.
- **Shrink the list after each:** `pnpm exec agentic-cms check-site
  --baseline`. A leftover the site keeps on purpose keeps its entry, with
  its reason.

**Check:** `pnpm lint` and `pnpm build` pass. The proof shows only the
pages whose copy changed, and the owner looks at them on the dev server
(`pnpm kit serve`).

## 4. The preferred tier's reasons

**Why:** everything that is not an engine is preferred. A site may use its
own motion library, canvas, graphics tool or script. The kit names its own
part, and the site keeps its choice with one line of reason, which the
review reads. Without a reason, the warning stays in the lint's output.
A warning never fails the build, and a baseline never holds one.

**Do,** for each warning `pnpm lint` prints:
- **Take the kit's part** the warning names:
  - `agentic-cms/ix` for motion;
  - the lab for graphics;
  - `Media` and `EagerImage` for pictures;
  - `Icon` for icons;
  - the tokens for styling;
  - `agentic-cms shot`, `probe`, `sheet`, `visual-parity` and `serve`
    for a script of your own.
- **Or keep your own, with its reason,** as an `allow` entry in
  `src/config/components.json`. `eslint.config.mjs` reads it (§ 1):

  ```json
  "allow": [
    { "rule": "agentic-cms/icons", "files": ["src/components/ui/Placeholder.tsx"], "reason": "the wireframe's crossed box: two lines stretched to any ratio, which no icon draws" },
    { "rule": "agentic-cms/styling", "files": ["src/components/ui/form/Form.tsx"], "reason": "the honeypot sits far off-screen, where a bot fills it and a reader never sees it: an offset no token names" },
    { "rule": "agentic-cms/site-tools", "files": ["scripts/og-cards.mjs"], "reason": "renders the OG cards from the posts' titles, which no kit command composes" }
  ]
  ```

  The first two are the example's own primitives, which a new site's
  config carries for the same reasons.
- **Or keep one line, with its description:**
  `// eslint-disable-next-line agentic-cms/<rule> -- <why>`.

The preferred rules and what each names are in
[parts.md](parts.md) and [primitives.md § The rest, guided](primitives.md#the-rest-guided-across-src).

**Check:** `pnpm lint` prints no warning without its reason. The allow
entries and disables this branch adds are listed with their reasons under
"The exceptions added since".

## 5. The e-mail key

**Why:** an address that a page, a payload or a bundle carries as text is
harvested. Job 4b of the 0.8.2 plan puts the e-mail engine behind one key
in `src/config/site.ts`, `guardEmail`. `init` writes it on for a new site.
For an existing site nothing changes until its owner adds it: without the
key, the structured data, the pages and the bundles stay byte for byte as
they were, and nothing asks for the guard.

**What turning it on changes** ([email.md § The key](email.md#the-key--guardemail)):
- No structured data carries the address as text. A `ContactPoint` with
  the contact page's URL takes its place.
- No `"use client"` module imports `site.ts`. Each one takes what it shows
  as props from the server component that renders it.
- A form's message and recipient are tokens, through `withEmailToken()`.
- The build ends with `agentic-cms guard-email`, which `check-site` asks
  for while it is missing.

**Do,** in one pull request of its own:
1. Add `guardEmail: true` in `site.ts`, beside `email`.
2. Take the steps [upgrading.md](upgrading.md)'s e-mail paragraph lists.
3. Add `&& agentic-cms guard-email` last in the `build`.
4. Run `pnpm build`. The guard names each served file that still carries
   the address, and its fix.

A site whose address is public on purpose says so instead, with
`guardEmail: { off: "<why>" }`. `check-site` lists it with its reason once
it is added.

**Check:** `pnpm build` passes with the guard last. The proof is identical
in pixels: only the structured data and the bundles move.

## 6. Check

- The verify block passes, with 0 failures: `pnpm lint`, `pnpm test`,
  `pnpm content:lint` and `pnpm build`.
- `pnpm exec agentic-cms init . --agent-files --check` is clean.
- `pnpm exec agentic-cms check-site --baseline` changes nothing: the
  committed list is what the site holds.
- The proof on every page is identical, except for the copy and the
  leftovers you chose to change and committed apart (§§ 2–3):

  ```bash
  pnpm kit visual-parity proof migrate --ref develop --build --all-pages
  ```

- The owner looks on the dev server (`pnpm kit serve`), then merges.

The release's gate is § 1 on each site, with CI green and the proof
identical. §§ 2–5 follow, one pull request at a time, as each site's own
work.

## Two paths, worked

- **A site whose pages were hand-written.** Its routes
  (`src/app/<page>/page.tsx`) hold their copy and their head.
  - *§ 1:* if the site never took
    [0.8.0's § 3.7](migrating-to-0.8.0.md#37-the-component-library-enforced),
    take it inside § 1. List every existing component under `inherited`,
    and each hand-written route folder under `exceptions` with its reason
    ("a hand-written page, until it is a content file"). Then the
    baseline: an `agentic-cms/copy` and an `agentic-cms/head` entry per
    route, the composition rules' entries for each section they fail, an
    `example-content` entry for anything kept from the example.
  - *§ 2:* one page per pull request, by 0.8.0's § 3.9. The route's
    folder leaves `src/app/`, its exception leaves `exceptions`, its
    entries leave the baseline, and its proof is identical.
  - *Then:* § 3 for the example's leftovers, § 4, § 5 when the owner wants
    it, and § 6.
- **A site already on the content engine.** Its pages are files.
  - *§ 1:* the engines' entries are few. Typically the baseline holds the
    root layout's hand-written head, a `mailto:` in the footer, a line of
    copy in a primitive, and whatever the site kept of the example. A site
    that takes 0.8.0's § 3.7 inside § 1 adds what its sections break of
    the composition rules: a raw element, a style, an arbitrary value, two
    components in a file, often the longest part of the list.
  - *§ 2:* the head becomes `kit.seo.rootMetadata()`, the link
    `EmailLink`, the copy `site.ts`'s chrome or a prop, and each section
    the composition rules fail is rebuilt from the library, each proven
    identical.
  - *Then:* § 3, which is most of the work for such a site, § 4, § 5 and
    § 6.

## When something fails

| Symptom | Do this |
|---|---|
| `check-site: no src/config/components.json here` | The site never took 0.8.0's § 3.7: take it first (§ 1, "Know what the site runs") |
| `pnpm lint` fails on every finding of a baselined file, and the guard's `preset` says ESLint is told none | `eslint.config.mjs` doesn't pass `baseline` to `componentRules()`: § 1's four changes |
| After § 3.7, `pnpm lint` fails hundreds of `no-restricted-syntax`, `react/forbid-elements`, `react/no-multi-comp` or `no-restricted-imports` errors in sections | The composition findings a site already had: `check-site --baseline` writes them with the rest. Never an `ignores` glob, which turns the engines off in those files too, nor an inline disable in each |
| The guard's `preset` says no processor holds a composition rule's count | A block after `componentRules()` sets a processor of its own on the file: move it before the preset |
| `--baseline` refuses every entry, each `the baseline holds 0 (no entry)` | The list is empty and the merge base has one too (a site from `init`), or there is no base to compare: the report says which. `--base <branch>` names the branch the pull request goes into |
| ESLint runs for minutes | It lints the agent worktrees' copies of the site: `.claude/worktrees/**` in `globalIgnores` (§ 1) |
| `check-site` warns the workflow that runs the lint runs on none into a branch | Its `on.pull_request.branches` leaves out a branch the site's pull requests go into: add it, or drop the filter (§ 1) |
| `agentic-cms/forms` on `ui/form/Form.tsx`, or `--baseline` writes an entry for it | Name the owners (§ 1) before the baseline: the form renderer is the engine itself. Then `--baseline` again; the entry goes |
| `N of this rule here, and the baseline … holds M` | A new finding in a baselined file: move it onto its engine (§ 2). The baseline never takes a new one |
| `The baseline … holds M of this rule here and N are left` | A bypass was fixed: `check-site --baseline` shrinks the entry, in the same pull request |
| `added to the baseline (…) since <base>: the baseline only shrinks` | An entry was added or raised after the pull request that took 0.8.2: take it back out and move the finding onto its engine |
| `--baseline` refuses an entry | Same: the list only shrinks. It wrote the rest |
| A production build fails on `placeholder` | An address on a domain reserved for examples (`.example`, `.test`, …), or a `(placeholder)` string: write the site's own. A build that deploys nothing may run with `AGENTIC_CMS_PLACEHOLDERS=warn`; one that deploys, on its pull-request runs alone (§ 1) |
| `init --agent-files --diff <file> \| git apply` answers `patch does not apply` | The site reworded lines the kit's change touches: merge the hunks by hand, keeping each required block's words, then `--accept <file>` ([init.md § After a kit upgrade](init.md#after-a-kit-upgrade)) |
| The proof differs after § 1 | A kit bug: open an issue with the compare's `cause:` line; don't adjust the site |
