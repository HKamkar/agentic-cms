# Changelog

Every release of `agentic-cms`, newest first; a pull request adds its lines
under Unreleased, and the release commit renames that heading. A line that
changes what a capture writes says **recapture baselines**.

## [Unreleased]

- Docs: `docs/roadmap-0.8.2.md` is the plan for 0.8.2. The engines are enforced: content, SEO, forms, consent and e-mail fail the lint when bypassed, design rounds included. The kit's libraries and tools are preferred: a warning names the part, and a reason keeps a site's own. A new site starts without the example's brand or content. Every part goes on one map (`docs/parts.md`), and the README and every doc are swept. `docs/roadmap-0.9.0.md` now follows it.
- `init --name "<Site>"`, `--url`, `--email`: a new site starts from a starter of its own name instead of the example. It gets one home page and the blog index with copy marked `(placeholder)`, empty collections, the wireframe's neutral pictures and a logo placeholder. It gets none of the example's brand, posts, reviews, use cases, FAQs, author or catalogue pages, and the package no longer ships them.
- The content lint: `placeholder` WARNs on the starter's marker and on addresses on reserved domains, and FAILs with `--production`, which a new site's `pnpm build` passes (`AGENTIC_CMS_PLACEHOLDERS=warn` keeps them warnings in a build that deploys nothing: the site's CI, `setup --build`). `example-brand` FAILs on the kit example's brand in a site at any time.
- `agentic-cms assemble` packages nothing while a placeholder remains.
- `demo new` names a page's placeholder copy and any of the example's brand before it writes a round. The `design` skill gets the copy first, and `/editorial:new-page` writes a page's real copy.
- `init --force` never overwrites a site's own `content/`, `public/`, `src/config/site.ts` or `src/config/forms.ts`. The starter's content goes only into a site with no `content/`.
- CI: the kit's workflow moves to `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0 and `pnpm/action-setup` v6.1.0, each still pinned to a commit (#92).
- `agentic-cms init` requires `--name "<Site>"` for a new site: without it, or with an empty one, `init` exits 2 and writes nothing. The folder's name is no longer used as the site's. Nothing changes for an existing site: `init` on a site that has `content/` asks for no name and writes none of the site's own files.
- CI: the workflow `init` writes into a site moves to the kit's pins, `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0 and `pnpm/action-setup` v6.1.0 (the first to state pnpm 12 support). An existing site copies the three `uses:` lines from `node_modules/agentic-cms/templates/site/verify.yml` (`docs/upgrading.md`).
- Tests: `tools/template-ci.test.mjs` fails when the site template pins an action to another commit than the kit's own workflow does, so a Dependabot bump of the kit's pins fails CI until the template follows.
- `docs/parts.md`: every part of the kit on one map in four layers (the content engine, the browser libraries, the design tools, the site's commands). Each row gives the need, the part and how to use it, its tier (required for the engines, preferred for the rest), the check that holds it and its exception key, and the page ends with every check the kit runs. `tools/parts-doc.mjs` keeps it complete in `pnpm hygiene` and the tests: every export, command and rule must be on it.
- The command families follow the layers. `agentic-cms --help` and `docs/commands.md` group them under the content engine, the design tools and the site's commands, from one list in `scripts/lib/specs.mjs`. "build gates" splits into `default gates` (`seo`, `check-components`) and `opt-in steps` (`guard-email`, `critical-css`, `assemble`).
- One content engine with its layers: the blog engine is now the post pipeline in its README, its rule and the docs. `docs/primitives.md`, `docs/gotchas.md` and `docs/design.md` point to the map, and `docs/README.md`'s index is grouped by the layers.
- `agentic-cms/eslint`: the engines are required across `src/`, design-round (`*-demo`) and `lab-demo` routes included. `componentRules()` sets five rules of its own ESLint plugin, each message naming the engine and its doc:
  - `agentic-cms/copy`: JSX text, the copy props (now also `heading`, `eyebrow`, `text`, `body`, `description`, `caption` and the reader-facing `aria-*`) and data fields or defaults of those names, and any other prop of a component whose string reads as words, except the props the rule skips (`docs/primitives.md` § Enforced lists them). Before, only sections and patterns were checked, and only six props.
  - `agentic-cms/head`: no `<head>`, `<title>`, `<meta>`, canonical `<link>`, JSON-LD `<script>` or `next/head` of a site's own; `metadata` and `generateMetadata` return a `kit.seo` helper.
  - `agentic-cms/forms`: a `<form>` only in the files `owners.forms` names, no server action, no `fetch()` of another origin in a component.
  - `agentic-cms/tags`: `next/script` and a `<script src>` of another origin only in the consent adapter `owners.tags` names.
  - `agentic-cms/email`: no `mailto:` link built in code; `EmailLink` instead.
  The copy rule is required: `copy: false` throws, and it gains `copy.skip` and `copy.tools` (the design tools' modules, `agentic-cms/lab` by default, whose components' props are no copy).
- `src/config/components.json` and `componentRules()` take `owners: { forms, tags }`, the files that own a `<form>` or a tag, each with its reason.
- `agentic-cms check-components` holds the preset:
  - its new `preset` pass reads ESLint's resolved config for a sample file per layer, and fails a required rule that a later block replaced, or that is off, a warning, unset, ignored, or set with other options than what `componentRules()` makes of `components.json`;
  - `disables` fails an inline disable of a required rule, or of every rule, with no reason after `--`, and the report lists each reason (`--json`: `disables`);
  - `owners` fails an owner with no reason or no file.
- `kit.seo.rootMetadata()`, the root layout's head, and `kit.seo.unlistedMetadata()`, noindex for a design round's or the lab's route (also exported from `agentic-cms/seo`); `SiteConfig.ogLocale` is optional and gives `og:locale`. The example's layout, `demo new`'s routes and the lab route's template use them.
- The example's footer and contact details render their addresses through `EmailLink`. Pixels are unchanged, and the address leaves the served HTML.
- `demo new`: a block's chip is `aria-hidden`, and a showcase's copy comes from a content file. `agentic-cms/lab`: `LabScenes`' `grounds` is optional and defaults to `LAB_GROUNDS` (the page, a white card), and the lab route's template passes none.
- `init` leaves the kit's ignore of `src/lib` out of a site's `eslint.config.mjs` and `components.json`: a site's `src/lib` is its own, and linted.
- The engines rule in both `AGENTS.md`, always loaded: the engines are required; for everything else, find the kit's part in `docs/parts.md` and prefer it, with one line of reason for a site's own; never weaken a check to pass it.
- Each scoped rule, the kit's and a site's, ends with its tier line: its part, its tier and the check that holds it, with the rule ids.
- The design skills and `setup` end their procedures with `pnpm lint`. The design skills start a round from the page's content file and never write copy into a candidate. The editorial skills that change a file end with the same verify line.
- `init --agent-files --check` fails a site's edit of a rule or a skill that dropped a block the kit marks `<!-- required -->` (`modified, required gone`, naming the block, its line and the kit's file), and a `.claude/settings.json` that no longer names the kit's marketplace or enables the editorial plugin. A refresh writes the settings only when they are missing.
- Fixed: `pnpm test:pack`'s consent probe no longer fails one run in many. It stored a choice stamped after `readChoice` had read its clock, so a millisecond apart the choice was from the future and refused (`answered 0: undefined …`); it now stores one a second old.
- `agentic-cms/eslint`: the preferred tier warns across `src/` and never fails the build. `agentic-cms/motion` (another animation library, a `requestAnimationFrame` loop, an `IntersectionObserver`, `el.animate()`, a transition class or style outside the motion layer), `agentic-cms/graphics` (a rendering library, a `<canvas>`), `agentic-cms/images` (`next/image`, an eager `<img>` in a server component), `agentic-cms/icons` (an `<svg>` outside `Icon`) and `agentic-cms/styling` (an arbitrary value or breakpoint, a style colour outside the tokens, outside the sections and patterns) each name the kit's part and its doc. A site keeps its own choice with one reason line: an `allow` entry in `src/config/components.json` or an inline disable with its description.
- `src/config/components.json` and `componentRules()` take `allow: [{ rule, files, reason }]`; `componentRules()` refuses an entry with a required rule or no reason. `owners` also takes `images`, `icons` and `motion`.
- `agentic-cms check-components`: an `allow` pass, and warnings that fail nothing: a transition or animation declared in CSS outside the motion layer (`transitions`), an inline disable of a non-required rule with no reason, and a preferred rule a later block turned off. The JSON report has `allowed` and `warnings`.
- The example: `Placeholder`'s `<svg>` and the honeypot's offset are kept in `allow`, `Media` owns its `<img>`, and the footer's grid is the token `--grid-template-columns-2-1-1` (pixel-identical). A new site lints with no warning.
- `agentic-cms check-site`: every pass of `check-components`, then the site's own.
  - `rounds`: a hand-made `*-demo` route, and a round's pictures left after `demo clean`.
  - `exceptions`: every exception added since the merge base listed with its reason, and `inherited` only shrinking.
  - `scripts` and `ci`: the gates in `package.json` and in CI.
  - `tools` (warnings): a site's own Playwright, `sharp` or `next dev` script, or a machine's address in `next.config.*`, each quieted by an `allow` entry of `agentic-cms/site-tools` with its reason.
- `init` writes the gates: `lint` runs ESLint, then `check-site`, and `build` runs `pnpm lint` first. Into an existing `package.json` they are merged, or `init` refuses before writing anything, naming what to add.
- `init` writes `.github/dependabot.yml` for the CI's actions (monthly, one grouped pull request), and `verify.yml` checks out the history `check-site` compares against. An existing site may copy both from `node_modules/agentic-cms/templates/site/`.
- `guard-email` stays opt-in until 0.8.2 job 4b; its gate waits in `scripts/lib/gates.mjs` behind one switch.
- The kit's own `pnpm lint` runs `check-site`, and its `pnpm build` runs `pnpm lint` first.
- pack-smoke lays a fixture of every bypass in the 0.8.2 survey over the fresh site: required ones fail with their messages, preferred ones warn.

## [0.8.1] — 2026-10-17

- Docs: `docs/migrating-to-0.8.0.md` § 3.5's heading loses the job marker the release commit missed.
- `init --agent-files`: a rule or skill that a site wrote before `.agentic-cms.json` recorded its base is measured against the kit's text at the version the site was on: the manifest's `version`, else the last other version its `package.json` named in git. It is `modified`, noted "no base: kit unchanged since 0.7.6", when the kit's text has not changed since. It is `modified, kit changed` with that text as its base when it has, and `--diff` then prints the kit's change alone. It is `stale` when it is a release's text untouched. The refresh and `--accept` record the base. Before, every such file was `modified, kit changed`, and `--diff` printed the site's whole file against the kit's as if it were the kit's change. Where no release is known as the file's source, `--diff` now says plainly that it is the site's whole file and must not be applied whole. The package carries every release's text of every agent file for this (`scripts/lib/agent-file-releases.json`, written from the tags by `pnpm agent-files:releases` and checked by `pnpm hygiene`; a release commit rewrites it). `docs/init.md` and `docs/migrating-to-0.8.0.md` § 1 say that only a `--diff` from a base goes into a copy whole.
- The `design` skill and the design rule `init` writes put a section's cards inside the site's card frame where it has one (`ui/Panel` on a site that has the example's), no longer in "the site's one card frame", which a site whose cards are each section's own design does not have.
- `agentic-cms/eslint`: `componentRules()` takes `restrictedImports` (`{ paths, patterns }`, in `no-restricted-imports`' object form), a site's own import restrictions. It adds them to every `no-restricted-imports` setting the preset writes, so they hold wherever the kit's do and the kit's stay in force. Before, a site's own `no-restricted-imports` block over the component folders replaced the preset's setting for those files (flat config keeps the last block's), so they silently lost the layer and animation bans. A malformed value throws. `docs/primitives.md` § Enforced describes the trap, and `docs/migrating-to-0.8.0.md` § 3.7 step 2 points to the option.
- `agentic-cms/eslint`: the copy rule passes the JSX children of a primitive named in `copy.decorations`, as it already passed its props. Before, a decoration that takes its text as children and draws it `aria-hidden` failed with "No copy in a section or a pattern". The message now says "the props and children of".
- Docs: `docs/migrating-to-0.8.0.md` § 1 says how to read a `--motion` mid-flight frame that differs on every take after the upgrade. 0.8.0's `"sideEffects": ["*.css"]` re-splits a site's client chunks. Where the step's settled frame is identical and the same frame is identical build against itself, the difference is the bundle, accepted on the owner's look; a settled frame that differs is still a kit bug. § 2's Watch list names the re-split.
- `init`: a base keeps its copy in `.agentic-cms/base/` while the site's text differs from it, or while no release of the kit holds its text (a pin between releases). A file `init` writes and the site edits before committing it therefore keeps its base, and a later `--diff` prints the kit's change alone with nothing committed first. Before, the text of such a base was lost until `--accept`. `docs/migrating-to-0.8.0.md` § 3.7 step 4 says so for the components rule.
- The styling rule `init` writes and the `design` skill say motion is the layer the site has: a motion folder of the site's own while it keeps one, otherwise `agentic-cms/ix`. The `setup` skill takes `scripts/setup.sh` and its flags only where it is the kit's script. Before, these § 1 lines were untrue on a site with its own motion folder and setup script until it took § 3.5 and § 3.2.
- Docs: `docs/migrating-to-0.8.0.md` § 3.5 names the two shapes a site's own play-once layer can take onto the kit's. Either its motion folder stays as a layer that re-exports `agentic-cms/ix` (`motion: "<folder>"` at § 3.7, which step 2 now says), or the folder is deleted and every consumer imports `agentic-cms/ix` (`motion: null`, taken together with § 3.7). It also says what to check before any route renders a play-once root: the arming, with `probe / --select 'html[data-motion="on"]' --motion`.
- `visual-parity proof` retakes each static shot and `--motion` frame that differs once on each side, fresh and with the same seed, before the pass reports. A difference that does not reproduce is `FLAKY`, and the jittered shot leaves the shot cache. A difference that lies only where the shot also differs between two takes of one build (a canvas, a loop, a spring still moving) gets the new status `UNSTABLE`, with the region named. A difference that reproduces says so in its cause. A frame's cause no longer claims that a settled frame never jitters. Both statuses still exit 1.
- `visual-parity capture --no-cache` takes every shot and stores none. `compare --retake-before` / `--retake-after` judge a compare against such retakes and refuse a retake of another build, scheme, mode or seed. A bare compare lists the shots no retake judged (`unretaken`). `meta.json` records the build id and whether the capture was fresh, so a capture taken before 0.8.1 cannot stand as a retake's side. The compare summary counts `unstable`.
- `visual-parity proof --all-pages` proves every page, whatever the profile's `proof.pages` or `proof.sample` say. Use it for a change that reaches every template, such as a kit upgrade. The migration guide's § 1 check now runs with it.
- `probe` takes `--json`, as its help said and every command that prints JSON does; the flag changes nothing. A spec test holds the contract for every command.
- `pnpm urls` and `scripts/setup.sh` name `pnpm kit serve` in place of `pnpm dev` when the dev port has no server, or has another checkout's.
- Docs: the migration guide's § 1 check runs as three proofs (static, `--states`, `--motion`) on every page, the same coverage as one `--all` proof without its length. § 5 runs those three passes on every page too, and says that a bare proof covers only the profile's pages.

## [0.8.0] — 2026-10-17

- `docs/roadmap.md` is the 0.8.0 plan — a new site in minutes: ten jobs,
  the release and what comes after it, toward 1.0.0 — in place of the
  0.4.0 roadmap, whose open items it carries under Later.
  `docs/migrating-to-0.8.0.md` is the draft of the guide a site on 0.7.6
  follows, filled in as each job lands.
- The know-how a site used to bring in mid-build is in the kit, in five
  new guides: `docs/setup.md` (a fresh clone on a new machine, and what to
  do when a step fails), `docs/dev-server.md` (serving previews to the
  owner's devices: the ports, which address, `ALLOWED_DEV_ORIGINS`,
  stopping a server), `docs/browsers.md` (what headless Chromium,
  headless WebKit and the owner's Safari each check, what headless cannot
  show, the engines' differences), `docs/primitives.md` (what a new site
  builds first, against what the example has) and `docs/gotchas.md` (the
  traps by topic). `docs/deploy.md` adds Cloudflare Workers, Google Cloud
  Run and Azure App Service; `docs/design.md` § Handing over and merging;
  `docs/lab.md` a phone drawing for a chart; `docs/consent.md` GA4's late
  event after a Reject. The agent files carry the practice: rejected
  candidates are deleted, never archived (`design-options`, the design
  rule); a proof is as short as the change allows, in place of "capture
  the full set" (`design-proof`, `docs/visual-parity.md`); the site is
  measured at its widths (the styling rule); a new site's `AGENTS.md`
  points at the five guides, and a site on 0.7.6 adds those lines by hand
  (`docs/migrating-to-0.8.0.md` § 1, § 3.8).
- `visual-parity proof --build` builds the tree before its first after
  capture, as documented. It exited 2 on every call ("three sources of one
  build"): the capture's guard against `--url`, `--build` and `--ref`
  together ran for `proof` too, whose `--ref` always has a value. `proof`
  with both `--pages` and `--sample` is refused before any capture starts.
- A `--ref` baseline is built with the tree's `.env.local`, copied into its
  sibling worktree: the file is gitignored, so the checkout had none, and a
  build-time value could differ between the two sides of a proof. The
  sibling's stamp keeps a digest of the file, never its values; a sibling
  built with another `.env.local`, or before this change, is rebuilt rather
  than reused.
- Docs: `lab clean --help` and `docs/commands.md` show its current summary
  (the spec had two, and the older one won); `STANDARD.md` §5 and §7 and the
  components catalogue list `useReveal`, `EASE` and `fillBox` of
  `agentic-cms/ix`; the workspace snippet in `docs/init.md` and the README
  has `unrs-resolver: true`, as `init` writes it; `src/styles/motion.css`
  names the library `agentic-cms/ix`.
- The lab timeline (`mountTimeline`, `LabTimeline`) keeps play-once motion
  on its range. An animation it has driven stays after it ends, where a
  finished CSS animation whose fill is `none` or `backwards` used to leave
  `getAnimations()` and the range moved over a frozen end pose; its fill is
  pinned to `both` under the timeline only, so a page without one keeps
  `backwards`. Motion that starts after the timeline mounts (an observer
  sets the attribute that plays it) is found on the next frame, through a
  `MutationObserver` and `animationstart`: it joins the timeline's time,
  the cycle is measured again and only grows, and a timeline that had
  nothing to drive turns its controls on and plays. `lab render`'s clock
  keeps finished animations the same way, and `InlineAnimation` leaves its
  clock to a timeline it sits under. `docs/lab.md` § Inspecting motion
  states the contract: motion of a site's own plays at once under
  `[data-lab-timeline]`. A site's own fill override under the timeline can
  go (`docs/migrating-to-0.8.0.md` § 4). CI's browser job installs WebKit
  too, so the timeline's two-engine tests run there.
- A site starts in one line, `pnpm dlx
  --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git
  agentic-cms@github:HKamkar/agentic-cms#v<x.y.z> init my-site`, in place of
  `pnpm init`, a hand-written workspace, `pnpm add` and `init .`
  (`docs/init.md`, the README). The build approval is the dependency's git
  URL: `--allow-build=agentic-cms` alone does not match a git-hosted
  package.
- `init` merges an existing `pnpm-workspace.yaml` instead of keeping it:
  the `allowBuilds` keys it lacks are added (a workspace from the old docs
  had no `unrs-resolver`, and the install after `init` stopped at
  `ERR_PNPM_IGNORED_BUILDS`), the names of a legacy `onlyBuiltDependencies`
  list, which pnpm no longer reads, are carried into it, and the site's own
  keys, values and comments stay. The file is written only on a change and
  reported `merged`; `--force` merges too.
- `init` replaces `pnpm init`'s placeholders in an existing `package.json`:
  its failing `test` script gives way to the kit's (a real test script of
  the site's is kept) and its `main: "index.js"` is dropped; its `license`,
  `version`, `devEngines` and `packageManager` stay.
- `init` writes the site's CI, `.github/workflows/verify.yml` (kept when
  present): install, lint, test, build and
  `init . --agent-files --check` on every pull request and every push to
  `develop` or `main`, with pnpm from `packageManager`, Node from `.nvmrc`
  and every action pinned to a commit. A site on 0.7.6 copies it from
  `templates/site/verify.yml` (`docs/migrating-to-0.8.0.md` § 3.3).
- `init`'s next-steps line drops its `cd .` when the site is the current
  folder.
- `pnpm test:pack` runs `docs/init.md`'s install line as written (the
  tarball for the git spec), in a folder holding what the old docs left
  there, and runs the scratch site's lint and tests after its build. Its
  install retries once without `--prefer-offline` when pnpm's cached
  metadata predates a published version (`ERR_PNPM_NO_MATCHING_VERSION`):
  the online install refreshes that metadata, so no one clears the
  machine's cache to get past it.
- `agentic-cms/ix` gains a play-once layer beside `Fx` and `OnView`:
  `Reveal`, `RevealGroup` and `Sequence` play a root once, the first time
  it is 12 % into the viewport, never again on a second scroll or a hover;
  `part(kind, delay)` makes an element a part (`fade`, `rise`, `scale`,
  `pop`, `draw`, `grow`, `dim`, and the loops `flow`, `pulse`, `breathe`,
  which run only while their root is on screen), with `staggerDelay`,
  `useMotionRoot` (one shared observer; a root at the very end of a page
  plays as soon as it shows; at once under a lab timeline) and
  `motionScript()`, the inline script that arms the page unless the reader
  prefers reduced motion. The keyframes, the armed start states, the loops,
  the reduced-motion guard and the `--ease-*` / `--motion-*` tokens are a
  block at the end of the example's `src/styles/motion.css`, used by
  nothing in the wireframe; a site that adopts the layer copies it
  (`docs/migrating-to-0.8.0.md` § 3.5). `STANDARD.md` §7 and the
  components catalogue say which layer to choose, and the styling rule
  (`templates/site/rules/styling.md`) names both. `revealed()` and
  `probe`'s `reveals.pending` count an armed part whose root has not
  played; a static capture runs under reduced motion, where nothing is
  armed, so no captured frame moves.
- The browser suite's `imagesReady` test no longer fails on a slow runner.
  Its page hydrated on a 300 ms timer that started while `setContent` was
  still parsing, so a slow load spent part of it before the test's clock
  began (CI measured 172 ms of the 250 it asserted) and could carry the
  "not touched yet" check, 120 ms in, past the hydration. The page now
  hydrates when the test tells it to, and the test asserts that
  `imagesReady` is still waiting and the image untouched at that moment.
  `imagesReady` itself is unchanged.
- `variants()` and `VariantProps` in `agentic-cms/cx`, beside `cx`: a
  component's looks as one typed map (a base, each axis with its options
  and its default, compounds for a combination) and the function that
  picks one, so a new look is a line in the map, never a copy of the
  component. An option an axis lacks throws and names the options it has.
  No React: it loads under `node:test` and in server components alike.
  `pnpm test:pack` runs it from the tarball.
- Tokens by role, at the wireframe's values, so no pixel moves:
  `--color-panel` (a panel's face) and `--color-on-ink` (text on an ink
  ground) alias `paper`, `--color-line` (every hairline) aliases `ink`;
  each heading step has `--text-hN--letter-spacing: normal`, read by
  `text-hN` and by `base.css`'s `h1`–`h6`; `--tracking-label` is `normal`;
  `--radius-panel`, `--radius-control`, `--shadow-panel` and
  `--shadow-glow` are `0` / `0 0 #0000`, the only radius and shadow
  tokens there are. The example's components ask for the colour roles
  where one applies (`border-line`, `stroke-line`, `bg-panel`,
  `text-on-ink`) and name a value only where no role does: the page
  ground, text, a filled block, muted text. The rule says so in each place
  it lives (`AGENTS.md`, the styling rule in both trees, `STANDARD.md` §1
  and §6, the components catalogue, `globals.css`), and the `design` skill
  has a design give the roles their values first. A site adds the roles by
  hand (`docs/migrating-to-0.8.0.md` § 3.6).
- A clone is set up by one command, `bash scripts/setup.sh`. `init` writes
  it from `templates/site/setup.sh` (kept when present): it checks Node
  22.18 or newer, gets pnpm at the `packageManager` version (corepack,
  else `npm install -g`, since Node 25 and later ship no corepack), runs
  the install (`--frozen-lockfile` once a lockfile exists), then hands
  over to the new `agentic-cms setup`. That installs the browsers not
  installed yet (`--engines chromium,webkit`), launches WebKit on Linux to
  see whether its system libraries are there and prints the `sudo` line
  when they are not (`--deps` runs it), writes `.env.local` from
  `.env.example` and this machine's addresses into `ALLOWED_DEV_ORIGINS`,
  runs `pnpm lint` and `pnpm test` (`--build` adds `pnpm build`) and ends
  with the URLs. Each step keeps what is there, so a re-run takes
  seconds; `--check` reports every step and changes nothing (exit 1 on a
  gap). There is no package script named `setup`: `pnpm setup` is pnpm's
  own. The `setup` skill (`.claude/skills/`, `.agents/skills/`) runs it
  for an agent asked to set a project up, and stops for `sudo` and the
  firewall. `init`'s next step names it, and `docs/setup.md`,
  `docs/browsers.md` and `docs/dev-server.md` give the commands in place
  of the manual steps.
- `agentic-cms urls` (`pnpm urls`; `init` adds the script) prints this
  machine's URLs for the dev server and the lab (localhost, the LAN and
  the public address), whether each server answers, and whether
  `ALLOWED_DEV_ORIGINS` in `.env.local` covers every address, without
  which a page opened from another device never hydrates. `--write` adds
  the missing hostnames and keeps the file's other lines; it exits 1 on
  a missing one without it. The dev port comes from the `-p` of
  `scripts.dev`; `--no-public` skips the public lookup (api.ipify.org,
  then ifconfig.me). `lab serve` lists its LAN URLs through the same
  library (`scripts/lib/hosts.mjs`), so container and VM bridges are no
  longer among them.
- `scripts/lib/browser.mjs` gains `webkitPath()` and `launch({ engine })`
  for WebKit beside Chromium, and the "no Chromium build found" message
  names `bash scripts/setup.sh`.
- `package.json` declares `"sideEffects": ["*.css"]`, so a bundler keeps
  only the modules a page uses from the package's barrels: a server
  component that imports `Reveal` from `agentic-cms/ix` no longer loads
  the Motion library behind `Fx` and `OnView` on its page (69 KB in the
  example's build), only `Reveal`'s own code.
- The example has the day-one primitives in `src/components/ui/`, at the
  wireframe's values and on the role tokens, each with its row in the
  components catalogue: `Panel` (`solid`, `dashed`; `panel()` is the same
  frame as a class string, for a card that is a link or a dialog with a
  ref), `OutlineButton` (a choice on the page, a `<button>` with
  `aria-pressed` when it toggles, never a call to action), `IconButton`
  (44 px, its label required), `Heading` (its level apart from its `size`;
  `entrance` renders the play-once `Reveal`, which the wireframe never
  passes), `MetaLine` and `metaLabel`, `TextLink` (`next/link` for a path,
  a new tab for `http(s)`), `Media` (`EagerImage` above the fold, a lazy
  `<img>` otherwise) and `keepWords` (U+2011 in a hyphenated word, with its
  test). `Button` declares its looks with `variants()` (`button`, behind
  the same `buttonClass`). The catalogue gains § Library first and
  § Extending a primitive, and `docs/primitives.md` its "In the example"
  column.
- The card frame is `ui/Panel`: `Section` draws its box with it,
  `sections/Group` its dashed one, the footer its box, every section its
  cards' frames (`<Panel as="li">`, in place of each file's
  `const card = "… border border-line p-4"`), the blog card and the
  consent banner `panel()`, whose answers are two `OutlineButton`s. What
  goes inside a card stays each section's own design, and there is still
  no shared `Card`. The design rule (both trees) says "a section's card
  content is its own; the card frame is `ui/Panel`", and `AGENTS.md`,
  `STANDARD.md`, the styling rule and the `design` skill agree. Panels
  ask for `rounded-panel` and `shadow-panel`, `0` and none in the
  wireframe, and have no ground of their own, as the boxes they replace
  had none (a design adds `bg-panel` to `solid`): the proof is identical
  in both schemes, with `--states`.
- The site profile: `src/config/harness.ts` says once what a site is,
  beside its seed — `widths`, `schemes` and `proof: { pages, ref }` —
  and every command takes it as its default. A flag wins, then the
  profile, then the built-in default, which is what the command took
  before: `--scheme` (capture, proof, shot, probe, sheet, icons audit,
  icons round publish, lab render) and proof's `--ref` lose the defaults
  the parser used to fill in, and each command's help names its fallback.
  A capture takes the profile's widths (`--motion` keeps 1440 and 390,
  `--states` 1440) and opens the home page's menu at each of them where
  its button shows; `proof` runs a pass in each of the profile's schemes
  (the dark one's captures end in `-dark`), takes `--widths` for its
  static pass alone and defaults `--pages` to the profile's; `lab serve`
  shows a ground per scheme. A key of the wrong shape exits 2 naming it
  (`docs/visual-parity.md` § The site's profile). Without a profile a bare
  command does what it did, so nothing to recapture there.
- The example's profile proves at 390, 768, 1440 and 1920, in light and
  dark, against `develop`, in place of the eight built-in widths: the
  kit's own captures change — **recapture baselines** taken at the eight.
  Nothing on a page moved (identical at the old eight widths, in both
  schemes, before the switch).
- `init --light-only` lays a site out without dark mode: `schemes:
  ["light"]` in its profile, each colour a single value under
  `color-scheme: light`, no theme script, no `suppressHydrationWarning`,
  no `ThemeToggle`, and `STANDARD.md` and the components catalogue
  without their dark-mode passages, which the kit now marks
  (`<!-- dark-mode:start -->` … `<!-- dark-mode:end -->`). An edit that
  finds nothing to change stops `init` (exit 2) before a file is written.
  `pnpm test:pack` builds, lints and tests a light-only site from the
  tarball too (`docs/init.md`, `docs/migrating-to-0.8.0.md` § 3.4).
- The design skills say "each scheme the profile names" where they said
  "both themes" (`design`, `design-proof`, `design-options`,
  `design-graphics`); `design-proof`, the styling rule and a new site's
  `AGENTS.md` § Parity harness make a bare `proof` the site's proof,
  read from the profile.
- `agentic-cms/eslint`: `componentRules(options)`, the component
  library's lint as flat ESLint configs a site spreads after
  `eslint-config-next`. The layers import one way (motion ← ui ← patterns
  ← sections), and only the motion layer imports `motion`, `framer-motion`
  or `agentic-cms/ix` (with no motion folder, `agentic-cms/ix` is the
  motion layer). A section or a pattern holds one component per file and
  no raw button, link, picture, video, heading or form field (no `svg` in
  a section), no `style`, no arbitrary value and no visual or motion class
  in its class strings; each message names the primitive to use. The layer
  folders, the section folders, the forbidden elements with their messages
  and the files left out are options, and a layer may be missing
  (`docs/primitives.md` § Enforced). ESLint becomes an optional peer;
  `pnpm test:pack` loads the export from the tarball.
- The example lints with it (`eslint.config.mjs`, which a new site from
  `init` gets), pixel for pixel — the proof is identical in both schemes
  with `--states`. Its sections write `Heading`, `Media`, `TextLink` and
  `Panel` where they wrote raw headings, images, a link and bordered boxes;
  `Media` gains a `size` (`fill`, `icon`, `portrait`, the `media` map),
  `TextLink` passes every attribute through and draws the post body's
  links, the corner tag of a section and of a group is one primitive,
  `ui/TypeTag`, and the two uneven splits are tokens
  (`lg:grid-cols-2-1`, `lg:grid-cols-1-2-1`). The three sections that held
  a second component inline it (`docs/migrating-to-0.8.0.md` § 3.7).
- The kit's own components rule, `.claude/rules/components.md`: the
  library first, the layers, what a section may contain, primitives
  extendable by construction, enforcement by the lint and CI, and
  loosening a rule as its own pull request, said so in its title. A site
  gets no copy yet: its rule waits for the placement guard it describes.
- `agentic-cms serve` (`pnpm kit serve`) is the one command before a look.
  It checks `ALLOWED_DEV_ORIGINS` first (`--write-origins` adds the
  missing hosts before next dev starts), starts `next dev` on the site's
  port on every interface — or reuses this site's own, found by
  `.next/dev/lock`, and refuses anything else on the port, never stopping
  it — and starts the lab in-process when `.parity/lab` has a scene (or
  with `--lab`). It waits until the root and every `*-demo` route answer,
  then prints one table: localhost, LAN and public × the routes, the lab's
  index and each `/scene/<name>`, with the firewall note. It watches the
  dev log for Turbopack's stale cache (`--fix-cache` clears `.next/dev`
  and `.next/cache/turbopack` and restarts, once) and stops both servers
  on Ctrl-C (`docs/dev-server.md`). `init`'s next-steps line and `setup`'s
  last line name it.
- `demo new` and `lab route` wait for their route. With the dev server
  running (on the port of `scripts.dev`, or `--url`), the route is asked
  until it stops answering 404, which compiles it too; then its URLs are
  printed, with a warning for each host `ALLOWED_DEV_ORIGINS` lacks. A 5xx
  prints the error's tail and exits 1. With no server running they say
  `pnpm kit serve`. New flags: `--no-wait`, `--timeout`, `--url`,
  `--no-public`. `--json` adds `urls`, `ready` and `status`, and `demo
  new`'s report its `kind`.
- `demo new <name> --showcase [--component <file>]…` writes a review page
  that is not a section's candidates (the library's primitives, a motion
  layer): a block per piece inside the site's layout, and a manifest
  (`kind: "showcase"`), so `demo clean` removes it with every file only it
  uses and keeps the pieces. `--component` repeats for a showcase only.
