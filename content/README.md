# content/

Everything a reader sees that is copy rather than design lives here, as
files, and every file is checked at build time: a wrong value fails
`pnpm build` (and `pnpm content:lint`, in about a second) with a line that
names the file, the field and the problem. Nothing here is read at
request time. This is the door: what exists, how to change it, how to
prove it. The contract behind it is `src/lib/content/README.md` (the
engine, the field tables, the error catalogue); posts have their own
pipeline in `src/lib/blog/README.md`; how the copy is written, and what it
never claims, is `VOICE.md` in this folder.

## What exists

| Collection | Files | Shown | Template | Fields |
|---|---|---|---|---|
| Posts | `blog/<slug>.md` (the filename is the URL `/blog-post/<slug>`) | the blog index, the post page, the RSS feed, the sitemap | `blog/_template.md` | `src/lib/content/README.md` › `posts` |
| Authors | `authors.json` (a map, the key is the slug a post's `author` names) | the byline and author card of a post | `_templates/author.json` | › `authors` |
| Categories | `categories.json` (a map, the key is the slug a post's `category` names) | a post's eyebrow and `articleSection` | `_templates/category.json` | › `categories` |
| Reviews | `reviews.yaml` (a list, in slide order) | the `reviews` section of any page that lists one | `_templates/review.yaml` | › `reviews` |
| FAQ sets | `faqs/<key>.yaml` (one file per set; a page's `faq` section names the key) | the FAQ section and the FAQPage structured data of every page that shows one — today one set, `general`, shown by `/`, `/sections/about` and `/sections/contact` | `_templates/faq.yaml` | › `faqs` |
| Use cases | `use-cases.yaml` (a list, in card order) | the `use-case-cards` section and the ItemList structured data of every page that shows them | `_templates/use-case.yaml` | › `useCases` |
| Pages | `pages/<slug>.yaml` (`seo.path` is the route) | the page itself: its head, its structured data, and its sections in order with all their copy — six files today: the landing page, the four section galleries and the blog index | `_templates/page.yaml` | › `pages` (one table per section type) |

Files and folders starting with `_` are never read (`_templates/`,
`blog/_template.md`). A page file lists its sections by `type`; the copy
of each section — eyebrow, heading, paragraphs, cards, stats, button
labels, image paths and alt texts — is in the file, the design's numbers
(reveal delays, sizes, class strings) stay in the section's component.

Two files here are not collections: `VOICE.md` (the voice and claim
rules; its fenced block is what the lint enforces; `_templates/VOICE.md`
is the blank a new site starts from) and `editorial/` (`calendar.md`, the
dated plan; `backlog.md`, the ideas; free-form, printed by `pnpm
content:status`; and, optionally, `workshop.yaml`, which names where a
marketing workshop — strategy, keyword research, briefs, drafts, prompts —
lives outside the repo and what may be read there, by role. This site has
no workshop file and every skill below works without one; what a workshop
produces lands here through those skills.

## Skills

The procedures an agent follows are the `editorial` plugin in `plugin/`
(its README is the contract: what it reads here, the workshop, what it
writes), invoked as `/editorial:<skill>`; each names the files it reads,
ends with the verify block below and stops for the user at the points
that matter (the slug, publishing, the push). Two agents,
`editorial:voice-reviewer` and `editorial:critic`, review a draft in
isolation.

| Skill | Use it to | It ends with |
|---|---|---|
| `write-post` | write a post from a brief in four stages (outline, body, the two agents' critique, SEO fields), or rewrite one | a lint-clean `draft: true` file, handed to `new-post` |
| `new-post` | add a post as a draft, from a brief, a draft file or the workshop's drafts, with its images and frontmatter | the lint clean on the new file, the build, `pnpm preview`, a commit; the user flips `draft` |
| `update-post` | change a post's copy, fields or images, `updatedAt` set, the two dates and the URL intact | the lint, the build, the route's audit lines, a commit |
| `new-page` | add a page from the template, made of existing section types, with its SEO block, structured data and OG image | the lint, the build, a capture of the page at eight widths, a commit |
| `review-voice` | read a file against `VOICE.md` for what the lint cannot judge | a HIGH / MEDIUM / LOW report with a verdict, then the approved fixes |
| `content-status` | say what is live, in draft, planned and recently changed, from the files (read-only) | the report, nothing edited |
| `retire-content` | hide a post (`draft: true`, the indexed URL kept) or, once a redirect exists, remove a page | the lint, the build, the sitemap without it, a commit |

## Rules

- **Quote dates, write booleans as `true` / `false`.** Every file is YAML
  1.2 (frontmatter included): an unquoted `2026-05-02` or `yes` is text.
- **The file name is the identity.** A post's filename is its indexed URL
  and never changes without a redirect; a FAQ set's filename is the key a
  page reads it by; a map's key is what a post's `author` / `category` names.
- **Every field the schema does not know is an error**, so a typo in a key
  fails the build instead of silently doing nothing.
- **Text stays text.** Quotes carry their own quotation marks in the file;
  a long paragraph may wrap over several lines (the breaks read as
  spaces); nothing is trimmed.
- **Presentation is not content.** Reveal delays, icon widths, portrait
  sizes and layout classes stay in the components, keyed by position; a
  fourth review or card takes the last one's numbers.

## Recipes

**Add a review.** Append a block from `_templates/review.yaml` to
`reviews.yaml`; put the portrait under `public/images/home/` — a wireframe
stand-in is `node scripts/placeholder.mjs public/images/home/<file>.webp 160
160`, a real photograph goes through `node scripts/optimize-webp.mjs
public/images/home/<file>`. Verify (below).

**Change a FAQ.** Edit the set a page names, `faqs/general.yaml`: reorder,
reword, add or remove items (at least one must remain). A new page that
shows a FAQ gets its own `faqs/<key>.yaml` from `_templates/faq.yaml` and a
section naming it (`set: <key>`). Verify.

**Add a use case.** Append a block from `_templates/use-case.yaml` to
`use-cases.yaml`; the icon goes under `public/images/use-cases/` — a
wireframe stand-in is `node scripts/placeholder.mjs
public/images/use-cases/<file>.svg 64 64`, a drawn one goes through `pnpm
dlx svgo@3 --config scripts/svgo.config.mjs`. Verify.

**Add a post.** Copy `blog/_template.md` to `blog/<slug>.md` and follow its
comments; images under `public/images/blog/<slug>/` (placeholders from
`node scripts/placeholder.mjs`, real ones optimised); the body
conventions (`## Frequently asked questions`, `> blockquote`, an image alone
in a paragraph) are load-bearing — `src/lib/blog/README.md`. `draft: true`
keeps it out of production builds while it is being written. Verify.

**Add an author or category.** Add a key to `authors.json` /
`categories.json` (`_templates/author.json`, `_templates/category.json`
show the shape); posts may use it at once. Verify.

**Change a page's copy.** Edit `pages/<slug>.yaml` — a heading, a card's
text, an alt — and bump `seo.updated`. A section's card count is part of
its design where the build says "must have exactly N": a different count is
a design change, not a content edit. Verify.

**Add a page.** Copy `_templates/page.yaml` to `pages/<slug>.yaml`, choose
the sections from the section types in `src/lib/content/README.md` (the six
existing pages are worked examples, and the four `sections/*` galleries show
every type in place), add the OG image under `public/images/` as
`<path-with-hyphens>-og.jpg` (`/sections/about` → `sections-about-og.jpg`;
`node scripts/placeholder.mjs public/images/<name>-og.jpg 1200 630` writes a
stand-in), and add the page to `nav` / `links` / `footer.quickLinks` in
`src/config/site.ts` if it belongs there. No code. Verify, then look at every
width in `pnpm preview`.

**Reorder or remove a section.** Move or delete its block in the page file.
The audit still wants an `<h2>` before any `<h3>` and exactly one `<h1>`,
so a hero stays first and the sections that carry the first `<h2>` stay
above the ones that start with `<h3>`; the build says so if not. Verify.

**Add a collection** (a new kind of content): `src/lib/content/README.md`
› Recipes — a schema and a definition returned from `createKit`'s
`collections` option in `src/kit.ts`, a template here, and
`node scripts/content-docs.mjs` to regenerate the field tables.

## Verify

```bash
pnpm content:lint                        # every collection, then the voice, SEO, structure, image and date rules, in a second
pnpm lint && pnpm test && pnpm build     # the build runs the lint first, then audits every rendered page
pnpm preview                             # the real Worker on http://<ip>:8000 — look at the page you changed
```

A `FAIL` line stops the build; a `WARN` line is read and either fixed or
explained (`pnpm content:lint --strict` makes every warning fail). The
content reports 0 failures and 0 warnings as of 2026-09-16: a new
warning is yours to retire, not to accumulate.

A content change is supposed to change the page, so the parity proofs
(`scripts/parity.sh`, `scripts/visual-parity.mjs`) are for code changes,
not for these files.
