#!/usr/bin/env node
// Writes the field tables of every collection of the site's registry into the
// site's content/README.md from the schemas themselves (their .describe() texts, the helpers' type
// names, ref() targets), so the documentation cannot drift from the contract:
//
//   content-engine-kit docs            rewrites the block between the markers (pnpm content:docs)
//   content-engine-kit docs --check    exits 1 when the block is out of date (pnpm build runs this)
//
// The walk follows zod's public `def` tree: a pipe to its input, optional /
// nullable wrappers to their inner type, a lazy schema to what it returns,
// an array to its element, until the leaf. The outermost description wins
// (the describe-last convention). A union of objects discriminated by a
// `type` literal (the page sections) gets one table per member.
import "./lib/load-ts.mjs";
import fs from "node:fs";

const README = "content/README.md";
const START = "<!-- content-docs:start -->";
const END = "<!-- content-docs:end -->";

const { lookup, sourceOf } = await import("content-engine-kit/content");
const { kit } = await import("@/kit");
const { collections } = kit;

const meta = (schema) => (typeof schema.meta === "function" ? schema.meta() : undefined) ?? {};

/** The wrapper chain from the field down to its leaf, and what the wrappers say. */
function unwrap(schema) {
  const chain = [];
  let node = schema;
  let optional = false;
  while (node) {
    chain.push(node);
    const { type, innerType, in: input, getter } = node.def;
    if (type === "optional") optional = true;
    if (type === "optional" || type === "nullable") node = innerType;
    else if (type === "pipe") node = input;
    else if (type === "lazy") node = getter();
    else break;
  }
  return { chain, leaf: chain[chain.length - 1], optional };
}

const first = (chain, pick) => chain.map(pick).find((value) => value !== undefined);

function typeOf(chain, leaf) {
  const named = first(chain, (node) => meta(node).type);
  if (named) return named;
  const ref = first(chain, (node) => meta(node).ref);
  if (ref) return `key of \`${sourceOf(lookup(ref))}\``;
  switch (leaf.def.type) {
    case "string":
      return "text";
    case "boolean":
      return "true / false";
    case "number":
      return "number";
    case "array": {
      if (leaf.def.element.def.type === "object") return "list of entries";
      const inner = unwrap(leaf.def.element);
      return `list of ${typeOf(inner.chain, inner.leaf)}`;
    }
    case "object":
      return "entries";
    case "enum":
      return `one of ${Object.keys(leaf.def.entries).join(", ")}`;
    case "union":
      return `one of the ${unionName(leaf)} below`;
    default:
      return "text";
  }
}

/** A union of objects discriminated by `type`: its member names, and whether it is the page sections. */
const members = (union) => union.def.options.map((option) => option.def.shape?.[union.def.discriminator]?.def.values?.[0]).filter(Boolean);
const unionName = (union) => (union.def.discriminator === "type" ? "section types" : "kinds");

const cell = (text) => text.replace(/\|/g, "\\|").replace(/<[a-z][^>]*>/g, (tag) => `\`${tag}\``);

/** Table rows for one object shape; nested list-of-entries and entries get rows of their own, keyed `parent[].child`. */
function rows(shape, prefix = "") {
  const out = [];
  for (const [key, field] of Object.entries(shape)) {
    const { chain, leaf, optional } = unwrap(field);
    const description = first(chain, (node) => node.description) ?? "";
    out.push(`| \`${prefix}${key}\` | ${typeOf(chain, leaf)} | ${optional ? "no" : "yes"} | ${cell(description)} |`);
    const element = leaf.def.type === "array" ? unwrap(leaf.def.element).leaf : undefined;
    const nested = element ?? (leaf.def.type === "object" ? leaf : undefined);
    if (nested?.def.type === "object") out.push(...rows(nested.def.shape, `${prefix}${key}${element ? "[]" : ""}.`));
    if (nested?.def.type === "union" && nested.def.discriminator !== "type") out.push(...unionRows(nested, `${prefix}${key}${element ? "[]" : ""}.`));
  }
  return out;
}

/** Rows for a small inline union (a `kind` discriminator): each member's fields, prefixed with the kind. */
function unionRows(union, prefix) {
  return union.def.options.flatMap((option) => {
    const kind = option.def.shape[union.def.discriminator].def.values[0];
    return rows(Object.fromEntries(Object.entries(option.def.shape).filter(([key]) => key !== union.def.discriminator)), `${prefix}(${kind}).`);
  });
}

/** One table per member of the section union, reachable from a page's `sections` field. */
function sectionTables(union) {
  return union.def.options.map((option) => {
    const type = option.def.shape.type.def.values[0];
    const shape = Object.fromEntries(Object.entries(option.def.shape).filter(([key]) => key !== "type"));
    return [`#### \`${type}\``, "", option.description ?? "", "", "| Key | Type | Required | Description |", "|---|---|---|---|", ...rows(shape)].join("\n");
  });
}

/** The section union a collection's schema reaches through an array field, if any (the pages collection). */
function sectionUnion(schema) {
  for (const field of Object.values(schema.def.shape)) {
    const { leaf } = unwrap(field);
    const element = leaf.def.type === "array" ? unwrap(leaf.def.element).leaf : undefined;
    if (element?.def.type === "union" && element.def.discriminator === "type") return element;
  }
  return undefined;
}

function layout(def) {
  if (def.kind === "folder") return `a folder of ${def.format} files, one entry per file, the file name is the slug`;
  if (def.kind === "list") return "one file holding a list, one entry per item";
  return "one file holding a map, the key is the slug";
}

function section(def) {
  const union = sectionUnion(def.schema);
  return [
    `### \`${def.name}\` — \`${sourceOf(def)}\``,
    "",
    `${def.schema.description ?? ""} (${layout(def)}).`,
    "",
    "| Key | Type | Required | Description |",
    "|---|---|---|---|",
    ...rows(def.schema.def.shape),
    ...(union ? ["", `The section types (${members(union).length}); every section has \`type\` plus the fields below:`, "", ...sectionTables(union)] : []),
  ].join("\n");
}

const generated = [`${START}`, "<!-- generated by content-engine-kit docs from the schemas; do not edit by hand -->", "", ...Object.values(collections).map(section), "", END].join("\n\n").replace(/\n\n\n+/g, "\n\n");

const current = fs.readFileSync(README, "utf8");
const from = current.indexOf(START);
const to = current.indexOf(END);
if (from === -1 || to === -1) {
  console.error(`content-docs: ${README} has no ${START} … ${END} markers`);
  process.exit(2);
}
const next = current.slice(0, from) + generated + current.slice(to + END.length);
if (process.argv.includes("--check")) {
  if (next !== current) {
    console.error(`content-docs: ${README} is out of date — run content-engine-kit docs (pnpm content:docs) and commit the result`);
    process.exit(1);
  }
  console.log(`content-docs: ${README} is up to date`);
} else {
  fs.writeFileSync(README, next);
  console.log(`content-docs: wrote ${Object.keys(collections).length} collections to ${README}`);
}
