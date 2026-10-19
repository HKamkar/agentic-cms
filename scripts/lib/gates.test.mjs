import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGaps, buildScript, EMAIL_GUARD, GatesError, guardsEmail, hasAddress, LINT, lintGaps, mergeBuild, mergeLint } from "./gates.mjs";

const BUILD = "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email";
const ids = (gates) => gates.map((gate) => gate.id);

test("a new site's lint is ESLint then the site check, its build the gates joined by && — the e-mail guard among them only once D5's switch is on", () => {
  assert.equal(LINT, "eslint; s=$?; agentic-cms check-site || s=1; exit $s");
  assert.equal(buildScript({ guard: true }), BUILD, "the machinery, ready for the switch");
  assert.equal(buildScript({ guard: false }), BUILD.replace(" && agentic-cms guard-email", ""));
  assert.equal(hasAddress('export const site = { email: "hello@ours.dev" };'), true);
  assert.equal(hasAddress("export const site = { name: `Ours`, url: \"https://ours.dev\" };"), false);
  assert.equal(EMAIL_GUARD, false, "guard-email stays a step a site adds until 0.8.2 job 4b: the starter and the example carry their address into served files today");
  assert.equal(guardsEmail('export const site = { email: "hello@ours.dev" };'), false, "so no site's build is asked for it");
});

test("the lint's gates are read from its commands, through any form of the command line, and a masked failure is named", () => {
  assert.deepEqual(lintGaps(LINT), { missing: [], masked: false });
  assert.deepEqual(lintGaps("eslint; s=$?; node bin/agentic-cms.mjs check-site || s=1; exit $s"), { missing: [], masked: false }, "the kit's own checkout");
  assert.deepEqual(lintGaps("pnpm exec eslint . && pnpm kit check-site --json"), { missing: [], masked: false });
  assert.deepEqual(ids(lintGaps("eslint; s=$?; agentic-cms check-components || s=1; exit $s").missing), ["check-site"]);
  assert.deepEqual(ids(lintGaps("biome lint .").missing), ["eslint", "check-site"]);
  assert.deepEqual(ids(lintGaps(undefined).missing), ["eslint", "check-site"]);
  for (const masked of ["eslint || true", "eslint; agentic-cms check-site; exit 0", "eslint && agentic-cms check-site || :"]) assert.equal(lintGaps(masked).masked, true, masked);
});

test("the build's gates are steps of its && chain, on their side of next build", () => {
  assert.deepEqual(buildGaps(BUILD, { guard: true }), { missing: [], misplaced: [], masked: false });
  assert.deepEqual(buildGaps("pnpm run lint && node bin/agentic-cms.mjs lint --strict --production && pnpm kit docs --check && NODE_OPTIONS=--max-old-space-size=4096 next build --turbopack && npx agentic-cms seo", { guard: false }), { missing: [], misplaced: [], masked: false }, "flags, an environment and the command line's other forms");
  assert.deepEqual(ids(buildGaps("agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo", { guard: true }).missing), ["lint", "guard-email"]);
  assert.deepEqual(ids(buildGaps("agentic-cms lint && next build", { guard: false }).missing), ["lint", "content-lint", "docs", "seo"], "the content lint without --production is not the gate: a placeholder would ship");
  assert.deepEqual(ids(buildGaps("pnpm lint; agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo", { guard: false }).missing), ["lint", "content-lint"], "gates joined by ; are no steps: a failure would not stop the build");
  assert.deepEqual(ids(buildGaps("pnpm lint && agentic-cms lint --production && next build && agentic-cms docs --check && agentic-cms seo", { guard: false }).misplaced), ["docs"]);
  assert.equal(buildGaps(`${BUILD} || true`, { guard: true }).masked, true);
});

test("mergeLint keeps a lint that holds the gates, swaps check-components, puts the check after the site's ESLint, and refuses the rest", () => {
  assert.deepEqual(mergeLint(undefined), { script: LINT, note: null });
  assert.deepEqual(mergeLint(LINT), { script: LINT, note: null });
  assert.deepEqual(mergeLint("eslint; s=$?; pnpm exec agentic-cms check-components || s=1; exit $s"), { script: "eslint; s=$?; pnpm exec agentic-cms check-site || s=1; exit $s", note: "lint: check-site in place of check-components" });
  assert.deepEqual(mergeLint("eslint src --cache"), { script: "eslint src --cache; s=$?; agentic-cms check-site || s=1; exit $s", note: "lint: check-site after the site's ESLint" });
  assert.throws(() => mergeLint("tsc --noEmit"), (error) => error instanceof GatesError && /runs no ESLint/.test(error.message));
  assert.throws(() => mergeLint("eslint; s=$?; tsc || s=1; exit $s"), (error) => error instanceof GatesError && /ends in an exit the site check would never run after/.test(error.message));
  assert.throws(() => mergeLint("eslint || true"), /turns a failure into a pass/);
});

test("mergeBuild puts each missing gate in its place around the site's own steps, and refuses a build it cannot read", () => {
  assert.deepEqual(mergeBuild("", { guard: true }), { script: BUILD, note: null });
  assert.deepEqual(mergeBuild(BUILD, { guard: true }), { script: BUILD, note: null });
  assert.deepEqual(mergeBuild("next build", { guard: true }), { script: BUILD, note: "build: pnpm lint, agentic-cms lint --production, agentic-cms docs --check, agentic-cms seo, agentic-cms guard-email added" });
  assert.equal(mergeBuild("node scripts/og.mjs && next build && agentic-cms assemble", { guard: false }).script, "pnpm lint && node scripts/og.mjs && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms assemble", "the lint first, the other gates right ahead of next build, the site's own steps where they were");
  assert.equal(mergeBuild("agentic-cms docs --check && next build && agentic-cms critical-css && agentic-cms seo", { guard: true }).script, "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms critical-css && agentic-cms seo && agentic-cms guard-email");
  assert.throws(() => mergeBuild("vite build", { guard: false }), (error) => error instanceof GatesError && /runs no next build as a step of its && chain/.test(error.message));
  assert.throws(() => mergeBuild("agentic-cms seo && next build", { guard: false }), /runs agentic-cms seo on the wrong side of next build/);
  assert.throws(() => mergeBuild("next build || true", { guard: false }), /turns a failure into a pass/);
});
