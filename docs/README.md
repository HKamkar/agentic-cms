# agentic-cms docs

The guides, one per topic; the README is the front door and `AGENTS.md` the
rules for an agent working on the code.

- [commands.md](commands.md) — the command line: every command, its flags,
  its exit codes, the JSON it prints (generated from the specs).
- [visual-parity.md](visual-parity.md) — the screenshot harness: what a
  capture contains, how to read a compare, the traps a long run meets.
- [shot-probe-sheet.md](shot-probe-sheet.md) — one command instead of a
  script: a picture of a section with its box, the numbers behind a
  screenshot claim, a sheet of candidates to pick from.
- [roadmap.md](roadmap.md) — what 0.4.0 adds for agents, job by job.

The engines' contracts live next to their code and ship with the package:
`src/lib/content/README.md`, `blog/README.md`, `seo/README.md`,
`forms/README.md` (under `node_modules/agentic-cms/` on a site that
installs it). The design system of the example is `STANDARD.md`; the
editorial plugin's contract is `plugin/README.md`.
