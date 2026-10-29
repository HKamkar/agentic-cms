#!/usr/bin/env node
// The release workflow's logic (.github/workflows/release.yml,
// docs/releasing.md), here so that it is tested and runs the same on a
// laptop: Node's builtins, git, pnpm and the npm CLI, nothing installed.
//
//   node tools/release.mjs check [--tag <vX.Y.Z[-rc.N]>]     the run's version, its dist-tag and the rules a tag must meet; with no tag, a dry run's
//   node tools/release.mjs integrity <tarball>              its sha512, as npm writes it (sha512-<base64>)
//   node tools/release.mjs publish <tarball> --integrity <sri> --tag <next|latest> [--dry-run]
//   node tools/release.mjs notes <version>                  the GitHub Release's text, from CHANGELOG.md
//   node tools/release.mjs wait <name>@<version>            until the registry serves the version
//   node tools/release.mjs smoke <version|file:tarball>     a site from the registry: init, install with no build approval for the kit, build, lint, test
//   node tools/release.mjs audit <version>                  npm audit signatures over an install of the version with npm
//
// `check` and `publish` write their results to $GITHUB_OUTPUT when the
// workflow sets it. Exit 0 done, 1 a rule broken, 2 usage or environment.
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
/** The floors of npm's trusted publishing: the npm CLI and Node that exchange the workflow's OIDC token. */
export const FLOORS = { npm: "11.5.1", node: "22.14.0" };

/** A tag's version and kind: `v0.9.0` a release, `v0.9.0-rc.1` a candidate; null for any other form. */
export function parseTag(tag) {
  const m = /^v(\d+\.\d+\.\d+)(?:-rc\.(\d+))?$/.exec(tag ?? "");
  return m ? { version: tag.slice(1), candidate: m[2] !== undefined } : null;
}

/** The dist-tag a version goes to: a candidate (any prerelease) to `next`, a release to `latest`. */
export const distTag = (version) => (version.includes("-") ? "next" : "latest");

