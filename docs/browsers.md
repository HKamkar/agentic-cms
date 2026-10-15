# Chrome and Safari: who checks what

A site is judged in the browsers its readers use, and the agent has only
headless ones. This page says which engine answers which question, how to
run the same check in both, what neither headless engine can show, and the
differences between the engines that sites on the kit have hit. Serving a
page to the owner's devices is [dev-server.md](dev-server.md); the traps by
topic are [gotchas.md](gotchas.md).

## Three levels

1. **Headless Chromium: every kit command.** `shot`, `probe`, `sheet`,
   `visual-parity`, `lab render`, `icons audit` all drive Chromium. It
   answers the numbers: layout boxes, pixel proofs, horizontal overflow,
   tap-target sizes, the accessibility tree.
2. **Headless WebKit: Safari's engine, as a stand-in.** For interactions
   and layout checks where the engines may differ, run the check as a
   throwaway script in both engines from one loop (below). Report what it
   shows as "WebKit", never as "Safari": it is the engine, not the
   browser on the owner's device (the `design-graphics` skill says the
   same of its frames).
3. **The owner's real Safari.** A Mac, an iPhone or an iPad, at the
   versions they run, on the LAN or public URL
   ([dev-server.md](dev-server.md)). It has the final word on anything
   visual. Say plainly what the machine could not verify (the list
   below) and ask for that check by name.

## Install

```bash
bash scripts/setup.sh                      # with the rest of the setup (setup.md)
pnpm exec agentic-cms setup --no-public    # the same steps once the dependencies are in
```

`agentic-cms setup` runs `pnpm exec playwright-core install` for the
engines not installed yet (`--engines chromium` for one). Both builds land
in Playwright's cache (`~/.cache/ms-playwright` on Linux,
`~/Library/Caches/ms-playwright` on a Mac), where the kit's commands find
them; `CHROME_PATH` points them at a Chrome of your own instead.

On Linux, WebKit needs system libraries the first time. Setup launches
WebKit to find out, and when it does not launch prints the line that
installs them, which asks for `sudo` (`$(command -v node)` because `sudo`
resets `PATH` and may not find a Node installed by a version manager); the
machine's owner runs it, or lets setup run it with `--deps`:

```bash
sudo "$(command -v node)" node_modules/playwright-core/cli.js install-deps webkit
```

A Mac needs nothing more. `pnpm exec agentic-cms setup --check` says
whether both engines are installed and WebKit launches, changing nothing.

## The same check in both engines

A throwaway script in a scratch directory or under `.parity/` (both outside
what a commit takes), one loop over the two engines, one line printed per
engine:

```js
import { chromium, webkit } from "playwright-core";

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://localhost:8000/");
  // seed storage, act, measure
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  console.log(engine.name(), { scroll, client });
  await browser.close();
}
```

Run it with `node`, against the dev server or a served build. What is worth
running this way:

- hover hit-testing where elements overlap;
- swipes, drags and taps;
- text widths, of the page and of an SVG's `<text>` (`getBBox()`);
- the accessibility tree with a menu or a dialog open;
- a state the harness does not capture, byte-compared against the base
  branch's build.

## What headless cannot show

- **WebKit on Linux** renders in software:
  - no `backdrop-filter`, no GPU compositing, no touch momentum;
  - no Apple system fonts, so text widths differ from a real Mac or
    iPhone.

  Blur and compositing have to be robust by construction and confirmed by
  the owner.
- **Chromium on a machine without a GPU** composites in software:
  - frame times and FPS mean nothing there; measure main-thread work
    instead (long tasks, scripting time);
  - `will-change` on many layers makes the software compositor slower,
    which says nothing about a real GPU.
- **Element screenshots drop children under a 3D `perspective`.** Capture
  the viewport instead (`shot` without `--select`), or a `clip` rectangle
  in your own script (`page.screenshot({ clip })`).

## Engine differences

| Symptom | Engine | Do this |
|---|---|---|
| 3D layers drawn in the wrong order under `transform-style: preserve-3d` | WebKit | don't rely on 3D depth sorting; set `z-index` from the component's own state |
| a transition on an `@property` custom property barely animates | WebKit | animate a real property, or drive the value from script and let CSS lay out only the first paint |
| a swipe on a draggable area (a carousel, a slider) is cancelled | Safari on iOS | native link and image drag steals the pan: `draggable={false}` on its links, `-webkit-user-drag: none; user-select: none` on its links and images, `touch-action: pan-y` on the area |
| a tap on a link both turns a carousel and navigates | both, through Next's `Link` | when the tap means "turn", stop the event in your handler before `Link`'s router sees it |
| a tap runs a focus handler | Safari | a tap focuses the link before the click: react to `:focus-visible` (the keyboard) only |
| blur or overlay glitches | Safari | no `backdrop-filter` at `opacity: 0`, no `display` toggles on filter layers, no nested backdrop filters |
| the page scrolls sideways on an iPhone | WebKit, at 390 to 430 px | measure `scrollWidth` against `clientWidth` while the animations run; a moving decoration clips its own box ([gotchas.md § CSS, SVG and performance](gotchas.md#css-svg-and-performance)) |
| a `<source media="(width < 768px)">` is ignored | Safari before 16.4 | write `not all and (min-width: 768px)` |
| copies of one SVG animation drift apart | WebKit | it advances visible and off-screen SVG timelines differently: the kit's timeline sets them going together each cycle ([lab.md § Inspecting motion](lab.md#inspecting-motion--the-timeline)); judge frames paused |
