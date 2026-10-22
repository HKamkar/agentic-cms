// The baseline: what a site already held when it took the kit's rules —
// its engine bypasses, its sections' and patterns' composition, the kit
// example's leftovers — kept in src/config/components.json (`baseline`) so
// its CI stays green while each entry is fixed, one pull request at a time,
// and new code meets the full rules. The list only shrinks
// (docs/roadmap-0.8.2.md D3 (b), job 7); `agentic-cms check-site --baseline`
// writes it. An entry is { file, rule, count, reason }: the file,
// root-relative; the rule, an engine's ESLint rule (agentic-cms/copy, head,
// forms, tags, email), a composition rule componentRules() sets on a
// section, a pattern or a layer's imports (no-restricted-syntax,
// react/forbid-elements, react/no-multi-comp, no-restricted-imports) or one
// of the site check's (rounds; example-brand and example-content, its
// leftovers pass's, the first of which the content lint reads too); how many
// findings of it the file holds; and the owner's reason it is still there,
// "" until they give one. Who holds what:
//   - the engines' rules hold their own (heldByBaseline(), through the
//     settings componentRules({ baseline }) gives each file): quiet while the
//     file has at most `count` (a line ESLint's own inline disable turns
//     off is left out, as ESLint leaves it out), every finding and one line
//     on the count when it has more, one line asking for the entry to shrink
//     when it has fewer;
//   - the composition rules, ESLint's and the react plugin's, read no
//     setting: a processor on the file holds them the same way, once ESLint
//     has run them and its inline directives (baselineProcessor());
//   - the site check holds its rules the same way (holdFindings()), fails an
//     entry that does not read, and, against the merge base, one added or
//     raised (baselineGrowth());
//   - nothing holds a preferred rule: its warning stays until it gets its
//     reason or is replaced.
import nodeFs from "node:fs";
import path from "node:path";
import { PLUGIN, REQUIRED } from "./engine-rules.mjs";

/** The guard's config, where the list lives (check-components' CONFIG_FILE, which imports this module through the preset). */
const CONFIG_FILE = "src/config/components.json";
/** The composition rules a baseline holds: what componentRules() sets on a section and a pattern (one component a file, no raw element, no style, arbitrary value, visual or motion class) and on each layer's imports. */
export const COMPOSITION_RULES = ["no-restricted-syntax", "react/forbid-elements", "react/no-multi-comp", "no-restricted-imports"];
/** The rules ESLint holds a baseline's counts for: the engines' and the composition's. */
export const ESLINT_RULES = [...REQUIRED, ...COMPOSITION_RULES];
/** The site check's rules a baseline holds: a round made by hand, and the example's leftovers. */
export const SITE_RULES = ["rounds", "example-brand", "example-content"];
/** Every rule an entry may name. */
export const BASELINE_RULES = [...ESLINT_RULES, ...SITE_RULES];
/** How an entry moves off the list, said once for every message. */
export const SHRINK = "agentic-cms check-site --baseline shrinks the entry to what is left (it never grows one)";
/** The comment `--baseline` writes beside the list in a config that has none. */
export const COMMENT = "What this site already held when it took the kit's rules (its engine bypasses, its sections' and patterns' composition, the kit example's leftovers), as agentic-cms check-site --baseline wrote it: each entry the file, the rule, how many findings of it the file holds, and the owner's reason it is still here. ESLint and the site check stay quiet on them while the count holds, and the list only shrinks: an entry leaves, or its count falls, as its findings are fixed, one pull request at a time (docs/migrating-to-0.8.2.md). New code meets the full rules. A site from init 0.8.2 or later starts with none and takes none.";

