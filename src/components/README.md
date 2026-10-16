# Component library

Every shared piece of UI on the site, what it is, and how to use it. Pages
are assembled from these; **new markup goes into a page only when nothing
here fits**, and any new shared component is added to this file in the same
commit.

## Library first

Before building anything (a section, a card, a button):

1. **Look here.** If a primitive fits, use it.
2. **Extend it** when it almost fits: a new option in its looks, a new prop,
   never a copy beside it (§ Extending a primitive).
3. **Add a primitive** only when nothing fits: in `ui/`, with its entry in
   this file in the same commit, then use it.
4. **Compose** the section from the pieces. A section lays them out (the
   grid, the gaps, the order) and draws no box of its own: its frame is
   `Section`, a card's frame is `Panel`, and what goes inside a card is the
   section's own design, from its own copy fields.

`pnpm lint` enforces it, and so does CI on every pull request: ESLint runs
`componentRules()` from `agentic-cms/eslint` (configured in
`eslint.config.mjs`). In a section's file it fails a raw `<button>`, `<a>`,
`<img>`, `<picture>`, `<video>`, form field, `<h1>`–`<h6>` or `<svg>`, a
`style` attribute, an arbitrary value (`[…]`, `(…)`), a fill, border,
radius, ring, outline, shadow, transition or animation class, a second
component in the file, each message naming the primitive to use, and copy:
JSX text, or a string in a `title`, `alt`, `aria-label`, `placeholder`,
`label` or `children`, which comes from the page's file instead (a symbol,
an `aria-hidden` decoration and the labels of `Placeholder` and `TypeTag`
pass). Anywhere
in `src/`, it fails an import that goes the wrong way between the layers:

| Layer | Holds | May import |
|---|---|---|
| motion | the only code that animates: here `agentic-cms/ix` itself, as the example has no `motion/` folder | nothing from the other layers |
| `ui/` | the primitives | motion |
| `patterns/` | blocks two or more sections share; the example has none yet | `ui/`, motion |
| the sections: `home/`, `about/`, `use-cases/`, `contact/`, `sections/`, `blog/` | one component per section type, and the registry `sections/render.tsx` | `ui/`, patterns, motion |

Nothing outside the motion layer imports `motion` or `framer-motion`; a
site that adds a `motion/` folder wraps `agentic-cms/ix` there too, and the
lint then keeps it out of the other layers.

Then `pnpm lint` runs `agentic-cms check-components`, the placement guard,
configured in `src/config/components.json`: every file under
`src/components` sits in a layer; every component `ui/` exports is named
in this file, in backticks, in the same commit that adds it; every
component in a section folder is a section `sections/render.tsx` imports;
`src/app` holds route files only, in the content engine's route folders
(the app folder and its catch-all) and the named exceptions' (the post
template, the form endpoint, the feed, each with its reason); no component
lives elsewhere in `src/`; CSS modules only in `ui/` (and a motion folder),
`@keyframes` only in `src/styles/motion.css`. The blog's post template,
which the blog routes render rather than the registry, is on the guard's
frozen `inherited` list. A rule the library cannot meet yet is a new
primitive or option, never a rule turned off in passing: loosening one —
a rule, a layer, a route exception, an `inherited` file — is its own pull
request, said so in its title.

## Extending a primitive

A primitive with more than one look declares them in one map with
`variants()` (§ Class helpers): the base classes, each axis's options, the
defaults. A new look is **one new option** in the map, never a copy of the
component and never a class string in a section. The maps are exported
beside their components (`button`, `panel`, `heading`, `iconButton`,
`media`), so an
element a component has to draw itself wears the same classes: the form's
submit is `buttonClass("solid")`, a card that is a whole link
`cx(panel(), …)`.

```tsx
export const panel = variants({
  variants: {
    variant: {
      solid: "border border-line rounded-panel shadow-panel",
      dashed: "border border-dashed border-line rounded-panel",
    },
  },
  defaults: { variant: "solid" },
});
```

