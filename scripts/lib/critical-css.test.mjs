import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { blocking, deferred, fontFaces, inlineCritical, MARK, pageDirs, pagesIn } from "./critical-css.mjs";

function site(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "critical-css-"));
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return root;
}

// A stylesheet as next build leaves it: a font named through a variable (next/font), the page's rules, one it does
// not use, a Tailwind arbitrary variant, and states a script sets after the HTML was written.
const CSS = [
  "@font-face{font-family:Body;src:url(../media/body.woff2) format(\"woff2\")}",
  ":root{--font-body:Body}",
  ".title{color:red;font-family:var(--font-body)}",
  ".unused{color:blue}",
  ".\\[\\&_svg\\]\\:size-4 svg{width:1rem}",
  "[data-theme=dark] .title{color:white}",
  ".menu[aria-expanded=true]{display:block}",
].join("");
// The page as Next writes it: React's attribute spellings, empty values written out, self-closing void tags.
const PAGE = '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><link rel="stylesheet" href="/_next/static/css/app.css" data-precedence="next"/><script src="/_next/static/chunks/main.js" async=""></script></head><body><h1 class="title">Hello</h1><img src="/images/mark.svg" alt="" width="24" height="24"/><span class="[&amp;_svg]:size-4"><svg></svg></span><button class="menu" aria-expanded="false">Menu</button><!--$--><!--/$--></body></html>';
const BUILD = { ".next/static/css/app.css": CSS, ".next/server/app/index.html": PAGE };

test("a page gets its own rules inlined, with its fonts, arbitrary variants and script-set states, and stops waiting for the stylesheet", async () => {
  const root = site(BUILD);
  assert.deepEqual(blocking(PAGE), ["/_next/static/css/app.css"]);
  const { html, inlined, skipped } = await inlineCritical(PAGE, root);
  assert.equal(skipped, undefined);
  assert.ok(inlined > 0);
  const style = new RegExp(`<style ${MARK}>([\\s\\S]*?)</style>`).exec(html)?.[1] ?? "";
  assert.match(style, /\.title\{color:red/);
  assert.doesNotMatch(style, /\.unused/);
  assert.match(style, /size-4 svg\{width:1rem\}/);
  assert.match(style, /\[data-theme=dark\] \.title/);
  assert.match(style, /aria-expanded=true/);
  assert.match(style, /@font-face\{font-family:Body;src:url\(\/_next\/static\/media\/body\.woff2\)/);
  assert.match(html, /<style data-critical>[^<]*<\/style><link rel="stylesheet" href="\/_next\/static\/css\/app\.css" data-precedence="next" media="print" onload="this\.media='all'"\/>/);
  assert.match(html, /<noscript><link rel="stylesheet" href="\/_next\/static\/css\/app\.css" data-precedence="next"\/><\/noscript>/);
  assert.deepEqual(blocking(html), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test("the rest of the page stays as Next wrote it, byte for byte", async () => {
  const root = site(BUILD);
  const { html } = await inlineCritical(PAGE, root);
  const undone = html.replace(/<style data-critical>[\s\S]*?<\/style>/, "").replace(/<noscript>[\s\S]*?<\/noscript>/, "").replace(` media="print" onload="this.media='all'"`, "");
  assert.equal(undone, PAGE);
  assert.match(html, /<meta charSet="utf-8"\/>/);
  assert.match(html, /<img src="\/images\/mark\.svg" alt="" width="24" height="24"\/>/);
  assert.doesNotMatch(html, /beasties/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a link with a media of its own gets it back once loaded, and keeps its spelling", () => {
  assert.equal(deferred('<link rel="stylesheet" href="/_next/a.css">'), `<link rel="stylesheet" href="/_next/a.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="/_next/a.css"></noscript>`);
  assert.equal(deferred('<link rel="stylesheet" href="/_next/a.css" media="(width >= 992px)"/>'), `<link rel="stylesheet" href="/_next/a.css" media="print" onload="this.media='(width >= 992px)'"/><noscript><link rel="stylesheet" href="/_next/a.css" media="(width >= 992px)"/></noscript>`);
});

test("a page done once is left as it is", async () => {
  const root = site(BUILD);
  const first = await inlineCritical(PAGE, root);
  const second = await inlineCritical(first.html, root);
  assert.equal(second.skipped, "done");
  assert.equal(second.html, first.html);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a page that links no stylesheet of the build is skipped", async () => {
  const root = site(BUILD);
  const bare = "<!DOCTYPE html><html><head></head><body>error</body></html>";
  assert.equal((await inlineCritical(bare, root)).skipped, "no stylesheet");
  fs.rmSync(root, { recursive: true, force: true });
});

test("font faces resolve against their stylesheet, and absolute or data URLs stay as they are", () => {
  const faces = fontFaces([{ href: "/_next/static/chunks/a.css", css: "@font-face{src:url(../media/x.woff2)}@font-face{src:url(/fonts/y.woff2)}@font-face{src:url(\"data:font/woff2;base64,AA\")}" }]);
  assert.equal(faces, "@font-face{src:url(/_next/static/media/x.woff2)}@font-face{src:url(/fonts/y.woff2)}@font-face{src:url(data:font/woff2;base64,AA)}");
});

test("the pages are the build's and the standalone package's copy", () => {
  const root = site({ ...BUILD, ".next/standalone/server.js": "// server", ".next/standalone/.next/server/app/index.html": PAGE, ".next/server/app/blog-post/a.html": PAGE });
  assert.deepEqual(pageDirs(root).map((d) => path.relative(root, d)), [".next/server/app", ".next/standalone/.next/server/app"]);
  assert.deepEqual(pagesIn(pageDirs(root)[0]).sort(), ["blog-post/a.html", "index.html"]);
  fs.rmSync(root, { recursive: true, force: true });
});
