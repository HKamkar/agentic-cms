# Component library

Every shared piece of UI on the site, what it is, and how to use it. Pages
are assembled from these; **new markup goes into a page only when nothing
here fits**, and any new shared component is added to this file in the same
commit.

Rules that apply to all of them (the design system and the section anatomy
are in `STANDARD.md`):

- Semantic HTML; Tailwind utilities for layout, spacing, type, colour,
  visibility and hover/focus. The only CSS module in the tree is
  `blog/PostBody.module.css`; a second one is justified only by something
  utilities cannot say. Every change that must not move a pixel is proven
  with `scripts/visual-parity.mjs`.
- Four colours, each a `light-dark()` pair: `paper`, `ink`, `fill`,
  `muted`. No radius, shadow, blur, gradient, transition or animation
  utility exists. The type scale is `text-h1`…`text-h6` and `text-body`.
- A component never reads the theme. `color-scheme` on `:root`, overridden
  by `data-theme` on `<html>`, decides which side of every `light-dark()`
  pair applies.
- Text, links and images come in through props or `src/config/site.ts`,
  never hard-coded inside a shared component.
- The wireframe has no motion: no `Fx`, no `OnView`, no `data-ix`, no
  transition. The `ix/` library below is kept whole for a fork that wants
  reveals.
- `ui/` components have no hooks of their own unless marked `"use client"`,
  so they can be used from server and client components alike.
- Preflight zeroes margins, paddings, borders and list markers: a component
  adds the spacing it needs and never writes `m-0`, `p-0` or `list-none`.

## Layout (`src/components/ui/`)

### `Container`

The centred page column, `max-w-page` (72rem) with the site's one side
gutter. Nothing else on a page sets a width.

```tsx
<Container>…</Container>
<Container className="flex flex-col gap-4">…</Container>
```

### `Section`

The frame every section renders in: a `<section>` with the page's vertical
rhythm, a `Container`, and a bordered box whose corner tag is the section's
type. Props: `type` (required), `eyebrow?`, `heading?`, `headingAs?`
(`"h1" | "h2"`, default `h2`), `className?`, `children?`.

`type` is the section type from the page file. It does three jobs at once:
it is printed as the box's visible tag, it is the section's `id` (so
`site.ts` can link `/#contact-form`), and it is `data-section` (so the
capture harness can find the box). A section that is not a page-file type
passes its own tag — `post-hero`, `post-body`, `blog-index-list`,
`not-found`.

```tsx
<Section type="about-benefits" eyebrow={eyebrow} heading={heading}>…</Section>
<Section type="home-hero" eyebrow={eyebrow} heading={heading} headingAs="h1">…</Section>
<Section type="contact-form">…</Section>            // no title block
```

## Chrome (`src/components/ui/`)

| Component | What it is | Props | Notes |
|---|---|---|---|
| `Navbar` | The site header | — | `"use client"`; rendered once in `app/layout.tsx`. `<header>` with a `<nav aria-label="Main">`; the brand, `site.nav`, `site.signIn`, `site.cta` and the theme switch. Below 992 px the links and actions hide (`max-lg:hidden`) behind a `Menu` button (`aria-expanded aria-controls`) whose panel lists all of them. The menu's state is the path it was opened on, so a navigation closes it; Escape returns focus to the button, arrows / Home / End walk the links, an outside click closes it, and crossing 992 px closes it too. |
| `NavLink` | A link in the chrome | `href`, `label`, `className?` | `"use client"`. An `http(s)` href renders a plain `<a>`; everything else `next/link`, marked `aria-current="page"` only when the href is exactly the current path — so a section anchor is never "current". |
| `ThemeToggle` | The theme switch | — | `"use client"`. One button, three states: `system` → `light` → `dark` → `system`. `system` removes `data-theme` from `<html>` and the key from `localStorage`; the other two write both. The attribute *is* the state (read through `useSyncExternalStore`), so the server renders `system` and the first client render agrees. |
| `Footer` | The site footer | — | `<footer>` with one bordered box: the brand, `site.tagline`, the `<address>`, the e-mail, and the `Quick links` and `Follow us` columns from `site.footer`. The year is computed. |
| `Button` | The site's button, always a link | `href`, `label`, `variant?` (`"solid" \| "outline"`, default `solid`), `current?`, `className?` | An href starting with `/` renders `next/link`, an absolute one a plain `<a>`. `solid` is `bg-ink text-paper`, `outline` is `bg-paper text-ink`; both are bordered, `no-underline`. `current` sets `aria-current="page"`. |
| `buttonClass(variant?)` | The button's classes on their own | — | For a real `<button>`: the form's submit wears `buttonClass("solid")`. |

