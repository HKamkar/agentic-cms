<div align="center">

# content-engine-kit

**A file-based CMS for Next.js sites, with an AI editor.**

Pages, posts and every line of copy are files in the repo. The build validates
them, lints the voice, audits the SEO and prerenders the lot. An agent does the
editing. Nothing is read at request time.

![MIT](https://img.shields.io/badge/license-MIT-000) ![Next.js 16](https://img.shields.io/badge/Next.js-16-000) ![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-000) ![Cloudflare Workers](https://img.shields.io/badge/serves_from-Cloudflare_Workers-000) ![Node 22.18+](https://img.shields.io/badge/node-22.18%2B-000) ![request-time reads: 0](https://img.shields.io/badge/request--time_reads-0-000)

<img src="docs/readme/landing.png" alt="The example site's landing page, light mode on the left and dark mode on the right: a boxed hero section tagged home-hero, a heading, a button and a crossed placeholder for the hero illustration" width="960">

</div>

## The idea

- **The repo is the CMS.** A page is `content/pages/<slug>.yaml`: its SEO
  block, its structured data, its sections in order with all their copy. A
  post is `content/blog/<slug>.md`. Authors, categories, reviews, FAQ sets
  and use cases are files too. Seven collections, one folder, one pull
  request per change.
- **The build is the gate.** Every file is parsed against a zod schema; every
  string is read against the site's voice rules; every prerendered page is
  audited for its title, description, canonical, Open Graph, headings, image
  attributes, structured data and sitemap entry. A wrong value stops the
  build with a line that names the file, the field and the problem.
- **The agent is the editor.** The `editorial` plugin gives Claude Code seven
  skills and two review agents that write, add, update, retire and report on
  content, reading the site's rules from the repo. It knows no brand.
- **The design is yours.** What ships is a wireframe: four colours in a light
  and a dark mode, a system font, boxes that print their own section type.
  A fork replaces the look; the machinery stays.

## Sixty seconds

```bash
git clone git@github.com:HKamkar/content-engine-kit.git && cd content-engine-kit
pnpm install
pnpm dev          # http://localhost:8000
```

Change a line in `content/pages/home.yaml` and reload. Then break a few and
build; this is what the build says, verbatim:

```
$ pnpm build
FAIL content/pages/home.yaml schema: sections[0].eyebrow is required
FAIL content/pages/home.yaml schema: sections[0] unknown key(s) eyebrows
FAIL content/pages/home.yaml schema: sections[2].cards must have exactly 5 cards
FAIL content/pages/home.yaml voice-banned: sections[0].cta "seamless" is banned (hype); write "say what the reader does not have to do"
FAIL content/pages/home.yaml em-dash: sections[1].heading contains an em dash; use a period, a comma, or restructure the sentence
WARN content/blog/pages-are-files.md seo-title: seoTitle is 66 characters; Google shows about 60
```

`pnpm content:lint` gives the same answer in about a second, without the build.

## A page is a file

```yaml
# content/pages/home.yaml
seo:
  path: /
  title: "Acme: content as files, checked on every build"
  description: Acme is a content engine whose pages, posts and copy are files. Every file is validated at build time, prerendered, and served with no request-time reads.
  ogImage: /images/home-og.jpg
  updated: "2026-09-15"
  breadcrumb: Home
jsonld:
  type: WebPage
  application: { name: Acme, description: …, operatingSystem: Any (static site), offer: …, featureList: [ … ] }
sections:
  - type: home-hero
    eyebrow: Content as files
    heading: Every page, post and line of copy is a file.
    text: Acme is the content engine behind this site. Pages are YAML, posts are markdown, and the build validates all of it before the first route is rendered.
    cta: Get in touch
  - type: home-service
    …
```

The `seo` block becomes the head, the canonical and the sitemap entry. The
`jsonld` block becomes the page's structured data (`WebPage`, `AboutPage`,
`ContactPage` or `Blog`, each with its own fields). Each `type` names one of
25 section components, and its copy schema says exactly what the section
takes; a card list has an exact length, so a fourth card is a design change
rather than a typo. Presentation stays in the component. There is no
`page.tsx` to write: one catch-all route renders every page file.

The four pages under `/sections/` are the catalogue: every section type the
landing page leaves out, rendered with copy that says what each slot is for.

<img src="docs/readme/sections.png" alt="The use-cases demo page: a hero section, then a dashed group box labelled group · use-cases-upper holding a vision section with four stat cards" width="820">

## A post is a file

```yaml
---
title: Pages are files
excerpt: >-
  A page on this kit is one YAML file with three blocks. An SEO block, a
  structured-data block and a list of sections in order. Here is what each block
  holds and what the build does with it.
date: '2026-09-09'
category: guides
author: acme-editorial
image: /images/blog/pages-are-files/pages-are-files-hero.webp
imageAlt: A wide grey placeholder standing in for the hero illustration of this post
seoTitle: Pages are files | Acme
keywords: [page as a file, YAML, section types, structured data, SEO audit]
related: [how-a-post-is-built, the-voice-file-and-the-lint]
publishedAt: '2026-09-09T09:00:00.000Z'
---
```

