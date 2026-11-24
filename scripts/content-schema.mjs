#!/usr/bin/env node
// Writes the JSON Schema of every collection of the site's registry into
// content/_schemas/ (lib/content-schema.mjs), so an editor checks a content
// file as it is typed and an agent reads what a file may hold:
//
//   agentic-cms schema            writes the files (a removed collection's goes)
//   agentic-cms schema --check    exits 1 when a file differs from the code (docs --check runs it, in every build)
//   agentic-cms schema --lines    also opens each YAML content file (a translation's too) and template with its schema's line
import "./lib/load-ts.mjs";
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { schemaFiles, schemaLineEdits, staleSchemas, writeSchemas } from "./lib/content-schema.mjs";
import { SPECS } from "./lib/specs.mjs";
import { translations } from "./lib/translations.mjs";

const { check, lines } = parseOrExit(SPECS.schema, process.argv.slice(2)).flags;

const deps = { z: (await import("zod")).z, ...(await import("agentic-cms/content")) };
const { collections, locales } = (await import("@/kit")).kit;
const files = schemaFiles(collections, deps);
const count = `${files.size} collections`;

if (check) {
  const stale = staleSchemas(".", files, { fs });
  for (const { file, status } of stale) console.error(`schema: ${file} is ${status}`);
  if (stale.length) {
    console.error("schema: content/_schemas/ is out of date — run agentic-cms schema and commit the result");
    process.exit(1);
  }
  console.log(`schema: content/_schemas/ is up to date (${count})`);
} else {
  const changed = writeSchemas(".", files, { fs });
  for (const { file, status } of changed) console.log(`schema: ${{ missing: "created", stale: "updated", extra: "removed" }[status]}  ${file}`);
  console.log(`schema: ${count}, ${changed.length} file(s) changed under content/_schemas/`);
}
if (lines && !check) {
  const edits = schemaLineEdits(".", collections, { fs, translated: translations({ collections, locales, root: "." }) });
  for (const { file, text } of edits) {
    fs.writeFileSync(path.join(".", file), text);
    console.log(`schema: the schema line added to ${file}`);
  }
  if (!edits.length) console.log("schema: every YAML content file and template opens with its schema's line");
}
