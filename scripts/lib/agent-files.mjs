// The agent files `init` writes into a site since 0.9.0, and `--check`
// holds (docs/roadmap.md job 10, D14 (a), D15 (b)): few, and none merged by
// hand. The kit's skills are its plugins, read from the installed package —
// the marketplace `.claude-plugin/` at node_modules/agentic-cms, which the
// site's .claude/settings.json names, with `editorial` and `design` — so
// `.claude/skills/` holds the site's own alone. What the kit writes:
// - each rule thin (lib/agent-file-format.mjs), its block rewritten on every
//   run, the site's own lines after it and its own paths kept, its required
//   blocks checked where the site took the marks away;
// - a stub per skill for Codex in .agents/skills/, rewritten freely;
// - the kit's keys in .claude/settings.json — the marketplace and the
//   plugins it enables — the site's other keys left as they are;
// - AGENTS.md's scoped-rules table (lib/rules-table.mjs).
// The manifest records what it wrote: each rule's paths as the kit last wrote
// them (so paths the site never touched follow the kit, and its own stay),
// the stubs (a skill the kit drops loses its stub) and the settings keys (a
// key the kit drops leaves the site's settings). A site laid out before 0.9.0
// is moved first (lib/agent-files-move.mjs). A rule for a tool a site adopts
// (the components rule, for the component guard) is written and checked only
// where the site has that tool's config.
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { codexStub, FORMAT, MANIFEST, ruleParts, RULES, SETTINGS, SETTINGS_TEMPLATE, SKILLS, splitFront, thinRule } from "./agent-file-format.mjs";
import { sha, walk } from "./agent-file-record.mjs";
import { requiredGone } from "./agent-required.mjs";
import { legacyFiles, moveLegacy } from "./agent-files-move.mjs";
import { codexSize, placeBlock, readRules, rulesBlock } from "./rules-table.mjs";

export { kitPath, MANIFEST, SETTINGS } from "./agent-file-format.mjs";
/** The agent files that describe a tool a site adopts, each with the file that adopts it. */
export const ADOPTED_BY = { ".claude/rules/components.md": "src/config/components.json" };
/** Whether the site has adopted what an agent file describes: always, unless ADOPTED_BY names a file the site lacks. */
export const adopted = (target, file) => !ADOPTED_BY[file] || fs.existsSync(path.join(target, ADOPTED_BY[file]));

const readText = (full) => (fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null);
export const readManifest = (target) => { try { return JSON.parse(fs.readFileSync(path.join(target, MANIFEST), "utf8")); } catch { return null; } };
export const writeManifest = (target, manifest) => fs.writeFileSync(path.join(target, MANIFEST), JSON.stringify(manifest, null, 1) + "\n");

/** The site's thin rules as the kit writes them, by file: one per whole rule the site has adopted. */
export const kitRules = (target, kitRoot) => new Map(walk(path.join(kitRoot, RULES)).map((rel) => `.claude/rules/${rel}`).filter((file) => adopted(target, file)).map((file) => [file, thinRule(fs.readFileSync(path.join(kitRoot, RULES, path.basename(file)), "utf8"), file)]));
/** The Codex stubs as the kit writes them, by file: one per skill of the kit's. */
export const kitStubs = (kitRoot) => new Map(walk(path.join(kitRoot, SKILLS)).filter((rel) => rel.endsWith("/SKILL.md")).map((rel) => [`${SKILLS}/${rel}`, codexStub(fs.readFileSync(path.join(kitRoot, SKILLS, rel), "utf8"), `${SKILLS}/${rel}`)]));

/**
 * A site's rule against the kit's thin text and the hash of the paths the kit
 * last wrote into it: { status, text, note?, required? }, `text` what a
 * refresh leaves. missing; ok, the kit's text; stale, a block or untouched
 * paths behind the kit's (a refresh rewrites them, keeping the rest);
 * modified, the site's own lines or paths beside a current block; for a file
 * whose block marks are gone, modified or "modified, required gone", which a
 * refresh keeps as it is.
 */
