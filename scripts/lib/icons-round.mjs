// An icon round, for `agentic-cms icons round`: a design round for a set of
// icons that spans sessions, kept in the lab (.parity/lab/rounds/<round>/,
// gitignored, left by `lab clean`). `new` writes a scene per role and letter
// from the lab's templates, the round's record (round.yaml) and a sheet spec
// that shows every candidate at the sizes it ships on the grounds it sits on,
// one row per role; the agent draws the scenes, the owner looks (`lab serve`,
// `pnpm kit sheet`) and picks a letter per role; `publish` renders the picks
// where a page takes them — inline Icon data for an icon, a file under
// public/ with its source beside it for a mark — and records them; `retire`
// removes the round, never what was published. This module reads
// agentic-cms/lab (through lab.mjs): a script imports it after
// scripts/lib/load-ts.mjs.
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify } from "yaml";
import { updateIcons } from "./icons-source.mjs";
import { ROUNDS_DIR, isSceneName, sceneTemplate } from "./lab.mjs";
import { renderScene } from "./lab-render.mjs";

export const KINDS = ["icon", "mark"];
export const LETTERS = "ABCDEFGH";
/** The grounds a round is looked at on: the page's, white, black — each with its ink. */
export const GROUNDS = [
  { background: "var(--color-paper)", color: "var(--color-ink)", label: "paper" },
  { background: "#fff", color: "#000", label: "white" },
  { background: "#000", color: "#fff", label: "black" },
];
const RECORD = "round.yaml";
const SHEET = "sheet.yaml";

export const roundDir = (round) => `${ROUNDS_DIR}/${round}`;
const sceneFile = (round, role, letter) => `${roundDir(round)}/${role}-${letter}.svg`;
/** A scene's id in the lab (listScenes): rounds/<round>/<role>-<letter>. */
const sceneId = (round, role, letter) => `rounds/${round}/${role}-${letter}`;

/** The round's record, or a thrown error naming the fix. */
export function readRound(root, round) {
  const file = path.join(root, roundDir(round), RECORD);
  if (!fs.existsSync(file)) throw new Error(`${round}: no such round (no ${roundDir(round)}/${RECORD}; agentic-cms icons round new ${round} --roles …)`);
  return parseYaml(fs.readFileSync(file, "utf8"));
}
const writeRecord = (root, record) => fs.writeFileSync(path.join(root, roundDir(record.round), RECORD), stringify(record));

/** The sheet of a round: a row per role (its label the role), a cell per letter × size × ground, labelled "A · 24 · white". */
export function roundSheet(record) {
  const cells = (role) => record.letters.flatMap((letter) => record.sizes.flatMap((size) => record.grounds.map((ground) => ({ label: `${letter} · ${size} · ${ground.label}`, file: sceneFile(record.round, role, letter), size, ground }))));
  return { name: `${record.round} round`, rows: record.roles.map(({ role, note }) => ({ label: role, ...(note ? { note } : {}), cells: cells(role) })) };
}

function checkNew({ round, roles, candidates, kind, sizes }) {
  if (!isSceneName(round)) throw new Error(`${round}: a round's name is lowercase letters, digits and hyphens`);
  if (!roles.length) throw new Error("--roles names the icons the round draws: --roles retrieval,graph,query");
  for (const role of roles) if (!isSceneName(role)) throw new Error(`${role}: a role is lowercase letters, digits and hyphens (it becomes the file name)`);
  if (new Set(roles).size !== roles.length) throw new Error(`--roles names a role twice: ${roles.join(",")}`);
  if (!(candidates >= 1 && candidates <= LETTERS.length)) throw new Error(`--candidates is 1 to ${LETTERS.length}, not ${candidates}`);
  if (!KINDS.includes(kind)) throw new Error(`--kind is one of ${KINDS.join(", ")}, not ${kind}`);
  if (!sizes.length || !sizes.every((s) => Number.isInteger(s) && s > 0)) throw new Error("--sizes is a list of whole pixels: 24,36,96");
}

