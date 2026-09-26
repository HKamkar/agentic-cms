# Changelog

Every release of `agentic-cms`, newest first; a pull request adds its lines
under Unreleased, and the release commit renames that heading. A line that
changes what a capture writes says **recapture baselines**.

## [Unreleased]

- `visual-parity capture --jobs <n>`: several browsers at once, each taking
  the next page-width (or state). The default is every core but one, four at
  most, for a static or `--states` capture, and two for `--motion`, whose
  frames are timed; `capture.json` records it. The shots are the same: on
  the example 157 s to 60 s static (82/82 identical), 199 s to 109 s motion
  (295/295), 26 s to 12 s states (8/8), on a consumer site's six pages 173 s
  to 85 s (50/50), with a 4-core machine.
- Unchanged shots are reused. After every page-width (or state) a capture
  records the build files the page requested, with their digests, under
  `.parity/shots/`; a later capture of any build — a `--ref` baseline, the
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
  identical on the example and on a consumer site, apart from a home page
  whose own 6 s timer runs from mount.
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
