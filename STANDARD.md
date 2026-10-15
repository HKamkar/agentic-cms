# The wireframe standard

The design system of agentic-cms and the way its pages are built on it. Read this before
writing any markup or CSS; the short version is `AGENTS.md` (Styling) and
`.claude/rules/styling.md`, the component catalogue with props and examples is
`src/components/README.md`.

The example site is a Next.js 16 App Router app (React 19, TypeScript), styled
with Tailwind CSS v4 utilities, prerendered in full and served as a static
Cloudflare Worker (OpenNext). It is drawn as a **wireframe**: ink on paper, one
border weight, no colour, no radius, no shadow, no motion. That is the point —
agentic-cms ships a shape a fork redesigns, not a look it has to undo. Every page is
a stack of labelled boxes whose tags name the section type that drew them.

## 1. Tokens

All tokens live in the `@theme static` block of `src/app/globals.css` and
nowhere else. A token name becomes utilities (`--color-paper` → `bg-paper`,
`--color-line` → `border-line`, `--container-page` → `max-w-page`,
`--spacing-section` → `py-section`);
`src/styles/base.css` redefines two of them per breakpoint on `:root`, so the
utilities and the element rules read one source at every width.

### Breakpoints

| Utility | Width | What it does here |
|---|---|---|
| `max-sm:` | < 480 | a field row wraps, the pull-quote stacks |
| `max-md:` | < 768 | h1–h3 step down; a section box's padding goes 24 → 16 px |
| `max-lg:` | < 992 | the navbar's links and actions hide behind the menu button |
| `lg:` | ≥ 992 | the desktop layout: every `lg:grid-cols-*` on the page |
| `xl:` | ≥ 1280 | nothing yet — a capture width, and a step a fork will want |
| `2xl:` | ≥ 1440 | nothing yet |
| `3xl:` | ≥ 1920 | nothing yet |

CSS spells the same numbers out: `@media (width < 768px)`,
`@media (width >= 992px)`.

### Fonts

No webfont is loaded: the wireframe uses what the reader already has, so a
capture never waits on a network font and a fork picks its own.

| Token | Value | Used for |
|---|---|---|
| `font-sans` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | body and headings alike |
| `font-body` | `= --font-sans` | what `base.css` sets on `body` |
| `font-heading` | `= --font-sans` | what `base.css` sets on `h1`–`h6` (weight 600) |
| `font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | — |
| `font-label` | `= --font-mono` | every boxed label: eyebrows, tags, chips, a section's own type |
| `tracking-label` | `normal` | a label's letter-spacing, by role |

### Colours

Four values, each a `light-dark()` pair, and three roles that alias them.
Tailwind's palette is removed (`--color-*: initial`), so a page cannot quietly
acquire a colour: `bg-white`, `text-black` and `border-gray-300` are not
utilities here.

| Value | Light | Dark | What it is |
|---|---|---|---|
| `paper` | `#ffffff` | `#121212` | the page ground, and what `panel` and `on-ink` alias |
| `ink` | `#000000` | `#f2f2f2` | text, the solid button's fill, and what `line` aliases |
| `fill` | `#e5e5e5` | `#2a2a2a` | a filled block: a label's ground, a placeholder's field, a form's success box |
| `muted` | `#666666` | `#9a9a9a` | secondary text: a date, a role, a placeholder's caption, a variant note |

| Role | Aliases | What asks for it |
|---|---|---|
| `panel` | `paper` | a panel's face, a box with a ground of its own: a form control, the outline button, the consent banner, the skip link |
| `line` | `ink` | every hairline: a box's border, a rule, the placeholder's cross |
| `on-ink` | `paper` | text on an ink ground: the solid button's label |

A component uses the role where one exists and a value only where no role
does: `border-line`, never `border-ink`. The page ground, text, a filled block,
muted text and the solid button's fill have no role, so they name their value.
A fork restyles by changing a value, or by pointing a role at another value or
giving it one of its own. A new value or role is a token first — never a
literal in a component, never an alpha modifier on one of these.

### The theme

`:root { color-scheme: light dark; }` in `base.css` is the whole mechanism:
`light-dark()` reads it, so the reader's system setting decides by default. A
choice sets `data-theme="light"` or `"dark"` on `<html>`, which overrides
`color-scheme` for the document; `ui/ThemeToggle` writes that attribute and
`localStorage.theme`, and the inline script in `src/app/layout.tsx` replays it
before the first paint, so a reader who chose dark never sees a white flash.
`viewport.colorScheme` declares that both are supported. A component never reads
the theme, never branches on it and never carries a `dark:` variant: it uses the
semantic colours and both modes follow.

