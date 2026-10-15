# Gotchas

Traps a site on the kit has already paid for once, by topic, so the next
one does not pay again. Each entry is the symptom, the reason, and what to
do. Read the section for what you are about to touch before you start.

Nothing here names a site, a host account or a machine: an address is
written `<lan-ip>` or `<public-ip>`, and evidence is a measurement.

## Where the kit already covers a trap

These are written once, where the code they describe lives; read them
there.

| Trap | Where |
|---|---|
| An eager `<img>` in a server component is downloaded by every page that prefetches a link to it | `STANDARD.md` §4; `EagerImage` (`agentic-cms/components`) |
| The dev server fails every page with `Can't resolve '@vercel/turbopack-next/internal/…'` after a build; a removed route still fails the type check (`validator.ts`); a utility the build has and the dev page lacks | [design.md § When the dev server will not serve](design.md#when-the-dev-server-will-not-serve) |
| `text-base` / `text-sm` set a line-height; two colour utilities on one element resolve by stylesheet order; preflight's zeroed margins, paddings and list markers; `h-auto` beside a `height` attribute | the styling rule (`.claude/rules/styling.md`) |
| A timeline far down a page still running while off screen | [lab.md § Inspecting motion](lab.md#inspecting-motion--the-timeline) (it stops off screen) |
| Critical CSS for a state a script sets after load | [deploy.md § Critical CSS](deploy.md#critical-css) (rules keyed on `data-` and `aria-` attributes are kept whole) |
| `HOSTNAME`, the standalone package, a `cp` that nests `public/` | [deploy.md](deploy.md) |
| `next start` or `wrangler dev` answering 500 straight after `next build` | [deploy.md § Cloudflare Workers](deploy.md#cloudflare-workers) |
| A consent banner over every screenshot | [visual-parity.md § A visitor's choice, seeded](visual-parity.md#a-visitors-choice-seeded) |
| Starting and stopping the dev server, the addresses to hand over | [dev-server.md](dev-server.md) |
| What headless Chromium and WebKit cannot show; the engines' differences | [browsers.md](browsers.md) |

## Next.js

- **A page that renders but never hydrates.** On a phone, another
  computer or a VM's public address the page shows, but nothing on it
  works: reveals stay hidden, buttons do nothing. `next dev` serves its
  scripts and hot reload only to `localhost`, its subdomains and the
  hostname it was started with, and refuses every other origin. List the
  other hostnames in `ALLOWED_DEV_ORIGINS` in `.env.local` —
  comma-separated, hostnames only, no scheme and no port — which the
  site's `next.config.ts` reads into `allowedDevOrigins`, and restart the
  dev server ([dev-server.md](dev-server.md)). A script that opens the dev
  server uses `localhost`, not `127.0.0.1`, which is refused the same way.
  `-H 0.0.0.0` is not needed: `next dev` listens on every interface by
  default.
- **`experimental.inlineCss` makes every page heavier.** It writes the
  CSS twice, into the HTML and into every prefetch payload: a home page
  went from 23 to 93 KB gzipped. Leave it off; `agentic-cms critical-css`
  inlines only the rules the first paint needs
  ([deploy.md § Critical CSS](deploy.md#critical-css)).
- **A redirect that is not the one you meant.**
  - `permanent: true` sends a 308. Where a 301 is meant (a move search
    engines already know as one), write `statusCode: 301` instead of
    `permanent`.
  - An empty `:path*` comes out as the literal token in the destination,
    so a www → apex redirect takes two rules: one for `/`, one for
    `/:path+`.
- **A CI build that fails on fonts.** `next/font/google` fetches the font
  files during the build, and a network hiccup fails the run. Re-run it
  once; the lasting fix is self-hosting with `next/font/local`, which
  fetches nothing.

## Tailwind v4

- **Grid items that span into implicit columns collapse.** An item placed
  or spanned past the explicit `grid-cols-N` lands in implicit columns,
  which are sized by `grid-auto-columns` (`auto` by default) and shrink to
  their content. Add `auto-cols-fr`.
- The rest of the utility traps are the styling rule's (the table above).

## CSS, SVG and performance

- **Motion that widens the page.** A decoration that moves past its box
  (a drift, a slide-in) makes the page scroll sideways on a phone while it
  runs. It clips its own box (`overflow-x: clip` on the element that
  holds it) and travels in `cqw` of that box, not in pixels or `vw`.
  Measure `document.documentElement.scrollWidth` against `clientWidth`
  while the animations run, at the narrowest width the site supports.
- **An SVG at 300 × 150.** An SVG with only a `viewBox` has no natural
  size; inside a box that shrinks to its content it falls back to the
  browser's default, 300 × 150, at every screen width. Give the root its
  `width` and `height` (the lab's drawing rules,
  [lab.md § Drawing rules](lab.md#drawing-rules)).
- **Text in an SVG shown as `<img>` overflows.** An image document cannot
  use the page's web fonts, so its text falls back to system fonts, whose
  widths differ between engines and systems. Measure every text line in
  Chromium and WebKit (`getBBox()` on each `<text>`) and leave about 10%
  spare; or draw the text as paths.
- **A `<source media>` Safari ignores.** Safari before 16.4 ignores the
  range syntax (`(width < 768px)`) in a `<source>`'s `media`. Write
  `not all and (min-width: 768px)`, which is also what the compiled CSS
  uses.
- **A loop that costs while nobody sees it.** Animations the compositor
  cannot run on its own — `stroke-dashoffset`, a filter, anything but
  `transform` and `opacity` — tick the main thread even off screen. Pause
  them off screen (an `IntersectionObserver`; the kit's `InlineAnimation`
  does it for an inline SVG): desktop blocking time went from 260 to
  20 ms.
- **A design-tool export that weighs more than it looks.** An SVG can
  carry a full-HD bitmap inside it, or a filter on every repeated shape.
  Open the file and look before re-encoding it: removing the hidden part
  usually beats any optimiser (`optimize-svg-rasters`).

## Measuring

- **Lighthouse is not the browser.**
  - Chrome's paint holding delays the first paint by about 1 s under
    Lighthouse, and not in Playwright: compare like with like.
  - A local HTTP/1.1 proxy in front of the build inflates the simulated
    timings.
  - On a VM, total blocking time swings by about ±200 ms between runs:
    take 7 runs, interleaving the two builds you compare, and read the
    median.
  - Request counts and byte counts are exact: trust them first.
- **A new build step is proved with the whole build.** Run the full
  `pnpm build` and read its output, never the step alone on a sample: a
  step that rewrote the HTML once broke 234 `alt` attributes that a test
  on one page did not show.

## pnpm

- **A script that cannot find a package the kit uses.** pnpm resolves only
  the site's direct dependencies from the site's own files, so a site
  script that imports a dependency of the kit (`image-size`, say) fails
  with `ERR_MODULE_NOT_FOUND`. Add it to the site's `devDependencies`.
- **No pnpm on Node 25 and later.** Those releases ship no corepack. Run
  `npm install -g pnpm@<version>` with the version `packageManager`
  names ([setup.md](setup.md)).
- **A script named like a built-in.** `deploy` and `setup` are pnpm
  commands of their own, so `pnpm deploy` and `pnpm setup` never run the
  site's script of that name: write `pnpm run deploy`, `pnpm run setup`.

## Git and GitHub

- **Splitting a mixed working tree into commits.** Rebuild each
  intermediate state from `HEAD` with scripted edits (a file written whole,
  a `sed` over named lines), commit it, and go on to the next; it is safer
  than `git add -p` on files where the two changes touch the same lines.
- **`gh pr edit` fails** on a repository that hit the Projects (classic)
  deprecation (`GraphQL: Projects (classic) is being deprecated`). The REST
  API does the same edit:
  `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f base=develop` (or
  `-f title=…`, `-F body=@body.md`).
- **A merge that takes a commit nobody checked.** Where auto-merge is off,
  merge once CI is green with the head you checked pinned:
  `gh api -X PUT repos/<owner>/<repo>/pulls/<n>/merge -f sha=<head sha>`
  (a merge commit by default). GitHub refuses it when a push landed after
  the check.
- **Stacked pull requests.** `gh pr merge --delete-branch` on a pull
  request that is the base of the next one closes the next one instead of
  retargeting it. Merge the base without `--delete-branch`, retarget the
  next (`--base develop`), then delete the branch.
- **A reference worktree** made by hand needs its own `pnpm install`: a
  symlinked `node_modules` breaks Turbopack. `visual-parity capture --ref`
  does the worktree, the install and the build itself
  ([visual-parity.md](visual-parity.md#where-the-build-comes-from)).

## Services, if used

- **Form submissions marked as spam.** A form provider can flag every
  submission whose page's host is not in the provider's allowed or site
  domains: a new domain, a preview host, a staging slot. Check that list
  first, before the form's code.
- **An analytics event after a Reject.** GA4 can send one event that was
  measured before the visitor's Reject about 3 s after it. That is
  Google's behaviour, not a consent bug
  ([consent.md § GA4's own settings](consent.md#ga4s-own-settings)).
