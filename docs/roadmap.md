# Roadmap — 0.9.0: a standard npm package

> The plan for 0.9.0, started 2026-10-29. Written 2026-10-16 from a read of
> the kit at `develop` e615341; the owner took D1–D9's recommendations on
> 2026-10-17. On 2026-10-29 the owner added six jobs that make a site
> easier to run and to upgrade (8–11, with 5 and 6 reworded) and a docs
> pass (12), to land before the packaging jobs, and approved the plan with
> D10–D17's recommendations the same day. Job 0 moved it here from
> `docs/roadmap-0.9.0.md`; the 0.8.0 roadmap it replaces stays in history
> (`git show v0.8.0:docs/roadmap.md`), its principles, hygiene list,
> per-job verification and open Later items carried into this one, and
> 0.8.2's is `docs/roadmap-0.8.2.md`.

A site installs agentic-cms from GitHub by tag
(`github:HKamkar/agentic-cms#v0.8.0`). That works, but it is not how a
package is installed:

- **Every install builds the kit.** It clones the repository and compiles
  `src/lib/` (`prepare`), so each site needs an `allowBuilds` entry for the
  kit, and installs are slower than a registry download.
- **Nothing signs what a site gets.** The tag is immutable, but there is no
  registry copy, no provenance attestation and nothing for
  `npm audit signatures` to check.
- **There is nothing between a commit and a release.** A release candidate
  is a bare `develop` sha, so a gate run pins a sha.
- **No tool sees an update.** `pnpm outdated`, Renovate and Dependabot read
  versions from a registry, and the kit's versions exist only as tags.
- **The usual entry points are missing:** there is no
  `pnpm create agentic-cms`, no `upgrade` command and no written promise of
  what stays stable.

The names are free. On 2026-10-16 the registry answered 404 for
`agentic-cms` and `create-agentic-cms`. It answered the same for
`agenticcms`, `agentic_cms` and `agentic.cms`, the variants that npm's
name-similarity check would refuse a new package over.

**The target.** After 0.9.0, an empty folder becomes a site with:

```
pnpm create agentic-cms my-site
cd my-site && bash scripts/setup.sh && pnpm kit serve
```

That command:

- installs a tarball from npm that carries a provenance attestation;
- builds nothing of the kit's on install;
- needs no build approval for the kit.

To move a site from one release to the next,
`pnpm dlx agentic-cms@latest upgrade` runs the release's mechanical steps
and prints the rest.

**And what a site gets on the way** (jobs 8–12, before the package):

- its content files checked as they are typed, by a JSON Schema the
  engine writes;
- its redirects in one file the build checks, so a removed page does not
  quietly become a 404;
- one page that says what it can rely on between versions;
- the kit's skills and guides read from the installed package, so an
  upgrade asks for no merge of the agent files;
- a preview link on every pull request;
- a README that says, on its first screen, how the kit differs from a
  database CMS such as Payload, which now calls itself "the agentic
  content framework".

## What "a standard package" means here

These ten points are the definition of done for 0.9.0.

1. **It is published to npm from CI only.** Publishing goes through
   trusted publishing (OIDC), and provenance comes with it. No publish
   token exists anywhere: the package's publishing access is set to
   "Require two-factor authentication and disallow tokens".
2. **The tarball is the product.** The file `test:pack` built a site from is
   the file that is published, checked by its sha512.
3. **Nothing runs on install.** `dist/` is in the tarball, and a registry
   install runs none of the kit's lifecycle scripts.
4. **Every export resolves with types.** Each subpath of `exports` resolves
   and has types in the modes a site uses, `./loader` and `./eslint`
   included. `publint` and Are the Types Wrong check them in CI.
5. **The registry page is complete.** `package.json` has `repository`,
   `homepage`, `bugs`, `keywords` and `author`, a description short enough
   for search results, and a README that renders on npm.
6. **Versions follow semver, in two channels.** `latest` holds releases and
   `next` holds release candidates (`0.9.0-rc.N`). A published version is
   never unpublished; a broken one is deprecated and superseded.
7. **Peer and engine ranges are bounded** and tested in CI at both ends.
8. **The public surface is written down.** Each part is marked stable or
   experimental, and a deprecation policy says how each one changes.
9. **The usual entry points exist:** `pnpm create agentic-cms` and
   `agentic-cms upgrade`.
10. **Each version gets a GitHub Release,** with its changelog section and
    the tarball attached.

## Decisions

