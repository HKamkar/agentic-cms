import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LabStudy } from "./LabStudy.ts";

const MARK = `<?xml version="1.0"?><!-- a mark --><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><clipPath id="cut"><rect width="64" height="64"/></clipPath><linearGradient id="tone"><stop offset="0"/></linearGradient></defs><g clip-path="url(#cut)"><circle id="dot" cx="16" cy="32" r="8" fill="url(#tone)"><animate attributeName="cx" values="16;48;16" dur="1.6s" repeatCount="indefinite"/></circle><use href="#dot" x="4"/></g></svg>`;
const GROUNDS = [
  { label: "light", Frame: ({ children }: { children: ReactNode }) => h("div", { className: "light" }, children) },
  { label: "dark", Frame: ({ children }: { children: ReactNode }) => h("div", { className: "dark" }, children) },
];
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "labstudy-"));
  fs.mkdirSync(path.join(root, "public/images/brand"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/images/brand/mark.svg"), MARK);
  fs.writeFileSync(path.join(root, "public/images/brand/mark-still.svg"), "<svg/>");
  fs.mkdirSync(path.join(root, ".parity/lab"), { recursive: true });
  fs.writeFileSync(path.join(root, ".parity/lab/mark-b.svg"), MARK);
  return root;
}

test("LabStudy: the file inline at every size on every ground under one timeline over its own cycle, every copy's ids its own, the shipped still, the download", () => {
  const root = site();
  const html = renderToStaticMarkup(h(LabStudy, { root, file: "public/images/brand/mark.svg", label: "Candidate A", sizes: [32, 160], grounds: GROUNDS }));
  assert.match(html, /<section data-study="public-images-brand-mark-svg-candidate-a"/);
  assert.match(html, /<h2[^>]*>Candidate A<\/h2>/);
  assert.match(html, /public\/images\/brand\/mark\.svg · 64×64 · at 32 \/ 64 \/ 160 px · 1\.60 s cycle/, "the cycle read from the SMIL, not restated");
  assert.equal(count(html, /<div data-lab-timeline="" role="group" aria-label="Candidate A: timeline">/g), 1, "one timeline for every copy");
  assert.match(html, /data-lab-time min="0" max="1\.6" step="0\.01"/);
  assert.equal(count(html, /class="lab-scene"/g), 6, "three sizes on two grounds");
  assert.doesNotMatch(html, /<\?xml|<!-- a mark -->/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 18);
  assert.equal(new Set(ids).size, 18, "unique across the copies");
  for (const id of ids.filter((i) => i.endsWith("-cut") || i.endsWith("-tone"))) assert.equal(count(html, new RegExp(`url\\(#${id}\\)`, "g")), 1, `${id}: its own copy's reference`);
  for (const id of ids.filter((i) => i.endsWith("-dot"))) assert.equal(count(html, new RegExp(`href="#${id}"`, "g")), 1);
  assert.match(html, /<img src="\/images\/brand\/mark-still\.svg" width="64" height="64" alt="" loading="lazy"/, "the still that ships beside it");
  assert.match(html, /<a href="\/images\/brand\/mark\.svg" download="mark\.svg" data-lab-download="">Download mark\.svg<\/a>/, "the original, as served");
  fs.rmSync(root, { recursive: true, force: true });
});

test("LabStudy: a file that is not served downloads as its own text; two studies of one file keep their ids apart; no timeline for a still; only repository-owned code-free files", () => {
  const root = site();
  const lab = renderToStaticMarkup(h(LabStudy, { root, file: ".parity/lab/mark-b.svg" }));
  const href = lab.match(/<a href="([^"]+)" download="mark-b\.svg"/)?.[1] ?? "";
  assert.equal(decodeURIComponent(href.replace(/^data:image\/svg\+xml;charset=utf-8,/, "")).replace(/&amp;/g, "&"), MARK, "the file byte for byte");
  assert.doesNotMatch(lab, /<img /, "no still beside it");
  const two = renderToStaticMarkup(h("div", null, h(LabStudy, { root, file: "public/images/brand/mark.svg", label: "A" }), h(LabStudy, { root, file: "public/images/brand/mark.svg", label: "B" })));
  const ids = [...two.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  fs.writeFileSync(path.join(root, "public/images/brand/flat.svg"), '<svg width="8" height="8"><rect width="8" height="8"/></svg>');
  assert.doesNotMatch(renderToStaticMarkup(h(LabStudy, { root, file: "public/images/brand/flat.svg", download: false })), /data-lab-timeline=""|data-lab-download/);
  fs.writeFileSync(path.join(root, "public/images/brand/bad.svg"), "<svg><script>1</script></svg>");
  assert.throws(() => renderToStaticMarkup(h(LabStudy, { root, file: "public/images/brand/bad.svg" })), /carries code/);
  assert.throws(() => renderToStaticMarkup(h(LabStudy, { root, file: "../outside.svg" })), /repository owns/);
  fs.rmSync(root, { recursive: true, force: true });
});
