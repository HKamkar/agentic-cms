// The gates a site's package.json holds, written once for the two that read
// them: `init`, which writes them into a new site's scripts and merges them
// into an existing site's, and `check-site`'s `scripts` pass, which fails a
// site whose `lint` or `build` dropped one. The lint is ESLint, then
// `agentic-cms check-site`, failing on either while both report; the build
// runs the lint first (D4: agents run the build more often than the lint, and
// a warning never fails it), then the content lint for production (a
// placeholder fails it), the field tables' check, `next build` and the SEO
// audit. `guard-email` after them (D5) for a site whose src/config/site.ts
// turns `guardEmail` on, as `init` writes it for a new site (0.8.2 job 4b);
// a site without the key builds as it did, the guard a step it may add
// itself. A gate is a step of the build's `&&` chain, so a failing one stops
// the build.
// A command is the installed bin (`agentic-cms`, through pnpm exec, npx or
// the site's `pnpm kit`), or `node bin/agentic-cms.mjs` in the kit's own
// checkout.

const CLI = String.raw`(?:agentic-cms|pnpm (?:exec )?agentic-cms|npx agentic-cms|pnpm kit|node bin\/agentic-cms\.mjs)`;
const kit = (command) => new RegExp(`^${CLI} ${command}`);

/** The lint a new site runs: ESLint, then the site check, failing on either while both report. */
export const LINT = "eslint; s=$?; agentic-cms check-site || s=1; exit $s";

/** The lint's gates, each a command of the script. */
export const LINT_GATES = [
  { id: "eslint", command: "eslint", test: /^(?:pnpm (?:exec )?|npx )?eslint(?:\s|$)/ },
  { id: "check-site", command: "agentic-cms check-site", test: kit(String.raw`check-site(?:\s|$)`) },
];

/** The build's gates in their order, each a step of its `&&` chain: before `next build` (the lint first of all), the build itself, after it; guard-email only with `guard`. */
export const BUILD_GATES = [
  { id: "lint", command: "pnpm lint", test: /^(?:pnpm|npm|yarn) (?:run )?lint$/, at: "before", first: true },
  { id: "content-lint", command: "agentic-cms lint --production", test: kit(String.raw`lint(?=\s)(?=.*\s--production(?:\s|$))`), at: "before" },
  { id: "docs", command: "agentic-cms docs --check", test: kit(String.raw`docs(?=\s)(?=.*\s--check(?:\s|$))`), at: "before" },
  { id: "next-build", command: "next build", test: /^(?:[A-Z_][A-Z0-9_]*=\S* )*(?:pnpm (?:exec )?|npx )?next build(?:\s|$)/ },
  { id: "seo", command: "agentic-cms seo", test: kit(String.raw`seo(?:\s|$)`), at: "after" },
  { id: "guard-email", command: "agentic-cms guard-email", test: kit(String.raw`guard-email(?:\s|$)`), at: "after", guard: true },
];

/** A failure turned into a pass: `|| true`, `|| :`, `|| exit 0`, a bare `exit 0`. */
const MASKED = /\|\|\s*(?:true|:|exit\s+0)(?:\s|;|$)|(?:^|;|&&)\s*exit\s+0\s*$/;

/**
 * The `guardEmail` key of src/config/site.ts, read from its text (the key on
 * a line of its own, as SiteConfig spells it): { on, off, bare } — `on` for
 * `true`, the address kept out of every served file; `off`, the reason of
 * `{ off: "<why>" }`, the address public on purpose; `bare` for `false`, or
 * an off without a reason, which check-site refuses. Absent: all three empty.
 */