export function measureRule(onDisk, kitThin, recorded) {
  if (onDisk === null) return { status: "missing", text: kitThin };
  if (onDisk === kitThin) return { status: "ok", text: kitThin };
  const site = ruleParts(onDisk);
  const kit = ruleParts(kitThin);
  if (site.block === null) {
    const required = requiredGone(onDisk, kitThin);
    const note = "the marks around the kit's block are gone, so a refresh cannot bring its lines in";
    return required.length ? { status: "modified, required gone", text: onDisk, required, note } : { status: "modified", text: onDisk, note };
  }
  const ownPaths = site.front !== kit.front && sha(site.front) !== recorded;
  const text = (ownPaths ? site.front : kit.front) + site.before + kit.block + site.after;
  if (text !== onDisk) return { status: "stale", text };
  return { status: "modified", text, ...(ownPaths && { note: "its own paths, kept" }) };
}

/** A Codex stub against the kit's: missing, ok or stale (a refresh rewrites it, whatever it holds). */
export const measureStub = (onDisk, kitStub) => ({ status: onDisk === null ? "missing" : onDisk === kitStub ? "ok" : "stale", text: kitStub });

/** The keys the kit holds in a site's settings, from its template: [{ key, group, name, value }], each marketplace it names and each plugin it enables. */
export const settingsKeys = (template) => ["extraKnownMarketplaces", "enabledPlugins"].flatMap((group) => Object.entries(template[group] ?? {}).map(([name, value]) => ({ key: `${group}["${name}"]`, group, name, value })));

/**
 * The site's settings against the kit's template and the keys the kit wrote
 * there before (`recorded`): missing, unreadable, ok, or stale with the keys
 * a refresh sets (each of the template's as it has it) or removes (one the
 * kit wrote and holds no more) — the site's other keys are its own.
 */
export function measureSettings(onDisk, templateText, recorded = []) {
  if (onDisk === null) return { status: "missing", text: templateText };
  let site;
  try { site = JSON.parse(onDisk); } catch { return { status: "unreadable" }; }
  const held = settingsKeys(JSON.parse(templateText));
  const want = structuredClone(site);
  for (const { group, name, value } of held) want[group] = { ...want[group], [name]: value };
  const dropped = recorded.filter((key) => !held.some((k) => k.key === key)).map((key) => key.match(/^(\w+)\["(.+)"\]$/)).filter(Boolean);
  for (const [, group, name] of dropped) if (want[group]) delete want[group][name];
  const keys = [...held.filter(({ group, name, value }) => !isDeepStrictEqual(site[group]?.[name], value)).map(({ key }) => key), ...dropped.filter(([, group, name]) => site[group]?.[name] !== undefined).map(([key]) => `${key} (no longer the kit's)`)];
  return keys.length ? { status: "stale", text: JSON.stringify(want, null, 2) + "\n", keys } : { status: "ok" };
}

/** A measured file as the report gives it. */
const entry = (file, { status, note, required, keys }) => ({ file, status, ...(note && { note }), ...(required && { required }), ...(keys && { keys }) });

/** Writes what a refresh leaves of a measured file: created, updated, kept (a site's file the kit leaves as it is), "kept, required gone" or ok. */
function refreshed(target, file, measured, { log, result }) {
  const { status, text } = measured;
  if (status === "ok") return entry(file, measured);
  if (status.startsWith("modified") || status === "unreadable") { result.kept.push(file); return entry(file, { ...measured, status: status.replace("modified", "kept") }); }
  fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
  fs.writeFileSync(path.join(target, file), text);
  const written = status === "missing" ? "created" : "updated";
  result[written].push(file);
  log(`${written}  ${file}`);
  return entry(file, { ...measured, status: written });
}

/** Stubs the manifest says the kit wrote for a skill it no longer has: removed, with their folder when nothing else is in it. */
function droppedStubs(target, recorded, stubs, { log }) {
  return recorded.filter((file) => !stubs.has(file) && fs.existsSync(path.join(target, file))).map((file) => {
    fs.rmSync(path.join(target, file));
    if (!fs.readdirSync(path.join(target, path.dirname(file))).length) fs.rmdirSync(path.join(target, path.dirname(file)));
    log(`removed  ${file}`);
    return { file, status: "removed", note: "the kit has no such skill now" };
  });
}

