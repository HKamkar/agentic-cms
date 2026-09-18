# editorial

The agent's side of a content engine. A site built on the engine keeps
its content as files under `content/`, validated at build time, with its
voice and claim rules in `content/VOICE.md` and its plan in
`content/editorial/`. This plugin is the editor that works on such a site:
it adds, writes, reviews, retires and reports on the content, with the
site's own rules, and it carries nothing of any site's brand. Everything a
brand owns is read from the repo the agent is standing in, or from a
workshop the repo names; `grep -ri <brand> plugin/` returning nothing is
the rule for every change here.

## What a site offers the plugin

Files, not code. The skills read these by path and ask for what they
cannot find; the plugin has no defaults for any of them.

| File | What the plugin reads there |
|---|---|
| `content/README.md` | the door: what exists, how to change it, how to prove it; its "Fields" section is the generated field table of every collection and every section type (`pnpm content:docs`) |
| `content/VOICE.md` | who reads the site, how the brand is spelled (`brand.name`, `brand.mark` in the fenced block), what is never said, the calls to action; the block the lint enforces |
| `content/blog/_template.md`, `content/_templates/*` | every field annotated; the image names and sizes; the closing paragraph of a post |
| `content/authors.json`, `content/categories.json` | the keys a post's `author` and `category` name |
| `content/editorial/calendar.md`, `backlog.md` | the dated plan (`date \| slug \| status \| owner \| note`; a `retired` row silences the stale-draft rule) and the ideas |
| `content/editorial/workshop.yaml` | optional: where the marketing workshop lives outside the repo and what may be read there, by role (below) |
| the engine's docs — `src/lib/content/README.md`, `src/lib/blog/README.md`, `src/lib/seo/README.md` in a checkout of agentic-cms, or under `node_modules/agentic-cms/` on a site that installs the package | the content engine's contract, the post body conventions, the head and structured-data contract |
| `src/config/site.ts` | `name` (the title suffix through the layout template), `postPrefix`, `cta`, `email`, `url`, the nav and footer lists |
| `package.json` scripts | `content:lint`, `content:status`, `content:check`, `content:docs`, `kit` (the `agentic-cms` command line: `placeholder`, `optimize-webp`, `parity`, `visual-parity`, …), `lint`, `test`, `build`, `preview`, `dev` |
| `scripts/README.md` (the kit's, next to the engine's docs) | the image tools (stand-ins, optimisers) and the parity proofs, as `pnpm kit` commands |

## Skills

Each is short, names the files it reads, ends with the site's verify block
(`pnpm lint && pnpm test && pnpm content:lint && pnpm build`, `pnpm
preview`) and stops for the user at the points that matter: the slug, the
route, anything that changes `site.ts`, publishing, the push. The repo is
the current directory; commits go on the repo's working branch.

| Skill | Use it to | It ends with |
|---|---|---|
| `write-post` | write a post from a brief (the workshop's, or one asked of the user) in four stages: outline, body, critique by the two agents, SEO fields; or rewrite one the same way | a `draft: true` file under `content/blog/`, lint-clean, handed to `new-post` for images and the commit |
| `new-post` | add a post as a draft from a brief, a draft file or the workshop's drafts, with its images and frontmatter | the lint clean on the new file, the build, `pnpm preview`, a commit; the user flips `draft` |
| `update-post` | change a post's copy, fields or images, `updatedAt` set, the two dates and the URL intact | the lint, the build, the route's audit lines, a commit |
| `new-page` | add a page from the template, made of existing section types, with its SEO block, structured data and OG image | the lint, the build, a capture of the page at eight widths, a commit |
| `retire-content` | hide a post (`draft: true`, the indexed URL kept) or, once a redirect exists, remove a page | the lint, the build, the sitemap without it, a commit |
| `review-voice` | read a file against `VOICE.md` for what the lint cannot judge, after quoting the lint's own lines | a HIGH / MEDIUM / LOW report with a verdict, then the fixes the user approves |
| `content-status` | say what is live, in draft, planned and recently changed, from the files (read-only) | the report, nothing edited |

## Agents

Both run in isolation from the conversation that produced a draft, so
they catch what the writer rationalised away. Both are read-only: one
report each, no edits.

| Agent | Does |
|---|---|
| `voice-reviewer` | the `review-voice` procedure as an independent pass |
| `critic` | a prose-quality critique as the reader `VOICE.md` describes, and a two-pass fact-check of every externally verifiable claim against primary sources, with a verdict per claim |

`write-post` runs both in parallel at its critique stage.

## The workshop

A site may keep its marketing outside the repo: strategy, keyword
research, SERP reads, briefs, drafts, prompts, a log. It names that
place in `content/editorial/workshop.yaml`:

```yaml
path: ../marketing            # relative to the repo root, or absolute; may be gitignored
roles:                        # files or folders inside it, by what they are; leave out what the workshop lacks
  strategy: seo-and-content-strategy.md
  keywords: keyword-shortlist.md
  research: research          # serp-gap-<keyword>-<date>.md; the newest by date counts
  briefs: briefs              # <slug>.md, the Stage 0 brief of write-post
  drafts: drafts/blog         # drafts written outside the repo; new-post imports them
  prompts: prompts            # image and briefing prompt templates
  glossary: reference/glossary.md
  history: blog-state.md
```

Every skill works without a workshop. With one, `write-post` reads the
brief and the SERP context instead of asking, `new-post` imports from
`drafts`, `content-status` lists the briefs in flight, and the `critic`
treats the glossary as the list of references a post may cite. The plugin
reads the roles it knows and nothing else there, and never writes there.

## The publish contract

What `write-post` and `new-post` write, against the site's template
rather than any brand: `content/blog/<slug>.md` with `title`; `excerpt`
of 30–40 words; `date` quoted; `category` and `author` as keys of the two
registries; `image` / `imageAlt`, `thumbnail` / `thumbnailAlt`, `ogImage`
under `public/images/blog/<slug>/` with the names the template shows;
`seoTitle` (60 or fewer, the site's suffix); `seoDescription` (70–160);
`keywords` (3–8); `related` (2–3 existing slugs); `draft: true`;
`publishedAt` at first publish. The body starts at `##` and never jumps a
level; one pull quote as `> "…"` lifted verbatim; the mid-article image
alone in its paragraph with a real alt; the closing paragraph with the
site's call to action; the FAQ heading as the template has it, with 3–5
`###` questions and their answers; images optimised through the site's
script; no external image URLs. Proof is the site's verify block; publish
is `draft: false`, `publishedAt` now, a commit, a push.

## Installing

- In a checkout of a site that ships this plugin, `.claude/settings.json`
  names the repo's own marketplace (`.claude-plugin/marketplace.json`) and
  enables `editorial@agentic-cms`: trust the folder and the skills
  are there. A marketplace name is registered once per user, at the path
  of the first checkout that declared it: a second clone or worktree of
  the same repo resolves to the first one's `plugin/`, and a fork that
  changes the plugin renames the marketplace.
- From anywhere: `claude plugin marketplace add <path or git URL of the
  repo>` then `claude plugin install editorial@agentic-cms`.
- For development: `claude --plugin-dir ./plugin`.

Skills are invoked as `/editorial:<skill>`; the agents are
`editorial:voice-reviewer` and `editorial:critic`.
