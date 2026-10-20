#!/usr/bin/env node
// Writes scripts/lib/example-files.json, what the kit's example shipped to a
// site, which `check-site`'s `leftovers` pass looks for (lib/leftovers.mjs):
// up to 0.8.1 `init` copied the example's content/ and public/ into every new
// site, and from 0.8.2 it copies none of them (the starter), so the list is
// every release's example up to 0.8.1 and stays as it is. From each tag's
// tree it takes:
//   - paths: the example's posts and its pages but the two the starter has
//     too (home, blog), which a site keeps at that path only from the example;
//   - files: every file's size and sha256 (a picture, a post, a page or a
//     collection file copied as it was, under any name), but the kit's own
//     docs and templates and the categories under content/, and any file
//     the starter ships too;
//   - entries: each entry of a collection file (a review, a use case, an FAQ,
//     an author) by the sha256 of its canonical JSON
//     (lib/leftovers.mjs canonical()), so one the site kept beside its own
//     is found.
// Needs the kit's tags (git fetch --tags); exit 1 when they are not there.
//
//   node tools/example-files.mjs           # writes the list
//   node tools/example-files.mjs --check   # exit 1 when the list differs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { collectionEntries, COLLECTION_FILE, EXAMPLE_FILES, LAST_EXAMPLE_RELEASE, NOT_SAMPLES, sha256 } from "../scripts/lib/leftovers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const STARTER = "templates/starter";
/** The starter's pages: a site has them from the starter, so their path names no leftover. */
const STARTER_PAGES = new Set(["content/pages/home.yaml", "content/pages/blog.yaml"]);

const git = (args, encoding = "utf8") => execFileSync("git", args, { cwd: ROOT, encoding, maxBuffer: 64 * 1024 * 1024 });
const version = (tag) => tag.slice(1).split(".").map(Number);
const newer = (a, b) => { const [x, y] = [version(a), version(b)]; for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

/** The release tags a site could have been laid out from: v0.2.0 (the first) to LAST_EXAMPLE_RELEASE. */
export function releaseTags(tags) {
  return tags.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag) && newer(tag, `v${LAST_EXAMPLE_RELEASE}`) <= 0).sort(newer);
}

/** Whether a path of the example's tree is a sample of it: under content/ or public/, none of NOT_SAMPLES, not skipped by the content engine. */
export const isSample = (file) => /^(?:content|public)\//.test(file) && !NOT_SAMPLES.some((re) => re.test(file)) && !file.split("/").some((part) => part.startsWith("_"));

/** Every file under the starter, by hash: a file the starter ships too is no leftover of the example. */
function starterHashes() {
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  return new Set(walk(STARTER).map((file) => sha256(fs.readFileSync(path.join(ROOT, file)))));
}

/** The list from each tag's tree: { $comment, releases, paths, files, entries }, sorted so a rerun writes the same bytes. */
export function exampleFiles(tags) {
  const starter = starterHashes();
  const blobs = new Map();
  const paths = new Set();
  const files = new Map();
  const entries = new Map();
  for (const tag of tags) {
    for (const line of git(["ls-tree", "-r", "-z", tag, "--", "content", "public"]).split("\0").filter(Boolean)) {
      const [meta, file] = line.split("\t");
      const blob = meta.split(" ")[2];
      if (!isSample(file)) continue;
      if (!blobs.has(blob)) blobs.set(blob, git(["cat-file", "blob", blob], "buffer"));
      const bytes = blobs.get(blob);
      const hash = sha256(bytes);
      if (starter.has(hash)) continue;
      if (/^content\/blog\/[^/]+\.mdx?$/.test(file) || (/^content\/pages\/[^/]+\.ya?ml$/.test(file) && !STARTER_PAGES.has(file))) paths.add(file);
      if (!files.has(hash)) files.set(hash, { path: file, size: bytes.length, sha256: hash });
      if (COLLECTION_FILE.test(file)) for (const entry of collectionEntries(file, bytes.toString("utf8"))) if (!entries.has(entry.sha256)) entries.set(entry.sha256, { file, sha256: entry.sha256 });
    }
  }
  const byPath = (a, b) => a.path.localeCompare(b.path) || a.sha256.localeCompare(b.sha256);
  return {
    $comment: `What the kit's example shipped to a site, which check-site's leftovers pass looks for: init copied the example's content/ and public/ up to ${LAST_EXAMPLE_RELEASE} and copies none of them from 0.8.2, so this is every release's example from ${tags[0]} to ${tags.at(-1)} and does not change. Written by tools/example-files.mjs from the kit's tags.`,
    releases: tags,
    paths: [...paths].sort(),
    files: [...files.values()].sort(byPath),
    entries: [...entries.values()].sort((a, b) => a.file.localeCompare(b.file) || a.sha256.localeCompare(b.sha256)),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const tags = releaseTags(git(["tag", "--list", "v*"]).split("\n").filter(Boolean));
  if (!tags.length) { console.error("example-files: no release tags here (git fetch --tags), so the example's files cannot be read"); process.exit(1); }
  const text = `${JSON.stringify(exampleFiles(tags), null, 1)}\n`;
  const file = path.join(ROOT, EXAMPLE_FILES);
  if (process.argv.includes("--check")) {
    const same = fs.existsSync(file) && fs.readFileSync(file, "utf8") === text;
    console[same ? "log" : "error"](same ? `example-files: ${EXAMPLE_FILES} is current (${tags[0]}–${tags.at(-1)})` : `example-files: ${EXAMPLE_FILES} differs from the tags: node tools/example-files.mjs writes it`);
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(file, text);
  const list = JSON.parse(text);
  console.log(`example-files: wrote ${EXAMPLE_FILES}: ${list.paths.length} paths, ${list.files.length} files, ${list.entries.length} entries from ${tags.length} releases (${tags[0]}–${tags.at(-1)})`);
}
