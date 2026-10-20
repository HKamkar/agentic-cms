import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { exampleFiles, isSample, releaseTags } from "./example-files.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const tags = (() => { try { return execFileSync("git", ["tag", "--list", "v*"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean); } catch { return []; } })();

test("the releases a site could have taken the example from: v0.2.0 to 0.8.1, by version, no pre-release", () => {
  assert.deepEqual(releaseTags(["v0.10.0", "v0.8.1", "v0.2.0", "v0.8.2", "v0.8.1-rc.1", "v0.7.10", "v0.9.0"]), ["v0.2.0", "v0.7.10", "v0.8.1"]);
});

test("a sample is under content/ or public/, none of the kit's docs, templates or categories, nothing the content engine skips", () => {
  assert.deepEqual(["content/blog/a.md", "public/images/x.webp", "content/README.md", "content/VOICE.md", "content/_templates/page.yaml", "content/editorial/backlog.md", "content/categories.json", "content/blog/_template.md", "src/config/site.ts"].filter(isSample), ["content/blog/a.md", "public/images/x.webp"]);
});

test("the shipped list is the one the kit's tags write", { skip: tags.includes("v0.8.1") ? false : "no release tags in this checkout (git fetch --tags)" }, () => {
  const shipped = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/lib/example-files.json"), "utf8"));
  assert.deepEqual(exampleFiles(releaseTags(tags)), shipped);
});