The options ask for role tokens (`border-line`, `rounded-panel`,
`shadow-panel`, `bg-panel` on a box with a ground of its own), so a design
that gives the roles their values restyles every primitive at once, and an
option of its own is for a look the roles cannot say. The example keeps `Panel` at `solid` and
`dashed`: any other surface is a site's design, added as an option there. A
primitive also grows by a prop (`Heading`'s `size` and `entrance`, `Media`'s
`eager`), and takes `className` for the layout and spacing of the place it
is used in.

Rules that apply to all of them (the design system and the section anatomy
are in `STANDARD.md`):

- Semantic HTML; Tailwind utilities for layout, spacing, type, colour,
  visibility and hover/focus. The only CSS module in the tree is
  `blog/PostBody.module.css`; a second one is justified only by something
  utilities cannot say. Every change that must not move a pixel is proven
  with `agentic-cms visual-parity`.
- Four colour values<!-- dark-mode:start -->, each a `light-dark()` pair<!-- dark-mode:end --> — `paper`, `ink`, `fill`,
  `muted` — and role tokens that alias them (`panel`, `line`, `on-ink`): a
  component uses the role where one exists (`border-line` for every
  hairline, `bg-panel` for a box with a ground of its own, `text-on-ink` on
  an ink ground) and a value only where no role does. Radius and shadow
  exist only as role tokens (`rounded-panel`, `rounded-control`,
  `shadow-panel`, `shadow-glow`) held at the wireframe's `0` / none; no
  other radius, shadow, blur, gradient, transition or animation utility
  exists. The type scale is `text-h1`…`text-h6` and `text-body`.<!-- dark-mode:start -->
- A component never reads the theme. `color-scheme` on `:root`, overridden
  by `data-theme` on `<html>`, decides which side of every `light-dark()`
  pair applies.<!-- dark-mode:end -->
- Text, links and images come in through props or `src/config/site.ts`,
  never hard-coded inside a shared component.
- The wireframe has no motion: no `Fx`, no `OnView`, no `Reveal`, no
  `Sequence`, no `data-ix` or `data-part`, no transition. The `ix/` library
  below is kept whole for a fork that wants motion.
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
rhythm, a `Container`, and a `Panel` whose corner tag (`TypeTag`) is the
section's type. Props: `type` (required), `eyebrow?`, `heading?`, `headingAs?`
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

### `Panel`

