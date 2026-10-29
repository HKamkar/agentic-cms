// A site's agent files moved from what `init` copied up to 0.8 to what 0.9.0
// gives it (docs/roadmap.md job 10; the first piece of the 0.9.0 migration,
// scripts/migrations/0.9.0.mjs, and of `init --agent-files` on such a site):
// - a copy of one of the kit's skills, in either tree, the site never touched
//   goes: Claude Code has it from the kit's plugin, Codex from its stub;
// - one the site edited becomes the site's own, `<name>-site`, with a note;
// - each rule becomes thin, its own lines (those no release of the kit had)
//   kept after the kit's block, and its paths too when they are the site's;
// - the base copies (.agentic-cms/base/) go: nothing is merged by hand.
// "Never touched" is a text some release of the kit shipped, the record's
// (lib/agent-file-record.mjs) or the old manifest's base. A site whose
// manifest is 0.9.0's has nothing to move: a rule without the kit's block
// there is the site's choice.
import fs from "node:fs";
import path from "node:path";
import { FORMAT, MANIFEST, ruleParts, splitFront, STUB_NOTE, thinRule } from "./agent-file-format.mjs";
import { readReleases, renderAgentFiles, sha, walk } from "./agent-file-record.mjs";

/** The copies of the kit's text 0.8 kept beside the manifest, for a hand merge. */
export const BASES = ".agentic-cms/base";
const TREES = [".claude/skills", ".agents/skills"];
const read = (target, file) => (fs.existsSync(path.join(target, file)) ? fs.readFileSync(path.join(target, file), "utf8") : null);
const readManifest = (target) => { try { return JSON.parse(read(target, MANIFEST)); } catch { return null; } };

