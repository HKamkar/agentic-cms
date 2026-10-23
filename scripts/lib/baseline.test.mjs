import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { Linter } from "eslint";
import { baselineConfigs, baselineCounts, baselineGrowth, BASELINE_RULES, baselineText, checkBaseline, directiveCover, entryFindings, entryProblem, holdFindings, holdMessages, lintFindings, literalGlob, nextBaseline, PROCESSOR, topLevelValue, validBaseline, withBaseline } from "./baseline.mjs";
import { componentRules } from "./component-lint.mjs";

// The react plugin is the one eslint-config-next registers, as a site has it.
const require = createRequire(import.meta.url);
const react = createRequire(require.resolve("eslint-config-next"))("eslint-plugin-react");

const entry = (file, rule, count, reason = "") => ({ file, rule, count, reason });
const BASE = { files: ["**/*.{js,jsx,mjs,ts,tsx}"], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } };
const ROUTE = "src/app/[[...slug]]/page.tsx";
const PAGE = [
  "export default function Page() {",
  "  return (",
  "    <main>",
  "      <p>One here</p>",
  "      <p>Two here</p>",
  "      {/* eslint-disable-next-line agentic-cms/copy -- the legal line, word for word */}",
  "      <p>Three here</p>",
  "    </main>",
  "  );",
  "}",
  "",
].join("\n");

/** The engine rules' messages for one file under componentRules() with a baseline: "line rule message". */
function lint(code, baseline, { file = ROUTE, settings } = {}) {
  const configs = [BASE, ...componentRules({ motion: null, patterns: null, sections: [], baseline }), ...(settings ? [{ settings: { "agentic-cms": settings } }] : [])];
  return new Linter({ cwd: "/site" }).verify(code, configs, { filename: `/site/${file}` }).filter((m) => m.ruleId?.startsWith("agentic-cms/")).map((m) => `${m.line} ${m.ruleId} ${m.message}`);
}

test("an entry is a file, a rule a baseline holds, a count of 1 or more and a reason that is text; a preferred rule is never one", () => {
  assert.equal(entryProblem(entry("src/components/ui/Footer.tsx", "agentic-cms/email", 1)), null);
  assert.equal(entryProblem({ file: "content/blog/a.md", rule: "example-content", count: 2 }), null, "a reason left out is an empty one");
  assert.match(entryProblem(entry("src/x.tsx", "agentic-cms/motion", 1)), /preferred rule, which a baseline never holds/);
  for (const rule of ["no-restricted-syntax", "react/forbid-elements", "react/no-multi-comp", "no-restricted-imports"]) assert.equal(entryProblem(entry("src/components/home/Hero.tsx", rule, 3)), null, `${rule}, a composition rule`);
  assert.match(entryProblem(entry("src/x.tsx", "no-console", 1)), new RegExp(BASELINE_RULES.join(", ")));
  assert.match(entryProblem(entry("src/x.tsx", "agentic-cms/copy", 0)), /1 or more/);
  assert.match(entryProblem(entry("/abs/x.tsx", "agentic-cms/copy", 1)), /root-relative/);
  assert.match(entryProblem(entry("src/x.tsx", "agentic-cms/copy", 1, 3)), /reason is text/);
  assert.deepEqual(validBaseline([entry("a.tsx", "agentic-cms/copy", 2), entry("a.tsx", "agentic-cms/copy", 5), entry("b.tsx", "agentic-cms/motion", 1)]), [entry("a.tsx", "agentic-cms/copy", 2)], "each file and rule once, the first kept; one that does not read left out");
  assert.throws(() => checkBaseline([entry("a.tsx", "agentic-cms/copy", 0)]), /componentRules\(\): baseline\[0\]: .*1 or more/);
  assert.throws(() => checkBaseline({}), /baseline is a list/);
  assert.deepEqual(entryFindings([entry("a.tsx", "agentic-cms/copy", 1), entry("a.tsx", "agentic-cms/copy", 1), { rule: "rounds" }]).map((f) => `${f.file}: ${f.problem}`), ["a.tsx: agentic-cms/copy has two entries for this file", "baseline[2]: a baseline entry that does not read: its file is the root-relative path of the file the findings are in"]);
});

