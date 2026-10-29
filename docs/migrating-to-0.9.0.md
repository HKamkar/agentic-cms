# Migrating a site from 0.8.x to 0.9.0

This is for a site on agentic-cms 0.8.x. In 0.9.0:
- the kit's skills come from the installed package and each rule is thin,
  so an upgrade asks for no merge of the agent files;
- every content file has a JSON Schema, and an editor checks a YAML file
  against it as it is typed;
- the site's redirects are a content file, `content/redirects.yaml`, which
  the build checks and `next.config.ts` serves;
- every page's head keeps the site's Open Graph name, its locale and the
  link to its feed.

And, opt-in: a preview link on every pull request, and other languages
(experimental). [stability.md](stability.md) says what a site can rely on
from here on.

One command takes the mechanical part, `agentic-cms upgrade`, run from
0.9.0 itself. § 1 is what it does; §§ 2–5 are what it leaves by hand, and
§§ 6–7 what a site may adopt. Nothing a reader sees changes: the pages
look the same, and each head gains three tags.

| § | Step | Who | Effort |
|---|---|---|---|
| 1 | The upgrade: `pnpm dlx agentic-cms@0.9.0 upgrade` | every site | minutes |
| 2 | `AGENTS.md` and `CLAUDE.md` | a site laid out by `init` before 0.9.0 | half an hour |
| 3 | The host's redirects into `content/redirects.yaml` | a site whose host or Next config holds redirects | minutes per redirect |
| 4 | A head built with `pageMetadata` from `agentic-cms/seo` | a site with such a route | minutes per route |
| 5 | The editor's YAML extension | each person who edits content in an editor | a minute |
| 6 | A preview link on every pull request | a site on Cloudflare Workers that wants one | half an hour |
| 7 | Another language | a site that wants one (experimental) | a day, then a page at a time |
| 8 | Check | every site | a proof |

## Before you start