/** The names of the kit's skills and rules any release shipped or the kit ships now: { skills, rules }. */
function shipped(releases, current) {
  const files = new Set([...Object.values(releases.versions).flatMap((files) => Object.keys(files)), ...current.keys()]);
  const names = (re) => [...new Set([...files].map((file) => file.match(re)?.[1]).filter(Boolean))];
  return { skills: names(/^\.(?:claude|agents)\/skills\/([^/]+)\//), rules: names(/^\.claude\/rules\/([^/]+\.md)$/) };
}

/** What a site holds of 0.8's agent files: the skill folders, rules and base copies the move takes, by path; none on a site whose manifest is 0.9.0's. */
export function legacyFiles(target, { kitRoot }) {
  if (readManifest(target)?.format === FORMAT) return [];
  const { skills, rules } = shipped(readReleases(kitRoot), currentFiles(kitRoot));
  const copy = (tree, name) => fs.existsSync(path.join(target, tree, name)) && !(read(target, `${tree}/${name}/SKILL.md`) ?? "").includes(STUB_NOTE);
  return [
    ...TREES.flatMap((tree) => skills.filter((name) => copy(tree, name)).map((name) => `${tree}/${name}`)),
    ...rules.filter((name) => { const text = read(target, `.claude/rules/${name}`); return text !== null && ruleParts(text).block === null; }).map((name) => `.claude/rules/${name}`),
    ...(fs.existsSync(path.join(target, BASES)) ? [BASES] : []),
  ];
}

const currentFiles = (kitRoot) => new Map(renderAgentFiles(kitRoot).map(({ file, text }) => [file, text]));

/** Every text of a file the kit is known to have given the site: the record's releases, the old manifest's base and its copy, the kit's current text. (file) => { hashes, texts }. */
function knownTexts(target, { releases, current, manifest }) {
  return (file) => {
    const hashes = new Set(Object.values(releases.versions).map((files) => files[file]).filter(Boolean));
    if (manifest?.files?.[file]) hashes.add(manifest.files[file]);
    const texts = [...hashes].map((hash) => releases.texts[hash]).filter((text) => text !== undefined);
    const copy = read(target, `${BASES}/${file.replace(/^\./, "")}`);
    if (copy !== null) texts.push(copy);
    if (current.has(file)) { texts.push(current.get(file)); hashes.add(sha(current.get(file))); }
    return { hashes, texts };
  };
}

/**
 * Moves what legacyFiles() finds, writing each file it changes: [{ file,
 * status, note? }], the status removed (a copy the site never touched),
 * moved (one it edited, now `<name>-site`), kept (one it edited whose new
 * name is taken) or thin (a rule).
 */
export function moveLegacy(target, { kitRoot, log = console.log, result = { updated: [] } }) {
  const releases = readReleases(kitRoot);
  const current = currentFiles(kitRoot);
  const known = knownTexts(target, { releases, current, manifest: readManifest(target) });
  const report = [];
  for (const entry of legacyFiles(target, { kitRoot })) {
    if (entry === BASES) continue;
    const kitRule = current.get(entry);
    const moved = entry.startsWith(".claude/rules/") ? (kitRule === undefined ? null : thinOut(target, entry, known(entry), thinRule(kitRule, entry))) : moveSkill(target, entry, known);
    if (!moved) continue;
    report.push(moved);
    result.updated.push(entry);
    log(`${moved.status.padEnd(8)} ${entry}${moved.note ? ` — ${moved.note}` : ""}`);
  }
  fs.rmSync(path.join(target, BASES), { recursive: true, force: true });
  if (fs.existsSync(path.join(target, path.dirname(BASES))) && !walk(path.join(target, path.dirname(BASES))).length) fs.rmSync(path.join(target, path.dirname(BASES)), { recursive: true });
  return report;
}

/** A copy of one of the kit's skills: gone when every file in it is a text the kit gave, else the site's own skill under `<name>-site`. */
function moveSkill(target, dir, known) {
  const untouched = walk(path.join(target, dir)).every((rel) => known(`${dir}/${rel}`).hashes.has(sha(read(target, `${dir}/${rel}`))));
  if (untouched) {
    fs.rmSync(path.join(target, dir), { recursive: true });
    return { file: dir, status: "removed", note: dir.startsWith(".claude/") ? "the kit's text: Claude Code reads it from the kit's design plugin" : "the kit's text: Codex reads it through its stub" };
  }
  const own = `${dir}-site`;
  if (fs.existsSync(path.join(target, own))) return { file: dir, status: "kept", note: `the site edited it, and ${own} is taken: give it a name of its own by hand` };
  fs.renameSync(path.join(target, dir), path.join(target, own));
  ownSkill(target, own, path.basename(dir));
  return { file: dir, status: "moved", note: `the site edited it: now its own skill, ${own}` };
}

/** A skill the site edited, named as its own and saying where the kit's is now. */
function ownSkill(target, dir, name) {
  const file = path.join(target, dir, "SKILL.md");
  if (!fs.existsSync(file)) return;
  const { front, body } = splitFront(fs.readFileSync(file, "utf8"));
  const note = `> This site's own version of the kit's \`${name}\` skill, kept from the copy it edited before 0.9.0. The kit's current one comes from the installed package — \`design:${name}\` in Claude Code, \`.agents/skills/${name}/\` for Codex — and deleting this folder follows it.\n\n`;
  fs.writeFileSync(file, front.replace(/^name:\s*.*$/m, `name: ${name}-site`) + (front ? "\n" : "") + note + body.replace(/^\n/, ""));
}

/** A whole rule made thin: the kit's block, the site's paths when no release had them, and the lines no release had after the block. */
function thinOut(target, file, { hashes, texts }, kitThin) {
  const onDisk = read(target, file);
  const { front, body } = splitFront(onDisk);
  const kit = splitFront(kitThin);
  const ownFront = !texts.some((text) => splitFront(text).front === front);
  const own = hashes.has(sha(onDisk)) ? "" : ownLines(body, new Set(texts.flatMap((text) => text.split("\n"))));
  fs.writeFileSync(path.join(target, file), (ownFront ? front : kit.front) + kit.body + (own ? `\n${own}\n` : ""));
  const notes = [own && "the site's own lines kept after the kit's block", ownFront && "its own paths kept"].filter(Boolean);
  return { file, status: "thin", ...(notes.length && { note: notes.join("; ") }) };
}

/** The lines of a rule's body no text of the kit has, in their order, a blank line where the site had one between them. */
function ownLines(body, kitLines) {
  return body.split("\n").map((line) => (kitLines.has(line) ? "" : line)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
