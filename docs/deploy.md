# Deploying a site as a Node server

Every page is prerendered at build time whatever the host. The example
deploys as a Cloudflare Worker (`pnpm preview`, `pnpm run deploy`; the
README). This page is the other host the kit supports: a Node server
running Next's standalone output, on a container or an app service. The
flags are in [commands.md](commands.md).

## The build

```ts
// next.config.ts
const nextConfig: NextConfig = { output: "standalone" };
```

`next build` then traces `server.js` and the `node_modules` it imports into
`.next/standalone/`. It leaves `public/` and `.next/static` out; the host
copies them in. `agentic-cms assemble` does that copy and then proves the
package complete, as the last step of the build:

```json
"build": "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms critical-css && agentic-cms seo && agentic-cms guard-email && agentic-cms assemble",
"preview": "pnpm build && HOSTNAME=0.0.0.0 PORT=8000 node .next/standalone/server.js"
```

(`guard-email` belongs there only on a site that keeps its address out of
the HTML; [email.md](email.md); `critical-css` is the next section.) What
deploys is the `.next/standalone` folder, whose start command is
`node server.js`.

## Critical CSS

A prerendered page cannot paint until every stylesheet it links has
arrived: the HTML, then the CSS, then the first frame. On a slow connection
that round trip is most of the wait; Lighthouse lists it as render-blocking
requests. `agentic-cms critical-css`, right after `next build`, removes it:

- each page gets the rules its own HTML uses inlined in a `<style>`
  ([Beasties](https://github.com/danielroe/beasties) does the inlining);
- its stylesheets still load, whole and cached for the next page, but no
  longer block the first paint (`media="print"` until they arrive, with a
  `<noscript>` fallback for visitors without scripts);
- every `@font-face` of the page's stylesheets goes in too, its URLs
  resolved, because fonts named through CSS variables (next/font) give the
  inliner no family to follow, and a first paint in a fallback font would
  swap a moment later;
- rules it cannot judge from the built HTML are kept whole: Tailwind's
  arbitrary variants (`[&_svg]:size-4`), and states a script sets
  afterwards (`[data-theme=dark]`, `[aria-expanded=true]`).

It rewrites the pages in `.next/server/app` and the standalone package's
copy, changing nothing in them but the inserted `<style>` and the
stylesheet links, and leaves a page it has done alone, so it can run
twice. A page
gains its inlined rules (on a site of the kit, 7 to 12 KB gzipped);
moving between pages inside the site does not, since those navigations
fetch no HTML. Measured there on a throttled phone (slow 4G, a CPU four
times slower), the first paint came about half a second sooner. Pages
regenerated at request time are not covered, and the stylesheet swap is an
inline `onload` handler, which a strict Content-Security-Policy has to
allow by its hash. The example's Worker build does not run it.

```bash
agentic-cms critical-css --check          # change nothing; exit 1 naming each page that still waits for a stylesheet
agentic-cms critical-css --check --json   # { dirs, pages, inlined, skipped, bytes, blocking }
```

To check that the inlined rules are complete, load a page with its
stylesheets blocked: the first screen should match the normal render.

## Why a command, not a `cp`

The copy is two lines of shell, and one way of writing them fails silently.
`cp -r public .next/standalone/` merges into the package's `public/` folder.
`cp -R public .next/standalone/public`, which names the folder as the
target, only works while that folder does not exist yet.

Server code that reads a file under `public/` while a page is prerendered
(an animated SVG put inline, say) changes that. The file trace then creates
`.next/standalone/public` for that one file, and the copy lands at
`public/public`. The one traced file is served; every other image is a 404
on the deployed server, and nothing in the build fails.

`assemble` avoids that and checks the result:

- it copies the contents of `public/` and `.next/static` into the
  package's folders, never the folders onto them, merged with what the trace
  put there;
- it removes a nested copy an earlier step left;
- it checks every file of both sources in the package by size and hash.

It exits 1 naming each file that is missing, that differs, or that sits in
a copy nested inside the folder it should fill.

## The check alone

```bash
agentic-cms assemble --check          # copy nothing; exit 1 naming what is missing, different or nested
agentic-cms assemble --check --json   # { package, copied, removed, parts, missing, differ, nested, extra }
```

`--check` is for CI after a packaging step of its own, or before a zip
deploy. A file in the package that has no source (`extra`) is listed, not
failed.

## What the host needs besides the package

- **A flat `node_modules` for a zip deploy.** pnpm's symlinked layout does
  not survive a zip. `nodeLinker: hoisted` in `pnpm-workspace.yaml` gives the
  trace real files to copy.
- **`HOSTNAME=0.0.0.0`.** Without it the standalone server binds to the
  container's hostname and the platform's health check cannot reach it.
- **A trace root above the site** (`outputFileTracingRoot`, a monorepo).
  Here the app sits at `.next/standalone/<relativeAppDir>`, as
  `.next/required-server-files.json` names it; `assemble` follows it.
- **The form endpoint's destination.** A site whose forms post to its
  route sets `FORM_WEBHOOK_URL` and `FORM_WEBHOOK_SECRET` as the host's app
  settings, on every slot or environment that serves the site; without
  them the route answers 503 and the form shows its error message
  ([forms.md](forms.md)).
- **The server renames itself `next-server`.** Find a stale one by the
  port it holds (`ss -ltnp`), not by a pattern on its path.