The one surface: the hairline, the panel radius and shadow, each a role
token (`border-line rounded-panel shadow-panel`), at the wireframe's ink,
`0` and none. It has no ground of its own here, as the boxes it replaced
had none; a design that gives panels a face adds `bg-panel` to `solid`.
`Section` draws its box with it, `sections/Group` its dashed one, the
footer its box, and every section its cards' frames; what goes inside a
card stays the section's own design. Props: `variant?` (`"solid" | "dashed"`, default `solid`), `as?` (`"div" |
"li" | "article" | "aside"`, default `div`), `className?` (the layout and
spacing inside, never a look), and any attribute (`id`, `data-section`,
aria). `panel({ variant })` is the same frame as a class string, for an
element a component draws itself: the blog card is a whole link, the
consent banner a dialog with a ref (which adds its own `bg-panel`, an
overlay's ground).

```tsx
<Panel as="li" className="flex flex-col gap-2 p-4">…</Panel>   // a card in a <ul>
<Panel variant="dashed" data-section={`group-${variant}`}>…</Panel>
<Link href={href} className={cx(panel(), "flex flex-col gap-3 p-4 no-underline")}>…</Link>
```

### `TypeTag`

The tag in a box's corner that names what drew it, in the label font on
the `fill` ground: `Section` prints the section's type with it,
`sections/Group` its variant, so a reader of the wireframe sees which
component renders what. `aria-hidden`: the box's heading carries the
meaning. Props: `label`, `className?` (its spacing in the box).

```tsx
<TypeTag label={type} className="mb-4" />
<TypeTag label={`group · ${variant}`} className="m-4" />
```

## Chrome and actions (`src/components/ui/`)

| Component | What it is | Props | Notes |
|---|---|---|---|
| `Navbar` | The site header | — | `"use client"`; rendered once in `app/layout.tsx`. `<header>` with a `<nav>` named `chrome.navbar.label` ("Main"); the brand, `site.nav`, `site.signIn`, `site.cta`<!-- dark-mode:start --> and the theme switch<!-- dark-mode:end -->. Below 992 px the links and actions hide (`max-lg:hidden`) behind a menu button labelled `chrome.navbar.menu` (`aria-expanded aria-controls`) whose panel lists all of them. The menu's state is the path it was opened on, so a navigation closes it; Escape returns focus to the button, arrows / Home / End walk the links, an outside click closes it, and crossing 992 px closes it too. |
| `NavLink` | A link in the chrome | `href`, `label`, `className?` | `"use client"`. An `http(s)` href renders a plain `<a>`; everything else `next/link`, marked `aria-current="page"` only when the href is exactly the current path — so a section anchor is never "current". |<!-- dark-mode:start -->
| `ThemeToggle` | The theme switch | — | `"use client"`. One button, three states: `system` → `light` → `dark` → `system`, labelled from `chrome.themeToggle` in `src/config/site.ts`. `system` removes `data-theme` from `<html>` and the key from `localStorage`; the other two write both. The attribute *is* the state (read through `useSyncExternalStore`), so the server renders `system` and the first client render agrees. |<!-- dark-mode:end -->
| `Footer` | The site footer | — | `<footer>` with one `Panel`: the brand, `site.tagline`, the `<address>`, the e-mail, and the two link columns from `site.footer` under the titles in `chrome.footer`. The year is computed. With a Google tag id set, `CookieSettingsButton` under the year. |
| `ConsentBanner` | The consent banner | — | `"use client"`; rendered once in `app/layout.tsx`, only when a Google tag id is set (`src/config/analytics.ts`). Headless state from `agentic-cms/consent`'s `useConsent`; the copy is `consentBanner` in `src/config/site.ts`. A non-modal `role="dialog"` in `panel()`, fixed at the foot of the viewport (`z-40`, under the skip link): the site's one overlay. Decline and Allow are the same `OutlineButton`, side by side. A reopened banner takes focus to its first button; a choice hands focus back. Nothing on the server. `docs/consent.md`. |
| `CookieSettingsButton` | Opens the consent banner again | `className?` | `"use client"`. A real `<button>` calling `openConsent()`, labelled `consentBanner.settings`; the footer renders it, and any page may. |
| `Button` | The call to action, always a link | `href`, `label`, `variant?` (`"solid" \| "outline"`, default `solid`), `current?`, `className?` | An href starting with `/` renders `next/link`, an absolute one a plain `<a>`. Its looks are the `button` map (`variants()`): `solid` is `bg-ink text-on-ink`, `outline` is `bg-panel text-ink`; both are bordered, `no-underline`. `current` sets `aria-current="page"`. |
| `buttonClass(variant?)` | The button's classes on their own | — | For a real `<button>`: the form's submit wears `buttonClass("solid")`, `OutlineButton` `buttonClass("outline")`. |
| `OutlineButton` | A choice on the page | `label`, `onClick?`, `pressed?`, `disabled?`, `className?` | A real `<button type="button">` in the outline look: a filter, a toggle, a step, a consent answer, never a call to action (that is `Button`, a link). `pressed` sets `aria-pressed` and makes it a toggle; left out, it is a plain button. Takes `onClick`, so it is used from a client component. |
| `IconButton` | A button that shows only an icon | `label`, `icon`, `onClick?`, `pressed?`, `disabled?`, `variant?` (`"outline" \| "solid"`, default `outline`), `className?` | 44 px square (`size-11`), so a finger hits it. `label` is required: it is the accessible name (`aria-label`) and the tooltip (`title`), and the icon is `aria-hidden`. Its looks are the `iconButton` map. Unused by the wireframe. |

```tsx
<Button href={site.links.contact} label={cta} />
<Button href={site.links.blog} label={cta} current />
<Button href={site.cta.href} label={site.cta.label} variant="outline" />
<OutlineButton label={copy.allow} onClick={() => choose("granted")} />
<OutlineButton label={category.name} pressed={shown === category.slug} onClick={() => setShown(category.slug)} />
<IconButton label="Next" icon={<Icon {...ICONS["lucide:arrow-right"]} size={20} />} onClick={next} />
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
<EagerImage src={post.image} width={1600} height={900} alt={post.imageAlt || ""} className="block h-auto w-full border border-line" />
```

## Class helpers (`agentic-cms/cx`)

Two functions with no React, so they load in server and client components
and under `node:test` alike.

- **`cx(...parts)`** joins class names and skips the falsy ones:
  `cx(styles.faq, panel(), "mb-8")`, `cx(control, className)`.
- **`variants({ base, variants, defaults, compound? })`** declares a
  component's looks as one typed map and returns the function that picks
  one: the base, each axis's option or its default, then every `compound`
  whose options are all picked. A new look is one line in the map, never a
  copy of the component. An option an axis lacks throws and names the
  options it has. `VariantProps<typeof fn>` is the props it takes: each
  axis, optional.

```tsx
import { variants, type VariantProps } from "agentic-cms/cx";

