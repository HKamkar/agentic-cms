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
  with `agentic-cms visual-parity`.
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
| `Footer` | The site footer | — | `<footer>` with one bordered box: the brand, `site.tagline`, the `<address>`, the e-mail, and the `Quick links` and `Follow us` columns from `site.footer`. The year is computed. With a Google tag id set, `CookieSettingsButton` under the year. |
| `ConsentBanner` | The consent banner | — | `"use client"`; rendered once in `app/layout.tsx`, only when a Google tag id is set (`src/config/analytics.ts`). Headless state from `agentic-cms/consent`'s `useConsent`; the copy is `consentBanner` in `src/config/site.ts`. A non-modal `role="dialog"`, fixed at the foot of the viewport (`z-40`, under the skip link): the site's one overlay. Decline and Allow are the same `buttonClass("outline")` button, side by side. A reopened banner takes focus to its first button; a choice hands focus back. Nothing on the server. `docs/consent.md`. |
| `CookieSettingsButton` | Opens the consent banner again | `className?` | `"use client"`. A real `<button>` calling `openConsent()`, labelled `consentBanner.settings`; the footer renders it, and any page may. |
| `Button` | The site's button, always a link | `href`, `label`, `variant?` (`"solid" \| "outline"`, default `solid`), `current?`, `className?` | An href starting with `/` renders `next/link`, an absolute one a plain `<a>`. `solid` is `bg-ink text-paper`, `outline` is `bg-paper text-ink`; both are bordered, `no-underline`. `current` sets `aria-current="page"`. |
| `buttonClass(variant?)` | The button's classes on their own | — | For a real `<button>`: the form's submit wears `buttonClass("solid")`. |

```tsx
<Button href={site.links.contact} label={cta} />
<Button href={site.links.blog} label={cta} current />
<Button href={site.cta.href} label={site.cta.label} variant="outline" />
```

## The engine's React pieces (`src/lib/components/`)

Components that carry no design, imported from `agentic-cms/components`
(and one from `agentic-cms/lab`); the site styles around them.

| Component | Props | Notes |
|---|---|---|
| `JsonLd` | `data` | Structured data with `<` escaped. |
| `Icon` | `kind`, `d`, `viewBox?`, `size`, `strokeWidth`, `title?` | An inline SVG icon in `currentColor` from the site's map (`icons add lucide:… \| si:… \| file:…`); decorative unless it has a `title`. |
| `EmailLink` | `token`, `children?` | `"use client"`. The address from its token after hydration, a `<span>` before it (`docs/email.md`). |
| `LabScenes` (`agentic-cms/lab`) | `grounds`, `sizes?`, `folders?`, `intro?`, `children?` | A server component for the throwaway route `lab route` writes: every scene under `.parity/lab` inline on the site's grounds, with the procedure and a scrubber. Reads the filesystem — hence its own subpath. Never merges (`docs/lab.md`). |
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
(`FaqAccordion` from `agentic-cms/components`), because a post's questions are
markdown.

## Forms (`src/components/ui/form/`)

Forms are `FormDefinition`s in `src/config/forms.ts`, rendered by `<Form
definition={forms.x} />` through a field-type registry and delivered by the
backend the definition names (`createFormBackend()`): `mailto`, or
`endpoint`, which posts to the site's route (`src/app/api/forms/[id]`) and
on to the sink `src/config/form-delivery.ts` picks. The full contract — the
definition schema, adding a form, a field type, a backend or a sink — is
**`src/lib/forms/README.md`**; switching a site over, `docs/forms.md`.

