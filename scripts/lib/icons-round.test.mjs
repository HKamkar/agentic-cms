// An icon round from new to retire, in a throwaway site: the scenes, the
// record and the sheet; a publish of icons into the Icon map and of marks
// into public/ with their sources; a retire that keeps what was published.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { newRound, parsePicks, publishRound, readRound, retireRound, roundSheet } from "./icons-round.mjs";

const site = () => fs.mkdtempSync(path.join(os.tmpdir(), "icon-round-"));
const exists = (root, file) => fs.existsSync(path.join(root, file));

test("new: a scene per role and letter from the kind's template, the record, and a sheet with a row per role and a cell per letter × size × ground", () => {
  const root = site();
  try {
    const report = newRound(root, { round: "modules", roles: ["retrieval", "graph"], candidates: 2, sizes: [24, 96] });
    assert.deepEqual(report.scenes, [".parity/lab/rounds/modules/retrieval-A.svg", ".parity/lab/rounds/modules/retrieval-B.svg", ".parity/lab/rounds/modules/graph-A.svg", ".parity/lab/rounds/modules/graph-B.svg"]);
    assert.match(fs.readFileSync(path.join(root, report.scenes[0]), "utf8"), /24 grid, stroke 1\.6 in currentColor/);
    const record = readRound(root, "modules");
    assert.deepEqual([record.kind, record.letters, record.sizes, record.roles.map((r) => r.role), record.picks], ["icon", ["A", "B"], [24, 96], ["retrieval", "graph"], {}]);
    const sheet = parseYaml(fs.readFileSync(path.join(root, report.sheet), "utf8"));
    assert.deepEqual(sheet.rows.map((r) => r.label), ["retrieval", "graph"]);
    assert.equal(sheet.rows[0].cells.length, 2 * 2 * 3, "letters × sizes × grounds");
    assert.deepEqual(sheet.rows[0].cells[0], { label: "A · 24 · paper", file: ".parity/lab/rounds/modules/retrieval-A.svg", size: 24, ground: { background: "var(--color-paper)", color: "var(--color-ink)", label: "paper" } });
    assert.deepEqual(roundSheet(record), sheet);
    assert.throws(() => newRound(root, { round: "modules", roles: ["x"] }), /\.parity\/lab\/rounds\/modules exists/);
    assert.throws(() => newRound(root, { round: "b", roles: [] }), /--roles names the icons/);
    assert.throws(() => newRound(root, { round: "b", roles: ["a", "a"] }), /names a role twice/);
    assert.throws(() => newRound(root, { round: "b", roles: ["A b"] }), /a role is lowercase letters/);
    assert.throws(() => newRound(root, { round: "b", roles: ["a"], kind: "loop" }), /--kind is one of icon, mark/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("publish: an icon round's picks become inline Icon data (the file and the map); the picks and files are recorded; a wrong role or letter is named", async () => {
  const root = site();
  try {
    newRound(root, { round: "modules", roles: ["retrieval", "graph"], candidates: 2 });
    const record = readRound(root, "modules");
    assert.throws(() => parsePicks("", record), /--pick names a letter per role/);
    assert.throws(() => parsePicks("query=A", record), /query: not a role of modules \(retrieval, graph\)/);
    assert.throws(() => parsePicks("graph=C", record), /graph=C: the letters of modules are A, B/);
    const report = await publishRound(root, "modules", "retrieval=B, graph=A");
    assert.deepEqual(report.published.map((p) => [p.role, p.letter, p.files[0]]), [["retrieval", "B", "src/config/icons/retrieval.svg"], ["graph", "A", "src/config/icons/graph.svg"]]);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "src/config/icons.json"), "utf8")), ["file:graph", "file:retrieval"]);
    assert.match(fs.readFileSync(path.join(root, "src/config/icons.ts"), "utf8"), /"file:retrieval": \{ kind: "stroke"/);
    const after = readRound(root, "modules");
    assert.deepEqual(after.picks, { retrieval: "B", graph: "A" });
    assert.deepEqual(after.published, ["src/config/icons.json", "src/config/icons.ts", "src/config/icons/graph.svg", "src/config/icons/retrieval.svg"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("publish: a mark round's pick becomes a file under public/ resolved for one scheme, with its source beside it", async () => {
  const root = site();
  try {
    fs.mkdirSync(path.join(root, "src/app"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/app/globals.css"), "@theme static {\n  --color-paper: light-dark(#ffffff, #111111);\n  --color-ink: light-dark(#111111, #f2f2f2);\n  --color-fill: light-dark(#eeeeee, #222222);\n}\n");
    newRound(root, { round: "plans", roles: ["cloud"], candidates: 1, kind: "mark", sizes: [48] });
    const { published: [pick] } = await publishRound(root, "plans", "cloud=A", { to: "public/images/brand" });
    assert.deepEqual(pick.files, ["public/images/brand/cloud.svg", "public/images/brand/cloud.source.svg"]);
    assert.doesNotMatch(fs.readFileSync(path.join(root, "public/images/brand/cloud.svg"), "utf8"), /currentColor/, "the file is resolved for one scheme");
    assert.match(fs.readFileSync(path.join(root, "public/images/brand/cloud.svg"), "utf8"), /stroke="#111111"/, "the light scheme's ink");
    assert.match(fs.readFileSync(path.join(root, "public/images/brand/cloud.source.svg"), "utf8"), /currentColor/, "the source follows the page");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("retire: refused while nothing is published (unless --force); removes the round and keeps every file it published; --dry-run removes nothing", async () => {
  const root = site();
  try {
    newRound(root, { round: "modules", roles: ["retrieval"], candidates: 1 });
    assert.throws(() => retireRound(root, "modules"), /nothing published yet — publish the picks first/);
    await publishRound(root, "modules", "retrieval=A");
    const dry = retireRound(root, "modules", { dryRun: true });
    assert.deepEqual(dry, { removed: [".parity/lab/rounds/modules"], kept: ["src/config/icons.json", "src/config/icons.ts", "src/config/icons/retrieval.svg"], dryRun: true });
    assert.ok(exists(root, ".parity/lab/rounds/modules/round.yaml"));
    assert.deepEqual(retireRound(root, "modules").removed, [".parity/lab/rounds/modules"]);
    assert.ok(!exists(root, ".parity/lab/rounds/modules") && exists(root, "src/config/icons/retrieval.svg"));
    assert.throws(() => retireRound(root, "modules"), /modules: no such round/);
    newRound(root, { round: "dropped", roles: ["x"], candidates: 1 });
    assert.deepEqual(retireRound(root, "dropped", { force: true }).kept, []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