const key = ({ file, rule }) => `${rule}\0${file}`;
const isMap = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** What is wrong with one entry, or null: a file, a rule a baseline holds, a count of 1 or more, a reason that is text. */
export function entryProblem(entry) {
  if (!isMap(entry)) return 'an entry is { "file", "rule", "count", "reason" }';
  const { file, rule, count, reason = "" } = entry;
  if (typeof file !== "string" || !file.trim() || path.isAbsolute(file)) return "its file is the root-relative path of the file the findings are in";
  if (typeof rule === "string" && rule.startsWith(`${PLUGIN}/`) && !REQUIRED.includes(rule)) return `${rule} is a preferred rule, which a baseline never holds: its warning stays until it gets its reason (an allow entry) or is replaced`;
  if (!BASELINE_RULES.includes(rule)) return `its rule is one of ${BASELINE_RULES.join(", ")}`;
  if (!Number.isInteger(count) || count < 1) return "its count is how many findings of the rule the file holds, 1 or more";
  if (typeof reason !== "string") return "its reason is text: why the entry is still here (\"\" until the owner says)";
  return null;
}

/** The entries that read, each (file, rule) once: what the rules hold; the others are the site check's findings. */
export const validBaseline = (baseline) => (Array.isArray(baseline) ? baseline.filter((entry, at) => !entryProblem(entry) && baseline.findIndex((other) => !entryProblem(other) && key(other) === key(entry)) === at) : []);

/** componentRules()'s check of its `baseline` option: a list, each entry readable. Throws a TypeError naming the entry. */
export function checkBaseline(baseline) {
  if (!Array.isArray(baseline)) throw new TypeError('componentRules(): baseline is a list of { file, rule, count, reason } — src/config/components.json\'s, which agentic-cms check-site --baseline writes.');
  baseline.forEach((entry, at) => { const problem = entryProblem(entry); if (problem) throw new TypeError(`componentRules(): baseline[${at}]: ${problem}.`); });
}

/** A path as a glob that matches it alone: a route folder's brackets and parentheses escaped. */
export const literalGlob = (file) => file.replace(/[\\*?[\]{}()!+@]/g, "\\$&");

/** Each file's counts of the rules ESLint holds, file → { rule: count }. */
export function eslintCounts(baseline) {
  const counts = new Map();
  for (const { file, rule, count } of validBaseline(baseline).filter((entry) => ESLINT_RULES.includes(entry.rule))) counts.set(file, { ...counts.get(file), [rule]: count });
  return counts;
}

/** The composition rules' share of a file's counts. */
export const compositionCounts = (rules) => Object.fromEntries(Object.entries(rules).filter(([rule]) => COMPOSITION_RULES.includes(rule)));

/**
 * The flat configs that tell each baselined file its counts: every rule's in
 * settings["agentic-cms"].baseline = { rule: count }, which the engines'
 * rules read (and the guard checks), and the composition rules' in the
 * processor that holds them. A file the baseline holds a composition count
 * for takes this processor in place of any other a block before it set.
 */
export function baselineConfigs(baseline) {
  return [...eslintCounts(baseline)].map(([file, rules]) => {
    const composition = compositionCounts(rules);
    return { files: [literalGlob(file)], settings: { [PLUGIN]: { baseline: rules } }, ...(Object.keys(composition).length ? { processor: baselineProcessor(composition) } : {}) };
  });
}

const DIRECTIVE = /^\s*(eslint-disable-next-line|eslint-disable-line|eslint-disable|eslint-enable)(?:\s+([^]*?))?\s*$/;

/**
 * Where ESLint's own inline directives turn a rule off in a file, as ESLint
 * reads them: (position) → boolean. A `-line` directive covers its line, a
 * `-next-line` the line after the comment, and a block `eslint-disable`
 * everything after it until an `eslint-enable` of that rule (a line comment
 * is neither); a directive with no rules covers every rule.
 */