const box = variants({
  base: "border border-line p-4",
  variants: { tone: { plain: "bg-panel", filled: "bg-fill" } },
  defaults: { tone: "plain" },
});
type BoxLook = VariantProps<typeof box>; // { tone?: "plain" | "filled" }
box({ tone: "filled" }); // "border border-line p-4 bg-fill"
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

A picture the copy actually describes is `Media` instead.

## `Media` (`src/components/ui/Media.tsx`)

A picture the copy describes, so a section never writes `<img>`: in the
box its `size` names, with the hairline (`border border-line`) unless
`framed={false}`. Props: `src`, `alt` (`""` only for decoration), `width`
and `height` (the file's own size, so the box is reserved before it loads),
`size?` (`"fill"`, default: `block h-auto w-full`, the column's width at the
file's ratio; `"icon"`: a card's 64 px `size-16`; `"portrait"`: a review's
80 px `size-20`), `eager?`, `framed?`, `className?`. Below the fold, the
default, it is an `<img loading="lazy">`; `eager` renders `EagerImage` for a
picture above the fold in a server component, so it stays out of other
pages' prefetches (`STANDARD.md` §4). Its sizes are the `media` map: a new
box is a new option there.

```tsx
<Media src={dashboard.image} width={1200} height={750} alt={dashboard.imageAlt} />
<Media src={entry.icon} width={64} height={64} alt="" size="icon" />
<Media src={post.image} width={1600} height={900} alt={post.imageAlt} eager />
```

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

A page or section heading, its level apart from its size. Props: `as?`
(`"h1"`…`"h6"`, default `h2`), `size?` (`"auto"`, default, or `"h1"`…`"h6"`),
`entrance?` (`"rise" | "fade" | "scale"`), `intro?`, `delay?`, `className?`,
`children`. Without a `size` the type is the level's own, from `base.css`;
`size` sets it from the `heading` map instead (an `h3` at `h4` size is
`text-h4`). `entrance` renders it as the play-once layer's `Reveal`
(`agentic-cms/ix`): it enters once, `intro` from the first frame for the
first screen's heading, `delay` in ms. The wireframe passes no entrance, so
nothing moves.

```tsx
<Heading as="h1">{heading}</Heading>
<Heading as="h3" size="h4">{title}</Heading>
<Heading as="h1" entrance="rise" intro>{heading}</Heading>   // a site with motion
```

## Text (`src/components/ui/`)

### `TextLink`

A link in running copy, so a section never writes `<a>`. Props: `href`,
`children`, and every other attribute of an `<a>` (`className`, a post
body's `id`, `title` or aria), passed through. A path or an anchor (`/…`,
`#…`) renders `next/link`; an `http(s)` address opens in a new tab
(`target="_blank" rel="noopener noreferrer"`); anything else (`mailto:`,
`tel:`) is a plain `<a>`. It keeps the page's underline. A link that looks
like a button is `Button`; a link in the chrome is `NavLink`; a post body's
links are `TextLink` too (`blog/mdxComponents`).

```tsx
<TextLink href={site.links.blog}>the blog</TextLink>
<TextLink href="https://example.com/spec">the spec</TextLink>
```

### `MetaLine` and `metaLabel`

A line of small uppercase metadata, a post's category, date and reading
time, in `metaLabel` (`font-label text-h6 uppercase tracking-label
text-muted`). Props: `items: string[]` (an empty one is left out),
`className?`. The items are separated by a ` · ` that is `aria-hidden`.
`metaLabel` is the same type as a class string, for a label that is not a
line (a table's head). Unused by the wireframe, whose labels are the boxed
`eyebrowText`.

```tsx
<MetaLine items={[post.category.name, formatDate(post.date), chrome.post.readingTime(post.readingMinutes)]} />
```

### `keepWords` (`src/components/ui/text.ts`)

`keepWords(text)` turns each hyphen between two letters or digits into
U+2011, the non-breaking hyphen, so a line never breaks inside
"end-to-end"; a spaced dash and a leading or trailing hyphen stay. No React,
so it runs in server components and under `node:test` (`text.test.ts`).

```tsx
<h3>{keepWords(card.title)}</h3>
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
| `field.ts` | `control` — the shared control string: `block w-full border border-line bg-panel px-3 py-2 placeholder:text-muted`. |

```tsx
<Form definition={forms.contact} />
```

## The motion library (`agentic-cms/ix`) — available, unused

Nothing in the wireframe animates, and nothing renders these: `Heading`
imports `Reveal` for its `entrance`, which no section passes. They are kept
whole, with their start states and keyframes in `src/styles/motion.css`, so a
fork that wants motion only has to render them (`STANDARD.md` §7). Two layers;
choose before writing the first one:

- **Play once** — `Reveal`, `RevealGroup`, `Sequence`, `part()`: a root plays
  the first time it is seen, never again on a second scroll or a hover, and
  its loops run only on screen. The default for new work.
- **Replay on re-entry** — `Fx`, `OnView`: an element plays each time it
  enters the viewport after having left it entirely. Only when that replay is
  wanted.

### Play once

The layer is CSS keyframes that one attribute starts: a site renders
`motionScript()` near the top of `<body>` and keeps the layer's block of
`motion.css` (start states, keyframes, loops, the reduced-motion guard, the
`--ease-*` / `--motion-*` tokens). Without the script, under reduced motion and
in the harness's static captures every part is at rest.

| Export | What it is | Use |
|---|---|---|
| `Reveal` | One element that enters once | `<Reveal as="h2" effect="fade" delay={120} className="…">` — effects `rise` (default), `fade`, `scale`. `intro` for the first screen's copy: played by CSS from the first frame, never blank while the scripts load. |
| `RevealGroup` | Its direct children enter one after another, once | `<RevealGroup as="ul" effect="pop" step={60} className="…"><li>…</li>…</RevealGroup>` — effects `rise`, `fade`, `scale`, `pop`; `step` in ms (default the site's `--motion-stagger`), `delay` before the first. Each child takes `style` and a data attribute. |
| `Sequence` | A choreography of parts, played once; its loops only on screen | `<Sequence as="svg" viewBox="…" settle={2600}><path {...part("draw", 400)} d="…" /><circle {...part("pulse")} … /></Sequence>` — `settle` (ms, for a sequence over two seconds) becomes `data-settle`. |
| `part(kind, delayMs?, { dim, style }?)` | The props that make an element a part | Spread them on the element: `data-part` and `--d`. Kinds `fade`, `rise`, `scale`, `pop`, `draw`, `grow`, `dim` (fades back to `dim`, 0.16 by default), and the loops `flow`, `pulse`, `breathe`; `PART_KINDS` and `LOOP_KINDS` list them, `PartKind` is their type. |
| `staggerDelay(index, delayMs?, stepMs?)` | The i-th delay of a stagger | `<li data-part="pop" style={{ "--d": staggerDelay(i, 100) }}>` for a list a `Sequence` staggers by hand (what `RevealGroup` does): `delayMs` plus i steps of the site's `--motion-stagger`, or of `stepMs`. |
| `useMotionRoot()` | The ref callback behind the three | `<div ref={useMotionRoot()} data-motion-root="">` for a root of one's own: plays it once 12 % into the viewport, keeps `data-visible` for its loops, measures its draws (`--len`), plays at once under a lab timeline. |
| `motionScript()` | The arming script's text | `<script dangerouslySetInnerHTML={{ __html: motionScript() }} />` near the top of `<body>`: `data-motion="on"` on `<html>` unless the reader prefers reduced motion. |

### Replay on re-entry, and the shared pieces

| Export | What it is | Use |
|---|---|---|
| `InlineAnimation` | One of the site's own SMIL loops, inline: on its first frame until in view, played from the start on each entry, paused off screen, at its `data-rest` under reduced motion | `<InlineAnimation markup={readInlineSvg("public/images/…/loop.svg", { prefix: "…" })} className="aspect-[5/4] w-full" />` — the markup read when the page is built (`agentic-cms/content`); `docs/lab.md` § Inline. |
| `fillBox(markup)` | `InlineAnimation`'s markup step: the root `<svg>` fills its box | `fillBox(svg)` puts `display:block;width:100%;height:100%` first in the root `<svg>`'s `style` (or gives it one), so the box sizes the drawing before any stylesheet loads; only the root is touched. |
| `Fx` | The scroll-into-view reveal: 1000 ms, ease-out-quart, 100 px travel, replayed on every entry | `<Fx preset="slideInLeft" delay={200} offset={12} mq="main" as="li" className="…">` — presets `slideInBottom` (default), `slideInTop/Left/Right`, the four corners, `growIn`, `fadeIn`. `as="link"` renders `next/link`. `duration` (ms) and `distance` (px) change the numbers; `intro` plays the first entrance by CSS from the first frame — a hero's copy, there before the scripts — and leaves the replays to Motion (the `ix-intro` block of `motion.css`). |
| `OnView` | A custom action list on scroll-into-view | `<OnView as="section" mq="main" build={(root) => [[ix("card-2"), { y: "0%" }, { duration: 0.5, ease: ease("ease") }], …]}>` — Motion's `animate()` sequence format, resolved inside the element. Under reduced motion the sequence completes at once, so elements still land where it leaves them. |
| `ease(name)` | The easing table | `ease("ease")`, `easeIn/Out/InOut`, `outQuad`, `outQuart`, `inOutCirc`, `inOutQuad`, `outCubic`, `linear`. |
| `EASE` | The table itself: name → cubic-bezier tuple, read-only | `` `cubic-bezier(${EASE.outQuart.join(",")})` `` for a CSS timing of one's own; `ease()` returns a copy of one tuple for Motion. `EaseName` is its key type. |
| `useReveal(ref, offset, once?)` | When a scroll-into-view effect plays | `const plays = useReveal(ref, 12)` — once the element is `offset` % into the viewport, and again only after it has left it entirely (a block still partly on screen never replays); `once` never re-arms. The count is the key of an effect that runs each play to its end; `Fx`, `OnView` and `InlineAnimation` play on it. |
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
| `mdxComponents` | — | Element overrides for post bodies: `<fx>` (the wrapper `rehype-post-blocks` emits) renders as the element it names and drops the delay, and every link is a `TextLink` (internal ones through `next/link`, external ones with `target="_blank" rel="noopener noreferrer"`). |

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
title block, `Panel` and the button come from this file, illustrations from
`Placeholder`, content images and icons from `Media`.

A card's frame is `Panel` (`<Panel as="li">` in a list), and what goes
inside it is the section's own design: there is no shared `Card`, so a
section renders its cards from the copy its page's file gives it
(`cards.map(...)`), as a `<ul>` when they are a list; an array at the top
of its file holds keys or the design's numbers (`CARDS` in `about/Hero`),
never copy — the lint fails a `title` or a `label` written there.
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
   `pnpm preview`. A change to an existing page is proven with
   `pnpm kit visual-parity proof` once built (a pass in each scheme the
   profile names, `src/config/harness.ts`; `--states` when hover / focus /
   checked / open change). Add every new shared component to this file
   in the same commit.
