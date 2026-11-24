import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultRoot } from "./app-root.mjs";

const tree = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-"));
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "x");
  }
  return root;
};

test("defaultRoot: src/app with its root layout; in a site in several languages, the route group that holds the default language's", () => {
  const cases = [
    [["src/app/layout.tsx", "src/app/[[...slug]]/page.tsx"], "src/app"],
    [["src/app/(default)/layout.tsx", "src/app/de/layout.tsx", "src/app/global-not-found.tsx"], "src/app/(default)"],
    [["src/app/(marketing)/page.tsx", "src/app/(site)/layout.tsx"], "src/app/(site)"],
    [[], "src/app"],
  ];
  for (const [files, expected] of cases) {
    const root = tree(files);
    try { assert.equal(defaultRoot(root), expected, files.join(", ")); } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});
