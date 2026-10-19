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

The engines hold, and the library holds, only while nothing goes around
them, and the lint says so. `componentRules(options)` from
`agentic-cms/eslint` returns flat ESLint configs; spread them after
`eslint-config-next`, which registers the `react` plugin two of the rules
come from:

```js
import { componentRules } from "agentic-cms/eslint";

export default defineConfig([...nextVitals, ...nextTs, ...componentRules({ sections: ["sections"] })]);
```

### The engines, required across `src/`

Five rules of the preset's own ESLint plugin, `agentic-cms`, fail the lint
everywhere under `src/` (and the app folder): sections, patterns, `ui/`,
layouts, `not-found`, the design-round routes (`*-demo`) and the lab's
`lab-demo` alike. Test files and `ignores` are left out. Each message
names the engine to use and its doc.

- **`agentic-cms/copy`:** every word a reader sees comes from `content/`
  or the chrome in `src/config/site.ts`, through props. Copy is text with a
  letter or a digit in it, wherever a reader sees it:
  - JSX text, and a string in `{…}` among the children: written straight,
    in a template, in a condition or a fallback;
  - the string of a copy prop on any element: `children`, `title`, `alt`,
    `aria-label`, `aria-description`, `aria-roledescription`,
    `aria-valuetext`, `aria-placeholder`, `placeholder`, `label`,
    `heading`, `eyebrow`, `text`, `body`, `description`, `caption`,
    `subtitle`, `summary`, `quote`; a field of that name in data (an array
    at the top of the file, an inline object) and a prop's default too;
  - any other prop of a component whose string reads as words: a space, a
    capital or a letter outside ASCII in it (`note="Since 2019"`). A token
    reads as no words (`variant="primary"`, `ratio="aspect-video"`,
    `icon="arrow-right"`) and passes;
  - on a native element, `value` when it reads as words, and HTML handed
    to `dangerouslySetInnerHTML` outside a `<script>` or a `<style>`.

  The props the rule skips, whatever their strings read like: `className`,
  `class`, `id`, `key`, `ref`, `style`, `href`, `src`, `srcSet`, `sizes`,
  `media`, `type`, `role`, `rel`, `target`, `as`, `lang`, `dir`, `name`,
  `htmlFor`, `form`, `method`, `action`, `accept`, `autoComplete`,
  `inputMode`, `enterKeyHint`, `pattern`, `loading`, `decoding`,
  `fetchPriority`, `crossOrigin`, `referrerPolicy`, `integrity`, `nonce`,
  `width`, `height`, `dateTime`, `tabIndex`, `slot`, an icon's `d`,
  `viewBox`, `points`, `transform`, `preserveAspectRatio`, `fill` and
  `stroke`; by their shape, `data-*`, the `aria-*` attributes that are not
  copy (ids, states), event handlers (`on…`), and a name ending in
  `ClassName`, `Id`, `Href`, `Src`, `Url` or `As` (`headingClassName`,
  `ctaHref`, `headingAs`); and `copy.skip`, a site's own.

  What passes: a symbol (`→`, `·`), which has no letter; the text and the
  props of an `aria-hidden` element and everything under it; the props
  and children of a primitive that draws them `aria-hidden`, and what its
  own definition draws (`copy.decorations`: `Placeholder`, `TypeTag`); the
  props of the design tools' components (`copy.tools`: those imported from
  `agentic-cms/lab`, whose labels name a block for review and never ship),
  though what they wrap is still read. The message says where the copy
  goes from where it was found: a section's page file and schema, a
  primitive's props or the chrome, a route's page file, a round's page
  file. A design round's route reads the page's copy from its file, as
  `demo new --section` writes it, and a showcase from a content file; the
  chip that names a candidate is `aria-hidden`.
- **`agentic-cms/head`:** no `<head>`, `<title>` (an svg's is its name, and
  passes), `<meta>`, canonical `<link>`, `application/ld+json` `<script>`
  or `next/head` of the site's own. A route's `metadata`, and every return
  of its `generateMetadata`, is a `kit.seo` helper: a call of `seo.…` or
  `….seo.…`, of a helper imported from `agentic-cms/seo` or destructured
  from `kit.seo`, directly or through a const, behind a condition, `await`,
  `as` or `satisfies` — or `{}`, the page that is not there. The helpers
  are `rootMetadata()` (the root layout), `pageMetadata()`,
  `postMetadata()` and `unlistedMetadata()` (a design round's or the lab's
  route); structured data is `<JsonLd>` (`src/lib/seo/README.md`).
- **`agentic-cms/forms`:** a `<form>` only in the files `owners.forms`
  names; no server action (`"use server"`) anywhere; no `fetch()` of
  another origin (`https://`, `//`) in a component, `.jsx` or `.tsx` — a
  build-time script elsewhere may (`docs/forms.md`).
