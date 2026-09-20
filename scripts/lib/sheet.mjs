// A candidate sheet: rows of candidates (lettered A, B, C…), each a row of
// cells (numbered) rendered at the size and on the background the real
// section uses, so the owner picks by row from one picture. The spec is
// YAML or JSON:
//
//   name: sector icons            # the sheet's title and file name
//   background: "#000220"         # a colour or a token (var(--color-paper)); default the page's
//   color: "#fff"                 # the ink for labels and currentColor marks
//   rows:
//     - label: now                # the first row is by convention what is there today
//       note: what the section renders
//       size: 40                  # the cell box in px (default 48)
//       cells:
//         - { label: dna, file: public/images/x.svg }   # an SVG file, inlined
//         - { label: globe, svg: "<svg …>" }            # inline SVG
//         - { label: tag, html: "<span …>" }            # any markup
//         - { label: mark, img: /images/x.svg }         # a served path (the build or --url)
//
// The site's compiled stylesheets are linked when a build exists, so tokens,
// fonts and utilities in html: cells are the site's own.
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { fontsReady, imagesReady, launch } from "./browser.mjs";

const KINDS = ["file", "svg", "html", "img"];

/** Reads and validates a spec; errors name the file and the field. */
export function readSheetSpec(file) {
  const text = fs.readFileSync(file, "utf8");
  const spec = file.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
  const at = path.basename(file);
  if (!spec || typeof spec !== "object") throw new Error(`${at}: not a sheet spec`);
  if (!Array.isArray(spec.rows) || !spec.rows.length) throw new Error(`${at}: rows must be a list of { label, cells }`);
  spec.rows.forEach((row, r) => {
    if (!row || !Array.isArray(row.cells) || !row.cells.length) throw new Error(`${at}: rows[${r}] needs a label and a list of cells`);
    row.cells.forEach((cell, c) => { if (!cell || !KINDS.some((k) => typeof cell[k] === "string")) throw new Error(`${at}: rows[${r}].cells[${c}]: a cell needs one of file, svg, html, img`); });
  });
  spec.name ??= path.basename(file).replace(/\.(ya?ml|json)$/, "");
  return spec;
}

const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const letter = (i) => String.fromCharCode(65 + i);

function cellMarkup(cell, { root }) {
  if (cell.file !== undefined) {
    const file = path.resolve(root, cell.file);
    if (!fs.existsSync(file)) throw new Error(`${cell.file}: no such file (cells take file:, svg:, html: or img:)`);
    return fs.readFileSync(file, "utf8").replace(/^<\?xml[^>]*>\s*/, "").replace(/<!--[\s\S]*?-->\s*/g, "");
  }
  if (cell.svg !== undefined) return cell.svg;
  if (cell.html !== undefined) return cell.html;
  return `<img src="${escape(cell.img)}" alt="">`;
}

/** The sheet as one HTML document. `css` are stylesheet paths to link (the site's build); the sheet's own rules win. */
export function sheetHtml(spec, { root = process.cwd(), css = [] } = {}) {
  const rows = spec.rows.map((row, r) => {
    const id = letter(r);
    // an SVG or an image fills the box; markup keeps its own size, that being the point of an html: cell
    const cells = row.cells.map((cell, c) => `<div class="sheet-cell" data-cell="${id}${c + 1}"><div class="sheet-box${cell.html === undefined ? " sheet-fit" : ""}">${cellMarkup(cell, { root })}</div><span class="sheet-cell-label">${c + 1} ${escape(cell.label ?? "")}</span></div>`).join("");
    return `<section class="sheet-row" data-row="${id}" style="--cell: ${Number(row.size) || 48}px"><h2 class="sheet-row-label"><b>${id}</b> ${escape(row.label ?? "")}${row.note ? `<small>${escape(row.note)}</small>` : ""}</h2><div class="sheet-cells">${cells}</div></section>`;
  });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escape(spec.name)}</title>
${css.map((href) => `<link rel="stylesheet" href="${escape(href)}">`).join("\n")}
<style>
  html.sheet, .sheet body { margin: 0 !important; padding: 0 !important; background: ${spec.background ?? "Canvas"} !important; color: ${spec.color ?? "CanvasText"} !important; }
  .sheet main { padding: 24px 32px !important; display: flex !important; flex-direction: column !important; gap: 20px !important; font: 13px/1.4 system-ui, sans-serif !important; }
  .sheet h1 { font: 600 16px/1.3 system-ui, sans-serif !important; margin: 0 !important; }
  .sheet-row { display: flex !important; flex-direction: column !important; gap: 10px !important; }
  .sheet-row-label { display: flex !important; align-items: baseline !important; gap: 10px !important; margin: 0 !important; font: 500 14px/1.3 system-ui, sans-serif !important; }
  .sheet-row-label b { display: inline-flex !important; width: 24px !important; height: 24px !important; align-items: center !important; justify-content: center !important; border: 1px solid currentColor !important; border-radius: 6px !important; font-weight: 700 !important; }
  .sheet-row-label small { opacity: .6 !important; font: 12px/1.3 system-ui, sans-serif !important; }
  .sheet-cells { display: flex !important; flex-wrap: wrap !important; gap: 24px !important; }
  .sheet-cell { display: flex !important; flex-direction: column !important; align-items: center !important; gap: 8px !important; }
  .sheet-box { display: flex !important; align-items: center !important; justify-content: center !important; }
  .sheet-box { min-width: var(--cell) !important; min-height: var(--cell) !important; width: auto !important; height: auto !important; }
  .sheet-fit > * { width: var(--cell) !important; height: var(--cell) !important; max-width: none !important; }
  .sheet-cell-label { font: 12px/1.3 ui-monospace, monospace !important; opacity: .7 !important; }
</style></head>
<body class="sheet"><main><h1>${escape(spec.name)}</h1>${rows.join("")}</main></body></html>`.replace('<html lang="en">', '<html lang="en" class="sheet">');
}

/** The compiled stylesheets of a Next build under root, as served paths; [] without a build. */
export function buildStylesheets(root) {
  const dir = path.join(root, ".next/static");
  if (!fs.existsSync(dir)) return [];
  const found = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const full = path.join(d, f); if (fs.statSync(full).isDirectory()) walk(full); else if (f.endsWith(".css")) found.push("/_next/static/" + path.relative(dir, full).split(path.sep).join("/")); } };
  walk(dir);
  return found.sort();
}

/** Renders a spec to a picture: the sheet served at <base>/__sheet.html (so img: cells and the site's stylesheets resolve), a short viewport so the full-page shot is the sheet's own height; { file, width, height }. */
export async function renderSheet(spec, { root = process.cwd(), base, out, scale = 2, scheme = "light", width = 1200, css } = {}) {
  const html = sheetHtml(spec, { root, css: css ?? buildStylesheets(root) });
  const { context, close } = await launch({ scheme, width, height: 200, scale });
  try {
    const page = await context.newPage();
    await page.route(`${base}/__sheet.html`, (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
    await page.goto(`${base}/__sheet.html`, { waitUntil: "load" });
    await fontsReady(page);
    await imagesReady(page);
    await page.waitForTimeout(200);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: true });
    const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    return { file: out, width: size.width * scale, height: size.height * scale };
  } finally { await close(); }
}