### Type scale

The tokens carry size, line-height and, for the headings, letter-spacing, so
`text-h2` sets all three; `h1`–`h6` get theirs from `base.css` and need no type
utility at all. The two steps of the scale are `:root` overrides in `base.css`.

| Token | ≥ 768 | < 768 | line-height | letter-spacing |
|---|---|---|---|---|
| `text-h1` | 2.5rem | 2rem | 1.15 | normal |
| `text-h2` | 1.875rem | 1.5rem | 1.25 | normal |
| `text-h3` | 1.375rem | 1.25rem | 1.3 | normal |
| `text-h4` | 1.125rem | — | 1.35 | normal |
| `text-h5` | 1rem | — | 1.4 | normal |
| `text-h6` | 0.875rem | — | 1.4 | normal |
| `text-body` | 1rem | — | 1.6 | — |

Never `text-base`, `text-sm` or `text-lg`: they set Tailwind's line-heights, not
this scale. A `<p>` that has to look like a heading takes the token
(`text-h1 font-semibold` for a statistic, `text-h4` for a card title inside a
link); `text-h6` is the label size.

### Spacing and layout

`--spacing-section` is 4rem, 2.5rem below 992 — the vertical rhythm of a
section, `py-section`. `--container-page` is 72rem, the one page column;
`ui/Container` is `mx-auto w-full max-w-page px-4` and nothing else sets a width
or a side gutter. Everything in between is the 4 px spacing scale (`gap-2` 8 px,
`gap-4` 16 px, `p-4` 16 px, `p-6` 24 px, `mb-6` 24 px), and that is the whole
vocabulary: a wireframe has no arbitrary values to transcribe. `--radius-*`,
`--shadow-*`, `--blur-*`, `--animate-*` and `--ease-*` are reset to `initial`,
so `blur-*`, `animate-*` and `ease-*` do not exist — and neither does a
gradient or a transition. Radius and shadow come back only as roles, held at
the wireframe's values: `rounded-panel` and `rounded-control` (`--radius-panel`,
`--radius-control`, `0`), `shadow-panel` and `shadow-glow` (`--shadow-panel`,
`--shadow-glow`, `0 0 #0000`). A surface asks for its radius and shadow by
role, and a fork gives the roles their values; no other radius or shadow
utility exists.

## 2. Layers and files

| Layer / file | Holds | Touch it when |
|---|---|---|
| `theme` — `globals.css` `@theme static` | the tokens | a value is needed a second time |
| `base` — Tailwind preflight | margins, paddings, borders and list markers zeroed; `[hidden]` hidden; buttons inherit font and colour | never |
| `base` — `src/styles/base.css` | `color-scheme` and the two `data-theme` overrides, the two breakpoint steps, `body`, `h1`–`h6`, the underlined `a`, `strong`, `img, video { height: revert-layer }` | a default every page needs |
| `utilities` — Tailwind | everything else | always |
| unlayered — `src/styles/motion.css` | the start states and keyframes of the `ix/` motion library — the reveals' classes and the play-once layer's block with its tokens — outside the layers so they beat any utility | a fork adds a reveal preset or a part (§7) |
| unlayered — `<Name>.module.css` | what utilities cannot say | see below |

There is exactly one CSS module in the tree,
`src/components/blog/PostBody.module.css`: the element rules inside a run of
prose (`.prose p`, `.prose ul`, `.prose h2` …, which preflight zeroes everywhere
else) and the FAQ accordion, whose collapsed answers are drawn by nothing but
its `p[data-open]` rule. A second module is justified only by something of that
kind; it is plain CSS (no `@apply`, no preprocessor nesting), spells its
breakpoints out, and joins the utilities with `cx()` from `src/lib/cx.ts`:

```tsx
faq: cx(styles.faq, "mb-8 border border-line"),
```

Because preflight already zeroes them, nothing writes `m-0`, `p-0` or
`list-none`; a component adds the spacing it needs (`mb-6`) and the list style
it wants (`list-disc pl-5`).

## 3. Markup

