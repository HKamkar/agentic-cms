// The bin the way an agent meets it: the map by family, a wrong command
// answered with the nearest one, a command run outside a site's root refused
// with the fix, a stray value after a repeatable flag explained.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const BIN = path.resolve(import.meta.dirname, "../bin/agentic-cms.mjs");
const run = (args, cwd = process.cwd()) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });

test("the help is the map by family, one line per command, and names the exit codes", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^usage: agentic-cms <command> \[options\]/);
  assert.match(r.stdout, /\n {2}content\s+lint · check · status · docs\n/);
  assert.match(r.stdout, /\n {2}lab\s+lab <new\|serve\|route\|render\|clean>\n/);
  assert.match(r.stdout, /\n\s+shot\s+one screenshot of a page/);
  assert.match(r.stdout, /0 clean · 1 findings · 2 usage or environment/);
  assert.equal(run([]).status, 2, "no command: the map, exit 2");
});

test("a wrong command names the nearest one and prints the map; a wrong subcommand and a wrong flag likewise", () => {
  const r = run(["lints"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^agentic-cms: no command lints — did you mean lint\?\n/);
  assert.match(r.stderr, /\n {2}content\s+lint · check/);
  assert.match(run(["visual"]).stderr, /did you mean visual-parity\?/);
  assert.match(run(["lab", "serv"]).stderr, /lab: lab has no subcommand serv — did you mean serve\? \(new, serve, route, render, clean\)/);
  assert.match(run(["lab", "serve", "--scene", "a"]).stderr, /unknown flag --scene — did you mean --scenes\?/);
  assert.match(run(["lab", "serve", "--scenes", "a", "b"]).stderr, /lab serve takes 0 arguments, not 1 \("b" is extra\) — --scenes takes one value each time: --scenes a --scenes b/);
  assert.match(run(["lab", "render", "x", "--out", "x.svg", "--scheme", "grey"]).stderr, /--scheme is one of light, dark, not grey/);
});

test("a command that reads the site refuses to run outside a site's root, with the fix; the ones that run anywhere do", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "not-a-site-"));
  try {
    const r = run(["lint"], dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^agentic-cms lint: no src\/kit\.ts here — run it in the site's root \(where package\.json, src\/kit\.ts and content\/ are\); to start a site here, agentic-cms init \.\n$/);
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    assert.doesNotMatch(run(["seo"], dir).stderr, /to start a site here/, "a package.json without src/kit.ts: the root of something else");
    assert.equal(run(["placeholder", "--help"], dir).status, 0);
    assert.doesNotMatch(run(["shot", "/"], dir).stderr, /no src\/kit\.ts/, "shot needs a build, not the registry: its own message");
    assert.equal(run(["placeholder", "x.svg", "8", "8"], dir).status, 0, "placeholder runs anywhere");
    assert.equal(run(["optimize-webp", "nope.webp"], dir).status, 2);
    assert.match(run(["optimize-webp", "nope.webp"], dir).stderr, /nope\.webp: no such file or folder/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("assemble runs in any folder and, without a standalone build, says how to make one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "no-standalone-"));
  try {
    const r = run(["assemble"], dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^assemble: no standalone build \(no server\.js under \.next\/standalone\) — set output: "standalone" in next\.config and run next build first\n$/);
    assert.equal(run(["assemble", "--chek"], dir).status, 2, "a wrong flag is a usage error");
    assert.match(run(["assemble", "--chek"], dir).stderr, /did you mean --check\?/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a --json report larger than a pipe's buffer reaches the reader whole, though the command exits right after printing it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "big-report-"));
  try {
    // two captures of 1500 animation inventories, every one different: a report of several hundred KB, printed and then process.exit()
    for (const [label, inventory] of [["a", "[]"], ["b", '[{"type":"CSSTransition","name":"opacity","duration":300}]']]) {
      const capture = path.join(dir, ".parity/visual", label);
      fs.mkdirSync(capture, { recursive: true });
      fs.writeFileSync(path.join(capture, "meta.json"), '{"scheme":"light"}');
      for (let i = 0; i < 1500; i++) fs.writeFileSync(path.join(capture, `page-${i}@390.animations.json`), inventory);
    }
    const r = run(["visual-parity", "compare", "a", "b", "--json"], dir);
    assert.equal(r.status, 1, r.stderr);
    assert.ok(r.stdout.length > 65536, `the report is larger than a pipe's 64 KB (${r.stdout.length} bytes)`);
    const report = JSON.parse(r.stdout);
    assert.equal(report.files.length, 1500);
    assert.equal(report.summary.changed, 1500);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a family inside a family: icons round lists its three actions, each has its help, a wrong one is named", () => {
  const family = run(["icons", "round", "--help"]);
  assert.equal(family.status, 0);
  assert.match(family.stdout, /^agentic-cms icons round <new \| publish \| retire> …\n/);
  assert.match(family.stdout, /\n {2}new {22}writes \.parity\/lab\/rounds\/<round>\//);
  assert.match(run(["icons", "round", "publish", "--help"]).stdout, /^agentic-cms icons round publish <round> --pick <role=letter,…>/);
  assert.match(run(["icons", "--help"]).stdout, /\n {2}round {20}a design round for a set of icons/);
  const wrong = run(["icons", "round", "publsh", "x"]);
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /icons: icons round has no subcommand publsh — did you mean publish\? \(new, publish, retire\)/);
});