- `demo new --timeline` wraps each block — every candidate and the current
  version, or each piece of a showcase — in `<LabTimeline label><div
  data-lab-drive>`, the edit `docs/lab.md` asked for by hand.
- `lab serve` prints each scene's own page, `/scene/<name>`, on every
  address it listens on.
- The browser suite's dev server runs on `scripts/lib/dev-server.mjs`, the
  helper `serve` uses (next dev started, watched and stopped by process
  group); its `stop()` now resolves once the server exited.
- `agentic-cms check-components`, the component library's placement
  guard: the layers there and every file under `src/components` in one,
  every component the motion layer, `ui/` and `patterns/` export named in
  the catalogue (a PascalCase name with a lowercase letter, so an ALL_CAPS
  constant passes), every component in a section folder imported by the
  registry, route files only in `src/app`'s known route folders (a `*-demo`
  folder is free), no component elsewhere in `src/`, CSS modules only in
  `ui/` and the motion layer and `@keyframes` only there and in
  `src/styles/motion.css`. A running design round's candidates (its
  `demo.json`) and the files on the config's frozen `inherited` list pass;
  a listed file that is gone is a finding. Each finding names its fix; exit
  1 on any, 2 without a config. The config is `src/config/components.json`,
  its layer keys `componentRules()`'s; the example's freezes the blog's
  post template (`docs/primitives.md` § Placed).
