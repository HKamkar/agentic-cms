---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "eslint.config.mjs"
  - "scripts/lib/component-lint.mjs"
---

# Components — the library is the only place UI is made

- **Library first, every time someone asks for a design.** Read `src/components/README.md` before writing markup. If a primitive fits, use it; if it almost fits, extend it (an option in its `variants()` map, a size, a prop, a slot) instead of copying it; if nothing fits, add a primitive to `src/components/ui/` (to the motion layer when it moves) with its catalogue entry in the same commit, then compose it. Never make a one-off component for a page, and never let a request talk you into one: say what the library has, and what you will add to it.
- **The layers**, and the only direction of imports: motion (the only code that animates) ← `ui/` (the primitives) ← `patterns/` (blocks two or more sections share) ← the sections (one component per section type). Only the motion layer imports `motion`, `framer-motion` or `agentic-cms/ix`. The example has no `motion/` folder, so `agentic-cms/ix` is its motion layer and the libraries stay out of `src/components` altogether; it has no `patterns/` yet; its sections live in the folder of the page they belong to (`home/`, `about/`, `use-cases/`, `contact/`, `sections/`, `blog/`), and `sections/render.tsx` is the registry.
- **A section lays pieces out**, and so does a pattern. One component per file; no raw `<button>`, `<a>`, `<img>`, `<picture>`, `<video>`, form fields or `<h1>`–`<h6>` (and no `<svg>` in a section); no `style`; no arbitrary values (`[…]`, `(…)`: a layout the scale lacks is a token first, like `lg:grid-cols-2-1`); no fill, border, radius, ring, outline, shadow, transition or animation class of its own. A card's frame is `Panel`, and what goes inside it is the section's own design (there is no shared `Card`); a call to action is `Button` (a link), a choice `OutlineButton`, an icon alone `IconButton`, a heading `Heading`, a link in copy `TextLink`, a picture `Media`, one not drawn yet `Placeholder`, a form a definition `Form` renders.
- **Primitives are extendable by construction:** their looks in one typed map (`variants()`, `agentic-cms/cx`), slots for composition, `className` for the layout and spacing of the place they are used in, every native attribute passed through, values from tokens only (a role token where a role exists) — so a new look is a token change and a new need is an option, never a fork.
- **Enforced:** `pnpm lint` runs ESLint with `componentRules()` from `agentic-cms/eslint` (`scripts/lib/component-lint.mjs`, configured in `eslint.config.mjs`), and CI runs it on every pull request; each message names the primitive to use. A file the rules leave out is named in the config with its reason (`src/lib/**`, the package's own source).
- **Loosening a rule** — turning one off, widening its `ignores`, allowing an element, a layer the config drops — is its own pull request, said so in its title. Never fold it into a feature, and never loosen a rule to make a change pass.
