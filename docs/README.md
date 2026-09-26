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
- [design.md](design.md) — designing on the kit: what works by default,
  the loop, measure-don't-guess, what stays out of the kit.
- [skills.md](skills.md) — the design skills: when each applies, what it
  leans on, how a site keeps them current.
- [init.md](init.md) — starting a site with `agentic-cms init`, what it
  writes, what comes next, what to do after a kit upgrade.
- [icons.md](icons.md) — icons as families: the Lucide / Simple Icons map,
  the site's own marks from primitives, the inventory of every icon.
- [lab.md](lab.md) — the design canvas for the site's own graphics: SVG
  scenes on the site's tokens, light and dark, on a phone; rendered to the
  files a page ships; removed when done.
- [email.md](email.md) — keeping the e-mail address out of served files:
  the token, `EmailLink`, `withEmailToken`, `guard-email` in the build.
- [deploy.md](deploy.md) — a Node server host: `output: "standalone"`,
  `assemble` as the build's last step, the copy that nests and the check
  that catches it.
- [roadmap.md](roadmap.md) — what 0.4.0 adds for agents, job by job.

The engines' contracts live next to their code and ship with the package:
`src/lib/content/README.md`, `blog/README.md`, `seo/README.md`,
`forms/README.md` (under `node_modules/agentic-cms/` on a site that
installs it). The design system of the example is `STANDARD.md`; the
editorial plugin's contract is `plugin/README.md`.
