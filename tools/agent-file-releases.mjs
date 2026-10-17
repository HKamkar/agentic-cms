#!/usr/bin/env node
// Writes scripts/lib/agent-file-releases.json, the kit's agent files at every
// release as `init` lays them out in a site (templates/site/rules/ as
// .claude/rules/, the two skills trees): each file's hash per version, each
// distinct text once. `init --agent-files` reads it for a file the manifest
// records no base for, which the site wrote before the manifest did: the
// kit's text at the version the site was on is where that file came from,
// and a site has no git history of the kit to find it in (lib/init.mjs). The
// versions are the v<x.y.z> tags, and the package's own version from the
// working tree while it has no tag (the release commit), so a release
// carries its own texts and the tag it gets changes nothing. `--check` exits
// 1 when the file is stale and 2 when this checkout lacks a tag the record
// has (tools/hygiene.mjs and CI run it).
//
//   node tools/agent-file-releases.mjs           rewrites it (pnpm agent-files:releases)
//   node tools/agent-file-releases.mjs --check   exits 1 when it is out of date
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { AGENT_DIRS, RELEASES, renderAgentFiles, sha } from "../scripts/lib/init.mjs";

const ABOUT = "the kit's agent files at every release, written by tools/agent-file-releases.mjs from the v* tags; do not edit by hand";
const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const semver = (tag) => tag.slice(1).split(".").map(Number);
const bySemver = (a, b) => { const [x, y] = [semver(a), semver(b)]; return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

/** The release tags, v<x.y.z>, oldest first. */
export const releaseTags = (root) => git(root, "tag", "--list", "v*").split("\n").filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag)).sort(bySemver);

/** The agent files a tag holds, as a site's paths: [{ file, text }], each blob read once across tags (`blobs`). */
function filesAt(root, tag, blobs) {
  const out = [];
  for (const [from, to] of Object.entries(AGENT_DIRS)) {
    for (const line of git(root, "ls-tree", "-r", tag, "--", from).split("\n").filter(Boolean)) {
      const [, blob, rel] = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/) ?? [];
      if (!blob) continue;
      if (!blobs.has(blob)) blobs.set(blob, git(root, "cat-file", "blob", blob));
      out.push({ file: `${to}${rel.slice(from.length)}`, text: blobs.get(blob) });
    }
  }
  return out;
}

/** The record from releases [{ version, files: [{ file, text }] }]: { about, versions, texts }, a release without agent files left out. */
export function recordOf(releases) {
  const versions = {};
  const texts = {};
  for (const { version, files } of releases) {
    if (!files.length) continue;
    versions[version] = {};
    for (const { file, text } of [...files].sort((a, b) => (a.file < b.file ? -1 : 1))) {
      versions[version][file] = sha(text);
      texts[sha(text)] ??= text;
    }
  }
  return { about: ABOUT, versions, texts };
}

/** The record as the repository at root says it: every release tag, then the package's version from the working tree while it has no tag. */
export function releasesRecord(root) {
  const blobs = new Map();
  const tags = releaseTags(root);
  const releases = tags.map((tag) => ({ version: tag.slice(1), files: filesAt(root, tag, blobs) }));
  const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (!tags.includes(`v${version}`)) releases.push({ version, files: renderAgentFiles(root) });
  return recordOf(releases);
}

export const recordText = (record) => JSON.stringify(record, null, 1) + "\n";

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const root = path.resolve(import.meta.dirname, "..");
  const file = path.join(root, RELEASES);
  const record = releasesRecord(root);
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { versions: {} };
    const untagged = Object.keys(current.versions).filter((version) => !(version in record.versions));
    if (untagged.length) { console.error(`agent-file-releases: ${RELEASES} has ${untagged.join(", ")}, which this checkout has no tag for — git fetch --tags (CI checks out with fetch-depth: 0)`); process.exit(2); }
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== recordText(record)) { console.error(`agent-file-releases: ${RELEASES} is out of date — run pnpm agent-files:releases and commit the result`); process.exit(1); }
    console.log(`agent-file-releases: ${RELEASES} is up to date (${Object.keys(record.versions).length} releases)`);
  } else {
    fs.writeFileSync(file, recordText(record));
    console.log(`agent-file-releases: wrote ${Object.keys(record.versions).length} releases, ${Object.keys(record.texts).length} texts, to ${RELEASES}`);
  }
}
