// The Chromium-backed suite (pnpm test:browser): the shared browser library
// and, as they arrive, the commands that photograph or measure a page — all
// against the fixture site under scripts/fixtures, served by the harness's
// own server. Skipped, with the reason, on a machine without a Chromium build.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { test } from "node:test";
import zlib from "node:zlib";
import { chromePath, hydrated, imagesReady, launch, listPages, prepare, revealed, serveStatic, settle, withPage } from "../lib/browser.mjs";
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

test("a raw response is gzipped and marked no-store", { skip }, async () => {
  const root = fixtureSite();
  const server = await serveStatic({ root });
  try {
    const { headers, raw } = await new Promise((resolve, reject) => http.get(server.url + "/", (res) => { const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => resolve({ headers: res.headers, raw: Buffer.concat(chunks) })); }).on("error", reject));
    assert.equal(headers["cache-control"], "no-store");
    assert.equal(headers["content-encoding"], "gzip");
    assert.match(zlib.gunzipSync(raw).toString(), /<!doctype html>/i);
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
