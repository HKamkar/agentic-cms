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