export function emailGuard(siteTs = "") {
  const off = siteTs.match(/^[ \t]*guardEmail\s*:\s*\{\s*off\s*:\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/m);
  const reason = off ? off[2].replace(/\\(.)/g, "$1").trim() : null;
  return { on: /^[ \t]*guardEmail\s*:\s*true\b/m.test(siteTs), off: reason || null, bare: /^[ \t]*guardEmail\s*:\s*false\b/m.test(siteTs) || reason === "" };
}

/** D5: whether a site's build holds `guard-email` among its gates — its site.ts turns `guardEmail` on. */
export const guardsEmail = (siteTs = "") => emailGuard(siteTs).on;

/** The gates a build holds for a site: guard-email only with `guard` (guardsEmail()). */
export const buildGates = ({ guard }) => BUILD_GATES.filter((gate) => !gate.guard || guard);

/** The build a new site runs, its gates joined by `&&`. */
export const buildScript = ({ guard }) => buildGates({ guard }).map((gate) => gate.command).join(" && ");

/** A script's commands: split on `;`, `&&` and `||`, each trimmed. */
const commands = (script) => script.split(/;|&&|\|\|/).map((part) => part.trim()).filter(Boolean);
/** The build's steps: its `&&` chain. */
const steps = (script) => script.split("&&").map((part) => part.trim());

/**
 * What a lint script lacks: { missing: [gate], masked } — the gates no
 * command of it runs, and whether a failure is turned into a pass.
 */
export function lintGaps(script = "") {
  const found = commands(script);
  return { missing: LINT_GATES.filter((gate) => !found.some((command) => gate.test.test(command))), masked: MASKED.test(script) };
}

/**
 * What a build script lacks: { missing: [gate], misplaced: [gate], masked } —
 * the gates no step of its `&&` chain runs, those on the wrong side of
 * `next build`, and whether a failure is turned into a pass.
 */
export function buildGaps(script = "", { guard }) {
  const chain = steps(script);
  const at = (gate) => chain.findIndex((step) => gate.test.test(step));
  const build = at(BUILD_GATES.find((gate) => gate.id === "next-build"));
  const gates = buildGates({ guard });
  const missing = gates.filter((gate) => at(gate) === -1);
  const misplaced = build === -1 ? [] : gates.filter((gate) => gate.at && at(gate) !== -1 && (gate.at === "before" ? at(gate) > build : at(gate) < build));
  return { missing, misplaced, masked: MASKED.test(script) };
}

/** A script the merge could not take the gates into: init exits 2 naming what to add, before anything is written. */
export class GatesError extends Error {}

/**
 * The lint with its gates: the kit's own when the site has none, the site's
 * when it holds them, the site's with check-components swapped for
 * check-site, or the site's ESLint command with the check after it. A lint
 * the merge cannot read throws a GatesError naming what to add.
 * { script, note } — note null when nothing changed.
 */
export function mergeLint(script) {
  if (!script?.trim()) return { script: LINT, note: null };
  const { missing, masked } = lintGaps(script);
  if (!missing.length && !masked) return { script, note: null };
  const refuse = (why) => { throw new GatesError(`package.json's lint (${JSON.stringify(script)}) ${why}: make it ESLint, then the site check — "lint": ${JSON.stringify(LINT)} — keeping the site's own commands beside them`); };
  if (masked) refuse("turns a failure into a pass");
  if (missing.some((gate) => gate.id === "eslint")) refuse("runs no ESLint");
  const swapped = script.replace(new RegExp(`(${CLI}) check-components(?=\\s|$)`), "$1 check-site");
  if (swapped !== script) return { script: swapped, note: "lint: check-site in place of check-components" };
  if (/\bexit\b/.test(script)) refuse("ends in an exit the site check would never run after");
  return { script: `${script}; s=$?; agentic-cms check-site || s=1; exit $s`, note: "lint: check-site after the site's ESLint" };
}

/**
 * The build with its gates: the kit's own when the site has none, else the
 * site's `&&` chain with each gate it lacks put in its place — the lint
 * first of all, the other ones before `next build` in their order right
 * ahead of it, the ones after it behind it — and the site's own steps kept
 * where they are. A build with no `next
 * build` step, one that turns a failure into a pass or one whose gates sit
 * on the wrong side of `next build` throws a GatesError naming what to add.
 * { script, note } — note null when nothing changed.
 */
export function mergeBuild(script, { guard }) {
  if (!script?.trim()) return { script: buildScript({ guard }), note: null };
  const refuse = (why) => { throw new GatesError(`package.json's build (${JSON.stringify(script)}) ${why}: make it the gates joined by && — "build": ${JSON.stringify(buildScript({ guard }))} — with the site's own steps where they belong`); };
  const gaps = buildGaps(script, { guard });
  if (gaps.masked) refuse("turns a failure into a pass");
  if (gaps.misplaced.length) refuse(`runs ${gaps.misplaced.map((gate) => gate.command).join(", ")} on the wrong side of next build`);
  if (!gaps.missing.length) return { script, note: null };
  if (gaps.missing.some((gate) => gate.id === "next-build")) refuse("runs no next build as a step of its && chain");
  const chain = steps(script);
  const order = buildGates({ guard });
  for (const gate of gaps.missing) {
    const rank = order.indexOf(gate);
    const later = chain.findIndex((step) => order.slice(rank + 1).some((other) => other.test.test(step)));
    const earlier = chain.findLastIndex((step) => order.slice(0, rank).some((other) => other.test.test(step)));
    chain.splice(gate.first ? 0 : gate.at === "before" ? later : earlier + 1, 0, gate.command);
  }
  return { script: chain.join(" && "), note: `build: ${gaps.missing.map((gate) => gate.command).join(", ")} added` };
}
