# The parts of the kit

Every need a site on the kit has, and the part that meets it, on one page:
how to use it (the import or the command, and its doc), its tier, the check
that holds it today and the key that names an exception. Before writing a
site's own version of something, find its row here: the kit most likely has
it.

**The tiers.**

- **Required: the engines.** Content: every word a reader sees comes from
  `content/` or from the chrome in `src/config/site.ts`. SEO: the head, the
  metadata and the structured data come through `kit.seo`. Forms: the form
  engine and its endpoint. Consent: a tag that needs consent loads through
  `agentic-cms/consent`. E-mail: an address on a page goes through the
  token and the guard. Going around one fails `pnpm lint` or `pnpm build`
  and names the part; a real need is a named exception with its reason.
- **Preferred: everything else**, the libraries and the tools. A site may
  use its own motion library, canvas, graphics tool or script; the kit names
  its own part, and the site keeps its choice with one line of reason.

The engines' rules (`agentic-cms/copy`, `head`, `forms`, `tags`, `email`)
fail `pnpm lint` across `src/`. The preferred tier's (`agentic-cms/motion`,
`graphics`, `images`, `icons`, `styling`) warn there and fail nothing; a
site keeps its own choice with its reason, an `allow` entry in
`src/config/components.json` or an inline disable with its description
([primitives.md § Enforced](primitives.md#the-rest-guided-across-src)).
Where nothing holds a part yet, its row names the 0.8.2 job that adds the
check ([roadmap-0.8.2.md](roadmap-0.8.2.md)): job 4 adds `check-site` and
the gates every build runs.

**The four layers**, a section each below:

| Layer | Ships | Parts |
|---|---|---|
| [The content engine](#the-content-engine) | the pages | `agentic-cms` (`createKit`), `agentic-cms/content`, the collections. On it: pages (`content/pages/`, the section registry), the post pipeline (`agentic-cms/blog`) and SEO (`agentic-cms/seo`). Beside it: forms (`agentic-cms/forms`, `agentic-cms/forms/server`) |
| [Browser libraries](#browser-libraries) | to the reader | `agentic-cms/ix`, `agentic-cms/components`, `agentic-cms/consent`, `agentic-cms/consent/google`, `agentic-cms/email`, `agentic-cms/cx` |
| [Design tools](#design-tools) | never | the lab (`agentic-cms/lab`), design rounds, the screenshot harness, icons, images, the design skills |
| [The site's commands](#the-sites-commands) | the build and the setup | `init`, `setup`, `urls`, `serve`, `status`; the gates every build runs and the steps a site adds; `agentic-cms/eslint`, `agentic-cms/loader`, `agentic-cms/package.json` |

The checks themselves (each rule of the ESLint preset, each pass of the
placement guard, each rule of the content lint, the build's steps) are in
[The checks](#the-checks), with what each holds and its exception key.

## The content engine

`content/` read as typed, validated collections at build time, composed once
in `src/kit.ts` with `createKit({ site, sections })` from `agentic-cms` and
read as `kit.collections`, `kit.content`, `kit.blog` and `kit.seo`. Pages,
the post pipeline and SEO are its layers; the form engine sits beside it.
Pages are prerendered: nothing reads `content/` at request time.

| Need | Part, and how to use it | Tier | Held by today | Exception key |
|---|---|---|---|---|
| Any word a reader sees | a field of a content file (a page's section, a post, a collection) or the chrome's text in `src/config/site.ts`, passed to the component as props — `content/README.md`, `.claude/rules/pages.md` | required | `agentic-cms/copy` across `src/`: sections, patterns, `ui/`, layouts, `not-found`, the design-round and lab routes | `copy` (its `props`, `skip`, `decorations` and `tools`); an inline disable with its reason |
| A collection, or a field on one | `defineCollection()`, `readCollection()` and the schema helpers (`text`, `optional`, `dateOnly`, `isoTimestamp`, `ref`) from `agentic-cms/content`; a site's own collections through `createKit({ collections })` — `src/lib/content/README.md` | required | `next build` reads every collection and fails on a wrong file, naming it; `agentic-cms check` (the schemas alone, in a second); `agentic-cms docs --check` (the field tables, in `pnpm build`) | — |
| A page | `content/pages/<slug>.yaml` from `content/_templates/page.yaml`, made of registered section types; `/editorial:new-page`; rendered by `src/app/[[...slug]]/page.tsx` through the registry — `.claude/rules/pages.md`, `STANDARD.md` §9 | required | the page schema in the build; the guard's `routes` pass; the content lint | `exceptions`: a route folder outside the engine, with its reason |
| A section type | its schema in `src/components/sections/schemas.ts`, its component in a section folder, its entry in the registry, `src/components/sections/render.tsx` — `STANDARD.md` §6, `src/components/README.md` § Page sections | required | the guard's `registry` pass; in the component, `react/no-multi-comp`, `react/forbid-elements`, `no-restricted-syntax` | `elements`; `sections` names the folders |
| A post | `content/blog/<slug>.md` from `content/blog/_template.md`; `/editorial:write-post`, `new-post`, `update-post`, `retire-content`; `createBlog()`, `renderPostBody()`, `extractFaq()`, `rehypePostBlocks`, `rehypePostImages` from `agentic-cms/blog`; the FAQ accordion is a `## Frequently asked questions` heading, its behaviour `FaqAccordion` from `agentic-cms/components` — `src/lib/blog/README.md` | required | the post schema in the build; the content lint's post rules (`faq-structure`, `heading-level`, `body-image`, `excerpt-words`, `keywords-count`, the dates) | — |
| The post page and the feed | the post template, `src/app/blog-post/[slug]/page.tsx`, and `src/app/feed.xml/route.ts`, from `kit.blog` and `kit.seo` — `src/lib/blog/README.md` | required | the guard's `routes` pass, through their named exceptions; the SEO audit on every post | `exceptions` (the example names both) |
| The voice and the claims | `content/VOICE.md`, whose fenced block is what the lint reads; `/editorial:review-voice`, `/editorial:critic` | required | the content lint's voice rules: `voice-banned`, `voice-pattern`, `voice-model`, `brand-mark`, `brand-case`, `em-dash` fail, `voice-claim` and `voice-cloud` warn | the block's own scopes, in `content/VOICE.md` |
| A picture a content file names | a file under `public/images/<page>/` (shared ones in `public/images/ui/`), named in the page file or the post; a post body's pictures get their size and `loading="lazy"` from `rehypePostImages` — `STANDARD.md` §4 | required | the content lint's `image-exists`, `image-weight`, `image-orphan`, `alt-pair`, `alt-weak`, `body-image` | — |
| Placeholder copy in a new site | the starter marks its copy `(placeholder)` and its address with a domain reserved for examples; `/editorial:new-page` writes the real copy and drops the marker; `agentic-cms init --name`, `--url` and `--email` set the name, origin and address from the start — [init.md § The starter](init.md#the-starter) | required | the content lint's `placeholder` (a warning; a failure with `lint --production`, the first step of `pnpm build`) and `example-brand` (a failure in a site at any time); `assemble` packages nothing while one remains; `demo new --section` names them first | `AGENTIC_CMS_PLACEHOLDERS=warn`, for a run that deploys nothing |
| A head tag: the title, the description, the canonical, Open Graph | the page file's `seo` block, through `kit.seo.pageMetadata()` in the route's `generateMetadata` (`pageMetadata` from `agentic-cms/seo`); a post's from its frontmatter (`postMetadata()`); the root layout's `kit.seo.rootMetadata()`; a design round's or the lab's route `unlistedMetadata()` — `src/lib/seo/README.md`, `.claude/rules/seo.md` | required | the SEO audit, `agentic-cms seo`, the last step of `pnpm build`; the content lint's `seo-title` and `seo-description` at the source; `agentic-cms/head` (a `metadata` or `generateMetadata` that is no `kit.seo` helper, a head element of the site's own) | an inline disable with its reason |
| Structured data | the page file's `jsonld` block, through `kit.seo.pageJsonLd()` and `pageBreadcrumb()`, rendered by `JsonLd` from `agentic-cms/components`; a post's from `kit.seo` — `src/lib/seo/README.md` | required | the SEO audit (every page's JSON-LD); `agentic-cms/head` (an `application/ld+json` script of the site's own) | an inline disable with its reason |
| The sitemap and robots.txt | `src/app/sitemap.ts` and `src/app/robots.ts`, from `kit.seo`: a page is in the sitemap because it is a file | required | the SEO audit (a route missing from the sitemap or listed twice, `noindex` on an indexable page) | — |
| A page's Open Graph image | `public/images/<path-with-hyphens>-og.jpg`, 1200×630, named in the `seo` block; `agentic-cms placeholder` writes one until the real one comes | required | the SEO audit (the image there, its size and ratio) | — |
| A form | a definition in `src/config/forms.ts`, rendered by `Form` (`src/components/ui/form/`, where the site draws the fields); the field types, `createFormBackend()` and `withEmailToken()` from `agentic-cms/forms` — `src/lib/forms/README.md`, [forms.md](forms.md) | required | in a section or a pattern, `react/forbid-elements` (`form`, `input`, `select`, `textarea`, `label`); `agentic-cms/forms` across `src/` (a `<form>` outside the form component, a server action, a `fetch()` of another origin in a component) | `elements`; `owners.forms` (the example's `ui/form/Form.tsx`) |
| Where a form's submissions go | the endpoint, `POST /api/forms/[id]` (`src/app/api/forms/[id]/route.ts`), with `createFormHandler()`, `createFormSink()`, `verifyFormSignature()` and `memoryRateLimiter()` from `agentic-cms/forms/server`; the destination from the environment, `src/config/form-delivery.ts` — [forms.md § Where submissions go](forms.md#where-submissions-go) | required | the guard's `routes` pass, through the endpoint's named exception | `exceptions` |

## Browser libraries

What ships to the reader beside the pages: behaviour without a look. The
site draws around it.

| Need | Part, and how to use it | Tier | Held by today | Exception key |
|---|---|---|---|---|
| An analytics tag | `GoogleTag` and `consentDefaultScript()` from `agentic-cms/consent/google`, the tag's id in `src/config/analytics.ts`; another tag gets an adapter that follows `currentDecision()` and `onConsentChange()` from `agentic-cms/consent` — [consent.md](consent.md) | required | `agentic-cms/tags` (`next/script` or a `<script src>` of another origin outside the consent adapter) | `owners.tags`: an adapter of the site's own |
| A consent banner | the site's own design (the example's `ui/ConsentBanner`) on `useConsent()`, `useConsentDecision()` and `openConsent()` from `agentic-cms/consent`, the record in `readChoice()` / `writeChoice()`; a screenshot's seed in `src/config/harness.ts` — [consent.md § The hooks](consent.md#the-hooks), [visual-parity.md § A visitor's choice, seeded](visual-parity.md#a-visitors-choice-seeded) | required | the instructions alone; `agentic-cms/tags` holds the tags it governs | — |
| An e-mail address on a page | `EmailLink` from `agentic-cms/components`, with a token from `encodeEmail()` (`agentic-cms/email`); a form's recipient through `withEmailToken()` — [email.md](email.md) | required | `agentic-cms guard-email` where a site adds it after `next build` (on whenever `site.ts` has an address: job 4 of 0.8.2); `agentic-cms/email` (a `mailto:` link built in code) | an inline disable with its reason |
| Motion | `agentic-cms/ix`: the play-once layer (`Reveal`, `RevealGroup`, `Sequence`, `part()`, `motionScript()`), the reveals that replay (`Fx`, `OnView`), `InlineAnimation`, `ease()`, `useReducedMotionPref()`, `useMainBreakpoint()`; the start states in `src/styles/motion.css` — `STANDARD.md` §7, [lab.md § Inline](lab.md#inline--a-loop-the-page-runs) | preferred | `no-restricted-imports` (`motion` and `framer-motion` only in the motion layer, across `src/`); `no-restricted-syntax` (no transition or animation class in a section or a pattern); the guard's `keyframes` pass; `agentic-cms/motion` (another library, a `requestAnimationFrame` loop, an `IntersectionObserver`, `el.animate()`, a transition or animation class or style, outside the motion layer: a warning); the guard's `transitions` (one declared in CSS: a warning) | `motion` (the folder a site's own library goes in); `owners.motion`; `allow` (`agentic-cms/motion`) |
| An image above the fold | `EagerImage` from `agentic-cms/components` in a server component (the example's `Media` with `eager`); everything else `loading="lazy"` — `STANDARD.md` §4 | preferred | `react/forbid-elements` (no `img` or `picture` in a section or a pattern: `Media`); `agentic-cms/images` (`next/image`, an eager `<img>` in a server component: a warning) | `elements`; `owners.images` (the example's `Media`); `allow` (`agentic-cms/images`) |
| An icon | `Icon` from `agentic-cms/components`, its data from the site's map, `src/config/icons.ts` (`agentic-cms icons add` writes it) — [icons.md](icons.md) | preferred | `react/forbid-elements` (no `svg` in a section); `agentic-cms/icons` (an `<svg>` outside `Icon` anywhere: a warning) | `elements`; `owners.icons`; `allow` (`agentic-cms/icons`, the example's `Placeholder`) |
| A primitive's looks, class names joined | `cx()`, `variants()` and `VariantProps` from `agentic-cms/cx` — `src/components/README.md` § Class helpers | preferred | in a section or a pattern, `no-restricted-syntax` (no inline style, no arbitrary value, no fill, border, radius, ring, outline or shadow class); in `ui/`, the motion layer and `src/app`, `agentic-cms/styling` (an arbitrary value, an arbitrary breakpoint, a style colour: a warning) | `allow` (`agentic-cms/styling`) |
| A colour, a size, a breakpoint | a token in the `@theme static` block of `src/app/globals.css` (the breakpoint steps in `src/styles/base.css`), used as a utility — `STANDARD.md` §1, `.claude/rules/styling.md` | preferred | the arbitrary-value ban above; the guard's `styles` pass (a CSS module only in `ui/` and the motion layer); `agentic-cms/styling` outside the sections and the patterns (a warning) | `allow` (`agentic-cms/styling`, the example's honeypot offset) |
| A component of the site's own | a primitive in `src/components/ui/`, with its entry in the catalogue, `src/components/README.md`, composed in a registered section; the layers import one way, motion ← ui ← patterns ← sections — [primitives.md](primitives.md) | preferred | the guard's `layers`, `catalogue` and `components` passes and the layers' `no-restricted-imports`, which fail `pnpm lint` | `ignores`; `inherited` (frozen) |

## Design tools

What the site is designed with. None of it ships: a round's route, the lab
and the captures are removed before a merge.

| Need | Part, and how to use it | Tier | Held by today | Exception key |
|---|---|---|---|---|
| A design candidate | `agentic-cms demo new <name> --section <type>` (a section's candidates in its real frame, the page's copy read from its file), `--component` (a piece of the chrome), `--showcase`; `demo clean` removes the losers; the `design-options` skill — [design.md § The round](design.md#the-round) | preferred; the copy in it required | the guard passes a `*-demo` route by its name, and a round's candidates while its `demo.json` names them; a `*-demo` route `demo new` did not write, a round's pictures left after `demo clean`: job 4 of 0.8.2; `agentic-cms/copy` in the route and its candidates (the chip that names a block is `aria-hidden`, the lab's labels are the tool's) | a `*-demo` folder, by its name |
| A static candidate: a mark, a palette, a type sample | `agentic-cms sheet <spec>`, a sheet of cells at their real size picked by row — [shot-probe-sheet.md](shot-probe-sheet.md) | preferred | job 4 of 0.8.2 (a site's own Playwright script warns) | — |
| A graphic: an illustration, a mark, a loop | the lab: `agentic-cms lab new`, `lab serve` (on the site's tokens, in each scheme, on a phone), `lab route`, `lab render` (the file a page ships, pre-rendered), `lab clean`; `LabScenes` (on `LAB_GROUNDS` and the site's own), `LabStudy`, `LabTimeline` from `agentic-cms/lab` for a throwaway route, the timeline every animated preview is inspected with ([lab.md § Inspecting motion](lab.md#inspecting-motion--the-timeline)); the `design-graphics` skill — [lab.md](lab.md) | preferred | `react/forbid-elements` (no `svg` in a section, the message naming the lab); `agentic-cms/graphics` (a rendering library, a `<canvas>`: a warning) | `allow` (`agentic-cms/graphics`) |
| An icon set | `agentic-cms icons add` (`lucide:<name>`, `si:<slug>`, `file:<name>`), `icons remove`, `icons family` (marks from primitives), `icons audit` (every icon on the built pages, with the copy beside it), `icons round` (a round for a set); the `design-icons` skill — [icons.md](icons.md) | preferred | `agentic-cms/icons` (an `<svg>` outside `Icon`: a warning) | `owners.icons`; `allow` (`agentic-cms/icons`) |
| A placeholder picture | `agentic-cms placeholder <out> <width> <height>` (the format from the extension); in markup, the example's `Placeholder` — `STANDARD.md` §4 | preferred | job 4 of 0.8.2 (a site's own `sharp` script over `public/` warns) | — |
| A real picture made light | `agentic-cms optimize-webp`, `agentic-cms optimize-svg-rasters` — `scripts/README.md` | preferred | the content lint's `image-weight`, for a picture a content file names | — |
| A screenshot or a proof | `agentic-cms visual-parity proof` (the baseline, the capture after, the compare, in one), `capture`, `compare`, `clean`; `agentic-cms parity` when the markup must not move either; a consent banner held back by the site's seed, `src/config/harness.ts`; the `design-proof` skill — [visual-parity.md](visual-parity.md), [browsers.md](browsers.md) | preferred | job 4 of 0.8.2 (a site's own Playwright script warns) | — |
| A measurement behind a screenshot claim | `agentic-cms shot` (a picture with its box), `agentic-cms probe` (the box, the computed styles, the stacking contexts, the pending reveals); the `design-measure` skill — [shot-probe-sheet.md](shot-probe-sheet.md) | preferred | job 4 of 0.8.2 | — |
| The design procedure | the skills in `.claude/skills/` and `.agents/skills/`, identical: `design`, `design-options`, `design-measure`, `design-icons`, `design-graphics`, `design-proof` — [skills.md](skills.md), [design.md](design.md) | preferred | `agentic-cms init --agent-files --check` (a skill missing or stale, or a site's edit that dropped a line the kit marks required: the closing `pnpm lint`, the copy rule) | — |

## The site's commands

The build, the gates it runs and the setup of the machine it runs on.

| Need | Part, and how to use it | Tier | Held by today | Exception key |
|---|---|---|---|---|
| A new site | `agentic-cms init <dir> --name "<Site>"` (the name required, `--url` and `--email` beside it): the wireframe example's code, a starter of the site's own, the agent files, the config, a CI workflow — [init.md](init.md) | preferred | the starter's placeholders, above | — |
| The setup of a clone | `bash scripts/setup.sh`, then `agentic-cms setup` (`--check` diagnoses and changes nothing): the browsers, `.env.local`, the checks; the `setup` skill — [setup.md](setup.md), [browsers.md](browsers.md) | preferred | job 4 of 0.8.2 | — |
| A dev server and its URLs | `agentic-cms serve` (the dev server and the lab, every URL once each route answers), `agentic-cms urls` (`--write` adds the addresses `ALLOWED_DEV_ORIGINS` lacks) — [dev-server.md](dev-server.md), [design.md § When the dev server will not serve](design.md#when-the-dev-server-will-not-serve) | preferred | job 4 of 0.8.2 (a site's own `next dev` script, a machine address in `next.config.*`) | — |
| What is live, in draft and planned | `agentic-cms status` (`pnpm content:status`), `/editorial:content-status` — `content/README.md` | preferred | — | — |
| The gates every change passes | `pnpm lint`: ESLint with the preset, then `agentic-cms check-components`; `pnpm build`: `agentic-cms lint --production`, `agentic-cms docs --check`, `next build`, `agentic-cms seo` — [commands.md § default gates](commands.md#default-gates) | — (they hold the tiers) | CI: the site's `verify.yml` runs them on every pull request | a site's `package.json` that drops one: job 4 of 0.8.2 |
| The component library's lint in a site | `componentRules({ … })` from `agentic-cms/eslint`, spread into `eslint.config.mjs` after `eslint-config-next` — [primitives.md § Enforced](primitives.md#enforced-agentic-cmseslint) | — (it holds the tiers) | `pnpm lint`; the guard's `preset` pass (a later block that replaces a required rule, or options other than `src/config/components.json`'s) | its options, in [The checks](#the-checks) |
| An address kept out of every served file | `agentic-cms guard-email` after `next build` — [email.md § The guard](email.md#the-guard--agentic-cms-guard-email) | required | opt-in today; on whenever `site.ts` has an address: job 4 of 0.8.2 | — |
| The first paint without a blocking stylesheet | `agentic-cms critical-css` after `next build` — [deploy.md § Critical CSS](deploy.md#critical-css) | preferred | opt-in | — |
| A Node server host | `output: "standalone"` and `agentic-cms assemble` as the build's last step, never a hand-written `cp` — [deploy.md](deploy.md) | preferred | `assemble` checks every file of the package | — |
| A Cloudflare Worker | `pnpm preview`, `pnpm run deploy` (OpenNext), every page from the static-assets cache — [deploy.md § Cloudflare Workers](deploy.md#cloudflare-workers) | preferred | — | — |
| TypeScript under `src/` in a script | `node --import agentic-cms/loader`: Node strips the types, the hook resolves the aliases of the site's `tsconfig.json` — `scripts/lib/load-ts.mjs` | preferred | — | — |
| The installed kit's version | `agentic-cms/package.json` | preferred | — | — |

## The checks

Each check, where it runs, what it holds and the key that names an
exception. Loosening one (a rule off, an `ignores` widened, an element
allowed, a layer dropped, an exception added) is its own pull request, said
so in its title.

**The ESLint preset**, `componentRules()` from `agentic-cms/eslint`, in
`pnpm lint` ([primitives.md § Enforced](primitives.md#enforced-agentic-cmseslint)).
Its options are the exception keys: `motion`, `ui`, `patterns`, `sections`,
`registry` and `app` name the layers and the routes, `elements` allows an
element or changes a message, `copy` sets the copy rule's `props`, `skip`,
`decorations` and `tools` (the rule is required: `false` throws), `owners`
names the files that own a `<form>`, a tag, an eager `<img>`, an `<svg>` or
motion, each with its reason, `allow` the preferred rules a file keeps its
own choice of, each with its reason, `restrictedImports` adds the site's
own bans and `ignores` leaves files out of every rule. An inline
`eslint-disable` of a required rule needs its reason after `--` (the
guard's `disables` pass, which lists every reason); of another rule, one
with no reason is a warning of the same pass. The preferred tier's rules
warn and fail nothing.

| Rule | Where | What it holds | Exception key |
|---|---|---|---|
| `no-restricted-imports` | all of `src/`, and each layer's folder | `motion` and `framer-motion` only in the motion layer (and `agentic-cms/ix` too when the site has a motion folder); the layers import one way, motion ← ui ← patterns ← sections; the site's own bans | `motion`, `restrictedImports`, `ignores` |
| `react/no-multi-comp` | sections and patterns | one component per file | `ignores` |
| `react/forbid-elements` | sections and patterns | no raw `button`, `a`, `img`, `picture`, `video`, form fields or headings, and no `svg` in a section; each message names the primitive to use | `elements` |
| `no-restricted-syntax` | sections and patterns | no inline style, no arbitrary value, no fill, border, radius, ring, outline, shadow, transition or animation class | `ignores` |
| `agentic-cms/copy` | every component under `src/` (and the app folder), tests left out | no copy: JSX text, the copy props and a data field or a default of that name, and any other prop of a component whose string reads as words, but the props the rule skips; a decoration, an `aria-hidden` subtree and the lab's tool labels pass; the message says where the copy goes from where it was found | `copy` (`props`, `skip`, `decorations`, `tools`), `ignores` |
| `agentic-cms/head` | all of `src/` | no `<head>`, `<title>` (but an svg's), `<meta>`, canonical `<link>`, JSON-LD `<script>` or `next/head`; `metadata` and `generateMetadata` return a `kit.seo` helper | `ignores` |
| `agentic-cms/forms` | all of `src/` | a `<form>` only in the form component, no server action, no `fetch()` of another origin in a component | `owners.forms`, `ignores` |
| `agentic-cms/tags` | all of `src/` | `next/script` and a `<script src>` of another origin only in the consent adapter | `owners.tags`, `ignores` |
| `agentic-cms/email` | all of `src/` | no `mailto:` link built in code: `EmailLink` | `ignores` |
| `agentic-cms/motion` (a warning) | all of `src/` but the motion layer, tests left out | no animation library but `agentic-cms/ix` (the preset's `ANIMATION_ALTERNATIVES`), `requestAnimationFrame`, `IntersectionObserver`, `el.animate()`, transition or animation class (`className`, `cx()`, `variants()`) or style | `owners.motion`, `allow`, an inline disable with its reason, `ignores` |
| `agentic-cms/graphics` (a warning) | all of `src/`, tests left out | no rendering library (the preset's `RENDERING_LIBRARIES`), `<canvas>` or canvas made in code: the lab | `allow`, an inline disable with its reason, `ignores` |
| `agentic-cms/images` (a warning) | all of `src/`, tests left out | no `next/image`, no eager `<img>` in a server component: `Media`, `EagerImage` | `owners.images`, `allow`, an inline disable with its reason, `ignores` |
| `agentic-cms/icons` (a warning) | all of `src/`, tests left out | no `<svg>` outside `Icon` | `owners.icons`, `allow`, an inline disable with its reason, `ignores` |
| `agentic-cms/styling` (a warning) | all of `src/` but the sections and the patterns, tests left out | no arbitrary value or property, arbitrary breakpoint or style colour outside the tokens | `allow`, an inline disable with its reason, `ignores` |

**The placement guard**, `agentic-cms check-components`, after ESLint in
`pnpm lint`, configured in `src/config/components.json`
([primitives.md § Placed](primitives.md#placed-agentic-cms-check-components)).
A running round's candidates (its `demo.json`) and the files on the frozen
`inherited` list pass every pass.

| Pass | What it holds | Exception key |
|---|---|---|
| `layers` | the layers the config names are there, the registry and the catalogue too; every file under `src/components` sits in a layer | `motion` or `patterns` set to `null` for a layer the site does not have; `sections` |
| `catalogue` | every component the motion layer, `ui` and `patterns` export is named in `src/components/README.md` | — |
| `registry` | every component in a section folder is imported by the registry | — |
| `routes` | `src/app` holds route files only, in the content engine's folders (`routes`) or a named exception's, and every exception has its reason | `exceptions`; a `*-demo` folder, by its name |
| `components` | no component outside `src/components` and `src/app` | `ignores` |
| `styles` | CSS modules only in `ui` and the motion layer | — |
| `keyframes` | `@keyframes` only in the motion layer and `src/styles/motion.css` | `motionCss` |
| `inherited` | the frozen `inherited` list only shrinks: a listed file that is gone is a finding | `inherited`, which takes nothing new |
| `owners` | each file `owners` names (a `<form>`'s, a tag's, an eager `<img>`'s, an `<svg>`'s, motion's) is there, with the reason it owns it | `owners` |
| `allow` | each `allow` entry names a preferred rule (never a required one) and files that are there, with its reason | `allow` |
| `disables` | an inline disable of a required rule (`agentic-cms/*`, or every rule) says why after `--`; the report lists each reason. One of another rule with no reason is a warning | — |
| `transitions` (a warning) | no transition or animation declared in CSS outside the motion layer and `src/styles/motion.css` (`none` and a zero duration rest) | `allow` (`agentic-cms/motion`), `motionCss` |
| `preset` | the required rules hold: for a sample file per layer, a route, a round's route, `src/lib` and each owner's file, the setting ESLint resolves is the one `componentRules()` makes of the config — not replaced by a later block, not off, not set with other options, not ignored. A preferred rule set otherwise is a warning | the config's own options |

**The content lint**, `agentic-cms lint`, the first step of `pnpm build`
(`--production` there, so placeholders fail); `pnpm content:lint` alone.
A FAIL stops the build, a WARN is read, `--strict` promotes the warnings.

| Rule | What it holds | Exception key |
|---|---|---|
| `schema` | every collection read as the build reads it; the engine's own message, first | — |
| `voice` | `content/VOICE.md`'s fenced block is there and valid | — |
| `voice-banned`, `voice-pattern`, `voice-model`, `brand-mark`, `brand-case`, `em-dash` | the voice block's exact rules: banned words and patterns, model names, the brand's mark and case, the em dash | the block's scopes |
| `voice-claim`, `voice-cloud` | the voice block's heuristics: a compliance or certification claim, a cloud named as part of the stack (warnings) | the block's scopes |
| `seo-title`, `seo-description` | the SEO limits at the source, the same as the audit's | — |
| `excerpt-words`, `keywords-count` | a post's excerpt and keywords within their counts | — |
| `date-rollover`, `date-future`, `date-order`, `draft-stale` | a date that parses but is no calendar day; a date ahead and a draft left over 30 days (warnings); `updatedAt` before `publishedAt` | — |
| `heading-level`, `faq-structure`, `body-image` | a post body's headings start at `##` and never skip, its FAQ section has questions with answers, its pictures are self-hosted with an alt | — |
| `alt-pair`, `alt-weak` | a picture a content file sets has its alt beside it, and the alt says what the picture shows, not which slot it fills | — |
| `image-exists`, `image-weight`, `image-orphan` | a picture a content file names is under `public/` and light enough; a post's picture folder has its post, and no picture in it goes unnamed (a warning) | — |
| `stray-file`, `workshop` | nothing under `content/` that no collection reads; `content/editorial/workshop.yaml` in its shape | — |
| `placeholder`, `example-brand` | the starter's placeholder copy and address (a warning; a failure in a production build); the kit example's brand in a site | `AGENTIC_CMS_PLACEHOLDERS=warn` for `placeholder`, in a run that deploys nothing |

**The build's other steps.** `agentic-cms docs --check` fails when
`content/README.md`'s field tables are stale; `next build` reads every
collection and prerenders every page; `agentic-cms seo` audits every
prerendered page (`src/lib/seo/README.md` § What the audit checks).
`agentic-cms init --agent-files --check` reports an agent file that is
missing or stale, a site's edit of a rule or a skill that dropped a line
the kit marks required (`<!-- required -->`: each rule's tier line, the
engines, each skill's closing `pnpm lint`), and a `.claude/settings.json`
that no longer enables the editorial plugin
([init.md § What an edit keeps](init.md#what-an-edit-keeps)). The opt-in steps, `guard-email`, `critical-css` and
`assemble`, run where a site's `build` names them.
