# Redirects as content

An indexed URL never changes without a redirect. A site's redirects are a
content file, `content/redirects.yaml`, which the build checks against the
pages and the posts and `next.config.ts` serves, so a page that goes does
not quietly become a 404 and no host's own redirect format is involved.

## The file

A list, one entry per old path (the template is
`content/_templates/redirect.yaml`, the schema
`content/_schemas/redirects.json`):

```yaml
# yaml-language-server: $schema=./_schemas/redirects.json
- from: /old-pricing          # the path that was indexed
  to: /pricing                # where its readers go now
- from: /blog-post/2019-launch
  to: /blog
- from: /spring-offer
  to: https://shop.example.org/spring
  permanent: false            # 307: the move is temporary
```

- **`from`** is the old path, as it was indexed: `/words` or
  `/words/more`, without a trailing slash (Next sends `/old/` to `/old`
  first), a query or a pattern. Each path is listed once.
- **`to`** is where a reader goes: a page's `seo.path`, a post's URL
  (`<postPrefix>/<slug>`), the blog index, any of them with a `#fragment`
  or a `?query`, or an `https://` URL.
- **`permanent`** is true unless it says `false`: a permanent redirect
  answers 308, which search engines follow and index the target of; a
  temporary one 307.

A site with none keeps the file with `[]` in it: the engine reads every
collection's file, and a missing one fails the build.

## How it reaches the host

`next.config.ts` returns the list from `redirects()`, read when Next loads
its config at build time:

```ts
import { redirectsFor } from "agentic-cms/content";

const nextConfig: NextConfig = {
  redirects: async () => redirectsFor(),
  // …
};
```

`agentic-cms init` writes it into a new site's config. Next puts the list
in the build's routes manifest (`.next/routes-manifest.json`), which the
Cloudflare Worker and a Node server answer alike, before any page or file.
A site with redirects of its own in its config returns both:
`[...redirectsFor(), ...its own]`. `next dev` reads the file when it
starts: restart it after an edit.

## What holds it

- **The schema,** in every build and as you type (the line atop the
  file): a `from` with a trailing slash, a pattern or a query, a `to` that
  is neither a path nor an `https://` URL, an unknown key.
- **The content lint** (`agentic-cms lint`, in every build), each a
  failure:
  - `redirect-from`: a `from` listed twice, or one that is a live page's
    path or a published post's URL — the redirect would hide it. A draft's
    URL answers nothing in production, so a redirect may take it.
  - `redirect-chain`: a `to` that is another entry's `from` (a chain,
    which costs every reader a hop: point it at the end), or a loop.
  - `redirect-to`: a `to` path that no page, no published post and not the
    blog index answers — the redirect would land on a 404.
- **The site check** (`agentic-cms check-site`, in every `pnpm lint`):
  its `retired` pass warns, failing nothing, about a URL that a page or a
  published post answered at the merge base and nothing answers now — its
  file deleted or renamed, or its route changed — when no entry's `from`
  names it. The fix is the redirect, or for a post `draft: true`, which
  keeps its URL.
- **The SEO audit** (`agentic-cms seo`, after `next build`) fails a
  sitemap that lists a redirected path.

## Taking a page or a post off

`/editorial:retire-content` does it in order: it asks where the readers
go, writes the entry (and points every entry that led to the old path at
the new one), then deletes the page and every link to it.
`/editorial:new-page` refuses a route an entry's `from` holds: taking an
old URL back is removing its redirect, the owner's call.

## A site from before 0.9.0

The site needs the file and the config line. The 0.9.0 migration of
`agentic-cms upgrade` adds both (`redirectEdits()` in
`scripts/lib/redirects.mjs`): the starter's empty
`content/redirects.yaml`, and `redirects()` in its Next config, placed as
the template has it; a config with redirects of its own, or with no
config object the edit can find, is a manual step it prints. Redirects
the host held before (a `_redirects` file, a dashboard list) move into the
file by hand.
