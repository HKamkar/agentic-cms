// Opens the page of a motion story the way its readers do and measures it:
// one pass per question, each in a page of its own, all against the hook the
// story carries (docs/motion-story.md § The check). scripts/lib/story-rules.mjs
// judges what comes back. Counts and pictures, not frame rates: a machine
// without a graphics card draws the same calls and the same pixels, slower.
import sharp from "sharp";
import { addStyle, browserPath, inPage, NO_BUILD, requireBrowser, Stall } from "./browser.mjs";
import { AWAY, CANVAS_PIXELS, CARDS, DESCRIBE, DRAWS, GROUND_ONLY, HIDE, INSTRUMENT, LACKS, LOSE, MID_SCROLL, PRESENT, RESTORE, SCENE_ONLY, SCROLL_TO, WORDS } from "./story-page.mjs";

/** The page carries no hook, or its story never came up: one finding, and nothing else can be measured. */
export class NoStory extends Error {}

const SOFTWARE_GL = ["--no-sandbox", "--font-render-hinting=none", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const SMALL = { width: 480, height: 300 }, FRAME = { width: 960, height: 600 };
/** The windows the cards are read in. */
export const WINDOWS = [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844, touch: true }];
const DEVICES = { desktop: { width: 1440, height: 900, scale: 2 }, tablet: { width: 1024, height: 1366, scale: 2, touch: true }, phone: { width: 390, height: 844, scale: 3, touch: true } };
const NOISE = /GPU stall due to ReadPixels|Failed to load resource/;

/** A browser of an engine that can draw WebGL without a graphics card; exit 2 naming the fix when it is not installed. */
export async function browserFor(engine) {
  const pw = await requireBrowser(), executablePath = browserPath(engine);
  if (!executablePath) { console.error(NO_BUILD[engine]); process.exit(2); }
  return engine === "webkit" ? pw.webkit.launch({ executablePath }) : pw.chromium.launch({ executablePath, args: SOFTWARE_GL });
}

const contextOptions = ({ width, height, scale = 1, touch = false }, options) => ({ viewport: { width, height }, deviceScaleFactor: scale, hasTouch: touch, reducedMotion: "no-preference", ...options });

/** A page of the story, its instruments in place; `up` waits for the hook and for everything behind it. */
async function open(browser, url, { view = FRAME, loop = false, draws = true, options = {}, up = true, slow = 1, wait = 60 } = {}) {
  const context = await browser.newContext(contextOptions(view, options));
  await context.addInitScript(INSTRUMENT, { loop, draws });
  const page = await context.newPage(), lines = [];
  page.on("pageerror", (error) => lines.push(error.message.split("\n")[0]));
  page.on("console", (message) => { const text = message.text().slice(0, 200); if (!NOISE.test(text) && (message.type() === "error" || (message.type() === "warning" && /webgl|shader|GL_/i.test(text)))) lines.push(text); });
  if (slow > 1) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: slow });
  await page.goto(url, { waitUntil: "load" });
  if (!up) return { page, lines, close: () => context.close() };
  const there = await page.waitForFunction(() => window.__story, null, { timeout: wait * 1000 }).then(() => true, () => false);
  if (!there) throw new NoStory(`no window.__story after ${wait} s${lines.length ? `; the page logged: ${lines.slice(0, 2).join("; ")}` : ""}`);
  const lacks = await page.evaluate(LACKS);
  if (lacks) throw new NoStory(`window.__story has no ${lacks}`);
  return { page, lines, hook: await described(page, wait), close: () => context.close() };
}

/** The hook's description; a `ready` that never comes, or fails, is the story not coming up. */
async function described(page, wait) {
  try { return await inPage(page, "window.__story.ready", wait * 1000, DESCRIBE); } catch (error) { throw new NoStory(error instanceof Stall ? `window.__story.ready did not come in ${wait} s` : `window.__story.ready failed: ${error.message.split("\n")[0]}`); }
}

/** The positions a story is photographed at: three in every scene, and each hand-over. */
export function positionsOf(scenes) {
  return scenes.flatMap(({ id, from, to }, i) => {
    const inside = [0.15, 0.5, 0.9].map((share) => ({ name: `${id} ${share * 100}%`, at: from + (to - from) * share, scene: id }));
    const next = scenes[i + 1];
    return next ? [...inside, { name: `${id} to ${next.id}`, at: (to + next.from) / 2, scene: id }] : inside;
  });
}

const shot = async (page, at, seconds) => {
  await page.evaluate(PRESENT, [at, seconds]);
  return sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
};
const spreadOf = async ({ data, info }) => (await sharp(data, { raw: info }).greyscale().stats()).channels[0].stdev;