| Component | What it is |
|---|---|
| `Form` | `"use client"`. Renders the definition's items (fields, rows, notes, groups; a `case` per field type in `Field()`, a hidden field as a bare input), validates natively (the controls' own attributes), prefills from the URL after hydration (`prefillFromQuery`), reads the values (`readFormValues`), submits to the backend and holds the `idle / submitting / done / fail` state. For an `endpoint` form it also renders the honeypot (`TRAP_FIELD`, `aria-hidden`, out of the tab order and of the flow) and sends the time the form was on screen. |
| `FormShell` | The form plus its two messages: the success box (`role="status"`, `bg-fill`) replaces the form, the error box (`role="alert"`) appears under it. `{email}` in a message is `EmailLink` (`messageParts`). |
| `FieldRow` | Two fields side by side; they wrap below 480 px. When one has a hint, both put their control at the bottom (the `RowAlign` context), so the controls stay level. |
| `FieldWrap` | A real `<label for>` above its control, the optional marker inside it, the hint between them. |
| `Hint` | Help text under a label (`text-muted`), its id in the control's `aria-describedby`. |
| `Marker` | The form's `optionalMarker` after a label, inside it (`text-muted`). |
| `TextField` | `text`, `email`, `tel` and `url` inputs (`control` plus `h-10`). |
| `NumberField`, `DateField` | The number and date inputs (`control` plus `h-10`); the browser's own spinner and date picker. |
| `TextArea` | The multi-line control (`control` plus `min-h-40 resize-y`; `rows` set the height instead of the minimum). |
| `Select` | One choice from a list: `control` plus `appearance-none`, a drawn chevron (`Icon`, `aria-hidden`, clicks pass through), the placeholder an empty first option shown muted. |
| `RadioGroup` | A `<fieldset>` whose `<legend>` is the question, the radios in a wrapping row. |
| `CheckboxGroup` | A `role="group"` labelled by its title, with the browser's own checkboxes tinted `accent-ink`. |
| `Checkbox` | One box for consent or an opt-in; its label may end in a link, which opens in a new tab and never ticks it. |
| `Choice` | A radio or a checkbox with its label beside it (`size-4 accent-ink`), for the two groups. |
| `FormNote` | A line of text inside the form with a link at its end. |
| `FieldGroup` | A `<fieldset>` with a `<legend>` (`text-h4 font-semibold`) around fields, rows and notes. |
| `SubmitButton` | A real `<button type="submit">` wearing `buttonClass("solid")`, disabled and relabelled while the submission is in flight. |
| `field.ts` | `control` — the shared control string: `block w-full border border-ink bg-paper px-3 py-2 placeholder:text-muted`. |

```tsx
<Form definition={forms.contact} />
```

## The reveal library (`agentic-cms/ix`) — available, unused

Nothing in the wireframe animates, and nothing imports these. They are kept
whole, with their start states in `src/styles/motion.css`, so a fork that
wants reveals only has to render `<Fx>` (`STANDARD.md` §7).

| Export | What it is | Use |
|---|---|---|
| `InlineAnimation` | One of the site's own SMIL loops, inline: on its first frame until in view, played from the start on each entry, paused off screen, at its `data-rest` under reduced motion | `<InlineAnimation markup={readInlineSvg("public/images/…/loop.svg", { prefix: "…" })} className="aspect-[5/4] w-full" />` — the markup read when the page is built (`agentic-cms/content`); `docs/lab.md` § Inline. |
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
   `pnpm kit placeholder <out> <w> <h>` under
   `public/images/<page>/`.
4. The OG image is a 1200×630 JPEG named for the route with hyphens:
   `public/images/<slug>-og.jpg`.
5. Add the page to `links`, `nav` and `footer.quickLinks` in
   `src/config/site.ts` if it belongs there — three separate lists. Its
   metadata, breadcrumb and sitemap entry follow from the page file's `seo`
   block (`src/lib/seo/README.md`).
6. Verify: `pnpm lint`, `pnpm test`, `pnpm content:lint`, `pnpm build`,
   `pnpm preview`. Before touching an existing page, capture it with
   `pnpm kit visual-parity capture before` (and
   `--scheme dark`, plus `--states` when hover / focus / checked / open
   change) and compare after. Add every new shared component to this file
   in the same commit.