- `pnpm lint` runs ESLint, then the guard, and fails on either while both
  report — the kit's own, and the one `init` writes into a new site's
  `package.json`: `eslint; s=$?; agentic-cms check-components || s=1;
  exit $s`. `pnpm test:pack` lints a fresh site with it, and a stray
  section file planted there fails the lint.
- A site's components rule, `templates/site/rules/components.md`, and with
  it agent files that follow the tool they describe: `init --agent-files`
  writes and checks the components rule only where the site has
  `src/config/components.json`. A site on 0.7.6 without it is neither
  given the rule nor told it is missing, and `--check` stays clean; a new
  site from `init` gets the config, the rule and the lint script together
  (`docs/migrating-to-0.8.0.md` § 3.7).
- The browser suite's test of a timeline wrapped around a section no
  longer fails on a slow runner, and runs in WebKit as well as Chromium.
  It read the section's reveal, waited 300 ms of wall time and asserted
  100 ms of progress, so a runner slow to draw the reveal's first frame
  spent the margin first (CI measured 0 → 99.98 ms). It now waits for the
  reveal's start time, reads the reveal against the page's animation clock
  (`document.timeline`) on either side of the seek, and asserts that it
  still runs, kept its start time and moved with that clock; the reveal
  lasts a minute, so no runner sees it end. A timeline that sought the
  reveal without pausing it, which the old test let through, now fails
  it. The timeline is unchanged.
