// One negative case per lint rule, a clean tree that yields nothing, and the
// real tree, which must never FAIL (that is what keeps `pnpm build` green).
// Trees are scratch directories from the engine's own test helpers; the
// public/ images a case needs are written under the same root before the
// lint runs. Run with `pnpm test` (the TypeScript engine loads through
// scripts/lib/load-ts.mjs).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { pathToFileURL } from "node:url";
import { postTree, withContent } from "../src/lib/content/test-helpers.ts";
import { kit } from "../src/kit.ts";
import { createLocales } from "../src/lib/locales.ts";
import { format, lint as lintTree, readVoice } from "./lib/content-lint.mjs";
import { scaffold } from "./lib/init.mjs";

/** The lint on the example site's registry and config; the trees under test are the scratch ones each case writes. */
const { site } = kit;
const lint = (options) => lintTree({ collections: kit.collections, site, ...options });

const REPO = path.resolve(import.meta.dirname, "..");
const NOW = new Date("2026-09-15T12:00:00Z");

/** A small voice: enough to hit every text rule once. */
const VOICE = {
  brand: { name: "nimbus", mark: "®" },
  banned: [
    { match: "robust", why: "filler", instead: "say what it does" },
    { match: "hosted API", instead: "a public AI API", except: ["content/blog/grandfathered.md"] },
    { match: "operator", where: ["pages", "faqs"] },
  ],
  patterns: [{ regex: "^Furthermore,", flags: "m", why: "opener" }],
  claims: { words: ["compliant", "certified"], phrases: ["compliance-ready"], regulations: ["GDPR", "NEN 7510"], subject: "\\b(?:nimbus®?|we|our|the platform)\\b", negation: "not|no|never", instead: "designed to support <the regulation>" },
  models: { names: ["Llama"], instead: "open-weight models", except: ["content/blog/excepted.md"] },
  clouds: { names: ["AWS"], stack: "\\b(?:nimbus®?|we|our stack)\\b[^.;]{0,50}\\b(?:runs?|running|hosted|built)\\b[^.;]{0,20}\\b(?:on|in)\\b", instead: "the stack is Terraform, Kubernetes, Docker" },
};

const VOICE_MD = (yaml) => `# Voice\n\nProse.\n\n<!-- voice-rules:start -->\n\`\`\`yaml\n${yaml}\`\`\`\n<!-- voice-rules:end -->\n`;
const VOICE_YAML = `brand: { name: nimbus }
banned: [{ match: robust }]
patterns: []
claims: { words: [compliant], regulations: [GDPR], subject: we, negation: not, instead: designed to support }
models: { names: [], instead: open-weight models }
clouds: { names: [], stack: runs on, instead: only the customer's }
`;

const FRONTMATTER = [
  "title: A post",
  "excerpt: What the reader gets from this post in thirty to forty words that describe the promise, the audience and the angle without repeating the title at all, said once more for length.",
  'date: "2026-05-02"',
  "category: fintech",
  "author: h-kamkar",
  "image: /images/blog/x/x-hero.webp",
  "imageAlt: A Dutch founder reading a rejected security questionnaire",
  "thumbnail: /images/blog/x/x-card.webp",
  "thumbnailAlt: The same founder, closer",
  "seoTitle: A post about private AI for regulated buyers | nimbus®",
  "seoDescription: A meta description of the right length, written as one sentence that carries the page's promise to the reader who searched.",
  "keywords: [private AI, compliance, GDPR]",
  'publishedAt: "2026-05-02T09:00:00.000Z"',
].join("\n");

const BODY = `
## The problem

nimbus® builds private AI infrastructure. This paragraph is fine.

> "A line lifted from the post."

![A blueprint of the deployment](/images/blog/x/x-mid.webp)

## Frequently asked questions

### Is this a question?

Yes, and this is its answer.
`;

/** The full scratch tree: every collection valid, every image present, so only what a case changes shows up. */
const CLEAN = {
  "authors.json": JSON.stringify({ "h-kamkar": { name: "H. Kamkar", image: "/images/authors/h-kamkar.webp", imageAlt: "H. Kamkar in the Delft office" } }),
  "categories.json": JSON.stringify({ fintech: { name: "Fintech" }, "private-ai": { name: "Private AI" } }),
  "reviews.yaml": '- name: A. Client\n  role: CTO\n  quote: "\\"nimbus® did what it said.\\""\n  photo: /images/home/client.webp\n',
  "faqs/about.yaml": "items:\n  - question: Why files?\n    answer: Because they can be reviewed.\n",
  "use-cases.yaml": "- sector: Healthcare\n  title: Hospitals\n  text: Private AI inside the perimeter.\n  icon: /images/use-cases/health.svg\n",
  "pages/blog.yaml": ["seo:", "  path: /blog", "  title: Insights on private AI | nimbus®", "  description: Notes on running private AI under your own control, for founders selling into regulated industries.", "  ogImage: /images/blog-og.jpg", '  updated: "2026-09-01"', "  breadcrumb: Blog", "jsonld:", "  type: Blog", "sections:", "  - type: blog-index", "    label: From the team", "    heading: Insights", "    listEyebrow: Latest", "    listHeading: Every post", "    cta: Run private AI"].join("\n") + "\n",
  "blog/x.md": `---\n${FRONTMATTER}\n---\n${BODY}`,
  "redirects.yaml": "[]\n",
};
/** Body line numbers: the frontmatter block ends at line OFFSET; a paragraph appended after BODY lands on APPENDED. */
const OFFSET = 1 + FRONTMATTER.split("\n").length + 1;
const LINE = (index) => OFFSET + index + 1;
const APPENDED = OFFSET + BODY.split("\n").length + 1;
const IMAGES = ["images/authors/h-kamkar.webp", "images/home/client.webp", "images/use-cases/health.svg", "images/blog-og.jpg", "images/blog/x/x-hero.webp", "images/blog/x/x-card.webp", "images/blog/x/x-mid.webp"];

