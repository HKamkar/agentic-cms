import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { KINDS, LAB_DIR, parseSizes, readThemeTokens, resolveTokens, sceneMeta, sceneTemplate, siteTokens, stripAnimation, tokensCss } from "./lab.mjs";
import { ENLARGED, LAB_API, bareHtml, indexHtml, sceneHtml } from "./lab-page.mjs";
import { ICON_SIZES, startLabServer } from "./lab-server.mjs";

const GLOBALS = `@layer theme, base;
@theme static {
  --breakpoint-*: initial;
  /* a comment with --color-nope: #000; inside */
  --font-sans: system-ui, "Segoe UI", sans-serif;
  --font-label: var(--font-sans);
  --color-*: initial;
  --color-paper: light-dark(#ffffff, #121212);
  --color-ink: light-dark(#000000, #f2f2f2);
  --text-h1: 2.5rem;
  --radius-*: initial;
}
:root { --color-later: #abc; }`;

const site = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lab-"));
  fs.mkdirSync(path.join(root, "src/app"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/app/globals.css"), GLOBALS);
  return root;
};
const get = (url) => new Promise((resolve, reject) => http.get(url, (res) => { let body = ""; res.setEncoding("utf8"); res.on("data", (c) => { body += c; }); res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], body })); }).on("error", reject));

