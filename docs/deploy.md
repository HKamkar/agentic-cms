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
"build": "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email && agentic-cms assemble",
"preview": "pnpm build && HOSTNAME=0.0.0.0 PORT=8000 node .next/standalone/server.js"
```

(`guard-email` belongs there only on a site that keeps its address out of
the HTML; [email.md](email.md).) What deploys is the `.next/standalone`
folder, whose start command is `node server.js`.

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
- **The server renames itself `next-server`.** Find a stale one by the
  port it holds (`ss -ltnp`), not by a pattern on its path.
