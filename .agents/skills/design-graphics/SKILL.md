---
name: design-graphics
description: Draw the site's own graphics as SVG in the lab - an icon beyond the families, a mark beside copy, an illustration, a short 2D loop - looked at on the site's tokens in both schemes and on a phone (`pnpm kit lab serve`), shipped pre-rendered as the file a page embeds or as inline Icon data (`pnpm kit lab render`, `pnpm kit icons add file:`), never as a rendering library in the reader's browser, and the lab closed after (`pnpm kit lab clean`). Use when a page needs a drawing the icon family's primitives cannot say, an animated mark or a loop, a hero illustration, or when asked to make the site "more graphical", "more alive", "less template".
argument-hint: <what to draw> [where it goes: a section, the chrome, a post]
---

# Design graphics

A site's authentic graphics are SVG written as code, designed where they
can be judged — at the real size, on the real tokens, light and dark, on
the owner's phone — and shipped **pre-rendered**: a file under
`public/images/`, or inline `Icon` data. Speed and search come first, so
nothing renders in the reader's browser that a file could carry; the lab is
a tool opened for the drawing and gone once the files exist. The guide is
`docs/lab.md` (`node_modules/agentic-cms/docs/lab.md` on a site that
installs the kit); the pick goes through `design-options`, the merge
through `design-proof`.

## Read first

`STANDARD.md` §1 (the four tokens the drawing lives on) and §4 (where a
file lives and how it is named; the families — a mark the primitives of
`icons family` can say is `design-icons`, not a drawing); `docs/lab.md`
§ Render (the table of what ships as what); the section or component the
graphic sits in (`grep -rn` its file under `src/`), and the copy beside it —
a drawing means what it stands next to.

## Steps

1. **The form, before the drawing.** From the table in `docs/lab.md`: an
   icon used across pages → inline `Icon` data (follows the theme toggle,
   no request); an illustration, diagram or mark → an `<img>` of a `.svg`
   (one scheme, so it must read on both grounds — mid-tones like the
   placeholder's grey, or a render per scheme); a short flat loop → an
   animated `.svg` in a `<picture>` with its still; a loop that must be
   zero-compute or shaded → an animated `.webp` in the same `<picture>`; a
   big hero loop → a `.webm` with its poster; an OG image stays a static
   JPEG. When the form is not obvious, ask the owner with the trade-off in
   one line each.
2. **Draw.** `pnpm kit lab new <name> --kind icon|mark|loop` writes
   `.parity/lab/<name>.svg` on the kit's contracts; edit the file. The
   rules: `viewBox` and the natural `width`/`height`; `currentColor` and
   `var(--color-*)` when it ships inline, hex or mid-tones when it ships as
   an `<img>`; `transform` and `opacity` only, `transform-box: fill-box`
   and a `transform-origin` on what turns; ids, class and keyframe names
   prefixed with the scene's name; a `prefers-reduced-motion` rule in every
   CSS loop; SMIL (`<animate>`) for a loop that ships as an `<img>`; no
   text that needs a font, no bitmap inside the SVG, no double hyphen in a
   comment. An icon for `Icon` is flat shapes with one paint on the 24
   grid — no group, transform, `<use>`, `<defs>` or `<style>`.
3. **Look, then pick.** Two windows. `pnpm kit lab serve` and hand the
   owner the LAN URL it prints: the scene inline in a light and a dark box
   at its sizes, the same file as an `<img>` on both grounds (what an embed
   really gets), a scrubber over its animation. And `pnpm kit lab route`
   then `/lab-demo` on the dev server: the same scenes on the site's own
   grounds — its page, its cards, its panels, as the route's `GROUNDS` list
   says — inside the real chrome, with the procedure written for the owner
   at the top; a scene that must sit on a surface is judged there. Candidates are scenes `a`, `b`, `c` beside
   the current version, two to four, the owner answers with a letter
   (`design-options`); a "more" is a change on the file and a second look
   in the same round, not another round of candidates. A saved file
   reloads the page.
4. **Render and place.** `pnpm kit lab render <name> --out
   public/images/<page>/<file>` — `.svg` for the file, `--scale 2` for a
   retina still, `--animate --fps 12` for a loop (its still lands beside
   it, the `<picture>` fallback), `--scheme dark` for the dark render; or
   `--out src/config/icons/<name>.svg` then `pnpm kit icons add
   file:<name>` for inline `Icon` data. Place it with the image rules:
   `<img>` with `width`, `height`, `alt` and `loading="lazy"` (`EagerImage`
   above the fold), a loop inside the `<picture>` from `docs/lab.md`, a
   `.webm` with its `poster`, the OG image untouched. A loop on a page is a
   design change with its own commit; the wireframe's own pages place none
   (`STANDARD.md` §7).
5. **Prove, then close.** `design-proof` (a `<picture>` loop is still under
   the harness's reduced motion; a `<video>` is not — re-run that frame
   once); `pnpm kit lab clean` (the lab and the route; a route left in the
   tree fails the build's SEO audit, on purpose); `git status` shows nothing of the lab, only
   the files a page ships and, for an icon, its source under
   `src/config/icons/`. Record the family or the form in `STANDARD.md` §4
   when it is one the site will reuse.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # the SEO audit reads every <img>
pnpm kit lab render <name> --out <file> --json              # the report: size, frames, bytes, the console
pnpm kit visual-parity capture before --ref develop && pnpm build && pnpm kit visual-parity capture after && pnpm kit visual-parity compare before after --json
pnpm kit lab clean && git status --short                    # nothing of the lab, no src/app/lab-demo
```

## Stop for the user

The form (step 1) when it is not obvious; the pick (step 3); the look at
the placed graphic on the dev server; the merge.