export function directiveCover(sourceCode, ruleId) {
  const lines = new Set();
  const blocks = [];
  for (const comment of sourceCode.getAllComments()) {
    const match = comment.value.split(/\s-{2,}\s/)[0].match(DIRECTIVE);
    if (!match) continue;
    const rules = (match[2] ?? "").split(",").map((rule) => rule.trim()).filter(Boolean);
    if (rules.length && !rules.includes(ruleId)) continue;
    if (match[1] === "eslint-disable-line") lines.add(comment.loc.start.line);
    else if (match[1] === "eslint-disable-next-line") lines.add(comment.loc.end.line + 1);
    else if (comment.type === "Block") blocks.push({ at: comment.loc.start, off: match[1] === "eslint-disable" });
  }
  const upTo = (a, b) => a.line < b.line || (a.line === b.line && a.column <= b.column);
  return (at) => lines.has(at.line) || blocks.filter((block) => upTo(block.at, at)).at(-1)?.off === true;
}

const fewer = (n) => `${n} ${n === 1 ? "is" : "are"} left`;

/** Where a report points: its loc's start, or its node's. */
const startOf = (descriptor) => descriptor.loc?.start ?? (descriptor.loc?.line ? descriptor.loc : descriptor.node.loc.start);

/** The line a baselined file's rule ends with when fewer than its count are left. */
const shrinkMessage = (held, left) => `The baseline (${CONFIG_FILE}) holds ${held} of this rule here and ${fewer(left)}: ${SHRINK}, in this pull request — an entry that holds more than its file has would let a new one in unseen.`;
/** The line it ends with when more are there, after every finding. */
const pastMessage = (found, held) => `${found} of this rule here, and the baseline (${CONFIG_FILE}) holds ${held}: the baseline only shrinks, so the file takes no new one. Each of these is fixed as its message says; at the count or under it, the file passes again.`;

/** What a baselined file's rule says at the end: nothing when the count holds, a line asking to shrink when fewer are left, every finding and a line on the count when more. */
function settle(context, held, pending) {
  const top = { line: 1, column: 0 };
  if (pending.length === held) return;
  if (pending.length < held) {
    context.report({ loc: top, message: shrinkMessage(held, pending.length) });
    return;
  }
  for (const descriptor of pending) context.report(descriptor);
  context.report({ loc: top, message: pastMessage(pending.length, held) });
}

/**
 * An engine rule that honours the baseline: in a file whose settings carry
 * a count for it, its reports wait until the file is read, then settle()
 * says what the count asks. A report on a line an inline directive turns off
 * goes straight to ESLint, which drops it. `settings["agentic-cms"]
 * .ignoreBaseline` (what --baseline lints with) reports everything.
 */
export function heldByBaseline(ruleId, rule) {
  return {
    ...rule,
    create(context) {
      const own = context.settings?.[PLUGIN] ?? {};
      const held = own.baseline?.[ruleId];
      if (!held || own.ignoreBaseline) return rule.create(context);
      const covered = directiveCover(context.sourceCode, ruleId);
      const pending = [];
      const report = (descriptor) => (covered(startOf(descriptor)) ? context.report(descriptor) : pending.push(descriptor));
      const listeners = rule.create(Object.create(context, { report: { value: report } }));
      const exit = listeners["Program:exit"];
      return { ...listeners, "Program:exit"(node) { exit?.(node); settle(context, held, pending); } };
    },
  };
}

/** The processor's name, which the guard looks for on a file the baseline holds a composition count for. */
export const PROCESSOR = `${PLUGIN}/baseline`;

/**
 * A file's messages with its composition counts ({ rule: count }) held, as
 * settle() holds an engine rule's: a rule's errors that no inline directive
 * turned off (ESLint marks those with `suppressions`, and they are left as
 * they are) drop out while there are at most its count, with a line asking to
 * shrink when there are fewer; past it, every one stays and a line on the
 * count comes first. The lines sit at the file's top, sorted as ESLint sorts.
 */