const publicFile = (root, rel, bytes = 16) => {
  const file = path.join(root, "public", rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(bytes));
};
const post = (frontmatter = FRONTMATTER, body = BODY) => `---\n${frontmatter}\n---\n${body}`;
const swap = (from, to) => FRONTMATTER.replace(from, to);
/** Runs the lint on CLEAN with `files` overriding, `setup(root)` adding to public/, and returns the formatted lines; `site` and `production` go to the lint. */
const run = (files = {}, { setup, voice = VOICE, images = IMAGES, ...options } = {}) => // voice: null reads content/VOICE.md
  withContent({ ...CLEAN, ...files }, (root) => {
    for (const rel of images) publicFile(root, rel);
    setup?.(root);
    return lint({ root, voice: voice ?? undefined, now: NOW, ...options }).findings.map(format);
  });
/** A file under the scratch tree's root, outside content/ (a site's config, its package.json). */
const rootFile = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
const has = (lines, expected) => assert.ok(lines.some((line) => line.includes(expected)), `expected a line containing:\n  ${expected}\nin:\n  ${lines.join("\n  ") || "(nothing)"}`);
const lacks = (lines, rule) => assert.deepEqual(lines.filter((line) => line.includes(` ${rule}: `)), [], `no ${rule} line expected`);

describe("the clean tree", () => {
  test("yields nothing", () => assert.deepEqual(run(), []));
  test("the real content tree never fails the build", () => {
    const { findings, collections } = lint({ root: REPO, now: NOW });
    assert.equal(collections.length, 8);
    assert.deepEqual(findings.filter((f) => f.level === "FAIL").map(format), []);
  });
  test("format prints LEVEL file rule: path problem, with no double space for a file-level finding", () => {
    assert.equal(format({ level: "WARN", file: "content/blog/x.md", rule: "seo-title", path: "seoTitle", problem: "is 66 characters" }), "WARN content/blog/x.md seo-title: seoTitle is 66 characters");
    assert.equal(format({ level: "WARN", file: "public/images/blog/y", rule: "image-orphan", path: "", problem: "no post" }), "WARN public/images/blog/y image-orphan: no post");
  });
});

describe("the engine comes first", () => {
  test("a schema error is one FAIL line per issue, verbatim, and the other collections still run", () => {
    withContent({ ...CLEAN, "blog/x.md": post(FRONTMATTER.replace("title: A post\n", "")) }, (root) => {
      for (const rel of IMAGES) publicFile(root, rel);
      const { findings, collections } = lint({ root, voice: VOICE, now: NOW });
      has(findings.map(format), "FAIL content/blog/x.md schema: title is required");
      assert.deepEqual(collections.map((c) => `${c.name}:${c.entries}`), ["authors:1", "categories:2", "posts:0", "reviews:1", "faqs:1", "useCases:1", "pages:1", "redirects:0"]);
    });
  });
  test("a missing collection file is a FAIL on the file", () => {
    const lines = withContent(postTree(FRONTMATTER), (root) => lint({ root, voice: VOICE, now: NOW }).findings.map(format));
    has(lines, "FAIL content/reviews.yaml schema: no such file");
    has(lines, "FAIL content/faqs schema: no such directory");
  });
});

describe("the voice block", () => {
  test("is read from content/VOICE.md when no voice is given", () => {
    const lines = run({ "VOICE.md": VOICE_MD(VOICE_YAML), "blog/x.md": post(FRONTMATTER, BODY + "\nA robust plan.\n") }, { voice: null });
    has(lines, `voice-banned: line ${APPENDED} "robust" is banned`);
  });
  test("a missing file, a missing block and a bad shape each FAIL on content/VOICE.md", () => {
    has(run({}, { voice: null }), "FAIL content/VOICE.md voice: does not exist");
    has(run({ "VOICE.md": "# Voice\n\nno block\n" }, { voice: null }), "FAIL content/VOICE.md voice: no block between");
    has(run({ "VOICE.md": VOICE_MD("brand: { name: nimbus }\nbanned: [{ why: x }]\n") }, { voice: null }), "FAIL content/VOICE.md voice: banned[0].match");
    has(run({ "VOICE.md": VOICE_MD(VOICE_YAML + "extra: 1\n") }, { voice: null }), "FAIL content/VOICE.md voice: unknown key(s) extra");
  });
  test("readVoice returns the parsed rules", () => {
    withContent({ "VOICE.md": VOICE_MD(VOICE_YAML) }, (root) => {
      const { voice } = readVoice(path.join(root, "content/VOICE.md"));
      assert.equal(voice.banned[0].match, "robust");
    });
  });
});