test("each file's counts reach its engine rules through ESLint's settings, a route folder's brackets escaped", () => {
  assert.equal(literalGlob(ROUTE), "src/app/\\[\\[...slug\\]\\]/page.tsx");
  assert.deepEqual(baselineConfigs([entry(ROUTE, "agentic-cms/copy", 2), entry(ROUTE, "agentic-cms/head", 1), entry("content/a.md", "example-brand", 1)]), [{ files: ["src/app/\\[\\[...slug\\]\\]/page.tsx"], settings: { "agentic-cms": { baseline: { "agentic-cms/copy": 2, "agentic-cms/head": 1 } } } }], "the site check's rules are none of ESLint's");
  const [held] = baselineConfigs([entry(SECTION, "agentic-cms/copy", 1), entry(SECTION, "react/forbid-elements", 2), entry(SECTION, "no-restricted-syntax", 3)]);
  assert.deepEqual(held.settings, { "agentic-cms": { baseline: { "agentic-cms/copy": 1, "react/forbid-elements": 2, "no-restricted-syntax": 3 } } }, "every count in the settings, which the guard reads");
  assert.deepEqual([held.processor.meta, held.processor.counts], [{ name: PROCESSOR, version: "react/forbid-elements=2,no-restricted-syntax=3" }, { "react/forbid-elements": 2, "no-restricted-syntax": 3 }], "the composition rules' in a processor, named by its counts for ESLint's cache");
});

test("an engine rule holds a baselined file: quiet at its count, every finding and one line past it, one line asking to shrink under it", () => {
  assert.equal(lint(PAGE, []).length, 2, "without a baseline, the two lines of copy fail (the third is turned off with its reason)");
  assert.deepEqual(lint(PAGE, [entry(ROUTE, "agentic-cms/copy", 2)]), [], "at the count: quiet");
  const past = lint(PAGE, [entry(ROUTE, "agentic-cms/copy", 1)]);
  assert.equal(past.length, 3, past.join("\n"));
  assert.match(past[0], /^1 agentic-cms\/copy 2 of this rule here, and the baseline \(src\/config\/components\.json\) holds 1: the baseline only shrinks/);
  assert.match(past[1], /^4 agentic-cms\/copy No copy in a route/);
  assert.deepEqual(lint(PAGE, [entry(ROUTE, "agentic-cms/copy", 3)]).map((m) => m.replace(/ — .*/, "")), ["1 agentic-cms/copy The baseline (src/config/components.json) holds 3 of this rule here and 2 are left: agentic-cms check-site --baseline shrinks the entry to what is left (it never grows one), in this pull request"]);
  assert.equal(lint(PAGE, [entry(ROUTE, "agentic-cms/copy", 2)], { settings: { ignoreBaseline: true } }).length, 2, "--baseline's run sees every finding");
  assert.equal(lint(PAGE, [entry("src/app/other/page.tsx", "agentic-cms/copy", 2)]).length, 2, "another file's entry holds nothing here");
  assert.equal(lint(PAGE, [entry(ROUTE, "agentic-cms/head", 2)]).filter((m) => / agentic-cms\/copy /.test(m)).length, 2, "another rule's entry holds nothing of this one");
});

