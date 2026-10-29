// The content files' JSON Schemas, from the collections' zod schemas
// (z.toJSONSchema), so an editor and an agent see a wrong key or a missing
// field as it is typed: one file per collection under content/_schemas/
// (committed, D10), each the input a file may hold (io: "input": a field
// optional() makes takes null, a date is a quoted string), draft-07, which
// every YAML language server reads. A field's .describe() is its
// description; what a helper says in .meta() becomes a line of it — a
// ref() a slug of its collection's file, never the slugs themselves, so
// adding an author changes no schema (`agentic-cms check` still checks every
// ref) — and the page sections are one definition, `section`, a oneOf keyed
// by `type`. A YAML content file finds its schema by its first line,
// `# yaml-language-server: $schema=<path>` (D11), which schemaLineEdits()
// writes where it is missing. `agentic-cms schema` writes the files,
// `--check` (and `docs --check`, in every build) fails a stale one.
import path from "node:path";

/** Where the schemas live, one per collection. */
export const SCHEMAS = "content/_schemas";
/** The modeline the YAML language server reads a file's schema from. */
export const SCHEMA_LINE = /^# yaml-language-server: \$schema=(\S*)[^\n]*\n?/;
/** The annotated templates under content/_templates/, by the collection each is a file (or an entry) of. */
export const TEMPLATES = { "page.yaml": "pages", "faq.yaml": "faqs", "review.yaml": "reviews", "use-case.yaml": "useCases" };
/** The helpers' named types (their .meta({ type })): the JSON Schema each is, and its line. Any other name gets a line alone. */
const NAMED = {
  "YYYY-MM-DD": { keywords: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, line: "A date, YYYY-MM-DD, quoted in YAML." },
  "ISO timestamp": { keywords: { type: "string" }, line: "An ISO timestamp, such as 2026-09-15T09:00:00Z." },
};

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** A collection's schema file: content/_schemas/<name in kebab case>.json. */
export const schemaFile = (def) => `${SCHEMAS}/${kebab(def.name)}.json`;

/** The union of page sections a collection's root shape holds as a list (the pages collection's `sections`), if any. */
function sectionUnion(schema) {
  for (const field of Object.values(schema.def.shape ?? {})) {
    let node = field;
    while (["optional", "nullable", "pipe"].includes(node.def.type)) node = node.def.innerType ?? node.def.in;
    const element = node.def.type === "array" ? node.def.element : undefined;
    if (element?.def.type === "union" && element.def.discriminator === "type") return element;
  }
  return undefined;
}

/** The line a helper's meta adds to a field's description: a ref's collection, a named type. */
function metaLine(meta, { sourceOf, lookup }) {
  if (meta?.ref) {
    const target = lookup(meta.ref);
    return `A slug of ${sourceOf(target)}${target.kind === "folder" ? "/ (a file's name without its extension)" : ""}; agentic-cms check checks it.`;
  }
  if (meta?.type) return NAMED[meta.type]?.line ?? `Type: ${meta.type}.`;
  return undefined;
}

/**
 * The registry toJSONSchema reads a schema's metadata from: the global one
 * without the helpers' `type` and `ref`, which are docs words, not JSON
 * Schema keywords (a `type: "YYYY-MM-DD"` would replace the field's own),
 * and with `id: "section"` on the page sections, the definition they nest by.
 */
const metadataOf = (z, union) => ({
  get(schema) {
    const kept = Object.fromEntries(Object.entries(z.globalRegistry.get(schema) ?? {}).filter(([key]) => key !== "type" && key !== "ref"));
    if (schema === union) kept.id = "section";
    return Object.keys(kept).length ? kept : undefined;
  },
});

/** The entry schema as the file holds it: a folder's file is one entry, a list file a list of them, a map file an object of them by slug. */
function fileSchema(def, z) {
  if (def.kind === "list") return z.array(def.schema);
  if (def.kind === "map") return z.record(z.string(), def.schema);
  return def.schema;
}

function layout(def) {
  if (def.kind === "folder") return def.format === "markdown" ? "a post's frontmatter, one file per entry, the file name is the slug" : "one file per entry, the file name is the slug";
  return def.kind === "list" ? "one file holding a list, one entry per item" : "one file holding a map, the key is the slug";
}