- **Semantic tags.** `<section>` per section (from `ui/Section`), `<header>` /
  `<nav>` / `<footer>` once in the layout, one `<h1>` per page, `<h2>` for a
  section's heading, `<h3>` for a card's title, `<ul>`/`<li>` for any repeated
  set, `<button type="button">` for anything clickable that is not a link,
  `<address>` for the address, `<blockquote>` for a quote, `<article>` for a
  post.
- **The heading order is audited.** An `<h3>` before the first `<h2>` fails
  `pnpm build`, so a card's `<h3>` always comes after its section's heading —
  which is why a section with cards always has one. A `statement` field is the
  section's `<h2>`.
- **Decorative elements** are real elements with `aria-hidden="true"` (the
  section's type tag, the group's label, the placeholder's cross, the FAQ's `+`
  / `−`), never pseudo-elements; a decorative image carries `alt=""`. The one
  exception is the post body's accordion (`FaqAccordion`), built by script
  over markdown headings, whose marker is a `::after` in `PostBody.module.css`.
- **Focus.** Interactive things are real `<button>`s and links, and the
  browser's own `:focus-visible` ring stays: never `outline-none` on anything a
  keyboard reaches. The one exception is `<main>`, which the skip link focuses
  and tabbing never reaches.
- **One colour utility per property per element.** Two resolve by stylesheet
  order, not class order — write the ternary.
- **Visibility per breakpoint** with `max-lg:hidden` / `lg:hidden`; no
  JavaScript for layout that CSS can express.
- **Text nodes stay byte-identical in a refactor**: do not split a sentence
  across JSX expressions or reflow a paragraph, or the line box moves by a
  fraction of a pixel and the capture shows it.

## 4. Images and placeholders

Two kinds of picture, and they are not interchangeable.

- **`ui/Placeholder`** stands in for an illustration the design has not drawn: a
  crossed box at the ratio the real image will have, labelled with what belongs
  there. It is `aria-hidden`, it is not a file, and it takes a `ratio` utility —
  the pages use `aspect-video`, `aspect-square`, `aspect-[4/3]`, `aspect-[2/1]`
  and `aspect-[16/10]`.
- **`<img>`** is for content: a screenshot the copy describes, a post's hero, a
  portrait, an icon. Always `width`, `height` and `alt` (the audit fails a
  missing one; empty is fine for decoration), plus explicit size utilities.
  `base.css` sets `img { height: revert-layer }`, so an image sized by `w-full`
  carries `h-auto` with it — the content-image string is
  `block h-auto w-full border border-line`.

Above the fold in a **server** component, use `EagerImage` (from
`agentic-cms/components`): a plain eager
`<img>` there becomes a preload hint in the page's RSC payload that every other
page executes when it prefetches a link here. Everything else is
`loading="lazy"` (a post body gets it, and its `width`/`height`, from
`rehype-post-images`).

Placeholder files come from `pnpm kit placeholder <out> <width>
<height>`: a mid-grey field with a one-pixel border and a corner-to-corner
cross, no text, so it needs no fonts and reads on a light and a dark page alike.
The format follows the extension (`.webp` lossless, `.jpg` quality 80, `.png`,
`.svg`). Every raster committed under `public/images` is its output; the sizes
the example uses:

| Slot | Size |
|---|---|
| a page's OG image | 1200×630 `.jpg` |
| a post's hero and mid-article image | 1600×900 |
| a post's card thumbnail | 820×696 |
| an author portrait | 256 square (drawn in a 110 px box) |
| a review portrait | 160 square (drawn in an 80 px box) |
| a card or list icon | 64 square `.svg` |

Where they live: `public/images/<page>/` for one page's, `public/images/ui/` for
shared ones, `public/images/brand/logo.svg` (the brand mark, always
`site.logo`), `public/images/blog/<slug>/` for a post's and
`public/images/blog/ui/` for the body's own furniture, `public/images/authors/`.
A page's OG image sits at the top level, named for its route with hyphens:
`/sections/about` → `public/images/sections-about-og.jpg`. Name a file for what
it is, never with an export hash, and grep `src` for every user before moving
one.

