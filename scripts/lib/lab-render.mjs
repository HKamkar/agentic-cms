// `lab render`: one scene to the file a page ships. A .svg is text work —
// the tokens resolved for one scheme, the animation kept, its still beside
// it — and needs no browser. A raster opens the bare page of the scene
// headless (the lab's own server on the loopback, or --url), seeks its
// animations frame by frame through window.lab (the clock the scrubber
// uses), photographs the <svg> at one box for every frame, and hands the
// frames to lab-encode.mjs; the still of a loop and the scene itself are
// written beside the file, so the asset can be reopened and re-rendered.
import fs from "node:fs";
import path from "node:path";
import { collectConsole, ffmpegPath, fontsReady, frames as awaitFrames, imagesReady, launch } from "./browser.mjs";
import { animates, followsTheme, listScenes, renderPlan, resolveTokenColors, resolveTokens, sceneMeta, siteTokens, stripAnimation } from "./lab.mjs";
import { checkFfmpeg, encodeAnimatedWebp, encodeStill, encodeVideo } from "./lab-encode.mjs";
import { startLabServer } from "./lab-server.mjs";
import { relative } from "./page-command.mjs";

const encode = (id) => id.split("/").map(encodeURIComponent).join("/");
const header = (scene) => `<!-- rendered by agentic-cms lab from ${scene}; edit the scene and render again -->\n`;
// A drawing in the page's ink is one scheme's ink once it is a file a page
// embeds (anything under public/): the report says so, because on a site
// with the theme toggle it will not read on the other ground — seen on the
// example's dark page. A render into src/config/icons/ is Icon data, which
// follows the theme, so it gets no note.
const themeNote = (svg, scheme, format, out, root) => (followsTheme(svg) && relative(root, out).startsWith("public/") ? `the scene paints in the page's ink, so this ${format} carries the ${scheme} scheme's; an <img> of it will not follow the site's theme — for a page with the toggle, ship it inline (icons add file:<name>), draw it in mid-tones that read on both grounds, or render one file per scheme` : null);

/** Photographs the bare page at every time: { frames (PNG buffers), width, height (device pixels), duration, console }. */
export async function captureScene({ base, scene, scheme, motion, scale, width, height, background, times: plan }) {
  const viewport = { width: Math.max(320, Math.ceil(width) + 32), height: Math.max(240, Math.ceil(height) + 32) };
  const { context, close } = await launch({ scheme, motion, scale, ...viewport });
  try {
    const page = await context.newPage();
    const consoleLines = collectConsole(page);
    await page.goto(`${base}/scene/${encode(scene)}?bare=1&scheme=${scheme}&background=${background}&width=${width}&height=${height}`, { waitUntil: "load" });
    await fontsReady(page);
    await imagesReady(page);
    const duration = await page.evaluate(() => window.lab.duration());
    const times = typeof plan === "function" ? plan(duration) : plan;
    const seek = async (t) => { await page.evaluate((t) => window.lab.seek(t), t); await awaitFrames(page, 2); };
    await seek(times[0]);
    // One box for every frame, rounded outward, so a loop's frames all have the same size whatever a transform does to the drawing.
    const box = await page.locator("svg.lab-scene").boundingBox();
    if (!box) throw new Error(`${scene}: the page shows no <svg>`);
    const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.x + box.width) - Math.floor(box.x), height: Math.ceil(box.y + box.height) - Math.floor(box.y) };
    const frames = [];
    for (const t of times) {
      await seek(t);
      frames.push(await page.screenshot({ clip, omitBackground: background === "transparent", type: "png" }));
    }
    return { frames, times, width: clip.width * scale, height: clip.height * scale, duration, console: consoleLines() };
  } finally { await close(); }
}

/** Writes the scene's .svg for one scheme (and its still when it animates); the report. */
function renderSvg({ scene, file, svg, out, scheme, tokens, poster, root }) {
  const { colors, current } = resolveTokenColors(tokens, scheme);
  const resolved = header(relative(process.cwd(), file)) + resolveTokens(svg, { colors, current, scheme }).trim() + "\n";
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, resolved);
  const still = poster && animates(svg) ? out.replace(/\.svg$/, "-still.svg") : null;
  if (still) fs.writeFileSync(still, stripAnimation(resolved).trim() + "\n");
  const meta = sceneMeta(svg);
  return { scene, file: out, still, source: null, format: "svg", width: meta.width, height: meta.height, frames: 1, fps: null, duration: meta.duration || null, scheme, background: null, bytes: fs.statSync(out).size, note: themeNote(svg, scheme, "file", out, root), console: [] };
}

