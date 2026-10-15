# Migrating a site from 0.7.6 to 0.8.0

> **Draft.** Written with the 0.8.0 roadmap (`docs/roadmap.md`). Each job
> of the roadmap fills in its section here as it lands, and the release is
> cut only after this guide has been run on two sites on 0.7.6. Lines marked
> *(job N)* are the plan; the final text replaces them.

This is for a site on agentic-cms 0.7.6. Upgrading changes nothing a reader
sees: a site that does only § 1 builds, lints and proves identical.
Everything after § 1 is a choice. Each step says why you might take it,
what to do, how to check, and what to delete if your site already wrote its
own version.

| § | Step | Who | Effort |
|---|---|---|---|
| 1 | Upgrade | every site | minutes |
| 2 | Breaking changes | every site | none planned |
| 3.1 | The site profile: widths, schemes, proof pages | every site | minutes |
| 3.2 | `setup`, `urls`, `serve` | every site | minutes |
| 3.3 | CI | a site without CI | minutes |
| 3.4 | Light only | a site without dark mode | an hour |
| 3.5 | The play-once motion layer | a site that wants it, or wrote its own | an hour or more |
| 3.6 | `variants()`, tokens by role, the example's primitives | a site that wants them | it depends |
| 3.7 | The component library, enforced | a site ready to freeze its components | an hour |
| 3.8 | The know-how pointers | every site | minutes |
| 4 | Delete what your site wrote itself | a site with its own tools | minutes per tool |
| 5 | Check | every site | a proof |

## Before you start

- **A clean tree, on a branch off `develop`** (`chore/agentic-cms-0.8`), with
  `develop` pushed.
- **No baseline to take by hand.** `visual-parity proof --ref develop` builds
  `develop`, whose lockfile still pins 0.7.6, so the proof compares the old
  kit against the new one.
- **Know what your site wrote itself.** Read the table in § 4 first: each of
  those files is deleted only after the step that replaces it.

## 1. Upgrade (required)

```bash
# package.json: "agentic-cms": "github:HKamkar/agentic-cms#v0.8.0"
pnpm install
pnpm exec agentic-cms init . --agent-files --check   # what will change, writes nothing
pnpm exec agentic-cms init . --agent-files           # skills, rules, the rules table
```

**What `--agent-files` updates:** the skills, the scoped rules and the rules
table in `AGENTS.md`.
- **Skills:** `design-proof`, `design-options`, `design-graphics`, `design`,
  and the new `setup`.
- **Rules:** `styling`, `design`.

A file you edited is kept and reported `modified`. Compare it with
`node_modules/agentic-cms/templates/site/rules/<name>.md` (or the skill under
`node_modules/agentic-cms/.claude/skills/`) and take the new lines by hand.
They are listed here *(each job adds its lines)*.

**`AGENTS.md`:** `init` never rewrites it outside the rules table. Add these
pointers by hand *(job 2; final text at the release)*:

- *A fresh clone or a new machine: `node_modules/agentic-cms/docs/setup.md`
  (`bash scripts/setup.sh`, or the `setup` skill).*
- *Before starting a server or handing over a URL:
  `node_modules/agentic-cms/docs/dev-server.md`; `pnpm urls` finds this
  machine's addresses. A machine's address never goes into the repo.*
- *How design is shown to the owner and checked in Chrome and Safari:
  `docs/browsers.md` and `docs/design.md` § Handing over.*
- *Traps by topic: `node_modules/agentic-cms/docs/gotchas.md`.*

**What changes without any action from you:**

- `visual-parity proof --build` works. It exited 2 on every call before
  *(job 1)*.
- With no profile (§ 3.1), every command's defaults are what they were
  *(job 5)*.
- The lab timeline scrubs play-once CSS motion and measures animations that
  start after it mounts *(job 7)*.
- `demo new` waits until its route answers on a running dev server and
  prints the URLs to hand over *(job 6)*.
- `lab serve` lists real network addresses only, not container bridges, and
  each scene's URL *(jobs 4, 6)*.

**Check:** the verify block, then `pnpm kit visual-parity proof upgrade --ref develop --build`.
It must be identical. If it isn't, that is a kit bug: report it with the
compare's `cause:` line rather than adjusting the site.

## 2. Breaking changes

None planned. If a job has to break something, it is listed here with the
step that fixes it.

Watch:
- The screenshot harness learns the new motion layer's markers *(job 8)*. If
  that changes a captured frame, the CHANGELOG says **recapture baselines**.
- If the kit's built-in default widths change for sites with no profile
  *(job 5)*, the same applies.

## 3. Adopt what you want

### 3.1 The site profile *(job 5)*

**Why:** proofs are only as long as your site needs. Today the default is
eight widths, every page and both schemes, even on a site without dark mode.

**Do:** say what your site is, once, in `src/config/harness.ts`:

```ts
export const harness = {
  storage: { /* as before */ },
  widths: [390, 768, 1440, 1920],
  schemes: ["light"],                    // ["light", "dark"] if the site has both
  proof: { pages: ["/"], ref: "develop" },
};
```

**Check:** `pnpm kit visual-parity proof profile --build` captures only those
widths and schemes. Menu shots are taken at the widths below the menu
breakpoint.

**If you wrote your own short-proof script:** delete it, and point the
package script at `agentic-cms visual-parity proof`.

### 3.2 `setup`, `urls`, `serve` *(jobs 4, 6)*

**Why:** a co-worker, or their agent in Claude Code or Codex, sets the site
up from a fresh clone with one command. The owner's phone gets URLs that
work.

**Do:**

1. Copy `node_modules/agentic-cms/templates/site/setup.sh` to
   `scripts/setup.sh`. It checks Node, installs pnpm and the dependencies,
   then runs `agentic-cms setup`.
2. Add `"urls": "agentic-cms urls"` to the package scripts. Don't add a
   `setup` script: `pnpm setup` is a pnpm built-in.
3. Run `bash scripts/setup.sh` once. It:
   - installs Chromium and WebKit (and WebKit's Linux libraries with
     `--deps`);
   - writes `.env.local` and this machine's `ALLOWED_DEV_ORIGINS`;
   - runs the lint and the tests.
4. From then on, run `pnpm kit serve` to start the dev server and the lab
   and print every URL.

**Check:** `pnpm kit setup --check` exits 0, and the owner's phone loads a
page that hydrates (a menu opens).

**If you wrote your own setup or addresses script:** delete it once this
works. Keep your site-only steps as a short script that calls
`bash scripts/setup.sh` first.

### 3.3 CI *(job 3)*

**Why:** the lint, the tests and the build on every pull request, and the
agent files checked against the kit.

**Do:** if `.github/workflows/` has no verify workflow, copy
`node_modules/agentic-cms/templates/site/verify.yml` to
`.github/workflows/verify.yml`. If yours exists, add the step
`pnpm exec agentic-cms init . --agent-files --check`.

**Check:** a pull request runs it, and it passes.

### 3.4 Light only *(job 5)*

**Why:** a site without dark mode should carry no theme script, toggle or
`light-dark()` pairs, and no proof or lab ground in a scheme it doesn't have.

**Do:** set `schemes: ["light"]` (§ 3.1). If your site still has the
example's theme wiring, remove it as `init --light-only` would:
- `src/app/layout.tsx`: no `THEME_SCRIPT` and no `suppressHydrationWarning`,
  and `colorScheme: "light"`;
- `src/styles/base.css`: `color-scheme: light`;
- `globals.css`: single values;
- no `ThemeToggle`, in the navbar or anywhere else.

The exact lines are in the roadmap's job 5.

**Check:** a proof of the change is identical in light. The theme toggle is
gone, and that is intended: say so in the commit.

### 3.5 The play-once motion layer *(jobs 7, 8)*

**Why:** `Fx` replays each time an element re-enters the viewport. The new
layer in `agentic-cms/ix` plays once, when it first enters, never on hover
or a second scroll, and its loops run only on screen:
- `Reveal`, `RevealGroup`, `Sequence`, `part()`;
- `motionScript()`, the inline script that arms motion before first paint.

**Not required:** a site on `Fx` and `OnView` can stay on them. Both are
kept and documented.

**Do:**
1. Render `motionScript()` near the top of `<body>`.
2. Copy the layer's block from `node_modules/agentic-cms/src/styles/motion.css`
   into your `src/styles/motion.css`, with its custom properties
   (`--ease-*`, `--motion-*`) *(job 8 decides whether the package ships this
   file instead)*.
3. Use `Reveal` and friends in new work. Move existing reveals only when
   the owner wants them to stop replaying.

**Check:**
- a browser check: scroll away and back, and nothing replays; hover, and
  nothing replays;
- with reduced motion, nothing is hidden;
- `pnpm kit visual-parity proof motion --motion --build`.

**If you wrote your own play-once layer:** switch the imports to
`agentic-cms/ix`, then delete your components, your hooks and any lab
timeline patch of your own (a fill override under the timeline, or an
immediate play under it). The timeline handles both now.

### 3.6 `variants()`, tokens by role, the example's primitives *(job 9)*

**Why:** one typed map of looks per primitive, so a new look is a line and
never a copy. Components name roles (`panel`, `line`, `on-ink`), never hues.

**Do:**
- **`variants()`:** `import { variants, type VariantProps } from "agentic-cms/cx"`
  *(or `agentic-cms/variants`; job 9 decides)*.
- **Tokens by role:** add the role tokens to `@theme static` as aliases of
  your colours. The values are yours.