const SECTION = "src/components/home/Hero.tsx";
/** A registered section from before the rules: a raw link and heading, a style, an arbitrary value, a second component, and one raw element kept with ESLint's own directive. */
const HERO = [
  "function Badge({ label }) {",
  '  return <span className="p-[3px]">{label}</span>;',
  "}",
  "export function Hero({ heading, href, label }) {",
  "  return (",
  '    <div style={{ gap: 12 }}>',
  "      <h2>{heading}</h2>",
  "      <a href={href}><Badge label={label} /></a>",
  "      {/* eslint-disable-next-line react/forbid-elements -- the legacy anchor, until the CTA primitive takes an icon */}",
  "      <a href={href}>{label}</a>",
  "    </div>",
  "  );",
  "}",
  "",
].join("\n");
/** The composition errors of a section under componentRules() with a baseline, by rule: "line rule message". */
function composition(code, baseline) {
  const configs = [{ ...BASE, plugins: { react }, settings: { react: { version: "19" } } }, ...componentRules({ motion: null, patterns: null, sections: ["home"], baseline })];
  return new Linter({ cwd: "/site" }).verify(code, configs, { filename: `/site/${SECTION}` }).filter((m) => m.severity === 2 && !m.ruleId?.startsWith("agentic-cms/")).map((m) => `${m.line} ${m.ruleId} ${m.message}`);
}
const COUNTS = { "no-restricted-syntax": 2, "react/forbid-elements": 2, "react/no-multi-comp": 1 };
const asEntries = (counts, file = SECTION) => Object.entries(counts).map(([rule, count]) => entry(file, rule, count));

test("the composition rules hold a baselined section as the engines' do: quiet at its counts, every finding and one line past one, one line asking to shrink under one; new files meet the full rules", () => {
  const all = composition(HERO, []);
  assert.deepEqual(Object.fromEntries(Object.keys(COUNTS).map((rule) => [rule, all.filter((m) => m.split(" ")[1] === rule).length])), COUNTS, all.join("\n"));
  assert.deepEqual(composition(HERO, asEntries(COUNTS)), [], "at the counts: quiet (the anchor ESLint's own directive turns off is no finding)");
  const past = composition(HERO, asEntries({ ...COUNTS, "react/forbid-elements": 1 }));
  assert.deepEqual(past.filter((m) => / react\/forbid-elements /.test(m)).map((m) => m.replace(/(forbid-elements) (\d+ of this rule here|<\w+> is forbidden).*/, "$1 $2")), ["1 react/forbid-elements 2 of this rule here", "7 react/forbid-elements <h2> is forbidden", "8 react/forbid-elements <a> is forbidden"], "the count's line first, then every finding but the one ESLint's directive turns off");
  assert.equal(past.length, 3, "the other rules stay held");
  assert.deepEqual(composition(HERO, asEntries({ ...COUNTS, "react/no-multi-comp": 2 })).map((m) => m.replace(/ — .*/, "")), ["1 react/no-multi-comp The baseline (src/config/components.json) holds 2 of this rule here and 1 is left: agentic-cms check-site --baseline shrinks the entry to what is left (it never grows one), in this pull request"]);
  assert.equal(composition(HERO, asEntries(COUNTS, "src/components/home/Other.tsx")).length, 5, "another file's entries hold nothing here");
  assert.deepEqual(holdMessages([{ ruleId: "no-restricted-syntax", severity: 1, line: 3, column: 1, message: "a warning" }], { "no-restricted-syntax": 1 }).map((m) => m.message.slice(0, 40)), ["The baseline (src/config/components.json", "a warning"], "a warning is never held, nor counted");
});

test("ESLint's own directives count as ESLint counts them: a line, the next line, a block until its enable, the rules each names", () => {
  const code = [
    "const a = 1; // eslint-disable-line agentic-cms/copy",
    "// eslint-disable-next-line no-console, agentic-cms/copy -- why",
    "const b = 2;",
    "/* eslint-disable agentic-cms/head */",
    "const c = 3;",
    "/* eslint-disable */",
    "const d = 4;",
    "/* eslint-enable agentic-cms/copy */",
    "const e = 5;",
    "// eslint-disable agentic-cms/copy",
    "const f = 6;",
  ].join("\n");
  const linter = new Linter();
  let covered;
  linter.verify(code, [{ plugins: { probe: { rules: { probe: { create: (context) => ({ Program() { covered = directiveCover(context.sourceCode, "agentic-cms/copy"); } }) } } } }, rules: { "probe/probe": "error" } }]);
  const at = (line) => covered({ line, column: 6 });
  assert.deepEqual([1, 3, 5, 7, 9, 11].map(at), [true, true, false, true, false, false], "a line comment's eslint-disable is no directive, as in ESLint");
});