**Icons come in families, not drawings.** A site has three kinds and one
family per kind: line icons for the chrome and the cards' glyphs (Lucide,
through `pnpm kit icons add lucide:<name>`, one stroke width), other
companies' marks (Simple Icons, `si:<slug>`, one ink) and the site's own
marks beside copy, generated from primitives in the language of a reference
mark (`pnpm kit icons family <spec>`; a new mark is a composition in the
spec, never a new drawing style). `pnpm kit icons audit` lists every icon on
the built pages beside its copy; one template glyph is the whole class. The
wireframe draws none of these — its `icon` fields are placeholder images —
and a design names its families here (`docs/icons.md`). A drawing beyond
the families — an icon of the site's own, an illustration, a short loop —
is designed as SVG in the lab (`pnpm kit lab`, `docs/lab.md`) and ships
pre-rendered like any other picture: a file here, or inline `Icon` data
(`icons add file:<name>`, its source under `src/config/icons/`); the lab
itself leaves nothing in the tree.


## 5. Components

The catalogue with props and examples is `src/components/README.md`; every new
shared component goes into it in the same commit. In short:

| Kind | Components | Rule |
|---|---|---|
| Layout | `ui/Container`, `ui/Section` | every section renders inside `Section`; nothing else sets a page width |
| Chrome | `ui/Navbar`, `ui/NavLink`, `ui/ThemeToggle`, `ui/Footer`, `ui/Button` (+ `buttonClass`), `ui/ConsentBanner`, `ui/CookieSettingsButton` | rendered once in `app/layout.tsx`; a page never writes header, footer or button markup. The consent banner, shown only when a Google tag id is set, is the one fixed overlay (`z-40`, under the skip link) |
| Title | `ui/Eyebrow` (+ `eyebrowText`), `ui/Heading` | `Section` renders both from its props; `eyebrowText` is the same label as a class string |
| Stand-in | `ui/Placeholder` | every illustration the design has not drawn |
| FAQ | `ui/Faq` | the disclosure list; the section around it is `sections/FaqSection` |
| Forms | `ui/form/*` | forms are definitions in `src/config/forms.ts` (`src/lib/forms/README.md`); never hand-build one |
| Motion | play once: `Reveal`, `RevealGroup`, `Sequence`, `part()` (+ `PART_KINDS`, `LOOP_KINDS`), `staggerDelay()`, `useMotionRoot()`, `motionScript()`; replay on re-entry: `Fx`, `OnView`, `useReveal()`; `InlineAnimation` (+ `fillBox`), `ease()` (+ `EASE`), `ix()`, `useMainBreakpoint()`, `useReducedMotionPref()` (`agentic-cms/ix`) | present, used by nothing — §7 says which to choose |
| Content | `blog/BlogHero`, `blog/BlogCard`, `blog/BlogIndex`, `blog/PostBody` (+ `postBlocks`), `blog/mdxComponents` | the blog engine (`src/lib/blog/README.md`) |
| Engine | `JsonLd`, `EagerImage`, `FaqAccordion` (`agentic-cms/components`) | structured data with `<` escaped; the above-the-fold image that stays out of the RSC preload hints; the post body's accordion behaviour |

Cards are **not** a shared component: every section's cards are its own design,
so a section renders them from a data array at the top of its file or from the
collection the registry resolves for it. Do not build a generic `Card`.

Brand data, links and the chrome's text come from `src/config/site.ts`; a
section's copy arrives as props from its page file. Neither is ever hard-coded
in a shared component.

## 6. Anatomy of a section

One file per section in `src/components/<page>/<Section>.tsx`, listed by a page
file and rendered through the registry. Its copy arrives as props typed
`SectionProps<"<type>">`; everything the design decides stays in the component,
keyed by position. Every one of them renders inside `ui/Section`, the frame:

```tsx
<section id={type} data-section={type} className="py-section">
  <Container>
    <div className="border border-line p-6 max-md:p-4">
      <span aria-hidden="true" className="mb-4 inline-block border border-line bg-fill px-2 font-label text-h6">{type}</span>
      …the eyebrow, the heading, the children…
```

`type` is the section type from the page file, and it does three jobs: it is the
box's visible tag (so a reader can see which component drew what), the section's
`id` (so `/#contact-form` lands on it) and its `data-section` (so the capture
harness finds it). `headingAs="h1"` makes a hero's heading the page's `<h1>`.

The shared strings, as they appear in the code:

| What | String |
|---|---|
| a card | `flex flex-col gap-2 border border-line p-4` |
| a card grid | `grid gap-4 lg:grid-cols-3` (or `-2`, `-4`) |
| a split | `grid gap-4 lg:grid-cols-2` |
| a lead paragraph | `mb-6 max-w-prose` |
| a content image | `block h-auto w-full border border-line` |
| an icon | `size-16 border border-line` |
| a statistic | `text-h1 font-semibold` |
| secondary text | `text-muted` |

