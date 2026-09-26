// The Chromium-backed suite (pnpm test:browser): the shared browser library
// and, as they arrive, the commands that photograph or measure a page — all
// against the fixture site under scripts/fixtures, served by the harness's
// own server. Skipped, with the reason, on a machine without a Chromium build.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import zlib from "node:zlib";
import sharp from "sharp";
import { chromePath, hydrated, imagesReady, launch, listPages, prepare, revealed, serveStatic, settle, snap, withPage } from "../lib/browser.mjs";
import { LOOP_PAGE, addPage, fixtureSite } from "../fixtures/site.mjs";

const chrome = chromePath();
const skip = chrome ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`";

test("the fixture site is served like a build: pages, RSC-less routes, public assets, gzip, 404", { skip }, async () => {
  const root = fixtureSite();
  const server = await serveStatic({ root });
  try {
    const home = await fetch(server.url + "/");
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type"), /text\/html/);
    assert.match(await home.text(), /A fixture page/);
    const about = await fetch(server.url + "/about");
    assert.match(await about.text(), /A second route/);
    const svg = await fetch(server.url + "/images/mark.svg");
    assert.equal(svg.headers.get("content-type"), "image/svg+xml");
    assert.equal((await fetch(server.url + "/nope")).status, 404);
    assert.deepEqual(listPages(root), ["/", "/about"]);
  } finally { server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("a raw response is gzipped; a page is marked no-store, an asset may be cached for the run, and a changed file is served changed", { skip }, async () => {
  const root = fixtureSite();
  const server = await serveStatic({ root });
  const get = (url) => new Promise((resolve, reject) => http.get(server.url + url, (res) => { const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => resolve({ headers: res.headers, body: zlib.gunzipSync(Buffer.concat(chunks)).toString() })); }).on("error", reject));
  try {
    const page = await get("/");
    assert.equal(page.headers["cache-control"], "no-store");
    assert.equal(page.headers["content-encoding"], "gzip");
    assert.match(page.body, /<!doctype html>/i);
    const asset = await get("/images/mark.svg");
    assert.equal(asset.headers["cache-control"], "max-age=3600");
    fs.writeFileSync(path.join(root, "public/images/mark.svg"), '<svg xmlns="http://www.w3.org/2000/svg" data-changed="1"/>');
    assert.match((await get("/images/mark.svg")).body, /data-changed/, "the compressed copy follows the file");
  } finally { server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("a page prepared under reduced motion has every reveal at its end state after the scroll-through", { skip }, async () => {
  const root = fixtureSite();
  const server = await serveStatic({ root });
  const { context, close } = await launch({ scheme: "light", motion: false });
  try {
    const opacities = await withPage(context, 1440, server.url + "/", async (page) => {
      await revealed(page);
      await settle(page);
      return page.evaluate(() => [...document.querySelectorAll('[class*="ix-init--"]')].map((el) => getComputedStyle(el).opacity));
    });
    assert.deepEqual(opacities, ["1", "1", "1", "1"]);
  } finally { await close(); server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("without reduced motion the reveals play, so a fresh page still has them at their start state", { skip }, async () => {
  const root = fixtureSite();
  const server = await serveStatic({ root });
  const { context, close } = await launch({ motion: true });
  try {
    const last = await withPage(context, 1440, server.url + "/", (page) => page.evaluate(() => getComputedStyle(document.querySelector("#third .card")).opacity));
    assert.equal(last, "0");
  } finally { await close(); server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("the static preparation holds an inline SMIL loop at its data-rest, paused", { skip }, async () => {
  const root = fixtureSite();
  addPage(root, "/loop", LOOP_PAGE);
  const server = await serveStatic({ root });
  const { context, close } = await launch({ scheme: "light", motion: false });
  try {
    const [paused, time] = await withPage(context, 800, server.url + "/loop", async (page) => {
      await prepare(page);
      await page.waitForTimeout(300);
      return page.evaluate(() => { const svg = document.querySelector("svg"); return [svg.animationsPaused(), svg.getCurrentTime()]; });
    });
    assert.equal(paused, true);
    assert.ok(Math.abs(time - 1.2) < 1e-6, `at ${time}`);
  } finally { await close(); server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("chromePath names a file that exists", { skip }, () => {
  assert.ok(fs.existsSync(chrome), chrome);
});

// React marks each element it hydrates with a "__reactFiber$…" key; the page below plays a Next app that hydrates 300 ms
// after load, with one image inside markup React inserted as a string (never hydrated) and one image of its own.
const HYDRATING = `<!doctype html><html><body><main><img id="own" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="1" height="1"><div id="inserted"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="1" height="1"></div></main>
<script>self.__next_f = []; setTimeout(() => { document.getElementById("inserted")["__reactProps$t"] = { dangerouslySetInnerHTML: { __html: "…" } }; for (const el of document.querySelectorAll("main, #own")) el["__reactFiber$t"] = {}; }, 300);</script></body></html>`;

test("imagesReady waits for React to hydrate its images before it switches them to eager; a page that is not a Next app passes at once", { skip }, async () => {
  const { context, close } = await launch({ motion: true });
  try {
    const page = await context.newPage();
    await page.setContent(HYDRATING);
    const before = await page.evaluate(() => performance.now());
    const ready = imagesReady(page);
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => document.getElementById("own").getAttribute("loading")), null, "not touched before hydration");
    await ready;
    const after = await page.evaluate(() => performance.now());
    assert.ok(after - before >= 250, `waited for hydration: ${Math.round(after - before)} ms`);
    assert.equal(await page.evaluate(() => document.getElementById("own").getAttribute("loading")), "eager", "switched once hydrated");
    const plain = await context.newPage();
    await plain.setContent('<!doctype html><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">');
    assert.equal(await hydrated(plain), true, "no Next app: nothing to wait for");
  } finally { await close(); }
});

// A page with a focused field (the caret blinks, so a shot that did not hide it could differ) and a panel under
// a 3D transform, taller than the viewport and scrolled, so the full page, a clip and the viewport all differ.
const SNAP_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Snap</title><style>body { margin: 0; font: 16px/1.4 sans-serif; } .panel { margin: 40px; padding: 24px; transform: perspective(600px) rotateX(8deg); background: #203; color: #fff; } .tall { height: 2200px; background: linear-gradient(#fff, #cde); }</style></head>
<body><input autofocus value="a caret here"><div class="panel"><h3>A panel under a 3D transform</h3></div><div class="tall"></div></body></html>`;
const pixels = async (file) => { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, height: info.height }; };