test("the site check's rules are held by their file's count: under it held, past it each kept saying so, an entry holding more than its file a finding", () => {
  const leftover = (file, rule = "example-content") => ({ check: "leftovers", rule, file, problem: "one of the example's posts", fix: "replace it" });
  const findings = [leftover("content/blog/a.md"), leftover("content/x.md:3", "example-brand"), leftover("content/x.md:9", "example-brand"), { check: "rounds", file: "src/app/promo-demo", problem: "made by hand", fix: "demo new" }, { check: "scripts", file: "package.json", problem: "no lint", fix: "add it" }];
  const { findings: out, held } = holdFindings(findings, [entry("content/blog/a.md", "example-content", 1), entry("content/x.md", "example-brand", 1), entry("src/app/promo-demo", "rounds", 2), entry("src/gone.tsx", "agentic-cms/copy", 1)], (file) => file !== "src/gone.tsx");
  assert.deepEqual(held.map((f) => f.file), ["content/blog/a.md", "src/app/promo-demo"]);
  assert.deepEqual(out.map((f) => `${f.check} ${f.file}: ${f.problem}`), [
    "leftovers content/x.md:3: one of the example's posts (2 in this file, and the baseline holds 1: it only shrinks, so the file takes no new one)",
    "leftovers content/x.md:9: one of the example's posts (2 in this file, and the baseline holds 1: it only shrinks, so the file takes no new one)",
    "scripts package.json: no lint",
    "baseline src/app/promo-demo: the baseline holds 2 of rounds here and 1 is left: an entry that holds more than its file has lets a new one in unseen",
    "baseline src/gone.tsx: the baseline holds 1 of agentic-cms/copy here and 0 are left (or the file is gone): an entry that holds more than its file has lets a new one in unseen",
  ]);
  assert.equal(findings[1].problem, "one of the example's posts", "the findings it was given are left as they were");
});

test("against the merge base the list only shrinks: the first one is listed whole, then an entry added or raised is growth", () => {
  const now = { baseline: [entry("a.tsx", "agentic-cms/copy", 2), entry("b.tsx", "agentic-cms/head", 1)] };
  assert.deepEqual(baselineGrowth({ motion: null }, now), { first: true, added: now.baseline, grown: [] }, "a base with no list: the pull request that takes 0.8.2");
  assert.deepEqual(baselineGrowth(null, { baseline: [] }), { first: false, added: [], grown: [] });
  assert.deepEqual(baselineGrowth({ baseline: [entry("a.tsx", "agentic-cms/copy", 3), entry("b.tsx", "agentic-cms/head", 1)] }, now).grown, [], "shrunk is fine");
  assert.deepEqual(baselineGrowth({ baseline: [entry("a.tsx", "agentic-cms/copy", 1)] }, now).grown.map(({ file, was, count }) => `${file} ${was}→${count}`), ["a.tsx 1→2", "b.tsx 0→1"]);
  assert.deepEqual(baselineGrowth({ baseline: [] }, now).grown.length, 2, "an empty list at the base, as a new site's: nothing goes in");
});

