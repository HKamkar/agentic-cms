# This site: the rules for any agent working on it

The site is built on `agentic-cms` (the package under `node_modules/`,
pinned by tag in `package.json`): the content, blog, SEO and form engines,
the reveal library, the command line and the skills come from it; this
repo holds what is the site's — the design, the content, the config, the
docs. An engine change is a kit pull request, then a bumped tag here; never
a patch under `node_modules`.

- `STANDARD.md` is the design system and the way pages are built on it:
  tokens, type, spacing, markup, images, components, the section anatomy,
  motion, the page recipe, and §8, the register of decisions that look like
  bugs on purpose. Read it before writing any markup or CSS; the component
  catalogue is `src/components/README.md`. Design work starts with the
  `design` skill (`.claude/skills/`, `.agents/skills/` — found from this
  checkout with nothing installed); a look the owner has to choose goes
  through `design-options`, a screenshot claim through `design-measure`,
  icons through `design-icons`, the site's own graphics (drawn as SVG in
  the lab, `pnpm kit lab`, shipped pre-rendered) through `design-graphics`,
  and nothing merges without `design-proof`.
- Content is files under `content/`, validated at build time: posts in
  `content/blog/` (the filename is the slug), the registries, `reviews.yaml`,
  `faqs/<key>.yaml`, `use-cases.yaml`, and a page per file in
  `content/pages/<slug>.yaml` (its `seo` block, its structured data, its
  sections in order). The door for editing is `content/README.md`; the
  templates are `content/_templates/`; the voice and claim rules are
  `content/VOICE.md`, enforced by `agentic-cms lint` first in `pnpm build`.
  The content jobs are the `editorial` plugin (`/editorial:write-post`,
  `new-post`, `update-post`, `new-page`, `review-voice`, `content-status`,
  `retire-content`), enabled by `.claude/settings.json` from the kit's
  marketplace. Never read `content/` at request time: every page is
  prerendered.
- The engines' contracts are `node_modules/agentic-cms/src/lib/*/README.md`
  (`content`, `blog`, `seo`, `forms`); the command line is
  `node_modules/agentic-cms/docs/commands.md`, the screenshot harness
  `docs/visual-parity.md`, the one-shot page commands
  `docs/shot-probe-sheet.md`, the design loop `docs/design.md`.
- Brand names, links and the chrome's text come from `src/config/site.ts`;
  every page is served by this app, so links stay relative. Public URLs do
  not change without redirects.
- SEO is a contract, not a checklist: the page file's `seo` block feeds
  the head, its `jsonld` block the structured data; `pnpm build` audits every
  prerendered page (`agentic-cms seo`) and fails on a missing field. Never
  hand-write head tags.
- Verify = `pnpm lint` + `pnpm test` + `pnpm content:lint` + `pnpm build`
  (the content lint first, the SEO audit last), 0 failures, before calling
  a change done; `pnpm kit visual-parity` before a merge that touches
  `src/`, styles or images.

## Styling

- Utilities for layout, spacing, type, colour, visibility and hover/focus; a
  `<Name>.module.css` beside the component only for what utilities cannot
  say (layered or gradient backgrounds, keyframes, backdrop filters, a
  static transform on an animated element). Plain CSS, breakpoints spelled
  out, joined to utilities with `cx()`.
- Tokens only in the `@theme static` block of `src/app/globals.css`;
  per-breakpoint values in `src/styles/base.css`. A colour becomes a token
  at its second use. Never `text-base` / `text-sm`: the type scale is the
  site's. One colour utility per property per element.
- Preflight zeroes margins, paddings, borders and list markers: never
  `m-0`, `p-0`, `list-none`.
- Animation targets are `data-ix` attributes through `ix(name)`, never a
  styling class; start states live in `src/styles/motion.css`; no
  `translate-*` / `rotate-*` / `scale-*` utility on an element the reveal
  library moves; every animated component checks `useReducedMotionPref()`;
  a sequence longer than two seconds declares `data-settle` on its section.
