// The package's peers (D6 of the 0.9.0 plan): each range bounded to one
// major, what CI installs inside it, docs/stability.md § Peers row for row,
// and both ends tested on the Node floor engines names (the peers workflow,
// the unit suites' job), through tools/pack-smoke.mjs --peers.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { floorOf, installedAtEnd, kitUnmetPeers, peerSpecs } from "./pack-smoke.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const PKG = JSON.parse(read("package.json"));
const PEERS = PKG.peerDependencies;

test("every peer is bounded to one major, ^X.Y.Z, and what this checkout runs lies within it", () => {
  for (const [name, range] of Object.entries(PEERS)) {
    assert.doesNotThrow(() => floorOf(range), `${name} ${range}`);
    const installed = JSON.parse(read(`node_modules/${name}/package.json`)).version;
    assert.ok(installedAtEnd(installed, range, "newest"), `${name} ${installed}, installed here, is outside ${range}`);
  }
  assert.throws(() => floorOf(">=16.3.6"), /not \^X\.Y\.Z/);
  assert.throws(() => floorOf("^9"), /not \^X\.Y\.Z/);
});

test("docs/stability.md § Peers has a row per peer and one for Node, each with package.json's range, the optional ones marked", () => {
  const page = read("docs/stability.md");
  const section = page.slice(page.indexOf("### Peers"), page.indexOf("### File formats"));
  const rows = Object.fromEntries([...section.matchAll(/^\| (`[^`]+`|Node \(`engines`\)) \| `([^`]+)`(, optional)? \|/gm)].map(([, name, range, optional]) => [name, { range, optional: Boolean(optional) }]));
  const expected = Object.fromEntries(Object.entries(PEERS).map(([name, range]) => [`\`${name}\``, { range, optional: Boolean(PKG.peerDependenciesMeta?.[name]?.optional) }]));
  assert.deepEqual(rows, { ...expected, "Node (`engines`)": { range: PKG.engines.node, optional: false } });
});

test("the floor's runs use the Node floor engines names, and the newest end .nvmrc's", () => {
  const floor = PKG.engines.node.replace(/^>=/, "");
  const peers = parseYaml(read(".github/workflows/peers.yml"));
  const matrix = Object.fromEntries(peers.jobs.peers.strategy.matrix.include.map((leg) => [leg.end, leg]));
  assert.deepEqual(Object.keys(matrix).sort(), ["floor", "newest"]);
  assert.equal(matrix.floor.node, floor);
  assert.equal(matrix.newest["node-file"], ".nvmrc");
  assert.ok(peers.on.pull_request.paths.includes("package.json") && peers.on.schedule.length && peers.on.push.branches.includes("main"));
  const verify = parseYaml(read(".github/workflows/verify.yml"));
  const setup = verify.jobs["node-floor"].steps.find((step) => step.uses?.startsWith("actions/setup-node@"));
  assert.equal(setup.with["node-version"], floor);
  assert.ok(verify.jobs["node-floor"].steps.some((step) => step.run === "pnpm test"));
});

test("--peers writes each peer's floor or its range, eslint-config-next with next, and holds what was installed to that end", () => {
  assert.deepEqual(peerSpecs({ next: "^16.3.6", zod: "^4.6.2" }, "floor"), { next: "16.3.6", zod: "4.6.2", "eslint-config-next": "16.3.6" });
  assert.deepEqual(peerSpecs({ next: "^16.3.6" }, "newest"), { next: "^16.3.6", "eslint-config-next": "^16.3.6" });
  assert.ok(installedAtEnd("16.3.6", "^16.3.6", "floor"));
  assert.ok(!installedAtEnd("16.3.8", "^16.3.6", "floor"));
  assert.ok(installedAtEnd("16.4.3", "^16.3.6", "newest"));
  assert.ok(!installedAtEnd("16.3.5", "^16.3.6", "newest"));
  assert.ok(!installedAtEnd("17.0.0", "^16.3.6", "newest"));
  const report = "Issues with peer dependencies found\n\n✕ unmet peer eslint\n  Installed: 10.13.0\n  Wanted:\n    ^9.22.0:\n      agentic-cms@0.9.0\n✕ unmet peer typescript\n  Installed: 6.0.0\n  Wanted:\n    ^5:\n      eslint-config-next@16.3.6\n";
  assert.deepEqual(kitUnmetPeers(report), ["eslint"], "an unmet peer of another package is not the kit's");
});