test("--baseline's list: the whole of it the first time, then only ever shrunk, growth refused and each reason kept", () => {
  const found = [{ file: "b.tsx", rule: "agentic-cms/copy", count: 2 }, { file: "a.md", rule: "example-content", count: 1 }];
  const written = [entry("a.md", "example-content", 1), entry("b.tsx", "agentic-cms/copy", 2)];
  assert.deepEqual(nextBaseline(undefined, found), { baseline: written, first: true, rerun: false, added: written, raised: [], shrunk: [], removed: [], refused: [] });
  const current = [entry("a.md", "example-content", 1, "the launch post, until the new one is written"), entry("b.tsx", "agentic-cms/copy", 3), entry("c.tsx", "agentic-cms/email", 1)];
  const shrunk = nextBaseline(current, found);
  assert.deepEqual(shrunk.baseline, [entry("a.md", "example-content", 1, "the launch post, until the new one is written"), entry("b.tsx", "agentic-cms/copy", 2)]);
  assert.deepEqual([shrunk.shrunk, shrunk.removed, shrunk.refused], [[{ ...entry("b.tsx", "agentic-cms/copy", 3), to: 2 }], [entry("c.tsx", "agentic-cms/email", 1)], []]);
  const grown = nextBaseline([entry("b.tsx", "agentic-cms/copy", 1)], [...found, { file: "d.tsx", rule: "agentic-cms/head", count: 1 }]);
  assert.deepEqual(grown.baseline, [entry("b.tsx", "agentic-cms/copy", 1)], "the entry keeps its count; nothing new goes in");
  assert.deepEqual(grown.refused.map(({ file, count, found: n }) => `${file} ${count}→${n}`), ["b.tsx 1→2", "a.md 0→1", "d.tsx 0→1"]);
  assert.deepEqual(nextBaseline([], found).baseline, [], "a list that is there, even empty, takes nothing new");
});

test("--baseline's list on a first run over the pull request's own: the whole of it again, each reason kept, and what changed named", () => {
  const current = [entry("a.md", "example-content", 1, "the launch post, until the new one is written"), entry("b.tsx", "agentic-cms/copy", 1, "the hero, until its copy moves to the page"), entry("c.tsx", "agentic-cms/email", 2, "the footer"), entry("e.tsx", "agentic-cms/head", 1, "the layout")];
  const found = [{ file: "a.md", rule: "example-content", count: 1 }, { file: "b.tsx", rule: "agentic-cms/copy", count: 3 }, { file: "c.tsx", rule: "agentic-cms/email", count: 1 }, { file: "d.tsx", rule: "react/forbid-elements", count: 2 }];
  const again = nextBaseline(current, found, { first: true });
  assert.deepEqual(again.baseline, [entry("a.md", "example-content", 1, "the launch post, until the new one is written"), entry("b.tsx", "agentic-cms/copy", 3, "the hero, until its copy moves to the page"), entry("c.tsx", "agentic-cms/email", 1, "the footer"), entry("d.tsx", "react/forbid-elements", 2)]);
  assert.deepEqual([again.first, again.rerun, again.refused], [true, true, []], "nothing refused: the merge base has no list");
  assert.deepEqual(again.added, [entry("d.tsx", "react/forbid-elements", 2)]);
  assert.deepEqual(again.raised, [{ ...entry("b.tsx", "agentic-cms/copy", 1, "the hero, until its copy moves to the page"), to: 3 }]);
  assert.deepEqual(again.shrunk, [{ ...entry("c.tsx", "agentic-cms/email", 2, "the footer"), to: 1 }]);
  assert.deepEqual(again.removed, [entry("e.tsx", "agentic-cms/head", 1, "the layout")]);
  assert.equal(nextBaseline([], found, { first: true }).rerun, false, "an empty list copied with the config is the first list, not a rerun");
});

