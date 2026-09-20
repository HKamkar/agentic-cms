#!/usr/bin/env node
// Proves a refactor changed no output. Builds, then stores every prerendered
// page with the <script> tags (chunk hashes, RSC payload), hashed <link>s and
// Next's image preload hints (attribute order varies per build) removed, so
// two captures can be diffed. Structured data lives in <script> tags too, so
// every page's JSON-LD blocks are kept beside it as <page>.jsonld — one block
// per line, keys sorted, because JSON-LD is a graph in which key order means
// nothing and a builder may emit it differently — and the non-HTML routes
// (sitemap.xml, feed.xml, robots.txt, the icons) are copied as they are:
//
//   node scripts/parity.mjs before        # on the base commit
//   node scripts/parity.mjs after         # with the change applied
//   diff -r .parity/before .parity/after && echo identical
//
// Everything is read under the directory it runs in: the site's build script
// (`pnpm build`), its .next and its .parity.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { SPECS } from "./lib/specs.mjs";

const [label] = parseOrExit(SPECS.parity, process.argv.slice(2)).positionals;
const root = process.cwd();
const app = path.join(root, ".next/server/app");
const out = path.join(root, ".parity", label);
fs.mkdirSync(path.join(root, ".parity"), { recursive: true });

const log = path.join(root, ".parity", `${label}.build.log`);
const build = spawnSync("pnpm", ["build"], { cwd: root, stdio: ["ignore", fs.openSync(log, "w"), fs.openSync(log, "a")] });
if (build.status !== 0) {
  console.error(`build failed, see .parity/${label}.build.log`);
  process.exit(1);
}

/** Every file under dir with the extension, as paths relative to dir. */
function filesUnder(dir, ext) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)));
}

/** The value with every object's keys sorted, recursively (jq -S). */
const sortKeys = (value) => (Array.isArray(value) ? value.map(sortKeys) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])])) : value);

const write = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
  fs.writeFileSync(path.join(out, rel), text);
};

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const pages = filesUnder(app, ".html");
for (const rel of pages) {
  const html = fs.readFileSync(path.join(app, rel), "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.stringify(sortKeys(JSON.parse(m[1]))));
  write(rel.replace(/\.html$/, ".jsonld"), blocks.map((block) => `${block}\n`).join(""));
  write(
    rel,
    html
      .replace(/<script\b[^>]*>.*?<\/script>/gs, "")
      .replace(/<link\b[^>]*\/_next\/static\/[^>]*>/g, "")
      .replace(/<link rel="preload"[^>]*>/g, ""),
  );
}
const bodies = filesUnder(app, ".body");
for (const rel of bodies) write(rel, fs.readFileSync(path.join(app, rel)));
console.log(`${label}: ${pages.length} pages, ${pages.length} jsonld, ${bodies.length} bodies in .parity/${label}`);
