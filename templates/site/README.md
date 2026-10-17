# A site on agentic-cms

Scaffolded by `agentic-cms init`. The engine — content, blog, SEO, forms,
the reveal library, the command line, the design skills — is the package;
this repo holds the design, the content, the config and the docs.

```bash
bash scripts/setup.sh  # a fresh clone: Node, pnpm, the install, the browsers, .env.local, lint and test
pnpm kit serve       # the dev server (and the lab), and every URL to hand over: localhost, the LAN, the public address
pnpm dev             # next dev alone, on http://localhost:8000
pnpm urls            # this machine's URLs, for a phone or another computer
pnpm content:lint    # the content rules, and what is still the starter's placeholder copy
pnpm build           # content lint → docs check → next build → SEO audit; fails on a placeholder
pnpm kit --help      # the command line
```

Where things are: `content/README.md` (the content, the door for editing),
`STANDARD.md` (the design system), `AGENTS.md` (the rules for an agent),
`src/config/site.ts` (the brand, the URLs, the nav), `src/kit.ts` (the one
place the engine is composed). The kit's own docs are under
`node_modules/agentic-cms/docs/`.
