// Reads a collection from content/ with node:fs at build time and validates
// every entry with its schema. Nothing here runs at request time: every
// consumer is prerendered and the Cloudflare Worker has no filesystem.
// Markdown goes through gray-matter with the `yaml` package as its engine,
// so frontmatter and .yaml files share one dialect (YAML 1.2: an unquoted
// date or `yes` stays a string); passing an engine also bypasses
// gray-matter's content-keyed cache. Entries are cached per definition only
// in production builds (per next-build worker): in next dev every call
// re-reads, so an edited file shows on reload.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import { ZodObject, type ZodError, type ZodType } from "zod";
import { contentRoot, type CollectionDef, type EntryOf, type FileCollection, type FolderCollection, type Format } from "./define";
import { ContentError, formatPath, type ContentIssue } from "./errors";

type Loaded = { slug: string; file: string; data: unknown; body?: string; format?: "md" | "mdx" };
/** A parsed entry before validation; `base` prefixes its issue paths ([2] in a list, the key in a map). */
type RawEntry = Loaded & { base: PropertyKey[] };
type Listed = { slug: string; name: string };
type Issue = ZodError["issues"][number];

const EXTENSIONS: Record<Format, readonly string[]> = { markdown: [".md", ".mdx"], yaml: [".yaml", ".yml"], json: [".json"] };
// gray-matter calls engine.parse(text, itsOwnOptions); the wrapper keeps that second argument away from yaml.
const ENGINES = { yaml: { parse: (text: string) => parseYaml(text) as object } };

const cache = new Map<CollectionDef, Loaded[]>();
const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split("\n")[0];

/** The logical location used in messages: "content/blog", "content/authors.json". */
export function sourceOf(def: CollectionDef): string {
  return `content/${def.kind === "folder" ? def.dir : def.file}`;
}

const location = (def: CollectionDef) => path.join(contentRoot(), def.kind === "folder" ? def.dir : def.file);

/** Every entry of the collection, validated, in listing order. Throws a ContentError for the first bad file with all of its issues. */
export function readCollection<D extends CollectionDef>(def: D): EntryOf<D>[] {
  const hit = cache.get(def) ?? entriesOf(def).map((entry) => validate(def, entry));
  if (process.env.NODE_ENV === "production") cache.set(def, hit);
  // The schema decides `data` and the format decides `body`; TypeScript cannot follow that from the runtime values.
  return hit as unknown as EntryOf<D>[];
}

/** The entry with that slug, or a ContentError naming the slugs that exist. */
export function readEntry<D extends CollectionDef>(def: D, slug: string): EntryOf<D> {
  const entries = readCollection(def);
  const entry = entries.find((candidate) => candidate.slug === slug);
  if (!entry) throw new ContentError(sourceOf(def), "", `no entry "${slug}" (${entries.map((candidate) => candidate.slug).join(", ")})`);
  return entry;
}

/**
 * The slugs a ref() may point at, without validating anything: a folder's
 * file stems (drafts included, the set assertRelatedExist used) or a map's
 * keys. A list has no slugs to reference.
 */
export function slugsOf(def: CollectionDef): string[] {
  if (def.kind === "folder") return listFiles(def).map((file) => file.slug);
  if (def.kind === "map") return Object.keys(mapping(def));
  throw new Error(`ref("${def.name}"): a list collection has no slugs to reference`);
}

function entriesOf(def: CollectionDef): RawEntry[] {
  if (def.kind === "folder") return listFiles(def).map((file) => readFile(def, file));
  const source = sourceOf(def);
  if (def.kind === "list") {
    const list = dataFile(def);
    if (!Array.isArray(list)) throw new ContentError(source, "", "must be a list of entries");
    return list.map((data, index) => ({ slug: String(index), file: source, base: [index], data }));
  }
  return Object.entries(mapping(def)).map(([slug, data]) => ({ slug, file: source, base: [slug], data }));
}

function listFiles(def: FolderCollection): Listed[] {
  const dir = location(def);
  if (!fs.existsSync(dir)) throw new ContentError(sourceOf(def), "", "no such directory");
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("_") && EXTENSIONS[def.format].includes(path.extname(entry.name)))
    .map((entry) => ({ slug: entry.name.slice(0, -path.extname(entry.name).length), name: entry.name }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const duplicate = files.find((file, index) => files.findIndex((other) => other.slug === file.slug) !== index);
  if (duplicate) {
    const names = files.filter((file) => file.slug === duplicate.slug).map((file) => file.name);
    throw new ContentError(sourceOf(def), "", `duplicate slug "${duplicate.slug}" (${names.join(", ")})`);
  }
  return files;
}

function readFile(def: FolderCollection, { slug, name }: Listed): RawEntry {
  const file = `${sourceOf(def)}/${name}`;
  const raw = fs.readFileSync(path.join(location(def), name), "utf8");
  if (def.format !== "markdown") {
    const data = parseData(raw, file, path.extname(name));
    if (data == null) throw new ContentError(file, "", "is empty");
    return { slug, file, base: [], data };
  }
  const parsed = parseMarkdown(raw, file);
  if (!isPlainObject(parsed.data)) throw new ContentError(file, "", "frontmatter must be a mapping");
  return { slug, file, base: [], data: parsed.data, body: parsed.content, format: name.endsWith(".mdx") ? "mdx" : "md" };
}

function parseMarkdown(raw: string, file: string) {
  try {
    return matter(raw, { engines: ENGINES });
  } catch (error) {
    throw new ContentError(file, "", `invalid frontmatter: ${firstLine(error)}`);
  }
}

function mapping(def: FileCollection): Record<string, unknown> {
  const value = dataFile(def);
  if (!isPlainObject(value)) throw new ContentError(sourceOf(def), "", "must be a mapping of entries keyed by slug");
  return value;
}

function dataFile(def: FileCollection): unknown {
  const file = location(def);
  if (!fs.existsSync(file)) throw new ContentError(sourceOf(def), "", "no such file");
  const value = parseData(fs.readFileSync(file, "utf8"), sourceOf(def), path.extname(file));
  if (value == null) throw new ContentError(sourceOf(def), "", "is empty");
  return value;
}

function parseData(raw: string, file: string, ext: string): unknown {
  const json = ext === ".json";
  try {
    return json ? JSON.parse(raw) : parseYaml(raw);
  } catch (error) {
    throw new ContentError(file, "", `invalid ${json ? "JSON" : "YAML"}: ${firstLine(error)}`);
  }
}

function validate(def: CollectionDef, { base, ...entry }: RawEntry): Loaded {
  if (!isPlainObject(entry.data)) throw new ContentError(entry.file, formatPath(base), "must be a mapping");
  const result = def.schema.safeParse(entry.data);
  if (result.success) return { ...entry, data: result.data };
  const [first, ...rest] = result.error.issues.map((issue) => toIssue(issue, base, def.schema));
  throw new ContentError(entry.file, first.path, first.problem, rest);
}

function toIssue(issue: Issue, base: PropertyKey[], schema: ZodType): ContentIssue {
  const problem = issue.code === "unrecognized_keys" ? unknownKeys(issue.keys, issue.path.length === 0 ? schema : undefined) : issue.message;
  return { path: formatPath([...base, ...issue.path]), problem };
}

/** At an entry's top level the allowed keys are at hand (the shape); deeper down only the offending ones are named. */
function unknownKeys(keys: string[], schema?: ZodType): string {
  const allowed = schema instanceof ZodObject ? `; allowed: ${Object.keys(schema.shape).join(", ")}` : "";
  return `unknown key(s) ${keys.join(", ")}${allowed}`;
}
