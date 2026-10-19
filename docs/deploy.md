# Deploying a site

Every page is prerendered at build time whatever the host. The kit
supports two: a Cloudflare Worker, as the example deploys (the next
section), and a Node server running Next's standalone output, on a
container or an app service (from § The build on), with the notes for
[Google Cloud Run](#google-cloud-run) and
[Azure App Service](#azure-app-service) at the end. The flags are in
[commands.md](commands.md); the traps by topic are
[gotchas.md](gotchas.md).

## Cloudflare Workers

The example's host, through OpenNext (`open-next.config.ts`,
`wrangler.jsonc`; `init` copies neither, so a site that deploys there takes
them from the example with its scripts):

```bash
pnpm preview       # build for Cloudflare and serve the Worker locally on :8000
pnpm run deploy    # build and deploy; `deploy` alone is a pnpm built-in
pnpm upload        # build and upload a version without deploying it
```

- **No placeholder deploys.** `opennextjs-cloudflare build` runs the
  site's `pnpm build`, whose content lint (`--production`) fails while the
  starter's placeholder copy or address remains
  ([init.md § The starter](init.md#the-starter)), so `pnpm run deploy` and
  `pnpm upload` stop there, naming each.
- **Static-only.** The Worker serves the prerendered pages from its
  static-assets cache and has no filesystem at request time; the form
  endpoint is the one route that runs per request. `revalidate`,
  on-demand revalidation or a request-time read needs OpenNext's R2
  incremental cache first.
- **500s straight after `next build`.** `next start` and `wrangler dev`
  on a plain Next build answer 500: only `pnpm preview`, `pnpm run deploy`
  and `pnpm upload` fill the asset cache the Worker reads.
- **About 40 "Failed to copy node_modules/…" lines** during the OpenNext
  build are an OpenNext bug and harmless.
- **No native modules under `src/`.** Everything there is bundled for the
  Worker, code that only runs at build time included: `sharp` breaks the
  bundle (`image-size` is the pure-JS alternative); `scripts/` is not
  bundled.
- **The form endpoint's destination** is a Worker secret
  (`wrangler secret put FORM_WEBHOOK_URL`, the same for the secret;
  [forms.md](forms.md)).

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
"build": "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms critical-css && agentic-cms seo && agentic-cms guard-email && agentic-cms assemble",
"preview": "pnpm build && HOSTNAME=0.0.0.0 PORT=8000 node .next/standalone/server.js"
```

(`guard-email` belongs there only on a site that keeps its address out of
the HTML; [email.md](email.md); `critical-css` is the next section.) What
deploys is the `.next/standalone` folder, whose start command is
`node server.js`.
Nothing of the starter's placeholders deploys: the content lint fails on
them before `next build` (`lint --production`), and `assemble`
packages nothing while one remains, naming each by line — unless the run's
environment says `AGENTIC_CMS_PLACEHOLDERS=warn`, which only a CI build
that deploys nothing sets ([init.md § The starter](init.md#the-starter)).

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

## Google Cloud Run

A Node server in a container, so everything above applies:
`output: "standalone"`, `agentic-cms assemble` as the build's last step
(never a hand-written `cp`), and `HOSTNAME=0.0.0.0` in the container, so
the server listens on every interface rather than the container's
hostname. Cloud Run sends traffic to the port in `PORT` (8080 unless the
service says otherwise), and the standalone server reads it. The form
endpoint's destination goes in the service's environment, or in its
secrets.

## Azure App Service

The package from § The build, deployed as a zip, plus the platform's own
settings:

- **Turn Kudu's build off** (`SCM_DO_BUILD_DURING_DEPLOYMENT=false`): the
  package is built already, and Kudu would install and build it again on
  the server.
- **Session affinity (ARR affinity) is on by default** and sets a cookie
  before the visitor's consent. Turn it off for a stateless app, and
  again on every new slot, which starts with it on.
- **Slot settings are copied once,** when a slot is made: a new app
  setting goes on every slot by hand.
- **There is no auto-swap on Linux:** deploy to the staging slot, check
  that it answers 200, then swap.
- **Deploy with `clean: true`,** or files deleted from the package stay
  live on the server.
- **An organisation's OIDC subject can carry ids.** GitHub lets an
  organisation customise the subject claim, and then the plain
  `repo:<owner>/<repo>:…` form of a federated credential does not match:
  copy the subject the failed login names.
- **Managed certificates need the Cloudflare proxy off** (DNS only) for a
  domain whose DNS is there, or the certificate is not issued.
- **An app registration's client secret expires** (the sign-in in front of
  a slot, a deploy credential that is not OIDC): put the date in a
  calendar.