```tsx
<Button href={site.links.contact} label={cta} />
<Button href={site.links.blog} label={cta} current />
<Button href={site.cta.href} label={site.cta.label} variant="outline" />
```

## The engine's React pieces (`src/lib/components/`)

Three components that carry no design, imported from `@/lib/components`;
the site styles around them.

| Component | Props | Notes |
|---|---|---|
| `JsonLd` | `data` | Structured data with `<` escaped. |
| `EagerImage` | any `<img>` props | `"use client"`. A plain eager `<img>` in a server component becomes a preload hint in the page's RSC payload, which every other page executes when it prefetches a link here. Below-the-fold images stay plain `<img loading="lazy">`. |
| `FaqAccordion` | `children` | `"use client"`. Every `h3` inside a `[data-faq]` block toggles the paragraphs after it (`aria-expanded` on the question, `data-open` on the answers); the site's post body styles draw both. Not the site's `ui/Faq`. |

```tsx
<EagerImage src={post.image} width={1600} height={900} alt={post.imageAlt || ""} className="block h-auto w-full border border-ink" />
```

## `Placeholder` (`src/components/ui/Placeholder.tsx`)

The stand-in for a picture the design has not drawn: a crossed box at the
ratio the real image will have, with a corner caption naming what belongs
there. `aria-hidden` on purpose — it says nothing a screen reader needs,
and the section around it carries the meaning. Props: `ratio` (required, an
aspect utility), `label?` (default `"illustration"`), `className?`.

```tsx
<Placeholder ratio="aspect-video" label="hero board" className="mt-6" />
<Placeholder ratio="aspect-square" label="globe" />
<Placeholder ratio="aspect-[16/10]" label="platform screenshot" />
```

A picture the copy actually describes is a real `<img>` instead, with
`width`, `height`, `alt` and `className="block h-auto w-full border
border-ink"` (`STANDARD.md` §4).

## Title block (`src/components/ui/`)

### `Eyebrow`

The small boxed label above a heading, in the label font. Props: `label`,
`className?`. `Section` renders one from its `eyebrow` prop, so a section
rarely calls it directly.

```tsx
<Eyebrow label="Reach us" className="self-start" />
```

`eyebrowText` is the same label as a class string, for a label that is not
an `<Eyebrow>` — a use case's sector, a post's category, a post's date:

```tsx
<p className={eyebrowText}>{useCase.sector}</p>
```

### `Heading`

A page or section heading; the type comes from `base.css`, so it takes no
type utilities. Props: `as?` (`"h1" | "h2" | "h3"`, default `h2`),
`className?`, `children`.

```tsx
<Heading as="h1">{heading}</Heading>
```

## FAQ (`src/components/ui/Faq.tsx`)

The disclosure list: a `<ul>` whose every `<li>` holds an `<h3>` wrapping a
real `<button aria-expanded aria-controls>`, and under it the answer, which
starts collapsed. Nothing animates and no class decides visibility — the
answer carries `hidden`, which preflight already draws. Props: `items:
FaqEntry[]` (`{ question, answer }`).

```tsx
<Faq items={items} />
```

The section around it is `sections/FaqSection`, which reads the FAQ set the
page names (`kit.content.getFaq(section.set)`) and prints the design variant the page
asked for. The post body's accordion is a different component
(`FaqAccordion` from `@/lib/components`), because a post's questions are
markdown.