export function holdMessages(messages, counts) {
  const top = { line: 1, column: 1 };
  const dropped = new Set();
  const lines = [];
  for (const [rule, held] of Object.entries(counts)) {
    const live = messages.filter((message) => message.ruleId === rule && message.severity === 2 && !message.suppressions?.length);
    if (live.length > held) { lines.push({ ruleId: rule, severity: 2, message: pastMessage(live.length, held), ...top }); continue; }
    for (const message of live) dropped.add(message);
    if (live.length < held) lines.push({ ruleId: rule, severity: 2, message: shrinkMessage(held, live.length), ...top });
  }
  return [...lines, ...messages.filter((message) => !dropped.has(message))].sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * The processor that holds a file's composition counts: the file's text
 * as it is, then its messages through holdMessages(). Its meta names the
 * counts, so ESLint's cache tells one file's apart from another's; `counts`
 * is there for the guard to read.
 */
export function baselineProcessor(counts) {
  return {
    meta: { name: PROCESSOR, version: Object.entries(counts).map(([rule, count]) => `${rule}=${count}`).join(",") },
    counts,
    supportsAutofix: true,
    preprocess: (text) => [text],
    postprocess: (lists) => holdMessages(lists.flat(), counts),
  };
}

/** What `--baseline` lints a held file with in its processor's place: the messages as ESLint made them. */
const UNHELD = { meta: { name: `${PLUGIN}/unheld`, version: "1" }, supportsAutofix: true, preprocess: (text) => [text], postprocess: (lists) => lists.flat() };

/** The file a finding names, its `:line` left off: what an entry is keyed by. */
export const findingFile = (file) => String(file).replace(/:\d+$/, "");
/** The rule a site check finding counts under: its `rule`, else its check. */
const ruleOf = (finding) => finding.rule ?? finding.check;

/** Findings by the entry they would count under: (file, rule) → [finding], for the rules a baseline holds. */
export function countable(findings) {
  const out = new Map();
  for (const finding of findings) {
    if (!BASELINE_RULES.includes(ruleOf(finding))) continue;
    const entry = { file: findingFile(finding.file), rule: ruleOf(finding) };
    if (!out.has(key(entry))) out.set(key(entry), { ...entry, findings: [] });
    out.get(key(entry)).findings.push(finding);
  }
  return out;
}

const staleFinding = (entry, n) => ({ check: "baseline", file: entry.file, problem: `the baseline holds ${entry.count} of ${entry.rule} here and ${fewer(n)}${n ? "" : " (or the file is gone)"}: an entry that holds more than its file has lets a new one in unseen`, fix: `${SHRINK}, in this pull request` });

/**
 * The site check's findings with the baseline held: a finding of a site rule
 * in a file whose entry's count it does not pass is held (left out); more
 * than the count, and each stays, saying so; fewer, and the entry is a
 * `baseline` finding asking to shrink. The engines' entries are ESLint's,
 * but one whose file is gone is a finding here, ESLint reading no file.
 * { findings, held } — `held` the findings left out.
 */
export function holdFindings(findings, baseline, exists = () => true) {
  const groups = countable(findings.filter((finding) => SITE_RULES.includes(ruleOf(finding))));
  const held = new Set();
  const grown = new Map();
  const stale = [];
  for (const entry of validBaseline(baseline)) {
    if (ESLINT_RULES.includes(entry.rule)) { if (!exists(entry.file)) stale.push(staleFinding(entry, 0)); continue; }
    const found = groups.get(key(entry))?.findings ?? [];
    if (found.length <= entry.count) for (const finding of found) held.add(finding);
    if (found.length < entry.count) stale.push(staleFinding(entry, found.length));
    if (found.length > entry.count) for (const finding of found) grown.set(finding, ` (${found.length} in this file, and the baseline holds ${entry.count}: it only shrinks, so the file takes no new one)`);
  }
  const kept = findings.filter((finding) => !held.has(finding)).map((finding) => (grown.has(finding) ? { ...finding, problem: `${finding.problem}${grown.get(finding)}` } : finding));
  return { findings: [...kept, ...stale], held: [...held] };
}

/** What the baseline pass finds in the entries themselves: one that does not read, one named twice. */
export function entryFindings(baseline) {
  if (baseline === undefined) return [];
  if (!Array.isArray(baseline)) return [{ check: "baseline", file: CONFIG_FILE, problem: "baseline is not a list", fix: `"baseline": [{ "file", "rule", "count", "reason" }, …], as ${SHRINK.split(" shrinks")[0]} writes it` }];
  const seen = new Set();
  return baseline.flatMap((entry, at) => {
    const problem = entryProblem(entry);
    const name = isMap(entry) && typeof entry.file === "string" ? entry.file : `baseline[${at}]`;
    if (problem) return [{ check: "baseline", file: name, problem: `a baseline entry that does not read: ${problem}`, fix: `fix it in ${CONFIG_FILE}, or take it out` }];
    if (seen.has(key(entry))) return [{ check: "baseline", file: name, problem: `${entry.rule} has two entries for this file`, fix: `one entry per file and rule in ${CONFIG_FILE}: keep the one with the lower count` }];
    seen.add(key(entry));
    return [];
  });
}

/**
 * The baseline against the merge base's: `first` when the base had no list
 * (the pull request that takes 0.8.2 adds it, and every entry is listed as
 * added), else `grown`, each entry added since or raised, which the site
 * check fails. { first, added, grown }.
 */
export function baselineGrowth(before, now) {
  const entries = validBaseline(now?.baseline);
  if (!isMap(before) || !Array.isArray(before.baseline)) return { first: entries.length > 0, added: entries, grown: [] };
  const was = new Map(validBaseline(before.baseline).map((entry) => [key(entry), entry.count]));
  const grown = entries.filter((entry) => !was.has(key(entry)) || entry.count > was.get(key(entry))).map((entry) => ({ ...entry, was: was.get(key(entry)) ?? 0 }));
  return { first: false, added: [], grown };
}

const sortEntries = (entries) => [...entries].sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));
const entryOf = ({ file, rule, count, reason = "" }) => ({ file, rule, count, reason });

