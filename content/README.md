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
| Posts | `blog/<slug>.md` (the filename is the URL `/blog-post/<slug>`) | the blog index, the post page, the RSS feed, the sitemap | `blog/_template.md` | Fields › `posts` |
| Authors | `authors.json` (a map, the key is the slug a post's `author` names) | the byline and author card of a post | `_templates/author.json` | › `authors` |
| Categories | `categories.json` (a map, the key is the slug a post's `category` names) | a post's eyebrow and `articleSection` | `_templates/category.json` | › `categories` |
| Reviews | `reviews.yaml` (a list, in slide order) | the `reviews` section of any page that lists one | `_templates/review.yaml` | › `reviews` |
| FAQ sets | `faqs/<key>.yaml` (one file per set; a page's `faq` section names the key) | the FAQ section and the FAQPage structured data of every page that shows one — today one set, `general`, shown by `/`, `/sections/about` and `/sections/contact` | `_templates/faq.yaml` | › `faqs` |
| Use cases | `use-cases.yaml` (a list, in card order) | the `use-case-cards` section and the ItemList structured data of every page that shows them | `_templates/use-case.yaml` | › `useCases` |
| Pages | `pages/<slug>.yaml` (`seo.path` is the route) | the page itself: its head, its structured data, and its sections in order with all their copy — six files today: the landing page, the four section galleries and the blog index | `_templates/page.yaml` | › `pages` (one table per section type) — all of them at the end of this file |

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
stand-in is `pnpm kit placeholder public/images/home/<file>.webp 160
160`, a real photograph goes through `pnpm kit optimize-webp
public/images/home/<file>`. Verify (below).

**Change a FAQ.** Edit the set a page names, `faqs/general.yaml`: reorder,
reword, add or remove items (at least one must remain). A new page that
shows a FAQ gets its own `faqs/<key>.yaml` from `_templates/faq.yaml` and a
section naming it (`set: <key>`). Verify.

**Add a use case.** Append a block from `_templates/use-case.yaml` to
`use-cases.yaml`; the icon goes under `public/images/use-cases/` — a
wireframe stand-in is `pnpm kit placeholder
public/images/use-cases/<file>.svg 64 64`, a drawn one goes through `pnpm
dlx svgo@3 --config scripts/svgo.config.mjs`. Verify.

**Add a post.** Copy `blog/_template.md` to `blog/<slug>.md` and follow its
comments; images under `public/images/blog/<slug>/` (placeholders from
`pnpm kit placeholder`, real ones optimised); the body
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
`pnpm kit placeholder public/images/<name>-og.jpg 1200 630` writes a
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
`pnpm content:docs` to regenerate the field tables.

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
(`agentic-cms parity`, `agentic-cms visual-parity`) are for code changes,
not for these files.

## Fields

Every key of every collection, generated from the schemas by
`agentic-cms docs` (`pnpm content:docs`); `pnpm build` fails when
this section is stale.

<!-- content-docs:start -->

<!-- generated by agentic-cms docs from the schemas; do not edit by hand -->

### `authors` — `content/authors.json`

An author of posts; the key of content/authors.json is the slug a post's `author` names (one file holding a map, the key is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | text | yes | Shown in the byline, the author card and as the JSON-LD author |
| `title` | text | no | Role line under the name on the author card |
| `bio` | text | no | One or two sentences on the author card |
| `image` | text | no | Portrait under public/images/authors/ |
| `imageAlt` | text | no | What the portrait shows |

### `categories` — `content/categories.json`

A post category; the key of content/categories.json is the slug a post's `category` names (one file holding a map, the key is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | text | yes | The label shown as the post's eyebrow and articleSection |

### `posts` — `content/blog`

A post's frontmatter: content/blog/<slug>.md, where the filename is the URL /blog-post/<slug> (a folder of markdown files, one entry per file, the file name is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `title` | text | yes | The H1 and card title, the `<title>` unless seoTitle is set, and the JSON-LD headline |
| `excerpt` | text | no | Card text, meta description fallback, RSS and JSON-LD description; 30–40 reader-focused words; required unless seoDescription is set |
| `date` | YYYY-MM-DD | yes | The editorial date readers see, YYYY-MM-DD (quote it); the primary sort key, newest first |
| `category` | key of `content/categories.json` | yes | The eyebrow label and articleSection, also the related-post fallback |
| `author` | key of `content/authors.json` | yes | The byline, the author card and the JSON-LD author |
| `image` | text | no | Hero image on the post page and the JSON-LD image, under public/images/blog/`<slug>`/ |
| `imageAlt` | text | no | What the hero image shows, in a sentence |
| `thumbnail` | text | no | Card image (820×696); defaults to image |
| `thumbnailAlt` | text | no | What the card image shows |
| `ogImage` | text | no | Open Graph / Twitter image, about 1.91:1 and at least 1200 px wide; defaults to image, then thumbnail |
| `seoTitle` | text | no | The exact `<title>` and og:title, 60 characters or fewer; defaults to the title followed by " \| " and the site's name |
| `seoDescription` | text | no | Meta description, 70–160 characters; defaults to excerpt |
| `keywords` | list of text | no | `<meta keywords>` and the JSON-LD keywords |
| `related` | list of key of `content/blog` | no | Slugs shown first under "Read next", topped up by same category, then newest; every slug must exist, drafts included |
| `source` | text | no | Provenance note, e.g. the URL an imported post came from |
| `publishedAt` | ISO timestamp | no | ISO timestamp for JSON-LD datePublished, the RSS pubDate and the sitemap; set once when the post first goes live |
| `updatedAt` | ISO timestamp | no | ISO timestamp for JSON-LD dateModified; add it only after editing a published post (a value before publishedAt is clamped by posts.ts) |
| `draft` | true / false | no | true keeps the post out of production builds; pnpm dev still renders it |

### `reviews` — `content/reviews.yaml`

A client review on the home page slider, in slide order (one file holding a list, one entry per item).

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | text | yes | The reviewer, shown under the quote |
| `role` | text | yes | Their role, shown in brackets after the name |
| `quote` | text | yes | The quote as it reads on the slide, with its own quotation marks |
| `photo` | text | yes | Portrait under public/images/home/ (about 80×80) |
| `photoAlt` | text | no | What the portrait shows; leave it out while the portrait is decorative |

### `faqs` — `content/faqs`

A FAQ set: one file per page that shows one, the file name is the key the page reads it by (a folder of yaml files, one entry per file, the file name is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `items` | list of entries | yes | The questions in order; each opens to its answer |
| `items[].question` | text | yes | The question, shown as the item's heading |
| `items[].answer` | text | yes | The answer, one paragraph, shown when the item opens |

### `useCases` — `content/use-cases.yaml`

A use-case card on the Use cases page, in order; the same list is the page's ItemList structured data (one file holding a list, one entry per item).

| Key | Type | Required | Description |
|---|---|---|---|
| `sector` | text | yes | The tag above the title (Life sciences, Finance and banking, …) |
| `title` | text | yes | The card title |
| `text` | text | yes | The paragraph under the rule |
| `icon` | text | yes | Illustration under public/images/use-cases/ |

### `pages` — `content/pages`

A page: content/pages/<slug>.yaml — its SEO block, its structured data, and its sections in order (seo.path is the route; the file name is only the key) (a folder of yaml files, one entry per file, the file name is the slug).

| Key | Type | Required | Description |
|---|---|---|---|
| `seo` | entries | yes | The SEO block: the `<title>`, meta description, canonical, Open Graph image, sitemap entry and breadcrumb name |
| `seo.path` | text | yes | The route: / for the home page, else /lowercase-words; indexed once published, never changed without a redirect |
| `seo.title` | text | yes | The exact `<title>` and og:title: the topic first, the brand last, 60 characters or fewer, unique across pages |
| `seo.description` | text | yes | The meta description: the page's promise in one sentence, 70–160 characters |
| `seo.ogImage` | text | yes | The social image, a 1200×630 JPEG under public/images/, e.g. /images/home-og.jpg |
| `seo.updated` | YYYY-MM-DD | yes | The date the content last changed, YYYY-MM-DD (quote it); the sitemap's lastmod — bump it with the copy, not on refactors |
| `seo.breadcrumb` | text | yes | The page's name in the breadcrumb trail and its structured data |
| `seo.changeFrequency` | one of always, hourly, daily, weekly, monthly, yearly, never | no | The sitemap's changefreq hint |
| `seo.priority` | number | no | The sitemap's priority hint, 0–1 |
| `jsonld` | one of the section types below | yes | The page's structured data: the copy of its JSON-LD block by page type |
| `sections` | list of one of the section types below | yes | The sections in order, each a `type` and its copy |

The section types (25); every section has `type` plus the fields below:

#### `home-hero`

The home hero: eyebrow, H1, paragraph, the button and the hero illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `home-automation`

Two cards and the button beside an illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
#### `home-about`

A statement and three stat cards

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `statement` | text | yes | The statement paragraph the section leads with, set in heading type |
| `cards` | list of entries | yes |  |
| `cards[].title` | text | yes | The card title |
| `cards[].stat` | text | yes | The big figure |
| `cards[].text` | text | yes | The line under the figure |
#### `home-service`

A feature split: the dashboard card on the left, the copy, one feature and the button to the contact page on the right

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `feature` | entries | yes |  |
| `feature.title` | text | yes | The feature title under the icon |
| `feature.text` | text | yes | The feature text |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
| `dashboard` | entries | yes |  |
| `dashboard.title` | text | yes | The dashboard card's title |
| `dashboard.text` | text | yes | The dashboard card's line |
| `dashboard.image` | text | yes | The dashboard screenshot, under public/images/`<page>`/ |
| `dashboard.imageAlt` | text | yes | What the the dashboard screenshot shows, in a sentence (it is informative, not decorative) |
#### `home-feature`

Five feature cards, the copy and a tall screenshot beside them

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
| `monitoring` | entries | yes |  |
| `monitoring.image` | text | yes | The monitoring screenshot, under public/images/`<page>`/ |
| `monitoring.imageAlt` | text | yes | What the the monitoring screenshot shows, in a sentence (it is informative, not decorative) |
#### `home-choose-us`

Three points beside a demo card and a stats image

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `items` | list of entries | yes |  |
| `items[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `items[].title` | text | yes | The item's title |
| `items[].text` | text | yes | The item's text |
| `demo` | entries | yes |  |
| `demo.title` | text | yes | The demo card's title |
| `demo.image` | text | yes | The demo screenshot, under public/images/`<page>`/ |
| `demo.imageAlt` | text | yes | What the the demo screenshot shows, in a sentence (it is informative, not decorative) |
| `stats` | entries | yes |  |
| `stats.image` | text | yes | The stats card, under public/images/`<page>`/ |
| `stats.imageAlt` | text | yes | What the the stats card shows, in a sentence (it is informative, not decorative) |
#### `home-integration`

The heading over an integration diagram (the diagram is the design's)

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
#### `reviews`

The heading over the reviews; the reviews are content/reviews.yaml

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
#### `about-hero`

The About hero: eyebrow, H1, paragraph and three illustration cards (the cards are the design's)

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
#### `about-story`

A statement and five cards: two picture cards with captions, two stat cards and the modality card

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `statement` | text | yes | The statement paragraph the section leads with, set in heading type |
| `founded` | text | yes | The caption of the first picture card |
| `sovereignty` | entries | yes | The first stat card |
| `sovereignty.title` | text | yes | The first stat card: the line above the number |
| `sovereignty.value` | text | yes | The first stat card: the big number or figure |
| `sovereignty.text` | text | yes | The first stat card: the line under the number |
| `compliance` | entries | yes | The second stat card |
| `compliance.title` | text | yes | The second stat card: the line above the number |
| `compliance.value` | text | yes | The second stat card: the big number or figure |
| `compliance.text` | text | yes | The second stat card: the line under the number |
| `partners` | text | yes | The caption of the second picture card |
| `modalities` | entries | yes | The modality card: heading, illustration, figure and line |
| `modalities.heading` | text | yes | The modality card's heading |
| `modalities.stat` | text | yes | The modality card's big figure |
| `modalities.text` | text | yes | The line under the figure |
#### `about-strategy`

An illustration on one side; the copy, four beliefs and the button on the other

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `beliefsHeading` | text | yes | The heading over the list of beliefs |
| `beliefs` | list of text | yes | The four beliefs |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `about-benefits`

Three benefit cards

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
#### `about-choose-us`

Copy, two cards and the button on one side; an illustration on the other

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `faq`

A FAQ section: eyebrow, heading and the accordion of a FAQ set; the page's FAQPage structured data reads the same set

| Key | Type | Required | Description |
|---|---|---|---|
| `set` | key of `content/faqs` | yes | The FAQ set to show: the file name in content/faqs/ |
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `variant` | one of about, contact | yes | The design variant, about or contact; the wireframe draws both the same and prints the name |
#### `use-cases-hero`

The Use cases hero: eyebrow, H1, paragraph and the button

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `use-cases-vision`

A statement and four stat cards

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `statement` | text | yes | The statement paragraph the section leads with, set in heading type |
| `cards` | list of entries | yes |  |
| `cards[].stat` | text | yes | The big figure |
| `cards[].text` | text | yes | The line under the figure |
#### `use-cases-choose-us`

Three points beside an illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `points` | list of entries | yes |  |
| `points[].title` | text | yes | The point's title |
| `points[].text` | text | yes | The point's text |
#### `use-case-cards`

The heading over the use-case cards; the cards are content/use-cases.yaml

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
#### `use-cases-benefits`

Two benefits on each side of an illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `left` | list of entries | yes | The two benefits left of the dashboard |
| `left[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `left[].text` | text | yes | The benefit, one line |
| `right` | list of entries | yes | The two benefits right of the dashboard |
| `right[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `right[].text` | text | yes | The benefit, one line |
#### `use-cases-strategy`

Two cards and the button beside an illustration

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `cards` | list of entries | yes |  |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | text | yes | The card text |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `contact-hero`

The Contact hero: eyebrow, H1, paragraph and the button

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `text` | text | yes | The paragraph under the heading |
| `cta` | text | yes | The button label; the button links to the contact section (site.links.contact) |
#### `contact-form`

The contact form; its fields and messages are the form definition

| Key | Type | Required | Description |
|---|---|---|---|
| `form` | text | yes | The form to render, a key of src/config/forms.ts |
#### `contact-details`

Three contact cards, each with an icon, a title, its text and a highlighted line

| Key | Type | Required | Description |
|---|---|---|---|
| `eyebrow` | text | yes | The small label above the heading, as it should read (it is rendered uppercase) |
| `heading` | text | yes | The section heading |
| `cards` | list of entries | yes |  |
| `cards[].icon` | text | yes | The card's icon, an image path under public/images/ |
| `cards[].title` | text | yes | The card title |
| `cards[].text` | list of text | yes | The card text, one paragraph per line (a line break between lines) |
| `cards[].highlight` | one of the kinds below | yes | The highlighted line under the rule: plain text, or an e-mail address as a link |
#### `blog-index`

The blog index: the hero and the grid of every published post, newest first

| Key | Type | Required | Description |
|---|---|---|---|
| `label` | text | yes | The hero's label |
| `heading` | text | yes | The hero's H1 |
| `listEyebrow` | text | yes | The eyebrow over the post grid |
| `listHeading` | text | yes | The heading over the post grid |
| `cta` | text | yes | The button label beside the heading (the button is the current page) |
#### `group`

A wrapper around several sections, for a design that decorates a run of them together

| Key | Type | Required | Description |
|---|---|---|---|
| `variant` | one of use-cases-upper, use-cases-lower | yes | Which of the design's two wrappers; the wireframe draws both as a dashed box that names the variant |
| `sections` | list of one of the section types below | yes | The sections inside the wrapper, in order |

<!-- content-docs:end -->
