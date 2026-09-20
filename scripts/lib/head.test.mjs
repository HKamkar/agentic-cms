import assert from "node:assert/strict";
import { test } from "node:test";
import { pageTitles } from "./head.mjs";

test("the page's title is the one in <head>; an icon's <title> in the body is not counted", () => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Acme: the site</title></head><body><svg role="img"><title>NVIDIA</title><path d="M0 0"/></svg><svg><title>Docker</title></svg></body></html>`;
  assert.deepEqual(pageTitles(html), ["Acme: the site"]);
  assert.deepEqual(pageTitles(`<head><title>A</title><title>B</title></head>`), ["A", "B"]);
  assert.deepEqual(pageTitles(`<head></head><body><title>x</title></body>`), []);
  assert.deepEqual(pageTitles(`<title>no head at all</title>`), ["no head at all"], "a fragment without <head> is read whole");
});