/** How far two raw frames are apart: the mean difference, and the share white in one and dark in the other. */
export function apart(a, b) {
  let sum = 0, blown = 0;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i] + a[i + 1] + a[i + 2], y = b[i] + b[i + 1] + b[i + 2];
    sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    if ((x > 740 && y < 240) || (y > 740 && x < 240)) blown++;
  }
  return { mean: sum / a.length, blown: (blown * 3) / a.length };
}

/** One engine's frames, with what its page said meanwhile, the frames' own calls and the first picture. */
async function photograph(browser, url, engine, wait) {
  const { page, lines, hook, close } = await open(browser, url, { wait });
  const ground = await stage(page), frames = [], style = await styled(page, SCENE_ONLY);
  for (const [i, { name, at }] of positionsOf(hook.scenes).entries()) { const raw = await shot(page, at, 20 + i); frames.push({ engine, at: name, raw, spread: await spreadOf(raw) }); }
  await style();
  const calls = await page.evaluate(MID_SCROLL, everywhere(hook));
  await close();
  return { hook, lines, frames, calls, firstPicture: { programs: hook.programs, ground } };
}

/** Positions all along a story, 24 a scene. */
const everywhere = ({ scenes, length }) => scenes.flatMap(({ from }, i) => { const end = scenes[i + 1]?.from ?? length; return Array.from({ length: 24 }, (_, n) => from + ((end - from) * n) / 24); });

/** A style in the page, and the way to take it out. */
async function styled(page, css) {
  await addStyle(page, css);
  return () => page.evaluate((text) => { [...document.querySelectorAll("style")].find((el) => el.textContent === text)?.remove(); }, css);
}

/** How much the stage alone varies: what a reader sees before the scene is drawn. */
async function stage(page) {
  const remove = await styled(page, GROUND_ONLY), raw = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  await remove();
  return spreadOf(raw);
}

/** The words of the live page, without JavaScript, and with reduced motion, where nothing is drawn once it stands. */
async function quiet(browser, url, wait) {
  const full = await open(browser, url, { draws: false, wait }), live = await full.page.evaluate(WORDS);
  await full.close();
  const bare = await open(browser, url, { up: false, options: { javaScriptEnabled: false } }), without = await bare.page.evaluate(WORDS);
  await bare.close();
  const calm = await open(browser, url, { up: false, options: { reducedMotion: "reduce" } });
  for (let still = 0, n = 0; still < 2 && n < 12; n++) still = (await calm.page.evaluate(DRAWS, 1000)) ? 0 : still + 1;
  const reduced = { without: await calm.page.evaluate(WORDS), draws: await calm.page.evaluate(DRAWS, 1000) };
  await calm.close();
  return { words: { live, without }, still: { live, ...reduced } };
}

async function readCards(browser, url, wait) {
  const out = [];
  for (const view of WINDOWS) {
    const { page, close } = await open(browser, url, { view, draws: false, wait });
    const cards = await page.evaluate(CARDS);
    out.push(...cards.map((card) => ({ ...card, width: view.width, longer: Math.max(view.width, view.height) })));
    await close();
  }
  return out;
}

async function countPixels(browser, url, wait) {
  const out = {};
  for (const [device, view] of Object.entries(DEVICES)) {
    const { page, close } = await open(browser, url, { view, draws: false, wait });
    out[device] = await page.evaluate(CANVAS_PIXELS);
    await close();
  }
  return out;
}

/** The setup on a processor slowed 4×, the draw calls left out: the best of five, since a machine busy with something else only adds. */
async function timeSetup(browser, url, wait, enough) {
  let blocked = Infinity;
  for (let run = 0; run < 5 && blocked > enough; run++) {
    const { page, close } = await open(browser, url, { draws: false, slow: 4, wait });
    blocked = Math.min(blocked, await page.evaluate(() => window.__storyLog.blocked));
    await close();
  }
  return { blocked };
}

/** The layout of the page as it is, scrolled from end to end: what is hidden for a photograph shifts nothing. */
async function readShift(browser, url, wait) {
  const { page, hook, close } = await open(browser, url, { view: WINDOWS[1], draws: false, wait });
  await page.waitForTimeout(500);
  for (let i = 0; i <= 40; i++) await page.evaluate(SCROLL_TO, (hook.length * i) / 40);
  await page.waitForTimeout(300);
  const shift = await page.evaluate(() => window.__storyLog.shift);
  await close();
  return { shift };
}