The filename is the URL. The body is markdown with four conventions the
renderer keys off: headings start at `##`, a `> "quote"` becomes the
pull-quote card, an image alone in its paragraph becomes the figure block,
and a `## Frequently asked questions` heading with `###` questions becomes
the accordion and the `FAQPage` structured data. The lint checks the
frontmatter's SEO limits, the heading structure, the FAQ's shape, the alt
texts and that every image exists on disk and weighs under 250 KB.

<img src="docs/readme/post.png" alt="A post page: the hero box with a placeholder image, then the body box with the date, the author, the reading time, body copy and the pull-quote card" width="820">

## The voice is a lint

`content/VOICE.md` says how the site writes and what it never claims. Its
fenced block is machine-readable: banned words and patterns, the brand's
spelling and mark, the words that count as claims near a regulation, model
and cloud names, the SEO ranges. `content-engine-kit lint` reads it on every
build. Exact rules fail; heuristics warn. What the lint cannot judge (rhythm,
an unsupported number, a misattributed date) is what the two review agents
are for.

## The editor is an agent

`plugin/` is a Claude Code plugin. It reads everything it needs from the repo
it stands in and carries nothing of any brand.

| Skill | Does |
|---|---|
| `/editorial:write-post` | a post from a brief in four gated stages: outline, body, the two agents' critique, SEO fields |
| `/editorial:new-post` | a post from a draft file, with its images and frontmatter, as `draft: true` |
| `/editorial:update-post` | an edit to a post, the two dates and the URL intact |
| `/editorial:new-page` | a page from the template, made of existing section types |
| `/editorial:retire-content` | a post hidden (its URL kept) or a page removed once a redirect exists |
| `/editorial:review-voice` | a file read against `VOICE.md` for what the lint cannot judge |
| `/editorial:content-status` | what is live, in draft, planned and recently changed, read-only |

Two agents, `editorial:voice-reviewer` and `editorial:critic`, review a draft
in isolation; the critic fact-checks against primary sources. In a checkout
the plugin is on through `.claude/settings.json` (the repo is its own
marketplace). Elsewhere:

```bash
claude plugin marketplace add git@github.com:HKamkar/content-engine-kit.git
claude plugin install editorial@content-engine-kit
```

`plugin/README.md` is the contract: what a site offers the plugin, what the
skills write, and the optional workshop file for marketing that lives outside
the repo.

## The wireframe you replace

<img src="docs/readme/phone.png" alt="The landing page at phone width: the open menu in light mode on the left, the hero in dark mode on the right" width="560">

Four colours, each a `light-dark()` pair (`paper`, `ink`, `fill`, `muted`);
a system font stack; no radius, shadow or motion; a theme switch that follows
the system until a reader picks. Every section renders in a box that prints
its own YAML type, so the page and the page file read side by side.
Illustrations are crossed placeholder boxes; content images come from
`pnpm kit placeholder <out> <width> <height>` until real ones exist.
`STANDARD.md` is the design system; `src/components/README.md` the catalogue.
The `content-engine-kit/ix` reveal library stays in the package for a fork that
wants motion.

## Start your own site

Two ways. **Fork** this repo when you want the example around you — the
wireframe, the section galleries, the posts that describe the kit — and
replace it piece by piece. **Install** the package when your site is its own
repo: the engines, the reveal library and the command line come from
`content-engine-kit`; your repo holds the design, the content, the config
and the docs, nothing of the engine.

```bash
pnpm add content-engine-kit@github:HKamkar/content-engine-kit#v0.2.0 next react react-dom zod motion
pnpm add -D playwright-core          # only for the screenshot harness
```

A git dependency builds its `dist/` on install (`prepare`), which pnpm runs
only when `pnpm-workspace.yaml` allows it:

```yaml
allowBuilds:
  "content-engine-kit@github:HKamkar/content-engine-kit": true
```

Then, in either case:

1. Forking: rename the package, the Worker (`wrangler.jsonc`) and the plugin
   marketplace to your own name. Installing: `src/kit.ts` is where your site
   composes the engine, the one file the app and the command line read
   (server code only):

   ```ts
   import { createKit } from "content-engine-kit";
   import { sectionSchema } from "@/components/sections/schemas";
   import { site } from "@/config/site";
   export const kit = createKit({ site, sections: sectionSchema });
   // kit.collections · kit.content (getPages, getPage, getFaq, …) · kit.blog (getAllPosts, getRelatedPosts, …)
   // kit.seo (pageMetadata, pageJsonLd, postMetadata, sitemap, feed, robots, …) · kit.urls (postUrl, absoluteUrl) · kit.site
   ```

   and `package.json` names the commands: `"content:lint": "content-engine-kit
   lint"`, `"content:check"`, `"content:status"`, `"content:docs"`, `"kit":
   "content-engine-kit"`, and `"build": "content-engine-kit lint &&
   content-engine-kit docs --check && next build && content-engine-kit seo"`.
   The example's `src/app/`, `src/components/`, `src/config/`, `src/styles/`
   and `content/` are the files a site owns; copy them as a start.
