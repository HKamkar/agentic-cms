# Roadmap — 0.9.0: a standard npm package

> Plan, not started: it begins after the `v0.8.2` tag, once 0.8.1's fixes
> and 0.8.2's map and checks (`docs/roadmap-0.8.2.md`) have landed. Written
> 2026-10-16 from a read of the kit at `develop` e615341. When 0.9.0
> starts, this file becomes `docs/roadmap.md` (job 0). The owner took every
> decision's recommendation on 2026-10-17.

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

## The owner's steps

Only the owner can do these, because each one needs the owner's npm login
or approval.

- **O1, before job 2:** an npm account with two-factor authentication (a
  security key), and the organisation if D1 is (b).
- **O2, right after the `v0.8.0` tag (D2a):** publish the tag's tarball by
  hand: `pnpm pack` on the tag, then `pnpm publish <tarball>` with 2FA. The
  npm page for 0.8.0 shows 0.8.0's GitHub install lines; 0.9.0 replaces
  them.
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
- **Every publish:** the owner approves the release workflow's publish job
  (D3).

## The jobs

| # | Job | What it changes |
|---|---|---|
| 0 | This plan into the repo | `docs/roadmap.md` becomes this file |
| 1 | The tarball is the product | the metadata, a fresh `dist/`, types on every subpath, the file list as a contract |
| 2 | Release from CI | `release.yml`: checks, OIDC publish, GitHub Release, a smoke test from the registry |
| 3 | Install from npm everywhere | `init`'s dependency spec, `allowBuilds`, every install line |
| 4 | `pnpm create agentic-cms` | `packages/create-agentic-cms/`, a thin wrapper around `init` |
| 5 | `agentic-cms upgrade` | the upgrade guide made executable, with migrations per version |
| 6 | The public surface | a stable/experimental column on 0.8.2's `docs/parts.md`, and the deprecation policy |
| 7 | Peers and engines | bounded ranges, tested at the floor and at the newest version |
| R | Release 0.9.0 | `rc.1` on `next`, the gate, `0.9.0` on `latest` |
| S | The sites follow | `upgrade` in each site's own session |

### 0 — This plan into the repo

- After `v0.8.2`, this file replaces `docs/roadmap.md`. The 0.8.0 roadmap's
  open Later items move into this one's Later, and the decisions are
  recorded as **Decided:**.
- The 0.8.0 roadmap's principles, hygiene list and per-job verification
  carry over unchanged.

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
4. runs `init --agent-files --diff`, and the `--accept` the diff calls for;
5. prints each manual step, with a link to its section of
   `docs/upgrading.md`;
6. verifies with `pnpm lint` and `pnpm test`.

More:

- **`--dry-run`** lists what the command would change.
- **Exit codes:** 0 when done, 1 when manual steps are left, 2 for a usage
  or environment error.
- **The first migration,** 0.8.0 → 0.9.0, moves the dependency spec from
  `github:` to `^0.9.0` and removes the kit's `allowBuilds` entry. The gate
  runs it (R).
- **It follows the command contract:** a spec, `parseOrExit`, tests, bin
  cases, `docs/upgrade.md` with its index line, and `pnpm docs:commands`.

### 6 — The public surface, written down

0.8.2's map, `docs/parts.md`, already lists every part, how to use it
and the check that holds it. This job adds a stable or experimental column
to that page instead of writing a page of its own.

- **The map's new column** marks each part **stable** or **experimental**:
  - every export: the 15 subpaths;
  - every command: its flags, exit codes and `--json` shapes, linked from
    `docs/commands.md`;
  - every file format: the `content/` schemas, `harness.ts`,
    `components.json` and the agent-file manifest `.agentic-cms.json`.

  `./lab` and its commands are probably experimental.
- **A test keeps the page complete.** Every `exports` key and every `SPECS`
  command must appear on it.
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

### R — Release 0.9.0

1. Tag `v0.9.0-rc.0` from `develop` once jobs 1 and 2 have landed. It
   proves the pipeline end to end (OIDC, provenance, the registry smoke
   test) before anything depends on it. O3 comes just before it.
2. Tag `v0.9.0-rc.1` once every job has landed. It is published to `next`
   through the workflow, with the owner's approval.
3. **The gate is the owner's,** run in each site's own sessions: on two
   sites on 0.8.0, `pnpm dlx agentic-cms@next upgrade`, then a build and a
   proof that nothing moved. Findings come back as kit fixes and the next
   `-rc.N`.
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

```
after v0.8.0   O1, O2, O4 (owner); the jobs start after v0.8.2
Lane A         [0] → [1 tarball] → [2 release CI] → O3 → rc.0 → [3 npm installs] → [4 create] (+ O5) → [5 upgrade]
Lane B         [6 surface] after 0;  [7 peers] after 1
then           rc.1 → gate → R → S
```

The jobs overlap in these files; whichever pull request lands second
rebases:

- `package.json`: jobs 1, 4 and 7;
- `tools/pack-smoke.mjs`: jobs 1, 3, 4 and 7;
- `scripts/lib/init.mjs`: jobs 3 and 5;
- `verify.yml`: jobs 1 and 7;
- `release.yml`: jobs 2 and 4.

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

## Later

- A docs site built on the kit itself (1.0.0's "Name and home").
- The 1.0.0 briefs (D9).
- Publishing from self-hosted runners, which trusted publishing does not
  support yet; the kit does not need it.

## Verification — the end state

- `npm view agentic-cms dist-tags` shows `latest: 0.9.0`, and
  `npm audit signatures` in a fresh site passes, with a provenance
  attestation for 0.9.0.
- In an empty folder, `pnpm create agentic-cms my-site` installs without a
  build approval for the kit, and then lints, tests and builds clean.
- A site on 0.8.0 reaches 0.9.0 with `pnpm dlx agentic-cms@0.9.0 upgrade`,
  with no hand edit beyond the steps it prints.
