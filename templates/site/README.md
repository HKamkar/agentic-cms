# A site on agentic-cms

Scaffolded by `agentic-cms init`. The engine — content, blog, SEO, forms,
the reveal library, the command line, the design skills — is the package;
this repo holds the design, the content, the config and the docs.

```bash
pnpm install
pnpm dev             # http://localhost:8000
pnpm build           # content lint → docs check → next build → SEO audit
pnpm kit --help      # the command line
```

Where things are: `content/README.md` (the content, the door for editing),
`STANDARD.md` (the design system), `AGENTS.md` (the rules for an agent),
`src/config/site.ts` (the brand, the URLs, the nav), `src/kit.ts` (the one
place the engine is composed). The kit's own docs are under
`node_modules/agentic-cms/docs/`.
