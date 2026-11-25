# The motion sample

One page told as a live, scroll-driven scene: the life of a page on
agentic-cms, in six chapters.
[Scroll it live](https://hkamkar.github.io/agentic-cms/motion-story/). It is
the story [docs/motion-story.md](../../docs/motion-story.md) takes its
numbers from, kept here to be read, and it is not part of the npm package.
A site does not install it: it draws its own, with the `design-story` skill.

```bash
node examples/motion-story/build.mjs    # dist/index.html, one file
pnpm test:story                         # built, and held to every rule of agentic-cms story
```

| File | What it holds |
|---|---|
| `src/timeline.js` | the chapters: their words, their lengths, the colours |
| `src/geo.js` | the geometry, one generator that runs in a worker and yields the first scene first; the tree's random numbers are pinned, so no other scene can move it |
| `src/shaders.js` | every shader, with maths that is defined on every chip |
| `src/renderer.js` | raw WebGL 2, no library: targets made once, quality as a share of them, the first scene's programs before the others |
| `src/governor.js` | what keeps the pace: picture size, half rate, fewer details, stills; no clock and no DOM, so it can be simulated |
| `src/story.js` | the cameras, the cards, the words, the loop, the stills, the hook the check draws with |
| `src/page.js` | the HTML, every word of it, so the page reads without the scene |
| `src/style.css` | the document, then the story over it |

On a site the words live in `content/pages/`, rendered by a section, and the
engine is imported on that page alone (the guide's § Where it lives on a
site); here the page stands on its own.