/** The loop on its own: drawing for a reader, and for nobody. */
async function watchLoop(browser, url, wait) {
  const { page, close } = await open(browser, url, { view: SMALL, loop: true, wait });
  const draws = async () => { await page.waitForTimeout(400); return page.evaluate(DRAWS, 900); };
  const seen = await draws();
  await page.evaluate(HIDE, true);
  const hidden = await draws();
  await page.evaluate(HIDE, false);
  await page.evaluate(AWAY);
  const away = await draws();
  await close();
  return { seen, hidden, away };
}

async function takeAway(browser, url, wait) {
  const { page, hook, close } = await open(browser, url, { view: SMALL, wait });
  const { from, to } = hook.scenes[Math.min(1, hook.scenes.length - 1)], at = (from + to) / 2;
  await addStyle(page, SCENE_ONLY);
  const before = await shot(page, at, 20);
  await page.evaluate(LOSE);
  await page.waitForTimeout(300);
  await page.evaluate(RESTORE);
  let mean = Infinity, restored = false;
  for (let i = 0; i < 24 && !(restored && mean < 1); i++) {
    await page.waitForTimeout(500);
    const after = await shot(page, at, 20).catch(() => null);
    if (after && (await spreadOf(after)) > 1.5) { restored = true; mean = apart(before.data, after.data).mean; }
  }
  await close();
  return { restored, mean: restored ? mean : null };
}

const pairsOf = (a, b) => a.map((frame, i) => ({ at: frame.at, ...apart(frame.raw.data, b[i].raw.data) }));

async function photos(browsers, url, wait) {
  const taken = {};
  for (const [engine, browser] of Object.entries(browsers)) taken[engine] = await photograph(browser, url, engine, wait);
  const { chromium, webkit } = taken, all = Object.entries(taken);
  return {
    hook: chromium.hook, errors: Object.fromEntries(all.map(([engine, { lines }]) => [engine, lines])), firstPicture: chromium.firstPicture, midScroll: chromium.calls,
    frames: all.flatMap(([, { frames }]) => frames), pairs: webkit ? pairsOf(chromium.frames, webkit.frames) : null,
  };
}

/** Each pass: what the run is told, and what it adds to the measures. */
const PASSES = {
  photos: ["the scenes, photographed", (browsers, url, { wait }) => photos(browsers, url, wait)],
  quiet: ["the words without JavaScript and with reduced motion", ({ chromium }, url, { wait }) => quiet(chromium, url, wait)],
  cards: ["the cards at four widths", async ({ chromium }, url, { wait }) => ({ cards: await readCards(chromium, url, wait) })],
  pixels: ["the canvas on three devices", async ({ chromium }, url, { wait }) => ({ pixels: await countPixels(chromium, url, wait) })],
  setup: ["the setup, the processor slowed 4×", async ({ chromium }, url, { wait, blocked }) => ({ setup: await timeSetup(chromium, url, wait, blocked) })],
  shift: ["the layout, scrolled from end to end", async ({ chromium }, url, { wait }) => ({ shift: await readShift(chromium, url, wait) })],
  stops: ["the loop nobody sees", async ({ chromium }, url, { wait }) => ({ stops: await watchLoop(chromium, url, wait) })],
  lost: ["the graphics memory taken away", async ({ chromium }, url, { wait }) => ({ lost: await takeAway(chromium, url, wait) })],
};

/** What the rules given read of the story at `url`, in the engines given (chromium first); `wait` is how long it may take to come up, `blocked` a setup short enough to stop timing at, and `say` is told each pass. */
export async function measure({ url, engines, rules, wait, blocked, say = () => {} }) {
  const browsers = {}, measured = {};
  try {
    for (const engine of engines) browsers[engine] = await browserFor(engine);
    for (const [pass, [what, read]] of Object.entries(PASSES)) {
      if (!rules.some((rule) => rule.pass === pass)) continue;
      say(what);
      Object.assign(measured, await read(browsers, url, { wait, blocked }));
    }
    return measured;
  } finally { await Promise.all(Object.values(browsers).map((browser) => browser.close())); }
}

/** An engine's frames as one picture, four in a row. */
export async function sheet(frames, file, cell = 480) {
  const tiles = await Promise.all(frames.map(({ raw }) => sharp(raw.data, { raw: raw.info }).resize(cell).png().toBuffer({ resolveWithObject: true })));
  const height = tiles[0].info.height, gap = 4;
  await sharp({ create: { width: cell * 4 + gap * 3, height: (height + gap) * Math.ceil(tiles.length / 4) - gap, channels: 3, background: "#777" } })
    .composite(tiles.map(({ data }, i) => ({ input: data, left: (i % 4) * (cell + gap), top: Math.floor(i / 4) * (height + gap) }))).toFile(file);
}
