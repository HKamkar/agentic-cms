// Each rule of a motion story on numbers of its own: what holds, what breaks
// it, and what the reader of the report is told.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { SPECS } from "./specs.mjs";
import { blank, cards, engines, errors, firstPicture, judge, LIMITS, lost, midScroll, pixels, RULES, rulesFor, setup, shift, still, stops, words } from "./story-rules.mjs";

const line = (text, visible = true) => ({ text, visible });
const CARD = { name: "A card", width: 1440, longer: 1440, readable: 50, inside: 50, path: 100, jump: 4 };

test("errors: a line of any engine is told with its engine", () => {
  assert.equal(errors({ chromium: [], webkit: [] }), null);
  assert.equal(errors({ chromium: [], webkit: ["0:1: no such function"] }), "webkit: 0:1: no such function");
});

test("words: every heading and paragraph of the live page is readable without it", () => {
  const live = [line("A title", false), line("A line")];
  assert.equal(words({ live, without: [line("A title"), line("A line")] }, "without JavaScript"), null, "hidden in the live page on purpose, until its chapter");
  assert.match(words({ live, without: [line("A title"), line("A line", false)] }, "without JavaScript"), /^1 of 2 not readable without JavaScript: "A line"$/);
  assert.match(words({ live: [], without: [] }, "without JavaScript"), /no heading and no paragraph/);
});

test("still: the words with reduced motion, and no drawing once it stands", () => {
  const live = [line("A title")];
  assert.equal(still({ live, without: live, draws: 0 }), null);
  assert.match(still({ live, without: [], draws: 0 }), /not readable with reduced motion/);
  assert.match(still({ live, without: live, draws: 60 }), /60 draw calls/);
});

test("first-picture: the mark, the programs before it, the painted ground", () => {
  assert.equal(firstPicture({ programs: 12, ground: 9 }), null);
  assert.match(firstPicture({ programs: null, ground: 9 }), /story:first-picture/);
  assert.match(firstPicture({ programs: 17, ground: 9 }), /17 programs/);
  assert.match(firstPicture({ programs: 12, ground: 0 }), /flat colour/);
});

test("setup, pixels and shift: over the number, and at it", () => {
  assert.equal(setup({ blocked: 200 }), null);
  assert.match(setup({ blocked: 201 }), /201 ms/);
  assert.equal(pixels({ desktop: 1.9e6, tablet: 1.3e6, phone: 0.9e6 }), null);
  assert.match(pixels({ desktop: 4e6, tablet: 1.3e6, phone: 2e6 }), /4.00 million on a desktop.*2.00 million on a phone/);
  assert.equal(shift({ shift: 0.02 }), null);
  assert.match(shift({ shift: 0.2 }), /0.200/);
});

test("mid-scroll: what was made and what was asked, the most first; no frame is no pass", () => {
  assert.equal(midScroll({ made: {}, asked: {}, draws: 48, frames: 48 }), null);
  assert.equal(midScroll({ made: { createTexture: 2, bufferData: 48 }, asked: {}, draws: 48, frames: 48 }), "made in mid-scroll, over 48 frames: bufferData ×48; createTexture ×2");
  assert.match(midScroll({ made: {}, asked: { getParameter: 48 }, draws: 48, frames: 48 }), /questions to the graphics process/);
  assert.match(midScroll({ made: {}, asked: {}, draws: 0, frames: 48 }), /^no draw call was seen over 48 frames/);
});

test("blank and engines: frames without a picture, pictures that differ, patches white in one engine", () => {
  assert.equal(blank([{ engine: "chromium", at: "one 50%", spread: 14 }]), null);
  assert.equal(blank([{ engine: "webkit", at: "one 50%", spread: 0.2 }]), "nothing to see at one 50% (webkit)");
  assert.equal(engines([{ at: "one 50%", mean: 0.4, blown: 0 }]), null);
  assert.match(engines([{ at: "one 50%", mean: 12, blown: 0 }]), /12.0 of 255/);
  assert.match(engines([{ at: "one 50%", mean: 0.4, blown: 0.01 }]), /1.00 % white in one and dark in the other/);
});

test("cards: the path, a jump, the window, and a card nobody reads", () => {
  assert.equal(cards([CARD]), null);
  assert.match(cards([{ ...CARD, path: 145 }]), /travels 145 px while it can be read \(at most 144 px\)/);
  assert.match(cards([{ ...CARD, path: 120, jump: 90 }]), /jumps 90 px/);
  assert.match(cards([{ ...CARD, inside: 40 }]), /cut by the window for 20 %/);
  assert.match(cards([{ ...CARD, readable: 0, inside: 0, path: 0 }]), /never readable/);
  assert.equal(cards([{ ...CARD, width: 390, longer: 844, readable: 0, inside: 0, path: 0 }]), null, "a phone may leave a card out");
  assert.equal(cards([]), null, "a story without cards");
});

test("stops and lost: a loop for nobody, a scene that does not come back", () => {
  assert.equal(stops({ seen: 60, hidden: 0, away: 0 }), null);
  assert.equal(stops({ seen: 60, hidden: 60, away: 60 }), "the loop keeps drawing while the tab is hidden and while the story is scrolled away");
  assert.match(stops({ seen: 0, hidden: 0, away: 0 }), /draws nothing/);
  assert.equal(lost({ restored: true, mean: 0 }), null);
  assert.match(lost({ restored: true, mean: 30 }), /another picture/);
  assert.match(lost({ restored: false, mean: null }), /does not come back/);
});

test("rulesFor: all of them, some, one engine, a wrong name; judge keeps their order", () => {
  assert.equal(rulesFor([], ["chromium", "webkit"]).length, RULES.length);
  assert.equal(rulesFor([], ["chromium"]).some(({ rule }) => rule === "engines"), false, "one engine compares nothing, and no rule says it did");
  assert.deepEqual(rulesFor(["cards", "setup"], ["chromium"]).map(({ rule }) => rule), ["setup", "cards"]);
  assert.throws(() => rulesFor(["card"], ["chromium"]), /no rule card \(errors, words/);
  assert.deepEqual(judge(rulesFor(["setup", "cards"], ["chromium"]), { setup: { blocked: 10 }, cards: [{ ...CARD, path: 400 }] }).map(({ rule, problem }) => [rule, !problem]), [["setup", true], ["cards", false]]);
});

test("the help and the guide name every rule, and the guide's numbers are the rules'", () => {
  const guide = fs.readFileSync(path.resolve(import.meta.dirname, "../../docs/motion-story.md"), "utf8");
  for (const { rule } of RULES) {
    assert.match(SPECS.story.flags.only.help, new RegExp(`\\b${rule}\\b`));
    assert.ok(guide.includes(`| \`${rule}\` |`), `docs/motion-story.md § The check has a row for ${rule}`);
  }
  for (const number of [`${LIMITS.blocked} ms in all`, "a tenth of the screen's longer side", `${LIMITS.programs} programs`, "1.9 million on a desktop, 1.3 on a tablet, 0.9 on a phone", `| Layout shift | ${LIMITS.shift} |`]) assert.ok(guide.includes(number), `the guide says "${number}"`);
});
