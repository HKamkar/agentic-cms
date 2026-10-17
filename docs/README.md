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
- [setup.md](setup.md) — a fresh clone on a new machine, for a person or an
  agent: `bash scripts/setup.sh` and `agentic-cms setup` (Node, pnpm, the
  install, the browsers, `.env.local` and its origins, the checks), the
  doctor (`setup --check`), and what to do when a step fails.
- [dev-server.md](dev-server.md) — serving previews to the owner's
  devices: the ports, which address to hand over (`agentic-cms urls`),
  both servers and every URL in one table (`agentic-cms serve`; `demo
  new` and `lab route` waiting for their route), `ALLOWED_DEV_ORIGINS`
  (`urls --write`, `serve --write-origins`), stopping a server, old proof
  baselines.
- [browsers.md](browsers.md) — Chrome and Safari, who checks what:
  headless Chromium, headless WebKit as a stand-in, the owner's Safari;
  what headless cannot show; the engines' differences.
- [primitives.md](primitives.md) — what a new site builds first: the
  tokens, what the kit provides, the day-one primitives against what the
  example has, what waits for a second use, the rules every one follows,
  the lint that keeps every section built from them
  (`agentic-cms/eslint`) and the guard that keeps every component in the
  library (`agentic-cms check-components`).
- [gotchas.md](gotchas.md) — traps already paid for, by topic: Next.js,
  Tailwind, CSS and SVG, measuring, pnpm, git and GitHub, services; each
  the symptom, the reason and what to do.
- [upgrading.md](upgrading.md) — upgrading a site from one release to the
  next: the tag, the agent files, and each release's own steps.
- [migrating-to-0.8.0.md](migrating-to-0.8.0.md) — a site from 0.7.6 to
  0.8 (pin 0.8.1): the one required step, what it may adopt, what it deletes if it
  wrote its own.
- [icons.md](icons.md) — icons as families: the Lucide / Simple Icons map,
  the site's own marks from primitives, the inventory of every icon.
- [lab.md](lab.md) — the design canvas for the site's own graphics: SVG
  scenes on the site's tokens, in each of its schemes, on a phone; rendered to the
  files a page ships; removed when done.
- [forms.md](forms.md) — what a form can ask (every ordinary field type,
  notes, groups, a prefill from the URL) and forms that deliver: the
  endpoint route, where submissions go (a webhook, a provider's API as a sink), the environment
  per host, receiving and verifying the webhook, spam and limits.
- [consent.md](consent.md) — the visitor's consent choice and the Google tag
  behind it: the record and its policy, the hooks a banner is built on,
  consent mode v2 (basic and advanced), GA4's own settings, what the
  cookie notice says.
- [email.md](email.md) — keeping the e-mail address out of served files:
  the token, `EmailLink`, `withEmailToken`, `guard-email` in the build.
- [deploy.md](deploy.md) — the hosts: a Cloudflare Worker, and a Node
  server (`output: "standalone"`, `assemble` as the build's last step, the
  copy that nests and the check that catches it), with the notes for
  Google Cloud Run and Azure App Service.
- [roadmap.md](roadmap.md) — what 0.8.0 adds, job by job, and the road to
  1.0.0.
- [roadmap-0.8.2.md](roadmap-0.8.2.md) — the plan for 0.8.2: every part of
  the kit on one map in four layers, and a check that fails a site's own
  version of any of them.
- [roadmap-0.9.0.md](roadmap-0.9.0.md) — the plan for 0.9.0: agentic-cms
  as a standard npm package, published from CI with provenance, with
  `pnpm create agentic-cms` and `upgrade`.

The engines' contracts live next to their code and ship with the package:
`src/lib/content/README.md`, `blog/README.md`, `seo/README.md`,
`forms/README.md` (under `node_modules/agentic-cms/` on a site that
installs it). The design system of the example is `STANDARD.md`; the
editorial plugin's contract is `plugin/README.md`.