test("the theme tokens: every --color-* and --font-* of the @theme block, verbatim, resets and comments skipped, nothing outside the block", () => {
  const tokens = readThemeTokens(GLOBALS);
  assert.deepEqual(tokens, { "--font-sans": 'system-ui, "Segoe UI", sans-serif', "--font-label": "var(--font-sans)", "--color-paper": "light-dark(#ffffff, #121212)", "--color-ink": "light-dark(#000000, #f2f2f2)" });
  assert.deepEqual(readThemeTokens("body { color: red }"), {});
  assert.match(tokensCss(tokens), /^:root \{\n {2}color-scheme: light dark;\n {2}--font-sans: system-ui/);
  assert.match(tokensCss({}), /--color-paper: Canvas;[\s\S]*--color-ink: CanvasText;/, "no tokens: the system colours, never a hex");
  const root = site();
  assert.equal(siteTokens(root)["--color-ink"], "light-dark(#000000, #f2f2f2)");
  assert.deepEqual(siteTokens(os.tmpdir()), {});
  fs.rmSync(root, { recursive: true, force: true });
});

test("the templates: one per kind, a valid root with a size, on the kit's contracts, no double hyphen in a comment (XML forbids it)", () => {
  for (const kind of KINDS) {
    const svg = sceneTemplate(kind, "spin-a");
    assert.match(svg, /^<!-- agentic-cms lab: /);
    assert.doesNotMatch(svg.match(/<!--[\s\S]*?-->/)[0].slice(4, -3), /--/, `${kind}: a comment with --`);
    const meta = sceneMeta(svg);
    assert.ok(meta.width > 0 && meta.height > 0 && meta.viewBox, kind);
    assert.doesNotMatch(svg, /#[0-9a-f]{3,6}\b/i, `${kind}: a hex colour`);
  }
  assert.match(sceneTemplate("icon", "x"), /viewBox="0 0 24 24"[^>]*stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/);
  assert.match(sceneTemplate("loop", "spin-a"), /@keyframes spin-a-turn[\s\S]*prefers-reduced-motion: reduce[\s\S]*<animate /);
  assert.equal(sceneMeta(sceneTemplate("loop", "x")).duration, 2);
  assert.throws(() => sceneTemplate("photo", "x"), /not a kind of scene \(icon, mark, loop\)/);
  assert.throws(() => sceneTemplate("icon", "Bad Name"), /lowercase letters, digits and hyphens/);
});

test("resolveTokens writes one scheme's hex into the file; stripAnimation leaves a still", () => {
  const svg = `<!-- agentic-cms lab: loop; a note -->\n<svg viewBox="0 0 8 8" data-duration="2"><style>@keyframes x-turn { from { transform: rotate(0) } to { transform: rotate(1turn) } } .x { animation: x-turn 2s linear infinite; transform-box: fill-box; } @media (prefers-reduced-motion: reduce) { .x { animation: none; } }</style><rect class="x" fill="var(--color-fill, none)" stroke="currentColor"/><circle fill="light-dark(#111, #eee)"><animate attributeName="cx" values="0;8" dur="2s" repeatCount="indefinite"/></circle><path stroke="var(--color-muted)"/></svg>`;
  const dark = resolveTokens(svg, { colors: { "--color-fill": "#2a2a2a", "--color-ink": "#f2f2f2" }, scheme: "dark" });
  assert.doesNotMatch(dark, /agentic-cms lab|data-duration|currentColor|light-dark/);
  assert.match(dark, /fill="#2a2a2a" stroke="#f2f2f2"/);
  assert.match(dark, /fill="#eee"/);
  assert.match(dark, /stroke="var\(--color-muted\)"/, "a token the page could not resolve is left alone");
  assert.match(resolveTokens(svg, { colors: {}, current: "#000" }), /fill="none" stroke="#000"[\s\S]*fill="#111"/, "the fallback of a var() and the light side");
  const still = stripAnimation(svg);
  assert.doesNotMatch(still, /<animate|@keyframes|animation:/);
  assert.match(still, /transform-box: fill-box;[\s\S]*prefers-reduced-motion/, "the rest of the style survives");
});

test("parseSizes", () => {
  assert.deepEqual(parseSizes("24,40, 64"), [24, 40, 64]);
  assert.deepEqual(parseSizes(""), []);
  assert.throws(() => parseSizes("24,big"), /big is not a size/);
});

test("the pages: the bare page holds the scene in one scheme at its size with the seek API; the scene page frames both schemes and shows the file as an <img>; the index lists every scene", () => {
  const svg = '<?xml version="1.0"?><!-- c --><svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32" data-duration="2"><rect/></svg>';
  const tokens = { "--color-ink": "light-dark(#000, #fff)" };
  const bare = bareHtml("spin", svg, { tokens, scheme: "dark", background: "paper", width: 32, height: 16, pad: 8 });
  assert.match(bare, /--color-ink: light-dark\(#000, #fff\);/);
  assert.match(bare, /body \{ margin: 0; padding: 8px; display: inline-block; color-scheme: dark; background: var\(--color-paper\)/);
  assert.match(bare, /svg\.lab-scene \{ display: block; width: 32px; height: 16px; \}/);
  assert.match(bare, /<svg class="lab-scene" xmlns/);
  assert.doesNotMatch(bare, /<\?xml|<!-- c -->/);
  assert.ok(bare.includes(LAB_API) && LAB_API.includes("setCurrentTime(t)") && LAB_API.includes("getAnimations()"));
  const page = sceneHtml("spin", { file: ".parity/lab/spin.svg", meta: sceneMeta(svg), tokens, sizes: [24, 64] });
  assert.match(page, /id="lab-time"/);
  assert.doesNotMatch(sceneHtml("still", { file: "x.svg", meta: sceneMeta(svg), tokens, animated: false }), /id="lab-time"/, "no scrubber for a scene that does not animate");
  assert.match(page, /<iframe class="lab-frame"[^>]*src="\/scene\/spin\?bare=1&scheme=light&background=paper&width=24&pad=8" width="40" height="28">/);
  assert.match(page, /<iframe class="lab-frame"[^>]*scheme=dark&background=paper&width=64/);
  assert.match(page, /64 px \(natural\)/);
  assert.match(page, /<img class="lab-img" src="\/files\/spin\.svg" width="24" height="12" alt="">/);
  assert.match(page, /new EventSource\("\/events"\)/);
  assert.match(page, /<iframe class="lab-frame" title="spin dark enlarged" src="\/scene\/spin\?bare=1&scheme=dark&background=paper&fit=1" style="aspect-ratio: 64 \/ 32">/, "one enlarged view, scrubbed with the rest");
  assert.match(page, new RegExp(`enlarged, up to ${ENLARGED} px`));
  assert.match(page, /<strong>animated<\/strong> · <a href="\/scene\/spin\?still=1">still<\/a>/);
  assert.match(page, /<button id="lab-replay" type="button"/);
  assert.match(page, /img\.lab-img[\s\S]*"\?replay=" \+ count/, "one new URL for every copy");
  const big = sceneHtml("hero", { file: "x.svg", meta: { width: ENLARGED, height: 320 }, tokens });
  assert.doesNotMatch(big, /fit=1|lab-row lab-enlarged/, "no enlargement for a scene already that wide");
  const plain = sceneHtml("mark", { file: "x.svg", meta: sceneMeta(svg), tokens, animated: false });
  assert.doesNotMatch(plain, /lab-replay|still<\/a>/, "nothing to replay or hold still");
  const held = sceneHtml("spin", { file: ".parity/lab/spin.svg", meta: sceneMeta(svg), tokens, sizes: [24], still: true });
  assert.doesNotMatch(held, /id="lab-time"|id="lab-replay"/);
  assert.match(held, /<a href="\/scene\/spin">animated<\/a> · <strong>still<\/strong>/);
  assert.match(held, /src="\/scene\/spin\?bare=1&scheme=light&background=paper&width=24&pad=8&still=1"/);
  assert.match(held, /fit=1&still=1/);
  assert.match(held, /<img class="lab-img" src="\/files\/spin\.svg\?still=1" width="24"/);
  assert.match(held, /what a reduced-motion reader gets/);
  const fit = bareHtml("spin", svg, { tokens, background: "paper", fit: true });
  assert.match(fit, /display: block; color-scheme: light/);
  assert.match(fit, /svg\.lab-scene \{ display: block; width: 100%; height: auto; \}/, "the enlarged frame's width, the viewBox's ratio");
  const index = indexHtml(new Map([["a/b", "public/a/b.svg"], ["spin", ".parity/lab/spin.svg"]]), { tokens, metas: new Map([["spin", sceneMeta(svg)]]) });
  assert.match(index, /<a href="\/scene\/a\/b">a\/b<\/a>/);
  assert.match(index, /<img src="\/files\/spin\.svg" width="64" height="32" alt="">/);
  assert.match(index, /64×32 · 2s/);
});

test("the server: the index, a scene page and its bare page, the file by id (and still), nothing outside the whitelist, and a change event after a save", async () => {
  const root = site();
  fs.mkdirSync(path.join(root, LAB_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, LAB_DIR, "spin.svg"), sceneTemplate("loop", "spin"));
  fs.mkdirSync(path.join(root, "public/images"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/images/mark.svg"), sceneTemplate("mark", "mark"));
  fs.writeFileSync(path.join(root, "public/images/secret.svg"), "<svg/>");
  fs.writeFileSync(path.join(root, "public/images/wide.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100"><rect/></svg>');
  const server = await startLabServer({ root, extra: ["public/images/mark.svg", "public/images/wide.svg"], watch: true, sizes: [24] });
  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    const index = await get(`${server.url}/`);
    assert.equal(index.status, 200);
    assert.match(index.body, /href="\/scene\/spin"[\s\S]*href="\/scene\/public\/images\/mark"/);
    assert.match(index.body, /\.parity\/lab\/spin\.svg/);
    const page = await get(`${server.url}/scene/spin`);
    assert.match(page.body, /light-dark\(#ffffff, #121212\)/, "the site's tokens");
    assert.match(page.body, /width=24&pad=8/);
    const bare = await get(`${server.url}/scene/public/images/mark?bare=1&scheme=dark&width=16`);
    assert.match(bare.body, /color-scheme: dark[\s\S]*width: 16px; height: 16px/);
    assert.match((await get(`${server.url}/scene/public/images/wide`)).body, /width=24&pad=8/, "the sizes given apply to a scene of any width");
    const fit = await get(`${server.url}/scene/public/images/mark?bare=1&fit=1`);
    assert.match(fit.body, /width: 100%; height: auto;/);
    const file = await get(`${server.url}/files/spin.svg`);
    assert.equal(file.type, "image/svg+xml");
    assert.match(file.body, /agentic-cms lab: loop/);
    assert.match(file.body, /<animate [\s\S]*@keyframes|@keyframes[\s\S]*<animate /);
    assert.equal((await get(`${server.url}/files/spin.svg?replay=3`)).body, file.body, "a replay is the same file under a new URL");
    const stillFile = await get(`${server.url}/files/spin.svg?still=1`);
    assert.equal(stillFile.body, stripAnimation(file.body));
    assert.doesNotMatch(stillFile.body, /<animate |@keyframes/);
    const stillPage = await get(`${server.url}/scene/spin?still=1`);
    assert.match(stillPage.body, /&still=1/);
    assert.doesNotMatch(stillPage.body, /id="lab-time"/);
    assert.doesNotMatch((await get(`${server.url}/scene/spin?bare=1&still=1`)).body, /<animate |@keyframes/);
    assert.equal((await get(`${server.url}/files/public/images/secret.svg`)).status, 404, "not listed, not served");
    assert.equal((await get(`${server.url}/files/..%2Fsrc%2Fapp%2Fglobals.css.svg`)).status, 404);
    assert.equal((await get(`${server.url}/scene/nope`)).status, 404);
    assert.equal((await get(`${server.url}/favicon.ico`)).status, 204);
    const event = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no change event in 3s")), 3000);
      http.get(`${server.url}/events`, (res) => { res.setEncoding("utf8"); res.on("data", (chunk) => { if (chunk.includes("data: change")) { clearTimeout(timer); res.destroy(); resolve(); } }); });
    });
    await new Promise((r) => setTimeout(r, 150));
    fs.writeFileSync(path.join(root, LAB_DIR, "new.svg"), "<svg viewBox='0 0 1 1'/>");
    await event;
    assert.match((await get(`${server.url}/`)).body, /href="\/scene\/new"/, "re-listed after the save");
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the server without --sizes: an icon-sized scene at the icon sizes, a bigger one at its own size only", async () => {
  const root = site();
  fs.mkdirSync(path.join(root, LAB_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, LAB_DIR, "spin.svg"), sceneTemplate("loop", "spin"));
  fs.writeFileSync(path.join(root, LAB_DIR, "wide.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100"><rect/></svg>');
  const server = await startLabServer({ root });
  try {
    const icon = (await get(`${server.url}/scene/spin`)).body;
    for (const size of ICON_SIZES) assert.match(icon, new RegExp(`scheme=light&background=paper&width=${size}&pad=8"`));
    const wide = (await get(`${server.url}/scene/wide`)).body;
    assert.equal(wide.match(/scheme=light&background=paper&width=\d+&pad=8"/g).length, 1);
    assert.match(wide, /width=400&pad=8/);
    assert.match(wide, /fit=1/, "enlarged: 400 px is under the enlargement's width");
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("renderPlan: the format by extension, a still or a sequence, the times, the still and the source beside the file", async () => {
  const { renderPlan } = await import("./lab.mjs");
  const still = renderPlan("out/mark.webp", { at: 0.5 }, { duration: 2, animated: true });
  assert.deepEqual(still, { format: "webp", sequence: false, video: false, times: [0.5], fps: 30, delay: 33, background: "transparent", still: null, source: "out/mark.svg" });
  const loop = renderPlan("out/loop.webp", { animate: true, fps: 10 }, { duration: 2, animated: true });
  assert.equal(loop.sequence, true);
  assert.equal(loop.times.length, 20);
  assert.deepEqual(loop.times.slice(0, 3), [0, 0.1, 0.2]);
  assert.equal(loop.delay, 100);
  assert.equal(loop.still, "out/loop-still.webp");
  assert.equal(renderPlan("out/loop.webp", { frames: 3, fps: 10, at: 1 }, { duration: 2 }).times.length, 3, "--frames truncates");
  assert.deepEqual(renderPlan("out/loop.webp", { frames: 3, fps: 10, at: 1 }, { duration: 2 }).times, [1, 1.1, 1.2]);
  const video = renderPlan("out/hero.webm", { fps: 24 }, { duration: 0 });
  assert.ok(video.video && video.sequence && video.times.length === 24, "a video is always a sequence; no duration means one second");
  const jpg = renderPlan("out/a.JPG", {}, {});
  assert.equal(jpg.format, "jpg");
  assert.equal(jpg.background, "paper", ".jpg is always on the paper");
  const svg = renderPlan("out/a.svg", {}, { animated: true });
  assert.deepEqual([svg.still, svg.source], ["out/a-still.svg", null]);
  assert.equal(renderPlan("out/a.svg", {}, { animated: false }).still, null);
  assert.equal(renderPlan("out/a.svg", { poster: false }, { animated: true }).still, null);
  assert.equal(renderPlan("out/a.png", { source: false }, {}).source, null);
  assert.throws(() => renderPlan("out/a.gif", {}, {}), /\.gif: a render writes/);
  assert.throws(() => renderPlan("out/a", {}, {}), /no extension/);
  assert.throws(() => renderPlan("out/a.webm", { fps: 0 }, {}), /--fps must be above 0/);
});

test("resolveTokenColors: one scheme's side of every colour token, var() chains followed", async () => {
  const { resolveTokenColors } = await import("./lab.mjs");
  const tokens = { "--color-paper": "light-dark(#ffffff, #121212)", "--color-ink": "light-dark(#000000, #f2f2f2)", "--color-accent": "var(--color-ink)", "--color-plain": "oklch(60% 0.1 200)", "--font-sans": "system-ui" };
  assert.deepEqual(resolveTokenColors(tokens, "dark"), { colors: { "--color-paper": "#121212", "--color-ink": "#f2f2f2", "--color-accent": "#f2f2f2", "--color-plain": "oklch(60% 0.1 200)" }, current: "#f2f2f2", paper: "#121212" });
  assert.equal(resolveTokenColors(tokens).current, "#000000");
  assert.deepEqual(resolveTokenColors({}), { colors: {}, current: "currentColor", paper: "#ffffff" });
});

test("the encoders: ffmpeg found on PATH or in Playwright's cache, its arguments per build and format, what it lacks named", async () => {
  const { ffmpegPath } = await import("./browser.mjs");
  const { checkFfmpeg, ffmpegArgs } = await import("./lab-encode.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ffmpeg-"));
  assert.equal(ffmpegPath({ env: { PATH: dir }, caches: [] }), null);
  fs.mkdirSync(path.join(dir, "cache/ffmpeg-1011"), { recursive: true });
  fs.writeFileSync(path.join(dir, "cache/ffmpeg-1011/ffmpeg-linux"), "");
  assert.deepEqual(ffmpegPath({ env: { PATH: dir }, caches: [path.join(dir, "cache")] }), { file: path.join(dir, "cache/ffmpeg-1011/ffmpeg-linux"), bundled: true });
  fs.writeFileSync(path.join(dir, "ffmpeg"), "#!/bin/sh\necho ' V....D libvpx               libvpx VP8 (codec vp8)'\necho ' V....D libvpx-vp9           libvpx VP9 (codec vp9)'\n", { mode: 0o755 });
  const system = ffmpegPath({ env: { PATH: `${dir}:/nowhere` }, caches: [] });
  assert.deepEqual(system, { file: path.join(dir, "ffmpeg"), bundled: false });
  assert.deepEqual(ffmpegPath({ env: { FFMPEG_PATH: "/opt/ffmpeg" } }), { file: "/opt/ffmpeg", bundled: false });
  assert.match(ffmpegArgs({ bundled: false, format: "webm", fps: 24, alpha: true, out: "a.webm" }).join(" "), /^-y -f image2pipe -c:v png -framerate 24 -i pipe:0 -vf pad=ceil\(iw\/2\)\*2:ceil\(ih\/2\)\*2 -c:v libvpx-vp9 -pix_fmt yuva420p /);
  assert.match(ffmpegArgs({ bundled: true, format: "webm", fps: 10, alpha: false, out: "a.webm" }).join(" "), /-c:v mjpeg .* -c:v libvpx -pix_fmt yuv420p /);
  assert.match(ffmpegArgs({ bundled: false, format: "mp4", fps: 30, alpha: false, out: "a.mp4" }).join(" "), /-c:v libx264 -pix_fmt yuv420p .* \+faststart a\.mp4$/);
  assert.throws(() => checkFfmpeg(null, { format: "webm" }), /no ffmpeg for a \.webm: install ffmpeg/);
  if (process.platform !== "win32") {
    assert.throws(() => checkFfmpeg(system, { format: "mp4" }), /has no libx264/);
    assert.throws(() => checkFfmpeg({ ...system, bundled: true }, { format: "webm", alpha: true }), /pass --background paper/);
    assert.ok(checkFfmpeg(system, { format: "webm", alpha: true }).encoders.has("libvpx-vp9"));
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
