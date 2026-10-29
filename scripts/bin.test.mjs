// The bin the way an agent meets it: the map by family, a wrong command
// answered with the nearest one, a command run outside a site's root refused
// with the fix, a stray value after a repeatable flag explained.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const BIN = path.resolve(import.meta.dirname, "../bin/agentic-cms.mjs");
const run = (args, cwd = process.cwd()) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });

test("the help is the map by family, one line per command, and names the exit codes", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^usage: agentic-cms <command> \[options\]/);
  assert.match(r.stdout, /\n {2}content\s+lint · check · status · docs\n/);
  assert.match(r.stdout, /\n {2}lab\s+lab <new\|serve\|route\|render\|clean>\n/);
  assert.match(r.stdout, /\n {2}site\s+init · setup · urls · serve\n/);
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
    assert.match(r.stderr, /^agentic-cms lint: no src\/kit\.ts here — run it in the site's root \(where package\.json, src\/kit\.ts and content\/ are\); to start a site here, agentic-cms init \. --name "<Site>"\n$/);
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

test("check-components: the kit's example passes; a stray section file is a finding with its fix, in text and JSON; no config is exit 2", () => {
  const ok = run(["check-components"]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^check-components: ok \(ui \d+, sections \d+ in 6 folders; 5 inherited; 2 allowed, each with its reason\)\n$/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guard-cli-"));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
  try {
    const none = run(["check-components"], dir);
    assert.equal(none.status, 2);
    assert.match(none.stderr, /^check-components: no src\/config\/components\.json here — the guard is not set up in this site/);
    write("src/config/components.json", JSON.stringify({ motion: null, patterns: null }));
    // The site's ESLint config spreads the preset with the same options: the guard reads the required rules' settings from it.
    const url = (file) => JSON.stringify(pathToFileURL(file).href);
    const react = createRequire(createRequire(import.meta.url).resolve("eslint-config-next")).resolve("eslint-plugin-react");
    write("eslint.config.mjs", `import react from ${url(react)};\nimport { componentRules } from ${url(path.join(import.meta.dirname, "lib/component-lint.mjs"))};\nexport default [{ plugins: { react } }, ...componentRules({ motion: null, patterns: null })];\n`);
    write("src/components/README.md", "## `Button`\n");
    write("src/components/ui/Button.tsx", "export function Button() { return null; }\n");
    write("src/components/sections/render.tsx", 'import { Hero } from "@/components/sections/Hero";\n');
    write("src/components/sections/Hero.tsx", "export function Hero() { return null; }\n");
    write("src/app/layout.tsx", "export default function Layout() { return null; }\n");
    assert.equal(run(["check-components"], dir).status, 0);
    write("src/components/sections/Promo.tsx", "export function Promo() { return null; }\n");
    const found = run(["check-components"], dir);
    assert.equal(found.status, 1);
    assert.match(found.stderr, /^check-components: 1 problem\n\n {2}✗ src\/components\/sections\/Promo\.tsx {2}\[registry\]\n {4}a component in a section folder that the registry does not import\n {4}→ a section folder holds the components the registry renders: register it in src\/components\/sections\/render\.tsx/);
    const json = run(["check-components", "--json"], dir);
    assert.equal(json.status, 1);
    assert.deepEqual(JSON.parse(json.stdout).findings.map((f) => [f.check, f.file]), [["registry", "src/components/sections/Promo.tsx"]]);
    fs.rmSync(path.join(dir, "src/components/sections/Promo.tsx"));
    write("eslint.config.mjs", fs.readFileSync(path.join(dir, "eslint.config.mjs"), "utf8").replace("})];", '}), { files: ["src/app/**"], rules: { "agentic-cms/head": "off" } }];'));
    const replaced = run(["check-components", "--json"], dir);
    assert.equal(replaced.status, 1, "a later block that turns a required rule off fails the guard");
    assert.deepEqual(JSON.parse(replaced.stdout).findings.map((f) => [f.check, f.file]), [["preset", "src/app/page.tsx"], ["preset", "src/app/sample-demo/page.tsx"]]);
    write("src/config/components.json", JSON.stringify({ sectons: ["sections"] }));
    assert.match(run(["check-components"], dir).stderr, /no option sectons — did you mean sections\?/);
    assert.match(run(["check-components", "--jsn"], dir).stderr, /did you mean --json\?/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("check-site: the kit's example passes; a site without its gates is a finding with its fix, in text and JSON; no config and a --base with no history are exit 2", () => {
  const ok = run(["check-site", "--base", "HEAD"]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^check-components: ok \(ui \d+, sections \d+ in 6 folders; 5 inherited; 2 allowed, each with its reason\)\ncheck-site: ok \(package\.json's gates, CI on pull requests; 0 round routes; 0 exceptions added since HEAD \([0-9a-f]{7}\)\)\n$/, "the kit's own scripts are its commands, so no tools clause");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-cli-"));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
  try {
    const none = run(["check-site"], dir);
    assert.equal(none.status, 2);
    assert.match(none.stderr, /^check-site: no src\/config\/components\.json here — the guard is not set up in this site/);
    write("src/config/components.json", JSON.stringify({ motion: null, patterns: null, sections: [] }));
    const url = (file) => JSON.stringify(pathToFileURL(file).href);
    const react = createRequire(createRequire(import.meta.url).resolve("eslint-config-next")).resolve("eslint-plugin-react");
    write("eslint.config.mjs", `import react from ${url(react)};\nimport { componentRules } from ${url(path.join(import.meta.dirname, "lib/component-lint.mjs"))};\nexport default [{ plugins: { react } }, ...componentRules({ motion: null, patterns: null, sections: [] })];\n`);
    write("src/components/README.md", "## `Button`\n");
    write("src/components/ui/Button.tsx", "export function Button() { return null; }\n");
    write("src/app/layout.tsx", "export default function Layout() { return null; }\n");
    write("package.json", JSON.stringify({ name: "ours", scripts: { lint: "eslint", build: "next build" } }));
    write("scripts/shots.mjs", 'import { chromium } from "playwright";\n');
    const found = run(["check-site"], dir);
    assert.equal(found.status, 1, found.stdout);
    assert.match(found.stderr, /^check-components: ok \(ui 1, sections 0 in 0 folders; 0 inherited\)\ncheck-site: 3 problems \(exceptions not compared: not a git checkout, so the exceptions added since the merge base are not compared\)\n\n {2}✗ package\.json {2}\[scripts\]\n {4}"lint" runs no agentic-cms check-site/);
    assert.match(found.stderr, /✗ \.github\/workflows\/verify\.yml {2}\[ci\]\n {4}no workflow runs on pull requests/);
    assert.match(found.stderr, /check-site: 1 warning, which fail nothing: the kit's command, or the site's own with its reason\n\n {2}⚠ scripts\/shots\.mjs {2}\[tools\]/);
    const json = run(["check-site", "--json"], dir);
    assert.equal(json.status, 1);
    const report = JSON.parse(json.stdout);
    assert.deepEqual(report.findings.map((f) => [f.check, f.file]), [["scripts", "package.json"], ["scripts", "package.json"], ["ci", ".github/workflows/verify.yml"]]);
    assert.deepEqual([report.base, report.added, report.warnings.map((w) => w.check)], [null, [], ["tools"]]);
    const asked = run(["check-site", "--base", "main"], dir);
    assert.equal(asked.status, 2);
    assert.equal(asked.stderr, "check-site: --base main: not a git checkout\n");
    assert.match(run(["check-site", "--bse", "main"], dir).stderr, /did you mean --base\?/);
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
    // the reader's own buffer past the 1 MB default: every line on stderr carries its cause line under it
    const r = spawnSync(process.execPath, [BIN, "visual-parity", "compare", "a", "b", "--json"], { cwd: dir, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
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

test("init: a new site needs its name — without --name, or with an empty one, it exits 2 and writes nothing; a site that has content/ needs none", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "init-cli-"));
  try {
    const site = path.join(dir, "my-site");
    const nameless = run(["init", site]);
    assert.equal(nameless.status, 2);
    assert.equal(nameless.stderr, 'init: a new site needs its name, as it is spelled: --name "<Site>" (agentic-cms init my-site --name "My Site"); nothing was written\n');
    assert.ok(!fs.existsSync(site), "nothing written");
    for (const args of [["--name", "  "], ["--light-only"], ["--url", "https://my-site.com"]]) {
      const r = run(["init", site, ...args]);
      assert.equal(r.status, 2, args.join(" "));
      assert.match(r.stderr, args[0] === "--name" ? /^init: --name is empty: give the site's name, as it is spelled \(agentic-cms init my-site --name "My Site"\); nothing was written$/m : /^init: a new site needs its name/m);
      assert.ok(!fs.existsSync(site), `${args.join(" ")}: nothing written`);
    }
    assert.equal(run(["init", site, "--name", "My Site", "--json"]).status, 0);
    const again = run(["init", site]);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /^init: content\/ was there: the site's own content, pictures, site\.ts and forms\.ts are left as they are \(the starter is for a new site\)$/m);
    assert.match(run(["init", site, "--name", "Other"]).stdout, /\(the starter is for a new site\), and --name names nothing here$/m);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("init --agent-files --check: a new site is clean; an AGENTS.md past 32 KiB is named with its size and exits 1", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "init-cli-"));
  try {
    const site = path.join(dir, "site");
    assert.equal(run(["init", site, "--name", "Site", "--json"]).status, 0);
    const clean = run(["init", site, "--agent-files", "--check"]);
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /agent files as the kit ships them/);
    fs.appendFileSync(path.join(site, "AGENTS.md"), `\n${"x".repeat(33 * 1024)}\n`);
    const big = run(["init", site, "--agent-files", "--check"]);
    assert.equal(big.status, 1);
    assert.match(big.stderr, /^too big {3}AGENTS\.md \(size\) — \d+ bytes, Codex reads 32768$/m);
    assert.match(big.stdout, /too big: AGENTS\.md is past what Codex reads/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("init --agent-files --check: a rule whose kit block the site took apart without a required block, and settings without the kit's plugins, fail, naming each and where the kit has it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "init-cli-"));
  try {
    const site = path.join(dir, "site");
    assert.equal(run(["init", site, "--name", "Site", "--json"]).status, 0);
    const rule = path.join(site, ".claude/rules/seo.md");
    fs.writeFileSync(rule, fs.readFileSync(rule, "utf8").split("\n").filter((line) => !line.startsWith("- **Tier:**") && !line.startsWith("<!-- agentic-cms:")).join("\n"));
    const settings = path.join(site, ".claude/settings.json");
    fs.writeFileSync(settings, JSON.stringify({ ...JSON.parse(fs.readFileSync(settings, "utf8")), enabledPlugins: {} }));
    const check = run(["init", site, "--agent-files", "--check"]);
    assert.equal(check.status, 1);
    assert.match(check.stderr, /^modified, required gone {2}\.claude\/rules\/seo\.md — the marks around the kit's block are gone, so a refresh cannot bring its lines in — gone from the site's file, as node_modules\/agentic-cms\/templates\/site\/rules\/seo\.md has it:\n {2}line \d+: - \*\*Tier:\*\* SEO, .{40,}…$/m);
    assert.match(check.stderr, /^stale +\.claude\/settings\.json — the kit's enabledPlugins\["editorial@agentic-cms"\], enabledPlugins\["design@agentic-cms"\]$/m);
    assert.match(check.stdout, /modified, required gone: a rule whose kit block the site took apart lost what the kit marks required/);
    const refresh = run(["init", site, "--agent-files"]);
    assert.equal(refresh.status, 0, refresh.stderr);
    assert.match(refresh.stdout, /\(1 without a block the kit requires\)/);
    assert.match(refresh.stderr, /^init: \.claude\/rules\/seo\.md is kept as the site edited it, without what the kit marks required/m);
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(settings, "utf8")).enabledPlugins), ["editorial@agentic-cms", "design@agentic-cms"], "the kit's keys set again");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("init --agent-files: --diff and --accept, 0.8's hand merge, are deprecated and do nothing; the modes go with --agent-files, one at a time", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "init-cli-"));
  try {
    const site = path.join(dir, "site");
    assert.equal(run(["init", site, "--name", "Site", "--json"]).status, 0);
    fs.appendFileSync(path.join(site, ".claude/rules/seo.md"), "\n- The site's own line.\n");
    const before = fs.readFileSync(path.join(site, ".agentic-cms.json"), "utf8");
    for (const mode of ["--diff", "--accept"]) {
      const deprecated = run(["init", site, "--agent-files", mode, ".claude/rules/seo.md"]);
      assert.equal(deprecated.status, 0, deprecated.stderr);
      assert.equal(deprecated.stdout, "");
      assert.match(deprecated.stderr, new RegExp(`^init: ${mode} is deprecated since 0\\.9\\.0 and goes in the next breaking release: nothing is merged by hand now`, "m"));
    }
    assert.equal(fs.readFileSync(path.join(site, ".agentic-cms.json"), "utf8"), before, "nothing written");
    const clean = run(["init", site, "--agent-files", "--check"]);
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /^init: \d+ agent files in line with the kit — \d+ as it ships them, 1 with the site's own lines or paths beside the kit's \(modified\)$/m);
    assert.match(run(["init", site, "--accept", ".claude/rules/seo.md"]).stderr, /^init: --accept goes with --agent-files$/m);
    const both = run(["init", site, "--agent-files", "--check", "--accept", ".claude/rules/seo.md"]);
    assert.equal(both.status, 2);
    assert.match(both.stderr, /^init: --check and --accept are separate runs: one at a time$/m);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("visual-parity clean keeps the newest captures, takes the compares of the ones it removes, leaves a running capture, and --dry-run removes nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-clean-cli-"));
  const put = (file, hoursAgo) => { const full = path.join(dir, ".parity/visual", file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, "{}"); const t = new Date(Date.now() - hoursAgo * 3600e3); fs.utimesSync(full, t, t); };
  try {
    for (const [label, hours] of [["old", 30], ["mid", 20], ["new", 1]]) { put(`${label}/meta.json`, hours); put(`${label}/capture.json`, hours); }
    put("running/meta.json", 0.1);
    put("old-vs-new/report.json", 1);
    put("mid-vs-new/report.json", 1);
    const dry = run(["visual-parity", "clean", "--keep", "1", "--dry-run", "--json"], dir);
    assert.equal(dry.status, 0, dry.stderr);
    assert.deepEqual(JSON.parse(dry.stdout).removed, ["mid", "mid-vs-new", "old", "old-vs-new"]);
    assert.ok(fs.existsSync(path.join(dir, ".parity/visual/old")), "--dry-run removes nothing");
    const done = run(["visual-parity", "clean", "--keep", "1"], dir);
    assert.equal(done.status, 0, done.stderr);
    assert.match(done.stdout, /clean: 4 removed, [\d.]+ MB freed; 2 kept/);
    assert.deepEqual(fs.readdirSync(path.join(dir, ".parity/visual")).sort(), ["new", "running"]);
    assert.equal(run(["visual-parity", "clean", "--keep", "-1"], dir).status, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("visual-parity proof: its help names the passes and the ref; a wrong choice or a wrong flag is a usage error", () => {
  const help = run(["visual-parity", "proof", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--ref <git ref>/);
  assert.match(help.stdout, /--motion/);
  assert.match(help.stdout, /--all/);
  assert.equal(run(["visual-parity", "proof", "--scheme", "sepia"]).status, 2);
  const wrong = run(["visual-parity", "proof", "--motoin"]);
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /did you mean --motion\?/);
});

test("probe takes --json like every command that prints JSON: the flag parses, and the run goes on to its own checks", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-json-"));
  try {
    const r = run(["probe", "/", "--select", ".card", "--motion", "--json"], dir);
    assert.equal(r.status, 2);
    assert.doesNotMatch(r.stderr, /unknown flag/);
    assert.match(r.stderr, /^probe: no production build: run `pnpm build` first/m, "past the parser, at the missing build");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("visual-parity proof --build runs its baseline step (no three-sources refusal), and --pages with --sample is refused before any capture", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "proof-build-"));
  try {
    const r = run(["visual-parity", "proof", "--build", "--ref", "nope"], dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /nope: not a commit, branch or tag/, "the baseline capture ran and stopped at the ref");
    assert.doesNotMatch(r.stderr, /three sources/);
    const both = run(["visual-parity", "proof", "--pages", "/", "--sample", "1"], dir);
    assert.equal(both.status, 2);
    assert.match(both.stderr, /^visual-parity proof: --pages and --sample both choose the pages of a capture; pass one\n$/, "nothing else ran");
    for (const [flag, value] of [["--pages", "/"], ["--sample", "1"]]) {
      const every = run(["visual-parity", "proof", "--all-pages", flag, value], dir);
      assert.equal(every.status, 2);
      assert.match(every.stderr, new RegExp(`^visual-parity proof: --all-pages and ${flag} both choose the pages of a capture; pass one\\n$`), "refused before any capture");
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/** Two servers listening on the loopback for a command to find up: a spawned command connects while the test waits on it, so the kernel accepts. */
const listening = () => Promise.all([0, 1].map(() => new Promise((resolve) => { const server = net.createServer((socket) => socket.end()); server.listen(0, "127.0.0.1", () => resolve(server)); })));

test("urls: this machine's URLs and its origins, --write fills .env.local once, a server with no lock here is not this clone's, no dev port is a usage error", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "urls-cli-"));
  const servers = await listening();
  const [dev, lab] = servers.map((s) => String(s.address().port));
  try {
    assert.equal(run(["urls"], dir).status, 2);
    assert.match(run(["urls"], dir).stderr, /^urls: no dev port — package\.json's scripts\.dev runs no next dev here; pass --port\n$/);
    assert.match(run(["urls", "--no-publc"], dir).stderr, /did you mean --no-public\?/);
    fs.writeFileSync(path.join(dir, ".env.example"), "# kept\nALLOWED_DEV_ORIGINS=\n");
    const written = run(["urls", "--no-public", "--port", dev, "--lab-port", lab, "--write"], dir);
    assert.equal(written.status, 0, written.stderr);
    assert.match(written.stdout, new RegExp(`^dev server, port ${dev}: answers, but not as this clone's next dev \\(\\.next/dev/lock names none on it\\)`), "another checkout's server, as far as this one can tell");
    assert.doesNotMatch(written.stdout, /restart/, "and nobody is asked to restart it");
    assert.match(written.stdout, new RegExp(`\nlab, port ${lab}: running, each scene at /scene/<name>\n`));
    assert.match(written.stdout, /public {5}not looked up \(--no-public\)/);
    const report = JSON.parse(run(["urls", "--no-public", "--port", dev, "--lab-port", lab, "--json"], dir).stdout);
    assert.deepEqual([report.dev.up, report.dev.own, report.dev.ownPort], [true, false, null]);
    assert.equal(report.addresses.publicLookedUp, false);
    assert.deepEqual(report.origins.missing, [], "written once: covered on the next run");
    if (report.addresses.lan.length) assert.equal(fs.readFileSync(path.join(dir, ".env.local"), "utf8"), `# kept\nALLOWED_DEV_ORIGINS=${report.addresses.lan.join(",")}\n`);
    else assert.ok(!fs.existsSync(path.join(dir, ".env.local")), "no LAN address: nothing to write");
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ scripts: { dev: `next dev -p ${dev}` } }));
    fs.mkdirSync(path.join(dir, ".next/dev"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".next/dev/lock"), JSON.stringify({ pid: process.pid, port: Number(dev) }));
    assert.match(run(["urls", "--no-public", "--lab-port", lab], dir).stdout, new RegExp(`^dev server, port ${dev}: running\n {2}localhost {2}http://localhost:${dev}\n`), "the port from scripts.dev, this clone's next dev by its lock (a live pid, the port)");
  } finally { for (const s of servers) s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("serve: no dev port and a port something else holds are usage errors, named with the fix; nothing is started or stopped", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "serve-cli-"));
  const servers = await listening();
  const [held, lab] = servers.map((s) => String(s.address().port));
  try {
    const bare = run(["serve", "--no-public"], dir);
    assert.equal(bare.status, 2);
    assert.match(bare.stderr, /^serve: no dev port: package\.json's scripts\.dev runs no next dev here; pass --port\n$/);
    assert.match(run(["serve", "--fix-cach"], dir).stderr, /unknown flag --fix-cach — did you mean --fix-cache\?/);
    assert.match(run(["serve", "--help"]).stdout, /--write-origins {10}add the addresses ALLOWED_DEV_ORIGINS lacks to \.env\.local before next dev starts/);
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ scripts: { dev: `next dev -p ${held}` } }));
    const refused = run(["serve", "--no-public", "--lab-port", lab], dir);
    assert.equal(refused.status, 2, refused.stderr);
    assert.match(refused.stderr, new RegExp(`serve: port ${held} answers, but not as this site's next dev \\(\\.next/dev/lock names none running\\): stop what holds it \\(docs/dev-server\\.md § Stopping a server\\), or pass --port <another>\n$`));
    assert.ok(!fs.existsSync(path.join(dir, ".env.local")), "no --write-origins: .env.local untouched");
    await new Promise((resolve) => servers[0].close(resolve));
    const bare2 = run(["serve", "--no-public", "--lab-port", lab], dir);
    assert.equal(bare2.status, 2, bare2.stderr);
    assert.match(bare2.stderr, /serve: next is not installed here: pnpm install \(or bash scripts\/setup\.sh\) first\n$/, "the port free, no next to start: the fix");
  } finally { for (const s of servers) s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("setup: --engines takes the kit's engines only; --check writes nothing and prints its report as JSON", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-cli-"));
  const servers = await listening();
  const [dev, lab] = servers.map((s) => String(s.address().port));
  try {
    const wrong = run(["setup", "--engines", "chromium,firefox"], dir);
    assert.equal(wrong.status, 2);
    assert.match(wrong.stderr, /^setup: --engines is a list of chromium, webkit, not chromium,firefox; run agentic-cms setup --help\n$/);
    assert.match(run(["setup", "--help"]).stdout, /--deps {19}on Linux, install WebKit's system libraries/);
    const bare = run(["setup", "--check", "--no-browsers", "--no-public", "--json", "--lab-port", lab], dir);
    assert.equal(bare.status, 2, "no package.json here");
    assert.equal(JSON.parse(bare.stdout).steps.at(-1).detail, "no package.json here: run setup in the site's root");
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "site", scripts: { dev: `next dev -p ${dev}` } }));
    fs.writeFileSync(path.join(dir, ".env.example"), "ALLOWED_DEV_ORIGINS=\n");
    const r = run(["setup", "--check", "--no-browsers", "--no-public", "--json", "--lab-port", lab], dir);
    assert.ok([0, 1].includes(r.status), r.stderr);
    const report = JSON.parse(r.stdout);
    assert.equal(report.check, true);
    assert.deepEqual(report.steps.map((s) => s.step), ["node", "pnpm", "browsers", "env", "origins", "dev port", "verify"]);
    assert.match(report.steps.find((s) => s.step === "dev port").detail, new RegExp(`^${dev} answers, but not as this clone's next dev: pnpm dev needs the port`), "a server with no lock here is another's");
    assert.deepEqual([report.urls.dev.up, report.urls.dev.own], [true, false]);
    assert.match(r.stderr, /setup --check: what this clone has, changing nothing/, "the progress on stderr, the report alone on stdout");
    assert.deepEqual(fs.readdirSync(dir).sort(), [".env.example", "package.json"], "--check wrote nothing");
  } finally { for (const s of servers) s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
