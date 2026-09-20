// A throwaway site root for the browser tests: the fixture pages laid out the
// way a Next build leaves them (.next/server/app/<route>.html) beside a
// public/ folder, so serveStatic() and the commands read it like a real site.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FIXTURES = import.meta.dirname;

/** Creates the tmp site and returns its root; the caller removes it. */
export function fixtureSite() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-fixture-"));
  fs.cpSync(path.join(FIXTURES, "pages"), path.join(root, ".next/server/app"), { recursive: true });
  fs.cpSync(path.join(FIXTURES, "public"), path.join(root, "public"), { recursive: true });
  return root;
}