| # | Question | Options | Decided (owner, 2026-10-17) |
|---|---|---|---|
| D1 | Who owns the packages on npm | (a) the owner's npm account; (b) an npm organisation, which is free for public packages | **Decided: (b).** The organisation owns both packages, so a second maintainer, or a move to a GitHub organisation later, changes nothing a site sees. The repository stays where it is until 1.0.0 settles "Name and home". Moving it then means one step: delete and re-create the trusted publisher. |
| D2 | The first publish. npm sets up a trusted publisher only for a package that already exists, so the first version of each package goes up by hand | (a) the owner publishes 0.8.0 by hand right after its tag, from the tarball `test:pack` built; (b) the first publish is `0.9.0-rc.0`, by hand, after job 2 | **Decided: (a).** It claims the name now, with a real release rather than a placeholder. `create-agentic-cms` gets its own first hand publish when job 4 lands. A hand publish carries no provenance; every publish after it does. |
| D3 | Who presses publish | (a) pushing a `v*` tag publishes; (b) the publish job waits in a GitHub environment `npm` for the owner's approval | **Decided: (b).** A publish is permanent: npm limits unpublishing, and a version number, once used, can never be published again. The trusted publisher names the environment, so no other workflow or job can publish. |
| D4 | The name of the create package | (a) `create-agentic-cms`, run as `pnpm create agentic-cms` or `npm create agentic-cms@latest`; (b) `@<org>/create`, run as `pnpm create @<org>` | **Decided: (a).** It is the form every framework uses. |
| D5 | Where release candidates come from | (a) npm under the `next` tag, tagged `v0.9.0-rc.N`; (b) a `develop` sha, as for 0.8.0 | **Decided: (a).** The gate then installs what will ship, by the path a site uses. A candidate tag may sit on `develop`; a release tag sits only on `main`. |
| D6 | Peer ranges | (a) open floors, as today: `next >=16.3.6`, `eslint >=9`, `playwright-core >=1.63.0`; (b) each range bounded to the major CI runs, such as `next ^16.3.6` | **Decided: (b).** Supporting a major the kit has not run is a kit release, not a surprise for a site. CI tests the floor and the newest version of each range (job 7). |
| D7 | Installs from git | (a) keep them working: `prepare` still builds on a git install, to test an unreleased commit (`init --kit <spec>`); (b) drop them | **Decided: (a)** through 0.x, documented only as the kit's own development path. No guide for sites mentions it. |
| D8 | Where the starter lives | (a) in the main package, as today (the tarball is 640 KB of its 1 MB budget); (b) a starter package of its own | **Decided: (a)**, as the 0.8.0 roadmap said, until the budget says otherwise. |
| D9 | 1.0.0's "what kind of CMS" briefs | (a) the first job of 0.9.0, blocking the rest (the 0.8.0 roadmap's wording); (b) a track of their own, decided before 1.0.0 | **Decided: (b).** Packaging changes none of the answers, and D1 settles "Name and home" as far as npm goes. |

The jobs added on 2026-10-29 bring eight more. The owner took each
recommendation on 2026-10-29.

| # | Question | Options | Decided (owner, 2026-10-29) |
|---|---|---|---|
| D10 | Where the content schemas live (job 8) | (a) committed under `content/_schemas/`, held current by a check in the build; (b) written at install or `dev` into a gitignored folder | **Decided: (a).** An editor and an agent read them without running anything, and a schema change shows in review. The engine already skips `_`-prefixed paths. |
| D11 | How an editor finds a file's schema (job 8) | (a) a `# yaml-language-server: $schema=…` line at the top of each YAML content file; (b) a `yaml.schemas` map in `.vscode/settings.json` | **Decided: (a).** It works in any editor with the YAML language server, an agent sees it in the file, and `.vscode/` stays the person's own. |
| D12 | How redirects reach the host (job 9) | (a) `redirects()` in `next.config.ts`, from the file; (b) a `_redirects` file in the served assets | **Decided: (a).** The Worker and a Node server answer the same, and no host format leaks into the content. |
| D13 | A page or post file removed since the merge base, with no redirect for its URL (job 9) | (a) `check-site` fails; (b) it warns, naming the fix | **Decided: (b).** No rule gets stricter (owner, 2026-10-29). `retire-content` writes the redirect itself, so an agent's path is covered, and the warning is in every lint. |
| D14 | How a site gets the kit's skills (job 10) | (a) as Claude Code plugins from a marketplace in the installed package, `./node_modules/agentic-cms`; (b) copied as today, but rewritten on every upgrade and never merged, the site's own skills kept apart | **Decided: (a)**, if the job's first step shows Claude Code reads a `directory` marketplace there; else (b). Either way an upgrade asks for no merge. |
| D15 | How Codex finds them (job 10) | (a) a task → skill table in the site's `AGENTS.md`; (b) a stub per skill in `.agents/skills/`: its name and description, and one line naming the package's file | **Decided: (b).** Codex lists a skill by its description; a stub is never edited, so `init` rewrites it freely. |
| D16 | The preview's address (job 11) | (a) one per pull request: a version uploaded with the alias `pr-<n>`, the same link on every push; (b) one per push, each version's own | **Decided: (a).** The comment's link stays the same, and the latest push is what it shows. |
| D17 | The page on what a site can rely on (job 6) | (a) a page of its own, `docs/stability.md`, with the stable/experimental column on `docs/parts.md`; (b) the column alone, as job 6 first said | **Decided: (a)** (owner, 2026-10-29: "one page"). The column marks each part; the page says what the marks promise and what no version promises. |

## The owner's steps

Only the owner can do these, because each one needs the owner's npm login
or approval.

- **O1, before job 2:** an npm account with two-factor authentication (a
  security key), and the organisation if D1 is (b).
- **O2, right after the `v0.8.0` tag (D2a):** publish the tag's tarball by
  hand: `pnpm pack` on the tag, then `pnpm publish <tarball>` with 2FA. The
  npm page for 0.8.0 shows 0.8.0's GitHub install lines; 0.9.0 replaces
  them. **Not done yet:** on 2026-10-29 the registry still answered 404 for
  `agentic-cms`. The name is held only once it is published, so this is the
  first step now, with the newest tag's tarball (`v0.8.4`) in place of
  0.8.0's.