- **`agentic-cms/tags`:** `next/script`, and a `<script src>` of another
  origin (or one the lint cannot read), only in the consent adapter
  `owners.tags` names; an inline `<script>` and a file of the site's own
  (`src="/…"`) pass (`docs/consent.md`).
- **`agentic-cms/email`:** no `mailto:` in a string or a template:
  `<EmailLink token={encodeEmail(address)} />` from `agentic-cms/components`
  and `agentic-cms/email` (`docs/email.md`).

**Owners.** A file that owns an engine's raw element is named, with the
reason it does, in `owners` in `src/config/components.json`; the same
files go to `componentRules()` (a list of globs, or the same map). The
preset turns that part's rule off in those files alone:

```json
"owners": {
  "forms": { "src/components/ui/form/Form.tsx": "the form engine's renderer: the one <form>, posting each definition of src/config/forms.ts through its backend" },
  "tags": { "src/components/ui/AnalyticsTag.tsx": "the consent adapter of the site's analytics: next/script, after a grant" }
}
```

**An inline disable carries its reason.** A real need the engines do not
meet yet is `// eslint-disable-next-line agentic-cms/copy -- <the reason>`
(or a block comment, or `eslint-disable` for a file): `check-components`
fails a disable of a required rule, or of every rule, with no description
after `--`, and lists every other one with its reason. A disable of any
other rule with no description is a warning, which fails nothing and stays
in the report until it says why. A workaround is fine; a silent one is not.

### The rest, guided across `src/`

Everything that is not an engine is the kit's preferred way, never the
only one: a site may animate with a library of its own, draw on a canvas,
ship a picture through `next/image` or paste an `<svg>`. Five more rules
of the same plugin warn about each across `src/` (and the app folder; test
files and `ignores` left out), naming the kit's part and its doc, and the
lint and the build pass. A site keeps its own choice with one line of
reason, and the warning goes quiet; a warning without one stays in the
lint's output, where the review sees it.

- **`agentic-cms/motion`,** outside the motion layer (a motion folder owns
  its library; `owners.motion` names a file of the site's that owns
  motion):
  - an animation library other than `agentic-cms/ix`: `gsap`,
    `react-spring` and `@react-spring/*`, `animejs`, `lottie-web`,
    `lottie-react`, `@lottiefiles/*`, `popmotion`, `velocity-animate`,
    `@formkit/auto-animate`, `react-transition-group`, `@motionone/*`,
    `@theatre/*`, `@mojs/core`, `aos`, `scrollreveal` (the preset's
    `ANIMATION_ALTERNATIVES`; `motion` and `framer-motion` fail outside
    the motion layer already);
  - a `requestAnimationFrame` call, an `IntersectionObserver`,
    `el.animate()`;
  - a transition or animation class (`transition…`, `animate-…`,
    `duration-…`, `delay-…`, `ease-…`; `transition-none` and `animate-none`
    rest) in a `className`, a `cx()` or a `variants()` call, and a
    transition or animation in a `style` (`none` rests).

  The guard's `transitions` pass warns about one declared in CSS outside
  the motion layer and `src/styles/motion.css`.