test("the list is written into the config's text: the value replaced where the key is, else added last with its comment, every other byte kept", () => {
  const config = '{\n  "$comment": "a, \\"quoted\\" [note]",\n  "sections": ["home"],\n  "inherited": []\n}\n';
  const first = withBaseline(config, [entry("src/app/[[...slug]]/page.tsx", "agentic-cms/copy", 2)]);
  assert.ok(first.startsWith('{\n  "$comment": "a, \\"quoted\\" [note]",\n  "sections": ["home"],\n  "inherited": [],\n  "$baseline": "What this site already held'));
  assert.ok(first.endsWith('  "baseline": [\n    { "file": "src/app/[[...slug]]/page.tsx", "rule": "agentic-cms/copy", "count": 2, "reason": "" }\n  ]\n}\n'), first);
  const again = withBaseline(first, []);
  assert.equal(again, first.replace(/"baseline": \[[^]*\]\n\}/, '"baseline": []\n}'));
  assert.deepEqual(topLevelValue('{ "a": { "baseline": 1 }, "baseline": [ "]" ] }', "baseline"), { start: 38, end: 45 }, "a nested key and a bracket in a string are not the list");
  assert.equal(withBaseline("{}\n", []).replace(/"\$baseline": "[^"]*"/, '"$baseline": "…"'), '{\n  "$baseline": "…",\n  "baseline": []\n}\n');
  assert.equal(baselineText([entry("a", "rounds", 1, 'say "why"')]), '[\n    { "file": "a", "rule": "rounds", "count": 1, "reason": "say \\"why\\"" }\n  ]');
});

test("the content lint reads one rule's counts from a site's config, none where it has no config or no list", () => {
  const fs = (text) => ({ readFileSync: () => { if (text === null) throw new Error("ENOENT"); return text; } });
  assert.deepEqual(baselineCounts("/site", "example-brand", fs(JSON.stringify({ baseline: [entry("content/a.md", "example-brand", 2), entry("content/a.md", "example-content", 1)] }))), new Map([["content/a.md", 2]]));
  assert.deepEqual(baselineCounts("/site", "example-brand", fs(null)), new Map());
  assert.deepEqual(baselineCounts("/site", "example-brand", fs("{}")), new Map());
});

test("the findings --baseline counts are read from the site's ESLint with the baseline ignored: the engines' and the composition's errors alone, each by file and line", async () => {
  let options;
  class ESLint {
    constructor(given) { options = given; }
    async lintFiles() { return [{ filePath: "/site/src/a.tsx", messages: [{ ruleId: "agentic-cms/copy", severity: 2, line: 3, message: "No copy" }, { ruleId: "react/forbid-elements", severity: 2, line: 5, message: "Links are TextLink" }, { ruleId: "no-restricted-syntax", severity: 1, line: 6, message: "a site's own warning" }, { ruleId: "agentic-cms/motion", severity: 1, line: 4, message: "a warning" }, { ruleId: "no-console", severity: 2, line: 7, message: "not the kit's" }, { ruleId: null, severity: 2, line: 1, message: "Parsing error" }] }]; }
  }
  assert.deepEqual(await lintFindings({ root: "/site", ESLint }), [{ check: "agentic-cms/copy", rule: "agentic-cms/copy", file: "src/a.tsx:3", problem: "No copy" }, { check: "react/forbid-elements", rule: "react/forbid-elements", file: "src/a.tsx:5", problem: "Links are TextLink" }]);
  assert.deepEqual(options.overrideConfig, [{ settings: { "agentic-cms": { ignoreBaseline: true } } }]);
  await lintFindings({ root: "/site", ESLint, baseline: [entry(ROUTE, "agentic-cms/copy", 1), entry(SECTION, "react/forbid-elements", 2)] });
  assert.deepEqual(options.overrideConfig[1].files, [SECTION], "a file held by a processor is linted without it");
  const [unheld] = [options.overrideConfig[1].processor];
  assert.deepEqual(unheld.postprocess([[{ ruleId: "react/forbid-elements", severity: 2, line: 5, column: 1, message: "Links" }]]).length, 1);
  assert.equal(composition(HERO, asEntries(COUNTS)).length, 0);
  const configs = [{ ...BASE, plugins: { react }, settings: { react: { version: "19" } } }, ...componentRules({ motion: null, patterns: null, sections: ["home"], baseline: asEntries(COUNTS) }), ...options.overrideConfig];
  assert.equal(new Linter({ cwd: "/site" }).verify(HERO, configs, { filename: `/site/${SECTION}` }).filter((m) => m.severity === 2 && !m.ruleId?.startsWith("agentic-cms/")).length, 5, "with its override, every finding again");
});