`src/components/about/Benefits.tsx`, whole:

```tsx
import { Section } from "@/components/ui/Section";
import type { SectionProps } from "@/components/sections/schemas";

const card = "flex flex-col gap-2 border border-line p-4";

/** "What you get": three benefit cards, each an icon, a title and a line. */
export function Benefits({ eyebrow, heading, cards }: SectionProps<"about-benefits">) {
  return (
    <Section type="about-benefits" eyebrow={eyebrow} heading={heading}>
      <ul className="grid gap-4 lg:grid-cols-3">
        {cards.map((benefit) => (
          <li key={benefit.title} className={card}>
            <img src={benefit.icon} width={64} height={64} alt="" loading="lazy" className="size-16 border border-line" />
            <h3>{benefit.title}</h3>
            <p>{benefit.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
```

A server component (nothing here needs the browser); the frame and title block
from `Section`; cards as list items from the section's own array; `<h3>` after
the section's `<h2>`; body copy as a bare `<p>`; the icon carrying its size both
on the element and in the attributes. A call to action would be
`<Button href={site.links.contact} label={cta} />`.
`src/components/home/Service.tsx` is the same shape with a `lg:grid-cols-2`
split and a content image instead of a placeholder.

## 7. Motion

**The wireframe animates nothing.** No `Fx`, no `OnView`, no `Reveal`, no
`Sequence`, no `data-ix` or `data-part`, no transition or transform utility, no
keyframes. Nothing on a page is hidden until
JavaScript runs: the HTML a crawler receives is the page a reader sees. The only
state changes are the ones a control owns — the FAQ's `hidden` answer, the
navbar's mounted menu, the theme attribute — and each is instant.

The motion library survives for a fork that wants motion, whole and unused, in
`agentic-cms/ix` (`src/lib/ix/`) with its start states and keyframes in
`src/styles/motion.css`. It has two layers, and the first question is which:

- **Play once: `Reveal`, `RevealGroup`, `Sequence`** (below). A root plays the
  first time it is seen and never again — not on a second scroll, not on a
  hover — and its loops run only while it is on screen. This is the default
  for new work.
- **Replay on re-entry: `Fx`, `OnView`.** An element plays each time it enters
  the viewport after having left it entirely. Choose them only when that
  replay is wanted. One element never takes both.

The reveals that replay:

