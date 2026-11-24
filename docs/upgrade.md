# Upgrading with one command: `agentic-cms upgrade`

A site moves to a release by running that release's own code in its root:

```bash
pnpm dlx --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v<next> upgrade --dry-run
pnpm dlx --allow-build=agentic-cms@git+https://github.com/HKamkar/agentic-cms.git agentic-cms@github:HKamkar/agentic-cms#v<next> upgrade
```

The release carries every migration up to itself, so the code that moves
the site knows every step between the site's version and its own. Once
the kit is on npm, the line is `pnpm dlx agentic-cms@<next> upgrade`.
[upgrading.md](upgrading.md) is the same procedure by hand, with each
release's own steps; [stability.md](stability.md) says what a release may
change.

## What it does

1. **The version the site is on:** `node_modules/agentic-cms`'s, or the
   one `.agentic-cms.json` records when that is older (a pin moved by hand
   before the upgrade ran). `--from <version>` names it where neither says.
2. **The pin:** `pnpm add agentic-cms@<spec>`, the spec in the site's own
   form at the running release: a git tag moved to `v<next>`, a range to
   `^<next>`. A pin of another form — a tarball, a commit — is the site's
   to name with `--kit <spec>`. An install that fails stops the command
   before anything else changes.
3. **The migrations:** each one this release carries newer than the
   site's version, oldest first. A migration is one file,
   `scripts/migrations/<version>.mjs`, made of the pieces that release
   brings, each a `detect()` (what it would change) and an `apply()` (the
   change, and what is left by hand). Both are idempotent: a second run
   changes nothing, and names a manual step until the site has taken it.
4. **The agent files:** `init --agent-files`, which rewrites the kit's
   lines and keeps the site's own ([init.md § After a kit
   upgrade](init.md#after-a-kit-upgrade)).
5. **What is left by hand:** each step a migration found, with its section
   of `node_modules/agentic-cms/docs/upgrading.md`.
6. **The verify:** `pnpm lint` and `pnpm test` in the site.

`--dry-run` runs 1, prints the spec of 2, runs each `detect()` and the
agent files' `--check`, and changes, installs and runs nothing. `--json`
prints the report as one document. Exit codes: `0` done, the verify green
and nothing left by hand (or a dry run); `1` a step left by hand, or the
verify failed; `2` the site could not be read (no `package.json`, no
`agentic-cms` dependency, a pin it does not move without `--kit`, no
version without `--from`) or the install failed, and nothing was changed.
Then commit what it changed, the lockfile and the manifest with it, and
prove the site as a release asks ([visual-parity.md](visual-parity.md)).

## The migrations

| Version | Pieces |
|---|---|
| 0.9.0 | the agent files: 0.8's copies moved — a skill copy the site never touched goes, one it edited becomes `<name>-site`, each rule thin with the site's own lines kept, the base copies gone; by hand, the copied sections of `AGENTS.md` and `CLAUDE.md`. The content schemas: each YAML content file's schema line, then `content/_schemas/` and the field tables from the site's installed command line. The redirects: an empty `content/redirects.yaml` and `redirects()` in the Next config; by hand, a config with redirects of its own ([migrating-to-0.9.0.md](migrating-to-0.9.0.md), [upgrading.md § 0.8.4 → 0.9.0](upgrading.md#084--090)) |

A release that changes something in a site adds its piece to its own
migration, with a fixture site as the release before it left one
(`tools/migration-fixture.mjs`), a test that `apply()` twice changes
nothing the second time, and the run from the packed tarball in
`pnpm test:pack`.