/** Writes a round: a scene per role × letter from the kind's template, the record and the sheet spec; { round, dir, kind, scenes, sheet }. */
export function newRound(root, { round, roles, candidates = 3, kind = "icon", sizes = [24, 36, 96] }) {
  checkNew({ round, roles, candidates, kind, sizes });
  const dir = path.join(root, roundDir(round));
  if (fs.existsSync(dir)) throw new Error(`${roundDir(round)} exists: carry on with it, or retire it first (agentic-cms icons round retire ${round})`);
  const letters = [...LETTERS.slice(0, candidates)];
  fs.mkdirSync(dir, { recursive: true });
  const scenes = roles.flatMap((role) => letters.map((letter) => { const file = sceneFile(round, role, letter); fs.writeFileSync(path.join(root, file), sceneTemplate(kind, `${role}-${letter.toLowerCase()}`)); return file; }));
  const record = { round, kind, sizes, grounds: GROUNDS, letters, roles: roles.map((role) => ({ role, note: "" })), picks: {}, published: [] };
  writeRecord(root, record);
  fs.writeFileSync(path.join(dir, SHEET), stringify(roundSheet(record)));
  return { round, dir: roundDir(round), kind, scenes, sheet: `${roundDir(round)}/${SHEET}` };
}

/** "retrieval=B,graph=A" → { retrieval: "B", graph: "A" }, each checked against the round. */
export function parsePicks(text, record) {
  const picks = Object.fromEntries(String(text ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((pair) => pair.split("=").map((s) => s.trim())));
  if (!Object.keys(picks).length) throw new Error("--pick names a letter per role: --pick retrieval=B,graph=A");
  for (const [role, letter] of Object.entries(picks)) {
    if (!record.roles.some((r) => r.role === role)) throw new Error(`${role}: not a role of ${record.round} (${record.roles.map((r) => r.role).join(", ")})`);
    if (!record.letters.includes(letter)) throw new Error(`${role}=${letter}: the letters of ${record.round} are ${record.letters.join(", ")}`);
  }
  return picks;
}

/** One pick where a page takes it: an icon as inline Icon data (src/config/icons/<role>.svg, then the map), a mark as <to>/<role>.svg with its source beside it. The files written. */
async function publishPick(root, record, role, letter, { to, scheme }) {
  const id = sceneId(record.round, role, letter);
  if (record.kind === "icon") {
    const out = `src/config/icons/${role}.svg`;
    await renderScene(root, id, { out, scheme, "no-poster": true });
    updateIcons(root, [`file:${role}`]);
    return [out, "src/config/icons.json", "src/config/icons.ts"];
  }
  const out = `${to}/${role}.svg`;
  const report = await renderScene(root, id, { out, scheme });
  // an .svg render resolves the tokens for one scheme; the scene, which follows the page, is its source (design-graphics)
  const source = `${to}/${role}.source.svg`;
  fs.copyFileSync(path.join(root, sceneFile(record.round, role, letter)), path.join(root, source));
  return [out, ...(report.still ? [report.still] : []), source];
}

/** Publishes the picks and records them; { round, published: [{ role, letter, files }] }. */
export async function publishRound(root, round, pickText, { to = "public/images/icons", scheme = "light" } = {}) {
  const record = readRound(root, round);
  const picks = parsePicks(pickText, record);
  const published = [];
  for (const [role, letter] of Object.entries(picks)) {
    if (!fs.existsSync(path.join(root, sceneFile(round, role, letter)))) throw new Error(`${sceneFile(round, role, letter)}: no such scene`);
    published.push({ role, letter, files: await publishPick(root, record, role, letter, { to, scheme }) });
  }
  record.picks = { ...record.picks, ...picks };
  record.published = [...new Set([...(record.published ?? []), ...published.flatMap((p) => p.files)])].sort();
  writeRecord(root, record);
  return { round, published };
}

/** Removes the round's folder — its scenes, record and sheet — never what it published; { removed, kept, dryRun? }. Refuses a round with nothing published unless `force`. */
export function retireRound(root, round, { dryRun = false, force = false } = {}) {
  const record = readRound(root, round);
  if (!Object.keys(record.picks ?? {}).length && !force) throw new Error(`${round}: nothing published yet — publish the picks first (agentic-cms icons round publish ${round} --pick role=letter,…), or --force to drop the round`);
  const kept = (record.published ?? []).filter((file) => fs.existsSync(path.join(root, file)));
  if (!dryRun) fs.rmSync(path.join(root, roundDir(round)), { recursive: true, force: true });
  return { removed: [roundDir(round)], kept, ...(dryRun ? { dryRun } : {}) };
}