/** The frames to their files: the still or the loop at --out, the loop's still and the raster's source beside it; { bytes, still, source } (absolute paths). */
async function writeRaster({ plan, shot, out, file, ffmpeg, paper, lossy, root }) {
  const still = plan.still ? path.resolve(root, plan.still) : null;
  const source = plan.source && path.resolve(root, plan.source) !== path.resolve(file) ? path.resolve(root, plan.source) : null;
  let bytes;
  if (plan.video) ({ bytes } = await encodeVideo(shot.frames, out, { ffmpeg, format: plan.format, fps: plan.fps, alpha: plan.background === "transparent", paper }));
  else if (plan.sequence) ({ bytes } = await encodeAnimatedWebp(shot.frames, out, { delay: plan.delay, lossy }));
  else ({ bytes } = await encodeStill(shot.frames[0], out, { format: plan.format, lossy, paper }));
  if (still) await encodeStill(shot.frames[0], still, { format: "webp", lossy, paper });
  if (source) { fs.mkdirSync(path.dirname(source), { recursive: true }); fs.copyFileSync(file, source); }
  return { bytes, still, source };
}

/** Renders one scene by the flags of `lab render`; returns the report (paths relative to root). Throws with the fix for anything the caller should exit 2 on. */
export async function renderScene(root, scene, flags) {
  const file = listScenes(root, { extra: flags.scenes ?? [] }).get(scene);
  if (!file) throw new Error(`${scene}: no such scene (a name under .parity/lab, or a path without .svg under a --scenes folder)`);
  if (!flags.out) throw new Error("--out names the file to write; its extension picks the format");
  const out = path.resolve(root, flags.out);
  if (path.resolve(file) === out) throw new Error(`${flags.out} is the scene itself; render to another file`);
  const svg = fs.readFileSync(file, "utf8");
  const meta = sceneMeta(svg);
  const tokens = siteTokens(root);
  const options = { at: flags.at, animate: flags.animate, frames: flags.frames, fps: flags.fps, background: flags.background, poster: !flags["no-poster"], source: !flags["no-source"] };
  const probe = renderPlan(out, options, { duration: 1, animated: animates(svg) });
  const rel = (f) => (f ? relative(root, f) : null);
  if (probe.format === "svg") { const report = renderSvg({ scene, file, svg, out, scheme: flags.scheme, tokens, poster: options.poster, root }); return { ...report, file: rel(out), still: rel(report.still) }; }

  const { paper } = resolveTokenColors(tokens, flags.scheme);
  const ffmpeg = probe.video ? checkFfmpeg(ffmpegPath(), { format: probe.format, alpha: probe.background === "transparent" }) : null;
  const width = flags.width > 0 ? flags.width : meta.width;
  const height = Math.max(1, Math.round((width * meta.height) / meta.width));
  const server = flags.url ? null : await startLabServer({ root, extra: flags.scenes ?? [] });
  let plan;
  try {
    // The plan waits for the page: a scene that declares no duration gets it from its animations there.
    const shot = await captureScene({
      base: (flags.url ?? server.url).replace(/\/$/, ""), scene, scheme: flags.scheme, motion: !flags.reduced, scale: flags.scale, width, height, background: probe.background,
      times: (measured) => { plan = renderPlan(out, options, { duration: flags.duration > 0 ? flags.duration : meta.duration || measured, animated: animates(svg) }); return plan.times; },
    });
    const { bytes, still, source } = await writeRaster({ plan, shot, out, file, ffmpeg, paper, lossy: flags.lossy, root });
    const span = plan.sequence ? plan.times[plan.times.length - 1] - plan.times[0] + 1 / plan.fps : null;
    return { scene, file: rel(out), still: rel(still), source: rel(source), format: plan.format, width: shot.width, height: shot.height, frames: shot.frames.length, fps: plan.sequence ? plan.fps : null, duration: span, scheme: flags.scheme, background: plan.background, bytes, note: themeNote(svg, flags.scheme, plan.format, out, root), console: shot.console };
  } finally { server?.close(); }
}
