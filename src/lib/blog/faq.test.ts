import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFaq } from "./faq.ts";

test("extractFaq: the questions under the FAQ heading, each answer without its images, links or emphasis", () => {
  const body = "## Intro\n\nText.\n\n## Frequently asked questions\n\n### Is it *fast*?\n\nYes: see [the guide](/docs/guide \"Guide\") and ![a chart](/c.png) the `numbers`.\n\n### Is it done?\n\nAlmost.\n\n## Next\n\nAfter.";
  assert.deepEqual(extractFaq(body), [
    { question: "Is it fast?", answer: "Yes: see the guide and  the numbers." },
    { question: "Is it done?", answer: "Almost." },
  ]);
});

test("extractFaq reads a run of unclosed image or link openers in linear time", () => {
  const start = performance.now();
  const answer = extractFaq(`## FAQ\n\n### Q?\n\n${"![".repeat(20000)} ${"[a](".repeat(20000)}`)[0].answer;
  assert.ok(performance.now() - start < 500, `${Math.round(performance.now() - start)} ms`);
  assert.ok(answer.startsWith("!["), "nothing to strip: the text stays");
});
