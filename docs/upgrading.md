# Upgrading a site

A site pins the package by tag (`github:HKamkar/agentic-cms#v<x.y.z>`). Every
upgrade starts the same way:

```bash
pnpm add agentic-cms@github:HKamkar/agentic-cms#v<next>
pnpm install
pnpm exec agentic-cms init . --agent-files --check  # what differs from the kit's rules and skills
pnpm exec agentic-cms init . --agent-files          # the kit's new rules and skills in; the site's own edits kept
```

`--agent-files` rewrites a rule or a skill the site never edited and keeps
one it did (it says `modified`); a kept file takes the release's change by
hand, from the list below. `AGENTS.md` is the site's own from the day `init`
wrote it and is never rewritten: a release's new lines for it are listed
too. Then the release's own steps, `pnpm build`, `pnpm test`, and a new
baseline for the screenshot harness when the release changed what a capture
writes (`CHANGELOG.md` marks each such line **recapture baselines**).

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