## Forms (`src/components/ui/form/`)

Forms are `FormDefinition`s in `src/config/forms.ts`, rendered by `<Form
definition={forms.x} />` through a field-type registry and delivered by the
backend the definition names (`createFormBackend()`). The full contract —
the definition schema, adding a form, a field type or a backend — is
**`src/lib/forms/README.md`**.

| Component | What it is |
|---|---|
| `Form` | `"use client"`. Renders the definition's items, validates natively (`required`, `type="email"`), submits to the backend and holds the `idle / submitting / done / fail` state. |
| `FormShell` | The form plus its two messages: the success box (`role="status"`, `bg-fill`) replaces the form, the error box (`role="alert"`) appears under it. |
| `FieldRow` | Two fields side by side; they wrap below 480 px. |
| `FieldWrap` | A real `<label for>` above its control. |
| `TextField` | `text`, `email` and `tel` inputs (`control` plus `h-10`). |
| `TextArea` | The multi-line control (`control` plus `min-h-40 resize-y`). |
| `CheckboxGroup` | A `role="group"` labelled by its title, with the browser's own checkboxes tinted `accent-ink`. |
| `SubmitButton` | A real `<button type="submit">` wearing `buttonClass("solid")`, disabled and relabelled while the submission is in flight. |
| `field.ts` | `control` — the shared control string: `block w-full border border-ink bg-paper px-3 py-2 placeholder:text-muted`. |

```tsx
<Form definition={forms.contact} />
```

## The reveal library (`src/components/ix/`) — available, unused

Nothing in the wireframe animates, and nothing imports these. They are kept
whole, with their start states in `src/styles/motion.css`, so a fork that
wants reveals only has to render `<Fx>` (`STANDARD.md` §7).

| Export | What it is | Use |
|---|---|---|
| `Fx` | The scroll-into-view reveal: 1000 ms, ease-out-quart, 100 px travel, replayed on every entry | `<Fx preset="slideInLeft" delay={200} offset={12} mq="main" as="li" className="…">` — presets `slideInBottom` (default), `slideInTop/Left/Right`, the four corners, `growIn`, `fadeIn`. `as="link"` renders `next/link`. |
| `OnView` | A custom action list on scroll-into-view | `<OnView as="section" mq="main" build={(root) => [[ix("card-2"), { y: "0%" }, { duration: 0.5, ease: ease("ease") }], …]}>` — Motion's `animate()` sequence format, resolved inside the element. Under reduced motion the sequence completes at once, so elements still land where it leaves them. |
| `ease(name)` | The easing table | `ease("ease")`, `easeIn/Out/InOut`, `outQuad`, `outQuart`, `inOutCirc`, `inOutQuad`, `outCubic`, `linear`. |
| `ix(name)` | The selector for a `data-ix` target | Animation hooks are attributes, never styling classes. |
| `useMainBreakpoint()` | ≥ 992 px | `null` until mounted, then boolean. |
| `useReducedMotionPref()` | `prefers-reduced-motion` | Boolean. Every animated component must check it. |

## Content (`src/components/blog/`)

These belong to the blog engine; its contract (frontmatter, body
conventions, pipeline) is **`src/lib/blog/README.md`**.

| Component | Props | Notes |
|---|---|---|
| `BlogHero` | `type`, `label`, `title`, `children?` | A `Section` whose heading is the page's `<h1>`: the blog index's hero and the 404 page's frame. |
| `BlogCard` | `post: PostMeta`, `excerpt?` | The post card — a whole-card `next/link` (`no-underline`) holding the 820×696 thumbnail, the category chip, the date, the title as `<h3 class="text-h4">`, and the excerpt on the index. |
| `BlogIndex` | the `blog-index` section's copy plus `posts: PostMeta[]` | The hero (`blog-index`) and the card grid (`blog-index-list`), newest first; its button is the current page. |
| `PostBody` | `children` | Wraps a rendered body and wires the FAQ accordion. Exports `postBlocks`, the class names `rehype-post-blocks` puts on the blocks it builds (the prose run, the quote box, the inline image, the FAQ block). |
| `mdxComponents` | — | Element overrides for post bodies: `<fx>` (the wrapper `rehype-post-blocks` emits) renders as the element it names and drops the delay, internal links go through `next/link`, external ones get `target="_blank" rel="noopener noreferrer"`. |