test("snap takes the pixels Playwright's screenshot takes: the full page, a clip of it and the scrolled viewport, the caret hidden", { skip }, async () => {
  const root = fixtureSite();
  addPage(root, "/snap", SNAP_PAGE);
  const server = await serveStatic({ root });
  const { context, close } = await launch({ scheme: "light", motion: false });
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "snap-"));
  try {
    await withPage(context, 800, server.url + "/snap", async (page) => {
      await page.focus("input");
      const clip = { x: 20, y: 30.5, width: 400, height: 150 };
      for (const [name, options] of [["full", { fullPage: true }], ["clip", { fullPage: true, clip }]]) {
        await snap(page, path.join(out, `${name}-snap.png`), options);
        await page.screenshot({ path: path.join(out, `${name}-pw.png`), ...options });
      }
      await page.evaluate(() => window.scrollTo(0, 300));
      await snap(page, path.join(out, "view-snap.png"));
      await page.screenshot({ path: path.join(out, "view-pw.png") });
      assert.equal(await page.evaluate(() => document.querySelector("input").style.caretColor), "", "the caret is given back after the shot");
    });
    for (const name of ["full", "clip", "view"]) {
      const [a, b] = await Promise.all([pixels(path.join(out, `${name}-snap.png`)), pixels(path.join(out, `${name}-pw.png`))]);
      assert.deepEqual([a.width, a.height], [b.width, b.height], `${name}: the same size`);
      assert.ok(a.data.equals(b.data), `${name}: the same pixels`);
    }
  } finally { await close(); server.close(); fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); }
});
