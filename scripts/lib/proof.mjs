// `visual-parity proof`: the three steps of a proof — the baseline of a
// commit (`capture <label>-before --ref <ref>`), the tree as it stands
// (`capture <label>-after`) and the compare — for each pass asked for
// (static always; --motion and --states add theirs) and in each scheme the
// proof runs (the site's profile names one or two, lib/profile.mjs), run as
// the harness's own commands with --json, so their results are read, not
// scraped. The --ref build happens once: the passes after the first reuse
// its sibling.

/** The passes, and the flag that makes each. */
export const PASSES = { static: [], motion: ["--motion"], states: ["--states"] };

/** The passes a proof runs: static, then motion and states when asked (or all). */
export const passesOf = ({ motion = false, states = false, all = false } = {}) => ["static", ...(motion || all ? ["motion"] : []), ...(states || all ? ["states"] : [])];

/** The proof's own flags as a capture's arguments: a boolean as itself, a value after its flag, a repeatable flag once per value; [] for one not given. */
export const forwarded = (flags, names) => names.flatMap((name) => {
  const value = flags[name];
  if (value === undefined || value === false) return [];
  if (value === true) return [`--${name}`];
  return (Array.isArray(value) ? value : [value]).flatMap((v) => [`--${name}`, String(v)]);
});

/** What tells a scheme's captures and passes apart: -dark for the dark one of a proof that runs both schemes, nothing for a proof of one. */
export const schemeSuffix = (scheme, schemes) => (schemes.length > 1 && scheme === "dark" ? "-dark" : "");

/** A pass's capture label: <label>-before, <label>-after-motion, <label>-before-dark, … */
export const labelOf = (label, side, pass, suffix = "") => `${label}-${side}${pass === "static" ? "" : `-${pass}`}${suffix}`;

/**
 * The commands of a proof, in order: [{ pass, scheme, step: "before" | "after" | "compare", label?, args }],
 * every pass in each scheme, a scheme's passes together. `shared` goes to every capture (jobs, fresh,
 * third-party, the seed), `pages` to every capture and compare, `widths` and `sample` to the static pass alone
 * (--motion and --states keep their own widths and pick their own pages); `build` builds the tree before the
 * first after capture.
 */
export function plan({ label = "proof", ref = "develop", passes = ["static"], schemes = ["light"], build = false, shared = [], pages = [], widths = [], sample = [] } = {}) {
  const runs = schemes.flatMap((scheme) => passes.map((pass) => ({ scheme, pass, suffix: schemeSuffix(scheme, schemes) })));
  return runs.flatMap(({ scheme, pass, suffix }, i) => {
    const before = labelOf(label, "before", pass, suffix), after = labelOf(label, "after", pass, suffix);
    const own = [...PASSES[pass], "--scheme", scheme, ...shared, ...pages, ...(pass === "static" ? [...widths, ...sample] : [])];
    const name = `${pass}${suffix}`;
    return [
      { pass: name, scheme, step: "before", label: before, args: ["capture", before, "--ref", ref, ...own, "--json"] },
      { pass: name, scheme, step: "after", label: after, args: ["capture", after, ...own, ...(build && i === 0 ? ["--build"] : []), "--json"] },
      { pass: name, scheme, step: "compare", args: ["compare", before, after, ...pages, "--json"] },
    ];
  });
}

/**
 * Runs a plan with `run(args) → { status, stdout }`, one step after another; a capture that fails stops the
 * proof with its own exit code. { passes: [{ pass, scheme, before, after, report, seconds }], exit, failed? }:
 * exit 0 when every compare is clean, 1 on any difference.
 */
export async function runProof(steps, { run, now = Date.now, log = () => {} }) {
  const passes = new Map();
  for (const step of steps) {
    log(step);
    const started = now();
    const result = await run(step.args);
    const entry = passes.get(step.pass) ?? { pass: step.pass, scheme: step.scheme, seconds: 0 };
    passes.set(step.pass, entry);
    entry.seconds = Math.round((entry.seconds + (now() - started) / 1000) * 10) / 10;
    const failed = step.step === "compare" ? result.status === 2 : result.status !== 0;
    if (failed) return { passes: [...passes.values()], exit: result.status || 1, failed: step };
    entry[step.step === "compare" ? "report" : step.step] = JSON.parse(result.stdout);
  }
  const done = [...passes.values()];
  return { passes: done, exit: done.some((p) => p.report.summary.exit !== 0) ? 1 : 0 };
}
