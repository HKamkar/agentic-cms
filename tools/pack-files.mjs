#!/usr/bin/env node
// The tarball as a contract. Every path `pnpm pack` puts in the package is
// listed in tools/pack-files.txt, so a file entering or leaving the package
// shows in review: `pnpm docs:pack` packs and rewrites the list, and
// `pnpm lint:pkg` (CI's test job) fails a tarball that differs from it.
// Beside the list, what no tarball may hold — the paths hygiene refuses in
// the repository, and tests, fixtures and environment files besides — and
// the bare imports of the files that run from the package (dist/, scripts/,
// bin/): each a Node builtin, the package itself, the site's `@/` alias, or
// a dependency or a peer the manifest declares (a declaration file's may be
// met by its @types package). Packing runs `prepack`, which empties dist/,
// then `prepare`, which builds it from this tree.
//
//   node tools/pack-files.mjs            (pnpm docs:pack) packs, and rewrites the list
//   node tools/pack-files.mjs --check    exits 1 when the list is stale
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { isBuiltin } from "node:module";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { pathFindings } from "./hygiene.mjs";

export const LIST = "tools/pack-files.txt";
const ROOT = path.resolve(import.meta.dirname, "..");

/** Packs the package at root into dest (pnpm pack, its lifecycle included) and returns the tarball's path. */
export function pack(root, dest) {
  const packed = execFileSync("pnpm", ["pack", "--pack-destination", dest, "--json"], { cwd: root, encoding: "utf8" });
  return path.join(dest, path.basename(JSON.parse(packed.slice(packed.search(/^\{/m))).filename));
}

/** The files of a tarball, as the package's paths (no `package/` prefix), sorted. */
export function tarballFiles(tarball) {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter((entry) => entry && !entry.endsWith("/")).map((entry) => entry.replace(/^package\//, "")).sort();
}

/** The paths no tarball may hold, beside hygiene's own. */
const REFUSED = [
  [/\.test\.(?:[cm]?[jt]sx?)$/, "a test"],
  [/(?:^|\/)fixtures?\/|[.-]fixture\.[cm]?[jt]s$/, "a fixture"],
  [/(?:^|\/)\.env(?!\.example$)/, "an environment file (only .env.example ships)"],
];

/** What makes a path of the tarball refused: hygiene's path rules (a capture, a scratch file, a picture out of place), a test, a fixture, an environment file; [] when none. */
export function refusedPaths(files) {
  return files.flatMap((file) => [...pathFindings(file), ...REFUSED.filter(([re]) => re.test(file)).map(([, what]) => `${file}: ${what}`)]);
}

/** The bare specifiers a file imports, requires or references: static and dynamic imports with a literal, `export … from`, `require()`, `/// <reference types>`. */
export function bareImports(text) {
  const { importedFiles, typeReferenceDirectives } = ts.preProcessFile(text, true, true);
  return [...new Set([...importedFiles, ...typeReferenceDirectives].map((ref) => ref.fileName).filter((name) => !/^(?:\.{1,2}\/|\/|[a-z][\w+.-]*:\/\/)/.test(name) && name !== "." && name !== ".."))];
}

/** A specifier's package: `@scope/name` or `name`. */
export const packageOf = (specifier) => specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/");

/** The files that run from the package, whose imports must resolve in a site. */
export const RUNS = /^(?:dist\/.+\.(?:js|d\.ts)|scripts\/.+\.(?:mjs|d\.mts)|bin\/.+\.mjs)$/;

/** Each bare import of a running file that nothing declares: { file, specifier }; [] when the manifest covers them all. */
export function undeclaredImports(files, read, manifest) {
  const declared = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})]);
  const types = (name) => `@types/${name.startsWith("@") ? name.slice(1).replace("/", "__") : name}`;
  const met = (specifier, file) => {
    const name = packageOf(specifier);
    return isBuiltin(specifier) || specifier.startsWith("@/") || name === manifest.name || declared.has(name) || (/\.d\.m?ts$/.test(file) && declared.has(types(name)));
  };
  return files.filter((file) => RUNS.test(file)).flatMap((file) => bareImports(read(file)).filter((specifier) => !met(specifier, file)).map((specifier) => ({ file, specifier })));
}

/** The list as tools/pack-files.txt holds it. */
export const listText = (files) => `${files.join("\n")}\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-pack-"));
  try {
    const files = tarballFiles(pack(ROOT, dest));
    const text = listText(files);
    if (process.argv.includes("--check")) {
      if (fs.readFileSync(path.join(ROOT, LIST), "utf8") !== text) { console.error(`pack-files: ${LIST} is out of date — run pnpm docs:pack and commit it`); process.exit(1); }
      console.log(`pack-files: ${LIST} is up to date (${files.length} files)`);
    } else {
      fs.writeFileSync(path.join(ROOT, LIST), text);
      console.log(`pack-files: wrote ${files.length} files to ${LIST}`);
    }
  } finally { fs.rmSync(dest, { recursive: true, force: true }); }
}
