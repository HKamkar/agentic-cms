// Fixtures for the engine's tests: a scratch tree in a temp directory that
// the process changes into while the test runs (the engine reads
// <cwd>/content), so no test ever writes under the repo's content/, and an
// assertion that reads like the README's error catalogue. Tests run without
// NODE_ENV, so nothing is cached between them.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ContentError } from "./errors";

/** Runs fn inside a fresh tree whose content/ holds `files` (paths relative to content/, e.g. "blog/x.md"). */
export function withContent<T>(files: Record<string, string>, fn: (root: string) => T): T {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "content-"));
  const previous = process.cwd();
  try {
    for (const [file, text] of Object.entries(files)) {
      const target = path.join(root, "content", file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
    }
    process.chdir(root);
    return fn(root);
  } finally {
    process.chdir(previous);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/** Asserts fn throws a ContentError whose message contains every fragment, and returns it. */
export function expectContentError(fn: () => unknown, ...fragments: string[]): ContentError {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ContentError, `expected a ContentError, got ${String(caught)}`);
  for (const fragment of fragments) assert.ok(caught.message.includes(fragment), `expected "${fragment}" in:\n${caught.message}`);
  return caught;
}

/** A post file from frontmatter lines; the registries every post needs sit next to it. */
export function postTree(frontmatter: string, name = "x.md"): Record<string, string> {
  return {
    "authors.json": JSON.stringify({ "h-kamkar": { name: "H. Kamkar" } }),
    "categories.json": JSON.stringify({ fintech: { name: "Fintech" }, "private-ai": { name: "Private AI" } }),
    [`blog/${name}`]: `---\n${frontmatter}\n---\n\nBody.\n`,
  };
}

export const VALID_POST = 'title: A post\nexcerpt: What the reader gets.\ndate: "2026-05-02"\ncategory: fintech\nauthor: h-kamkar';
