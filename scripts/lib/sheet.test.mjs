import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readSheetSpec, sheetHtml } from "./sheet.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sheet-"));
fs.mkdirSync(path.join(root, "public/images"), { recursive: true });
fs.writeFileSync(path.join(root, "public/images/now.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>');
fs.writeFileSync(path.join(root, "icons.yaml"), `name: sector icons
background: "#000220"
color: "#fff"
rows:
  - label: now
    size: 40
    cells:
      - label: dna
        file: public/images/now.svg
  - label: alternate
    note: Lucide, stroke 1.6
    size: 40
    cells:
      - label: dna
        svg: '<svg viewBox="0 0 24 24"><path d="M2 2l20 20"/></svg>'
      - label: globe
        img: /images/now.svg
      - label: chip
        html: '<span class="chip">tag</span>'
`);

test("a spec reads from YAML with its rows and cells", () => {
  const spec = readSheetSpec(path.join(root, "icons.yaml"));
  assert.equal(spec.name, "sector icons");
  assert.equal(spec.rows.length, 2);
  assert.equal(spec.rows[1].cells[2].html, '<span class="chip">tag</span>');
});

test("the HTML letters the rows, numbers the cells, inlines files and SVGs, sizes the boxes and paints the background", () => {
  const html = sheetHtml(readSheetSpec(path.join(root, "icons.yaml")), { root, css: ["/_next/static/css/app.css"] });
  assert.match(html, /<title>sector icons<\/title>/);
  assert.match(html, /<link rel="stylesheet" href="\/_next\/static\/css\/app\.css">/);
  assert.match(html, /background:\s*#000220/);
  assert.match(html, /<circle cx="12"/, "the file's SVG is inlined");
  assert.match(html, /<path d="M2 2l20 20"/, "the inline SVG is kept");
  assert.match(html, /<img src="\/images\/now\.svg"/, "an img cell points at the served path");
  assert.match(html, /<span class="chip">tag<\/span>/);
  assert.ok(html.indexOf("A") < html.indexOf("B"), "rows are lettered in order");
  assert.match(html, /data-row="A"[^>]*>[\s\S]*?now/);
  assert.match(html, /data-row="B"[^>]*>[\s\S]*?alternate[\s\S]*?Lucide, stroke 1\.6/);
  assert.match(html, /data-cell="B2"/);
  assert.match(html, /--cell:\s*40px/);
});

test("a missing file names the file and the fix", () => {
  const spec = { name: "x", rows: [{ label: "now", cells: [{ label: "a", file: "public/images/missing.svg" }] }] };
  assert.throws(() => sheetHtml(spec, { root }), /public\/images\/missing\.svg: no such file \(cells take file:, svg:, html: or img:\)/);
});

test("a spec without rows, or a cell without content, is refused with the field named", () => {
  fs.writeFileSync(path.join(root, "bad.yaml"), "name: bad\n");
  assert.throws(() => readSheetSpec(path.join(root, "bad.yaml")), /bad\.yaml: rows must be a list of \{ label, cells \}/);
  fs.writeFileSync(path.join(root, "bad2.yaml"), "name: bad\nrows:\n  - label: a\n    cells:\n      - label: x\n");
  assert.throws(() => readSheetSpec(path.join(root, "bad2.yaml")), /rows\[0\]\.cells\[0\]: a cell needs one of file, svg, html, img/);
});
