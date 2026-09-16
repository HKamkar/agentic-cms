// What a collection is: a name, where its entries live under content/, how
// the file(s) are laid out, and the zod schema every entry must satisfy.
// defineCollection() records the definition under its name so that ref()
// (schema.ts) can find the collection a field points at when it is checked.
// That registry is the engine's one module-level singleton, kept because a
// collection may reference itself (posts.related → posts) and TypeScript
// cannot type a definition that appears inside its own initializer.

import path from "node:path";
import type { ZodType, output } from "zod";

export type Format = "markdown" | "yaml" | "json";

/**
 * One entry per file under content/<dir>: the filename stem is the slug.
 * Only the format's extensions are listed (.md/.mdx | .yaml/.yml | .json);
 * names starting with "_" and subdirectories are skipped; sorted by name.
 */
export type FolderCollection<S extends ZodType = ZodType> = { name: string; kind: "folder"; dir: string; format: Format; schema: S };

/**
 * Every entry in one file content/<file> (parsed by its extension):
 * "list" = a top-level sequence, the slug is the index as text ("0");
 * "map" = a top-level object, the slug is the key (authors.json, categories.json).
 */
export type FileCollection<S extends ZodType = ZodType> = { name: string; kind: "list" | "map"; file: string; schema: S };

export type CollectionDef<S extends ZodType = ZodType> = FolderCollection<S> | FileCollection<S>;

/** `file` is the logical location ("content/blog/x.md"), whatever directory the engine reads from. */
export type Entry<T> = { slug: string; file: string; data: T };
/** Markdown entries also carry gray-matter's content, byte for byte. */
export type MarkdownEntry<T> = Entry<T> & { body: string; format: "md" | "mdx" };
export type DataOf<D extends CollectionDef> = output<D["schema"]>;
export type EntryOf<D extends CollectionDef> = D extends { format: "markdown" } ? MarkdownEntry<DataOf<D>> : Entry<DataOf<D>>;

const registry = new Map<string, CollectionDef>();

/** Registers the definition under its name (re-registration overwrites: next dev may evaluate collections.ts again) and returns it, literal types kept. */
export function defineCollection<const D extends CollectionDef>(def: D): D {
  registry.set(def.name, def);
  return def;
}

/** The registered definition, or throws: a ref() to a name nobody defined is a programmer error, not a content problem. */
export function lookup(name: string): CollectionDef {
  const def = registry.get(name);
  if (!def) throw new Error(`ref("${name}"): no collection named "${name}" (${[...registry.keys()].join(", ")})`);
  return def;
}

/**
 * Where content/ is: the current directory's `content/`, spelled so that
 * Next's file tracer sees a static subfolder and bundles only it into the
 * Worker (a path it cannot resolve statically makes it trace the whole
 * project). Tests and hand checks point every collection at another tree by
 * changing the current directory (test-helpers.ts, content-check --root).
 */
export function contentRoot(): string {
  return path.join(process.cwd(), "content");
}
