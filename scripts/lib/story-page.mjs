// What `agentic-cms story` runs inside the page: the instruments, put there
// before its scripts, and the readings taken from it. Each function is sent to
// the page as text, so it uses nothing of this module.

/**
 * Before the page's scripts: the test hook asked for (`window.__storyTest`),
 * every WebGL call counted by what it is (a draw, something made, a question),
 * the programs linked when the first picture is marked, the long tasks and the
 * layout shifts, in `window.__storyLog`. `draws: false` counts the draw calls
 * and leaves them out.
 */
export function INSTRUMENT({ loop, draws }) {
  window.__storyTest = { loop };
  const log = (window.__storyLog = { on: draws, draws: 0, made: {}, asked: {}, linked: 0, first: null, shift: 0, blocked: 0 });
  const DRAW = /^draw(Arrays|Elements|RangeElements)/, MADE = /^(create(?!Query|Sync)|compileShader|linkProgram|texStorage|texImage|compressedTexImage|copyTexImage|renderbufferStorage|bufferData$)/;
  const ASKED = /^(get(?!Query|Sync|Extension$|ContextAttributes)|is(?!ContextLost)|readPixels|checkFramebufferStatus|finish$)/, DISJOINT = 0x8fbb; // the timer's own question
  const count = (into, name) => { into[name] = (into[name] ?? 0) + 1; };
  for (const proto of [window.WebGLRenderingContext, window.WebGL2RenderingContext].map((c) => c?.prototype).filter(Boolean)) for (const name of Object.getOwnPropertyNames(proto)) {
    const call = Object.getOwnPropertyDescriptor(proto, name)?.value;
    if (typeof call !== "function" || !(DRAW.test(name) || MADE.test(name) || ASKED.test(name))) continue;
    proto[name] = function (...args) {
      if (DRAW.test(name)) { log.draws++; if (!log.on) return undefined; }
      else if (MADE.test(name)) { count(log.made, name); if (name === "linkProgram") log.linked++; }
      else if (!(name === "getParameter" && args[0] === DISJOINT)) count(log.asked, name);
      return call.apply(this, args);
    };
  }
  const mark = Performance.prototype.mark; // counted as it is marked: the clock's step is wide enough to hold the next link too
  Performance.prototype.mark = function (name, ...rest) {
    if (name === "story:first-picture") log.first ??= log.linked;
    return mark.call(this, name, ...rest);
  };
  const watch = (type, each) => { try { new PerformanceObserver((entries) => entries.getEntries().forEach(each)).observe({ type, buffered: true }); } catch { /* an engine without it */ } };
  watch("longtask", (entry) => { log.blocked += Math.max(0, entry.duration - 50); });
  watch("layout-shift", (entry) => { if (!entry.hadRecentInput) log.shift += entry.value; });
}

/** What the hook lacks, in words; null when it has everything. */
export function LACKS() {
  const { length, scenes, ready, render } = window.__story;
  const lacks = [!(length > 0) && "length", !(Array.isArray(scenes) && scenes.length && scenes.every((s) => s.id && s.to > s.from)) && "scenes of { id, from, to }", typeof ready?.then !== "function" && "ready (a promise)", typeof render !== "function" && "render(position, seconds, quality)"].filter(Boolean);
  return lacks.length ? lacks.join(", ") : null;
}

/** The hook's description once the story is ready: { length, scenes, programs }; programs null without the mark. */
export async function DESCRIBE() {
  const { length, scenes, ready } = window.__story;
  await ready;
  return { length, scenes: scenes.map(({ id, from, to }) => ({ id, from, to })), programs: window.__storyLog.first };
}

/** One frame drawn and on the screen: inside an animation frame, or WebKit photographs the frame before it. */
export async function PRESENT([at, seconds]) {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  for (let i = 0; i < 2; i++) { await frame(); window.__story.render(at, seconds, 1); }
  await frame();
  await frame();
}

