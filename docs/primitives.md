# Primitives for a new site

What a new site builds first, what it takes from the kit instead, and what
waits. The kit carries behaviour, never a look ([design.md § What stays out
of the kit](design.md#what-stays-out-of-the-kit)): its package exports no
styled element, and the example under `src/`, which `init` copies, is a
wireframe a site replaces. So the site's look lives in its own primitives,
in `src/components/ui/`, each catalogued in `src/components/README.md` in
the commit that adds it, and every section is composed from them.

## 1. Tokens first

They sit under every component; without them components drift into
hard-coded values. All of them live in the `@theme static` block of
`src/app/globals.css`, with per-breakpoint values in `src/styles/base.css`
(`STANDARD.md` §1).

- **Colours:** the brand colours, plus the role colours a component uses
  instead of a hue:
  - the page ground;
  - a panel face;
  - a hairline;
  - text on a coloured ground.

  A colour becomes a token at its second use.
- **Type scale:** h1 to h6 and body, each with its line-height and letter
  spacing, sized per breakpoint.
- **Spacing:** the section gaps, and the container widths.
- **Radius, shadow and glow:** every one a token, a static glow included,
  never a literal in a utility.
- **Easing and durations:** one table.
- **Breakpoints:** a fixed set, written into the styling rule.

The example's `@theme` block has the roles at wireframe values:
`--color-panel`, `--color-line`, `--color-on-ink`,
`--text-hN--letter-spacing`, `--tracking-label`, `--radius-panel`,
`--radius-control`, `--shadow-panel`, `--shadow-glow`. A site gives them its
values rather than naming roles of its own, and every component that asks
for a role follows.

## 2. Provided by the kit: don't build these

| What | Where |
|---|---|
| Motion: the play-once layer (`Reveal`, `RevealGroup`, `Sequence`, `part()`, `motionScript()`), the reveals that replay (`Fx`, `OnView`), `ease()`, `useReducedMotionPref`, `useMainBreakpoint`, `InlineAnimation` | `agentic-cms/ix` (`STANDARD.md` §7, [lab.md § Inline](lab.md#inline--a-loop-the-page-runs)); the CSS block and its tokens are the site's `src/styles/motion.css` |
| Above-the-fold images in server components: `EagerImage` | `agentic-cms/components` (`STANDARD.md` §4) |
| Structured data: `JsonLd` | `agentic-cms/components` |
| A primitive's looks as one typed map: `variants()`, `VariantProps` | `agentic-cms/cx`, beside `cx` (the components catalogue) |
| Behaviour without a look: `FaqAccordion`, `EmailLink` with its token, `Icon` with the generated icon map | `agentic-cms/components` ([email.md](email.md), [icons.md](icons.md)) |
| The consent store and its hooks | `agentic-cms/consent` ([consent.md](consent.md)) |
| The form engine: the backend, the field types, the endpoint | `agentic-cms/forms` ([forms.md](forms.md)); the site draws the fields |

## 3. Build on day one: the site's look

The third column is what the kit's example already has, at wireframe
values, for a site to restyle rather than write again.

| Group | Primitives | In the example |
|---|---|---|
| Layout | `Container` (a card's content stays each section's own design; its frame is the `Panel`) | `ui/Container` |
| Type | `Heading` (its level separate from its look, with an entrance prop), `Eyebrow`, `MetaLine` / `metaLabel` (small uppercase metadata), `TextLink`, a `keepWords` helper for hyphenated words (U+2011, so they never break) | `ui/Heading` (its level, a `size`, an `entrance` through `Reveal`), `ui/Eyebrow`, `ui/MetaLine` / `metaLabel`, `ui/TextLink`, `keepWords` in `ui/text.ts` |
| Actions | `Button` (a link: the call to action, in variants), `OutlineButton` (a choice on the page, never a call to action), `IconButton` (a round icon button with a required label) | `ui/Button` (a link, `solid` or `outline`, on `variants()`), `ui/OutlineButton`, `ui/IconButton` (a 44 px square at wireframe values) |
| Surfaces | one `Panel` with variants (solid, and the looks the site's direction adds) and a shared tile-frame class | `ui/Panel` (`solid`, `dashed`) and `panel()`: `ui/Section` draws its box with it, `sections/Group` its dashed one, and every section its cards' frames |
| Icons | `NavIcon` (line icons for navigation), `ContentIcon` (the site's own marks beside copy), `BrandIcon` (other companies' logos), `SocialLinks` | `Icon` from the package, its families from `icons add` ([icons.md](icons.md)) |
| Chrome | `Navbar` with its mobile menu (one navigation landmark per menu), `Footer`, `PageHero` (the plain page header for legal pages and the 404), `PostalAddress` | `ui/Navbar`, `ui/NavLink`, `ui/Footer`, `ui/ThemeToggle` |
| Consent, if there is analytics | `ConsentBanner`, `CookieSettingsButton` | both, in `ui/` |
| Forms | `TextField`, `TextArea`, `Select` (drawn: the native list looks off), `Checkbox`, `CheckboxGroup` / `RadioGroup` through one `Choice`, `FieldWrap` / `FieldRow` / `Hint` / `Marker`, `FieldGroup`, `FormNote`, `FormShell` (the success and error states), `SubmitButton` | all of them in `ui/form/`, plus `DateField` and `NumberField`; `Select` is the native list with a drawn chevron |
| Data | `DataTable` (it scrolls inside its own box, and is labelled), `FactTable` (label and value rows), an FAQ section on top of the kit's `FaqAccordion` | `ui/Faq` |
| Media and performance | `LazyBackdrop` (a CSS background picture below the fold waits until it is near the view), `PauseOffscreen` (stops a loop the compositor cannot run while it is off screen), a `<figure>` pattern with a phone `<source>` for charts ([lab.md](lab.md)) | `ui/Media` (`EagerImage` above the fold, a lazy `<img>` otherwise), `ui/Placeholder` for a picture not drawn yet |
| Motion | the `--ease-*` / `--motion-*` values in the layer's block of `motion.css`, a `heroIntro(step)` helper that steps the hero's `Reveal`s (`intro`, a delay per step) | the block at wireframe values, used by nothing: the wireframe has no motion (`STANDARD.md` §7) |

## 4. Add on the second use, not before

`ShowMore` (it paginates while every item stays in the HTML), `Dots`,
chips and badges, a meter, tabs, a carousel. Each appears because a second
section needed it: the library grows from picks, not from plans. "A card's
content is its section's own design, in a `Panel` frame" holds unless the
site names an exception, in the catalogue, with its reason.

## Rules every primitive follows

- **Extendable:** generic, through props, `className`, `style` and CSS
  variables, and added to the catalogue in the same commit.
- **Real elements:**
  - interactive pieces are real `<button>`s or links, with a visible focus
    ring and 44 px touch targets;
  - decorations are real `aria-hidden` elements, never pseudo-elements.
- **Motion:** it honours `prefers-reduced-motion`, and never widens the
  page ([gotchas.md § CSS, SVG and performance](gotchas.md#css-svg-and-performance)).
- **Values:** tokens only. A state the page has before its scripts run
  (pre-paint) keys on a `data-` or `aria-` attribute, never on a class,
  so the critical CSS keeps its rule ([deploy.md § Critical CSS](deploy.md#critical-css)).

## Enforced: `agentic-cms/eslint`

The library holds only while nothing else draws UI, and the lint says so.
`componentRules(options)` from `agentic-cms/eslint` returns flat ESLint
configs; spread them after `eslint-config-next`, which registers the
`react` plugin two of the rules come from:

```js
import { componentRules } from "agentic-cms/eslint";

export default defineConfig([...nextVitals, ...nextTs, ...componentRules({ sections: ["sections"] })]);
```

- **The layers import one way:** motion ← `ui/` ← `patterns/` ← the
  sections. A primitive imports no pattern and no section, a pattern no
  section, the motion layer none of them. Only the motion layer imports
  `motion`, `framer-motion` or `agentic-cms/ix`; with no motion folder
  (`motion: null`) `agentic-cms/ix` is the motion layer, and the two
  libraries stay out of `src` altogether.
- **A section or a pattern composes:** one component per file; no raw
  `button`, `a`, `img`, `picture`, `video`, form field or `h1`–`h6` (and no
  `svg` in a section), each message naming the primitive to use; no `style`;
  no arbitrary value (`[…]`, `(…)`); no fill, border, radius, ring, outline,
  divider, shadow, transition or animation class, whether the class string
  is a `className` literal, a template literal or a `cx()` argument.

| Option | Default | What it is |
|---|---|---|
| `root` | `"src/components"` | where the layers' folders are |
| `motion`, `ui`, `patterns` | `"motion"`, `"ui"`, `"patterns"` | each layer's folder under `root`; `null` for a layer the site does not have |
| `sections` | `["sections"]` | the section folders under `root` |
| `registry` | `"sections/render.tsx"` | the section registry under `root`, left out of the section rules: it imports every section |
| `elements` | the primitives above | `{ element: message }` over the defaults; `false` allows an element |
| `ignores` | `[]` | globs left out of every rule |
| `src`, `alias` | `"src"`, `"@/"` | the tree the animation ban covers, and the tsconfig alias for it |

The example's `eslint.config.mjs` passes `motion: null`, `patterns: null`
and its six section folders, the page folders with `sections/` and
`blog/`. A rule a site cannot meet yet is a new primitive or option, never
a rule turned off in passing; loosening one is its own pull request, said
so in its title.