- **O3, within two days before `v0.9.0-rc.0`:**
  - On npmjs.com, add the trusted publisher: GitHub Actions, repository
    `HKamkar/agentic-cms`, workflow `release.yml`, environment `npm`.
  - Then set publishing access to "Require two-factor authentication and
    disallow tokens".

  A new trusted publisher expires unless its first publish succeeds within
  two days, so this step comes just before the first CI publish, not right
  after O2.
- **O4:** create the GitHub environment `npm`, with the owner as its
  required reviewer and deployments allowed from `v*` tags only. The
  conductor can create it through the API on the owner's word.
- **O5, when job 4 lands:** the first publish of `create-agentic-cms`, by
  hand, then its O3.
- **O6, when job 11 lands, if the kit's own pull requests should get a
  preview of the example site:** a Cloudflare API token that may upload
  Workers versions, and the account id, as the repository's secrets. A site
  sets its own the same way.
- **Every publish:** the owner approves the release workflow's publish job
  (D3).

## Principles

Carried over from the 0.8.0 roadmap.

- **Behaviour in the package, look in the example.** The package exports no
  styled element
  ([design.md § What stays out of the kit](design.md#what-stays-out-of-the-kit)
  stands). Styled primitives go into
  the example under `src/`, which `init` copies and a site replaces.
- **Nothing of any site.** No site's name, palette, copy or host choice; no
  machine path or address (`tools/hygiene.mjs`; run `pnpm hygiene --brand
  <site>` every job, since only the README showcase names are guarded by
  default), and no description of a site: not its pages, sections,
  components, scripts, artwork or services. Evidence from a site is numbers.
- **Defaults come from the site, not from flags.** A site says once what it
  is (its widths, its schemes, the pages a proof covers); every command
  reads that; a flag overrides it for one run.
- **Upgrading is safe by default.** A site on 0.8.x that runs `upgrade`
  builds, lints and proves identical. Everything else 0.9.0 brings is
  opt-in, step by step in the migration guide
  (`docs/migrating-to-0.9.0.md`, job 12). Nothing the kit writes into a
  site — a rule, a skill line — describes a tool the site has not adopted.
- **The wireframe stays what it is.** It animates nothing (STANDARD §7) and
  every job that touches it is pixel-identical, proven with
  `visual-parity proof` in both schemes (the example has dark mode), unless
  the job says "design change".
- **A command is the contract** (`AGENTS.md`, the command line's contract):
  a spec in `scripts/lib/specs.mjs`, `parseOrExit`, the logic in
  `scripts/lib/<name>.mjs` with the shell and file system passed in, a unit
  test, bin cases, a `docs/` page and its index line, `pnpm docs:commands`,
  its changelog line — in one pull request.
- **Know-how is written once, where every site reads it:**
  `node_modules/agentic-cms/docs/`, and the agent files `init` writes.

## Hygiene, every pull request

Carried over from the 0.8.0 roadmap, with the changelog as this plan's
Order has it.

- Branch `feat/<slug>` | `bugfix/<slug>` | `docs/<slug>` off `develop`;
  commits `<area>: <what>`; no AI attribution lines (the kit's rule,
  `AGENTS.md` § Git workflow).
- A `## Changelog` section in the pull request's body, its lines as they
  will read under `## [Unreleased]`, with **recapture baselines** when what
  a capture writes changes. The conductor writes them into `CHANGELOG.md`
  with the release commit; a job never edits it.
- **The migration guide.** Each job's pull request says, for job 12's
  `docs/migrating-to-0.9.0.md`:
  - what a site must do (ideally nothing, or what `upgrade` does);
  - what it may adopt, and why;
  - what it deletes if it wrote its own;
  - how it checks.
- `pnpm skills:sync` after a skill edit; `pnpm docs:rules` after a rule
  edit (both trees: `.claude/rules/` and `templates/site/rules/`);
  `pnpm docs:commands` after a spec edit.
- Budgets: the kit's `AGENTS.md` is 31,666 of 32,768 bytes, the template's
  16,132 of 16,384 (2026-10-29) — new practice goes into `docs/` with a
  one-line pointer.
- The verify block (`AGENTS.md`), `pnpm test:browser` when harness, lab or
  browser code changed, `pnpm test:pack` when `package.json`, `src/lib/` or
  `scripts/` changed.

## The jobs

| # | Job | What it changes |
|---|---|---|
| 0 | This plan into the repo | `docs/roadmap.md` becomes this file |
| 1 | The tarball is the product | the metadata, a fresh `dist/`, types on every subpath, the file list as a contract |
| 2 | Release from CI | `release.yml`: checks, OIDC publish, GitHub Release, a smoke test from the registry |
| 3 | Install from npm everywhere | `init`'s dependency spec, `allowBuilds`, every install line |
| 4 | `pnpm create agentic-cms` | `packages/create-agentic-cms/`, a thin wrapper around `init` |
| 5 | `agentic-cms upgrade` | the upgrade guide made executable, with migrations per version |
| 6 | What a site can rely on | one page, `docs/stability.md`, a stable/experimental column on `docs/parts.md`, and the deprecation policy |
| 7 | Peers and engines | bounded ranges, tested at the floor and at the newest version |
| 8 | A schema for every content file | `agentic-cms schema`: the engine's zod schemas as JSON Schema, which an editor checks as it types |
| 9 | Redirects as content | `content/redirects.yaml`, checked by the content lint, served through `next.config.ts` |
| 10 | Fewer files copied into a site | the skills and guides read from the installed package; thin rules; no merges on upgrade |
| 11 | A preview link on every pull request | a CI job that uploads a preview version and comments its link and the pages it touches |
| 12 | The docs, the README, the way from 0.8 | the sweep, how the kit differs from a database CMS, `docs/migrating-to-0.9.0.md` |
| R | Release 0.9.0 | `rc.1` on `next`, the gate, `0.9.0` on `latest` |
| S | The sites follow | `upgrade` in each site's own session |

### 0 — This plan into the repo

- After `v0.8.2`, this file replaces `docs/roadmap.md`. The 0.8.0 roadmap's
  open Later items move into this one's Later, and the decisions are
  recorded as **Decided:**.
- The 0.8.0 roadmap's principles, hygiene list and per-job verification
  carry over unchanged, but for what this plan's Order replaces: the
  changelog lines go in the pull request's body, and the versions and
  file names are 0.9.0's.

**Done** (2026-10-29), as the first commit of phase 1's lane B. The links
to either file follow it.

### 1 — The tarball is the product

- **The metadata:**
  - `package.json` gains `repository` (a `git+https` URL), `homepage`,
    `bugs`, `keywords` and `author`;
  - the `description` shrinks to one line a search result can show;
  - the full text moves to the README's top.
- **A fresh `dist/` every time.** A `prepack` script removes `dist/` and
  rebuilds it, so a stale build from another commit never ships. `prepare`
  stays for git installs (D7).
- **Types on every subpath.** `./loader` and `./eslint` get a `.d.mts`
  beside their `.mjs`, checked by tsc.
- **`pnpm lint:pkg`** runs `publint --strict` and
  `attw --pack --profile esm-only` on the tarball, in CI's `test` job.
- **The file list is a contract.**
  - `tools/pack-files.txt` lists every path in the tarball. `pnpm docs:pack`
    rewrites it, and CI fails when it is stale, as it does for
    `docs:commands`. A file entering or leaving the package shows up in
    review.
  - pack-smoke refuses any path hygiene would refuse: tests, fixtures,
    `.parity/`, captures, `.env*` other than `.env.example`.
  - Hygiene's text rules (site names, machine paths, addresses) run over the
    tarball's files as well as the tracked ones.
- **Dependencies are complete.** A test checks that every bare import in a
  shipped file (`dist/`, `scripts/`, `bin/`) is a Node builtin, a
  `dependencies` entry or a peer. pack-smoke catches this only for the paths
  it runs.
- **The README renders on npm.** `docs/readme/` is not in the tarball, so
  the banner and links resolve through `repository`, or become absolute
  URLs if npm does not resolve them. Check this on `rc.0`'s npm page.
- **`agentic-cms --version`** prints the version from `package.json`, with a
  spec entry and a bin case.

### 2 — Release from CI

A new `.github/workflows/release.yml` runs on a pushed `v*` tag, in three
jobs.

1. **`check`** (`contents: read`):
   - the tag equals `package.json`'s `version` (and, after job 4,
     `create-agentic-cms`'s);
   - a release tag (`vX.Y.Z`) is on `main`'s history, and a candidate
     (`vX.Y.Z-rc.N`) is on `develop`'s;
   - for a release, `CHANGELOG.md` has its `## [X.Y.Z]` heading;
   - then the verify block, hygiene, `lint:pkg`, and
     `test:pack --keep <dir>`, which keeps the tarball it proved. The job
     uploads that tarball as an artifact, with its sha512.
2. **`publish`** (`environment: npm`, `id-token: write`, `contents: read`):
   - downloads the artifact and checks its sha512;
   - fails unless npm is 11.5.1 or later and Node 22.14 or later, the
     floors for trusted publishing;
   - runs `npm publish <tarball> --tag latest` for a release, or
     `--tag next` for a candidate.

   This job installs nothing and restores no cache, so a poisoned cache
   cannot reach the publish.
3. **`after`** (`contents: write`):
   - creates the GitHub Release from the version's `CHANGELOG.md` section,
     with the tarball attached and candidates marked as prereleases;
   - runs the registry smoke test in a temp folder:
     `pnpm dlx agentic-cms@<version> init smoke` (after job 4,
     `pnpm create agentic-cms@<version>`), an install with no build
     approval for the kit, then lint, test and build;
   - runs `npm audit signatures` there, which must pass.

More:

- Actions are pinned by commit sha, as in `verify.yml`, and Dependabot
  covers the new workflow.
- A `workflow_dispatch` dry run does everything except the publish, which
  runs with `--dry-run`.
- **`docs/releasing.md` (new)** describes the procedure and the owner's
  clicks. AGENTS.md's git-workflow lines follow: tags are immutable because
  npm publishes them.
- **A bad version is never removed.** The `release tags` ruleset already
  keeps `v*` tags immutable. The next `-rc.N` supersedes a bad candidate,
  and a patch plus `npm deprecate` supersedes a bad release.

### 3 — Install from npm everywhere

- **What `init` writes:**
  - the dependency becomes `"agentic-cms": "^<version>"`
    (`scripts/lib/init.mjs:128`); on 0.x a caret takes patches only;
  - the site's `pnpm-workspace.yaml` loses its `allowBuilds` entry for the
    kit; `sharp` and `unrs-resolver` keep theirs.
- **`init --kit <spec>`** serves the kit's own work: it takes a tarball, or
  a `github:` spec at a sha. pack-smoke uses it with its tarball.
- **The documented line** becomes `pnpm dlx agentic-cms@latest init my-site`,
  and job 4 turns it into `pnpm create agentic-cms my-site`. pack-smoke's
  check of the line (`tools/pack-smoke.mjs:49`) follows.
- **Every GitHub-spec install line goes:**
  - `README.md` (`:279`, `:293`);
  - `docs/init.md`, `docs/setup.md`, `docs/gotchas.md` and
    `docs/upgrading.md`;
  - `SECURITY.md`, where "a site pins the package by tag" becomes "by
    version range";
  - every template file that names the spec.
- **`docs/upgrading.md`** gains `## 0.8.0 → 0.9.0`: the spec moves to
  `^0.9.0`, and the kit's `allowBuilds` entry goes. Job 5's `upgrade` does
  both.

### 4 — `pnpm create agentic-cms`

- **The package,** in `packages/create-agentic-cms/`:
  - its `package.json`: the bin `create-agentic-cms`, and
    `"agentic-cms": "<the same version>"` as an exact dependency;
  - a bin of about twenty lines that runs the kit's `init` with the
    arguments it got;
  - a README.

  It has no logic of its own, so `init` stays the one source of truth. It
  sits outside the root's workspace.
- **Its version always matches the kit's.** The release workflow refuses a
  tag where the two differ, then packs and publishes both, the kit first.
- **pack-smoke** builds a site through it from the two tarballs, with the
  kit's tarball as an override.
- **O5:** its first publish by hand, then its trusted publisher.
- **The docs:** the README's start line and `docs/init.md`.

### 5 — `agentic-cms upgrade`

A site runs `pnpm dlx agentic-cms@<target> upgrade`. The code it runs is the
target version's, which holds every migration up to it. The command:

1. reads the installed version from `node_modules/agentic-cms/package.json`;
2. runs `pnpm add agentic-cms@^<target>`;
3. runs each migration between the two versions. Each one is a file,
   `scripts/migrations/<version>.mjs`, with a `detect()` and an `apply()`.
   Each is idempotent and tested on a fixture site;
4. runs `init --agent-files`, which after job 10 rewrites the few files it
   copies and asks for no merge (a site rule the site edited keeps its own
   lines, the required ones checked);
5. prints each manual step, with a link to its section of
   `docs/upgrading.md`;
6. verifies with `pnpm lint` and `pnpm test`.

More:

- **`--dry-run`** lists what the command would change.
- **Exit codes:** 0 when done, 1 when manual steps are left, 2 for a usage
  or environment error.
- **The first migration,** 0.8.x → 0.9.0, gathers what 0.9.0 changes in a
  site, each piece added by the job that brings it:
  - job 10: the copied skills a site never edited go (the manifest's hashes
    say which), one it edited moves to the site's own folder with a note, the
    rules get thin, and `.claude/settings.json` names the package's
    marketplace;
  - job 9: `redirects()` in `next.config.ts`, and an empty
    `content/redirects.yaml`;
  - job 8: the schema line at the top of each YAML content file;
  - job 3: the dependency spec moves from `github:` to `^0.9.0`, and the
    kit's `allowBuilds` entry goes.

  The gate runs it (R).
- **Built before the package:** this job lands in phase 1 (Order), with the
  migrations of jobs 8–10. Job 3 adds the spec's when it lands, so `upgrade`
  is tested on fixture sites from the start, from a tarball.
- **It follows the command contract:** a spec, `parseOrExit`, tests, bin
  cases, `docs/upgrade.md` with its index line, and `pnpm docs:commands`.

### 6 — What a site can rely on

0.8.2's map, `docs/parts.md`, already lists every part, how to use it
and the check that holds it. This job adds a stable or experimental column
to it, and one short page a site's owner reads before an upgrade (D17).

- **`docs/stability.md`,** one page:
  - what a site can rely on between versions: each stable part keeps its
    name, its options and its behaviour until a major (before 1.0.0, a
    minor, with its migration);
  - what may change in any release: the wireframe's markup and classes, a
    report's wording (a `--json` shape is the contract, not the text), the
    example's content, anything marked experimental;
  - how a change is announced: the changelog, a `deprecated()` warning for
    one minor, an `upgrade` migration or a manual step with its link.

  It links the map's column for the part-by-part answer.
- **The map's new column** marks each part **stable** or **experimental**:
  - every export: the 15 subpaths;
  - every command: its flags, exit codes and `--json` shapes, linked from
    `docs/commands.md`;
  - every file format: the `content/` schemas, `harness.ts`,
    `components.json` and the agent-file manifest `.agentic-cms.json`.

  `./lab` and its commands are probably experimental.
- **A test keeps the page complete.** Every `exports` key and every `SPECS`
  command must appear on it, so each later job adds its row.
- **The policy:**
  - before 1.0.0, a minor may break something, but only with an `upgrade`
    migration or a written manual step;
  - a patch never breaks anything;
  - from 1.0.0 on, semver;
  - a deprecated part warns once per process (a `deprecated()` helper) for
    one minor, and goes in the next breaking release.
- **Support:** the latest minor gets fixes (`SECURITY.md`). The Node floor
  is `engines`, and CI also runs the current LTS line.

### 7 — Peers and engines, tested at both ends

- **Bounded ranges (D6):** each peer is capped at the major CI runs, such
  as `next ^16.3.6`, `react ^19.2.0`, `zod ^4.6.2` and `motion ^13.2.0`.
  `eslint` and `playwright-core` stay optional.
- **A `peers` CI job** builds pack-smoke's site twice:
  - at the floor: each peer at its lowest version, on Node 22.18;
  - at the newest version within each range, on the `.nvmrc` Node.

  It runs on pull requests that touch `package.json`, on `main`, and
  weekly, which catches a new minor that breaks the kit.
- **The unit suites** also run on the Node floor.

### 8 — A schema for every content file

Today a content file is checked when `pnpm content:check` or the build
runs. The engine's schemas are zod, with a `.describe()` on most fields, and
zod 4 writes JSON Schema (`z.toJSONSchema`). Written as files, they let an
editor and an agent see a wrong key or a missing field as it is typed.

- **`agentic-cms schema`** writes one JSON Schema per collection, and one
  for the page files, whose `sections` is a `oneOf` keyed by `type` from the
  section registry's schemas, into `content/_schemas/` (D10).
- **What a field says:**
  - its `.describe()` text becomes the schema's `description`, and its
    `meta()` a line of it: a `ref("authors")` field is a string "a slug of
    `content/authors.json`";
  - no slug is listed, so adding an author leaves the schemas as they are,
    and `content:check` still checks every ref;
  - the schema is the input a file may hold (`io: "input"`): a field
    `optional()` makes takes `null`, a date is a quoted string.
- **Never stale:** `agentic-cms schema --check` fails when a written file
  differs from the code. `docs --check`, which the build already runs,
  runs it too, so a schema change and its files land together.
- **The editor sees it (D11):** the YAML templates in
  `content/_templates/` and the starter's files open with
  `# yaml-language-server: $schema=../_schemas/<file>.json`, and the 0.9.0
  migration adds the line to a site's YAML content files. A post's
  frontmatter has no editor hook; its schema is there for agents.
- **Agents read it:** the editorial skills read a file's schema before
  they write one, and still run `pnpm content:check` after.
- **The command contract:** a spec, `parseOrExit`, tests (the example's
  collections give the same schemas; a stale file fails `--check`), bin
  cases, `docs/schema.md`, `pnpm docs:commands`, the map's row.

### 9 — Redirects as content

The rule is that an indexed URL never changes without a redirect, and
nothing holds it: `retire-content` says redirects "live on the host, in
whatever list" it has.

- **`content/redirects.yaml`,** a collection: each entry `from` (a path),
  `to` (a path or an `https://` URL) and `permanent` (true unless said).
- **The content lint checks it:**
  - each `from` is a path, listed once, and no live page or post (it would
    hide the page);
  - no chain (a `to` that is another entry's `from`) and no loop;
  - a `to` path is a page, a post or the blog index.
- **It reaches the host through Next (D12):** `next.config.ts`'s
  `redirects()` returns `redirectsFor()` from `agentic-cms/content`, read
  at build time. `init` writes the line, and the 0.9.0 migration adds it to
  an existing config.
- **A page that goes leaves a redirect (D13):** `check-site` gains a
  `retired` pass. A page or post file deleted or renamed since the merge
  base, whose URL no redirect names, is a warning with the fix: the
  redirect, or the post kept as a draft (its URL stays, as today).
- **The skills:** `retire-content` writes the redirect itself instead of
  asking about the host, and `new-page` refuses a slug a redirect's `from`
  holds.
- **The SEO audit** fails a sitemap that lists a redirected path.
- **The docs:** `docs/redirects.md`, the collection's field table in
  `src/lib/content/README.md`, `content/README.md`, the map's row.

### 10 — Fewer files copied into a site

`init --agent-files` copies the kit's rules and skills into each site
(`.claude/rules/`, `.claude/skills/`, `.agents/skills/`). Each release's
change to one comes back as `kept, kit changed`, merged by hand with
`--diff` and `--accept`: most of 0.8.x's upgrade work. And the editorial
plugin comes from the GitHub marketplace, so it follows the kit's `main`
branch, not the version the site pins.

A site must keep little of its own: its `AGENTS.md`, each rule's `paths`
(Claude Code loads a rule only from `.claude/rules/`), the lines the kit
marks required, and its own edits. The rest is reference that should change
with the pin, from the package, which already ships `docs/`.

- **The skills come from the installed package (D14).** The package ships
  `.claude-plugin/marketplace.json` and two plugins: `editorial`, as today,
  and `design`, the seven design skills. A site's `.claude/settings.json`
  names the marketplace by path, `./node_modules/agentic-cms`.
  `.claude/skills/` then holds only the site's own skills.
  - **First step:** prove that Claude Code reads a `directory` marketplace
    inside `node_modules`, with its skills listed and loaded. If it does
    not, D14 (b): the copies stay, rewritten on every upgrade, never merged.
- **Codex (D15):** a stub per skill in `.agents/skills/`: its frontmatter
  name and description, and one line naming
  `node_modules/agentic-cms/.agents/skills/<name>/SKILL.md`.
- **The rules get thin.** A site's `.claude/rules/<name>.md` keeps its
  `paths`, the required lines and the site's own lines, and ends with a
  pointer: "Before an edit these paths match, read the kit's rule,
  `node_modules/agentic-cms/templates/site/rules/<name>.md`". A site that
  edited a rule keeps its edits; the kit's text changes in the package.
- **The guides,** like Payload's skill index: the site's `AGENTS.md` gets a
  short table, from a task to the guide in `node_modules/agentic-cms/docs/`,
  in place of the text it copies today, which keeps it well under its
  budget.
- **The manifest** (`.agentic-cms.json`) records the thin rules, the stubs
  and the settings keys. `--check` still fails a required line gone, and
  passes a site's own edits.
- **The 0.9.0 migration** (job 5) moves a site there.
- **The kit's own checkout** keeps its full files, being their source;
  `skills:sync` stays.

### 11 — A preview link on every pull request

Today the owner reviews a change by its diff, or runs the site. A preview
puts it on the real pages, on any device, before the merge: the review
surface the 1.0.0 briefs recommend.

- **A `preview` job** in the site's CI workflow (the template's
  `verify.yml`; an existing site copies it):
  - on a pull request, the site builds as production with
    `AGENTIC_CMS_PREVIEW=1`, and a Workers version goes up without being
    deployed, under the alias `pr-<n>` (D16): OpenNext's `upload` with
    wrangler's `--preview-alias`, or `wrangler versions upload` after
    OpenNext's build if `upload` cannot pass it (the job's first check);
  - one comment, updated on each push: the link, and the pages the change
    touches (each changed page or post file's route; "every page" when the
    chrome, a component or a collection more than one page reads changed).
- **A preview is not the site:**
  - every page answers `X-Robots-Tag: noindex` (a `_headers` file the
    preview build adds to the assets), and the robots file disallows all;
  - the form endpoint delivers to a log sink, never the site's
    destination;
  - consent tags load nothing;
  - the SEO audit knows the flag.
- **Secrets:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, the site
  owner's (O6 for the kit's example). A pull request from a fork has no
  secrets, and its run says it made no preview.
