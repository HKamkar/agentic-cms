import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LabScenes } from "./LabScenes.ts";
import { LAB_DIR } from "./scenes.ts";

const TICK = `<!-- agentic-cms lab: icon on the Icon component's contract -->\n<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12l5 5 11-11"/></svg>`;
const HERO = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" data-duration="2"><style>@keyframes hero-drift { to { transform: translateX(20px); } } .hero-a { animation: hero-drift 2s linear infinite; }</style><rect class="hero-a" width="100" height="100" fill="var(--color-fill)"/></svg>`;
const GROUNDS = [
  { label: "the page", Frame: ({ children }: { children: ReactNode }) => h("div", { className: "page" }, children) },
  { label: "white card", Frame: ({ children }: { children: ReactNode }) => h("div", { className: "card" }, children) },
];

function fixture(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "labscenes-"));
  fs.mkdirSync(path.join(root, LAB_DIR), { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, LAB_DIR, name), text);
  return root;
}
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

test("LabScenes: every scene on every ground — an icon-sized one at the sizes too, a big one at its size only — comments stripped, styles kept, the procedure first, one scrubber when a scene animates", () => {
  const root = fixture({ "tick.svg": TICK, "hero.svg": HERO });
  const html = renderToStaticMarkup(h(LabScenes, { root, grounds: GROUNDS }));
  assert.equal(count(html, /data-scene="/g), 2);
  assert.equal(count(html, /data-ground="/g), 4, "two grounds per scene");
  assert.equal(count(html, /<div class="page">/g), 2);
  assert.equal(count(html, /<svg width="640" height="360" class="lab-scene"/g), 2, "hero at its natural size on each ground");
  assert.equal(count(html, /<svg width="24" height="24" class="lab-scene"/g), 2, "tick at 24 (its natural size, once) on each ground");
  assert.equal(count(html, /<svg width="40" height="40" class="lab-scene"/g), 2);
  assert.equal(count(html, /<svg width="64" height="64" class="lab-scene"/g), 2);
  assert.match(html, /tick\.svg · 24×24 · at 24 \/ 40 \/ 64 px/);
  assert.match(html, /hero\.svg · 640×360 · animated/);
  assert.doesNotMatch(html, /agentic-cms lab:/, "the template comment is stripped");
  assert.equal(count(html, /@keyframes hero-drift/g), 2, "a scene's <style> is kept, once per copy");
  assert.match(html, /<h1>The lab, on this site&#x27;s theme<\/h1>/);
  assert.ok(html.indexOf("The loop.") < html.indexOf('data-scene="'), "the procedure is above the first scene");
  assert.match(html, /pnpm kit lab clean/);
  assert.equal(count(html, /id="lab-time"/g), 1, "one scrubber for the page");
  assert.match(html, /window\.lab = /);
  assert.ok(html.indexOf("<script>") > html.lastIndexOf("data-scene="), "the clock's script comes after the scenes");
  fs.rmSync(root, { recursive: true, force: true });
});

test("LabScenes: no scrubber without an animated scene, no intro when asked, the site's note, extra folders, the empty state", () => {
  const root = fixture({ "tick.svg": TICK });
  fs.mkdirSync(path.join(root, "public/images/ui"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/images/ui/mark.svg"), '<svg width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#888"/></svg>');
  const html = renderToStaticMarkup(h(LabScenes, { root, grounds: GROUNDS, intro: false, sizes: [20], folders: ["public/images/ui"] }, h("p", { className: "note" }, "the site's note")));
  assert.doesNotMatch(html, /id="lab-time"|window\.lab|<h1>/);
  assert.match(html, /<p class="note">the site&#x27;s note<\/p>/);
  assert.match(html, /data-scene="public\/images\/ui\/mark"/);
  assert.match(html, /tick\.svg · 24×24 · at 20 \/ 24 px/);
  const empty = renderToStaticMarkup(h(LabScenes, { root: path.join(root, "nowhere"), grounds: GROUNDS }));
  assert.match(empty, /No scenes yet: <code>pnpm kit lab new/);
  fs.rmSync(root, { recursive: true, force: true });
});
