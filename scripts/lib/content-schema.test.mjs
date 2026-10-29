// The JSON Schemas `agentic-cms schema` writes: what a field says (its
// description, a ref's collection as a line and never its slugs, a date's
// pattern, optional taking null), the three layouts, the committed files the
// example's collections give, a stale, missing and extra file found and set
// right, every YAML and JSON content file of the example and the starter
// valid against its schema and a wrong key not, and the schema line atop
// each YAML file, written where it is missing and nowhere twice.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { z } from "zod";
import * as content from "../../src/lib/content/index.ts";
import { kit } from "../../src/kit.ts";
import { createLocales } from "../../src/lib/locales.ts";
import { fill, siteIdentity } from "./starter.mjs";
import { jsonSchemaOf, schemaFile, schemaFiles, schemaLine, schemaLineEdits, SCHEMAS, staleSchemas, TEMPLATES, withSchemaLine, writeSchemas } from "./content-schema.mjs";
import { translations } from "./translations.mjs";

const REPO = path.resolve(import.meta.dirname, "../..");
const STARTER = path.join(REPO, "templates/starter");
const deps = { z, ...content };
const { defineCollection, text, optional, dateOnly, ref } = content;

const scratch = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "content-schema-"));
  for (const [file, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), body); }
  return root;
};

