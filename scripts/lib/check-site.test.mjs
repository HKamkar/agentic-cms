import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CONFIG_FILE } from "./check-components.mjs";
import { baselineSite, checkSite, configAdded, formatBaselineReport, formatSiteReport, LAB_HEADER, machineAddresses, mergeBase, SiteCheckError } from "./check-site.mjs";

const KIT = path.resolve(import.meta.dirname, "../..");

/** A site tree in memory, `{ path: text }`, behind the calls the check makes (and the one --baseline writes with); the root lists too. */
function memfs(files) {
  const dirs = new Set(["", ...Object.keys(files).flatMap((file) => file.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/")))]);
  const rel = (p) => path.relative("/site", p).split(path.sep).join("/");
  const parent = (p) => (p.includes("/") ? path.posix.dirname(p) : "");
  return {
    existsSync: (p) => rel(p) in files || dirs.has(rel(p)),
    writeFileSync: (p, text) => { files[rel(p)] = text; },
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
  assert.deepEqual(formatSiteReport(report), ["check-components: ok (ui 1, sections 0 in 0 folders; 0 inherited)", "check-site: ok (package.json's gates, CI on pull requests, the site's own tools, the example's leftovers; 0 round routes; exceptions not compared: not a git checkout, so the exceptions added since the merge base are not compared)"]);
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

test("exceptions: guardEmail turned off since the base is listed with its reason; one already off at the base is not", async () => {
  const on = 'export const site = {\n  email: "hello@ours.dev",\n  guardEmail: true,\n};\n';
  const off = on.replace("true", '{ off: "printed on every invoice, as the law asks" }');
  const files = { ...CLEAN, "package.json": JSON.stringify({ name: "ours", scripts: { lint: LINT, build: BUILD.replace(" && agentic-cms guard-email", "") } }), "src/config/site.ts": off };
  const report = await site(files, { git: fakeGit({ files: { [CONFIG_FILE]: CLEAN[CONFIG_FILE], "src/config/site.ts": on } }) });
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.added, [{ kind: "guardEmail off", name: "src/config/site.ts", reason: "printed on every invoice, as the law asks" }]);
  assert.match(formatSiteReport(report).join("\n"), /\+ guardEmail off src\/config\/site\.ts — printed on every invoice, as the law asks/);
  const kept = await site(files, { git: fakeGit({ files: { [CONFIG_FILE]: CLEAN[CONFIG_FILE], "src/config/site.ts": off.replace("as the law asks", "the law") } }) });
  assert.deepEqual(kept.added, [], "the reason reworded is the same exception");
});

test("configAdded reads a config of any age: nothing at the base is everything added", () => {
  assert.deepEqual(configAdded({}, { exceptions: { a: "why" }, owners: { tags: { "src/x.tsx": "the adapter" } }, allow: [{ rule: "r", files: ["f"], reason: "y" }, { rule: "r", files: "not a list" }] }), [
    { kind: "exceptions", name: "a", reason: "why" },
    { kind: "owners.tags", name: "src/x.tsx", reason: "the adapter" },
    { kind: "allow r", name: "f", reason: "y" },
  ]);
  assert.deepEqual(configAdded({ allow: [{ rule: "r", files: ["f"] }] }, { allow: [{ rule: "s", files: ["f"], reason: "z" }] }), [{ kind: "allow s", name: "f", reason: "z" }], "the same file under another rule is another exception");
});

test("scripts: the lint and the build hold the gates; guard-email among them when site.ts turns guardEmail on (D5), and an off says why", async () => {
  const scripts = (lint, build, siteTs = CLEAN["src/config/site.ts"]) => site({ ...CLEAN, "package.json": JSON.stringify({ name: "ours", scripts: { lint, build } }), "src/config/site.ts": siteTs }).then((r) => r.findings.map((f) => f.problem));
  assert.deepEqual(await scripts("eslint; s=$?; agentic-cms check-components || s=1; exit $s", "agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo"), [
    '"lint" runs no agentic-cms check-site: the lint is ESLint, then the site check, failing on either while both report',
    '"build" runs no pnpm lint as a step of its && chain',
  ]);
  assert.deepEqual(await scripts(LINT, BUILD.replace(" && agentic-cms guard-email", "")), [], "an address in site.ts without the key: a site from before it builds as it did");
  const guarded = 'export const site = {\n  email: "hello@ours.dev",\n  guardEmail: true,\n};\n';
  assert.deepEqual(await scripts(LINT, BUILD, guarded), []);
  assert.deepEqual(await scripts(LINT, BUILD.replace(" && agentic-cms guard-email", ""), guarded), ['"build" runs no agentic-cms guard-email as a step of its && chain (src/config/site.ts turns guardEmail on: guard-email keeps the address out of every served file)']);
  assert.deepEqual(await scripts(LINT, BUILD.replace(" && agentic-cms guard-email", ""), guarded.replace("true", '{ off: "printed on every invoice, as the law asks" }')), [], "an address public on purpose");
  const bare = await site({ ...CLEAN, "src/config/site.ts": guarded.replace("true", "false") });
  assert.deepEqual(checks(bare.findings), ["scripts src/config/site.ts"]);
  assert.match(bare.findings[0].problem, /turns guardEmail off with no reason/);
  assert.match(bare.findings[0].fix, /guardEmail: \{ off: "<why>" \}/);
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

test("leftovers: the example's brand by line and its sample content, each a finding of its rule; none in the kit, whose example is the example", async () => {
  const files = { ...CLEAN, "content/blog/pages-are-files.md": "---\ntitle: Pages are files\n---\n", "public/images/brand/mark.svg": '<svg xmlns="http://www.w3.org/2000/svg"><title>Acme</title></svg>\n' };
  const report = await site(files);
  assert.deepEqual(report.findings.map(({ check, rule, file }) => `${check} ${rule} ${file}`), ["leftovers example-content content/blog/pages-are-files.md", "leftovers example-brand public/images/brand/mark.svg:1"]);
  assert.match(formatSiteReport(report).join("\n"), /✗ content\/blog\/pages-are-files\.md {2}\[leftovers\]\n {4}one of the example's posts, at the path the example shipped it\n {4}→ replace it with the site's own, or delete it, its pictures with it; a live URL is retired/);
  const kit = await site({ ...files, "package.json": JSON.stringify({ name: "agentic-cms", scripts: { lint: LINT, build: BUILD } }), ".github/workflows/verify.yml": VERIFY.replace("pnpm exec agentic-cms init . --agent-files --check", "pnpm hygiene") });
  assert.deepEqual(checks(kit.findings), []);
});

/** A site that took 0.8.2 with a round made by hand and a leftover post, and the baseline it wrote. */
const ADOPTED = { ...CLEAN, "src/app/promo-demo/page.tsx": "export default function Page() { return null; }\n", "content/blog/pages-are-files.md": "---\ntitle: Pages are files\n---\n" };
const withList = (baseline, config = JSON.parse(CLEAN[CONFIG_FILE])) => JSON.stringify({ ...config, baseline });
const held = (file, rule, count, reason = "") => ({ file, rule, count, reason });

test("baseline: the site check's rules held while their count does; past it each stays, under it the entry asks to shrink; an entry that does not read fails, one with no reason warns", async () => {
  const list = [held("src/app/promo-demo", "rounds", 1), held("content/blog/pages-are-files.md", "example-content", 1, "the launch post, until its successor is written")];
  const quiet = await site({ ...ADOPTED, [CONFIG_FILE]: withList(list) });
  assert.deepEqual(checks(quiet.findings), []);
  assert.deepEqual(quiet.baseline, { entries: 2, held: 2 });
  assert.deepEqual(quiet.warnings.map(({ check, problem }) => `${check}: ${problem}`), ["baseline: 1 baseline entry says no reason yet: src/app/promo-demo (rounds)"]);
  assert.match(formatSiteReport(quiet).join("\n"), /check-site: ok \(.*; the baseline: 2 entries, 2 findings of the site check's held\)/);
  const grown = await site({ ...ADOPTED, "src/app/sale-demo/page.tsx": "export default function Page() { return null; }\n", [CONFIG_FILE]: withList(list) });
  assert.deepEqual(checks(grown.findings), ["rounds src/app/sale-demo"], "another round made by hand is no entry's");
  const shrunk = await site({ ...CLEAN, [CONFIG_FILE]: withList(list) });
  assert.deepEqual(shrunk.findings.map(({ check, file, problem }) => `${check} ${file}: ${problem.split(":")[0]}`), ["baseline src/app/promo-demo: the baseline holds 1 of rounds here and 0 are left (or the file is gone)", "baseline content/blog/pages-are-files.md: the baseline holds 1 of example-content here and 0 are left (or the file is gone)"]);
  const unread = await site({ ...ADOPTED, [CONFIG_FILE]: withList([...list, held("src/x.tsx", "agentic-cms/motion", 1)]) });
  assert.deepEqual(unread.findings.map(({ check, file }) => `${check} ${file}`), ["baseline src/x.tsx"]);
  assert.match(unread.findings[0].problem, /a preferred rule, which a baseline never holds/);
});

test("baseline against the merge base: the pull request that takes 0.8.2 lists the whole list as added; after it, an entry added or raised fails", async () => {
  const list = [held("src/app/promo-demo", "rounds", 1), held("src/components/ui/Footer.tsx", "agentic-cms/email", 1)];
  const files = { ...ADOPTED, "src/components/ui/Footer.tsx": "export function Footer() { return null; }\n", "content/blog/pages-are-files.md": undefined };
  delete files["content/blog/pages-are-files.md"];
  const first = await site({ ...files, [CONFIG_FILE]: withList(list) }, { git: fakeGit({ files: { [CONFIG_FILE]: CLEAN[CONFIG_FILE] } }) });
  assert.deepEqual(checks(first.findings), []);
  assert.deepEqual(first.added, [{ kind: "baseline", name: "src/app/promo-demo", rules: ["rounds ×1"], reason: "" }, { kind: "baseline", name: "src/components/ui/Footer.tsx", rules: ["agentic-cms/email ×1"], reason: "" }]);
  assert.match(formatSiteReport(first).join("\n"), /\+ baseline src\/components\/ui\/Footer\.tsx \(agentic-cms\/email ×1\) — no reason/);
  const later = await site({ ...files, [CONFIG_FILE]: withList([...list, held("src/components/ui/Nav.tsx", "agentic-cms/copy", 2)]) }, { git: fakeGit({ files: { [CONFIG_FILE]: withList([held("src/app/promo-demo", "rounds", 1), held("src/components/ui/Footer.tsx", "agentic-cms/email", 2)]) } }) });
  assert.deepEqual(later.findings.map(({ check, file, problem }) => `${check} ${file}: ${problem}`), ["exceptions src/components/ui/Nav.tsx: added to the baseline (agentic-cms/copy ×2) since origin/HEAD: the baseline only shrinks, and takes no new bypass", "baseline src/components/ui/Nav.tsx: the baseline holds 2 of agentic-cms/copy here and 0 are left (or the file is gone): an entry that holds more than its file has lets a new one in unseen"]);
  const raised = await site({ ...files, [CONFIG_FILE]: withList(list) }, { git: fakeGit({ files: { [CONFIG_FILE]: withList([]) } }) });
  assert.deepEqual(checks(raised.findings), ["exceptions src/app/promo-demo", "exceptions src/components/ui/Footer.tsx"], "a new site's empty list takes nothing");
});

/** The engines' findings as --baseline reads them from the site's ESLint: each a rule, a file and a line. */
const engines = (...found) => async () => found.map(([file, rule]) => ({ check: rule, rule, file, problem: `No ${rule.split("/")[1]} of the site's own` }));

test("--baseline: the first time the whole list, the config's other bytes kept; then only ever shrunk, growth refused and each reason kept", async () => {
  const config = '{\n  "motion": null,\n  "patterns": null,\n  "exceptions": { "src/app/feed.xml": "the RSS feed, written from the posts" }\n}\n';
  const files = { ...ADOPTED, "src/components/ui/Footer.tsx": "export function Footer() { return null; }\n", [CONFIG_FILE]: config };
  const first = await baselineSite({ root: "/site", fs: memfs(files), git: fakeGit({ repo: false }), components: PASS, engines: engines(["src/app/layout.tsx:12", "agentic-cms/head"], ["src/components/ui/Footer.tsx:40", "agentic-cms/email"], ["src/components/ui/Footer.tsx:44", "agentic-cms/email"]) });
  assert.equal(first.written, true);
  assert.equal(first.first, true);
  assert.deepEqual(first.baseline, [held("content/blog/pages-are-files.md", "example-content", 1), held("src/app/layout.tsx", "agentic-cms/head", 1), held("src/app/promo-demo", "rounds", 1), held("src/components/ui/Footer.tsx", "agentic-cms/email", 2)]);
  assert.ok(files[CONFIG_FILE].startsWith(config.replace(/\n\}\n$/, ",\n  \"$baseline\": ")), files[CONFIG_FILE]);
  assert.deepEqual([first.refused, first.remaining], [[], []]);
  const text = formatBaselineReport(first).join("\n");
  assert.match(text, /^check-site --baseline: wrote the first baseline into src\/config\/components\.json: 4 entries, 5 findings/);
  assert.match(text, /\n {2}src\/components\/ui\/Footer\.tsx {2}agentic-cms\/email ×2\n {4}src\/components\/ui\/Footer\.tsx:40 {2}No email of the site's own\n {4}src\/components\/ui\/Footer\.tsx:44/);
  const after = await site(files);
  assert.deepEqual(checks(after.findings), [], "the site check holds what it wrote");

  files[CONFIG_FILE] = files[CONFIG_FILE].replace('"reason": "" }\n  ]', '"reason": "the footer, until the address moves to the e-mail engine" }\n  ]');
  delete files["src/app/promo-demo/page.tsx"];
  const shrunk = await baselineSite({ root: "/site", fs: memfs(files), git: fakeGit({ repo: false }), components: PASS, engines: engines(["src/app/layout.tsx:12", "agentic-cms/head"], ["src/components/ui/Footer.tsx:40", "agentic-cms/email"], ["src/components/ui/Nav.tsx:3", "agentic-cms/copy"]) });
  assert.deepEqual(shrunk.baseline, [held("content/blog/pages-are-files.md", "example-content", 1), held("src/app/layout.tsx", "agentic-cms/head", 1), held("src/components/ui/Footer.tsx", "agentic-cms/email", 1, "the footer, until the address moves to the e-mail engine")]);
  assert.deepEqual(shrunk.removed.map((e) => e.file), ["src/app/promo-demo"]);
  assert.deepEqual(shrunk.shrunk.map((e) => `${e.file} ${e.count}→${e.to}`), ["src/components/ui/Footer.tsx 2→1"]);
  assert.deepEqual(shrunk.refused.map((e) => `${e.file} ${e.rule} ${e.count}→${e.found}`), ["src/components/ui/Nav.tsx agentic-cms/copy 0→1"]);
  assert.deepEqual(JSON.parse(files[CONFIG_FILE]).baseline, shrunk.baseline, "written, shrunk, and nothing new in it");
  const said = formatBaselineReport(shrunk).join("\n");
  assert.match(said, /− src\/app\/promo-demo {2}rounds: none left, the entry is gone\n {2}↓ src\/components\/ui\/Footer\.tsx {2}agentic-cms\/email: 2 → 1/);
  assert.match(said, /refused 1 entry: the baseline only shrinks, and takes nothing new\n\n {2}✗ src\/components\/ui\/Nav\.tsx {2}agentic-cms\/copy: 1 here, and the baseline holds 0 \(no entry\)/);
  const same = await baselineSite({ root: "/site", fs: memfs(files), git: fakeGit({ repo: false }), components: PASS, engines: engines(["src/app/layout.tsx:12", "agentic-cms/head"], ["src/components/ui/Footer.tsx:40", "agentic-cms/email"]) });
  assert.equal(same.written, false);
  assert.match(formatBaselineReport(same)[0], /src\/config\/components\.json unchanged — 3 entries, 3 findings/);
});

test("--baseline takes none of the gates' and the config's findings: they stay, named, until fixed", async () => {
  const files = { ...ADOPTED, "package.json": JSON.stringify({ name: "ours", scripts: { lint: "eslint", build: BUILD, test: "node --test" } }) };
  const result = await baselineSite({ root: "/site", fs: memfs(files), git: fakeGit({ repo: false }), components: PASS, engines: engines() });
  assert.deepEqual(result.baseline.map((e) => e.rule), ["example-content", "rounds"]);
  assert.deepEqual(checks(result.remaining), ["scripts package.json"]);
  assert.match(formatBaselineReport(result).join("\n"), /check-site: 1 problem no baseline takes, which fail until fixed \(docs\/migrating-to-0\.8\.2\.md § 1\)/);
});
