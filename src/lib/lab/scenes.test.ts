import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { LAB_DIR, animates, followsTheme, isSceneName, listScenes, sceneMeta, svgMarkup, tagRoot } from "./scenes.ts";

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