- **The site is on 0.8.2 or later.** `upgrade` runs the migrations newer
  than the site's version, and no 0.8 release has one. A site on 0.8.1 or
  before takes [migrating-to-0.8.2.md](migrating-to-0.8.2.md) first. A
  site on 0.8.2 or 0.8.3 also reads
  [upgrading.md § 0.8.2 → 0.8.3](upgrading.md#082--083) and
  [§ 0.8.3 → 0.8.4](upgrading.md#083--084), and takes their steps in the
  same pull request. Their merge of the agent files is the exception:
  0.9.0's thin rules replace it.
- **Start from a clean tree** on a branch off `develop`
  (`chore/agentic-cms-0.9.0`), with `develop` pushed: § 8's proof compares
  against it. `pnpm install` has run, so `node_modules` says which version
  the site is on.
- **Take the head's capture before anything moves:**
  `pnpm exec agentic-cms parity before` on that tree. § 8 compares it
  with the one after.
- **Claude Code keeps what it loaded.** The session that runs the upgrade
  still has 0.8's skills. Start a new one afterwards (§ 2 says why the
  first one may come up without the kit's skills).

## 1. The upgrade (every site)

```bash
pnpm dlx agentic-cms@0.9.0 upgrade --dry-run   # what it would change; changes, installs and runs nothing
pnpm dlx agentic-cms@0.9.0 upgrade
```

A release candidate is `agentic-cms@next`. The command runs 0.9.0's own
code in the site's root ([upgrade.md](upgrade.md)), in this order:

1. **The version the site is on:** `node_modules/agentic-cms`'s, or the
   one `.agentic-cms.json` records when that is older. `--from 0.8.4`
   names it where neither says.
2. **The pin:** `pnpm add agentic-cms@<spec>`, in the form the site wrote
   it: a `github:` tag moves to `#v0.9.0`. A pin of another form (a
   commit, a tarball) takes `--kit <spec>`. An install that fails stops
   the command before anything else changes.
3. **The 0.9.0 migration,** `scripts/migrations/0.9.0.mjs`, in three
   pieces:
   - **The agent files.** What 0.8 copied moves. A design skill copy the
     site never touched goes, from `.claude/skills/` and from
     `.agents/skills/`: Claude Code reads the kit's from its `design`
     plugin, Codex from a stub. One the site edited becomes its own,
     `.claude/skills/<name>-site/` (or `.agents/skills/<name>-site/`),
     with a note at its top. Each rule becomes thin: the kit's block, then
     the site's own lines. `.agentic-cms/base/` goes. `.claude/settings.json`
     names the package's marketplace, `./node_modules/agentic-cms`, and
     enables `design@agentic-cms` beside `editorial@agentic-cms`.
   - **The content schemas.** Each YAML file of the standard collections
     opens with its schema's line
     (`# yaml-language-server: $schema=…`). Then the site's installed
     command line runs `agentic-cms schema --lines` and `agentic-cms docs`:
     they write `content/_schemas/`, the line of each collection of the
     site's own, and the field tables of `content/README.md`, which gain
     the redirects' table.
   - **The redirects.** The starter's empty `content/redirects.yaml`, and
     `redirects: async () => redirectsFor()` in the site's Next config,
     placed as the template has it.
4. **The agent files' refresh,** `init --agent-files`: the kit's block of
   each rule, the stubs, the scoped-rules table in `AGENTS.md` and the
   kit's keys in `.claude/settings.json`. The site's own lines are kept.
5. **What is left by hand,** each step with its section of
   `node_modules/agentic-cms/docs/upgrading.md`: §§ 2–4 below.
6. **The verify:** `pnpm lint` and `pnpm test`.

It exits `0` when it is done, `1` when a step is left by hand or the
verify failed, and `2` when it changed nothing (no `agentic-cms`
dependency, a pin it does not move, no version to start from, an install
that failed). A site laid out by `init` 0.8 exits `1`: its `AGENTS.md`
still holds what the 0.8 template copied (§ 2). The site is on 0.9.0 after
the run, so a second plain run has no migration left to run. To see what
is still left after §§ 2–4, name the version it came from:

```bash
pnpm dlx agentic-cms@0.9.0 upgrade --from 0.8.4 --dry-run
```

Commit what it changed in one go: the lockfile, `.agentic-cms.json`, the
agent files, `content/_schemas/`, the schema lines, `content/README.md`,
`content/redirects.yaml` and the Next config. The build's `docs --check`
fails until the schemas and the field tables are committed.

## 2. `AGENTS.md` and `CLAUDE.md` (a site laid out before 0.9.0)

They are the site's own, so the move leaves them, and `upgrade` names
each one:

- **`AGENTS.md`.** The 0.8 template copied in its sections `## Styling`,
  `## Gotchas` and `## Parity harness and long runs`, and the bullets that
  list the kit's docs. Put the current template's table, "The kit's
  guides", in their place, from
  `node_modules/agentic-cms/templates/site/AGENTS.md`. The site's own
  lines stay where they are. The scoped-rules table between its markers
  is the refresh's.
- **`CLAUDE.md`.** Where it says the design skills are `.claude/skills/`,
  say what the current template says: the kit's skills are its `editorial`
  and `design` plugins, from the package's marketplace, and
  `.claude/skills/` holds the site's own.
- **A skill the site had edited,** now `<name>-site`, with a note at its
  top. `upgrade` lists each while the note is there. Delete the folder to
  follow the kit's skill, or keep it as the site's own and delete the
  note.

**The first session after the move.** Claude Code registers a marketplace
once per machine, by name, and each session in a trusted folder points it
at that folder as it starts. The first session after the move may start
without the kit's skills; the next one has them. A folder that is not
trusted loads no project plugin at all
([gotchas.md § Claude Code](gotchas.md#claude-code)).

## 3. The host's redirects

`upgrade` wrote an empty `content/redirects.yaml` and the `redirects()`
line. Two cases are left by hand:

- **A Next config with a `redirects()` of its own.** `upgrade` leaves it
  and says so. Move each plain redirect into the file. A rule the file
  cannot hold (a pattern such as `/old/:slug`, a query, a `has`
  condition) stays in the config, after the file's:
  `redirects: async () => [...redirectsFor(), ...its own]`.
- **Redirects the host holds:** a `_redirects` file, a dashboard's list,
  a server's own rules. Each becomes an entry, one per old path:

  ```yaml
  # yaml-language-server: $schema=./_schemas/redirects.json
  - from: /old-pricing      # the path as it was indexed: no trailing slash, query or pattern
    to: /pricing            # a page, a post, the blog index, or an https:// URL
  - from: /spring-offer
    to: https://shop.example.org/spring
    permanent: false        # a 307: the move is temporary
  ```

  Then delete the host's copy. A rule on the host may answer before the
  site does, and the build cannot check it.

The content lint holds the file in every build: `redirect-from` fails a
path listed twice or a path a live page or a published post answers,
`redirect-chain` a chain or a loop, and `redirect-to` a target nothing
answers. The SEO audit fails a sitemap that lists a redirected path. From
now on, `/editorial:retire-content` writes the entry when a page or a post
goes ([redirects.md](redirects.md)).

## 4. A head built with `pageMetadata` from `agentic-cms/seo`

`kit.seo.pageMetadata()` and `postMetadata()` now carry `og:site_name`,
`og:locale` and the link to the feed. Next replaces the layout's
`openGraph` and `alternates` with a route's, so every page and post lost
the three until now. A route on `kit.seo` has nothing to do.

`pageMetadata` from `agentic-cms/seo` takes no site, so it cannot add
them. Find each route that returns it:

```bash
grep -rl 'agentic-cms/seo' src | xargs -r grep -l 'pageMetadata'
```

and have its `generateMetadata` return `kit.seo.pageMetadata(page.seo)`
instead. The SEO audit warns on a page without the three tags, so
`pnpm build` names any route left. A head the site still writes by hand
is the same warning, and the same fix.

## 5. The editor's YAML extension

A YAML content file names its JSON Schema on its first line. An editor
with the YAML language server reads it: in VS Code, Red Hat's YAML
extension. A wrong key or a missing field is then marked as it is typed.
The kit writes no editor settings: `.vscode/` stays each person's own.

A post's frontmatter and the JSON registries carry no such line. Their
schemas are there for an agent, and the editorial skills read a file's
schema before they write one ([schema.md](schema.md)).

## 6. A preview link on every pull request (opt-in)

On Cloudflare Workers, the CI workflow's `preview` job puts each pull
request at a link of its own, never indexed, and keeps one comment on it
with the link and the pages the change touches. It is experimental, and
`upgrade` leaves it alone:

1. Copy the `preview` job from
   `node_modules/agentic-cms/templates/site/verify.yml` into
   `.github/workflows/verify.yml`, with its permissions and its checkout's
   `fetch-depth: 0`.
2. In the repository's settings, set the variable `AGENTIC_CMS_PREVIEW` to
   `cloudflare`, and the secrets `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID`.
3. Turn on the Worker's preview URLs.
4. The job builds with `GOOGLE_TAG_ID` empty. Where the id can reach the
   build another way, give `src/config/analytics.ts` the example's line,
   so a preview ships no tag whatever its environment holds:
   `tagId: process.env.AGENTIC_CMS_PREVIEW === "1" ? "" : (process.env.GOOGLE_TAG_ID ?? "")`.

A pull request from a fork has no secrets: its run says it made no
preview. On Vercel or Netlify, set `AGENTIC_CMS_PREVIEW=1` in their
preview environment instead ([preview.md](preview.md)).

## 7. Another language (opt-in, experimental)

A site in one language changes nothing: without `site.locales` it
behaves as it did. To add one, [locales.md § Adding a
language](locales.md#adding-a-language) is the procedure. Its names and
its layout may change in any release.

A site laid out before 0.9.0 has its own root layout and chrome, so it
needs one more step first. Its chrome must read the page's language:
- its words in a block per language (`copy` and `copyFor()` in
  `src/config/site.ts`);
- a document that takes the language's config and words (the example's
  `ui/SiteLayout`, `node_modules/agentic-cms/src/components/ui/SiteLayout.tsx`);
- each section's links from the registry in the page's language
  (`ctaHref`).

[locales.md § The chrome's words](locales.md#the-chromes-words) says how
the example does it. Prove that step identical before the first
translation.

## 8. Check

- The verify block passes with 0 failures: `pnpm lint`, `pnpm test`,
  `pnpm content:lint` and `pnpm build`.
- `pnpm dlx agentic-cms@0.9.0 upgrade --from 0.8.4 --dry-run` finds
  nothing to change and no step by hand.
- `pnpm exec agentic-cms init . --agent-files --check` is clean: no
  `legacy`, no `stale`.
- The heads: `pnpm exec agentic-cms parity after`, then
  `diff -r .parity/before .parity/after`. Each page and post but the 404
  gains `og:site_name`, `og:locale` and the link to the feed. Read
  anything else it shows.
- The pixels are identical on every page:

  ```bash
  pnpm kit visual-parity proof migrate --ref develop --build --all-pages
  ```

- A new Claude Code session lists the kit's skills as
  `design:<skill>` and `editorial:<skill>`.
- The owner looks on the dev server (`pnpm kit serve`), then merges.

## When something fails

| Symptom | Do this |
|---|---|
| `upgrade` exits 2: no `agentic-cms` in `node_modules` and no `.agentic-cms.json` | `pnpm install` first, or name the version: `--from 0.8.4` |
| `upgrade` exits 2 on the pin | A commit or a tarball: name the spec with `--kit <spec>` |
| `upgrade` exits 1 and lists steps | §§ 2–4; then `upgrade --from 0.8.4 --dry-run` lists what is still left |
| `pnpm build` fails at `docs --check`: a schema or a field table missing or stale | `pnpm exec agentic-cms schema --lines && pnpm exec agentic-cms docs`, then commit `content/_schemas/` and `content/README.md` |
| The build fails: `content/redirects.yaml` missing | The engine reads every collection's file: write it with `[]` (`upgrade` does) |
| `redirect-from`: a `from` is a live page's path | The page is still there: drop the entry, or retire the page first (`/editorial:retire-content`) |
| `redirect-to` names an entry whose target is right | A page file failed its schema, so the lint saw no pages: fix that failure first |
| An old path still answers 301 or 302 after the deploy | The host's own rule answers first: delete it (§ 3) |
| The SEO audit warns that a head lacks `og:site_name` or the feed link | A route on `pageMetadata` from `agentic-cms/seo`, or a head by hand (§ 4) |
| `init --agent-files --check` reports `legacy` | A copy from 0.8: `pnpm exec agentic-cms init . --agent-files` moves it, as `upgrade` does |
| `modified, required gone` | The site edited the kit's block of a rule: `init . --agent-files` rewrites the block, keeping the site's own lines after it |
| Claude Code lists no `design:` skill | Trust the folder and start a new session (§ 2) |
| The proof differs | A kit bug: open an issue with the compare's `cause:` line; don't adjust the site |
