// One negative case per lint rule, a clean tree that yields nothing, and the
// real tree, which must never FAIL (that is what keeps `pnpm build` green).
// Trees are scratch directories from the engine's own test helpers; the
// public/ images a case needs are written under the same root before the
// lint runs. Run with `pnpm test` (the TypeScript engine loads through
// scripts/lib/load-ts.mjs).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { postTree, withContent } from "../src/lib/content/test-helpers.ts";
import { site } from "../src/config/site.ts";
import { format, lint, readVoice } from "./lib/content-lint.mjs";

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
  models: { names: ["Llama"], instead: "open-weight models" },
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
/** Runs the lint on CLEAN with `files` overriding, `setup(root)` adding to public/, and returns the formatted lines. */
const run = (files = {}, { setup, voice = VOICE, images = IMAGES } = {}) => // voice: null reads content/VOICE.md
  withContent({ ...CLEAN, ...files }, (root) => {
    for (const rel of images) publicFile(root, rel);
    setup?.(root);
    return lint({ root, voice: voice ?? undefined, now: NOW }).findings.map(format);
  });
const has = (lines, expected) => assert.ok(lines.some((line) => line.includes(expected)), `expected a line containing:\n  ${expected}\nin:\n  ${lines.join("\n  ") || "(nothing)"}`);
const lacks = (lines, rule) => assert.deepEqual(lines.filter((line) => line.includes(` ${rule}: `)), [], `no ${rule} line expected`);

describe("the clean tree", () => {
  test("yields nothing", () => assert.deepEqual(run(), []));
  test("the real content tree never fails the build", () => {
    const { findings, collections } = lint({ root: REPO, now: NOW });
    assert.equal(collections.length, 7);
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
      assert.deepEqual(collections.map((c) => `${c.name}:${c.entries}`), ["authors:1", "categories:2", "posts:0", "reviews:1", "faqs:1", "useCases:1", "pages:1"]);
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
    has(run({ "pages/blog.yaml": CLEAN["pages/blog.yaml"].replace("  type: Blog", "  type: Blog").replace("description: Notes on running private AI under your own control, for founders selling into regulated industries.", "description: Private AI that is GDPR compliant, for founders selling into regulated industries and their teams.") }), 'WARN content/pages/blog.yaml voice-claim: seo.description "compliant" near "GDPR"');
  });
  test("a model name fails", () => has(run({ "blog/x.md": post(FRONTMATTER, BODY + "\nWe run Llama.\n") }), `FAIL content/blog/x.md voice-model: line ${APPENDED} names the model "Llama"; write "open-weight models"`));
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