- **`agentic-cms/graphics`:** a library that draws in the reader's browser
  — `three`, `@react-three/*`, `d3` and `d3-*`, `pixi.js`, `@pixi/*`, `p5`,
  `react-p5`, `babylonjs`, `@babylonjs/*`, `konva`, `react-konva`,
  `fabric`, `paper`, `two.js`, `ogl`, `regl`, `chart.js`, `echarts`,
  `plotly.js`, `@antv/*` (the preset's `RENDERING_LIBRARIES`) — a
  `<canvas>`, or a canvas made in code. Graphics ship pre-rendered from
  the lab ([lab.md](lab.md)).
- **`agentic-cms/images`:** `next/image` (a static host has no image
  service), and an eager `<img>` in a server component — no `loading`, or
  one that can be other than `"lazy"` — which becomes a preload hint every
  page that prefetches a link to it downloads: `EagerImage` above the
  fold, `Media` (lazy) below it. A client component's `<img>`, a `loading`
  the lint cannot read and a spread that may carry one pass;
  `owners.images` names the picture primitive.
- **`agentic-cms/icons`:** an `<svg>` of the site's own, outside `Icon`
  ([icons.md](icons.md)); `owners.icons` names a site's own icon
  component.
- **`agentic-cms/styling`,** outside the sections and the patterns, which
  fail these already: an arbitrary value or property in a class
  (`bg-[#…]`, `rounded-[…]`, `shadow-[…]`, `w-(--…)`, `[mask-type:…]`), an
  arbitrary breakpoint (`min-[…]:`, `max-[…]:`, `@[…]:`), and a colour
  outside the tokens in a `style` (a hex, a colour function, a named
  colour on a colour property; `var(--…)` is a token). A state variant
  (`has-[…]:`, `data-[…]:`, `[&_p]:`) selects rather than sets a value, and
  passes.

In a section or a pattern, whose composition already fails a raw
`<svg>`, a raw `<img>` and a motion class, the warning stands beside the
error; the error is the one to fix.

**A site keeps its own with its reason.** `allow` in
`src/config/components.json` keeps a preferred rule's warning quiet in the
files it names (globs), and nowhere else:

```json
"allow": [
  { "rule": "agentic-cms/icons", "files": ["src/components/ui/Placeholder.tsx"], "reason": "the wireframe's crossed box: two lines stretched to any ratio, which no icon draws" }
]
```

`componentRules()` takes the same list; the example's `eslint.config.mjs`
reads it from the config, so each reason is written once. An entry names a
preferred rule, files that are there and its reason: the guard's `allow`
pass fails one that does not, and `componentRules()` refuses one with no
reason. A required rule is never allowed (its owner, or an inline disable
with its reason). For one line, an inline disable with its description:
`// eslint-disable-next-line agentic-cms/icons -- <the reason>`. A file
that owns a part (the picture primitive its `<img>`, a site's own `Icon`
its `<svg>`, a file of its motion) is named in `owners.images`,
`owners.icons` or `owners.motion` with its reason, like an engine's owner.

The example keeps two choices of its own, both in `allow`: `Placeholder`'s
crossed box, an `<svg>` (`agentic-cms/icons`), and the form's honeypot,
placed far off-screen by an arbitrary offset (`agentic-cms/styling`); and
`Media` owns its `<img>`. A new site starts with the same, so its lint
prints no warning.

### The library's shape

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
| `app` | `"src/app"` | the routes' folder: a round's routes are its `*-demo` folders |
| `elements` | the primitives above | `{ element: message }` over the defaults; `false` allows an element |
| `copy` | `{ props: [the copy props above], skip: [], decorations: ["Placeholder", "TypeTag"], tools: ["agentic-cms/lab"] }` | the props whose strings are copy (replacing the list); the site's own props whose strings never are (added to the rule's); the primitives that draw their props and children `aria-hidden`; the design tools' modules. Required: `false` throws |
| `owners` | `{}` | `{ forms, tags, images, icons, motion }`: the files that own a `<form>`, a tag, an eager `<img>`, an `<svg>` or motion, as `{ "<file>": "<reason>" }` or a list of globs |
| `allow` | `[]` | a list of `{ rule, files, reason }`: a preferred rule a site keeps its own choice of, in those files, with its reason; a required rule, an unknown one or an entry with no reason throws |
| `restrictedImports` | `{ paths: [], patterns: [] }` | the site's own restricted imports, in `no-restricted-imports`' object form (each path or pattern with its `message`), added to the kit's in every file the preset covers |
| `ignores` | `[]` | globs left out of every rule |
| `src`, `alias` | `"src"`, `"@/"` | the tree the animation ban and the engines cover, and the tsconfig alias for it |