- **Primitives:** the example now has `Panel`, `OutlineButton`,
  `IconButton`, `Heading` (with size and entrance), `MetaLine`, `TextLink`,
  `Media` and `keepWords`. `init` never copies the example into an existing
  site, so copy the ones you want from
  `node_modules/agentic-cms/src/components/ui/`, with their catalogue rows,
  and restyle them with your tokens.
- **The guide:** `docs/primitives.md` is the checklist of what a site builds
  on day one and what waits for a second use.

**Check:** the verify block, and a proof. Adopting a primitive in place of
existing markup must be pixel-identical, or it is a design change in a
commit of its own.

**If you wrote your own `variants()`:** delete it and its test, and switch
the imports.

### 3.7 The component library, enforced *(job 10)*

**Why:** UI is made only in the library, and ESLint and CI keep it that way:
- the layers: `motion ← ui ← patterns ← sections`;
- no raw elements, styles or visual classes in a section;
- every primitive catalogued;
- `src/app` holds route files only.

**Do:**
1. Add the guard's config, `src/config/components.json`. List every
   component your site already has under `inherited`: they are frozen, not
   rewritten, and leave the list as you replace them.
2. Spread `componentRules()` from `agentic-cms/eslint` into
   `eslint.config.mjs`.
3. Change the lint script to
   `eslint; s=$?; agentic-cms check-components || s=1; exit $s`.
4. Run `init --agent-files`: with the config present, it writes the
   components rule.

**Check:** `pnpm lint` passes on the current tree. A planted violation fails
it: a raw `<button>` in a section, or an uncatalogued export in `ui/`.

**If you wrote your own guard and lint:** move your config's lists into the
kit's format, then delete your scripts and the rule you wrote.

### 3.8 The know-how pointers *(job 2)*

**Why:** the kit now carries the traps and the practice once, for every site:
- `docs/gotchas.md`;
- `docs/browsers.md`;
- `docs/dev-server.md`;
- `docs/setup.md`;
- `docs/primitives.md`;
- the deploy notes for Cloudflare, Cloud Run and Azure App Service.

**Do:** add the `AGENTS.md` pointers from § 1. If your site has its own
copies of these guides, delete each entry the kit now has, and keep what is
only yours: your host's choice, your services, your design decisions.

**Check:** `grep` your `docs/` for an entry the kit's guide also has, and
expect none.

## 4. Delete what your site wrote itself

Each row goes only after its step works.

| You wrote | Now | After |
|---|---|---|
| a setup script | `scripts/setup.sh` and `agentic-cms setup` | 3.2 |
| a script that finds the machine's addresses or writes `ALLOWED_DEV_ORIGINS` | `agentic-cms urls` | 3.2 |
| a short-proof wrapper, or a workaround for `proof --build` | `visual-parity proof` with the profile | 1, 3.1 |
| a lab-timeline patch for play-once motion | the timeline itself | 1 |
| a play-once motion layer | `agentic-cms/ix` | 3.5 |
| `variants()` | `agentic-cms/cx` | 3.6 |
| a placement guard, component lint rules, a components rule | `agentic-cms check-components`, `agentic-cms/eslint`, the kit's rule | 3.7 |
| hand-written review routes (a page of every primitive, of every motion) | `demo new <name> --showcase`, removed by `demo clean` | — |
| copies of the gotchas, browser, dev-server or setup guides | the kit's docs, plus your site-only lines | 3.8 |

## Two paths, worked

- **A site that wrote its own versions of what 0.8.0 brings:** § 1, then
  the steps that replace them (3.1, 3.2, 3.5, 3.6, 3.7), deleting each § 4
  row as its step lands. Then 3.8 and § 5.
- **A site on `Fx` that wrote none of it:** § 1, then 3.1, 3.2 and 3.8.
  Keep `Fx`. Take 3.3 only for the agent-files check, if it has CI.
  Take 3.7 when the owner wants it, with every existing component in
  `inherited`. Then § 5.

## 5. Check

- The verify block: `pnpm lint`, `pnpm test`, `pnpm content:lint` and
  `pnpm build`, 0 failures.
- `pnpm exec agentic-cms init . --agent-files --check` is clean.
- `pnpm kit visual-parity proof migrate --ref develop --build` is identical,
  except for the design changes you chose and committed apart (3.4's
  toggle).
- The owner looks on the dev server (`pnpm kit serve`), then the merge.

## When something fails

| Symptom | Do this |
|---|---|
| `init --agent-files` reports a rule or skill `modified` | You edited it: take the new lines by hand (§ 1). `--force` would discard your edits |
| The proof differs after § 1 alone | A kit bug: open an issue with the compare's `cause:` line; don't adjust the site |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` misses an `allowBuilds` key: `init .` merges them now *(job 3)*, or add the key named in the error |
| `pnpm lint` fails everywhere after 3.7 | Components missing from `inherited`: list them, then replace them one pull request at a time |
| A page on the owner's phone renders but nothing works | Its address is missing from `ALLOWED_DEV_ORIGINS`: `pnpm urls --write`, then restart the dev server |
