import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { LAB_DIR, ROUNDS_DIR, animates, followsTheme, isSceneName, listScenes, namespaceIds, readTrustedSvg, sceneDuration, sceneMeta, svgMarkup, tagRoot } from "./scenes.ts";

test("listScenes: the lab's files by name, extra files and folders by path without the extension, a missing path named", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scenes-"));
  fs.mkdirSync(path.join(root, LAB_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, LAB_DIR, "b.svg"), "<svg/>");
  fs.writeFileSync(path.join(root, LAB_DIR, "a.svg"), "<svg/>");
  fs.writeFileSync(path.join(root, LAB_DIR, "readme.txt"), "not a scene");
  fs.mkdirSync(path.join(root, "public/images/home/deep"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/images/home/mark.svg"), "<svg/>");
  fs.writeFileSync(path.join(root, "public/images/home/deep/hero.svg"), "<svg/>");
  fs.writeFileSync(path.join(root, "public/images/one.svg"), "<svg/>");
  const scenes = listScenes(root, { extra: ["public/images/home", "public/images/one.svg"] });
  assert.deepEqual([...scenes.keys()], ["a", "b", "public/images/home/deep/hero", "public/images/home/mark", "public/images/one"]);
  assert.equal(scenes.get("a"), path.join(root, LAB_DIR, "a.svg"));
  assert.throws(() => listScenes(root, { extra: ["public/nope"] }), /public\/nope: no such file or folder/);
  assert.equal(listScenes(path.join(root, "empty")).size, 0, "no lab folder: no scenes, no error");
  fs.rmSync(root, { recursive: true, force: true });
});

test("sceneMeta reads width and height from the attributes, else the viewBox; a non-SVG throws", () => {
  assert.deepEqual(sceneMeta('<svg viewBox="0 0 160 90"></svg>'), { width: 160, height: 90, viewBox: "0 0 160 90", duration: 0 });
  assert.deepEqual(sceneMeta('<?xml version="1.0"?>\n<svg width="32px" height="16" data-duration="1.5" viewBox="0 0 64 32"/>'), { width: 32, height: 16, viewBox: "0 0 64 32", duration: 1.5 });
  assert.throws(() => sceneMeta("<html></html>"), /no <svg> root/);
});

test("the text of a scene: markup without the prolog and the comments, whether it animates, whether it paints in the page's ink, a name's shape", () => {
  assert.equal(svgMarkup('<?xml version="1.0"?>\n<!-- agentic-cms lab: icon -->\n<svg><!-- inner --><rect/></svg>'), "<svg><rect/></svg>");
  assert.ok(animates("<svg><animate/></svg>") && animates("<svg><style>.a{animation: x 1s}</style></svg>") && animates("<svg><style>@keyframes x{}</style></svg>") && !animates("<svg><rect/></svg>"));
  assert.ok(followsTheme('<svg stroke="currentColor"/>') && followsTheme('<svg fill="var(--color-fill)"/>') && !followsTheme('<!-- agentic-cms lab: currentColor in a comment --><svg fill="#888"/>'));
  assert.ok(isSceneName("a-1") && !isSceneName("-a") && !isSceneName("a/b") && !isSceneName("A"));
});

test("tagRoot tags the root <svg> with a class, joins an existing one, and sizes it when asked", () => {
  assert.equal(tagRoot('<svg width="64" height="32" viewBox="0 0 64 32"><rect/></svg>', "lab-scene"), '<svg class="lab-scene" width="64" height="32" viewBox="0 0 64 32"><rect/></svg>');
  assert.equal(tagRoot('<svg class="x" viewBox="0 0 8 8"/>', "lab-scene"), '<svg class="lab-scene x" viewBox="0 0 8 8"/>');
  assert.equal(tagRoot('<svg width="64" height="32" viewBox="0 0 64 32"><rect width="64"/></svg>', "lab-scene", { width: 24, height: 12 }), '<svg width="24" height="12" class="lab-scene" viewBox="0 0 64 32"><rect width="64"/></svg>', "the shapes' own width attributes are untouched");
  assert.throws(() => tagRoot("<div/>", "x"), /no <svg> root/);
});

test("namespaceIds: every id and every reference to one — url(#…) in attributes and styles, href and xlink:href, a SMIL syncbase, an ARIA list, a #… selector — and nothing else", () => {
  const svg = `<svg><style>#m rect { fill: #fff } .x { fill: url(#g) }</style><defs><mask id="m"><rect/></mask><linearGradient id="g"/><clipPath id="c"/><path id="p"/></defs><rect mask="url(#m)" clip-path="url('#c')" style="fill:url(#g)"/><use href="#p"/><use xlink:href="#p"/><a href="#top"/><animate id="a1" dur="1s"/><animate begin="a1.end+0.1s; 2s" end="a1.repeat(2)" dur="1s"/><title id="t"/><g aria-labelledby="t other"/></svg>`;
  const out = namespaceIds(svg, "lab-x-3");
  assert.deepEqual([...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]), ["lab-x-3-m", "lab-x-3-g", "lab-x-3-c", "lab-x-3-p", "lab-x-3-a1", "lab-x-3-t"]);
  assert.match(out, /<style>#lab-x-3-m rect \{ fill: #fff \} \.x \{ fill: url\(#lab-x-3-g\) \}<\/style>/, "a selector and a url() in the styles; a colour untouched");
  assert.match(out, /mask="url\(#lab-x-3-m\)" clip-path="url\('#lab-x-3-c'\)" style="fill:url\(#lab-x-3-g\)"/);
  assert.match(out, /<use href="#lab-x-3-p"\/><use xlink:href="#lab-x-3-p"\/><a href="#top"\/>/, "an href to an id the scene does not hold is left alone");
  assert.match(out, /begin="lab-x-3-a1\.end\+0\.1s; 2s" end="lab-x-3-a1\.repeat\(2\)"/);
  assert.match(out, /aria-labelledby="lab-x-3-t other"/);
  assert.equal(namespaceIds("<svg><rect/></svg>", "p"), "<svg><rect/></svg>");
});

test("sceneDuration: data-duration first, else the longest SMIL begin + dur and CSS delay + duration; 0 for a still", () => {
  assert.equal(sceneDuration(`<svg data-duration="3"><animate dur="9s"/></svg>`), 3);
  assert.equal(sceneDuration(`<svg><animate dur="1.5s" begin="0.25s"/><set dur="500ms" begin="x.end"/></svg>`), 1.75);
  assert.equal(sceneDuration(`<svg><style>.a { animation: a 2s linear 0.5s infinite } .b { animation-duration: 800ms, 1.2s }</style></svg>`), 2.5);
  assert.equal(sceneDuration(`<svg><style>.b { animation-duration: 800ms, 1.2s }</style></svg>`), 1.2);
  assert.equal(sceneDuration(`<svg><rect/></svg>`), 0);
});

test("readTrustedSvg: a file under the root, outside node_modules, without code — anything else refused with the reason", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trusted-"));
  fs.mkdirSync(path.join(root, "public/images"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules/x"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/images/ok.svg"), "<svg><rect/></svg>");
  fs.writeFileSync(path.join(root, "public/images/script.svg"), "<svg><script>alert(1)</script></svg>");
  fs.writeFileSync(path.join(root, "public/images/handler.svg"), '<svg><rect onclick="x()"/></svg>');
  fs.writeFileSync(path.join(root, "node_modules/x/a.svg"), "<svg/>");
  assert.equal(readTrustedSvg(root, "public/images/ok.svg"), "<svg><rect/></svg>");
  assert.throws(() => readTrustedSvg(root, "public/images/script.svg"), /carries code \(<script\)/);
  assert.throws(() => readTrustedSvg(root, "public/images/handler.svg"), /carries code \(onclick=\)/);
  assert.throws(() => readTrustedSvg(root, "node_modules/x/a.svg"), /only an SVG the site's repository owns/);
  assert.throws(() => readTrustedSvg(root, "../elsewhere.svg"), /only an SVG the site's repository owns/);
  assert.throws(() => readTrustedSvg(root, "public/images/ok.png"), /not an \.svg file/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("listScenes: an icon round's scenes by rounds/<round>/<name>, beside the lab's own", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scenes-rounds-"));
  try {
    for (const file of [`${LAB_DIR}/spin.svg`, `${ROUNDS_DIR}/modules/graph-A.svg`, `${ROUNDS_DIR}/modules/round.yaml`]) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), "<svg/>"); }
    assert.deepEqual([...listScenes(root).keys()], ["spin", "rounds/modules/graph-A"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