/** The JSON Schema keywords the files use, checked as draft-07 says: enough to tell a valid file from a wrong one. */
function validate(schema, value, root = schema, at = "$") {
  if (schema.$ref) return validate(schema.$ref.slice(2).split("/").reduce((node, key) => node[key], root), value, root, at);
  const errors = [];
  for (const part of schema.allOf ?? []) errors.push(...validate(part, value, root, at));
  if (schema.anyOf && !schema.anyOf.some((part) => !validate(part, value, root, at).length)) errors.push(`${at}: none of anyOf`);
  if (schema.oneOf && schema.oneOf.filter((part) => !validate(part, value, root, at).length).length !== 1) errors.push(`${at}: not exactly one of oneOf`);
  const kind = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (schema.type && ![schema.type].flat().includes(kind)) return [...errors, `${at}: ${kind}, not ${schema.type}`];
  if ("const" in schema && value !== schema.const) errors.push(`${at}: not ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: not one of ${schema.enum}`);
  if (kind === "string" && schema.pattern && !new RegExp(schema.pattern, "u").test(value)) errors.push(`${at}: does not match ${schema.pattern}`);
  if (kind === "number" && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) errors.push(`${at}: out of range`);
  if (kind === "array") {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) errors.push(`${at}: ${value.length} items`);
    if (schema.items) value.forEach((item, i) => errors.push(...validate(schema.items, item, root, `${at}[${i}]`)));
  }
  if (kind === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${at}.${key}: required`);
    for (const [key, item] of Object.entries(value)) {
      const own = schema.properties?.[key];
      if (own) errors.push(...validate(own, item, root, `${at}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${at}.${key}: not allowed`);
      else if (typeof schema.additionalProperties === "object") errors.push(...validate(schema.additionalProperties, item, root, `${at}.${key}`));
    }
  }
  return errors;
}

test("a field's description is its .describe(); a ref is a line naming its collection's file, never a slug; a date has its pattern; optional takes null", () => {
  const people = defineCollection({ name: "schemaPeople", kind: "map", file: "people.json", schema: z.strictObject({ name: text().describe("The name") }).describe("A person") });
  const notes = defineCollection({
    name: "schemaNotes", kind: "folder", dir: "notes", format: "yaml",
    schema: z.strictObject({ by: ref("schemaPeople").describe("Who wrote it"), on: dateOnly().describe("When"), aside: optional(text()).describe("An aside") }).describe("A note"),
  });
  const schema = jsonSchemaOf(notes, deps);
  assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
  assert.equal(schema.description, "content/notes: A note (one file per entry, the file name is the slug).");
  assert.deepEqual(schema.properties.by, { type: "string", description: "Who wrote it\nA slug of content/people.json; agentic-cms check checks it." });
  assert.deepEqual(schema.properties.on, { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "When\nA date, YYYY-MM-DD, quoted in YAML." });
  assert.deepEqual(schema.properties.aside, { description: "An aside", type: ["string", "null"] });
  assert.deepEqual(schema.required, ["by", "on"]);
  assert.equal(schema.additionalProperties, false, "a strict object refuses a key it does not name");
  assert.ok(!("ref" in schema.properties.by) && !JSON.stringify(schema).includes('"type":"YYYY-MM-DD"'), "the helpers' meta words are no JSON Schema keywords");
  const map = jsonSchemaOf(people, deps);
  assert.equal(map.type, "object");
  assert.equal(map.additionalProperties.properties.name.description, "The name", "a map file: an object of entries by slug");
  assert.equal(schemaFile(notes), `${SCHEMAS}/schema-notes.json`);
});

test("the example's collections give the committed files, which name no slug, and the sections are one definition keyed by type", () => {
  const files = schemaFiles(kit.collections, deps);
  assert.deepEqual(staleSchemas(REPO, files, { fs }), [], "run agentic-cms schema and commit content/_schemas/");
  assert.deepEqual([...files.keys()].map((file) => path.basename(file)), ["authors.json", "categories.json", "posts.json", "reviews.json", "faqs.json", "use-cases.json", "pages.json", "redirects.json"]);
  const posts = files.get(`${SCHEMAS}/posts.json`);
  for (const slug of Object.keys(JSON.parse(fs.readFileSync(path.join(REPO, "content/authors.json"), "utf8")))) assert.ok(!posts.includes(`"${slug}"`), `no author slug listed (${slug})`);
  const pages = JSON.parse(files.get(`${SCHEMAS}/pages.json`));
  assert.equal(pages.properties.sections.items.$ref, "#/definitions/section");
  const types = pages.definitions.section.oneOf.map((member) => member.properties.type.const);
  assert.ok(types.includes("group") && types.includes("faq") && new Set(types).size === types.length, "one member per section type");
  assert.equal(JSON.parse(files.get(`${SCHEMAS}/reviews.json`)).type, "array", "a list file: an array of entries");
});

test("a stale, a missing and an extra file are found, and writing sets each right", () => {
  const files = schemaFiles(kit.collections, deps);
  const root = scratch(Object.fromEntries([...files].map(([file, body]) => [file, body])));
  fs.writeFileSync(path.join(root, `${SCHEMAS}/posts.json`), "{}\n");
  fs.rmSync(path.join(root, `${SCHEMAS}/faqs.json`));
  fs.writeFileSync(path.join(root, `${SCHEMAS}/gone.json`), "{}\n");
  assert.deepEqual(staleSchemas(root, files, { fs }), [{ file: `${SCHEMAS}/posts.json`, status: "stale" }, { file: `${SCHEMAS}/faqs.json`, status: "missing" }, { file: `${SCHEMAS}/gone.json`, status: "extra" }]);
  assert.equal(writeSchemas(root, files, { fs }).length, 3);
  assert.deepEqual(staleSchemas(root, files, { fs }), []);
  assert.ok(!fs.existsSync(path.join(root, `${SCHEMAS}/gone.json`)));
  fs.rmSync(root, { recursive: true });
});

/** Every content file of a tree a schema covers: [file, def, value] — the YAML and JSON ones, a post's frontmatter left to the build; the starter's with its tokens filled in, as init writes them. */
function contentFiles(root, identity) {
  return Object.values(kit.collections).flatMap((def) => {
    if (def.kind !== "folder") return fs.existsSync(path.join(root, "content", def.file)) ? [[`content/${def.file}`, def]] : [];
    const dir = path.join(root, "content", def.dir);
    return def.format === "yaml" && fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /\.ya?ml$/.test(name) && !name.startsWith("_")).map((name) => [`content/${def.dir}/${name}`, def]) : [];
  }).map(([file, def]) => {
    const body = fs.readFileSync(path.join(root, file), "utf8");
    return [file, def, (file.endsWith(".json") ? JSON.parse : parse)(identity ? fill(body, identity, file) : body)];
  });
}

test("every YAML and JSON content file of the example and the starter is valid against its schema, and a wrong key or a missing field is not", () => {
  const schemas = new Map([...schemaFiles(kit.collections, deps)].map(([file, body]) => [file, JSON.parse(body)]));
  const checked = [...contentFiles(REPO), ...contentFiles(STARTER, siteIdentity("my-site", { name: "My Site", now: new Date("2026-10-29T12:00:00Z") }))];
  assert.ok(checked.length >= 15, `${checked.length} files checked`);
  for (const [file, def, value] of checked) assert.deepEqual(validate(schemas.get(schemaFile(def)), value), [], file);
  const page = parse(fs.readFileSync(path.join(REPO, "content/pages/home.yaml"), "utf8"));
  const pages = schemas.get(`${SCHEMAS}/pages.json`);
  assert.match(validate(pages, { ...page, seo: { ...page.seo, titel: "x" } }).join("\n"), /\$\.seo\.titel: not allowed/);
  assert.match(validate(pages, { ...page, seo: { ...page.seo, updated: "15 Sept 2026" } }).join("\n"), /\$\.seo\.updated: does not match/);
  assert.match(validate(pages, { ...page, sections: [{ ...page.sections[0], headline: "x" }] }).join("\n"), /\$\.sections\[0\]: not exactly one of oneOf/);
  const { breadcrumb, ...seo } = page.seo;
  assert.ok(breadcrumb && validate(pages, { ...page, seo }).includes("$.seo.breadcrumb: required"));
});

test("the schema line: a path from the file, replacing one there or put first", () => {
  assert.equal(schemaLine("content/pages/home.yaml", `${SCHEMAS}/pages.json`), "# yaml-language-server: $schema=../_schemas/pages.json");
  assert.equal(schemaLine("content/reviews.yaml", `${SCHEMAS}/reviews.json`), "# yaml-language-server: $schema=./_schemas/reviews.json");
  assert.equal(withSchemaLine("# A note\nx: 1\n", "# yaml-language-server: $schema=a.json"), "# yaml-language-server: $schema=a.json\n# A note\nx: 1\n");
  assert.equal(withSchemaLine("# yaml-language-server: $schema=old.json\nx: 1\n", "# yaml-language-server: $schema=a.json"), "# yaml-language-server: $schema=a.json\nx: 1\n");
});

test("schemaLineEdits: a site's YAML content files and templates take their line once; the example's and the starter's have theirs", () => {
  const root = scratch({ "content/pages/home.yaml": "seo: {}\n", "content/pages/_draft.yaml": "x: 1\n", "content/faqs/general.yaml": "# yaml-language-server: $schema=../_schemas/faqs.json\nitems: []\n", "content/reviews.yaml": "[]\n", "content/authors.json": "{}\n", "content/_templates/page.yaml": "# A page\n", "content/_templates/author.json": "{}\n" });
  const edits = schemaLineEdits(root, kit.collections, { fs });
  assert.deepEqual(edits.map(({ file }) => file), ["content/reviews.yaml", "content/pages/home.yaml", "content/_templates/page.yaml"], "a file with its line, a skipped one, a JSON one: none");
  assert.equal(edits[2].text, "# yaml-language-server: $schema=../_schemas/pages.json\n# A page\n");
  for (const { file, text: body } of edits) fs.writeFileSync(path.join(root, file), body);
  assert.deepEqual(schemaLineEdits(root, kit.collections, { fs }), [], "idempotent");
  fs.rmSync(root, { recursive: true });
  assert.deepEqual(schemaLineEdits(REPO, kit.collections, { fs }), [], "the example's files and the templates open with their line");
  assert.deepEqual(schemaLineEdits(STARTER, kit.collections, { fs }), [], "the starter's too");
  const german = scratch({ "content/pages/de/home.yaml": "seo: {}\n", "content/reviews.de.yaml": "[]\n" });
  const locales = createLocales({ ...kit.site, locales: [{ ...kit.site, locale: "de", prefix: "de", ogLocale: "de_DE" }] });
  const translated = translations({ collections: kit.collections, locales, root: german });
  assert.deepEqual(schemaLineEdits(german, kit.collections, { fs, translated }).map(({ file, text: body }) => `${file} ${body.split("\n")[0]}`), ["content/reviews.de.yaml # yaml-language-server: $schema=./_schemas/reviews.json", "content/pages/de/home.yaml # yaml-language-server: $schema=../../_schemas/pages.json"], "a translation names its collection's schema, from its own folder");
  fs.rmSync(german, { recursive: true });
  assert.deepEqual(Object.keys(TEMPLATES).filter((name) => !fs.existsSync(path.join(REPO, "content/_templates", name))), [], "every template TEMPLATES names exists");
});
