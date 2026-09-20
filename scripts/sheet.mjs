#!/usr/bin/env node
// A candidate sheet rendered to one picture: the spec's rows (lettered) and
// cells (numbered), each candidate at the size and on the background the real
// section uses, with the site's own stylesheets when a build exists, so the
// owner picks by row — "B2", "the alternate" — from one image. The spec's
// shape is the comment in lib/sheet.mjs; docs/shot-probe-sheet.md has the
// recipe.
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { fontsReady, imagesReady, launch, serveStatic } from "./lib/browser.mjs";
import { relative } from "./lib/page-command.mjs";
import { buildStylesheets, readSheetSpec, sheetHtml } from "./lib/sheet.mjs";
import { SPECS } from "./lib/specs.mjs";

const { positionals: [specFile], flags } = parseOrExit(SPECS.sheet, process.argv.slice(2));
if (!["light", "dark"].includes(flags.scheme)) { console.error(`sheet: --scheme must be light or dark, not ${flags.scheme}`); process.exit(2); }
const root = process.cwd();
let spec, html;
try {
  spec = readSheetSpec(path.resolve(root, specFile));
  html = sheetHtml(spec, { root, css: flags.url ? [] : buildStylesheets(root) });
} catch (error) {
  console.error(`sheet: ${error.message}`);
  process.exit(2);
}

// Without a served site the build (or public/ alone) is served, so img: cells and the stylesheets resolve.
const server = flags.url ? null : await serveStatic({ root, requireBuild: false });
const base = (flags.url ?? server.url).replace(/\/$/, "");
// A short viewport, so the full-page shot is the sheet's own height.
const { context, close } = await launch({ scheme: flags.scheme, width: flags.width, height: 200, scale: flags.scale });
try {
  const page = await context.newPage();
  await page.route(`${base}/__sheet.html`, (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
  await page.goto(`${base}/__sheet.html`, { waitUntil: "load" });
  await fontsReady(page);
  await imagesReady(page);
  await page.waitForTimeout(200);
  const outFile = path.resolve(root, flags.out ?? path.join(".parity/sheets", `${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await page.screenshot({ path: outFile, fullPage: true });
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  const rows = spec.rows.map((row, i) => ({ id: String.fromCharCode(65 + i), label: row.label ?? "", cells: row.cells.length }));
  const file = relative(root, outFile);
  const summary = `${file}  ${rows.map((r) => `${r.id} ${r.label} (${r.cells})`).join(", ")}`;
  if (flags.json) { console.error(summary); console.log(JSON.stringify({ file, name: spec.name, rows, width: size.width * flags.scale, height: size.height * flags.scale }, null, 1)); } else console.log(summary);
} finally { await close(); server?.close(); }