- **Other hosts:** Vercel and Netlify make their own previews.
  `docs/deploy.md` says what to set there (the noindex, the form sink). The
  kit makes none for a Node host.
- **Tests:** a stubbed `wrangler` gives the alias, the comment's text and
  the fork case; `check-site`'s `ci` pass knows the job.
- **The docs:** `docs/preview.md`, `docs/deploy.md`, the template workflow,
  the map's row.

### 12 — The docs, the README, and the way from 0.8

- **The sweep,** as every release does: the README, both `AGENTS.md`, the
  skills, each guide a job touched, `docs/parts.md`, `docs/README.md`'s
  index; the changelog is the conductor's.
- **`docs/migrating-to-0.9.0.md`,** a site's way from 0.8.x:
  `pnpm dlx agentic-cms@0.9.0 upgrade`, what it does (job 5's migration),
  and what stays by hand: the preview job's secrets, the host's own
  redirects moved into `content/redirects.yaml`, the editor's YAML
  extension. `docs/upgrading.md`'s `## 0.8.4 → 0.9.0` links it.
- **How the kit differs, on the README's first screen.** Payload now calls
  itself "the agentic content framework", and a reader who meets both
  should see in one screen that they are different tools. A section after
  "Files, not a database" (a draft, its facts dated and linked):

  > **Next to Payload.** Payload is a framework for apps and headless
  > CMSs: a database, an admin panel generated from code, an API at request
  > time, auth and access control. Its agents read and write the database
  > through MCP. agentic-cms has none of those. Its content is files in git,
  > its editor is an agent working in pull requests, and its build refuses
  > what breaks the site's rules: the schema, the voice and the claims, the
  > SEO, the engines in code, the pixels. What ships is static.
  >
  > | | Payload | agentic-cms |
  > |---|---|---|
  > | Content lives in | a database (MongoDB, Postgres, SQLite) | files under `content/`, in git |
  > | Who edits | people in the admin; agents through MCP | an agent, in a pull request a person merges |
  > | An agent's mistake meets | field validation and access rules, then the database | the build (schema, voice, SEO, engines), then the review |
  > | Design | the site's own code | the component library's rules, and a pixel proof before a merge |
  > | At request time | the server and the database | nothing: prerendered and static |
  > | Pick it when | editors don't use git, the site has logins, content changes without a deploy | an agent runs a marketing site or a blog, and its voice, SEO and design must hold |

  The npm description (job 1) says the same in one line. This section is
  docs alone and may land first, on its own.

### R — Release 0.9.0

1. Tag `v0.9.0-rc.0` from `develop` once jobs 1 and 2 have landed. It
   proves the pipeline end to end (OIDC, provenance, the registry smoke
   test) before anything depends on it. O3 comes just before it.
2. Tag `v0.9.0-rc.1` once every job has landed. It is published to `next`
   through the workflow, with the owner's approval.
3. **The gate is the owner's,** run in each site's own sessions: on two
   sites on 0.8.x, `pnpm dlx agentic-cms@next upgrade`, then a build, a
   proof that nothing moved and a preview link on the gate's pull request.
   Findings come back as kit fixes and the next `-rc.N`.
4. **The release:**
   - the release commit and the release PR, which the owner merges;
   - the tag `v0.9.0` on `main`, published to `latest` with the owner's
     approval;
   - the GitHub Release.
5. **Time the target:** from an empty folder, `pnpm create agentic-cms
   my-site` to `pnpm kit serve`.

### S — The sites follow

Each site's own session runs `upgrade` to `^0.9.0`, proves that nothing
moved, and merges.

## Order

The owner's order (2026-10-29): what a site gets first, then the docs,
then the package. And no stream of commits and pull requests: each lane of
a phase is one pull request, with one commit per job, each proven before
the next (fixes go into the job's commit before the push). Its changelog
lines are in the pull request's body, and the conductor writes them into
`CHANGELOG.md` with the release commit, not one commit per merge.

```
now            O2 (owner): publish v0.8.4's tarball by hand, which holds the name; O1, O4
               [0] this plan into docs/roadmap.md
Phase 1        Lane A  [8 schema] → [9 redirects] → [11 preview] (+ O6)
               Lane B  [6 stability] → [10 fewer copies] → [5 upgrade]
Phase 2        [12 docs, README, migrating-to-0.9.0]   (its README section may land first)
Phase 3        Lane A  [1 tarball] → [2 release CI] → O3 → rc.0 → [3 npm installs] → [4 create] (+ O5)
               Lane B  [7 peers] after 1
then           rc.1 → gate → R → S
```

- Job 6 comes first in its lane: its test then makes every later job add
  its part's row.
- Job 5 follows job 10, since its first migration moves a site's agent
  files; jobs 8 and 9 add theirs as they land, and job 3 the spec's.

The jobs overlap in these files; whichever pull request lands second
rebases:

- `package.json`: jobs 1, 4 and 7;
- `tools/pack-smoke.mjs`: jobs 1, 3, 4, 5, 7, 8, 9 and 10;
- `scripts/lib/init.mjs`: jobs 3, 5, 8, 9 and 10;
- `scripts/lib/check-site.mjs`: jobs 9 and 11;
- `verify.yml` and the template's: jobs 1, 7 and 11;
- `release.yml`: jobs 2 and 4;
- `docs/parts.md`: jobs 6, 8, 9, 10, 11 and 12;
- `README.md`: jobs 3, 4 and 12.

## Risks and how each is held

- **The first publish has no provenance.**
  - *Hold:* D2's hand publish covers one version, and trusted publishing is
    set before the next.
- **A trusted publisher that doesn't match the run fails with E404.** The
  owner, repository, workflow file name and environment must match the run
  exactly.
  - *Hold:* the `workflow_dispatch` dry run, and `rc.0` before anything
    depends on it.
- **A publish can't be taken back.**
  - *Hold:* the environment approval (D3), the `check` job before it, and a
    candidate before every release.
- **A stale `dist/` ships.**
  - *Hold:* `prepack` rebuilds it, and the published tarball is the one
    `test:pack` proved, by sha.
- **A file leaks into the tarball** (a capture, a machine path, a site's
  name).
  - *Hold:* the file-list snapshot in review, and hygiene over the
    tarball.
- **Sites stay on `github:` specs.**
  - *Hold:* `upgrade`'s first migration moves them, and git specs keep
    working (D7).
- **npm's rules change again.** In 2025 npm revoked classic tokens, capped
  write tokens at 90 days and moved logins to two-hour sessions.
  - *Hold:* the kit uses no token at all, only OIDC.
- **The name is taken before 0.9.0.** Nothing is published yet.
  - *Hold:* O2 now, with `v0.8.4`'s tarball.
- **Claude Code reads no marketplace inside `node_modules`.**
  - *Hold:* job 10's first step proves it before anything depends on it;
    D14 (b) keeps the copies, with no merges.
- **A preview gets indexed, or sends a real form.**
  - *Hold:* the noindex header and robots file, the log sink, and a test
    of each on the preview build.
- **A schema file drifts from the code.**
  - *Hold:* `schema --check` in `docs --check`, which every build runs.
- **A redirect hides a live page.**
  - *Hold:* the content lint refuses a `from` that is a page or a post.

## Later

- A docs site built on the kit itself (1.0.0's "Name and home").
- The 1.0.0 briefs (D9).
- Publishing from self-hosted runners, which trusted publishing does not
  support yet; the kit does not need it.
- **From the 0.8.0 roadmap, still open:**
  - `sheet` cells rendered from a route;
  - three.js scenes in the lab;
  - the `editorial` plugin mirrored as project skills, if wanted;
  - the hold of other origins' scripts for a `--url` site;
  - `agentic-cms/ix/motion.css`, the option (b) of 0.8.0's job 8;
  - the second-use primitives, and `LazyBackdrop`/`PauseOffscreen` in the
    package, each when a second site needs it;
  - a site-side check for machine addresses in tracked files (hygiene's
    `IP:port` rule as a site command), by demand.

## Verification, every job

Carried over from the 0.8.0 roadmap: the kit's verify block (`AGENTS.md`),
`pnpm hygiene --brand <site>`, `pnpm test:browser` when browser-facing code
changed, `pnpm test:pack` when the package surface changed, and
`visual-parity proof` of the example in both schemes when anything under
`src/` changed. The owner's word before a merge, given for this plan's
lanes as auto-merge once CI is green.

## Verification — the end state

- `npm view agentic-cms dist-tags` shows `latest: 0.9.0`, and
  `npm audit signatures` in a fresh site passes, with a provenance
  attestation for 0.9.0.
- In an empty folder, `pnpm create agentic-cms my-site` installs without a
  build approval for the kit, and then lints, tests and builds clean.
- A site on 0.8.x reaches 0.9.0 with `pnpm dlx agentic-cms@0.9.0 upgrade`,
  with no hand edit beyond the steps it prints, and no merge of an agent
  file.
- In that site:
  - a YAML content file with a wrong key shows the error in the editor,
    before any command runs;
  - a page file deleted without a redirect warns in `pnpm lint`;
  - a pull request gets a comment with its preview link, and the preview
    answers `noindex`.
- `docs/stability.md` exists, and the README's first screen says how the
  kit differs from a database CMS.