2. `src/config/site.ts`: the brand, the URL, the e-mail and address, the nav,
   the footer, the calls to action (data only, `satisfies SiteConfig`).
3. `src/app/globals.css`: the four colours and the type scale. Both themes
   follow from the `light-dark()` pairs.
4. Copy `content/_templates/VOICE.md` to `content/VOICE.md` and write your
   rules; the prose and the fenced block say the same thing.
5. Replace the content: the registries, the reviews, the FAQ sets, the use
   cases, the page files, the posts. `content/README.md` is the door;
   `content/_templates/` has an annotated template per collection. Keep or
   delete the `/sections/*` demo pages.
6. `pnpm content:lint` until clean, `pnpm build`, `pnpm preview`, then
   `pnpm run deploy`.

A new kind of section is a copy schema, a component and a registry entry
(`src/components/sections/`). A collection of your own is a schema and a
definition returned from `createKit`'s `collections` option
(`src/lib/content/README.md`). A new form is an entry in `src/config/forms.ts`.
Upgrading is bumping the tag and running the verify below; a kit release
says what changed for a site.

## Commands

```bash
pnpm dev             # next dev on :8000
pnpm build           # content lint → docs check → next build → SEO audit; every page prerendered
pnpm preview         # build for Cloudflare and serve the Worker locally on :8000
pnpm run deploy      # build for Cloudflare and deploy (pnpm wrangler login first)
pnpm test            # the engine's, the post pipeline's and the lint's node:test suites, about a second
pnpm test:pack       # packs the kit and builds a scratch site from the tarball, the way a site that installs it does
pnpm content:lint    # the content rules, about a second
pnpm content:status  # what is live, in draft and planned, from the files
pnpm content:docs    # the field tables into content/README.md
pnpm kit <command>   # the command line: placeholder, optimize-webp, optimize-svg-rasters, parity, visual-parity, seo, …
```

- Node 22.18+ (`.nvmrc` says 26) and pnpm. The build fetches nothing: no
  webfont, no external data.
- `light-dark()` wants a current browser (Chromium 123+, Safari 17.5+,
  Firefox 120+).
- The Worker is static-only: OpenNext's static-assets cache serves the
  prerendered pages, and only `preview`, `deploy` and `upload` populate it, so
  `wrangler dev` straight after `next build` returns 500s. The ~40 "Failed to
  copy node_modules/…" lines during the OpenNext build are an OpenNext bug and
  harmless.
- `content-engine-kit visual-parity` screenshots every page at eight widths, in
  either colour scheme, and diffs two captures pixel by pixel: the proof for
  a refactor that must not move anything.

## Going live

1. Pick a form service for the contact form; it ships on the `mailto`
   backend (`src/config/forms.ts`, `src/lib/forms/README.md`).
2. If the site replaces an existing one, recreate its redirects on the Worker
   before the DNS change. A public URL never changes without one.
3. `pnpm build`, `pnpm preview`, click through every page in both themes.
4. `pnpm run deploy`, attach the domain, verify `/`, a post and
   `/sitemap.xml`; submit the sitemap.

## Map

```
content/pages/<slug>.yaml    every page: seo, jsonld, sections
content/blog/<slug>.md       posts (slug = filename); _template.md is the annotated template
content/authors.json         content/categories.json   content/reviews.yaml   content/faqs/<key>.yaml   content/use-cases.yaml
content/VOICE.md             the voice and claim rules; _templates/VOICE.md is the blank
content/editorial/           calendar.md, backlog.md, and workshop.yaml when marketing lives elsewhere
plugin/                      the editorial plugin: skills/, agents/, README.md (its contract)
src/lib/                     the package (content-engine-kit): content/, blog/, seo/, forms/, ix/, components/, cx, createKit
src/kit.ts                   the example composing the package for itself; the file every site has
src/components/sections/     the section registry and the copy schemas
src/components/ui/           Section, Placeholder, Button, Navbar, Footer, Faq, ThemeToggle, the form primitives
src/config/site.ts           the brand, URLs, nav, footer, calls to action
bin/, scripts/               the command line: lint, check, status, docs, seo, placeholder, the optimisers, parity, visual-parity
STANDARD.md                  the design system     CLAUDE.md   the rules for anyone (or any agent) working on the code
PLAN.md                      how the engine was built, condensed
```

MIT licensed.
