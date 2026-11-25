// What `agentic-cms story` holds a motion story to, as numbers and as
// judgements over what scripts/lib/story-run.mjs measured: no browser here, so
// every rule is tested on its own. The numbers are docs/motion-story.md's
// (§ The budget, § The check). A judgement is null, or the problem in one
// line; a measure that could not be taken is a problem too, never a pass.

export const LIMITS = {
  /** programs linked before the first picture */
  programs: 16,
  /** main thread blocked by the setup, processor slowed 4×, in ms */
  blocked: 200,
  /** pixels of the canvas, per device */
  pixels: { desktop: 1.9e6, tablet: 1.3e6, phone: 0.9e6 },
  /** a card's path while it can be read, as a share of the screen's longer side */
  travel: 0.1,
  /** the share of its readable path a card stands whole inside the window */
  inWindow: 0.9,
  /** a move between two steps of 12 px of scroll that a reader sees as a jump, as a share of the longer side */
  jump: 0.04,
  /** layout shift over the whole story */
  shift: 0.02,
  /** how much a frame's brightness varies (standard deviation, 0–255) before it counts as a picture */
  spread: 1.5,
  /** the mean difference between two engines' frames, 0–255 */
  engines: 3,
  /** the share of pixels white in one engine and dark in the other */
  blown: 0.0005,
  /** the mean difference after the context came back */
  restored: 4,
};

const list = (items, n = 3) => `${items.slice(0, n).join("; ")}${items.length > n ? ` and ${items.length - n} more` : ""}`;
const px = (n) => `${Math.round(n)} px`;

/** Errors a page logged, per engine: { chromium: [line], … }. */
export function errors(byEngine) {
  const found = Object.entries(byEngine).flatMap(([engine, lines]) => lines.map((line) => `${engine}: ${line}`));
  return found.length ? list(found) : null;
}

/** Headings and paragraphs: what a reader sees without the scene, against what the live page holds. */
export function words({ live, without }, where) {
  if (!live.length) return "the story holds no heading and no paragraph";
  const seen = new Set(without.filter((w) => w.visible).map((w) => w.text));
  const gone = live.filter((w) => !seen.has(w.text)).map((w) => `"${w.text.slice(0, 48)}"`);
  return gone.length ? `${gone.length} of ${live.length} not readable ${where}: ${list(gone)}` : null;
}

/** The still version: the words, and nothing drawn once it stands. */
export function still({ live, without, draws }) {
  const missing = words({ live, without }, "with reduced motion");
  if (missing) return missing;
  return draws ? `still drawing with reduced motion: ${draws} draw calls in a second after it settled` : null;
}

/** The first picture: the stage painted in CSS, and no more programs than the first scene's. */
export function firstPicture({ programs, ground }) {
  if (programs === null) return 'the page never said when its first picture was there: performance.mark("story:first-picture")';
  if (programs > LIMITS.programs) return `${programs} programs linked before the first picture (at most ${LIMITS.programs}): the first scene's own, the rest behind it`;
  return ground < LIMITS.spread ? "the stage is one flat colour until the scene is drawn: paint the first scene's ground in CSS, on [data-story-stage]" : null;
}

export const setup = ({ blocked }) => (blocked > LIMITS.blocked ? `the setup blocks the main thread for ${Math.round(blocked)} ms with the processor slowed 4× (at most ${LIMITS.blocked}): geometry in a worker, the rest in slices` : null);

/** WebGL objects made and questions asked while the story is drawn: { made, asked } as { name: count }, over the draw calls seen. */
export function midScroll({ made, asked, draws, frames }) {
  if (!draws) return `no draw call was seen over ${frames} frames, so nothing about them is known (WebGL on the page's own thread is what is read: not a canvas handed to a worker)`;
  const name = (calls) => Object.entries(calls).sort((a, b) => b[1] - a[1]).map(([call, n]) => `${call} ×${n}`);
  if (Object.keys(made).length) return `made in mid-scroll, over ${frames} frames: ${list(name(made))}`;
  return Object.keys(asked).length ? `questions to the graphics process in a frame, over ${frames} frames: ${list(name(asked))}` : null;
}

/** The canvas on three devices: { desktop: n, … }. */
export function pixels(measured) {
  const over = Object.entries(measured).filter(([device, n]) => n > LIMITS.pixels[device] * 1.01).map(([device, n]) => `${(n / 1e6).toFixed(2)} million on a ${device} (at most ${LIMITS.pixels[device] / 1e6})`);
  return over.length ? list(over) : null;
}

