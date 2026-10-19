// The CI workflow `init` writes into a site (templates/site/verify.yml) runs
// the actions the kit's own workflow runs, pinned to the same commits.
// Dependabot reads .github/workflows/ alone, so its bump of the kit's pins
// fails here until the template follows. Run with `pnpm test`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const REPO = path.resolve(import.meta.dirname, "..");
const KIT = ".github/workflows/verify.yml";
const TEMPLATE = "templates/site/verify.yml";

/** Every `uses:` line of a workflow, as action → the pins it is written with (`<ref> # <version>`). */
function pins(file) {
  const out = new Map();
  const text = fs.readFileSync(path.join(REPO, file), "utf8");
  for (const [, action, ref, version] of text.matchAll(/^[ \t-]*uses:[ \t]*([^@\s]+)@(\S+)(?:[ \t]+#[ \t]*(\S+))?/gm)) {
    out.set(action, (out.get(action) ?? new Set()).add(`${ref} # ${version ?? "(no version comment)"}`));
  }
  return out;
}

/** One line per action the template pins otherwise than the kit, naming the fix; [] when they agree. */
function drift(kit, template) {
  const out = [];
  for (const [action, used] of template) {
    const wanted = kit.get(action);
    if (!wanted) out.push(`${TEMPLATE} uses ${action}, which ${KIT} does not: nothing keeps its pin current; run it in the kit's workflow too, where Dependabot updates it, or keep it out of the template`);
    else if (wanted.size > 1) out.push(`${KIT} pins ${action} twice (${[...wanted].join(", ")}): give every job the same pin`);
    else if ([...used].join() !== [...wanted].join()) out.push(`${TEMPLATE} pins ${action} to ${[...used].join(", ")}, ${KIT} to ${[...wanted][0]}`);
  }
  return out;
}

test("the site's workflow pins every action to the commit the kit's own workflow pins it to", () => {
  const template = pins(TEMPLATE);
  assert.ok(template.size > 0, `${TEMPLATE}: no uses: line found`);
  const found = drift(pins(KIT), template);
  assert.deepEqual(found, [], `${found.join("\n")}\nCopy the kit's pins (each sha with its version comment) into the template, read each new version's changelog for an input the template relies on, and add a line for the sites under Unreleased in docs/upgrading.md.`);
});
