// What is left of the kit's example in a site, which `check-site`'s
// `leftovers` pass lists so each can be replaced or deleted
// (docs/roadmap-0.8.2.md D8, job 7). Up to 0.8.1 `init` copied the example's
// content/ and public/ into a new site; ./example-files.json is what it
// shipped at every release (tools/example-files.mjs, from the kit's tags).
// Two rules, each a finding by file:
//   - example-brand: the example's name, domain or author in a line, as the
//     content lint's rule of that name finds it (./placeholders.mjs);
//   - example-content: a file at one of the example's own paths (a post, a
//     catalogue page), a file whose bytes are one the example shipped (by
//     size, then sha256, under any name), and an entry of a collection file
//     (a review, a use case, an FAQ, an author) that is one of
//     the example's, by the sha256 of its canonical JSON.
// The file system comes in as `fs` (existsSync, readFileSync, readdirSync
// with withFileTypes, and statSync when it has one), so the tests need no
// site on disk.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { exampleBrandLeftovers } from "./placeholders.mjs";

/** The list of what the example shipped, beside this module. */
export const EXAMPLE_FILES = "scripts/lib/example-files.json";
/** The last release whose `init` copied the example's content and pictures into a site. */
export const LAST_EXAMPLE_RELEASE = "0.8.1";
/**
 * What under content/ is no sample of the example: the kit's own docs and
 * templates, which a site keeps (the starter has them too) and the brand rule
 * reads, and the categories, two generic names a site may well write itself.
 */
export const NOT_SAMPLES = [/^content\/README\.md$/, /^content\/VOICE\.md$/, /^content\/_templates\//, /^content\/editorial\//, /^content\/categories\.json$/];
/** The collection files whose entries are read one by one: the list ones, the authors' map, an FAQ set's items. */
export const COLLECTION_FILE = /^content\/(?:(?:reviews|use-cases)\.ya?ml|authors\.json|faqs\/[^/_][^/]*\.ya?ml)$/;
const TREES = ["content", "public"];

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** A value as JSON with every object's keys sorted, so two entries that say the same hash the same. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

/** A name for an entry in a message: its key, or its first field that names it. */
const labelOf = (key, value) => key ?? ["name", "title", "question", "sector"].map((field) => value?.[field]).find((v) => typeof v === "string") ?? "";

/** The entries of a collection file: [{ at, label, sha256 }] — a list's items, a map's keys with their values, an FAQ set's items; none when it does not parse. */
export function collectionEntries(file, text) {
  let data;
  try { data = /\.json$/.test(file) ? JSON.parse(text) : parseYaml(text); } catch { return []; }
  const items = /^content\/faqs\//.test(file) ? data?.items : data;
  if (Array.isArray(items)) return items.map((item, at) => ({ at: `[${at}]`, label: labelOf(null, item), sha256: sha256(canonical(item)) }));
  if (items && typeof items === "object") return Object.entries(items).map(([key, value]) => ({ at: key, label: labelOf(key, value), sha256: sha256(canonical({ [key]: value })) }));
  return [];
}

/** The list as this module reads it: { paths: Set, sizes: Set, files: Map sha256 → path, entries: Map sha256 → file }. */
export function readExampleFiles(list = JSON.parse(fs.readFileSync(new URL("./example-files.json", import.meta.url), "utf8"))) {
  return {
    paths: new Set(list.paths),
    sizes: new Set(list.files.map((file) => file.size)),
    files: new Map(list.files.map((file) => [file.sha256, file.path])),
    entries: new Map(list.entries.map((entry) => [entry.sha256, entry.file])),
  };
}

/** The site's files under content/ and public/ through `fs`, root-relative, dotfiles left out, with their bytes and sizes. */
function reader(root, fs) {
  const full = (file) => path.join(root, file);
  const walk = (dir) => { let list; try { list = fs.readdirSync(full(dir), { withFileTypes: true }); } catch { return []; } return list.filter((e) => !e.name.startsWith(".")).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`])); };
  const bytes = (file) => fs.readFileSync(full(file));
  const size = (file) => (typeof fs.statSync === "function" ? fs.statSync(full(file)).size : Buffer.byteLength(bytes(file)));
  return { files: TREES.flatMap(walk).sort(), bytes, size };
}

const finding = (rule, file, problem, fix) => ({ check: "leftovers", rule, file, problem, fix });
const REPLACE = "replace it with the site's own, or delete it";
/** How a post or a page at a live URL goes: retired, so an indexed URL never breaks. */
const RETIRE = "a live URL is retired, never just deleted (/editorial:retire-content: a post becomes a draft, a page goes with its redirect)";

/** The example's content at its own path: a post or a catalogue page, whatever the site made of it. */
function byPath(file) {
  const post = file.startsWith("content/blog/");
  const what = post ? "one of the example's posts" : "one of the example's catalogue pages";
  return finding("example-content", file, `${what}, at the path the example shipped it`, `${REPLACE}, its pictures with it; ${RETIRE}`);
}

/** The example's leftovers by line, by path, by bytes and by entry: [{ check, rule, file, problem, fix }], ordered by file. */
export function exampleLeftovers({ root, fs: fsys = fs, siteName = "", list = readExampleFiles() }) {
  const brand = exampleBrandLeftovers(root, { siteName, fs: fsys }).map(({ file, path: at, found }) => finding("example-brand", at ? `${file}:${at.replace(/^line /, "")}` : file, `${JSON.stringify(found)} is the kit example's ${/editorial/i.test(found) ? "author" : /\./.test(found) ? "domain" : "brand"}`, `write the site's own${at ? "" : " (rename or delete the file)"}, or delete what came from the example`));
  const site = reader(root, fsys);
  const content = [];
  for (const file of site.files.filter((f) => !NOT_SAMPLES.some((re) => re.test(f)))) {
    if (list.paths.has(file)) { content.push(byPath(file)); continue; }
    const copied = list.sizes.has(site.size(file)) ? list.files.get(sha256(site.bytes(file))) : undefined;
    if (copied) { content.push(finding("example-content", file, `a copy of the example's ${copied}`, REPLACE)); continue; }
    if (!COLLECTION_FILE.test(file)) continue;
    for (const entry of collectionEntries(file, site.bytes(file).toString("utf8")).filter((e) => list.entries.has(e.sha256))) {
      content.push(finding("example-content", file, `entry ${entry.at}${entry.label && entry.label !== entry.at ? ` (${entry.label})` : ""} is one of the example's`, REPLACE));
    }
  }
  return [...brand, ...content].sort((a, b) => a.file.localeCompare(b.file, "en", { numeric: true }));
}

/** The file a finding's `file` names, its `:line` left off: what the baseline keys an entry by. */
export const findingFile = (file) => file.replace(/:\d+$/, "");