| Export | What it is |
|---|---|
| `Fx` | the scroll-into-view reveal, 1000 ms, ease-out-quart, 100 px travel, replayed on each entry after the element has left the viewport entirely (never while it is still partly on screen): `<Fx preset="slideInBottom" delay={200} offset={12} mq="main" as="li">`. Presets `slideInBottom/Top/Left/Right`, the four corners, `growIn` (from scale 0.75) and `fadeIn`; `as="link"` renders `next/link`; `duration` (ms) and `distance` (px) change the numbers. `intro` is for the first screen: the first entrance is played by CSS from the first frame (`ix-intro` in `motion.css`, the numbers passed as custom properties), so a hero's copy is never a blank start pose while the scripts load; the replays are Motion's, and it plays at every width. |
| `OnView` | a sequence over several elements when the section enters: `build={(root) => [[ix("card-2"), { y: "0%" }, { duration: 0.5, ease: ease("ease") }], …]}`, Motion's `animate()` format, resolved inside the element. |
| `InlineAnimation`, `fillBox(markup)` | one of the site's own SMIL loops, inline: on its first frame until in view, played from the start on each entry, paused off screen, at its `data-rest` under reduced motion (`docs/lab.md` § Inline); `fillBox` is its markup step, the root `<svg>` given `display:block;width:100%;height:100%` first in its `style`, so the box sizes the drawing before any stylesheet loads. |
| `ease(name)`, `EASE` | `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `outQuad`, `outQuart`, `inOutCirc`, `inOutQuad`, `outCubic`; `EASE` is the table itself (name → cubic-bezier tuple, read-only), `ease()` a copy of one tuple for Motion. |
| `useReveal(ref, offset, once?)` | when a scroll-into-view effect plays: once the element is `offset` % into the viewport, and again only after it has left the viewport entirely (`once` never re-arms); returns the number of plays, the key of an effect of one's own. `Fx`, `OnView` and `InlineAnimation` play on it. |
| `ix(name)`, `useMainBreakpoint()`, `useReducedMotionPref()` | the selector for a `data-ix` target; the ≥ 992 px query (`null` until mounted); `prefers-reduced-motion`. |

Adding a reveal is five lines: import `Fx`, wrap the element, pick the preset
and the delay, add `mq="main"` if it is desktop-only, and check that the
preset's start state exists in `motion.css` (`ix-init--*`, or `ix-main-init--*`
inside the desktop media query for `mq="main"`; an `intro` needs the
`ix-intro` block instead). A section whose sequence
runs longer than two seconds after it enters the viewport says so on its
element — `data-settle="2600"` — and the harness's settled motion frame waits
for it (`docs/visual-parity.md`). The rules that come with it:
targets are `data-ix` attributes addressed through `ix(name)` and never styling
classes, so restyling cannot break a sequence; every animated component checks
`useReducedMotionPref()`; and no `translate-*`, `rotate-*` or `scale-*` utility
sits on an element the library moves, because Tailwind's individual transform
properties compose with Motion's inline `transform` (a static transform on such
an element goes in a module). Once any of it is in use, `capture <label>
--motion` plays the animations instead of freezing them and records an inventory
of every animation with its timing and target, compared exactly.

The play-once layer — CSS keyframes started by one attribute, no animation
code in the reader's browser beyond two shared observers:

| Export | What it is |
|---|---|
| `Reveal` | one element that enters once: `<Reveal effect="rise" delay={120} as="h2">`, effects `rise` (default), `fade`, `scale`. `intro` is for the first screen's copy: the entrance is played by CSS from the first frame, never a blank start pose while the scripts load. |
| `RevealGroup` | its direct children enter one after another: `<RevealGroup as="ul" effect="pop" step={60}>`, effects `rise`, `fade`, `scale`, `pop`; `step` in ms, or the site's `--motion-stagger`. Each child takes `style` and a data attribute. |
| `Sequence` | a choreography: every element inside it marked with `part()` plays once, after its own delay, and its loops run only on screen. `as="svg"` for a drawing; `settle={2600}` writes `data-settle` for the harness. |
| `part(kind, delayMs?, { dim, style }?)`, `PART_KINDS`, `LOOP_KINDS` | the props that make an element a part, `<path {...part("draw", 400)} d="…" />`: `data-part` and `--d`. The kinds: `fade`, `rise`, `scale`, `pop`, `draw` (a stroke draws itself), `grow` (from its left edge), `dim` (fades back to `--dim`), and the loops `flow`, `pulse`, `breathe`. |
| `staggerDelay(index, delayMs?, stepMs?)` | the delay of a stagger's i-th item: `340ms`, or a `calc()` over `--motion-stagger`. |
| `useMotionRoot()` | the ref callback behind the three: plays a root once when it is 12 % into the viewport (one shared observer; a root in the last 12 % of the page as soon as it shows), keeps `data-visible` on a root with loops while it is on screen, measures a `draw`'s stroke (`--len`), and plays at once under a lab timeline (`[data-lab-timeline]`). |
| `motionScript()` | the inline script that arms the page: `data-motion="on"` on `<html>` before the first paint, unless the reader prefers reduced motion. |

Adding the layer: render `motionScript()` as an inline script near the top of
`<body>` (`<html>` keeps `suppressHydrationWarning`), and keep the layer's block
at the end of `motion.css` — the armed start states, the keyframes played with
fill `backwards`, the loops under `[data-play][data-visible]`, the guard that
puts everything at rest under `prefers-reduced-motion`, and the tokens. The
tokens are plain `:root` custom properties there — the curves `--ease-enter`,
`--ease-move`, `--ease-pop`, the durations `--motion-fast`, `--motion-base`,
`--motion-slow`, the distance `--motion-travel` and the step
`--motion-stagger` — not `@theme` tokens, which would bring back the `ease-*`
utilities the wireframe removes; the package carries no timing of its own. The
rules that come with it:

- a root plays once, when it first enters the viewport — never on a hover or a
  second scroll; loops run only on screen;
- nothing is hidden unless armed: without scripts, under reduced motion and in
  the harness's static captures every part is at rest;
- the first screen's copy is a `Reveal` with `intro`;
- curves and durations are the tokens, never a number in a component;
- no transition or animation class in a section, and no `translate-*`,
  `rotate-*` or `scale-*` utility on an element a part moves (the keyframes
  set `transform`);
- a sequence longer than two seconds says so with `settle`.

`capture --motion` sees the parts play and records them in the inventory, and
`probe` lists an armed part whose root has not played among the pending
reveals.

## 8. Decisions that look odd — do not "fix" these

- **Every section box prints its type.** The tag in the corner is the section's
  `type` from its page file, and the `id` an anchor uses. It is the wireframe
  telling you which component drew the box.
- **A `group` wrapper doubles the inset.** The sections inside a
  `sections/Group` keep their own frames, so the dashed box sits outside them
  with a visible gap. That is how a reader sees which sections it holds.
- **Both `faq` variants draw the same box**, and the section prints
  `variant: about` or `variant: contact` under its title block. The field is
  real content a fork's design will use; the wireframe has no two ways to draw
  a list.
- **The landing page's nav links are anchors.** `Use cases` is
  `/#use-case-cards` and `Contact` is `/#contact-form`, because a section's id
  is its type and the landing page carries both sections. Only an exact path
  match marks a link `aria-current="page"`, so an anchor never does.