## Page sections

One component per section type, in the folder its page belongs to:

- `src/components/home/` — `Hero`, `Automation`, `About`, `Service`,
  `Feature`, `ChooseUs`, `Integration`, `Testimonials`
- `src/components/about/` — `Hero`, `Story`, `Strategy`, `Benefits`,
  `ChooseUs`
- `src/components/use-cases/` — `Hero`, `Vision`, `ChooseUs`,
  `UseCaseCards`, `Benefits`, `Strategy`
- `src/components/contact/` — `Hero`, `ContactForm`, `Details`
- `src/components/sections/` — `FaqSection` (used by every page with a FAQ)
  and `Group` (the dashed wrapper around several sections), plus the
  registry `render.tsx` and the copy schemas `schemas.ts`

Each is a server component unless it needs the browser, renders inside
`ui/Section`, takes its copy as `SectionProps<"<type>">`, and builds its
content from the shared strings in `STANDARD.md` §6 — `Container`, the
title block and the button come from this file, illustrations from
`Placeholder`, content images from `<img>`.

Cards inside a section are **not** shared components — every section's
cards are its own design — so a section renders them from a data array at
the top of its file (`CARDS.map(...)`), as a `<ul>` when they are a list.
When the cards are content someone edits, the array is a collection the
registry resolves for the section through `withData()` (`UseCaseCards` →
`kit.content.getUseCases()`, `Testimonials` → `getReviews()`, `FaqSection` →
`getFaq()`; `BlogIndex` → `kit.blog.getAllPosts()`), and the section keeps
its presentation by position.

## Not built yet

| Item | Needed by | Plan |
|---|---|---|
| A form backend for a real service (POST to Formspree / Web3Forms / Basin / a Worker route) | the contact form, which runs on the `mailto` backend | Add the `kind`, the class and the factory case in `src/lib/forms/backends/`; pick the service first |

## Building a new page

1. A page is `content/pages/<slug>.yaml` (`seo`, `jsonld`, `sections`),
   copied from `content/_templates/page.yaml` and rendered by
   `src/app/[[...slug]]/page.tsx` through the registry
   (`sections/render.tsx`; the copy schemas in `sections/schemas.ts`). A
   page made of existing section types is only that file.
2. A **new section type** is three things: a copy schema in `schemas.ts`
   (copy only — every field `.describe()`d, the design's numbers stay in
   the component), one component file in `src/components/<page>/` built
   inside `ui/Section` from the primitives above, and a registry entry in
   `render.tsx` (`plain()`, or `withData()` when it shows a collection).
3. Illustrations are `Placeholder`; real pictures start as
   `node scripts/placeholder.mjs <out> <w> <h>` under
   `public/images/<page>/`.
4. The OG image is a 1200×630 JPEG named for the route with hyphens:
   `public/images/<slug>-og.jpg`.
5. Add the page to `links`, `nav` and `footer.quickLinks` in
   `src/config/site.ts` if it belongs there — three separate lists. Its
   metadata, breadcrumb and sitemap entry follow from the page file's `seo`
   block (`src/lib/seo/README.md`).
6. Verify: `pnpm lint`, `pnpm test`, `pnpm content:lint`, `pnpm build`,
   `pnpm preview`. Before touching an existing page, capture it with
   `node scripts/visual-parity.mjs capture before` (and
   `--scheme dark`, plus `--states` when hover / focus / checked / open
   change) and compare after. Add every new shared component to this file
   in the same commit.