describe("voice rules", () => {
  test("a banned word in a body line, a field and a FAQ answer", () => {
    const lines = run({ "blog/x.md": post(FRONTMATTER, BODY + "\nA robust plan.\n"), "faqs/about.yaml": "items:\n  - question: Why?\n    answer: A robust reason.\n" });
    has(lines, `FAIL content/blog/x.md voice-banned: line ${APPENDED} "robust" is banned (filler); write "say what it does"`);
    has(lines, 'FAIL content/faqs/about.yaml voice-banned: items[0].answer "robust" is banned');
  });
  test("whole words only: robustness is not robust", () => lacks(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nIts robustness.\n") }), "voice-banned"));
  test("except silences a file, where limits a collection", () => {
    const grand = run({ "blog/grandfathered.md": post(FRONTMATTER, BODY + "\nThe hosted API.\n") });
    lacks(grand, "voice-banned");
    const operator = run({ "blog/x.md": post(FRONTMATTER, BODY + "\nThe operator.\n"), "faqs/about.yaml": "items:\n  - question: Who?\n    answer: The operator.\n" });
    assert.equal(operator.filter((line) => line.includes("voice-banned")).length, 1);
    has(operator, "content/faqs/about.yaml voice-banned");
  });
  test("a pattern", () => has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nFurthermore, more.\n") }), `voice-pattern: line ${APPENDED} "Furthermore," matches a banned pattern (opener)`));
  test("the real VOICE.md: leverage the verb warns, leverage the noun does not", () => {
    const real = readVoice(path.join(REPO, "content/VOICE.md")).voice;
    has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nWe leverage the platform.\n") }, { voice: real }), `voice-pattern: line ${APPENDED} "leverage the"`);
    lacks(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nAdopted for leverage.\n") }, { voice: real }), "voice-pattern");
  });
  test("a claim word near a regulation with nimbus® as the subject, a claim phrase anywhere; not a negation, a third party, or a bare claim word", () => {
    const lines = run({ "blog/x.md": post(FRONTMATTER, BODY + "\nWe are GDPR compliant.\n\nA compliance-ready stack.\n\nThe hospital is certified.\n\nWe are not NEN 7510 certified ourselves.\n\nThe hospital is NEN 7510 certified; we are not.\n\nWe deploy inside their NEN 7510 certified perimeter.\n\nFounders tell the hospital \"we will be NEN 7510 certified by Q2\" and lose the quarter.\n\nThe words \"compliance-ready\" and \"private AI\" mean different things to different buyers.\n") });
    has(lines, `voice-claim: line ${APPENDED} "compliant" near "GDPR" reads as a certification claim; write "designed to support GDPR"`);
    has(lines, `voice-claim: line ${APPENDED + 2} "compliance-ready" reads as a compliance claim`);
    for (const offset of [4, 6, 8, 10, 12, 14]) assert.equal(lines.filter((line) => line.includes(`line ${APPENDED + offset}`)).length, 0, `line ${APPENDED + offset} must not be a claim`);
  });
  test("structured data and card copy speak for nimbus®: a claim word there needs no subject", () => {
    has(run({ "pages/blog.yaml": CLEAN["pages/blog.yaml"].replace("description: Notes on running private AI under your own control, for founders selling into regulated industries.", "description: Private AI that is GDPR compliant, for founders selling into regulated industries and their teams.") }), 'WARN content/pages/blog.yaml voice-claim: seo.description "compliant" near "GDPR"');
  });
  test("a model name fails", () => has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nWe run Llama.\n") }), `FAIL content/blog/x.md voice-model: line ${APPENDED} names the model "Llama"; write "open-weight models"`));
  test("models.except lifts the model rule on its files, and nothing else", () => {
    const lines = run({ "blog/excepted.md": post(FRONTMATTER, BODY + "\nWe run Llama on a robust rig.\n") });
    lacks(lines, "voice-model");
    has(lines, `FAIL content/blog/excepted.md voice-banned: line ${APPENDED} "robust" is banned`);
  });
  test("a cloud as what the nimbus® stack runs on warns (a heuristic); the customer's account and the installer's variant do not; a link target never counts", () => {
    has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nThe nimbus® platform runs on AWS.\n") }), `voice-cloud: line ${APPENDED} "AWS" as part of the nimbus® stack`);
    lacks(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nDeploy in your customer's AWS account. The AWS variant of the installer ships next.\n") }), "voice-cloud");
    lacks(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nSee [the guide](/blog-post/private-ai-on-aws-project).\n") }), "voice-cloud");
  });
  test("the mark: bare nimbus fails; nimbus®, e-mails, any domain and paths do not", () => {
    has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nAsk nimbus.\n") }), `FAIL content/blog/x.md brand-mark: line ${APPENDED} "nimbus" without the ® mark; write "nimbus®"`);
    lacks(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nAsk nimbus® at hi@nimbus.ai or nimbus.ai, see /images/nimbus-logo.svg.\n") }), "brand-mark");
    lacks(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nThe address is nimbus.example.\n") }), "brand-mark");
    has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nAsk Nimbus.\n") }), `FAIL content/blog/x.md brand-case: line ${APPENDED} "Nimbus" is not how the brand is spelled; write "nimbus®"`);
    lacks(run({ "pages/blog.yaml": CLEAN["pages/blog.yaml"].replace("label: From the team", "label: WHAT IS NIMBUS") }), "brand-case"); // the design uppercases eyebrows and labels
  });
  test("a brand without a mark has no brand-mark rule, and its own spelling is never miscased", () => {
    const acme = { ...VOICE, brand: { name: "Acme" } };
    const lines = run({ "blog/x.md": post(FRONTMATTER, BODY + "\nAsk Acme, not ACME.\n") }, { voice: acme });
    lacks(lines, "brand-mark");
    has(lines, `FAIL content/blog/x.md brand-case: line ${APPENDED} "ACME" is not how the brand is spelled; write "Acme"`);
    lacks(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nAsk Acme.\n") }, { voice: acme }), "brand-case");
  });
  test("the workshop file is optional; its shape is checked, its folder's presence is not", () => {
    lacks(run({ "editorial/workshop.yaml": "path: ../nowhere\nroles: { briefs: briefs, research: research }\n" }), "workshop");
    has(run({ "editorial/workshop.yaml": "path: ../nowhere\nroles: { serp: research }\n" }), "FAIL content/editorial/workshop.yaml workshop: roles unknown key(s) serp; the roles are strategy, keywords, research, briefs, drafts, prompts, glossary, history");
    has(run({ "editorial/workshop.yaml": "roles: { briefs: briefs }\n" }), "FAIL content/editorial/workshop.yaml workshop: path is required: where the workshop is, relative to the repo root or absolute");
    has(run({ "editorial/workshop.yaml": "path: [\n" }), "FAIL content/editorial/workshop.yaml workshop: invalid YAML");
  });
  test("an em dash fails, in a body and in a page field", () => {
    has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nOne — two.\n") }), `FAIL content/blog/x.md em-dash: line ${APPENDED} contains an em dash`);
    has(run({ "pages/blog.yaml": CLEAN["pages/blog.yaml"].replace("heading: Insights", "heading: Insights — notes") }), "FAIL content/pages/blog.yaml em-dash: sections[0].heading contains an em dash");
  });
});

describe("frontmatter rules", () => {
  test("alt pairs and weak alts", () => {
    has(run({ "blog/x.md": post(swap("imageAlt: A Dutch founder reading a rejected security questionnaire\n", "")) }), "FAIL content/blog/x.md alt-pair: imageAlt is missing while image is set");
    has(run({ "blog/x.md": post(swap("thumbnailAlt: The same founder, closer", 'thumbnailAlt: "Index card image for: A post"')) }), 'FAIL content/blog/x.md alt-weak: thumbnailAlt "Index card image for: A post" names the slot, not the picture');
    has(run({ "authors.json": JSON.stringify({ "h-kamkar": { name: "H. Kamkar", image: "/images/authors/h-kamkar.webp" } }) }), "FAIL content/authors.json alt-pair: h-kamkar.imageAlt is missing while image is set");
    lacks(run(), "alt-pair"); // a review's portrait may stay decorative
  });
  test("keywords: too few, too many, missing", () => {
    has(run({ "blog/x.md": post(swap("keywords: [private AI, compliance, GDPR]", "keywords: [private AI, compliance]")) }), "FAIL content/blog/x.md keywords-count: keywords has 2 entries; 3–8");
    has(run({ "blog/x.md": post(swap("keywords: [private AI, compliance, GDPR]", "keywords: [a, b, c, d, e, f, g, h, i]")) }), "keywords has 9 entries; 3–8");
    has(run({ "blog/x.md": post(swap("keywords: [private AI, compliance, GDPR]\n", "")) }), "FAIL content/blog/x.md keywords-count: keywords is missing; 3–8 keywords");
  });
  test("titles: over 60 warns, over 70 fails, a title without seoTitle counts the suffix", () => {
    has(run({ "blog/x.md": post(swap("seoTitle: A post about private AI for regulated buyers | nimbus®", `seoTitle: ${"x".repeat(61)}`)) }), "WARN content/blog/x.md seo-title: seoTitle is 61 characters; Google shows about 60");
    has(run({ "blog/x.md": post(swap("seoTitle: A post about private AI for regulated buyers | nimbus®", `seoTitle: ${"x".repeat(71)}`)) }), "FAIL content/blog/x.md seo-title: seoTitle is 71 characters (70 at most)");
    const suffix = ` | ${site.name}`; // the layout's title template, whatever the site is called
    const title = "t".repeat(63 - suffix.length); // renders at 63: over the 60 that warns, under the 70 that fails
    has(run({ "blog/x.md": post(swap("seoTitle: A post about private AI for regulated buyers | nimbus®\n", "").replace("title: A post", `title: ${title}`)) }), `WARN content/blog/x.md seo-title: title renders as "${title}${suffix}", 63 characters; set a seoTitle of 60 or fewer`);
    has(run({ "pages/blog.yaml": CLEAN["pages/blog.yaml"].replace("title: Insights on private AI | nimbus®", `title: ${"p".repeat(64)}`) }), "WARN content/pages/blog.yaml seo-title: seo.title is 64 characters");
  });
  test("descriptions: 70–160 warns outside, 50/200 fails outside, the excerpt stands in", () => {
    has(run({ "blog/x.md": post(swap(/seoDescription: .*/, `seoDescription: ${"d".repeat(65)}`)) }), "WARN content/blog/x.md seo-description: seoDescription is 65 characters; 70–160");
    has(run({ "blog/x.md": post(swap(/seoDescription: .*/, `seoDescription: ${"d".repeat(201)}`)) }), "FAIL content/blog/x.md seo-description: seoDescription is 201 characters (50–200)");
    const excerpt = run({ "blog/x.md": post(swap(/seoDescription: .*\n/, "").replace(/excerpt: .*/, "excerpt: An excerpt of sixty-odd characters that stands in for the meta line.")) });
    has(excerpt, "WARN content/blog/x.md seo-description: excerpt is 68 characters; 70–160 (it is the meta description; or set seoDescription)");
    has(run({ "pages/blog.yaml": CLEAN["pages/blog.yaml"].replace(/  description: .*/, "  description: Too short.") }), "FAIL content/pages/blog.yaml seo-description: seo.description is 10 characters (50–200)");
  });
  test("excerpt word count", () => has(run({ "blog/x.md": post(swap(/excerpt: .*/, "excerpt: Only five words are here.")) }), "FAIL content/blog/x.md excerpt-words: excerpt has 5 words; 30–40"));
  test("dates: a rolled-over day fails, a future day warns, on posts and pages", () => {
    has(run({ "blog/x.md": post(swap('date: "2026-05-02"', 'date: "2026-02-30"')) }), 'FAIL content/blog/x.md date-rollover: date "2026-02-30" is not a calendar day (Date.parse rolls it to 2026-03-02)');
    has(run({ "blog/x.md": post(swap('date: "2026-05-02"', 'date: "2026-12-01"')) }), 'WARN content/blog/x.md date-future: date "2026-12-01" is in the future (today is 2026-09-15)');
    has(run({ "pages/blog.yaml": CLEAN["pages/blog.yaml"].replace('updated: "2026-09-01"', 'updated: "2026-11-31"') }), 'FAIL content/pages/blog.yaml date-rollover: seo.updated "2026-11-31" is not a calendar day');
  });
  test("updatedAt before publishedAt fails", () => has(run({ "blog/x.md": post(FRONTMATTER + '\nupdatedAt: "2026-05-01T09:00:00.000Z"') }), "FAIL content/blog/x.md date-order: updatedAt 2026-05-01T09:00:00.000Z is before publishedAt 2026-05-02T09:00:00.000Z"));
  test("a stale draft warns; a fresh one, a published post and a retired one do not", () => {
    has(run({ "blog/x.md": post(FRONTMATTER + "\ndraft: true") }), "WARN content/blog/x.md draft-stale: draft for 136 days (date 2026-05-02); publish it, or retire it with a \"retired\" row in content/editorial/calendar.md");
    lacks(run({ "blog/x.md": post(FRONTMATTER + "\ndraft: true"), "editorial/calendar.md": "| date | slug | status | owner | note |\n|---|---|---|---|---|\n| 2026-09-15 | x | retired | kamkar | superseded |\n" }), "draft-stale");
    lacks(run({ "blog/x.md": post(swap('date: "2026-05-02"', 'date: "2026-09-01"') + "\ndraft: true") }), "draft-stale");
    lacks(run(), "draft-stale");
  });
});

describe("body rules", () => {
  test("an H1, a level jump, and a heading inside a fence", () => {
    has(run({ "blog/x.md": post(FRONTMATTER, "\n# Title again\n" + BODY) }), `FAIL content/blog/x.md heading-level: line ${LINE(1)} "# Title again" is an H1; the title is the H1, body headings start at ##`);
    has(run({ "blog/x.md": post(FRONTMATTER, "\n### Deep first\n" + BODY) }), `FAIL content/blog/x.md heading-level: line ${LINE(1)} "### Deep first" jumps from the title to ###`);
    has(run({ "blog/x.md": post(FRONTMATTER, BODY.replace("## The problem", "## The problem\n\n#### Too deep")) }), '"#### Too deep" jumps from ## to ####');
    lacks(run({ "blog/x.md": post(FRONTMATTER, "\n```sh\n# a comment\n```\n" + BODY) }), "heading-level");
  });
  test("the FAQ section: no questions, a wrong level, an unanswered question", () => {
    has(run({ "blog/x.md": post(FRONTMATTER, BODY.replace(/### Is this a question\?\n\nYes, and this is its answer.\n/, "")) }), `FAIL content/blog/x.md faq-structure: line ${LINE(9)} "## Frequently asked questions" has no ### question under it`);
    has(run({ "blog/x.md": post(FRONTMATTER, BODY.replace("### Is this a question?", "### Is this a question?\n\nYes.\n\n#### A sub-heading")) }), '"#### A sub-heading" under the FAQ heading; questions are ###');
    has(run({ "blog/x.md": post(FRONTMATTER, BODY.replace("Yes, and this is its answer.\n", "")) }), `FAIL content/blog/x.md faq-structure: line ${LINE(11)} "### Is this a question?" has no answer paragraph`);
  });
  test("body images: no alt attribute, an empty or weak alt, a missing file, an external or misplaced one all fail", () => {
    has(run({ "blog/x.md": post(FRONTMATTER, BODY + '\n<img src="/images/blog/x/x-mid.webp">\n') }), `FAIL content/blog/x.md body-image: line ${APPENDED} image "/images/blog/x/x-mid.webp" has no alt attribute`);
    has(run({ "blog/x.md": post(FRONTMATTER, BODY.replace("![A blueprint of the deployment]", "![]")) }), `FAIL content/blog/x.md body-image: line ${LINE(7)} image "/images/blog/x/x-mid.webp" has an empty alt`);
    has(run({ "blog/x.md": post(FRONTMATTER, BODY.replace("![A blueprint of the deployment]", "![Supporting illustration for: A post]")) }), "which names the slot, not the picture");
    has(run({ "blog/x.md": post(FRONTMATTER, BODY.replace("x-mid.webp", "gone.webp")) }), `FAIL content/blog/x.md image-exists: line ${LINE(7)} "/images/blog/x/gone.webp" does not exist under public/`);
    has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\n![A chart](https://example.com/chart.png)\n") }), `FAIL content/blog/x.md body-image: line ${APPENDED} image "https://example.com/chart.png" is not self-hosted`);
    has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\n![A chart](/images/home/client.webp)\n") }), `FAIL content/blog/x.md body-image: line ${APPENDED} image "/images/home/client.webp" is outside public/images/blog/x/`);
  });
});

describe("redirect rules", () => {
  const redirects = (...entries) => ({ "redirects.yaml": entries.map(([from, to, more = ""]) => `- from: ${from}\n  to: ${to}\n${more}`).join("") });
  test("a redirect to a page, a published post, a fragment of one or an https:// URL, from a path nothing answers, passes", () => {
    assert.deepEqual(run(redirects(["/old-blog", "/blog"], ["/2019/x", "/blog-post/x"], ["/news", "/blog#latest"], ["/away", "https://nimbus.dev/x", "  permanent: false\n"])), []);
  });
  test("redirect-from: a path listed twice, or a live page's or published post's path, which the redirect would hide", () => {
    const lines = run(redirects(["/old", "/blog"], ["/old", "/blog"], ["/blog", "/blog-post/x"], ["/blog-post/x", "/blog"]));
    has(lines, 'FAIL content/redirects.yaml redirect-from: [1].from "/old" is listed already at [0]: one entry per path');
    has(lines, 'FAIL content/redirects.yaml redirect-from: [2].from "/blog" is a live page\'s or post\'s (content/pages/blog.yaml): the redirect would hide it');
    has(lines, 'FAIL content/redirects.yaml redirect-from: [3].from "/blog-post/x" is a live page\'s or post\'s (content/blog/x.md)');
  });
  test("a draft's URL answers nothing in production: a redirect may take it, and none may land on it", () => {
    const draft = { "blog/x.md": post(`${FRONTMATTER}\ndraft: true`) };
    const lines = run({ ...draft, ...redirects(["/blog-post/x", "/blog"], ["/old", "/blog-post/x"]) });
    lacks(lines.filter((line) => line.includes("[0].")), "redirect-from");
    has(lines, 'FAIL content/redirects.yaml redirect-chain: [1].to "/blog-post/x" is itself redirected ([0]): a chain — point it at "/blog" directly');
    has(run({ ...draft, ...redirects(["/old", "/blog-post/x"]) }), 'FAIL content/redirects.yaml redirect-to: [0].to "/blog-post/x" is no page, no published post and not the blog index: the redirect would land on a 404');
  });
  test("redirect-chain: a to that is another entry's from, and a loop, its own or through others", () => {
    has(run(redirects(["/a", "/b"], ["/b", "/blog"])), 'FAIL content/redirects.yaml redirect-chain: [0].to "/b" is itself redirected ([1]): a chain — point it at "/blog" directly');
    has(run(redirects(["/a", "/b"], ["/b", "/a"])), 'FAIL content/redirects.yaml redirect-chain: [0].to "/b" leads back to "/a" ([0] → [1] → [0]): a loop');
    has(run(redirects(["/a", "/a?x=1"])), 'FAIL content/redirects.yaml redirect-chain: [0].to "/a?x=1" leads back to "/a" ([0]): a loop');
  });
  test("redirect-to: a path no page and no post answers", () => {
    has(run(redirects(["/old", "/nowhere"])), 'FAIL content/redirects.yaml redirect-to: [0].to "/nowhere" is no page, no published post and not the blog index: the redirect would land on a 404 — point it at a page that exists, or at an https:// URL');
  });
  test("the schema: a from with a trailing slash or a pattern, a to that is neither a path nor an https:// URL, a permanent that is no boolean", () => {
    const lines = run(redirects(["/old/", "http://nimbus.dev"]));
    has(lines, "FAIL content/redirects.yaml schema: [0].from must be a path the site no longer answers: /words or /words/more, without a trailing slash, a query or a pattern");
    has(lines, "FAIL content/redirects.yaml schema: [0].to must be a path of the site");
    const more = run(redirects(["/old/:slug", "/blog", "  permanent: yes\n"]));
    has(more, "FAIL content/redirects.yaml schema: [0].from must be a path");
    has(more, "FAIL content/redirects.yaml schema: [0].permanent must be true or false");
  });
});

describe("filesystem rules", () => {
  test("a referenced image that does not exist fails, for every collection that carries one", () => {
    const lines = run({}, { images: [] });
    has(lines, 'FAIL content/blog/x.md image-exists: image "/images/blog/x/x-hero.webp" does not exist under public/');
    has(lines, 'FAIL content/pages/blog.yaml image-exists: seo.ogImage "/images/blog-og.jpg" does not exist');
    has(lines, 'FAIL content/reviews.yaml image-exists: [0].photo "/images/home/client.webp" does not exist');
    has(lines, 'FAIL content/use-cases.yaml image-exists: [0].icon "/images/use-cases/health.svg" does not exist');
    has(lines, 'FAIL content/authors.json image-exists: h-kamkar.image "/images/authors/h-kamkar.webp" does not exist');
  });
  test("a heavy image fails", () => has(run({}, { setup: (root) => publicFile(root, "images/blog/x/x-hero.webp", 300 * 1024) }), 'FAIL content/blog/x.md image-weight: image "/images/blog/x/x-hero.webp" is 300 KB (over 250 KB; node scripts/optimize-webp.mjs public/images/blog/x)'));
  test("orphans: a folder without a post, a file no post references; a draft's folder is not an orphan", () => {
    const lines = run({}, { setup: (root) => { publicFile(root, "images/blog/y/y-hero.webp"); publicFile(root, "images/blog/x/unused.webp"); } });
    has(lines, "WARN public/images/blog/y image-orphan: no post content/blog/y.md for this folder");
    has(lines, "WARN public/images/blog/x/unused.webp image-orphan: not referenced by any post");
    lacks(run({ "blog/x.md": post(FRONTMATTER + "\ndraft: true", BODY) }), "image-orphan");
  });
  test("stray files: a wrong extension, a folder, an unknown file next to the collections; known files are fine", () => {
    const lines = run({ "blog/notes.txt": "x", "blog/drafts/y.md": "x", "extra.yaml": "x: 1", "README.md": "# ok", "editorial/calendar.md": "| 2026-10-01 |", "_templates/page.yaml": "x", "blog/_template.md": "x" });
    has(lines, "WARN content/blog/notes.txt stray-file: is not a .md/.mdx file; the loader ignores it");
    has(lines, "WARN content/blog/drafts stray-file: is a folder; the loader reads only files");
    has(lines, "WARN content/extra.yaml stray-file: is not a collection file; nothing reads it");
    assert.equal(lines.filter((line) => line.includes("stray-file")).length, 3);
  });
});

describe("a site in several languages", () => {
  const GERMAN_SITE = { ...site, locales: [{ locale: "de", prefix: "de", ogLocale: "de_DE", tagline: "Was es tut.", description: "Notizen.", links: { home: "/de", blog: "/de/blog", contact: "/de#contact-form" }, nav: [], signIn: site.signIn, cta: site.cta, footer: site.footer }] };
  const locales = createLocales(GERMAN_SITE);
  const germanPage = (route, description = "Notizen zu privater KI unter eigener Kontrolle, für Gründer, die an regulierte Branchen verkaufen.") => CLEAN["pages/blog.yaml"].replace("path: /blog", `path: ${route}`).replace("Insights on private AI", "Einblicke in private KI").replace(/description: .*/, `description: ${description}`);
  const GERMAN = { "VOICE.md": VOICE_MD(VOICE_YAML), "VOICE.de.md": VOICE_MD(VOICE_YAML.replace("match: robust", "match: robuste")), "pages/de/blog.yaml": germanPage("/de/blog") };
  const german = (files = {}, options = {}) => run({ ...GERMAN, ...files }, { voice: null, site: GERMAN_SITE, locales, ...options });

  test("a language's translations are linted with every rule, and a clean one yields nothing", () => {
    assert.deepEqual(german(), []);
    has(german({ "pages/de/blog.yaml": germanPage("/de/blog", "Kurz.") }), "FAIL content/pages/de/blog.yaml seo-description: seo.description is 5 characters");
    withContent({ ...CLEAN, ...GERMAN }, (root) => {
      for (const rel of IMAGES) publicFile(root, rel);
      assert.ok(lint({ root, now: NOW, site: GERMAN_SITE, locales }).collections.some((row) => row.name === "pages.de" && row.source === "content/pages/de" && row.entries === 1));
    });
  });

  test("each language has its voice block, content/VOICE.<prefix>.md, and only its own", () => {
    const withoutVoice = Object.fromEntries(Object.entries(GERMAN).filter(([file]) => file !== "VOICE.de.md"));
    has(run(withoutVoice, { voice: null, site: GERMAN_SITE, locales }), "FAIL content/VOICE.de.md voice: does not exist: the voice rules of de, VOICE.md's block written for the language (docs/locales.md)");
    has(german({ "pages/de/blog.yaml": germanPage("/de/blog", "Eine robuste Lösung für private KI unter eigener Kontrolle, für Gründer in regulierten Branchen.") }), 'FAIL content/pages/de/blog.yaml voice-banned: seo.description "robuste" is banned');
    lacks(german({ "pages/de/blog.yaml": germanPage("/de/blog", "Ein robust gebautes System für private KI unter eigener Kontrolle, für Gründer in regulierten Branchen.") }), "voice-banned");
  });

  test("the alt-weak heuristic, which reads English, holds the default language alone", () => {
    const weak = JSON.stringify({ "h-kamkar": { name: "H. Kamkar", image: "/images/authors/h-kamkar.webp", imageAlt: "Image of H. Kamkar" } });
    lacks(german({ "authors.de.json": weak }), "alt-weak");
    has(german({ "authors.json": weak }), "FAIL content/authors.json alt-weak");
  });

  test("a post's FAQ heading is its language's: an empty FAQ under it fails, the default language's heading is just a heading there", () => {
    const withHeading = { ...GERMAN_SITE, locales: [{ ...GERMAN_SITE.locales[0], faqHeading: "Häufige Fragen" }] };
    const registries = { "authors.de.json": CLEAN["authors.json"], "categories.de.json": CLEAN["categories.json"] };
    const german = (body) => run({ ...GERMAN, ...registries, "blog/de/x.md": post(FRONTMATTER, body) }, { voice: null, site: withHeading, locales: createLocales(withHeading) });
    has(german(`${BODY}\n## Häufige Fragen\n`), 'FAIL content/blog/de/x.md faq-structure: line');
    has(german(`${BODY}\n## Häufige Fragen\n`), '"## Häufige Fragen" has no ### question under it');
    lacks(german(BODY.replace("## Frequently asked questions\n\n### Is this a question?\n\nYes, and this is its answer.\n", "## Frequently asked questions\n")), "faq-structure");
  });

  test("a page file out of place fails, as the engine would", () => {
    has(german({ "pages/de/blog.yaml": germanPage("/blog") }), 'FAIL content/pages/de/blog.yaml schema: seo.path "/blog" must be "/de/blog", the path of content/pages/blog.yaml under /de');
    has(german({ "pages/de/team.yaml": germanPage("/de/team") }), "FAIL content/pages/de/team.yaml schema: translates no page: content/pages/team.yaml does not exist");
  });

  test("the redirects see every language's routes", () => {
    has(german({ "redirects.yaml": "- from: /de/blog\n  to: /blog\n" }), 'FAIL content/redirects.yaml redirect-from: [0].from "/de/blog" is a live page\'s or post\'s (content/pages/de/blog.yaml)');
    assert.deepEqual(german({ "redirects.yaml": "- from: /de/insights\n  to: /de/blog\n" }), []);
  });

  test("stray files: a language site.locales does not declare is named so; a declared one's folder and files are the loader's", () => {
    const lines = german({ "pages/fr/blog.yaml": germanPage("/fr/blog"), "authors.fr.json": "{}", "VOICE.fr.md": "x", "authors.de.json": CLEAN["authors.json"] });
    has(lines, "WARN content/pages/fr stray-file: is a folder; the loader reads only files, and a language's translations, in a folder named its prefix, are site.locales' (de)");
    has(lines, "WARN content/authors.fr.json stray-file: is a translation into a language site.locales does not declare; nothing reads it (docs/locales.md)");
    has(lines, "WARN content/VOICE.fr.md stray-file: is a translation into a language site.locales does not declare");
    assert.equal(lines.filter((line) => line.includes("stray-file")).length, 3);
  });
});

describe("the starter's placeholders and the kit example's brand", () => {
  const nimbus = { ...site, name: "nimbus®", shortName: "nimbus" };
  const BLOG = CLEAN["pages/blog.yaml"];
  test("placeholder copy WARNs by file and field, and FAILs in a production build", () => {
    const files = { "pages/blog.yaml": BLOG.replace("    heading: Insights", '    heading: "(placeholder) What the blog is about."') };
    const warned = run(files, { site: nimbus });
    has(warned, "WARN content/pages/blog.yaml placeholder: sections[0].heading is placeholder copy: write the site's own (/editorial:new-page, or by hand)");
    assert.equal(warned.length, 1, warned.join("\n"));
    has(run(files, { site: nimbus, production: true }), "FAIL content/pages/blog.yaml placeholder: sections[0].heading is placeholder copy, which a production build never ships: write the site's own");
    has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\n(placeholder) A paragraph to come.\n") }, { site: nimbus }), `WARN content/blog/x.md placeholder: line ${APPENDED} is placeholder copy`);
  });
  test("a stand-in address on a reserved domain is a placeholder, in the content and the config by line; in the kit's own repository it is the example's, and only the marker counts", () => {
    const files = { "blog/x.md": post(`${FRONTMATTER}\nsource: https://notes.example/old`) };
    const config = (root) => rootFile(root, "src/config/site.ts", 'export const site = {\n  // a comment on the "(placeholder)" marker is none\n  url: "https://my-site.example",\n  tagline: "(placeholder) The line.",\n  signIn: { label: "Sign in", href: "https://app.my-site.test" },\n};\n');
    const lines = run(files, { site: nimbus, setup: config });
    has(lines, 'WARN content/blog/x.md placeholder: source "https://notes.example/old" is a stand-in on a domain reserved for examples: set the site\'s own (init --url and --email, or by hand)');
    has(lines, 'WARN src/config/site.ts placeholder: line 3 (url) "https://my-site.example" is a stand-in');
    has(lines, "WARN src/config/site.ts placeholder: line 4 (tagline) holds placeholder copy: write the site's own");
    has(lines, 'WARN src/config/site.ts placeholder: line 5 (signIn) "https://app.my-site.test" is a stand-in');
    assert.equal(lines.length, 4, lines.join("\n"));
    const kit = run(files, { site: nimbus, setup: (root) => { config(root); rootFile(root, "package.json", '{ "name": "agentic-cms" }'); } });
    assert.deepEqual(kit, ["WARN src/config/site.ts placeholder: line 4 (tagline) holds placeholder copy: write the site's own (/editorial:new-page, or by hand)"]);
  });
  test("the kit example's brand FAILs in a site at any time, by file and line or by a picture's name, and never in the kit's own repository", () => {
    const files = { "editorial/backlog.md": "# Backlog\n\n- **x**: a post by Acme\n", "_templates/author.json": '{ "acme-editorial": { "name": "The team" } }\n' };
    const setup = (root) => { publicFile(root, "images/authors/acme-editorial.webp"); rootFile(root, "public/images/brand/logo.svg", "<svg><text>Acme</text></svg>\n"); rootFile(root, "src/config/site.ts", 'export const site = { email: "hello@acme.example" };\n'); };
    const lines = run(files, { site: nimbus, setup });
    has(lines, `FAIL content/editorial/backlog.md example-brand: line 3 "Acme" is the kit example's brand, which a site never keeps: write the site's own, or delete what came from the example`);
    has(lines, `FAIL content/_templates/author.json example-brand: line 1 "acme-editorial" is the kit example's author`);
    has(lines, `FAIL public/images/authors/acme-editorial.webp example-brand: "acme-editorial" is the kit example's author, which a site never keeps: write the site's own (rename or delete the file)`);
    has(lines, `FAIL public/images/brand/logo.svg example-brand: line 1 "Acme" is the kit example's brand`);
    has(lines, `FAIL src/config/site.ts example-brand: line 1 "acme.example" is the kit example's domain`);
    assert.equal(lines.filter((line) => line.includes(" example-brand: ")).length, 5, lines.join("\n"));
    lacks(run(files, { site: nimbus, setup: (root) => { setup(root); rootFile(root, "package.json", '{ "name": "agentic-cms" }'); } }), "example-brand");
    lacks(run({ "editorial/backlog.md": "- **x**: ACME certificates, renewed\n" }, { site: nimbus }), "example-brand");
    const own = run(files, { site: { ...site, name: "Acme Labs", shortName: "Acme Labs" }, setup });
    assert.deepEqual(own.filter((line) => line.includes(" example-brand: ")).map((line) => line.split(" example-brand: ")[0]), ["FAIL public/images/authors/acme-editorial.webp", "FAIL content/_templates/author.json", "FAIL src/config/site.ts"], "a site named Acme keeps its name; the example's author and domain still fail");
  });
  test("the example's brand in a file the site's baseline holds passes while the file has no more than its count; past it each FAILs, saying so", () => {
    const files = { "editorial/backlog.md": "# Backlog\n\n- **x**: a post by Acme\n- **y**: and Acme again\n" };
    const baseline = (count) => (root) => rootFile(root, "src/config/components.json", JSON.stringify({ baseline: [{ file: "content/editorial/backlog.md", rule: "example-brand", count, reason: "" }, { file: "content/editorial/backlog.md", rule: "example-content", count: 9, reason: "" }] }));
    lacks(run(files, { site: nimbus, setup: baseline(2) }), "example-brand");
    const past = run(files, { site: nimbus, setup: baseline(1) }).filter((line) => line.includes(" example-brand: "));
    assert.equal(past.length, 2, past.join("\n"));
    assert.match(past[0], /^FAIL content\/editorial\/backlog\.md example-brand: line 3 "Acme" is the kit example's brand, .* \(2 in this file, and the baseline holds 1: it only shrinks\)$/);
  });
  test("the starter init lays out: every collection reads with no entry, and its only findings are its placeholders, which a production build fails on and which go with the copy", async () => {
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "starter-")), "nimbus-notes");
    try {
      scaffold(target, { kitRoot: REPO, version: "0.8.2", name: "Nimbus Notes", now: NOW, log: () => {} });
      const { site: own } = await import(pathToFileURL(path.join(target, "src/config/site.ts")).href);
      const { findings, collections } = lint({ root: target, site: own, now: NOW });
      assert.deepEqual(collections.map((c) => `${c.name}:${c.entries}`), ["authors:0", "categories:0", "posts:0", "reviews:0", "faqs:0", "useCases:0", "pages:2", "redirects:0"]);
      assert.deepEqual(findings.filter((f) => f.rule !== "placeholder").map(format), [], "nothing but the placeholders");
      assert.ok(findings.length > 40 && findings.every((f) => f.level === "WARN"), "each placeholder by field, a warning while the site is written");
      for (const file of ["content/pages/home.yaml", "content/pages/blog.yaml", "src/config/site.ts"]) assert.ok(findings.some((f) => f.file === file), `${file} has placeholders`);
      assert.ok(lint({ root: target, site: own, now: NOW, production: true }).findings.every((f) => f.level === "FAIL"), "and a failure in a production build");
      // the site writes its own: the marker goes with each string, an address of its own replaces each stand-in
      for (const file of ["content/pages/home.yaml", "content/pages/blog.yaml", "src/config/site.ts"]) {
        const full = path.join(target, file);
        fs.writeFileSync(full, fs.readFileSync(full, "utf8").replaceAll("(placeholder) ", "").replace(/([\w.-]+)\.example\b/g, "$1.dev"));
      }
      const replaced = await import(`${pathToFileURL(path.join(target, "src/config/site.ts")).href}?replaced`);
      assert.deepEqual(lint({ root: target, site: replaced.site, now: NOW, production: true }).findings.map(format), [], "clean once the copy is the site's");
    } finally {
      fs.rmSync(path.dirname(target), { recursive: true, force: true });
    }
  });
});
