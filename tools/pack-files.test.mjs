import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { listDrift, tarballFindings } from "./lint-pkg.mjs";
import { bareImports, LIST, packageOf, refusedPaths, undeclaredImports } from "./pack-files.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const LISTED = read(LIST).split("\n").filter(Boolean);
const MANIFEST = JSON.parse(read("package.json"));

test("a test, a fixture, an environment file, a capture, a scratch file or a stray picture is refused in the tarball; the rest passes", () => {
  const refused = ["scripts/lib/x.test.mjs", "src/lib/a.test.ts", "scripts/fixtures/site/a.json", "tools/upgrade-fixture.mjs", ".env", ".env.local", "templates/site/.env.production", ".parity/a/b.png", "notes.md", "scripts/x.bak", "templates/site/shot.png"];
  const found = refusedPaths(refused);
  for (const file of refused) assert.ok(found.some((line) => line.startsWith(`${file}: `)), `${file} is refused`);
  assert.deepEqual(refusedPaths([".env.example", "dist/index.js", "templates/starter/public/images/home/hero.webp", "src/app/icon.png", "docs/testing.md", "scripts/lib/fixture-free.mjs"]), []);
});

test("the committed list is sorted, holds no path a tarball refuses, and ships what a site runs and no example", () => {
  assert.deepEqual(LISTED, [...LISTED].sort());
  assert.deepEqual(refusedPaths(LISTED), []);
  for (const file of ["bin/agentic-cms.mjs", "dist/index.js", "dist/index.d.ts", "scripts/lib/load-ts.d.mts", "scripts/lib/component-lint.d.mts", "README.md", "LICENSE", "package.json"]) assert.ok(LISTED.includes(file), file);
  assert.ok(!LISTED.some((file) => /^content\/(?:pages|blog)\/(?!_)/.test(file) || file.startsWith("public/") || file.startsWith("docs/readme/")), "the example's content and pictures stay in the repository");
});

test("a file's bare imports: static, dynamic with a literal, re-exports, require and a type reference at the top; relative paths and computed specifiers are not", () => {
  const text = '/// <reference types="mdx" />\nimport a from "react";\nimport { b } from "next/link";\nimport type { C } from "hast";\nexport { d } from "@scope/pkg/sub";\nconst e = await import("node:fs");\nconst f = require("yaml");\nimport g from "./g.mjs";\nimport h from "../h.mjs";\nconst i = await import(`../scripts/${name}.mjs`);\n';
  assert.deepEqual(bareImports(text).sort(), ["@scope/pkg/sub", "hast", "mdx", "next/link", "node:fs", "react", "yaml"]);
  assert.equal(packageOf("@scope/pkg/sub"), "@scope/pkg");
  assert.equal(packageOf("next/link"), "next");
});

test("a running file's import is met by a builtin, the package itself, the site's alias, a dependency or a peer; a declaration file's also by its @types", () => {
  const files = { "dist/a.js": 'import "node:fs"; import "fs"; import "agentic-cms/content"; import "@/kit"; import "yaml"; import "react/jsx-runtime"; import "lodash";', "dist/a.d.ts": 'import type { R } from "hast"; import type { S } from "@scope/types";', "scripts/b.mjs": 'import "hast"; import "eslint";', "bin/c.mjs": 'import "chalk";', "templates/site/x.mjs": 'import "anything";', "src/app/page.tsx": 'import "next/link";' };
  const manifest = { name: "agentic-cms", dependencies: { yaml: "^2", "@types/hast": "^3", "@types/scope__types": "^1" }, peerDependencies: { react: "^19", eslint: ">=9" } };
  const found = undeclaredImports(Object.keys(files), (file) => files[file], manifest).map(({ file, specifier }) => `${file} ${specifier}`);
  assert.deepEqual(found, ["dist/a.js lodash", "scripts/b.mjs hast", "bin/c.mjs chalk"], "only what runs from the package is read; @types meets a declaration file's import alone");
});

test("the checkout's command line imports nothing package.json does not declare (lint:pkg reads dist/ in the tarball)", () => {
  const running = LISTED.filter((file) => /^(?:scripts|bin)\//.test(file));
  assert.ok(running.length > 50);
  assert.deepEqual(undeclaredImports(running, read, MANIFEST), []);
});

test("the tarball's files against the list: what each side lacks; a manifest that would run on install, a site's name and an undeclared import are findings", () => {
  assert.deepEqual(listDrift(["a", "b", "d"], ["a", "c", "d"]), ["+ b", "- c"]);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lint-pkg-"));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  try {
    write("README.md", "# kit\n");
    write("dist/index.js", 'import "left-pad";\n');
    write("docs/a.md", "built for nimbus\n");
    write("package.json", "{}\n");
    const files = ["README.md", "dist/index.js", "docs/a.md", "package.json"];
    const manifest = { name: "agentic-cms", scripts: { postinstall: "node x.mjs", build: "next build" }, dependencies: {} };
    const found = tarballFindings({ files, listed: files, root, manifest, brands: ["nimbus"] });
    assert.ok(found.some((line) => line.includes("postinstall") && line.includes("registry install")), found.join("\n"));
    assert.ok(found.some((line) => line.startsWith("docs/a.md:1: names nimbus")), found.join("\n"));
    assert.ok(found.some((line) => line === "dist/index.js: imports left-pad, which is no Node builtin and no dependency or peer of package.json"), found.join("\n"));
    assert.ok(!found.some((line) => line.includes(LIST)), "the list matches");
    assert.match(tarballFindings({ files, listed: files.slice(1), root, manifest: { name: "agentic-cms" }, brands: [] })[0], /tools\/pack-files\.txt is stale \(\+ README\.md\)/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
