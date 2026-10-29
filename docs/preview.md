# A preview link on every pull request

A preview puts a change on the real pages, on any device, before it
merges: the owner opens one link instead of reading a diff or running the
site. On a site hosted on Cloudflare Workers, the CI workflow's `preview`
job makes one for every pull request and keeps one comment on it with the
link and the pages the change touches.

## Turning it on

The job is in the workflow `init` writes (`.github/workflows/verify.yml`,
from `node_modules/agentic-cms/templates/site/verify.yml`; a site laid out
before 0.9.0 copies the job from there). It runs only once the site opts
in, in the repository's settings (Settings › Secrets and variables ›
Actions):

| Kind | Name | Value |
|---|---|---|
| variable | `AGENTIC_CMS_PREVIEW` | `cloudflare` |
| secret | `CLOUDFLARE_API_TOKEN` | an API token that may edit Workers scripts (the "Edit Cloudflare Workers" template, scoped to the account) |
| secret | `CLOUDFLARE_ACCOUNT_ID` | the account the site's Worker is in |

The site itself is set up for Workers first: OpenNext's adapter
(`@opennextjs/cloudflare`), `open-next.config.ts` and a Wrangler config,
as [deploy.md § Cloudflare Workers](deploy.md#cloudflare-workers) says. The
Worker's preview URLs must be on (its Settings › Domains & Routes, or
`preview_urls: true` in the Wrangler config).

## What each push does

The job runs `agentic-cms pr-preview`
([commands.md § pr-preview](commands.md#pr-preview)):

1. **The pull request.** Its number and its head come from GitHub's event.
   A pull request from a fork has no secrets, and a run without them makes
   no preview: the command says so in the log, as an annotation on the run
   and in its summary, and exits 0, building nothing.
2. **The build,** as production: `opennextjs-cloudflare build`, which runs
   the site's own `pnpm build` and every gate in it, with
   `AGENTIC_CMS_PREVIEW=1`. The starter's placeholders stay warnings there,
   as in the CI build.
3. **The upload,** a Workers version that is not deployed, under the alias
   `pr-<number>`, with the var `AGENTIC_CMS_PREVIEW=1`:
   `opennextjs-cloudflare upload --preview-alias pr-<n> --var
   AGENTIC_CMS_PREVIEW:1`, which passes both to `wrangler versions
   upload`. The link, `https://pr-<n>-<worker>.<subdomain>.workers.dev`, is
   the same on every push and shows the latest (D16 of the 0.9.0 plan); it
   is read from wrangler's output file, not its log. Production is never
   touched: a version under an alias serves only its preview URL.
4. **The comment,** one per pull request, found by its marker and updated
   on each push: the link, the commit it shows, and the pages the change
   touches, each a link into the preview.

## The pages a change touches

From the files the pull request changes against its base branch (the
checkout takes the history, `fetch-depth: 0`):

- a page file is its route; a post its URL (a draft is listed as one,
  which the preview leaves out as production does; a removed page or post
  as removed);
- an FAQ set is every page whose `faq` section names it;
- a page's picture folder (`public/images/<page>/`) or Open Graph image is
  that page, a post's picture folder that post;
- the chrome, a component, the config, the styles, a collection more than
  one page reads (the reviews, the use cases, the authors), a shared
  picture: **every page**, naming the files;
- the docs, the agent files, CI, the content's notes, templates and
  schemas, the redirects and the tests: no page.

## A preview is not the site

The flag reaches every place a preview could do harm, in the engine, so
no site can forget one:

- **Never indexed.** Every page carries `<meta name="robots"
  content="noindex, nofollow">` (`kit.seo.rootMetadata()`), `robots.txt`
  disallows everything (`kit.seo.robots()`), and the build adds a
  `_headers` rule to the Worker's assets so each static file answers
  `X-Robots-Tag: noindex, nofollow`. The SEO audit knows the flag: in a
  preview build it fails a page without `noindex` and a `robots.txt` that
  allows anything, and without it a page that has `noindex`.
- **No form delivered.** The form endpoint reads the version's
  `AGENTIC_CMS_PREVIEW` var on each request and delivers to the Worker's
  log, never to the site's destination (`createFormHandler()`,
  [forms.md](forms.md)).
- **No analytics.** The preview job sets no tag id, and the site's
  `src/config/analytics.ts` ships none in a preview build, so no consent
  banner, no consent default and no Google tag
  ([consent.md](consent.md)).

## Checks

`agentic-cms check-site`'s `ci` pass knows the job. As warnings, which
fail nothing: a job that runs `pr-preview` without
`permissions: pull-requests: write` (its comment cannot be posted) or
without the history (it cannot list the pages), and a job that uploads a
preview version by hand without `AGENTIC_CMS_PREVIEW=1`.

## Other hosts

Vercel and Netlify make a preview of every pull request themselves. Set
`AGENTIC_CMS_PREVIEW=1` in their preview environment, for the build and
the functions alike: the pages then carry `noindex`, `robots.txt`
disallows everything and the form endpoint delivers to the log
([deploy.md](deploy.md)). The kit makes no preview for a Node host.

## By hand

```bash
agentic-cms pr-preview --pr 12 --dry-run   # the pages the change touches and the comment, nothing uploaded
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… agentic-cms pr-preview --pr 12 --no-comment
```