/** The page scrolled to a position of the story, and that frame drawn. */
export async function SCROLL_TO(at) {
  const story = document.querySelector("[data-story]");
  scrollTo(0, story.getBoundingClientRect().top + scrollY + at * innerHeight);
  window.__story.render(at, 20 + at, 1);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** The headings and paragraphs of the story a screen reader meets: [{ text, visible }]. */
export function WORDS() {
  const seen = (el) => { const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true }); };
  const all = [...document.querySelectorAll("[data-story] :is(h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,figcaption)")].filter((el) => !el.closest("[aria-hidden='true'],[hidden]"));
  return all.map((el) => ({ text: el.textContent.replace(/\s+/g, " ").trim(), visible: seen(el) })).filter(({ text }) => text);
}

/** What was made and asked while `positions` were drawn, and how many draw calls were seen: { made, asked, draws, frames }. */
export function MID_SCROLL(positions) {
  const log = window.__storyLog, story = window.__story;
  Object.assign(log, { on: false, made: {}, asked: {}, draws: 0 });
  positions.forEach((at, i) => story.render(at, 20 + i * 0.1, 1));
  const { made, asked, draws } = log;
  log.on = true;
  return { made, asked, draws, frames: positions.length };
}

/** Every card's way over its scene, 12 px of scroll at a time: [{ name, readable, inside, path, jump }]. */
export function CARDS() {
  const story = window.__story, step = 12 / innerHeight, cards = [...document.querySelectorAll("[data-story-card]")].map((el) => ({ el, name: "", readable: 0, inside: 0, path: 0, jump: 0, last: null }));
  const opacity = (el) => { let value = 1; for (let e = el; e; e = e.parentElement) { const style = getComputedStyle(e); if (style.display === "none" || style.visibility === "hidden") return 0; value *= Number(style.opacity); } return value; };
  const read = (card) => {
    if (opacity(card.el) < 0.5) { card.last = null; return; }
    const box = card.el.getBoundingClientRect(), at = [box.left + box.width / 2, box.top + box.height / 2], moved = card.last ? Math.hypot(at[0] - card.last[0], at[1] - card.last[1]) : 0;
    card.name ||= [...card.el.childNodes].map((node) => node.textContent.trim()).filter(Boolean).join(", ").slice(0, 40);
    card.readable++;
    if (box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1) card.inside++;
    card.path += moved; card.jump = Math.max(card.jump, moved); card.last = at;
  };
  for (const [i, { from, to }] of story.scenes.entries()) for (let at = from, end = story.scenes[i + 1]?.from ?? to; at < end; at += step) { story.render(at, 20 + (at - from) * 2.2, 1); cards.forEach(read); }
  return cards.map(({ name, readable, inside, path, jump, el }) => ({ name: name || el.textContent.trim().slice(0, 40), readable, inside, path, jump }));
}

/** The draw calls of `ms` milliseconds. */
export async function DRAWS(ms) {
  const before = window.__storyLog?.draws ?? 0;
  await new Promise((resolve) => setTimeout(resolve, ms));
  return (window.__storyLog?.draws ?? 0) - before;
}

/** The tab as if it were hidden, or not. */
export function HIDE(hidden) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** The story scrolled out of the window: room below it, and the page at its end. */
export function AWAY() {
  const room = document.createElement("div");
  room.style.height = "300vh";
  document.body.append(room);
  scrollTo(0, document.documentElement.scrollHeight);
}

const CANVAS = `document.querySelector("[data-story-stage] canvas, [data-story] canvas")`;
/** The scene's canvas size in pixels. */
export const CANVAS_PIXELS = `(() => { const c = ${CANVAS}; return c ? c.width * c.height : 0; })()`;
/** The graphics memory taken away, and given back. */
export const LOSE = `(() => { const c = ${CANVAS}, gl = c.getContext("webgl2") || c.getContext("webgl"); window.__storyLost = gl.getExtension("WEBGL_lose_context"); window.__storyLost.loseContext(); })()`;
export const RESTORE = `window.__storyLost.restoreContext()`;

/** The scene alone in the window, without its words. */
export const SCENE_ONLY = "body *{visibility:hidden!important}[data-story] canvas{visibility:visible!important;transition:none!important}";
/** The stage alone, without the scene and without its words. */
export const GROUND_ONLY = "body *{visibility:hidden!important}[data-story-stage]{visibility:visible!important}[data-story-stage] *{visibility:hidden!important}";