- **Every link is underlined** and inherits its colour (`base.css`:
  `a { color: inherit; text-decoration: underline; }`). A wireframe has one
  accent and it is the underline; buttons and cards that are links opt out with
  `no-underline`.
- **The same placeholder picture appears everywhere.** One grey crossed field is
  the point: it says "a picture goes here", not "this picture".
- **The theme button reads `Theme: system`.** Three states — the reader's system
  setting (no attribute at all), then light, then dark, then back. The attribute
  *is* the state, so the server renders `system`, the first client render agrees
  with it, and the label is never wrong for a frame.
- **`/sections/*` are in the footer, not the nav.** They are agentic-cms showing its
  section types to whoever forks it, not pages a visitor is being sent to.

A design change is its own commit and says so in the message; it is never folded
into a refactor.

## 9. Pages

A page is a file, `content/pages/<slug>.yaml`: its `seo` block, the copy of its
structured data (`jsonld`), and its sections in order (`type` plus that type's
copy), rendered by `src/app/[[...slug]]/page.tsx` through the registry in
`src/components/sections/render.tsx`. Twenty-five section types exist
(`src/components/sections/schemas.ts`); the landing page uses nine of them and
the four `/sections/*` demos show the rest, with slot copy that says what each
field holds.

| Route | File | Sections |
|---|---|---|
| `/` | `pages/home.yaml` | `home-hero`, `home-feature`, `home-service`, `home-about`, `use-case-cards`, `reviews`, `faq`, `contact-form`, `contact-details` |
| `/sections/home` | `pages/sections-home.yaml` | `home-hero`, `home-automation`, `home-choose-us`, `home-integration` |
| `/sections/about` | `pages/sections-about.yaml` | `about-hero`, `about-story`, `about-strategy`, `about-benefits`, `about-choose-us`, `faq` |
| `/sections/use-cases` | `pages/sections-use-cases.yaml` | `use-cases-hero`, `group` (`use-cases-vision`, `use-cases-choose-us`), `group` (`use-case-cards`, `use-cases-benefits`), `use-cases-strategy` |
| `/sections/contact` | `pages/sections-contact.yaml` | `contact-hero`, `contact-form`, `contact-details`, `faq` |
| `/blog` | `pages/blog.yaml` | `blog-index` → the hero plus the card grid (`blog-index`, `blog-index-list`) |
| `/blog-post/<slug>` | `content/blog/<slug>.md` | `post-hero`, `post-body`, `post-related`, `post-author` — the route file's own boxes, not registry types |
| `/404` | — | `not-found` (`src/app/not-found.tsx`) |

Public URLs are indexed: never change one without a redirect.

**Building a new page.** Copy `content/_templates/page.yaml` to
`content/pages/<slug>.yaml` and fill in the `seo` block (`path` is the route;
`title`, `description`, `ogImage`, `updated`, `breadcrumb`, `changeFrequency`,
`priority`), the `jsonld` block for its page type, and its sections. A page made
of existing section types needs no code at all. Its OG image is
`pnpm kit placeholder public/images/<slug>-og.jpg 1200 630` until a real
one exists. Put it in `links`, `nav` and `footer.quickLinks` in
`src/config/site.ts` if it belongs there — three separate lists; the sitemap
entry and the breadcrumb follow from the page file. A **new section type** is
three things: a copy schema in `schemas.ts` (copy only, every field
`.describe()`d), a component in `src/components/<page>/` built as in §6 inside
`ui/Section`, and a registry entry in `render.tsx` — `plain()`, or `withData()`
when the section shows a collection. Verify with `pnpm lint`, `pnpm test`,
`pnpm content:lint`, `pnpm build` (the content lint runs first, the SEO audit
last) and `pnpm preview`.