/**
 * The list `--baseline` writes from what the site holds now (`found`: [{ file,
 * rule, count }]): every entry with an empty reason when the config has none
 * (`current` undefined), else the current one shrunk — an entry whose file
 * holds none is removed, one whose file holds fewer takes that count, and
 * growth, an entry's or a new one's, is refused (the entry keeps its count).
 * { baseline, first, shrunk, removed, refused }.
 */
export function nextBaseline(current, found) {
  if (current === undefined) return { baseline: sortEntries(found.map(entryOf)), first: true, shrunk: [], removed: [], refused: [] };
  const now = new Map(found.map((entry) => [key(entry), entry.count]));
  const was = validBaseline(current);
  const out = { baseline: [], first: false, shrunk: [], removed: [], refused: [] };
  for (const entry of was) {
    const n = now.get(key(entry)) ?? 0;
    if (!n) { out.removed.push(entryOf(entry)); continue; }
    out.baseline.push(entryOf({ ...entry, count: Math.min(n, entry.count) }));
    if (n < entry.count) out.shrunk.push({ ...entryOf(entry), to: n });
    if (n > entry.count) out.refused.push({ ...entryOf(entry), found: n });
  }
  const known = new Set(was.map(key));
  for (const entry of found.filter((f) => !known.has(key(f)))) out.refused.push({ ...entryOf({ ...entry, count: 0 }), found: entry.count });
  out.baseline = sortEntries(out.baseline);
  return out;
}

