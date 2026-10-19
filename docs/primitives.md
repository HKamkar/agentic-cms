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

The kit's behaviour without a look is on [parts.md](parts.md), one row per
need with its import, its doc, its tier and the check that holds it: motion
(`agentic-cms/ix`), an image above the fold, structured data, a
primitive's looks as one typed map (`agentic-cms/cx`), the FAQ accordion,
an e-mail address, an icon, the consent store and the form engine. A site
builds none of them; it takes the kit's part and draws around it (a form's
fields, the consent banner).

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
- **A section or a pattern holds no copy:** no JSX text with a letter or a
  digit in it, and no such string in a copy-bearing prop (`title`, `alt`,
  `aria-label`, `placeholder`, `label`, `children`), written straight, as
  `{…}`, in a template or a fallback, or as a field of that name in a data
  array. The copy goes in the page's file, `content/pages/<slug>.yaml`, as
  a field of the section's schema, and arrives as a prop. A symbol (`→`,
  `·`) passes, and so does a decoration: the text of an `aria-hidden`
  element, and the props and children of a primitive that draws them
  `aria-hidden` (`Placeholder`, `TypeTag`).

| Option | Default | What it is |
|---|---|---|
| `root` | `"src/components"` | where the layers' folders are |
| `motion`, `ui`, `patterns` | `"motion"`, `"ui"`, `"patterns"` | each layer's folder under `root`; `null` for a layer the site does not have |
| `sections` | `["sections"]` | the section folders under `root` |
| `registry` | `"sections/render.tsx"` | the section registry under `root`, left out of the section rules: it imports every section |
| `elements` | the primitives above | `{ element: message }` over the defaults; `false` allows an element |
| `copy` | `{ props: [the six above], decorations: ["Placeholder", "TypeTag"] }` | the props whose strings are copy, and the primitives that draw their props and children `aria-hidden`; `false` turns the copy rule off |
| `restrictedImports` | `{ paths: [], patterns: [] }` | the site's own restricted imports, in `no-restricted-imports`' object form (each path or pattern with its `message`), added to the kit's in every file the preset covers |
| `ignores` | `[]` | globs left out of every rule |
| `src`, `alias` | `"src"`, `"@/"` | the tree the animation ban covers, and the tsconfig alias for it |

**Extend the preset through its options, never a block that sets one of
its rules again.** Flat config keeps one setting of a rule per file, the
last block's: a block of the site's after `...componentRules()` that sets
`no-restricted-imports` on the component folders replaces the preset's
setting there, and those files lose the layers' and the animation bans
without a warning. The same holds for `react/forbid-elements` and
`no-restricted-syntax` in a section or a pattern file (the second has no
option to extend it yet). A restriction of the site's own on imports goes
into `restrictedImports`, a forbidden element into `elements`:

```js
...componentRules({
  sections: ["sections"],
  restrictedImports: {
    paths: [{ name: "<package>", message: "<what to use instead>" }],
    patterns: [{ group: ["@/lib/<folder>", "@/lib/<folder>/**"], message: "<why not here>" }],
  },
}),
```

Its restrictions hold wherever the kit's do, every file under `src` but
`ignores`; a block of your own is still right for files the preset leaves
alone (outside `src`, or in `ignores`).

The example's `eslint.config.mjs` passes `motion: null`, `patterns: null`
and its six section folders, the page folders with `sections/` and
`blog/`. A rule a site cannot meet yet is a new primitive or option, never
a rule turned off in passing; loosening one is its own pull request, said
so in its title.

## Placed: `agentic-cms check-components`

ESLint judges what a file contains; the placement guard judges where files
are and what declares them, so a one-off component cannot hide in a page
folder or a route. `pnpm lint` runs both and fails on either, while both
report:

```json
"lint": "eslint; s=$?; agentic-cms check-components || s=1; exit $s"
```

It checks that:

- **the layers exist** (a layer the config sets to `null` is one the site
  does not have), and every file under `src/components` sits in one, or is
  the catalogue;
- **the catalogue names every component** the motion layer, `ui/` and
  `patterns/` export, in backticks (`` `Faq` ``, `` `ui/Faq.tsx` `` or
  `` `<Faq …/>` ``). A component is a PascalCase name with a lowercase
  letter, so an ALL_CAPS constant (`BUTTON_SIZES`) is none, and a type is
  none either;
- **every component in a section folder is a section** the registry
  (`sections/render.tsx`) imports, by the alias or relatively;
- **`src/app` holds route files only** (`page`, `layout`, `route`,
  `not-found`, `error`, the metadata files, `globals.css`), in the content
  engine's route folders (`routes`) and the named exceptions'
  (`exceptions`). `routes` holds the app folder and its catch-all; any
  other folder in it, and an exception with no reason, is a finding. A
  `*-demo` folder, a design round's or the lab's `lab-demo`, is an
  exception by its name: the SEO audit already keeps it out of a build;
- **no component (`.tsx`, `.jsx`) outside `src/components` and `src/app`**;
- **CSS modules only in `ui/` and the motion layer, `@keyframes` only in
  the motion layer and `src/styles/motion.css`**.

A running design round's candidates pass: the files its `demo.json` lists
under `created`, with their `module.css`, until `demo clean` takes them.
Each finding names its file, the check and the fix; exit 1 on any, 2 when
the config is missing or does not read ([commands.md](commands.md#check-components)).

The config is `src/config/components.json`. Its layer keys are
`componentRules()`'s options, with the same defaults, so the two tools
read the same folders; keep them alike. A key starting with `$` is a
comment.

| Key | Default | What it is |
|---|---|---|
| `root`, `motion`, `ui`, `patterns`, `sections`, `registry`, `ignores`, `src`, `alias` | as in `componentRules()` | the layers, the section folders, the registry, the globs left out of every check |
| `catalogue` | `"README.md"` | the catalogue, under `root` |
| `routes` | `["src/app", "src/app/[[...slug]]"]` | the content engine's route folders: the app folder, and the catch-all that renders `content/pages/` |
| `exceptions` | the example's three, with their reasons | `{ folder: reason }`: each route folder outside the content engine (the post template, the form endpoint, the feed) and why it stays there |
| `app` | `"src/app"` | the app folder |
| `motionCss` | `"src/styles/motion.css"` | the stylesheet that holds the motion layer's start states and keyframes |
| `inherited` | `[]` | files the guard leaves alone, frozen |

`inherited` is how a site adopts the guard without rewriting anything: it
lists every file that does not fit yet, and the list only shrinks. Nothing
joins it, a file leaves it when the library replaces it, and a listed file
that is gone is a finding until its line goes. The example's holds the
blog's post template, which the blog routes render rather than the
registry. Adding a route exception, an `inherited` file or an `ignores`
glob loosens the guard: its own pull request, said so in its title. A config
from before the exceptions, its route folders all under `routes`, still
reads: the kit's reasons cover the example's three, and a folder of the
site's own is a finding until it moves to `exceptions` with its reason.
