import assert from "node:assert/strict";
import { test } from "node:test";
import { cx, variants, type VariantProps } from "./cx.ts";

const box = variants({
  base: "border border-line",
  variants: {
    tone: { ink: "text-ink", muted: "text-muted" },
    size: { md: "p-4", lg: "p-8" },
  },
  defaults: { tone: "ink", size: "md" },
  compound: [{ when: { tone: "muted", size: "lg" }, className: "italic" }],
});

test("cx joins the truthy parts and skips the rest", () => {
  assert.equal(cx("a", false, null, undefined, "", "b"), "a b");
  assert.equal(cx(), "");
});

test("the base, then each axis's default, in the axes' order", () => {
  assert.equal(box(), "border border-line text-ink p-4");
  assert.equal(box({}), "border border-line text-ink p-4");
});

test("a chosen option replaces the default on its axis only", () => {
  assert.equal(box({ size: "lg" }), "border border-line text-ink p-8");
  assert.equal(box({ tone: "muted", size: undefined }), "border border-line text-muted p-4");
});

test("a compound applies only when every option it names is picked, defaults included", () => {
  assert.equal(box({ tone: "muted", size: "lg" }), "border border-line text-muted p-8 italic");
  assert.equal(box({ tone: "muted" }), "border border-line text-muted p-4");
  const quiet = variants({
    variants: { tone: { ink: "", muted: "text-muted" } },
    defaults: { tone: "muted" },
    compound: [{ when: { tone: "muted" }, className: "italic" }],
  });
  assert.equal(quiet(), "text-muted italic");
});

test("an option an axis lacks throws and names the options it has", () => {
  // @ts-expect-error the type refuses it before the function does
  assert.throws(() => box({ tone: "loud" }), /variants: "loud" is not an option of tone \(ink, muted\)/);
  assert.throws(() => box({ size: "toString" as never }), /"toString" is not an option of size \(md, lg\)/);
});

test("a default the axis lacks throws when the looks are declared, not at the first call", () => {
  assert.throws(
    () => variants({ variants: { size: { md: "p-4" } }, defaults: { size: "xl" as never } }),
    /"xl" is not an option of size \(md\)/,
  );
});

test("an empty option adds no class, and no base is no class", () => {
  const plain = variants({ variants: { look: { plain: "", boxed: "border" } }, defaults: { look: "plain" } });
  assert.equal(plain(), "");
  assert.equal(plain({ look: "boxed" }), "border");
});

test("VariantProps is each axis's options, optional", () => {
  const props: VariantProps<typeof box> = { tone: "muted" };
  const none: VariantProps<typeof box> = {};
  assert.equal(box(props), "border border-line text-muted p-4");
  assert.equal(box(none), "border border-line text-ink p-4");
});
