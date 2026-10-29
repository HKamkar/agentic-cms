// The migrations `agentic-cms upgrade` runs, each on a fixture site as the
// release before it left one (tools/migration-fixture.mjs): what detect()
// finds, what apply() changes, a second apply changing nothing, and every
// manual step linking a section docs/upgrading.md has.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { agentFiles } from "../scripts/lib/agent-files.mjs";
import { scaffold } from "../scripts/lib/init.mjs";
import { apply, detect, GUIDE, PIECES } from "../scripts/migrations/0.9.0.mjs";
import { EDITS, site084 } from "./migration-fixture.mjs";

const KIT = path.resolve(import.meta.dirname, "..");
const quiet = { log: () => {} };
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
/** A fresh site with 0.8.4's agent files over it. */
function site084Fixture() {
  const site = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "migrate-")), "site");
  scaffold(site, { name: "My Site", kitRoot: KIT, version: "0.9.0", ...quiet });
  site084(site, { kitRoot: KIT });
  return site;
}
/** Every heading's anchor in docs/upgrading.md, as GitHub writes it. */
const anchors = () => [...read(KIT, "docs/upgrading.md").matchAll(/^#{2,3} (.+)$/gm)].map(([, heading]) => heading.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, "").replaceAll(" ", "-"));

test("0.9.0 on a site as 0.8.4 left it: the agent files' copies found, moved by apply, the site's edits kept as its own, and AGENTS.md and CLAUDE.md left by hand", () => {
  const site = site084Fixture();
  const found = detect(site, { kitRoot: KIT, ...quiet });
  assert.ok(found.length > 20 && found.every(({ piece }) => piece === "agent files"));
  assert.ok(found.some(({ what }) => what.startsWith(".claude/skills/design: what init copied before 0.9.0")));
  assert.ok(found.some(({ what }) => what.startsWith("by hand: AGENTS.md")) && found.some(({ what }) => what.startsWith("by hand: CLAUDE.md")));
  const { changed, manual } = apply(site, { kitRoot: KIT, ...quiet });
  const status = Object.fromEntries(changed.map(({ file, status: s }) => [file, s]));
  assert.equal(status[".claude/skills/design"], "removed");
  assert.equal(status[".claude/skills/design-proof"], "moved", "the site's edit becomes its own");
  assert.equal(status[".claude/rules/seo.md"], "thin");
  assert.ok(read(site, ".claude/rules/seo.md").endsWith("- The site's own: every page title ends with the brand.\n"), "its own line kept");
  assert.ok(fs.existsSync(path.join(site, ".claude/skills/design-proof-site/SKILL.md")));
  assert.deepEqual(manual.map(({ text }) => text.split(" ")[0]), ["AGENTS.md", "CLAUDE.md", ".claude/skills/design-proof-site"]);
  assert.ok(manual.every(({ link }) => link === GUIDE));
  assert.ok(Object.keys(EDITS).length && !fs.existsSync(path.join(site, ".agentic-cms/base")));
});

test("0.9.0 applied twice changes nothing the second time and still names the steps left by hand; after init --agent-files the site's check is clean", () => {
  const site = site084Fixture();
  apply(site, { kitRoot: KIT, ...quiet });
  agentFiles(site, { kitRoot: KIT, version: "0.9.0", ...quiet });
  const before = read(site, ".claude/rules/seo.md");
  const second = apply(site, { kitRoot: KIT, ...quiet });
  assert.deepEqual(second.changed, []);
  assert.equal(read(site, ".claude/rules/seo.md"), before);
  assert.equal(second.manual.length, 3);
  assert.deepEqual(detect(site, { kitRoot: KIT, ...quiet }).map(({ what }) => what.slice(0, 18)), ["by hand: AGENTS.md", "by hand: CLAUDE.md", "by hand: .claude/s"]);
  assert.deepEqual(agentFiles(site, { kitRoot: KIT, version: "0.9.0", check: true, ...quiet }).filter((f) => !["ok", "modified"].includes(f.status)), []);
  fs.writeFileSync(path.join(site, "AGENTS.md"), read(KIT, "templates/site/AGENTS.md"));
  fs.writeFileSync(path.join(site, "CLAUDE.md"), read(KIT, "templates/site/CLAUDE.md"));
  fs.rmSync(path.join(site, ".claude/skills/design-proof-site"), { recursive: true });
  assert.deepEqual(detect(site, { kitRoot: KIT, ...quiet }), [], "the steps taken: nothing left");
});

test("0.9.0 finds nothing on a site laid out by this kit, and every manual step it prints links a section of docs/upgrading.md", () => {
  const site = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "migrate-")), "site");
  scaffold(site, { name: "My Site", kitRoot: KIT, version: "0.9.0", ...quiet });
  assert.deepEqual(detect(site, { kitRoot: KIT, ...quiet }), []);
  assert.ok(anchors().includes(GUIDE.split("#")[1]), `${GUIDE}: a heading of docs/upgrading.md`);
  assert.ok(PIECES.every(({ piece, detect: found, apply: change }) => piece && typeof found === "function" && typeof change === "function"));
});