- `init --agent-files` tells a site's edit of the kit's current text from
  one the kit has moved past, so a site that keeps its own edits can have a
  clean `--check`. The manifest's hash for each file is its base, the kit's
  text the site last took. `--check` passes a file the site edited while
  the kit's text is still its base (`modified`) and fails one the kit
  changed since (`modified, kit changed`); before, it failed every edit.
  `--diff <file>` prints the kit's change since the base alone, as a
  unified diff that `git apply` reads, so a merge no longer mixes the
  site's edits with the kit's changes. `--accept <file>` records the kit's
  current text as the base once the site has merged by hand. The base text
  of each edited file is kept in `.agentic-cms/base/`, recovered from the
  site's git history the first time. The manifest also records the kit
  `commit` the lockfile installed, because a pin between releases still
  carries the last release's version. A 0.7.6 manifest reads as before.
  Found by running the migration guide on a site on 0.7.6
  (`docs/init.md` § After a kit upgrade, `docs/migrating-to-0.8.0.md` § 1).
- The agent files `init --agent-files` writes describe only what a site
  has adopted. Before, a site on 0.7.6 that took only § 1 of the migration
  guide was told that its motion was the play-once layer and its card
  frame `ui/Panel`. Now the styling rule and the `design` skill make the
  play-once layer the default only where the layout renders
  `motionScript()`: a site on `Fx` and `OnView` keeps them, and a site
  with no motion yet starts on the play-once layer. The design rule and
  the skill put a section's cards in the site's one card frame, which is
  `ui/Panel` only on a site that has the example's. The role tokens are
  named as a site from `init` has them since 0.8.0, and a proof without a
  profile writes one first. The `setup` skill runs `agentic-cms setup` and
  `agentic-cms urls` directly on a site without `scripts/setup.sh` or a
  `urls` script. `docs/migrating-to-0.8.0.md` § 1 lists what `--diff`
  shows for every rule and skill, each line with the step it belongs to,
  and § 1 and § 3.1 name the places in a site's `AGENTS.md` by what they
  hold, not by the template's headings.
- `urls` and `setup` tell this clone's `next dev` from another server on
  its port, as `serve` already did. With another checkout of the same site
  serving on the `scripts.dev` port, both said `running`, listed that
  server's URLs as this clone's, and `setup` asked for a restart of a
  server that never reads this clone's `.env.local`. Now the dev server is
  running only when `.next/dev/lock` names a live pid on the port; else
  the port `answers, but not as this clone's next dev`, and no restart is
  named. When this clone's `next dev` runs on another port, the line names
  that port. `urls --json` adds `dev.own` and `dev.ownPort`. `serve` now
  asks the same function (`ownDevServer`), and behaves as before.
- `demo new` and `lab route` hand their route over on this clone's
  `next dev`, found by `.next/dev/lock` as `serve`, `urls` and `setup`
  find it. With another checkout of the same site, or another project,
  serving on the `scripts.dev` port, each asked that server for its new
  route for `--timeout` (120 s), and only then asked whether it was this
  site's. Now each says at once that the port answers, but not as this
  clone's next dev, and exits 1 with the route written: stop what holds
  the port, or `pnpm kit serve --port <n>`. This clone's `next dev` on
  another port is the one asked, and the hand-over names its port.
  `--url` still names any server, with no lock read.
- A `--motion` capture's animation inventory leaves infinite loops out, as
  it always meant to: the DevTools protocol reports an infinite animation
  with no iteration count at all, so the test for `Infinity` never matched,
  and a loop that a page's observer or timer starts or restarts entered
  `<page>@<width>.animations.json` as many times as it happened to start
  (found by running the migration guide on a site on 0.7.6: one page-width
  gave 40, 40, 66, 66 and 57 entries from one build). The loop is read from
  the effect's own timing in the page, and from the protocol's report
  (anything but a finite count) when the page no longer holds it. A
  `--motion` capture writes fewer entries for a page with a loop:
  **recapture baselines** of `--motion` captures taken before this change.
- A profile that names the widths a site used to pass as `--widths` keeps
  the shot cache: the menu is part of the key of the page-widths that open
  it (the home page of a static capture at a menu width), no longer of
  every shot, so writing the profile retakes the home page where the menu
  is now tried and copies the rest, where it retook every shot of the site
  (found by the same run: 0 of 176 reused, 579 s against 72 s). A
  `--motion` or `--states` capture opens no menu and ignores it. What a
  capture writes is unchanged.
- `harness.proof.sample` in `src/config/harness.ts`: a site whose short
  proof is one page of each template says so once (`proof: { sample: 1 }`)
  instead of passing `--sample` every time. It reaches the static pass like
  `--sample`; a `--sample` or `--pages` flag sets it aside for a run; it is
  a whole number from 1, and a profile with both `proof.pages` and
  `proof.sample` exits 2 naming them. `docs/migrating-to-0.8.0.md` § 3.1
  says so, with the cache note, and its `--ref develop` note says the
  branch resolves to `origin/develop` first.
