# Releasing

How a version of `agentic-cms` reaches npm: from a pushed tag, through the
release workflow, with the owner's approval. A publish is permanent, so
every step before it is a check, and every step the owner takes is named
here. The decisions behind it are D1–D5 of the 0.9.0 plan
([roadmap.md § Decisions](roadmap.md#decisions)), and the owner's steps
its O1–O5 ([§ The owner's steps](roadmap.md#the-owners-steps)).

## The two channels

- **A release,** `X.Y.Z`, goes to the `latest` dist-tag, what
  `pnpm add agentic-cms` installs. Its tag, `vX.Y.Z`, sits on `main`, on
  the merge of the release pull request, and `CHANGELOG.md` has its
  `## [X.Y.Z]` section.
- **A candidate,** `X.Y.Z-rc.N`, goes to `next`, what
  `pnpm add agentic-cms@next` installs. Its tag, `vX.Y.Z-rc.N`, sits on
  `develop`.

`package.json`'s `version` is the version: a commit sets it, and the tag
names that commit. The workflow refuses a tag that names another version,
a release off `main`'s history, a candidate off `develop`'s, and a release
without its changelog section.

## The workflow

`.github/workflows/release.yml` runs on a pushed `v*` tag, in three jobs;
its logic is `tools/release.mjs`, which runs the same on a laptop.

1. **`check`** reads the repository and nothing else. It runs
   `node tools/release.mjs check --tag <tag>` (the rules above), then the
   verify block (`pnpm lint`, `pnpm test`, `pnpm build`), `pnpm hygiene`,
   `pnpm test:pack --keep <dir>`, which keeps the tarball it built a site
   from, and `pnpm lint:pkg --tarball` on that same file. The tarball goes
   up as the run's artifact, `agentic-cms-<version>`, beside its sha512 in
   npm's form (`<tarball>.sha512`, `sha512-<base64>`).
2. **`publish`** runs in the environment `npm`, so it waits for the
   owner's approval, and holds an OIDC token for npm's trusted publishing
   and no other secret. It installs nothing and restores no cache: it
   downloads the artifact, checks its sha512 against the one `check`
   computed, checks npm and Node against trusted publishing's floors, npm
   11.5.1 and Node 22.14.0, and asks the registry for the version:
   - absent: `npm publish <tarball> --tag <next|latest>`. Trusted
     publishing attaches the provenance attestation itself: "This happens
     by default—you don't need to add the `--provenance` flag"
     ([npm Docs, trusted publishing](https://docs.npmjs.com/trusted-publishers));
   - present, from this same tarball (the sha512 npm holds is the
     artifact's): nothing to publish. That is a package's first version,
     which goes up by hand ([below](#the-first-publish-of-a-package-by-hand));
   - present, from another tarball: the job fails. A version is never
     published twice.
3. **`after`** writes the repository's release and checks the registry's
   copy:
   - the GitHub Release of the tag, its text the version's section of
     `CHANGELOG.md` (a candidate's, the section so far), the tarball and
     its sha512 attached, a candidate marked a prerelease;
   - `node tools/release.mjs smoke <version>`: a site laid out by
     `pnpm dlx agentic-cms@<version> init`, the kit installed from the
     registry with no build approval for it, then the site's build (its
     placeholders warnings, as its own CI runs it), its lint and its
     tests;
   - `node tools/release.mjs audit <version>`: `npm audit signatures`
     over an install of the version with npm, which verifies every
     package's registry signature and the attestations of each that has
     them.

A **dry run** is the same workflow started by hand: Actions → release →
Run workflow, on any branch. `check` runs in full on that branch's head,
then `npm publish --dry-run` outside the environment and with no token. It
publishes nothing, writes no GitHub Release, and leaves the tarball it
proved as the run's artifact.

## A candidate

1. On `develop`, a commit sets `version` to `X.Y.Z-rc.N`: the candidate's
   release commit, with the changelog so far.
2. The owner tags that commit and pushes the tag:

   ```bash
   git tag -a v0.9.0-rc.1 -m "agentic-cms 0.9.0-rc.1" <sha>
   git push origin v0.9.0-rc.1
   ```

3. `check` runs, minutes for the build and the pack smoke. When `publish`
   waits, the owner approves it: the run's page → Review deployments →
   `npm` → Approve and deploy.
4. `after` posts the GitHub Release and runs the smoke test from the
   registry. `npm view agentic-cms dist-tags` names the candidate under
   `next`.

## A release

1. The release commit on `develop`: `version` set to `X.Y.Z`, the
   changelog's `## [Unreleased]` renamed `## [X.Y.Z] — <date>`, the agent
   files' record (`pnpm agent-files:releases`). Then the release pull
   request from `develop` into `main`, merged as a merge commit, never
   with `--delete-branch`: its head is `develop`.
2. The owner tags the merge on `main`, an annotated tag, and pushes it, as
   for a candidate.
3. The owner approves `publish`; `after` follows. `latest` now names the
   release.

## The first publish of a package, by hand

npm sets up a trusted publisher only for a package that already exists:
"The package you're configuring must already exist on the npm registry"
([npm Docs, `npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust)).
So each package's first version goes up from the owner's own account (D1,
D2): `agentic-cms`'s is `0.9.0-rc.0`, under `next`; `create-agentic-cms`'s
its first candidate (O5). The file is the one the workflow proved, never
one packed by hand:

1. Push the candidate's tag, as for any candidate. `check` runs in full,
   and `publish` waits for approval: leave it waiting.
2. Download the run's artifact, and check the tarball against its sha512:

   ```bash
   gh run download <run-id> --repo HKamkar/agentic-cms --name agentic-cms-0.9.0-rc.0 --dir rc0
   node tools/release.mjs integrity rc0/agentic-cms-0.9.0-rc.0.tgz   # prints what rc0/agentic-cms-0.9.0-rc.0.tgz.sha512 holds
   ```

3. Publish it from the owner's account, logged in to npm (`pnpm login`):

   ```bash
   pnpm publish rc0/agentic-cms-0.9.0-rc.0.tgz --tag next --no-git-checks
   ```

   pnpm asks for the second factor as the registry requests it. For an
   account whose second factor is a security key, that is npm's web
   approval: pnpm prints a link and a QR code; open either, approve with
   the key, and the publish goes on ("If the registry requests web-based
   authentication, pnpm will print a scannable QR code along with the
   URL", [pnpm publish](https://pnpm.io/cli/publish); `--otp` is for an
   authenticator app's code, which a security key does not give).
   `--no-git-checks` because what is published is a file, not the
   checkout's branch.
4. Approve the waiting `publish` job. It finds the version on the registry
   with the artifact's sha512, publishes nothing, and `after` posts the
   GitHub Release and runs the smoke test from the registry. `npm audit
   signatures` passes on it: every version carries the registry's
   signature, and a version without an attestation is not a failure.
5. **Look at the npm page,** `https://www.npmjs.com/package/agentic-cms`:
   the README renders, and its pictures and links, relative paths under
   `docs/readme/` and `docs/` that the tarball leaves out, resolve. npm's
   docs say only that a README is "rendered as GitHub Flavored Markdown"
   ([npm Docs](https://docs.npmjs.com/about-package-readme-files)), not
   whether a relative path resolves through `repository`. If one does not,
   the next candidate makes them absolute URLs on the tag
   (`https://raw.githubusercontent.com/HKamkar/agentic-cms/<tag>/…`).
   The page shows the README of the version `latest` names.
6. **O3, right after,** on npmjs.com, the package → Settings:
   - **Trusted publishing:** GitHub Actions; organization or user
     `HKamkar`, repository `agentic-cms`, workflow filename
     `release.yml`, environment name `npm`. Allowed actions: tick
     `npm publish`. A configuration made after 2026-09-03 allows only
     `npm stage publish` until told otherwise, and the workflow runs
     `npm publish` ([npm Docs](https://docs.npmjs.com/trusted-publishers)).
     Every field must match the run exactly: "All fields are
     case-sensitive and must be exact."
   - **Publishing access:** "Require two-factor authentication and
     disallow tokens", then Update Package Settings. The trusted publisher
     goes on working: "The "disallow tokens" setting only affects
     traditional token authentication."
7. **`rc.1` from CI within two days of O3.** "A newly created trusted
   publisher configuration must complete its first successful publish
   within 2 days", or "it expires and can no longer be used or edited"
   ([npm Docs](https://docs.npmjs.com/trusted-publishers)). That first
   publish proves the publisher, the workflow and the environment match,
   and is the first version with provenance.

A hand publish carries no provenance; every publish after it does.

### What `latest` names after `rc.0`

The candidate itself. npm's docs: "Publishing a package sets the `latest`
tag to the published version unless the `--tag` option is used"
([npm Docs, `npm dist-tag`](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag)),
and the registry holds a package's dist-tags as "an object with at least
one key, `latest`"
([the registry's API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)).
A package whose only version went up under `next` has no other version for
`latest` to name, so the registry names that one, and a later candidate
under `next` leaves it there. Until 0.9.0 is published, a bare
`pnpm add agentic-cms` installs `0.9.0-rc.0`. Nothing needs fixing: no
guide installs from npm before 0.9.0, and 0.9.0's publish to `latest`
moves the tag. Check it once, right after the hand publish:

```bash
npm view agentic-cms dist-tags   # latest and next: both 0.9.0-rc.0
```

## The environment `npm` (O4)

The owner creates it once, before the first tag is pushed, in the
repository's Settings → Environments → New environment, named `npm`. A job
that names an environment the repository lacks creates it, with no
reviewer and no rule, so a tag pushed first would publish unapproved.

- **Required reviewers:** the owner, with "Prevent self-review" off: the
  owner pushes the tag and approves its publish.
- **Deployment branches and tags:** "Selected branches and tags", one rule
  of type tag, `v*`. A run from a branch, a dry run among them, cannot
  enter it, so only a tag's run can publish.
- **No secret:** trusted publishing needs none.

Or through the API, on the owner's word (the reviewer is the owner's
GitHub user id):

```bash
id=$(gh api users/HKamkar --jq .id)
gh api -X PUT repos/HKamkar/agentic-cms/environments/npm --input - <<EOF
{"prevent_self_review": false, "reviewers": [{"type": "User", "id": $id}],
 "deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
EOF
gh api -X POST repos/HKamkar/agentic-cms/environments/npm/deployment-branch-policies -f name='v*' -f type=tag
```

The trusted publisher names the environment (O3), so no other workflow or
job publishes, whatever token it holds.

## What never happens

- **A version is never unpublished or published twice.** npm keeps a
  number once it has been used. The next `-rc.N` supersedes a bad
  candidate; a patch supersedes a bad release, and the owner deprecates
  it: `npm deprecate agentic-cms@<version> "<what to take instead>"`.
- **A tag never moves.** The `release tags` ruleset keeps every `v*` tag
  from being moved or deleted, and npm has published what each one names.
- **No token exists.** Publishing is trusted publishing alone, and the
  package's publishing access disallows tokens.

## When something fails

| Symptom | Do this |
|---|---|
| `check`: the tag is not package.json's version | The tag names a commit with another `version`. Tag the right commit with the next number; a tag that published nothing can stay |
| `check`: a candidate is not on develop's history (a release, main's) | Tag a commit of that branch |
| `check`: no `## [X.Y.Z]` section | The release commit writes it; tag again with the next number once it is on `main` |
| `publish` fails with E404, ENEEDAUTH or a 403 on the publish | The trusted publisher does not match the run, or does not allow `npm publish`: `HKamkar`, `agentic-cms`, `release.yml` and `npm`, exactly (O3) |
| `publish`: the version is on the registry from another tarball | It was published before from another pack: tag the next candidate |
| `publish`: npm or Node is under the floor | Move `.nvmrc` to a Node whose npm is 11.5.1 or later |
| `publish` cannot enter the environment | The run is not a tag's, or the environment's rule is not `v*` on tags (O4) |
| `after`'s smoke test or audit fails | The version is out: fix it on `develop` and tag the next candidate (or a patch) |
