import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { KINDS, LAB_DIR, isSceneName, listScenes, parseSizes, readThemeTokens, resolveTokens, sceneMeta, sceneTemplate, siteTokens, stripAnimation, tokensCss } from "./lab.mjs";
import { LAB_API, bareHtml, indexHtml, sceneHtml } from "./lab-page.mjs";
import { startLabServer } from "./lab-server.mjs";

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
  assert.ok(isSceneName("a-1") && !isSceneName("-a") && !isSceneName("a/b") && !isSceneName("A"));
});

test("sceneMeta reads width and height from the attributes, else the viewBox; a non-SVG throws", () => {
  assert.deepEqual(sceneMeta('<svg viewBox="0 0 160 90"></svg>'), { width: 160, height: 90, viewBox: "0 0 160 90", duration: 0 });
  assert.deepEqual(sceneMeta('<?xml version="1.0"?>\n<svg width="32px" height="16" data-duration="1.5" viewBox="0 0 64 32"/>'), { width: 32, height: 16, viewBox: "0 0 64 32", duration: 1.5 });
  assert.throws(() => sceneMeta("<html></html>"), /no <svg> root/);
});

test("listScenes: the lab's files by name, extra files and folders by path without the extension, a missing path named", () => {
  const root = site();
  fs.mkdirSync(path.join(root, LAB_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, LAB_DIR, "b.svg"), "<svg/>");
  fs.writeFileSync(path.join(root, LAB_DIR, "a.svg"), "<svg/>");
  fs.writeFileSync(path.join(root, LAB_DIR, "notes.txt"), "not a scene");
  fs.mkdirSync(path.join(root, "public/images/home/deep"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/images/home/mark.svg"), "<svg/>");
  fs.writeFileSync(path.join(root, "public/images/home/deep/hero.svg"), "<svg/>");
  fs.writeFileSync(path.join(root, "public/images/one.svg"), "<svg/>");
  const scenes = listScenes(root, { extra: ["public/images/home", "public/images/one.svg"] });
  assert.deepEqual([...scenes.keys()], ["a", "b", "public/images/home/deep/hero", "public/images/home/mark", "public/images/one"]);
  assert.equal(scenes.get("a"), path.join(root, LAB_DIR, "a.svg"));
  assert.throws(() => listScenes(root, { extra: ["public/nope"] }), /public\/nope: no such file or folder/);
  assert.equal(listScenes(os.tmpdir()).size >= 0, true);
  fs.rmSync(root, { recursive: true, force: true });
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
  assert.match(page, /<iframe class="lab-frame"[^>]*src="\/scene\/spin\?bare=1&scheme=light&background=paper&width=24&pad=8" width="40" height="28">/);
  assert.match(page, /<iframe class="lab-frame"[^>]*scheme=dark&background=paper&width=64/);
  assert.match(page, /64 px \(natural\)/);
  assert.match(page, /<img src="\/files\/spin\.svg" width="24" height="12" alt="">/);
  assert.match(page, /new EventSource\("\/events"\)/);
  const index = indexHtml(new Map([["a/b", "public/a/b.svg"], ["spin", ".parity/lab/spin.svg"]]), { tokens, metas: new Map([["spin", sceneMeta(svg)]]) });
  assert.match(index, /<a href="\/scene\/a\/b">a\/b<\/a>/);
  assert.match(index, /<img src="\/files\/spin\.svg" width="64" height="32" alt="">/);
  assert.match(index, /64×32 · 2s/);
});

test("the server: the index, a scene page and its bare page, the file by id, nothing outside the whitelist, and a change event after a save", async () => {
  const root = site();
  fs.mkdirSync(path.join(root, LAB_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, LAB_DIR, "spin.svg"), sceneTemplate("loop", "spin"));
  fs.mkdirSync(path.join(root, "public/images"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/images/mark.svg"), sceneTemplate("mark", "mark"));
  fs.writeFileSync(path.join(root, "public/images/secret.svg"), "<svg/>");
  const server = await startLabServer({ root, extra: ["public/images/mark.svg"], watch: true, sizes: [24] });
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
    const file = await get(`${server.url}/files/spin.svg`);
    assert.equal(file.type, "image/svg+xml");
    assert.match(file.body, /agentic-cms lab: loop/);
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
