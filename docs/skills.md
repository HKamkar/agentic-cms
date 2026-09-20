# The skills

A skill is a procedure an agent follows for a recurring job, as a
`SKILL.md` with a name and a description that says when to use it. The
design skills ship in the repo itself — `.claude/skills/<name>/SKILL.md`
for Claude Code, `.agents/skills/<name>/SKILL.md` for Codex, byte-identical
(`pnpm skills:sync` copies the first over the second; the tests and the
hygiene check assert they agree) — so they are there in any checkout, and in
any site `agentic-cms init` laid out, with nothing installed. The content
jobs are the `editorial` plugin (`plugin/README.md`), which a site enables
from the kit's marketplace.

| skill | when | what it leans on |
|---|---|---|
| `design` | designing a site from the wireframe or from one look to the next; restyling, theming, branding | the order (tokens → chrome → sections → motion), the loop per element, the rules that survive every look |
| `design-options` | the owner has to choose a look; "show me a few" | `pnpm kit sheet` for static candidates, a demo route on the dev server for live ones, the pick by row |
| `design-measure` | a screenshot or a description of what a page looks like, before any layout, spacing, size, z-index or timing edit | `pnpm kit probe` (box, computed, stacking, reveals, timeline), `pnpm kit shot` |
| `design-proof` | before any merge that touches `src/`, styles or images; reading a compare | `pnpm kit visual-parity capture --ref`, `compare --json`, the verdicts |

Each skill says what to read first, the steps, the verify block and where
it stops for the owner. They are brand-neutral by rule: every fact about the
site is read from the repo (`STANDARD.md`, `src/config/site.ts`, the
catalogue), and the hygiene check keeps any showcased site's name out of
them.

## On a site that installs the package

`agentic-cms init` copies the skills and the rules and records their hashes
in `.agentic-cms.json`; after a kit upgrade, `agentic-cms init --agent-files`
brings the new ones in and keeps any file the site edited, and
`--agent-files --check` reports what drifted (`ok`, `modified` — the site's
edit, kept; `stale` — the kit has a newer one; `missing`) and exits 1, so
CI can run it.