/**
 * Writes the agent files, or with `check` reports each: the thin rules, the
 * stubs, the settings and AGENTS.md's table and size; `force` takes the
 * kit's whole thin text for a rule the site edited. A site laid out before
 * 0.9.0 is moved first, and with `check` is reported as legacy, file by file.
 */
export function agentFiles(target, { kitRoot, version, check = false, force = false, log = console.log, result = { created: [], updated: [], kept: [] } }) {
  const legacy = legacyFiles(target, { kitRoot });
  if (check && legacy.length) return legacy.map((file) => ({ file, status: "legacy", note: "what init copied before 0.9.0: agentic-cms init --agent-files moves it" }));
  const report = check ? [] : moveLegacy(target, { kitRoot, log, result });
  const manifest = readManifest(target);
  const recorded = manifest?.format === FORMAT ? manifest : {};
  const rules = kitRules(target, kitRoot);
  const stubs = kitStubs(kitRoot);
  const opts = { check, log, result };
  const each = (file, measure) => { const measured = measure(readText(path.join(target, file))); return check ? entry(file, measured) : refreshed(target, file, measured, opts); };
  for (const [file, text] of rules) report.push(each(file, (onDisk) => (force && !check ? { status: onDisk === text ? "ok" : "stale", text } : measureRule(onDisk, text, recorded.rules?.[file]))));
  for (const [file, text] of stubs) report.push(each(file, (onDisk) => measureStub(onDisk, text)));
  if (!check) report.push(...droppedStubs(target, recorded.stubs ?? [], stubs, opts));
  report.push(...settingsFile(target, kitRoot, { recorded: recorded.settings, ...opts }));
  report.push(...agentsMd(target, opts));
  if (!check) writeManifest(target, { format: FORMAT, version, rules: Object.fromEntries([...rules].map(([file, text]) => [file, sha(splitFront(text).front)])), stubs: [...stubs.keys()], settings: settingsKeysOf(kitRoot) });
  return report;
}

const settingsTemplate = (kitRoot) => readText(path.join(kitRoot, SETTINGS_TEMPLATE));
const settingsKeysOf = (kitRoot) => { const text = settingsTemplate(kitRoot); return text === null ? [] : settingsKeys(JSON.parse(text)).map(({ key }) => key); };

/** The site's .claude/settings.json against the kit's template, written or reported; none for a kit without the template. */
function settingsFile(target, kitRoot, { check, recorded, log, result }) {
  const template = settingsTemplate(kitRoot);
  if (template === null) return [];
  const measured = measureSettings(readText(path.join(target, SETTINGS)), template, recorded);
  return [check ? entry(SETTINGS, measured) : refreshed(target, SETTINGS, measured, { log, result })];
}

/** The site's AGENTS.md: its scoped-rules table as the site's rules now read (written, or with `check` reported ok | stale | missing) and its size against what Codex reads. */
function agentsMd(target, { check, log, result }) {
  const file = path.join(target, "AGENTS.md");
  const rules = readRules(path.join(target, ".claude/rules"));
  if (!fs.existsSync(file) || !rules.length) return [];
  const placed = placeBlock(fs.readFileSync(file, "utf8"), rulesBlock(rules));
  const table = "AGENTS.md (rules table)";
  const written = placed.status === "inserted" ? "created" : "updated";
  const status = placed.status === "ok" ? "ok" : check ? (placed.status === "inserted" ? "missing" : "stale") : written;
  if (!check && placed.status !== "ok") { fs.writeFileSync(file, placed.text); result[written].push(table); log(`${written}  ${table}`); }
  // measured as --agent-files leaves it: with the table in
  const { bytes, over } = codexSize(placed.text);
  return [{ file: table, status }, { file: "AGENTS.md (size)", status: over ? "too big" : "ok", bytes }];
}