/** Frames without a picture, per engine: [{ engine, at, spread }]. */
export function blank(frames) {
  const empty = frames.filter((frame) => frame.spread < LIMITS.spread).map((frame) => `${frame.at} (${frame.engine})`);
  return empty.length ? `nothing to see at ${list(empty)}` : null;
}

/** The same positions in two engines: [{ at, mean, blown }]. */
export function engines(pairs) {
  const far = pairs.filter((pair) => pair.mean > LIMITS.engines || pair.blown > LIMITS.blown).map((pair) => `${pair.at} (${pair.mean.toFixed(1)} of 255 apart on average${pair.blown > LIMITS.blown ? `, ${(pair.blown * 100).toFixed(2)} % white in one and dark in the other` : ""})`);
  return far.length ? `the two engines draw different pictures at ${list(far)}` : null;
}

/** One card at one width, over its readable steps. */
function card({ name, width, longer, readable, path, jump, inside }) {
  const at = `"${name}" at ${width}`;
  if (!readable) return width >= 1280 ? `${at} is never readable` : null;
  if (inside / readable < LIMITS.inWindow) return `${at} is cut by the window for ${Math.round((1 - inside / readable) * 100)} % of the time it can be read`;
  if (jump > longer * LIMITS.jump) return `${at} jumps ${px(jump)} between two steps of scroll`;
  return path > longer * LIMITS.travel ? `${at} travels ${px(path)} while it can be read (at most ${px(longer * LIMITS.travel)})` : null;
}

export function cards(measured) {
  const found = measured.map(card).filter(Boolean);
  return found.length ? list(found) : null;
}

export const shift = ({ shift: value }) => (value > LIMITS.shift ? `the layout shifts by ${value.toFixed(3)} (at most ${LIMITS.shift})` : null);

/** Draw calls in the loop: while the reader looks, with the tab hidden, with the story scrolled away. */
export function stops({ seen, hidden, away }) {
  if (!seen) return "the loop draws nothing while the story is on screen";
  const on = [hidden && "the tab is hidden", away && "the story is scrolled away"].filter(Boolean);
  return on.length ? `the loop keeps drawing while ${on.join(" and while ")}` : null;
}

export function lost({ restored, mean }) {
  if (!restored) return "the scene does not come back after the graphics memory was taken away (webglcontextlost: preventDefault; webglcontextrestored: build it again)";
  return mean > LIMITS.restored ? `the scene that comes back is another picture (${mean.toFixed(1)} of 255 apart on average)` : null;
}

/** Every rule in the order it is reported, with what it reads of the measures; `pass` is the reading it comes from (scripts/lib/story-run.mjs). */
export const RULES = [
  { rule: "errors", pass: "photos", of: (m) => errors(m.errors) },
  { rule: "words", pass: "quiet", of: (m) => words(m.words, "without JavaScript") },
  { rule: "still", pass: "quiet", of: (m) => still(m.still) },
  { rule: "first-picture", pass: "photos", of: (m) => firstPicture(m.firstPicture) },
  { rule: "setup", pass: "setup", of: (m) => setup(m.setup) },
  { rule: "mid-scroll", pass: "photos", of: (m) => midScroll(m.midScroll) },
  { rule: "pixels", pass: "pixels", of: (m) => pixels(m.pixels) },
  { rule: "blank", pass: "photos", of: (m) => blank(m.frames) },
  { rule: "engines", pass: "photos", of: (m) => engines(m.pairs), both: true },
  { rule: "cards", pass: "cards", of: (m) => cards(m.cards) },
  { rule: "shift", pass: "shift", of: (m) => shift(m.shift) },
  { rule: "stops", pass: "stops", of: (m) => stops(m.stops) },
  { rule: "lost", pass: "lost", of: (m) => lost(m.lost) },
];

/** The rules a run holds the story to: all of them, or those asked for; the ones that compare engines only with both. Throws naming a rule there is none of. */
export function rulesFor(only, engines) {
  const wrong = only.find((name) => !RULES.some(({ rule }) => rule === name));
  if (wrong) throw new Error(`no rule ${wrong} (${RULES.map(({ rule }) => rule).join(", ")})`);
  return RULES.filter(({ rule, both }) => (!only.length || only.includes(rule)) && !(both && engines.length < 2));
}

/** What the rules say of what was measured: [{ rule, problem }], problem null where it holds. */
export const judge = (rules, measured) => rules.map(({ rule, of }) => ({ rule, problem: of(measured) }));