/** Whether `version` is at least `floor`, comparing major, minor and patch (a prerelease suffix is ignored). */
export function atLeast(version, floor) {
  const parts = (v) => v.replace(/^v/, "").split("-")[0].split(".").map(Number);
  const [a, b] = [parts(version), parts(floor)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/**
 * The rules a run must meet; [] when it may go on. A tag names the version
 * package.json holds, in a release's or a candidate's form; a release sits on
 * main's history and its CHANGELOG.md section exists, a candidate sits on
 * develop's. A dry run (no tag) checks the version alone.
 */
export function tagFindings({ tag, version, onMain, onDevelop, changelog }) {
  const out = [];
  if (!/^\d+\.\d+\.\d+(?:-rc\.\d+)?$/.test(version)) out.push(`package.json's version ${version} is neither a release (X.Y.Z) nor a candidate (X.Y.Z-rc.N)`);
  if (tag === undefined) return out;
  const parsed = parseTag(tag);
  if (!parsed) return [...out, `the tag ${tag} is neither vX.Y.Z nor vX.Y.Z-rc.N`];
  if (parsed.version !== version) out.push(`the tag ${tag} is not package.json's version, ${version}: the release commit sets the version, then the tag names it`);
  if (parsed.candidate && !onDevelop) out.push(`the candidate ${tag} is not on develop's history: tag a commit of develop`);
  if (!parsed.candidate && !onMain) out.push(`the release ${tag} is not on main's history: tag the merge of the release pull request`);
  if (!parsed.candidate && !changelogSection(changelog, parsed.version)) out.push(`CHANGELOG.md has no "## [${parsed.version}]" section: the release commit writes it`);
  return out;
}

/** A version's section of CHANGELOG.md, its heading left out; null when there is none. */
export function changelogSection(text, version) {
  const lines = (text ?? "").split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) return null;
  const end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
}

/** The GitHub Release's text: the version's section; a candidate without one takes Unreleased's, else a line saying where its changes are. */
export function releaseNotes(changelog, version) {
  const own = changelogSection(changelog, version);
  if (own) return own;
  const base = version.split("-")[0];
  const pending = changelogSection(changelog, base) ?? changelogSection(changelog, "Unreleased");
  return pending ? `A release candidate of ${base}. Its changes so far:\n\n${pending}` : `A release candidate of ${base}; CHANGELOG.md gets its lines with the release.`;
}

/** A file's sha512 as npm's `dist.integrity` writes it. */
export const integrity = (buffer) => `sha512-${crypto.createHash("sha512").update(buffer).digest("base64")}`;

/** The registry's answer to `npm view <name>@<version> dist.integrity --json`: "absent", "same" or "different" from the tarball's. */
export function registryState({ status, stdout, stderr }, expected) {
  if (status !== 0) {
    if (/\bE404\b/.test(stderr)) return "absent";
    throw new Error(`npm view failed: ${stderr.trim().split("\n").slice(-3).join(" ")}`);
  }
  const text = stdout.trim();
  if (!text) return "absent";
  return JSON.parse(text) === expected ? "same" : "different";
}

/** What `publish` does, given the registry's state: publish, skip a version the same tarball already published (the first one, by hand), or refuse. */
export function publishPlan(state, { name, version }) {
  if (state === "absent") return { publish: true, say: `${name}@${version} is not on the registry: publishing it` };
  if (state === "same") return { publish: false, say: `${name}@${version} is on the registry already, from this same tarball (a first publish by hand, docs/releasing.md): nothing to publish` };
  return { publish: false, fail: `${name}@${version} is on the registry from another tarball: a version is never published twice; tag the next candidate or patch (docs/releasing.md)` };
}

/**
 * The smoke site's package.json and workspace: the kit at the spec under
 * test (the published version), and no build approval for it, so an
 * install that passes proves the tarball builds nothing. init writes the
 * kit's git spec and its approval until its install line moves to npm.
 */
export function registrySite({ pkg, workspace }, spec) {
  return {
    pkg: { ...pkg, dependencies: { ...pkg.dependencies, "agentic-cms": spec } },
    workspace: workspace.split("\n").filter((line) => !/^\s+"?agentic-cms@/.test(line)).join("\n"),
  };
}

/** Appends `key=value` lines to $GITHUB_OUTPUT when the workflow sets it, and prints them. */
function output(values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
}

const git = (...args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
const onBranch = (branch) => git("merge-base", "--is-ancestor", "HEAD", `origin/${branch}`).status === 0;
const usage = (message) => { console.error(`release: ${message}`); return 2; };
const failWith = (lines) => { for (const line of lines) console.error(`release: ${line}`); return 1; };

function check(args) {
  const tag = args.includes("--tag") ? args[args.indexOf("--tag") + 1] : undefined;
  const { name, version } = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const found = tagFindings({ tag, version, onMain: tag !== undefined && onBranch("main"), onDevelop: tag !== undefined && onBranch("develop"), changelog });
  if (found.length) return failWith(found);
  output({ name, version, "dist-tag": distTag(version), prerelease: String(distTag(version) === "next"), node: fs.readFileSync(path.join(ROOT, ".nvmrc"), "utf8").trim(), tarball: `${name}-${version}.tgz` });
  console.error(tag ? `release: ${tag} is ${name}@${version}, for ${distTag(version)}` : `release: a dry run of ${name}@${version}, for ${distTag(version)}: nothing is published`);
  return 0;
}

function publish(args) {
  const [tarball] = args.filter((arg, i) => !arg.startsWith("--") && !["--integrity", "--tag"].includes(args[i - 1]));
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const [expected, tag, dryRun] = [flag("--integrity"), flag("--tag"), args.includes("--dry-run")];
  if (!tarball || !fs.existsSync(tarball) || !expected || !["next", "latest"].includes(tag)) return usage("publish <tarball> --integrity <sha512-…> --tag <next|latest> [--dry-run]");
  if (integrity(fs.readFileSync(tarball)) !== expected) return failWith([`${path.basename(tarball)} is not the tarball the check job proved: its sha512 differs`]);
  const npm = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
  const low = [!atLeast(npm, FLOORS.npm) && `npm ${npm} (trusted publishing needs ${FLOORS.npm} or later)`, !atLeast(process.version, FLOORS.node) && `Node ${process.version} (it needs ${FLOORS.node} or later)`].filter(Boolean);
  if (low.length) return usage(`${low.join(" and ")}: move .nvmrc to a Node whose npm meets both`);
  const { name, version } = JSON.parse(execFileSync("tar", ["-xzOf", tarball, "package/package.json"], { encoding: "utf8" }));
  let state;
  try { state = registryState(spawnSync("npm", ["view", `${name}@${version}`, "dist.integrity", "--json"], { encoding: "utf8" }), expected); } catch (error) { return usage(error.message); }
  const plan = publishPlan(state, { name, version });
  if (plan.fail) return failWith([plan.fail]);
  console.log(`release: ${plan.say}${dryRun && plan.publish ? " (a dry run: npm publish --dry-run uploads nothing)" : ""}`);
  if (plan.publish) {
    // Trusted publishing attaches the provenance attestation itself: no --provenance, which a dry run without a token would trip on.
    const published = spawnSync("npm", ["publish", tarball, "--tag", tag, "--access", "public", ...(dryRun ? ["--dry-run"] : [])], { stdio: "inherit" });
    if (published.status !== 0) return failWith([`npm publish ${dryRun ? "--dry-run " : ""}failed (its output is above)`]);
  }
  output({ published: String(plan.publish && !dryRun) });
  return 0;
}

function notes([version]) {
  if (!version) return usage("notes <version>");
  console.log(releaseNotes(fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8"), version));
  return 0;
}

/** Asks the registry for the version every ten seconds, five minutes at most: a fresh publish takes a moment to be served everywhere. */
function wait([spec]) {
  if (!spec?.includes("@", 1)) return usage("wait <name>@<version>");
  for (let attempt = 1; attempt <= 30; attempt++) {
    const view = spawnSync("npm", ["view", spec, "version"], { encoding: "utf8" });
    if (view.status === 0 && view.stdout.trim()) { console.log(`release: the registry serves ${spec}`); return 0; }
    spawnSync("sleep", ["10"]);
  }
  return failWith([`the registry does not serve ${spec} after five minutes`]);
}

/** Runs a step in cwd, its output shown; false when it failed, named on stderr. */
function step(command, args, cwd, env = {}) {
  console.log(`release: ${command} ${args.join(" ")}`);
  const r = spawnSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) console.error(`release: ${command} ${args.join(" ")} failed in ${cwd}`);
  return r.status === 0;
}

/** A site laid out by the published version's init in a temp folder, the kit installed from the registry with no build approval for it, then the site's CI build, its lint and its tests. */
function smoke([spec]) {
  if (!spec) return usage("smoke <version|file:tarball>");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-registry-"));
  const site = path.join(dir, "smoke");
  if (!step("pnpm", ["dlx", `agentic-cms@${spec}`, "init", "smoke", "--name", "Smoke"], dir)) return 1;
  const files = { pkg: path.join(site, "package.json"), workspace: path.join(site, "pnpm-workspace.yaml") };
  const next = registrySite({ pkg: JSON.parse(fs.readFileSync(files.pkg, "utf8")), workspace: fs.readFileSync(files.workspace, "utf8") }, spec);
  fs.writeFileSync(files.pkg, `${JSON.stringify(next.pkg, null, 2)}\n`);
  fs.writeFileSync(files.workspace, next.workspace);
  const ok = step("pnpm", ["install", "--no-frozen-lockfile"], site)
    && step("pnpm", ["build"], site, { AGENTIC_CMS_PLACEHOLDERS: "warn" })
    && step("pnpm", ["lint"], site)
    && step("pnpm", ["test"], site);
  if (!ok) return 1;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`release: a site from agentic-cms@${spec} installs with no build approval for the kit, builds, lints and tests`);
  return 0;
}

/** npm audit signatures over an install of the version with npm itself, whose tree it reads: every package's registry signature, and the attestations of each that has them. */
function audit([version]) {
  if (!version) return usage("audit <version>");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-audit-"));
  fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify({ name: "audit", private: true }, null, 2)}\n`);
  const ok = step("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", `agentic-cms@${version}`], dir) && step("npm", ["audit", "signatures"], dir);
  fs.rmSync(dir, { recursive: true, force: true });
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const [command, ...args] = process.argv.slice(2);
  const commands = { check, integrity: ([file]) => (file && fs.existsSync(file) ? (console.log(integrity(fs.readFileSync(file))), 0) : usage("integrity <tarball>")), publish, notes, wait, smoke, audit };
  process.exitCode = commands[command] ? commands[command](args) : usage(`no command ${command ?? ""}: ${Object.keys(commands).join(", ")}`);
}
