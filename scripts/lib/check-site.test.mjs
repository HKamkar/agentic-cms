import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CONFIG_FILE } from "./check-components.mjs";
import { checkSite, configAdded, formatSiteReport, LAB_HEADER, machineAddresses, mergeBase, SiteCheckError } from "./check-site.mjs";

const KIT = path.resolve(import.meta.dirname, "../..");

/** A site tree in memory, `{ path: text }`, behind the three calls the check makes; the root lists too. */
function memfs(files) {
  const dirs = new Set(["", ...Object.keys(files).flatMap((file) => file.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/")))]);
  const rel = (p) => path.relative("/site", p).split(path.sep).join("/");
  const parent = (p) => (p.includes("/") ? path.posix.dirname(p) : "");
  return {
    existsSync: (p) => rel(p) in files || dirs.has(rel(p)),
    readFileSync: (p) => { if (!(rel(p) in files)) throw Object.assign(new Error(`ENOENT: ${rel(p)}`), { code: "ENOENT" }); return files[rel(p)]; },
    readdirSync: (p, opts) => {
      const dir = rel(p);
      if (!dirs.has(dir)) throw Object.assign(new Error(`ENOENT: ${dir}`), { code: "ENOENT" });
      const names = [...new Set([...Object.keys(files), ...dirs].filter((entry) => entry && parent(entry) === dir).map((entry) => path.posix.basename(entry)))].sort();
      return opts?.withFileTypes ? names.map((name) => ({ name, isDirectory: () => dirs.has(dir ? `${dir}/${name}` : name) })) : names;
    },
  };
}

/** git as a checkout answers it: `refs` resolve, the merge base with any of them is `commit`, `files` is the tree at it. */
function fakeGit({ refs = ["origin/HEAD"], commit = "b".repeat(40), files = {}, shallow = false, repo = true, head = true } = {}) {
  const calls = [];
  const git = (args) => {
    calls.push(args.join(" "));
    const ok = (stdout) => ({ status: 0, stdout: `${stdout}\n` });
    const no = { status: 128, stdout: "" };
    const [command, ...rest] = args;
    if (command === "rev-parse" && rest[0] === "--is-inside-work-tree") return repo ? ok("true") : no;
    if (command === "rev-parse" && rest[0] === "--is-shallow-repository") return ok(String(shallow));
    if (command === "rev-parse" && rest[0] === "--verify") { const ref = rest[2].replace(/\^\{commit\}$/, ""); return (ref === "HEAD" ? head : refs.includes(ref)) ? ok("c".repeat(40)) : no; }
    if (command === "merge-base") return refs.includes(rest[1]) && !shallow ? ok(commit) : no;
    if (command === "show") { const file = rest[0].split(":./")[1]; return file in files ? { status: 0, stdout: files[file] } : no; }
    return no;
  };
  return Object.assign(git, { calls });
}

const LINT = "eslint; s=$?; agentic-cms check-site || s=1; exit $s";
const BUILD = "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email";
const VERIFY = "on:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@abc\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm lint\n      - run: pnpm test\n      - run: pnpm build\n      - run: pnpm exec agentic-cms init . --agent-files --check\n";
/** A site that holds every pass: its gates in package.json and CI, an address in site.ts, nothing of its own the kit has a command for. */
const CLEAN = {
  [CONFIG_FILE]: JSON.stringify({ motion: null, patterns: null, exceptions: { "src/app/feed.xml": "the RSS feed, written from the posts" } }),
  "package.json": JSON.stringify({ name: "ours", scripts: { lint: LINT, build: BUILD, test: "node --test" } }),
  "src/config/site.ts": 'export const site = { name: "Ours", email: "hello@ours.dev" };\n',
  ".github/workflows/verify.yml": VERIFY,
  "src/app/layout.tsx": "export default function Layout() { return null; }\n",
  "src/components/ui/Button.tsx": "export function Button() { return null; }\n",
  "next.config.ts": "const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(\",\");\nexport default { images: { unoptimized: true } };\n",
  "scripts/setup.sh": "#!/usr/bin/env bash\nexec pnpm exec agentic-cms setup \"$@\"\n",
};
const PASS = async () => ({ config: CONFIG_FILE, layers: { motion: null, ui: 1, patterns: null, sections: 0, sectionFolders: 0 }, inherited: 0, candidates: [], disables: [], allowed: [], findings: [], warnings: [] });
const site = (files, { git = fakeGit({ repo: false }), env = {}, base, components = PASS } = {}) => checkSite({ root: "/site", fs: memfs(files), git, env, base, components });
const checks = (entries) => entries.map(({ check, file }) => `${check} ${file}`);

test("a site that holds every pass: no finding, no warning, one line, and the reason nothing was compared", async () => {
  const report = await site(CLEAN);
  assert.deepEqual([...report.findings, ...report.warnings], [], formatSiteReport(report).join("\n"));
  assert.equal(report.history, "not a git checkout, so the exceptions added since the merge base are not compared");
  assert.deepEqual(formatSiteReport(report), ["check-components: ok (ui 1, sections 0 in 0 folders; 0 inherited)", "check-site: ok (package.json's gates, CI on pull requests, the site's own tools; 0 round routes; exceptions not compared: not a git checkout, so the exceptions added since the merge base are not compared)"]);
});

test("the components pass runs first, with the config read once; its findings are the site check's, in their own part of the report", async () => {
  let given;
  const components = async ({ root, config }) => { given = { root, config }; return { ...(await PASS()), findings: [{ check: "registry", file: "src/components/sections/Stray.tsx", problem: "p", fix: "f" }] }; };
  const report = await site(CLEAN, { components });
  assert.deepEqual(given, { root: "/site", config: JSON.parse(CLEAN[CONFIG_FILE]) });
  assert.deepEqual(checks(report.findings), ["registry src/components/sections/Stray.tsx"]);
  const lines = formatSiteReport(report);
  assert.equal(lines[0], "check-components: 1 problem");
  assert.match(lines.at(-1), /^check-site: ok \(/, "the site's own passes held");
});

test("rounds: a *-demo route demo new did not write fails, the lab's own passes, and a round's pictures go with its route", async () => {
  const report = await site({
    ...CLEAN,
    "src/app/hero-demo/page.tsx": "// Candidate route\n", "src/app/hero-demo/demo.json": "{}",
    "src/app/promo-demo/page.tsx": "export default function Page() { return <h1>Hand made</h1>; }\n",
    "src/app/lab-demo/page.tsx": `${LAB_HEADER}: every scene\n`,
    "public/images/hero-demo/a.webp": "webp",
    "public/images/old-demo/b.webp": "webp",
  });
  assert.deepEqual(checks(report.findings), ["rounds src/app/promo-demo", "rounds public/images/old-demo"]);
  assert.match(report.findings[0].problem, /a \*-demo route `demo new` did not write \(no demo\.json\)/);
  assert.match(report.findings[0].fix, /agentic-cms demo new promo --section <type>/);
  assert.match(report.findings[1].problem, /src\/app\/old-demo is gone/);
  assert.equal(report.rounds, 3);
  const fake = await site({ ...CLEAN, "src/app/lab-demo/page.tsx": "// my own lab\n" });
  assert.deepEqual(checks(fake.findings), ["rounds src/app/lab-demo"], "a lab-demo route lab route did not write is a round made by hand");
});

test("the lab's header is the first line lab route writes", () => {
  assert.ok(fs.readFileSync(path.join(KIT, "templates/lab-demo/page.tsx"), "utf8").startsWith(LAB_HEADER));
});

test("mergeBase: the base named, the pull request's, origin/HEAD; and each checkout without the history says why", () => {
  const commit = "a".repeat(40);
  assert.deepEqual(mergeBase({ git: fakeGit({ refs: ["origin/HEAD", "origin/develop"], commit }), env: { GITHUB_BASE_REF: "develop" } }), { ref: "origin/develop", commit });
  assert.deepEqual(mergeBase({ git: fakeGit({ refs: ["origin/HEAD", "release"], commit }), base: "release" }), { ref: "release", commit });
  assert.deepEqual(mergeBase({ git: fakeGit({ refs: ["origin/HEAD"], commit }), env: { GITHUB_BASE_REF: "develop" } }), { ref: "origin/HEAD", commit }, "a base branch not fetched falls through");
  assert.deepEqual(mergeBase({ git: fakeGit({ refs: ["main"], commit }) }), { ref: "main", commit });
  assert.throws(() => mergeBase({ git: fakeGit(), base: "nope" }), (error) => error instanceof SiteCheckError && /--base nope: no commit or branch of that name here/.test(error.message));
  assert.match(mergeBase({ git: fakeGit({ repo: false }) }).note, /^not a git checkout/);
  assert.match(mergeBase({ git: fakeGit({ head: false }) }).note, /^no commit yet/);
  assert.match(mergeBase({ git: fakeGit({ refs: [] }) }).note, /^no base branch here \(origin\/HEAD, origin\/main, main\), so .* --base <ref> names one$/);
  assert.match(mergeBase({ git: fakeGit({ refs: [], shallow: true }) }).note, /^a shallow checkout \(CI's checkout takes the history with fetch-depth: 0\)/);
  assert.match(mergeBase({ git: fakeGit({ shallow: true }) }).note, /^a shallow checkout/);
  assert.throws(() => mergeBase({ git: fakeGit({ repo: false }), base: "main" }), (error) => error instanceof SiteCheckError && error.message === "--base main: not a git checkout", "a base asked for must be found");
  assert.throws(() => mergeBase({ git: fakeGit({ refs: ["main"], shallow: true }), base: "main" }), /--base main: a shallow checkout/);
});

test("exceptions: every one added since the base is listed with its reason, an ignores glob needs its $ignores, and the frozen list only shrinks", async () => {
  const before = { exceptions: { "src/app/feed.xml": "the feed" }, owners: { forms: { "src/components/ui/form/Form.tsx": "the renderer" } }, allow: [{ rule: "agentic-cms/icons", files: ["src/components/ui/Placeholder.tsx"], reason: "the box" }], inherited: ["src/components/blog/Old.tsx"] };
  const now = { ...before, exceptions: { ...before.exceptions, "src/app/api/hook": "a webhook the CRM calls" }, owners: { ...before.owners, images: { "src/components/ui/Media.tsx": "the picture primitive" } }, allow: [{ ...before.allow[0], files: ["src/components/ui/Placeholder.tsx", "src/components/ui/Logo.tsx"] }], ignores: ["src/legacy/**"], inherited: ["src/components/blog/Old.tsx", "src/components/blog/New.tsx"] };
  const sources = {
    "src/components/ui/Card.tsx": "// eslint-disable-next-line agentic-cms/copy -- the brand's mark, set in its own type\nexport const A = 1;\n// eslint-disable-next-line react-hooks/exhaustive-deps\nconst b = 2;\n",
    "src/components/ui/Moved.tsx": "\n\n// eslint-disable-next-line agentic-cms/icons -- the map's pins\nexport const C = 1;\n",
  };
  const git = fakeGit({ files: { [CONFIG_FILE]: JSON.stringify(before), "src/components/ui/Moved.tsx": "// eslint-disable-next-line agentic-cms/icons -- the map's pins\nexport const C = 1;\n" } });
  const report = await site({ ...CLEAN, ...sources, [CONFIG_FILE]: JSON.stringify(now) }, { git });
  assert.deepEqual(report.base, { ref: "origin/HEAD", commit: "b".repeat(40) });
  assert.deepEqual(report.added, [
    { kind: "exceptions", name: "src/app/api/hook", reason: "a webhook the CRM calls" },
    { kind: "owners.images", name: "src/components/ui/Media.tsx", reason: "the picture primitive" },
    { kind: "allow agentic-cms/icons", name: "src/components/ui/Logo.tsx", reason: "the box" },
    { kind: "ignores", name: "src/legacy/**", reason: "" },
    { kind: "inline disable", name: "src/components/ui/Card.tsx:1", rules: ["agentic-cms/copy"], reason: "the brand's mark, set in its own type" },
    { kind: "inline disable", name: "src/components/ui/Card.tsx:3", rules: ["react-hooks/exhaustive-deps"], reason: "" },
  ], "a disable that moved is not new");
  assert.deepEqual(checks(report.findings), ["exceptions src/legacy/**", "exceptions src/components/blog/New.tsx"]);
  assert.match(report.findings[0].problem, /an ignores glob added since origin\/HEAD with no reason/);
  assert.match(report.findings[1].problem, /added to the frozen "inherited" list since origin\/HEAD: the list only shrinks/);
  const text = formatSiteReport(report).join("\n");
  assert.match(text, /check-site: 2 problems \(6 exceptions added since origin\/HEAD \(bbbbbbb\)\)/);
  assert.match(text, /The exceptions added since origin\/HEAD, each with its reason:\n {2}\+ exceptions src\/app\/api\/hook — a webhook the CRM calls\n/);
  assert.match(text, /\+ inline disable src\/components\/ui\/Card\.tsx:3 \(react-hooks\/exhaustive-deps\) — no reason/);
  const reasoned = await site({ ...CLEAN, [CONFIG_FILE]: JSON.stringify({ ...now, inherited: before.inherited, $ignores: "the old pages, moved file by file onto the engine" }) }, { git });
  assert.deepEqual(checks(reasoned.findings), [], "an ignores glob with its reason passes, listed");
  assert.equal(reasoned.added.find((entry) => entry.kind === "ignores").reason, "the old pages, moved file by file onto the engine");
  const adopted = await site({ ...CLEAN, [CONFIG_FILE]: JSON.stringify({ inherited: ["src/components/blog/Post.tsx"] }) }, { git: fakeGit() });
  assert.deepEqual(checks(adopted.findings), [], "a config new since the base adopts its frozen list");
});

test("configAdded reads a config of any age: nothing at the base is everything added", () => {
  assert.deepEqual(configAdded({}, { exceptions: { a: "why" }, owners: { tags: { "src/x.tsx": "the adapter" } }, allow: [{ rule: "r", files: ["f"], reason: "y" }, { rule: "r", files: "not a list" }] }), [
    { kind: "exceptions", name: "a", reason: "why" },
    { kind: "owners.tags", name: "src/x.tsx", reason: "the adapter" },
    { kind: "allow r", name: "f", reason: "y" },
  ]);
  assert.deepEqual(configAdded({ allow: [{ rule: "r", files: ["f"] }] }, { allow: [{ rule: "s", files: ["f"], reason: "z" }] }), [{ kind: "allow s", name: "f", reason: "z" }], "the same file under another rule is another exception");
});

test("scripts: the lint and the build hold the gates; guard-email is the site's own step until D5's switch turns it on", async () => {
  const scripts = (lint, build, siteTs = CLEAN["src/config/site.ts"]) => site({ ...CLEAN, "package.json": JSON.stringify({ name: "ours", scripts: { lint, build } }), "src/config/site.ts": siteTs }).then((r) => r.findings.map((f) => f.problem));
  assert.deepEqual(await scripts("eslint; s=$?; agentic-cms check-components || s=1; exit $s", "agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo"), [
    '"lint" runs no agentic-cms check-site: the lint is ESLint, then the site check, failing on either while both report',
    '"build" runs no pnpm lint as a step of its && chain',
  ]);
  assert.deepEqual(await scripts(LINT, BUILD.replace(" && agentic-cms guard-email", "")), [], "an address in site.ts, and no guard asked for it yet");
  assert.deepEqual(await scripts("eslint || true", "next build && agentic-cms seo && pnpm lint && agentic-cms lint --production && agentic-cms docs --check && agentic-cms guard-email || true"), [
    '"lint" runs no agentic-cms check-site: the lint is ESLint, then the site check, failing on either while both report',
    '"lint" turns a failure into a pass',
    '"build" runs pnpm lint, agentic-cms lint --production, agentic-cms docs --check on the wrong side of next build',
    '"build" turns a failure into a pass',
  ]);
  const none = await site({ ...CLEAN, "package.json": "{ not json" });
  assert.deepEqual(checks(none.findings), ["scripts package.json"]);
});

test("ci: a workflow on pull requests runs the lint (or a build that runs it), the tests, the build and the agent-file check", async () => {
  const ci = (files) => site({ ...CLEAN, ".github/workflows/verify.yml": undefined, ...files }).then((r) => r.findings.map((f) => `${f.file}: ${f.problem}`));
  const without = (...runs) => VERIFY.split("\n").filter((line) => !runs.some((run) => line.endsWith(`run: ${run}`))).join("\n");
  const files = (text) => Object.fromEntries(Object.entries({ ".github/workflows/verify.yml": text }).filter(([, value]) => value !== undefined));
  assert.deepEqual(await site({ ...CLEAN, ".github/workflows/verify.yml": without("pnpm lint") }).then((r) => r.findings), [], "the build runs the lint");
  assert.deepEqual(await ci(files(without("pnpm test", "pnpm exec agentic-cms init . --agent-files --check"))), [".github/workflows/verify.yml: CI runs no the tests, the agent-file check on pull requests"]);
  const { [".github/workflows/verify.yml"]: dropped, ...noCi } = CLEAN;
  assert.ok(dropped);
  assert.deepEqual(await site(noCi).then((r) => checks(r.findings)), ["ci .github/workflows/verify.yml"]);
  assert.deepEqual(await site({ ...noCi, ".github/workflows/release.yml": VERIFY.replace("  pull_request:\n", "") }).then((r) => checks(r.findings)), ["ci .github/workflows/verify.yml"], "a workflow that never runs on a pull request holds nothing before a merge");
  assert.deepEqual(await site({ ...noCi, ".github/workflows/checks.yaml": VERIFY.replace("on:\n  pull_request:\n  push:\n    branches: [main]", "on: [pull_request]"), ".github/workflows/broken.yml": "on: [\n" }).then((r) => checks(r.findings)), ["ci .github/workflows/broken.yml"], "any workflow name; one that does not read is named");
  const kit = { ...CLEAN, "package.json": JSON.stringify({ name: "agentic-cms", scripts: { lint: LINT.replace("agentic-cms check-site", "node bin/agentic-cms.mjs check-site"), build: BUILD } }), ".github/workflows/verify.yml": without("pnpm exec agentic-cms init . --agent-files --check").replace("run: pnpm build", "run: pnpm build\n      - run: pnpm hygiene") };
  assert.deepEqual(await site(kit).then((r) => r.findings), [], "the kit's own repository checks its agent files through its hygiene");
});

test("tools: the site's own Playwright, sharp over public/ and next dev scripts and a machine's address in next.config warn, naming the kit's command; an allow entry with its reason quiets each", async () => {
  const tools = {
    "scripts/shots.mjs": 'import { chromium } from "playwright";\nawait chromium.launch();\n',
    "scripts/og.py": "from playwright.sync_api import sync_playwright\n",
    "scripts/resize.mjs": 'import sharp from "sharp";\nawait sharp(path.join(root, "public", "images", "a.png")).webp().toFile("b.webp");\n',
    "scripts/dev.sh": "#!/bin/sh\nnext dev -H 0.0.0.0 -p 8000\n",
    "scripts/serve.mjs": 'spawn("next", ["dev", "-p", "8000"]);\n',
    "scripts/data.mjs": 'import sharp from "sharp";\nawait sharp("in.png").toFile("out.png");\n',
    "next.config.ts": "// the VM was 192.0.2.10\nconst nextConfig = {\n  allowedDevOrigins: [\"127.0.0.1\", \"198.51.100.7\"],\n};\nexport default nextConfig;\n",
  };
  const report = await site({ ...CLEAN, ...tools });
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.warnings.map((w) => `${w.file}: ${w.problem}`), [
    "scripts/dev.sh: a script of the site's own that starts next dev",
    "scripts/og.py: a script of the site's own that drives a headless browser of its own (Playwright)",
    "scripts/resize.mjs: a script of the site's own that runs sharp over public/",
    "scripts/serve.mjs: a script of the site's own that starts next dev",
    "scripts/shots.mjs: a script of the site's own that drives a headless browser of its own (Playwright)",
    "next.config.ts:3: names a machine's address (198.51.100.7): the origins the dev server allows are each machine's, not the site's",
  ]);
  assert.match(report.warnings[0].fix, /^agentic-cms serve: .*; a site that keeps its own says why: "allow": \[\{ "rule": "agentic-cms\/site-tools", "files": \["scripts\/dev\.sh"\], "reason": "<why>" \}\]/);
  assert.match(report.warnings[1].fix, /^agentic-cms shot, probe and sheet/);
  assert.match(report.warnings[2].fix, /^agentic-cms placeholder for a placeholder picture, agentic-cms optimize-webp/);
  assert.match(report.warnings[5].fix, /^agentic-cms urls --write puts this machine's addresses in ALLOWED_DEV_ORIGINS/);
  const text = formatSiteReport(report).join("\n");
  assert.match(text, /check-site: ok \(.*\)\n\ncheck-site: 6 warnings, which fail nothing: the kit's command, or the site's own with its reason\n\n {2}⚠ scripts\/dev\.sh {2}\[tools\]/);
  const allow = [{ rule: "agentic-cms/site-tools", files: ["scripts/*.mjs", "scripts/*.py", "scripts/dev.sh"], reason: "the OG cards and the LAN server predate the kit's commands" }, { rule: "agentic-cms/site-tools", files: ["next.config.ts", "scripts/gone.mjs"], reason: "the staging box's address" }];
  const quiet = await site({ ...CLEAN, ...tools, [CONFIG_FILE]: JSON.stringify({ ...JSON.parse(CLEAN[CONFIG_FILE]), allow }) });
  assert.deepEqual(quiet.warnings, []);
  assert.deepEqual(checks(quiet.findings), ["tools scripts/gone.mjs"], "an allow entry that names no file the check reads");
  const kit = await site({ ...CLEAN, ...tools, "package.json": JSON.stringify({ name: "agentic-cms", scripts: { lint: LINT, build: BUILD } }) });
  assert.deepEqual(kit.warnings, [], "the kit's own scripts are its commands");
});

test("machineAddresses: an IPv4 address in the code, loopback, 0.0.0.0, a version and a comment line left out", () => {
  assert.deepEqual(machineAddresses('const a = "203.0.113.4";\n// 192.0.2.1\n * 192.0.2.2\nconst v = "1.2.3";\nconst l = ["127.0.0.1", "0.0.0.0"];\nconst b = "http://198.51.100.20:3000";\n'), [{ line: 1, address: "203.0.113.4" }, { line: 6, address: "198.51.100.20" }]);
});
