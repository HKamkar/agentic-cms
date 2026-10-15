import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { part } from "./parts.ts";
import { motionScript } from "./motionScript.ts";
import { Reveal } from "./Reveal.ts";
import { RevealGroup } from "./RevealGroup.ts";
import { Sequence } from "./Sequence.ts";

test("Reveal is a root and its own part: rise by default, its delay, its element, its own attributes and style kept", () => {
  assert.equal(renderToStaticMarkup(h(Reveal, null, "copy")), `<div data-part="rise" style="--d:0ms" data-motion-root="">copy</div>`);
  const html = renderToStaticMarkup(h(Reveal, { effect: "fade", delay: 240, as: "h2", id: "lede", className: "text-h2", style: { color: "red" } }, "copy"));
  assert.equal(html, `<h2 id="lede" class="text-h2" data-part="fade" style="color:red;--d:240ms" data-motion-root="">copy</h2>`);
});

test("Reveal's intro marks the root to play from the first frame; without it there is no data-intro", () => {
  assert.match(renderToStaticMarkup(h(Reveal, { intro: true, as: "h1" }, "x")), /^<h1 data-part="rise" style="--d:0ms" data-motion-root="" data-intro="">x<\/h1>$/);
  assert.doesNotMatch(renderToStaticMarkup(h(Reveal, null, "x")), /data-intro/);
});

test("RevealGroup staggers its direct children by the step, or by the site's token, keeping their own style", () => {
  const items = ["a", "b", "c"].map((text, i) => h("li", { key: text, style: i === 1 ? { color: "red" } : undefined }, text));
  assert.equal(
    renderToStaticMarkup(h(RevealGroup, { as: "ul", effect: "pop", delay: 100, step: 80, className: "grid" }, items)),
    `<ul class="grid" data-motion-root=""><li style="--d:100ms" data-part="pop">a</li><li style="color:red;--d:180ms" data-part="pop">b</li><li style="--d:260ms" data-part="pop">c</li></ul>`,
  );
  assert.match(renderToStaticMarkup(h(RevealGroup, null, h("p", null, "a"), "text", h("p", null, "b"))), /^<div data-motion-root=""><p data-part="rise" style="--d:calc\(0ms \+ 0 \* var\(--motion-stagger\)\)">a<\/p>text<p data-part="rise" style="--d:calc\(0ms \+ 2 \* var\(--motion-stagger\)\)">b<\/p><\/div>$/);
});

test("Sequence is a root around its parts, and says how long it runs with settle", () => {
  const html = renderToStaticMarkup(h(Sequence, { as: "svg", viewBox: "0 0 10 10", settle: 2600 }, h("path", { ...part("draw", 400), d: "M0 0h10" })));
  assert.equal(html, `<svg viewBox="0 0 10 10" data-motion-root="" data-settle="2600"><path data-part="draw" style="--d:400ms" d="M0 0h10"></path></svg>`);
  assert.doesNotMatch(renderToStaticMarkup(h(Sequence, null)), /data-settle/);
});

test("motionScript arms the page unless the reader prefers reduced motion, and a throw costs nothing", () => {
  const arm = (reduce: boolean, matchMedia?: (query: string) => { matches: boolean }) => {
    const attributes = new Map<string, string>();
    const document = { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } };
    vm.runInNewContext(motionScript(), { document, matchMedia: matchMedia ?? ((query: string) => ({ matches: reduce && query === "(prefers-reduced-motion: reduce)" })) });
    return attributes.get("data-motion");
  };
  assert.equal(arm(false), "on");
  assert.equal(arm(true), undefined);
  assert.equal(arm(false, () => { throw new Error("blocked"); }), undefined);
  assert.doesNotMatch(motionScript(), /<\/script/i);
});