/** The list as the config's text has it: one entry a line, under two spaces of the config's own. */
export function baselineText(entries) {
  if (!entries.length) return "[]";
  const line = (entry) => `{ ${Object.entries(entryOf(entry)).map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`).join(", ")} }`;
  return `[\n${entries.map((entry) => `    ${line(entry)}`).join(",\n")}\n  ]`;
}

/** Where a string literal that starts at `at` ends (the index after its closing quote). */
function stringEnd(text, at) {
  let i = at + 1;
  while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
  return i + 1;
}

/** Where the JSON value that starts at `at` ends: its bracket's match, its string's quote, or the next comma or brace. */
function valueEnd(text, at) {
  if (text[at] === '"') return stringEnd(text, at);
  if (text[at] !== "[" && text[at] !== "{") return at + text.slice(at).search(/[,}\]]|$/);
  let depth = 0;
  for (let i = at; i < text.length; i += 1) {
    if (text[i] === '"') { i = stringEnd(text, i) - 1; continue; }
    if (text[i] === "[" || text[i] === "{") depth += 1;
    if ((text[i] === "]" || text[i] === "}") && --depth === 0) return i + 1;
  }
  return text.length;
}

/** The span of a top-level key's value in an object's text, { start, end }, or null when it has none. */
export function topLevelValue(text, name) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '"') {
      const end = stringEnd(text, i);
      const colon = depth === 1 ? text.slice(end).match(/^\s*:\s*/) : null;
      if (colon && JSON.parse(text.slice(i, end)) === name) return { start: end + colon[0].length, end: valueEnd(text, end + colon[0].length) };
      i = end - 1;
      continue;
    }
    if (text[i] === "{" || text[i] === "[") depth += 1;
    if (text[i] === "}" || text[i] === "]") depth -= 1;
  }
  return null;
}

/** The config's text with its `baseline` set to `entries`: the value replaced where the key is, else the key and its comment added last; the rest kept byte for byte. Throws when the text would not read back as that list. */
export function withBaseline(text, entries) {
  const span = topLevelValue(text, "baseline");
  const list = baselineText(entries);
  let out;
  if (span) out = `${text.slice(0, span.start)}${list}${text.slice(span.end)}`;
  else {
    const close = text.lastIndexOf("}");
    const head = text.slice(0, close).replace(/\s*$/, "");
    const comma = head.endsWith("{") ? "" : ",";
    out = `${head}${comma}\n  "$baseline": ${JSON.stringify(COMMENT)},\n  "baseline": ${list}\n${text.slice(close)}`;
  }
  if (JSON.stringify(JSON.parse(out).baseline) !== JSON.stringify(entries.map(entryOf))) throw new Error(`${CONFIG_FILE}: the baseline did not write as its list`);
  return out;
}

/** The counts the baseline holds for one rule, file → count, from a site's config (none when it has no config or no list): what the content lint reads. */
export function baselineCounts(root, rule, fs = nodeFs) {
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(root, CONFIG_FILE), "utf8")); } catch { return new Map(); }
  return new Map(validBaseline(config?.baseline).filter((entry) => entry.rule === rule).map((entry) => [entry.file, entry.count]));
}

/**
 * The findings across the site of the rules ESLint holds a baseline for, the
 * engines' and the composition's, the baseline ignored: [{ check, rule, file,
 * problem }], `file` with its `:line`, errors alone. ESLint is the site's own
 * (its eslint.config.mjs), told through its settings to report what the
 * engines' rules would hold, and the files the current `baseline` holds a
 * composition count for linted without the processor that holds them.
 * Async; `ESLint` comes in for the tests.
 */
export async function lintFindings({ root, ESLint, baseline = [] }) {
  ESLint ??= (await import("eslint")).ESLint;
  const held = [...eslintCounts(baseline)].filter(([, rules]) => Object.keys(compositionCounts(rules)).length).map(([file]) => literalGlob(file));
  const eslint = new ESLint({ cwd: root, overrideConfig: [{ settings: { [PLUGIN]: { ignoreBaseline: true } } }, ...(held.length ? [{ files: held, processor: UNHELD }] : [])] });
  const results = await eslint.lintFiles(["."]);
  return results.flatMap((result) => result.messages.filter((message) => ESLINT_RULES.includes(message.ruleId) && message.severity === 2).map((message) => ({ check: message.ruleId, rule: message.ruleId, file: `${path.relative(root, result.filePath).split(path.sep).join("/")}:${message.line}`, problem: message.message })));
}