- `agentic-cms/eslint`: `componentRules()` fails copy in a section or a pattern: JSX text with a letter or a digit, and strings in `title`, `alt`, `aria-label`, `placeholder`, `label` and `children` (straight, as `{…}`, in a template or a fallback, or as a data array's field of that name). The message names the route the copy takes: the page's file, the section's schema field, the prop. The new option `copy: { props, decorations }` (or `false`) configures it; symbols, `aria-hidden` text and the props of `Placeholder` and `TypeTag` pass.
- `check-components`: `routes` holds the content engine's route folders (the app folder and its catch-all), and every other route folder is a named exception, `"exceptions": { "<folder>": "<reason>" }` in `src/config/components.json`. A folder in `routes` that is neither, or an exception with no reason, is a finding that names the fix. The defaults carry the example's three reasons (the post template, the form endpoint, the feed), so a config from before still reads; `init` writes the example's set.
- A new `pages` rule, which `init --agent-files` writes for every site, loads on `src/app/**`, `src/components/**` and `content/pages/**`: every page is a content file, a new one is `/editorial:new-page`, and a page's copy never lives in a component, a `page.tsx` or `src/config/`. The site template's `AGENTS.md` says it in one always-loaded bullet, which § 1 of the migration guide lists for existing sites.
- `docs/migrating-to-0.8.0.md` § 3.9, pages as content files: for a site whose pages are hand-written routes, one page per commit, each proven identical, then the exceptions for what stays outside the engine.
- The example's FAQ section marks its `variant:` note `aria-hidden`, a wireframe note like a `TypeTag`; no pixel moves.
- The example's chrome takes its words from `chrome` in
  `src/config/site.ts`, an `as const` block beside `consentBanner`. That
  covers the skip link, the navbar's landmark name and menu button, the
  theme toggle's label in each state, the footer's column titles, the
  404's label, title and sentence, and the post template's eyebrow,
  reading time and "Read next" heading. The 404's sentence is its parts in
  reading order (strings and `{ label, href }` links), and the reading
  time is a function of the minutes. `SiteConfig` is unchanged. `init
  --light-only` leaves the toggle's labels out of `site.ts`. No pixel
  moves.
- A static capture never photographs an image before it arrives. The wait for images now decodes each one that shows (`img.decode()`) after it has arrived, for up to 10 s, and listens beside the page's own `load` handlers instead of replacing them; it used to give up after 5 s without a word. A page that still has an image loading at the shot is loaded again once; if the second load still has one, the shot is taken, the images are listed in `<page>@<width>.unloaded.json`, the shot is kept out of the shot cache, and the compare calls a difference on it `FLAKY` (retake that page with `--fresh`). Found by running the migration guide on a site on 0.7.6: 3 of 194 static shots changed by 4 to 6 % where a lazy image below the fold was blank on one side, and identical on a `--fresh` re-run. **Recapture baselines** taken before this change if a page of yours has lazy images: a baseline may hold such a blank.
- Every line of a compare that is not `ok` has a `cause:` line under it: the section that moved, else the section whose content changed in place; the image that had not arrived (`FLAKY`); what a shot without geometry shows (the menu, a motion step, a state's box); why a file is in one capture alone; an inventory's first difference, a settle record's changed step. `--json` gives every such file its `cause`, and the summary a `flaky` count.
- A `--states` capture puts the post FAQ state on the first post whose body has a FAQ (the kit's own test), not the first post, and drops it when no post has one; a state whose target does not show within 10 s is skipped and listed in `capture.json` (`skipped`), and the compare's `MISSING` line says which side skipped it. A build whose posts had no FAQ used to time out twice and end the run.
- `docs/migrating-to-0.8.0.md` § 1: the check runs `--all` and says what each pass must show; the `--ref` baseline's sibling worktree, `../<checkout>-ref-<sha>`, is named with its cleanup.
- Fixed: the `serve` browser test no longer fails on a port taken by a parallel test. Its ports come from `freePorts()`, which picks distinct ports below the ephemeral range, and next dev's EADDRINUSE exit is reported as a taken port.
- Fixed: browser tests wait for the state they assert instead of sleeping a fixed time, so a slow runner no longer fails the timeline's mobile case (`B plays from one start: 0,0,0,0`) or the other sleep-then-assert checks in `timeline` and `dev-routes`.
- Docs: `docs/roadmap-0.9.0.md` is the plan for 0.9.0, agentic-cms as a standard npm package. It covers publishing from CI through trusted publishing with provenance, release candidates on `next`, `pnpm create agentic-cms`, `agentic-cms upgrade`, a written public surface and peer ranges tested at both ends. The 0.8.0 roadmap's 0.9.0 sketch and the docs index link to it.
- Fixed, from CodeQL on the release pull request:
  - the fixture server in the browser suite serves only files under `public/`;
  - two test stubs match the public-address lookup by its hostname, not by a URL prefix.

## [0.7.6] — 2026-10-13

- The voice block's `models` takes an `except` list, like a `banned` or a
  `patterns` entry: files, or `file#field.path` prefixes, the model rule
  does not apply to. Every other rule still runs on those files; a block
  without it reads as before.

## [0.7.5] — 2026-10-04

- **Security.** The package asks for `next` 16.3.6 or later (its peer
  range was `>=16.3.0`): 16.3.6 fixes a remote code execution in
  `next/og`'s `ImageResponse` (GHSA-vcvr-r3jv-pc5j). The kit uses no
  `next/og`; a site that does is exposed until it moves. The example builds
  with 16.3.8. `image-size` is `^2.0.4`, past two infinite loops in its
  JXL, HEIF and ICNS parsers (GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr);
  the kit only measures the site's own images with it. The example's
  toolchain takes the patched `undici` (through `wrangler`) and
  `brace-expansion`.
- **Security.** `readTrustedSvg`, and with it `readInlineSvg`, `LabStudy`
  and the lab's scenes, checks an SVG for code as it goes inline, not only
  as written. A script or an event handler split by a comment
  (`<scr<!-- -->ipt>`) passed, and dropping the comments joined it; so did
  a handler after a `/` or a quote (`<rect/onclick=…>`) and a
  `javascript:` URL spelled with character references or a tab. It stays a
  guard against a drawing that brings code by accident, for an SVG the
  repository owns, not a sanitizer for one from outside it.
- The SVG, scene and FAQ parsers run in linear time: `svgMarkup`,
  `followsTheme`, `sceneMeta`, `sceneDuration` and the FAQ answers' link
  stripping slowed quadratically on a run of unclosed comments, a long
  attribute name or number, or a run of `![` (20,000 of them took 10 s).
  Every page, its JSON-LD and every SVG of the example come out as before.
  `followsTheme` now ignores every comment, not only the lab's.
- `agentic-cms seo` decodes `&amp;` last, so `&amp;lt;` stays `&lt;`;
  `agentic-cms docs` escapes a backslash in a table cell; `pnpm hygiene
  --brand` takes the name literally.

## [0.7.4] — 2026-10-04

- A playing lab timeline (`mountTimeline`, `LabTimeline`) lets the
  animation it wraps run on the browser's clocks: it sets every copy going
  from one time together (the SVGs' own timelines unpaused, the CSS and
  Web Animations and the lab frames played), sets them going together
  again at each cycle's start, and on a frame writes only its controls. It
  used to pause every copy and set its time on every frame, on screen or
  not, which restyled and repainted all of them every frame and slowed the
  whole page while it played. Paused, scrubbed, stepped, replayed or under
  reduced motion it holds every copy on one frame as before. A copy more
  than half a screen off the viewport now stops while the timeline plays
  and joins its time on the way back. `window.lab.play()` leaves an
  animation already past its end on its last frame (it rewound it).

## [0.7.3] — 2026-10-03

- `critical-css` changes a page by its inlined `<style>` and its
  stylesheet links alone, and leaves every other byte as Next wrote it.
  0.7.2 wrote back the page as Beasties re-serialized it: an empty
  `alt=""` came out as a bare `alt`, which `agentic-cms seo` then failed
  as missing on every decorative image, and `charSet` was lowercased,
  self-closing slashes dropped and a `data-beasties-container` added to
  `<html>`. Beasties now only picks the rules.

## [0.7.2] — 2026-10-03

- `agentic-cms critical-css`, a build gate for prerendered pages: each page
  gets the rules its own HTML uses inlined, and its stylesheets load
  without blocking the first paint (`media="print"` until they arrive, a
  `<noscript>` fallback). Every `@font-face` of the page's stylesheets goes
  in with its URLs resolved, and rules the built HTML cannot vouch for are
  kept whole: Tailwind's arbitrary variants and the states a script sets
  (`[data-…]`, `[aria-…]`). It rewrites `.next/server/app` and the
  standalone package's copy, leaves a page it has done alone, and `--check`
  fails naming a page that still waits for a stylesheet. Its place is right
  after `next build` (docs/deploy.md). New dependency: `beasties`.

## [0.7.1] — 2026-10-03

- `Fx` takes `duration` (ms, default 1000) and `distance` (px, default
  100), and `intro`: the first entrance is played by CSS from the first
  frame, not after the scripts. A scroll reveal holds its start pose
  (opacity 0) until the page has hydrated, which on a phone left a hero's
  copy unseen for seconds; with `intro` the element carries `ix-intro
  ix-intro--<preset>` and its numbers as custom properties (`--ix-delay`,
  `--ix-duration`, `--ix-distance`), the new `ix-intro` block of
  `src/styles/motion.css` plays it on the ease-out-quart curve, and the
  replays (after the element has left the viewport entirely) are Motion's
  as before. Every width; shown at once under reduced motion, and played
  by its CSS alone without scripts. The keyframes fill backwards only, so
  a finished entrance leaves the element as a Motion play does (a
  lingering fill kept Chromium's text on a layer of its own, antialiased
  unlike the page). Nothing changes for an `Fx` without the new props.

## [0.7.0] — 2026-10-02

- Consent, provider-neutral and headless: `agentic-cms/consent` keeps a
  visitor's choice in their browser (`{ analytics, at, version }` under a
  policy's `storageKey`, asked again after `maxAgeDays` or when `version`
  goes up), follows it across tabs, and gives a site's own banner its state
  (`useConsent`, `useConsentDecision`, `openConsent`); a tag adapter follows
  `currentDecision` and `onConsentChange`. `agentic-cms/consent/google` is
  Google consent mode v2 behind it: `consentDefaultScript(policy)`, an
  inline script near the top of `<body>` with every type denied, a stored
  choice replayed and the `_ga` cookies deleted until analytics is granted,
  and `GoogleTag`, which in basic mode (the default) loads nothing before a
  grant and switches the tag off on a refusal, and in advanced mode loads at
  once with cookieless pings; whatever set a change off, the update reaches
  the dataLayer before the tag's config. Both entries load in a server
  component and in plain Node; no new dependency. The example wires it,
  off until `GOOGLE_TAG_ID` is set: `src/config/analytics.ts`, the layout,
  `ui/ConsentBanner`, Cookie settings in the footer, and
  `src/config/harness.ts` seeding the screenshot harness with a refused
  choice ([docs/consent.md](docs/consent.md)). An example without the
  variable is unchanged.
- A visitor's choice, seeded: every browser the harness launches can start
  with keys in the page's `localStorage` and `sessionStorage`, written
  before any of the page's scripts runs (the first inline `<head>` script
  included), so captures, shots and probes show a site after the choice —
  a consent banner closed — instead of a first visit with the banner over
  the page. The site's default is `src/config/harness.ts` (`export const
  harness = { storage: { … }, sessionStorage: { … } }`, a string or any
  JSON value per key), a file the app never imports; `--storage
  <key>=<value>` and `--session-storage <key>=<value>` set a key over it
  for one run and `--no-storage` leaves it out, on `visual-parity capture`
  and `proof`, `shot`, `probe`, `sheet` and `icons audit` — on the build and
  on the dev server alike, so a design round's demo route and the lab route
  are photographed after the choice too. `{now}` in a value is the run's
  ISO time and `{now:ms}` its epoch milliseconds, replaced once per run, so
  a record checked against a maximum age never goes stale. A capture
  records the seed as written in `meta.json` (`seed`), the shot cache keys
  on it, a `--ref` baseline is seeded from the tree's file, `proof` passes
  the flags to both sides, and `compare` refuses two captures seeded
  differently (exit 2) unless `--mixed-seed`; `shot`, `probe`, `sheet` and
  `icons audit` print the seed in their `--json`. A site without a seed
  captures as before; a site that adopts one must **recapture baselines**.
- `icons audit` leaves a design round's demo routes (`/<name>-demo`,
  `/lab-demo`) out of its pages unless `--pages` names one, as a capture
  does.

## [0.6.1] — 2026-09-27

- Every ordinary form item, from config. Beside `text`, `email`, `tel`,
  `textarea` and `checkboxes`, a form definition now has `url`, `number`
  (`min`, `max`, `step`), `date` (`min`, `max`), `select` (a placeholder as
  the empty first option, so `required` means a real choice), `radios` (a
  fieldset and legend), one `checkbox` for consent or an opt-in (its label
  may end in a link, which opens in a new tab and never ticks the box) and
  `hidden` (the server keeps the definition's value). Text-like inputs take
  `minLength`, `pattern` and `inputMode`, a textarea `rows` and
  `minLength`; every field `hint` (joined by `aria-describedby`) and, where
  HTML has them, `autocomplete`, a default value and `fromQuery`, a prefill
  from a URL search parameter read after hydration and taken only when the
  field would accept it. Items that are not fields: a `note` with a link,
  and a `group`, a fieldset with a legend. `optionalMarker` on a definition
  marks the fields that are not required. File upload, conditional fields,
  multi-step forms, a multiple select, password, range and colour stay out,
  with the reasons in `src/lib/forms/README.md`.
- The server checks every type after the HTML standard and never stricter:
  the URL parser, the float syntax and the step base, the date string, the
  pattern anchored and compiled with the `v` flag. One module
  (`rules.ts`, `acceptValue`) holds the rules for the server and the
  prefill. The wire format stays version 1; `fields[].label` of a checkbox
  ends in its link's text.
- `readFormValues()`, `queryValues()`, `applyValues()` and
  `prefillFromQuery()` in `agentic-cms/forms`: a site's `Form.tsx` reads
  and prefills its values with them instead of a copy of its own per type.
- `{email}` in a form's messages is `messages.email`, for either backend:
  `withEmailToken()` encodes it, `messageParts()` splits the message and the
  example's `FormShell` renders the address through `EmailLink`, so it never
  crosses to the browser as text.
- The mailto body shows an option's label where it showed its value
  (`mailtoBody()`).
- The example's form primitives: `NumberField`, `DateField`, `Select` (a
  drawn chevron), `RadioGroup`, `Checkbox`, `Choice`, `FormNote`,
  `FieldGroup`, `Hint`, `Marker`; `TextField`, `TextArea`, `CheckboxGroup`,
  `FieldWrap`, `FieldRow`, `Form` and `FormShell` take the new options. A
  definition that uses none of them renders the same markup, so baselines
  stay.
- `visual-parity capture --ref HEAD` (and `proof --ref HEAD`) builds the
  checked-out commit. It resolved every ref on `origin` first, so `HEAD`
  became `origin/HEAD`, the remote's default branch, and the baseline was
  silently another commit; `HEAD~2`, `main^` and `@{-1}` likewise. Only a
  branch name is looked up on `origin` first now (`develop` is still the
  branch as pushed); anything else resolves in the checkout.

## [0.6.0] — 2026-09-27

- Forms that deliver: the `endpoint` backend. A form whose backend is
  `{ kind: "endpoint", url: "/api/forms/<id>" }` posts its values as JSON
  to the site's one dynamic route, `src/app/api/forms/[id]/route.ts`; every
  page stays prerendered. The new subpath `agentic-cms/forms/server` is the
  route's work: `createFormHandler` takes JSON only, caps the body, limits
  each form and address (in memory, best effort), repeats the browser's
  checks against the definition — never stricter — answers a filled
  honeypot or a form sent within 1.5 s with a success and drops it, then
  hands the submission, in wire format version 1 (with an `id` a receiver
  de-duplicates on, and the page's UTM tags), to a sink. The kit names no
  provider: its two sinks are a signed webhook (HMAC-SHA256 over the
  timestamp and the body, `verifyFormSignature` for the receiver; no
  redirects followed) and a development log, and a provider's API is a
  `FormSink` the site writes. The example ships the route and
  `src/config/form-delivery.ts`, which reads `FORM_WEBHOOK_URL` and
  `FORM_WEBHOOK_SECRET` per request (a log in development without one, a
  503 in production); its contact form stays on `mailto`. The guide is
  `docs/forms.md`, the contract `src/lib/forms/README.md`.
- `FormBackend.submit(form, values, context?)`: the optional `context`
  carries the honeypot's content and the time the form was on screen;
  backends that ignore it are unchanged. `<Form>` renders the honeypot
  (`TRAP_FIELD`) and sends the time for endpoint forms only, so a `mailto`
  form's markup is unchanged and nothing needs recapturing, and a backend
  that throws now ends in the form's error message instead of its wait
  label. `MailtoBackend` loses its parameter property, which Node's type
  stripping refuses.
- The form rules (`form-engine.md`, the kit's and the site template's) cover
  the route and `form-delivery.ts`; the stale "the site is static … the
  Worker" rule is gone, and the roadmap's "a form backend stays a site's"
  is now the provider alone. `pnpm test:pack` runs the installed
  `agentic-cms/forms/server` on a Request.

## [0.5.5] — 2026-09-26

- Third parties held back during a capture. On a build the harness serves,
  each page carries a Content-Security-Policy that lets scripts and
  connections (fetch, XHR, beacons, sockets) come from its own origin alone;
  other origins' images, fonts, stylesheets and frames load as ever.
  Analytics and widgets no longer cost a capture network and timing (a
  consumer site's six pages, 86 s to 81 s, 50/50 identical). A header, not
  request interception, which would switch the HTTP cache off.
  `--third-party allow` turns it off; `meta.json` records it; the shot cache
  keeps the two apart. **Recapture baselines** for a site whose third-party
  script draws on the page (a chat bubble, a consent banner from another
  origin), or pass `--third-party allow`. The harness adds its styles with
  its own `addStyle` in place of Playwright's `addStyleTag`, which fails
  when any CSP error is logged while it runs.
- The static scroll-through steps on as soon as the page is quiet. Each 600
  px step waited eight animation frames whatever the page did; it now waits
  until the page has not changed (no DOM mutation) for two frames in a row —
  two at least, never more than the eight it had — so a busy section still
  gets them all (`quiet()` in the harness's library; also `shot`, `probe`
  and `icons audit`). The same shots, faster: the example's static set 66.6
  s to 44.3 s (82/82 identical), its states 12.8 s to 9.9 s (8/8), a
  consumer site's six pages 98.4 s to 76.7 s (50/50), every shot taken.
- `visual-parity proof`: a whole proof in one command — for the static pass,
  and `--motion`, `--states` or `--all`, the baseline of a commit (`--ref`,
  `develop` by default, built once), the tree as it stands (`--build` builds
  it first) and the compare, as the harness's own commands with `--json`.
  One line per pass (the compare's counts, each side's time and cache
  reuse), one exit: 0 identical, 1 on any difference or a failed capture.
  The capture options pass through (`--scheme`, `--pages` or `--sample`,
  `--jobs`, `--fresh`, `--third-party`). The guide, the README and
  `design-proof` show it beside the three commands.
- Codex finds the path-scoped rules. Claude Code loads `.claude/rules/*.md`
  by their `paths` frontmatter; Codex reads `AGENTS.md` and nothing under
  `.claude/`, so it never saw them. `AGENTS.md` now carries a scoped-rules
  table, one row per rule (its paths, a link), written from the rules' own
  frontmatter between two `rules-table` comment markers: `agentic-cms init
  --agent-files` writes it into a site's `AGENTS.md` — the one block of that
  file the kit rewrites, from the site's rules as they stand, edits included
  — and `--check` reports it `stale` or `missing`, and `AGENTS.md` `too big`
  past the 32 KiB Codex reads by default. The kit's own `AGENTS.md` and the
  site template carry it too (`pnpm docs:rules`; `pnpm hygiene` and the
  tests fail on a stale table, a kit `AGENTS.md` over 32 KiB or a template
  over 16 KiB). `docs/init.md`, `docs/skills.md`, `docs/design.md` and the
  README say how each tool loads the rules and skills.
- `visual-parity clean`: old captures out of `.parity/visual/` — all but the
  newest finished ones (10; `--keep <n>`, or `--all`), with every compare of
  a removed capture — and, with `--cache`, the shot cache; a capture still
  running (no `capture.json`, under a day old) is kept, `--dry-run` lists
  first, and nothing outside `.parity/` is removed. The kit's and the site
  template's `AGENTS.md`, `design-proof` and `docs/visual-parity.md` name it where they said to
  delete old labels by hand.

## [0.5.4] — 2026-09-26

- A proof's rules follow the faster harness: the kit's and the site
  template's `AGENTS.md`, the `design-proof` skill, `docs/visual-parity.md`
  and the README say to capture the full set rather than a `--pages` subset
  to save time (the cache skips what did not change; `--pages` is for
  looking at one page), and that only a first capture of a large site needs
  running in the background. The shot cache has a folder of its own,
  `.parity/shot-cache/`, apart from `.parity/shots/`, where `agentic-cms
  shot` writes.
- `visual-parity capture --sample <n>`: a static capture of the first n
  pages of each template (a dynamic route such as `/blog-post/[slug]`, as
  the build's prerender manifest names it; never a catch-all), in route
  order, and of every page that is no template's. The routes left out are
  listed in `meta.json`, and a compare leaves out a page either capture
  skipped. Off by default; the snapshot now carries the prerender manifest.
- `visual-parity capture --jobs <n>`: several browsers at once, each taking
  the next page-width (or state). The default is every core but one, four at
  most, for a static or `--states` capture, and two for `--motion`, whose
  frames are timed; `capture.json` records it. The shots are the same: on
  the example 157 s to 60 s static (82/82 identical), 199 s to 109 s motion
  (295/295), 26 s to 12 s states (8/8), on a consumer site's six pages 173 s
  to 85 s (50/50), with a 4-core machine.
- Unchanged shots are reused. After every page-width (or state) a capture
  records the build files the page requested, with their digests, under
  `.parity/shot-cache/`; a later capture of any build — a `--ref` baseline, the
  working tree — copies those shots when every one of the files has the same
  bytes (the build id masked), and says how many it reused (`capture.json`:
  `reused`). Only the build is an input; the harness's own sources, the
  browser, the scheme and the motion settings are part of the key, and a
  `--url` capture reuses nothing. `--fresh` takes every shot again, so the
  rules that say to re-run a jittery frame now say `--fresh` (the kit's and
  the site template's `AGENTS.md`, `design-proof`, `design-graphics`).
- The harness's server answers Next 16's segment prefetches from the build's
  `<page>.segments/` files. It answered them with the page's whole RSC
  payload, which the router rejects and asks for again at every frame: about
  660 requests in one scroll-through of a real site's page, now one per
  link. No shot changes: static, `--states` and motion frames compare
  identical on the example and on a consumer site, apart from a section
  driven by its own timer.
- Captures are faster, with the same pixels. A static shot, a `--motion`
  frame, a `--states` crop and the menu shot are one DevTools screenshot
  with the renderer's fast PNG encoding, sized, clipped and with the caret
  hidden as Playwright's own; the static scroll-through (also `shot`,
  `probe` and `icons audit`) runs with every element `visibility: hidden`,
  so nothing is painted until the page is back at the top, and counts its
  last wait in frames instead of a fixed 400 ms; the build's server
  compresses each file once per run and lets the browser keep a non-page
  file for the run. `capture.json` gains `timings` (the shots taken, their
  total and mean, the five slowest). No shot changes: static, `--states` and
  settled frames compare identical before and after on the example and on a
  consumer site.
- `docs/visual-parity.md`: `compare --pages` judges the named routes on both
  sides (the guide still said only the after capture's files).
- A `--json` report read through a pipe arrives whole. The commands print
  and then exit, and on a pipe the exit dropped whatever the reader had not
  taken yet: `visual-parity compare --json | …` ended at 64 KB, mid-document
  (`report.json` was always complete). The command line now writes stdout
  and stderr synchronously on a pipe, as it already did to a file or a
  terminal — every command at once.

## [0.5.3] — 2026-09-26

- `imagesReady` waits for hydration before it switches lazy images to
  `loading="eager"`: it waits until React owns every image it will own (each
  `<img>` carries React's fiber key, or sits in markup React inserted as a
  string and never hydrates), then switches and waits for them as before.
  `--motion` captures and `probe --motion` / `shot --motion` switched the
  images right after the fonts, before anything waited for hydration, and
  against `next dev` React's development build reported the attribute as a
  hydration mismatch ("A tree hydrated but some attributes of the server
  rendered HTML didn't match the client properties") — an error the site
  never had. Every caller is covered (motion and static captures, `shot`,
  `probe`, `icons audit`, `lab render`, `sheet`); a page that is not a Next
  app passes at once, and one that never hydrates falls through after 10 s.
  No shot changes: static captures and motion settled frames compare
  identical before and after.

## [0.5.2] — 2026-09-26

- `agentic-cms assemble` packages a standalone build for a Node host:
  `public/` and `.next/static` copied into `.next/standalone` (or its
  `relativeAppDir`) — into its folders, never as them — a copy an earlier
  step nested inside its folder removed, then every file of both checked
  there by size and hash; exit 1 naming each missing, different or nested
  file, `--check` to check alone, `--json`. A hand-written copy that names
  `.next/standalone/public` as its target nests inside it once the file
  trace has made that folder (server code read a public file while a page
  was prerendered), and every other image 404s with nothing failing; the
  command in the build's last step makes that impossible to ship.
  `docs/deploy.md` is the guide (the build and preview scripts, the check
  alone, what the host needs besides the package); the site template's
  AGENTS.md says it.
- A capture photographs a copy of the build, not the working tree: the
  site's own `.next/server/app`, `.next/static` and `public/` are copied
  into `.parity/snapshots/<label>/` before the browser starts, served and
  listed from there, and removed when the capture ends (a copy a capture
  that died left behind goes at the next start). The `snapshot:` line says
  when the tree is free: a build, an asset edit or a moved file during the
  15–40 minutes of a full set no longer silently invalidates it. A build
  that changes during the seconds of the copy fails the capture (exit 2)
  instead of mixing two builds. `meta.json` records the checkout it was,
  `tree: { head, dirty }` (`null` outside git). `--ref` and `--url` were
  already apart from the tree and are unchanged.
- `visual-parity capture --ref` builds a commit that still has a demo
  route: the demo routes (`src/app/<name>-demo`, never production, which
  the build's SEO audit rejects by design) are removed from the throwaway
  worktree before install and build, logged and recorded in `meta.json`
  (`demosRemoved`); a baseline of a commit made mid-round no longer has to
  be built by hand. Every capture leaves the demo routes out of its pages
  unless `--pages` names one, so both sides of a compare list the same
  pages. A ref sibling is reused only when its build finished (a stamp,
  `.parity/ref-build.json`, written after it): a build that failed its
  audit used to be reused silently the next time. An unstamped sibling is
  removed as a worktree before the prune, where deleting it first made the
  next `git worktree add` fail ("missing but already registered").
- The harness holds inline SMIL, which no CSS rule and no Web Animation
  pause reaches: a static capture (and `shot`, `probe`, `icons audit`, the
  `--states` shots) pauses every inline SVG's clock at its `data-rest`
  (seconds; else 0), and a `--motion` capture sets it before each frame to
  that frame's own time since the scroll step (0.15 s, 0.5 s, modulo
  `data-duration`) and the settled frame to its `data-rest` — a loop's
  frames no longer differ by the milliseconds a shot happened at, which
  forced re-runs. `data-rest` is the kit's convention for the frame a
  reduced-motion reader sees; the lab's `loop` template carries it. The
  animation inventory lists every inline SMIL loop (`type: "smil"`, its
  cycle, rest and box). An animated SVG in an `<img>` is out of reach and
  photographed as it runs. **Recapture baselines**: a static shot of a page
  with inline SMIL and every `.animations.json` of one change.
- `visual-parity compare --pages` judges the named pages' files on both
  sides, and of the before capture only the widths the after capture took.
  The value used to be read as a switch alone (judge every file of the
  after capture), so a partial capture against a full one reported every
  other page as `MISSING`, hundreds of lines on a motion capture; a frame
  of a named page that one side lacks is still `MISSING`. `routeName` is
  now the one route-to-file-name mapping the harness, `shot` and the
  compare share.
- `visual-parity compare` names the section behind a shift. A static
  capture writes `<page>@<width>.sections.json` beside each full-page shot
  (every `[data-section]`, else the header, `main`'s children and the
  footer, with its top and height in fractional pixels), and a `SIZE` or
  `CHANGED` page shot gets a `cause:` line — the first section whose height
  changed and by how much, `fractional` when not a whole pixel, or the
  first whose top moved when something above the sections changed — and
  `cause` in `--json`. A `reflow` from a section a quarter pixel taller,
  every row below it re-antialiased, used to be measured by hand each time.
  A capture without geometry compares as before and the compare names it.
  **Recapture baselines** (a new file beside every static shot).
- A lab timeline (`mountTimeline`, `LabTimeline`) drives only the
  animation it wraps: the inline SVGs inside it (their SMIL, and the CSS
  and Web Animations of what is inside them), anything under a
  `data-lab-drive` element of its own (motion made of HTML and CSS), and
  lab frames. Wrapped around a whole section it used to drive every
  animation under it — the kit's own reveals (`Fx`, `OnView`) too — which
  replayed the reveal every cycle, folded it flat on a scrub and stretched
  the cycle to the reveal's length. A candidate whose motion is HTML and
  CSS now marks its moving part `data-lab-drive`.
- `demo clean` removes everything a round created that nothing else uses.
  `demo new` writes the round's manifest beside the route (`demo.json`:
  the commit it starts from, what git did not track then, the component,
  the candidates); `clean` walks the route's imports through the files the
  round created only — the candidates, and whatever git says was added or
  left untracked since the round began — so an existing file (the
  section's component, a ui piece, the kit) stops the walk, then keeps
  every file something outside the round still imports (the piece the
  promoted section now uses), and removes the rest with its `module.css`,
  the round's pictures (`public/images/<name>-demo/`) and the stale route
  types. It lists what it keeps and why; `--dry-run` shows both lists and
  removes nothing. It used to remove the lettered candidates alone and
  keep a round's support files (a stage, a card face) as "the component
  the candidates started from", for hand removal. A demo from an older kit
  (no manifest) is cleaned as before.
- A loop the page runs: `InlineAnimation` (`agentic-cms/ix`) puts one of
  the site's own SMIL SVGs inline, waits on its first frame until it
  scrolls into view, plays from the start on each entry (`useReveal`),
  pauses off screen, and shows its `data-rest` frame under reduced motion;
  the svg fills the box from its own style attribute, so the first paint
  needs no site stylesheet. `readInlineSvg(file, { prefix })`
  (`agentic-cms/content`) reads the SVG when the page is built — a file
  the site owns, no code in it — with every id prefixed and its references
  followed. `lab render --out x.svg` keeps `data-duration` and `data-rest`
  on the root (it dropped `data-duration`). The SVG string helpers
  (`svgMarkup`, `tagRoot`, `namespaceIds`) and `readTrustedSvg` moved to
  `src/lib/svg.ts` and `svg-read.ts`; `agentic-cms/lab` re-exports them.
  `docs/lab.md` § Inline is the guide.
- `sheet` makes every inline SVG's ids its cell's own (`namespaceIds`): one
  file shown at three sizes on one sheet borrowed the first copy's mask,
  as a consumer site's hand-made preview did — the kit's sheet had the
  same flaw, and `icons audit`'s sheet with it. A cell may carry its own
  `size` and `ground` (`{ background, color }`, the ink a `currentColor`
  drawing takes), and a `files:` row — a folder walked for `.svg`, or a
  list — becomes one row per file with a cell per `sizes` × `grounds`: the
  24/36/96 px, light/white/black preview an icon round needs, with no
  script of its own. `sheet` and `icons` load the lab's helpers after the
  TypeScript loader, so a checkout of the kit runs its source.
- The fix for a dev server that fails every page with `Can't resolve
  '@vercel/turbopack-next/internal/…'` after a production build (stop it,
  `rm -rf .next/dev .next/cache/turbopack`, start it again) is in the site
  template's `AGENTS.md` gotchas and the `design-options` skill, where an
  agent restarting the server during a round reads it; it was in
  `docs/design.md` alone.
- `icons round new | publish | retire`: a design round for a set of the
  site's own icons, kept in the lab across sessions
  (`.parity/lab/rounds/<round>/`). `new` writes a scene per role and letter
  from the lab's `icon` or `mark` template, the round's record
  (`round.yaml`) and a sheet spec — a row per role, each letter at the
  round's sizes on paper, white and black — for `agentic-cms sheet`; the
  lab lists the round's scenes (`lab serve`, the lab route), and `lab
  clean` now keeps a round in progress and names it. `publish --pick
  role=letter,…` renders each pick where a page takes it — an icon as
  `src/config/icons/<role>.svg` with the icon map regenerated, a mark as
  `public/images/icons/<role>.svg` resolved for one scheme with its source
  beside it — and records it. `retire` removes the round and keeps
  everything it published; a round with nothing published needs
  `--force`, and `--dry-run` shows the lists. A consumer site built each
  round by hand: a generator, gallery rows, publish and retire steps, and
  preview scripts. The command line's contract takes a subcommand with
  subcommands of its own for it (parse, `--help`, `docs/commands.md`); the
  icon manifest update is a function (`updateIcons`) `icons add` and
  `publish` share.
- The README says what 0.5.2 is: the design skills and the commands under
  them (a section of its own), the proof harness (another), both hosts —
  the example's Cloudflare Worker and a Node server with `assemble` — the
  install at `v0.5.2`, and an upgrade section. `docs/upgrading.md` is new:
  the steps every upgrade takes, and a site's steps from 0.5.1 to 0.5.2 —
  the agent files and the lines a site's own `AGENTS.md` and edited rules
  take by hand, `assemble` for a standalone host, the baselines to
  recapture, `InlineAnimation` for a site's own inline loop, and what the
  lab, the design round and the sheet now do.
- `demo clean` without a name takes only the routes `demo new` wrote (its
  manifest, or the route header of a demo from before it) and keeps a
  site's own gallery in a `src/app/*-demo` folder — a dev-only review page
  a site keeps on purpose — and the lab's route, naming each; either goes
  only by its name. It used to remove every `*-demo` folder, and the
  design-options skill's verify step runs it bare.

## [0.5.1] — 2026-09-23

- `design-graphics` and its motion reference teach the join: a join is a
  pose of its own (approach, contact, overlap, settled shape); solid parts
  that become one surface grow an overlap along their internal boundaries
  or become one silhouette, the outer contour and negative space kept;
  the handoff keeps the pieces opaque until the master is fully present,
  because a crossfade between overlapping solid copies dips to three
  quarters opacity halfway; a seam is fixed in geometry and timing, not
  hidden with a blur, a stroke or a bigger mark; a fix leaves the approved
  motion around it alone. The reference's old advice — swap the pieces
  for the master on the frame where they meet — is replaced, and the
  check steps through the join a frame at a time and measures that solid
  artwork keeps full alpha inside its outline.
- One timeline for every animated preview (`agentic-cms/lab`): Play /
  Pause, Replay, a range over one cycle that holds the frame it is
  dragged or tapped to and steps 0.01 s an arrow key, the time and the
  cycle in seconds; labelled, with a visible focus ring and 44 px
  targets. A timeline drives everything inside it from one frame
  callback — each inline SVG paused and set with `setCurrentTime()`, each
  CSS animation by `currentTime`, each lab frame sought — so every copy
  of an animation (its sizes, colours, grounds, on screen or not) shows
  the same frame; two timelines are independent. The cycle is read from
  the file (`sceneDuration()`: `data-duration`, else its SMIL and CSS);
  a reader who prefers reduced motion gets it paused on the first frame
  until Play. `mountTimeline` is the engine, `LabTimeline` the client
  component; the lab's served page inlines the same engine. **Removed:**
  `LabControls`, `labControls` and `LAB_CONTROLS_HTML` (the page-wide
  scrubber they drove is gone; `LAB_API` stays for `lab render`).
- `LabStudy`, for a design round's demo route: an SVG the repository owns,
  inline at the sizes it ships at on the route's grounds under one
  timeline, with the still a render wrote beside it and a link that
  downloads the original. An animated file in an `<img>` cannot be
  paused or sought, so inspection uses inline copies and the file stays
  what ships. `demo new`'s route says so in its header.
- Every inline copy's ids are its own (`namespaceIds()`: masks, clip
  paths, gradients, `<use>` / `href` targets, SMIL begin/end, ARIA lists,
  `#id` selectors) — `LabScenes` repeated each scene's ids once per size
  and ground before. Only repository-owned SVG without script, event
  handlers or `javascript:` URLs goes inline (`readTrustedSvg()`).
- `LabScenes` gives each animated scene a timeline of its own instead of
  one scrubber over the page. The `design-graphics` and `design-options`
  skills, the reference, `docs/lab.md` (§ Inspecting motion) and
  `docs/design.md` tell an agent to put the timeline on every animated
  candidate. A browser suite checks it in Chromium and WebKit at desktop
  and phone widths.
- `lab serve`'s scene page is the review surface a loop needs. `--sizes`
  now applies to a scene of any width — the sizes a mark ships at — and,
  without the flag, an icon-sized scene still shows at 24, 40 and 64 (a
  bigger one at its own size; `--sizes 20,32` beside a wide scene now
  shows it at 20 and 32 too). One **enlarged** pair, light and dark, fits
  the screen up to 640 px and follows the scrubber. **replay** restarts the
  inline copies and moves every `<img>` copy to one new URL, so they keep
  sharing one image as on a page. **animated · still** switches the page to
  the scene with its animation stripped (`/scene/<name>?still=1`, also on
  `/files/…` and the bare page) — the `-still.svg` a render writes, what a
  reduced-motion reader gets. The `design-graphics` skill's step 4 and its
  reference say so, and no longer send those controls to the route.
- `design-graphics` starts from the artwork the site already has — its
  master file, exact colours, proportions, sizes and stated constraints —
  and keeps that master at rest and in every still. Motion for a mark is
  built from its parts and negative space, with the choreography
  (anticipation, separation, interaction, reassembly, a readable hold) as
  tools rather than a recipe and a subtle idea kept beside the expressive
  ones. A loop is judged on light and dark at its shipping sizes and
  enlarged, with replay, an animated / still switch and the reduced-motion
  still, from a direct URL; the frames between and the loop boundary are
  checked on the embedded `<img>`, in WebKit too when Safari matters (and
  reported as WebKit, not Safari); the picked artwork's editable source or
  generator is committed before `lab clean`. The SVG details — coordinate
  systems and origins, mask regions, seams, the master at rest, the loop,
  an animated `<img>` at several sizes — are a reference the skill links,
  `design-graphics/references/svg-motion.md`, synced to `.agents/skills/`
  with the rest.
- `design-options`: an ask to build every idea is honoured without a
  second selection question, and alternatives asked for beside a liked
  candidate join the same route under new letters, the candidates already
  shown (an approved one above all) left as they are. `docs/design.md` §
  The round says the same.
- `docs/lab.md` names the scene page and the bare page at any width (the
  URL to hand over, the enlargement) and says what to commit before `lab
  clean`.
- The skills test checks that every relative link in a skill resolves
  inside its own tree, in both copies.

## [0.5.0] — 2026-09-22

- `docs/design.md` gains "When the dev server will not serve": the
  `@vercel/turbopack-next/internal/…` resolve failures a `next dev`
  restarted after a production build hits (`rm -rf .next/dev
  .next/cache/turbopack`), and the stale route types a removed route
  leaves behind.
- `demo new` scaffolds a round for the chrome: `--component <file>` alone
  is enough, and the route then renders every candidate with no props and
  reads no page file (a footer, a navbar, a button takes its copy from
  `src/config/site.ts`). `--section` and `--component` together are
  unchanged, `--page` without `--section` is refused, and neither names
  what the candidates are for. `demo clean` now removes only the candidate
  files (`<Name><Letter>.tsx`) — the component they were copied from is
  never deleted, whatever imports it.
- The colon trap says what happened and what to do. A YAML scalar that
  contains `": "` is a mapping, so a sentence with a colon becomes a key:
  a field that expects text and receives one now fails with
  `paragraphs[0] is a mapping, not text: the line contains ": ", which YAML
  reads as a key — quote it ("Every request carries …")` instead of
  `must be a non-empty string`, and a parser error ("Nested mappings are
  not allowed…") keeps its line and gains the same fix. Detected in the
  engine's issue mapping, so every collection and every site schema gets
  it; a mapping where a mapping belongs is untouched.
- A page's `WebPage` structured data no longer has to describe software:
  `application` (and `organization`, which attaches to it) are optional, so
  a notice, a policy or any page of plain text declares `type: WebPage`
  alone and its block is the page itself — name, description, url and
  language — beside the breadcrumb the route emits. `organization` without
  an `application` is an error that says so.
- `LabScenes`: the route's scrubber is a client component, `LabControls`
  (React state over the inline `window.lab` clock), instead of a string
  the controls' script mutated before React hydrated — which logged a
  hydration mismatch on every load of the lab route. The lab's own served
  page, which has no React, keeps the string controls. The route test now
  fails on any console error through hydration.
- The command line answers every wrong input with the right one: a wrong
  command, subcommand or flag names the nearest ("did you mean"), a value
  outside a flag's `choices` lists them (`--scheme`, `--kind`,
  `--background` are choices in the spec now, validated in one place), a
  stray value after a repeatable flag says how to repeat it, and a command
  that reads the site refuses to run outside a site's root with the fix.
  `agentic-cms --help` is a map by family; every command carries examples
  in its `--help` and in `docs/commands.md`, which is now by family too.
  `lint` and `seo` print `--json`. Exit codes made true to the contract:
  `shot`/`probe` without a build, `parity` when the build fails and the
  optimisers on a missing file exit 2 with the fix, not 1 with a stack.
- The design round is a structured part of the kit. The `design-options`
  skill is rewritten as the six steps with the stops for the owner (after
  the ideas, after the look, after the build), the rule that a "more" is an
  edit on the route inside the round, the rule that a candidate's graphic is
  the meaning of the copy beside it, and the rule that generic pieces leave
  the section for `ui/` in the same job. `demo new <name> --section <type>`
  scaffolds the route from the registry and the page file — a candidate per
  letter as a copy of the section's component, the page's copy read from its
  file on every render, the section's real frame inside the site's own
  layout (its theme, its chrome), the current version last; `demo clean`
  removes the route, every component file it alone imported and next dev's
  stale route types (`lab clean` shares that step). `docs/design.md` § The
  round, with a worked example; the rules and the site template name it.
- `lab route`: the lab as a throwaway route inside the site,
  `src/app/lab-demo/page.tsx` from the kit's template, rendering
  `LabScenes` from the new `agentic-cms/lab` — every scene under
  `.parity/lab` inline on the site's own grounds (the page and a white card
  to start; the site adds its surfaces), at its size and the icon sizes,
  inside the real chrome, with the procedure for the person looking at it
  and one scrubber over the animated scenes (the same clock as the lab's
  page, inline, no library). A plain server component, so `next build`
  prerenders it and the SEO audit fails it — the guard; `lab clean` removes
  it with the lab (a site's own route at that path is left and named).
  The scene functions the command line and the route share moved into the
  package (`src/lib/lab/`); `scripts/lab.mjs` loads them through the
  TypeScript hook. `docs/lab.md` § The route.
- `lab new | serve | clean`: the design canvas for the site's own graphics.
  An SVG scene under `.parity/lab/` starts from a template on the kit's
  contracts (an icon on Icon's 24 grid, a mark on the 64 grid, a loop with
  the reduced-motion rule); `lab serve` shows every scene on the site's
  tokens read from `globals.css` (no build needed), inline in a light and a
  dark box and as an `<img>` on both grounds, with a scrubber over its SMIL
  and CSS animations, reloading on every save, on the LAN for a phone;
  `lab clean` removes it. `docs/lab.md`.
- `lab render`: one scene to the file a page ships, by the extension of
  `--out` — a `.svg` with the tokens resolved for one scheme (no browser
  needed), a still `.webp`/`.png`/`.jpg` at `--at`, or with `--animate` one
  cycle as an animated `.webp` (sharp, no ffmpeg) or a `.webm`/`.mp4`
  (ffmpeg: a system build, else the VP8-only one in Playwright's cache).
  The scene's clock is set frame by frame, so a render is deterministic; a
  loop writes its still beside it and a raster its source scene. An
  animated `<img>` never stops under reduced motion, so a loop ships as a
  `<picture>` with that still — the doc has the markup.
- `icons add file:<name>`: a third source beside Lucide and Simple Icons —
  the site's own drawing, `src/config/icons/<name>.svg` (rendered there from
  the lab), read as flat shapes with one paint; its root's paint decides
  the kind, its `viewBox` is kept off the 24 grid (`IconData.viewBox`,
  which `Icon` now applies), a group, transform, use, defs, style, mask or
  clipPath is refused with the fix.
- The `design-graphics` skill: the site's own graphics — an icon beyond
  the families, a mark, an illustration, a short 2D loop — drawn as SVG in
  the lab, judged on the tokens in both schemes and on a phone, shipped
  pre-rendered as the file a page embeds or as inline `Icon` data, the lab
  removed after; named beside the other design skills in the rules, the
  site template, `docs/skills.md`, `docs/design.md` and `STANDARD.md` §4.
  `docs/roadmap.md` lists what comes after it (three.js scenes, `Graphic`).

## [0.4.3] — 2026-09-20

- `icons add`: a `<line>`'s attributes (`x1`, `y1`, `x2`, `y2`, digits in
  their names) are read; they were skipped, so a Lucide icon drawn with
  lines (`server`, `terminal`'s siblings) got `NaN` paths, two console
  errors and missing strokes. Re-run `icons add <id>` for such an icon to
  regenerate the map.

## [0.4.2] — 2026-09-20

- `seo`: the page's `<title>` is counted in `<head>` only; an inline
  `<svg>` with a `<title>` (a named icon) no longer fails a page for having
  several. The icon family's spec is documented under `src/config/`, not
  `content/` (whose folders the content lint reads as collections).

## [0.4.1] — 2026-09-20

- `shot` and `probe` take `--heading` and `--select` together: the
  selector is searched inside the section that holds the heading.
- `init --agent-files` on a site that wrote its own rules before any
  manifest existed keeps them (they read as `modified`, the site's), where
  0.4.0 took them for stale and overwrote them; `--force` takes the kit's.

## [0.4.0] — 2026-09-20

The kit as an agent's design toolbox: six jobs, one release (`docs/roadmap.md`).

- Icons as families: `Icon` in `agentic-cms/components` (path data on the
  24 grid in the current colour, stroke or fill); `agentic-cms icons add |
  remove <id>…` keeps a site's manifest (`src/config/icons.json`) and
  generates its map (`src/config/icons.ts`, each set's licence in the
  header) from the sets the site installs — Lucide (`lucide:<name>`) and
  Simple Icons (`si:<slug>`); the kit ships no icon data. `agentic-cms icons
  family <spec>` renders a family of marks from primitives on one grid with
  named gradients (`--check` for drift). `agentic-cms icons audit` lists
  every icon on the built pages beside its copy, as JSON and a sheet. The
  `design-icons` skill; `docs/icons.md`; `STANDARD.md` §4 on families.
- The e-mail guard: `agentic-cms/email` (`encodeEmail`, `decodeEmail`,
  `isEmailToken`, `readableEmail` — a token that never carries the address
  as text), `EmailLink` in `agentic-cms/components` (the readable form
  until hydration, a `mailto:` link after), `withEmailToken` in
  `agentic-cms/forms` (a mailto form's recipient as a token; the backend
  resolves it at submit), and `agentic-cms guard-email` (fails a build
  whose served files carry an address at the site's domain as text). A
  site opts in; `docs/email.md` says how.
- Design works by default: four skills committed in the repo —
  `.claude/skills/` for Claude Code and `.agents/skills/` for Codex,
  identical (`pnpm skills:sync`), found from a checkout with nothing
  installed — `design` (the loop from the wireframe to a look), `design-options`
  (candidates the owner picks by row), `design-measure` (a screenshot claim
  into numbers), `design-proof` (the pixel proof before a merge); a `design`
  rule for `src/`; `docs/design.md`, `docs/skills.md`.
- `agentic-cms init [dir]`: a site from the package — the wireframe
  example, a site's `AGENTS.md`, rules and the skills, the config
  (`package.json` merged, never overwritten), a manifest of the agent files;
  `init --agent-files` refreshes the rules and skills after a kit upgrade
  keeping the site's own edits, `--check` reports drift for CI. The package
  now ships the example, the templates, the skills and `docs/` (`files`);
  the pack smoke lays its scratch site out with `init`. `docs/init.md`.
- `visual-parity compare` on two pages of different heights no longer stops
  at `SIZE`: it compares row by row from the top and the bottom and reports
  the first differing row, the intact tail, the band that changed on each
  side and a verdict — `shift` (one section changed and moved the rest
  intact), `insert`, `remove`, `reflow`, `width` — with crops of the band in
  the diff directory; a same-size `CHANGED` line names the rows that
  changed. `--json` prints the report (always written as `report.json`).
- `visual-parity capture --build` (the site's build first), `--ref <git
  ref>` (a baseline: that commit checked out, installed and built in a
  sibling directory, served and captured, its sha in the capture), `--json`
  (the summary), and `capture.json` written last as the sign a capture
  finished. `--url`, `--build` and `--ref` are three sources of one build.
- The settled motion frame is `--s<nn>-settled.png` (was `-2000.png`) and
  waits `--settle` ms (2000) or longer when an element in view declares
  `data-settle="<ms>"`; `<page>.settle.json` records each step's wait and
  compares like the animation inventory. **Recapture motion baselines.**
- The harness reads the site's config (`src/kit.ts`) only for `--states`,
  so a static or motion capture and a compare run on any build.
- `agentic-cms shot <route|url>`: one screenshot of a page or of an element
  (`--select`, or `--heading` for the section holding a heading), prepared
  like the harness prepares a page, at any width, scale and scheme, cropped
  with a margin, isolated on a transparent ground (`--transparent`),
  trimmed, resized, as PNG or WebP; `--json` prints the element's box.
- `agentic-cms probe <route|url>`: the numbers behind a screenshot claim,
  as JSON — an element's box, computed styles and the chain of stacking
  contexts above it (with the property that creates each), a timeline of
  its opacity, transform and position under `--motion`, the reveals still
  pending on the page, the console's errors.
- `agentic-cms sheet <spec>`: a candidate sheet from a YAML or JSON spec —
  rows lettered, cells numbered, each candidate (a file, inline SVG, markup
  or a served image) at the real size on the real background, the site's
  stylesheets linked — rendered to one picture for a pick by row.
- `scripts/lib/browser.mjs` gains the helpers the three share (a target by
  selector or heading, the harness's preparation, console collection,
  isolation, the stacking chain); `docs/shot-probe-sheet.md` has the recipes.
- The command line is strict: an unknown flag is an error that names the fix
  (`run agentic-cms <command> --help`) instead of being ignored; every
  command has `--help`, with its flags, defaults and exit codes generated
  from one spec (`scripts/lib/specs.mjs`), and `agentic-cms` alone lists
  the commands. `visual-parity capture --motion --states` is now an error
  (it was two captures pretending to be one).
- `docs/`: `commands.md` (generated from the specs, checked by CI),
  `visual-parity.md` (the harness's contract, out of the script's header),
  `roadmap.md`.
- The browser code the harness shares with the coming one-shot commands is
  `scripts/lib/browser.mjs`; the harness behaves as before. Chromium is
  found in Playwright's cache on Linux, macOS and Windows (builds sorted by
  number, so `chromium-1000` no longer loses to `chromium-999`), and a
  missing build is an error that names the install command.
- Repo hygiene: this changelog; CI (`.github/workflows/verify.yml`: lint,
  tests, build, the hygiene check, the browser suite with a Chromium, the
  pack smoke on `main`); `tools/hygiene.mjs` (`pnpm hygiene`: no one site's
  name, no machine paths, no captures or scratch committed, the skills trees
  in step, the changelog and the generated docs current); `pnpm
  test:browser` (the Chromium-backed suite, skipped with a reason without
  one).

## [0.3.3] — 2026-09-19

- seo: the organisation's e-mail is optional in the structured data
  (`SiteConfig.email?`); without it the Organization carries no `email` and
  a ContactPoint carries the page's URL.

## [0.3.2] — 2026-09-19

- visual-parity: the capture scrolls through a page that grows (the height
  is re-read at every step, so lazy images loading during the pass no longer
  stop it short of the footer).

## [0.3.1] — 2026-09-19

- ix: reveals and sequences replay only after the element has left the
  viewport entirely, never while it is still partly on screen.

## [0.3.0] — 2026-09-18

- The package, its command line and its marketplace renamed from
  `content-engine-kit` to `agentic-cms`; the engine unchanged since 0.2.0.

## [0.2.0] — 2026-09-17

- The kit as a package: `createKit()`, the `content`, `blog`, `seo`, `forms`
  and `ix` exports, the `agentic-cms` command line, the `editorial` plugin
  for Claude Code and Codex, the example site consuming it.
