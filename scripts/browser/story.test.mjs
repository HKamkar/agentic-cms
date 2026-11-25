// `agentic-cms story` on the fixture's story of two scenes: the whole one
// holds every rule, and each broken one fails the rule it breaks, for the
// reason it breaks it. The rules' own numbers are tested without a browser
// (scripts/lib/story-rules.test.mjs).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { chromePath, webkitPath } from "../lib/browser.mjs";
import { fixtureSite } from "../fixtures/site.mjs";
import { storyPage } from "../fixtures/story.mjs";
import { RULES } from "../lib/story-rules.mjs";

const BIN = path.resolve(import.meta.dirname, "../../bin/agentic-cms.mjs");
const skip = chromePath() ? false : "no Chromium: set CHROME_PATH or run `pnpm exec playwright-core install chromium`";
const skipBoth = skip || (webkitPath() ? false : "no WebKit: run `pnpm exec playwright-core install webkit`");

/** The check on the fixture's story as the page /story of a build: { status, rules, out, stderr }. */
function check(broken, args) {
  const root = fixtureSite();
  try {
    fs.writeFileSync(path.join(root, ".next/server/app/story.html"), storyPage(broken));
    const r = spawnSync(process.execPath, [BIN, "story", "/story", "--json", "--wait", "30", ...args], { cwd: root, encoding: "utf8", maxBuffer: 1e8 });
    const out = r.status < 2 ? JSON.parse(r.stdout) : null;
    const sheets = (out?.sheets ?? []).map((file) => fs.statSync(path.join(root, file)).size);
    return { status: r.status, out, rules: out?.rules ?? [], sheets, stderr: r.stderr };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

// the one rule that times anything is left to CI's story job, which runs alone: other browser tests run beside this one
const UNTIMED = RULES.map(({ rule }) => rule).filter((rule) => rule !== "setup");

test("a story that keeps every rule passes in both engines, and its frames are written to look at", { skip: skipBoth }, () => {
  const { status, out, rules, sheets, stderr } = check(null, ["--out", "sheets", "--only", UNTIMED.join(",")]);
  assert.deepEqual(rules.filter(({ ok }) => !ok), [], stderr);
  assert.equal(status, 0);
  assert.equal(rules.length, 12);
  assert.deepEqual(out.scenes.map(({ id }) => id), ["one", "two"]);
  assert.equal(out.measured.frames.length, 14, "three positions a scene and the hand-over, in two engines");
  assert.equal(out.measured.cards.length, 8, "two cards at four widths");
  assert.equal(sheets.length, 2);
  assert.ok(sheets.every((bytes) => bytes > 2000));
});

const ONE = ["--engines", "chromium"];
for (const [broken, rule, problem, args = ONE] of [
  ["errors", "errors", /^chromium: a shader did not compile$/],
  ["words", "words", /^1 of 5 not readable without JavaScript: "A line only the script knows\."$/],
  ["words-hidden", "words", /^2 of 4 not readable without JavaScript: "The second scene"/],
  ["words-hidden", "still", /^2 of 4 not readable with reduced motion/],
  ["still", "still", /^still drawing with reduced motion: \d+ draw calls/],
  ["first-picture", "first-picture", /^21 programs linked before the first picture \(at most 16\)/],
  ["first-picture-ground", "first-picture", /one flat colour until the scene is drawn/],
  ["setup", "setup", /^the setup blocks the main thread for \d+ ms/],
  ["mid-scroll-made", "mid-scroll", /^made in mid-scroll, over 48 frames: bufferData ×48$/],
  ["mid-scroll-asked", "mid-scroll", /^questions to the graphics process in a frame, over 48 frames: getUniformLocation ×48$/],
  ["pixels", "pixels", /million on a desktop .* on a tablet .* on a phone/],
  ["blank", "blank", /^nothing to see at one to two \(chromium\); two 15% \(chromium\)/],
  ["engines", "engines", /^the two engines draw different pictures at one 15%/, []],
  ["cards", "cards", /^"Another card" at 1920 travels \d+ px while it can be read \(at most 192 px\)/],
  ["cards-window", "cards", /^"A card" at 1920 is cut by the window for 100 %/],
  ["cards-side", "cards", /^"A card" at 1920 jumps 220 px/],
  ["cards-unseen", "cards", /^"Another card" at 1920 is never readable/],
  ["shift", "shift", /^the layout shifts by 0\.\d+/],
  ["stops-hidden", "stops", /^the loop keeps drawing while the tab is hidden$/],
  ["stops-away", "stops", /^the loop keeps drawing while the story is scrolled away$/],
  ["lost", "lost", /^the scene does not come back/],
  ["lost-picture", "lost", /^the scene does not come back/],
]) test(`${rule}: the story broken by "${broken}" fails it`, { skip: args === ONE ? skip : skipBoth }, () => {
  const { status, rules, stderr } = check(broken, ["--only", rule, ...args]);
  assert.equal(status, 1, stderr);
  assert.equal(rules.length, 1);
  assert.match(rules[0].problem, problem);
});

test("a page without the hook, without its scenes or never ready is one finding; a rule there is none of is a usage error", { skip }, () => {
  for (const [broken, problem] of [["hook", "no window.__story after 3 s"], ["hook-scenes", "window.__story has no scenes of { id, from, to }"], ["hook-ready", "window.__story.ready did not come in 3 s"]]) {
    const none = check(broken, ["--only", "pixels", "--wait", "3", ...ONE]);
    assert.equal(none.status, 1, none.stderr);
    assert.deepEqual(none.rules, [{ rule: "hook", ok: false, problem }]);
  }
  const wrong = check(null, ["--only", "glow"]);
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /^story: no rule glow \(errors, words, /);
});
