// The change a site from before 0.9.0 needs for its redirects: the
// starter's empty content/redirects.yaml where it has none, and its Next
// config's redirects() returning redirectsFor() — 0.8's template becoming
// this one's exactly, a CommonJS config taking a require, a config with
// redirects of its own or no object to find a manual step, and nothing
// changed the second time.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { REDIRECTS_FILE, redirectEdits, withRedirects } from "./redirects.mjs";

const KIT = path.resolve(import.meta.dirname, "../..");
/** templates/site/next.config.ts as 0.8.4 shipped it, which a site laid out by 0.8 has. */
const TEMPLATE_0_8 = "import type { NextConfig } from \"next\";\n\n// Extra hostnames (no scheme or port) allowed to load dev assets and HMR, e.g.\n// the public IP of a dev VM. `next dev` otherwise only serves localhost and\n// the hostname it was started with. Set in `.env.local`, comma-separated.\nconst allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(\",\")\n  .map((host) => host.trim())\n  .filter(Boolean);\n\nconst nextConfig: NextConfig = {\n  // Images are pre-sized files shipped with the repo; the optimizer is off\n  // so no image service is needed wherever the site runs.\n  images: { unoptimized: true },\n  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),\n};\n\nexport default nextConfig;\n";

test("0.8's template takes redirects() as this one has it, and once only", () => {
  const { text } = withRedirects(TEMPLATE_0_8);
  assert.equal(text, fs.readFileSync(path.join(KIT, "templates/site/next.config.ts"), "utf8"));
  assert.deepEqual(withRedirects(text), { text }, "a config that calls redirectsFor() is left as it is");
});

test("a CommonJS config takes a require; one with redirects of its own, or no object to find, is a manual step", () => {
  const cjs = withRedirects("const path = require(\"node:path\");\n\nmodule.exports = {\n    images: { unoptimized: true },\n};\n").text;
  assert.equal(cjs, "const path = require(\"node:path\");\nconst { redirectsFor } = require(\"agentic-cms/content\");\n\nmodule.exports = {\n    // content/redirects.yaml, read when Next loads this file at build time:\n    // an indexed URL that moved answers 308 to where it went (docs/redirects.md).\n    redirects: async () => redirectsFor(),\n    images: { unoptimized: true },\n};\n");
  assert.match(withRedirects("export default {\n  async redirects() {\n    return [];\n  },\n};\n").manual, /has a redirects\(\) of its own: return \[\.\.\.redirectsFor\(\), \.\.\.the site's own\]/);
  assert.match(withRedirects("export default withPlugins(config);\n").manual, /no config object the edit can find/);
});

test("redirectEdits: the empty list and the config where a site lacks them, nothing once it has both", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "redirects-"));
  try {
    fs.writeFileSync(path.join(root, "next.config.ts"), TEMPLATE_0_8);
    const { edits, manual } = redirectEdits(root, { fs, kitRoot: KIT });
    assert.deepEqual(manual, []);
    assert.deepEqual(edits.map(({ file }) => file), [REDIRECTS_FILE, "next.config.ts"]);
    assert.equal(edits[0].text, fs.readFileSync(path.join(KIT, "templates/starter/content/redirects.yaml"), "utf8"));
    for (const { file, text } of edits) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
    assert.deepEqual(redirectEdits(root, { fs, kitRoot: KIT }), { edits: [], manual: [] });
    fs.rmSync(path.join(root, "next.config.ts"));
    assert.match(redirectEdits(root, { fs, kitRoot: KIT }).manual[0].step, /no Next config: take node_modules\/agentic-cms\/templates\/site\/next\.config\.ts/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