**Extend the preset through its options, never a block that sets one of
its rules again.** Flat config keeps one setting of a rule per file, the
last block's: a block of the site's after `...componentRules()` that sets
`no-restricted-imports` on the component folders replaces the preset's
setting there, and those files lose the layers' and the animation bans
without a warning. The same holds for `react/forbid-elements` and
`no-restricted-syntax` in a section or a pattern file (the second has no
option to extend it yet), and for every `agentic-cms/*` rule — which
`check-components` catches: it reads the setting ESLint resolves for one
sample file per layer (each section folder, a route, a round's route,
`src/lib`, each owner's file) and fails a required rule that is off, a
warning, unset, ignored, or set with other options than `componentRules()`
makes of `src/config/components.json`; a preferred rule set otherwise (a
block that turns its warning off, an `allow` the config does not name) is
a warning. So `eslint.config.mjs` passes the config's layers, `copy`,
`owners`, `allow` and `ignores` alike. A restriction of
the site's own on imports goes into `restrictedImports`, a forbidden
element into `elements`:

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

The example's `eslint.config.mjs` passes `motion: null`, `patterns: null`,
its six section folders (the page folders with `sections/` and `blog/`),
the form engine's renderer as the owner of `forms` and the picture
primitive as the owner of `images`, the config's `allow`, and `ignores:
["src/lib/**"]`, the package's own source — a line `init` leaves out of a
site, whose `src/lib` is its own and linted. A rule a site cannot meet yet
is a new primitive or option, or an inline disable with its reason, never
a rule turned off in passing; loosening one is its own pull request, said
so in its title.

## Placed: `agentic-cms check-components`

ESLint judges what a file contains; the placement guard judges where files
are and what declares them, so a one-off component cannot hide in a page
folder or a route. It is the first pass of `agentic-cms check-site`
([§ The whole site](#the-whole-site-agentic-cms-check-site)), which `pnpm
lint` runs after ESLint, failing on either while both report;
`agentic-cms check-components` runs it alone:

```json
"lint": "eslint; s=$?; agentic-cms check-site || s=1; exit $s"
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
  the motion layer and `src/styles/motion.css`**;
- **every owner and every `allow` entry has its reason** and names files
  that are there; an `allow` entry names a preferred rule (one of
  `agentic-cms/site-tools` names the site's own tools outside `src/`, whose
  files the site check looks for).

What the preferred tier guides is a warning, printed after the report: it
fails nothing, and stays until it has its reason. The guard warns about a
transition or animation declared in CSS outside the motion layer and
`src/styles/motion.css` (`transitions`; an `allow` entry of
`agentic-cms/motion` keeps a file's), an inline disable of any other rule
with no description (`disables`), and a preferred rule ESLint resolves
otherwise than the config makes it (`preset`).

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
| `owners`, `allow` | `{}`, `[]` | as in `componentRules()`: the files that own a part, and the preferred rules a file keeps its own choice of, each with its reason |

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

## The whole site: `agentic-cms check-site`

The placement guard holds `src/`; the site check holds the rest of what
makes a site the kit's: its design rounds, its exceptions, its gates and
its tools. `pnpm lint` runs it after ESLint (above), so `pnpm build`, which
runs `pnpm lint` first, and CI run it too. It runs every pass of
`check-components` first, from the same `src/config/components.json`, then
its own:

- **`rounds`**: a `*-demo` route is one `demo new` wrote, its `demo.json`
  beside it, or the lab's own `lab-demo` (`lab route`'s). A route made by
  hand fails: nothing knows its candidates, and its copy is its own. A
  round's pictures, `public/images/<name>-demo/`, are there only while its
  route is; `demo clean` takes both.
- **`exceptions`**: every exception added since the merge base is listed
  with its reason — a route exception, an owner, an `allow` entry, an
  `ignores` glob and an inline disable (matched by its rules and its reason,
  so a moved one is not new). An `ignores` glob takes its reason from the
  `$ignores` comment beside it, and an added one without it fails. The
  frozen `inherited` list only shrinks: a file added since the base fails.
  The base is git's merge base of HEAD with `--base`, else the pull
  request's base branch (`GITHUB_BASE_REF` in CI), else `origin/HEAD`,
  `origin/main` or `main`. A checkout without that history (no git, no
  commit yet, a shallow clone) compares nothing and says so in its report;
  `--base` there is exit 2. The site's `verify.yml` checks out with
  `fetch-depth: 0` for it.
- **`scripts`**: `package.json`'s `lint` runs ESLint, then `check-site`; its
  `build` runs `pnpm lint`, `agentic-cms lint --production` and
  `agentic-cms docs --check` before `next build`, `agentic-cms seo` after
  it. Each gate is a step of the build's `&&` chain, so a failing
  one stops it; one joined by `;`, a failure turned into a pass (`|| true`,
  `exit 0`) or a gate on the wrong side of `next build` fails. `init`
  writes these scripts and merges the gates into a site's own
  ([init.md § The gates](init.md#the-gates)).
- **`ci`**: a workflow that runs on pull requests runs the lint (or a build
  that runs it), the tests, the build and `agentic-cms init . --agent-files
  --check`, as `init`'s `.github/workflows/verify.yml` does.
- **`tools`**, the preferred tier's, so warnings that fail nothing: a script
  of the site's own under `scripts/` that drives Playwright (or another
  headless browser), runs `sharp` over `public/` or starts `next dev`, and a
  machine's address in `next.config.*`. Each names the kit's command —
  `shot`, `probe`, `sheet` and `visual-parity`; `placeholder` and the
  optimisers; `serve`; `urls --write`, which keeps the addresses in
  `.env.local` — and an `allow` entry quiets it, with its reason:

  ```json
  "allow": [
    { "rule": "agentic-cms/site-tools", "files": ["scripts/og-cards.mjs"], "reason": "renders the OG cards from the posts' titles, which no kit command composes" }
  ]
  ```

  An `agentic-cms/site-tools` entry that names no file the pass reads is a
  finding. In the kit's own repository, whose `scripts/` are the commands
  themselves, the pass reads nothing.

Each finding names its file, the pass and the fix; exit 1 on any, the
components pass's included, and 2 when the config is missing or does not
read or `--base` finds no history; `--json` prints the report, the
exceptions added under `added` ([commands.md](commands.md#check-site)).