/** One collection's JSON Schema, as an object. `deps`: the zod the schemas were built with, and sourceOf / lookup from agentic-cms/content. */
export function jsonSchemaOf(def, { z, sourceOf, lookup }) {
  const override = ({ zodSchema, jsonSchema }) => {
    const meta = z.globalRegistry.get(zodSchema);
    if (meta?.type && NAMED[meta.type]) Object.assign(jsonSchema, NAMED[meta.type].keywords);
    const line = metaLine(meta, { sourceOf, lookup });
    if (line && !jsonSchema.description?.includes(line)) jsonSchema.description = jsonSchema.description ? `${jsonSchema.description}\n${line}` : line;
  };
  const { $schema, ...schema } = z.toJSONSchema(fileSchema(def, z), { io: "input", target: "draft-07", metadata: metadataOf(z, sectionUnion(def.schema)), override });
  const description = `${sourceOf(def)}: ${def.schema.description ?? def.name} (${layout(def)}).`;
  return { $schema, $comment: "Written by agentic-cms schema from the collection's zod schema; do not edit by hand.", ...schema, description };
}

/** Every collection's schema file, by path: its JSON text. */
export function schemaFiles(collections, deps) {
  return new Map(Object.values(collections).map((def) => [schemaFile(def), `${JSON.stringify(jsonSchemaOf(def, deps), null, 2)}\n`]));
}

/** What differs between the files the code writes and the site's folder: [{ file, status: "missing" | "stale" | "extra" }], [] when current. `fs` is injected (node:fs, or a test's). */
export function staleSchemas(root, files, { fs }) {
  const out = [];
  for (const [file, text] of files) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) out.push({ file, status: "missing" });
    else if (fs.readFileSync(full, "utf8") !== text) out.push({ file, status: "stale" });
  }
  const dir = path.join(root, SCHEMAS);
  const onDisk = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".json")) : [];
  for (const name of onDisk.sort()) if (!files.has(`${SCHEMAS}/${name}`)) out.push({ file: `${SCHEMAS}/${name}`, status: "extra" });
  return out;
}

/** Brings the site's folder in line with the code: each missing or stale file written, each extra one removed; staleSchemas()'s list of what changed. */
export function writeSchemas(root, files, { fs }) {
  const changed = staleSchemas(root, files, { fs });
  fs.mkdirSync(path.join(root, SCHEMAS), { recursive: true });
  for (const { file, status } of changed) {
    if (status === "extra") fs.rmSync(path.join(root, file));
    else fs.writeFileSync(path.join(root, file), files.get(file));
  }
  return changed;
}

/** The first line of a YAML file naming the schema at `schema` (a path from the site's root), relative to the file. */
export function schemaLine(file, schema) {
  const relative = path.posix.relative(path.posix.dirname(file), schema);
  return `# yaml-language-server: $schema=${relative.startsWith(".") ? relative : `./${relative}`}`;
}

/** A YAML file's text opening with `line`: an existing modeline replaced, else the line put first. */
export const withSchemaLine = (text, line) => (SCHEMA_LINE.test(text) ? text.replace(SCHEMA_LINE, `${line}\n`) : `${line}\n${text}`);

/** The YAML files of a collection under the site's root, by path from it: a yaml folder's files (not `_`-prefixed), a list's or a map's file. */
function yamlFiles(def, { fs, root }) {
  if (def.kind !== "folder") return /\.ya?ml$/.test(def.file) ? [`content/${def.file}`].filter((file) => fs.existsSync(path.join(root, file))) : [];
  if (def.format !== "yaml") return [];
  const dir = path.join(root, "content", def.dir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => /\.ya?ml$/.test(name) && !name.startsWith("_")).sort().map((name) => `content/${def.dir}/${name}`);
}

/**
 * The change a site needs for its editor to find each schema: every YAML
 * content file of a collection, and each template under content/_templates/
 * a collection has (TEMPLATES), that does not open with its schema's line,
 * as { file, text } with the line in. `fs` is injected (node:fs, or a test's).
 */
export function schemaLineEdits(root, collections, { fs }) {
  const defs = Object.values(collections);
  const byName = new Map(defs.map((def) => [def.name, def]));
  const wanted = defs.flatMap((def) => yamlFiles(def, { fs, root }).map((file) => [file, schemaFile(def)]));
  for (const [template, name] of Object.entries(TEMPLATES)) {
    const file = `content/_templates/${template}`;
    if (byName.has(name) && fs.existsSync(path.join(root, file))) wanted.push([file, schemaFile(byName.get(name))]);
  }
  return wanted.flatMap(([file, schema]) => {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    const next = withSchemaLine(text, schemaLine(file, schema));
    return next === text ? [] : [{ file, text: next }];
  });
}
