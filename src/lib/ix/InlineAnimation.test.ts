import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineAnimation, fillBox } from "./InlineAnimation.ts";

const LOOP = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320" data-duration="9.9" data-rest="7.4"><circle r="8"><animate attributeName="cx" values="8;392;8" dur="9.9s" repeatCount="indefinite"/></circle></svg>`;

test("InlineAnimation renders the markup inline in an aria-hidden box with the site's classes, the svg filling it from its own style", () => {
  const html = renderToStaticMarkup(h(InlineAnimation, { markup: LOOP, className: "aspect-[5/4] w-full" }));
  assert.match(html, /^<div aria-hidden="true" class="aspect-\[5\/4\] w-full"><svg style="display:block;width:100%;height:100%" xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="400"/);
  assert.match(html, /data-rest="7\.4"/);
  assert.match(html, /<animate attributeName="cx"/);
});

test("fillBox puts the fill first in an existing style and touches only the root svg", () => {
  assert.equal(fillBox(`<svg style="color:red" viewBox="0 0 1 1"><svg/></svg>`), `<svg style="display:block;width:100%;height:100%;color:red" viewBox="0 0 1 1"><svg/></svg>`);
  assert.equal(fillBox(`<svg><g/></svg>`), `<svg style="display:block;width:100%;height:100%"><g/></svg>`);
});