- Decorative elements are real `aria-hidden` elements, not pseudo-elements.
  No emoji and no symbol characters platforms render as emoji in the UI: an
  icon is an SVG. Interactive things are real `<button>`s and links; no
  `outline-none` on anything a keyboard reaches.
- Images stay `<img>` with `width`, `height` and `alt`; above the fold in a
  server component `EagerImage` (`agentic-cms/components`), everything else
  `loading="lazy"`.

## Gotchas

- Next 16: `params` is a Promise; `await params` in `generateMetadata` and
  the page. Run `pnpm install` first: `node_modules/next/dist/docs/` is
  absent until then, and it is the Next this version is, not the one you
  remember.
- The kit's commands and `pnpm test` load the site's TypeScript through
  `agentic-cms/loader` (Node strips the types; the hook resolves `@/` and
  extensionless imports). Code that must stay loadable that way —
  `src/kit.ts`, `src/config/site.ts`, `src/config/forms.ts`,
  `src/components/sections/schemas.ts` — uses `import type`, no `enum`, no
  parameter properties, no `.tsx` and nothing from React.
- The dev server can miss utilities a file starts using (the CSS scan is
  cached under `.next/dev`): a class the production build has but the dev
  page lacks means `rm -rf .next/dev` and a restart, not a bug.
- `pnpm build` fails a route without an `seo` block; a demo route
  (`src/app/<name>-demo/`) is therefore removed before a branch merges — the
  guard, not an obstacle.

## Parity harness and long runs

The contract is `node_modules/agentic-cms/docs/visual-parity.md`. The rules:
a baseline is `capture <label> --ref <commit>`, never a checkout that moved
on; never build, edit `public/` or move assets while a capture runs; a
static or settled frame never jitters, a mid-flight one may (re-run once);
a `reflow` verdict or a diff on every text line below one section means a
stacking context flipped the compositor (`pnpm kit probe` prints the chain);
long captures run in the background and are finished when
`.parity/visual/<label>/capture.json` exists; commit each proven state
before the next change; `.parity/` is gitignored and grows fast.

## Process

- Plan first, edit second: a non-trivial change is proposed and approved
  before editing. Typos and one-line tweaks need no plan.
- Match scope to the ask: a bug fix is not a refactor is not a redesign;
  drive-by cleanups are separate suggestions.
- Design choices go to the owner as candidates (`design-options`): a sheet
  for static ones, a demo route on the dev server for live ones, the current
  version beside them, at the real size and colour; the owner picks by row.
  One preview round, one build.
- One instance means the class: a report of one template glyph, one
  hard-coded value, one unaligned card is a report of every one of its
  kind; inventory the class first (`pnpm kit probe … --all`, `grep`, a
  sheet) and fix it in one job.
- Reading a screenshot: measure, don't guess (`design-measure`). "It looks
  broken" is resolved with `pnpm kit probe` and `pnpm kit shot`, not by
  eyeballing.
- A pick from a sheet is not the owner's look at the built thing: build it,
  show it on the dev server, ask, then merge.

## Git workflow

- Every change on a branch off `develop` (`feat/<slug>`, `bugfix/<slug>`,
  `refactor/<slug>`, `docs/<slug>`), committed and pushed there, shown on
  the dev server; the branch goes into `develop` only after the owner has
  looked and said so. The harness proofs are necessary, not sufficient: a
  pixel-identical end state says nothing about whether a design change
  looks right, and that judgement is the owner's.
- `main` is stable and only receives pull requests from `develop`; a merge
  into `main` is a release.
- Stage per commit, exactly; read `git status` before every commit. Commit
  messages carry no AI attribution: no `Co-Authored-By: …`, no "Generated
  with…" footers.
- One pull-request-sized job per session, ending at a committed, proven
  boundary; `PLAN.md` and the memory are the handover.
