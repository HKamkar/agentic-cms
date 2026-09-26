import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readInlineSvg } from "./index.ts";

const LOOP = `<?xml version="1.0"?>\n<!-- drawn in the lab -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" data-duration="2" data-rest="1"><defs><mask id="cut"><rect width="64" height="64" fill="#fff"/></mask></defs><circle id="dot" r="8" mask="url(#cut)"><animate attributeName="cx" values="8;56;8" dur="2s" repeatCount="indefinite"/></circle><use href="#dot" y="20"/></svg>\n`;

function site(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "inline-svg-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}

test("readInlineSvg: the site's SVG as inline markup — prolog and comments gone, every id and reference its own, data-duration and data-rest kept", () => {
  const root = site({ "public/images/home/loop.svg": LOOP });
  const markup = readInlineSvg("public/images/home/loop.svg", { prefix: "home-loop", root });
  assert.match(markup, /^<svg /);
  assert.doesNotMatch(markup, /<\?xml|<!--/);
  assert.match(markup, /id="home-loop-cut"/);
  assert.match(markup, /mask="url\(#home-loop-cut\)"/);
  assert.match(markup, /<use href="#home-loop-dot"/);
  assert.match(markup, /data-duration="2" data-rest="1"/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("readInlineSvg refuses a file outside the site, one under node_modules, and markup that carries code", () => {
  const root = site({ "public/images/x.svg": `<svg onload="alert(1)"/>`, "node_modules/pkg/a.svg": "<svg/>" });
  assert.throws(() => readInlineSvg("../outside.svg", { prefix: "x", root }), /only an SVG the site's repository owns is put inline/);
  assert.throws(() => readInlineSvg("node_modules/pkg/a.svg", { prefix: "x", root }), /only an SVG the site's repository owns/);
  assert.throws(() => readInlineSvg("public/images/x.svg", { prefix: "x", root }), /carries code \(onload=\)/);
  fs.rmSync(root, { recursive: true, force: true });
});