**Changing an existing page.** A refactor moves no pixels and proves it:

```bash
pnpm kit visual-parity capture before
pnpm kit visual-parity capture before-dark --scheme dark
# …make the change, pnpm build…
pnpm kit visual-parity capture after && pnpm kit visual-parity compare before after
```

A capture renders every prerendered page of the current build at eight widths
(1920, 1440, 1280, 1100, 992, 800, 767, 390) plus the open menu at 767 and 390.
`--scheme dark` renders the dark mode (a fresh browser context has no stored
choice, so the default capture is the light one); `--motion` is for when the
`ix/` library is in use (§7); `--states` for when hover, focus, checked or open
change; `--pages /,/blog` limits a capture and its compare to the pages a step
touches. Every `compare` must come back clean, and each proven state is
committed before the next change starts. A refactor that also leaves the markup
alone proves that with `agentic-cms parity` (prerendered HTML plus JSON-LD,
`diff -r`).

**What the SEO audit checks.** `agentic-cms seo` runs at the end of
`pnpm build` and fails it on a structural problem, so `preview` and `deploy`
cannot skip it: per prerendered page, exactly one non-empty unique `<title>` (at
most 70 characters) and one meta description (50–200), one canonical that is
`site.url` plus the route with no trailing slash, the five Open Graph tags with
an image that exists under `public/`, is at least 1200 px wide and has a 1.6–2.0
ratio, a Twitter card, exactly one `<h1>` and no `<h3>` before the first `<h2>`,
`alt` and `width`/`height` on every `<img>`, `lang` on `<html>`, JSON-LD that
parses with `@context` and absolute URLs (a `BreadcrumbList` on every inner
page, a complete `BlogPosting` on every post), `noindex` on the 404 and nowhere
else, a sitemap that lists every indexable route once with a valid `lastmod` and
is named by `robots.txt`, and no internal link that matches no page and no file
in `public/`. The contract it enforces is `src/lib/seo/README.md`; never
hand-write head tags.

## 10. Content and configuration

- **Brand data, URLs, navigation, footer**: `src/config/site.ts` — the name, the
  tagline, the address, the e-mail, the logo, `links`, `nav`, `signIn`, `cta`,
  `footer`. Every page is served by this app, so entries stay relative.
- **Pages, with their metadata, structured data and copy**:
  `content/pages/<slug>.yaml` (the SEO contract, `src/lib/seo/README.md`; the
  section types and their fields, `src/lib/content/README.md`).
- **Forms**: definitions in `src/config/forms.ts`, rendered by `<Form>`; the
  engine, the field types, the backends and the endpoint's server half are
  `src/lib/forms/README.md`; where endpoint forms deliver is
  `src/config/form-delivery.ts`, read from the environment
  ([docs/forms.md](docs/forms.md)).
- **Content**: files under `content/`, one collection each, read and validated
  at build time by the content engine (`src/lib/content/README.md`; the door for
  editing is `content/README.md`, the templates are `content/_templates/`):
  posts in `content/blog/` (the filename is the slug; the pipeline and the body
  conventions are `src/lib/blog/README.md`), the registries
  `content/authors.json` and `content/categories.json`, the reviews in
  `content/reviews.yaml`, the FAQ sets in `content/faqs/<key>.yaml`, the
  use-case cards in `content/use-cases.yaml`. Post body conventions are
  load-bearing: a `## Frequently asked questions` heading with `###` questions
  becomes the accordion and the FAQPage structured data, a `> blockquote`
  becomes the pull-quote box, an image alone in a paragraph becomes the inline
  image block.
- A section that shows a collection keeps its presentation in code, keyed by
  position; the collection carries only copy.
- The voice and claim rules are `content/VOICE.md`, enforced by
  `agentic-cms lint` at the start of `pnpm build`; the procedures for
  content jobs are the `editorial` plugin in `plugin/`.
- Everything is read at build time. Nothing reads the filesystem at request
  time — the Worker has none.
