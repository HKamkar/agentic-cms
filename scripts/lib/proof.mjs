// `visual-parity proof`: the three steps of a proof — the baseline of a
// commit (`capture <label>-before --ref <ref>`), the tree as it stands
// (`capture <label>-after`) and the compare — for each pass asked for
// (static always; --motion and --states add theirs), run as the harness's
// own commands with --json, so their results are read, not scraped. The
// --ref build happens once: the passes after the first reuse its sibling.

/** The passes, and the flag that makes each. */
export const PASSES = { static: [], motion: ["--motion"], states: ["--states"] };

/** The passes a proof runs: static, then motion and states when asked (or all). */
export const passesOf = ({ motion = false, states = false, all = false } = {}) => ["static", ...(motion || all ? ["motion"] : []), ...(states || all ? ["states"] : [])];

/** A pass's capture label: <label>-before, <label>-after-motion, … */
export const labelOf = (label, side, pass) => `${label}-${side}${pass === "static" ? "" : `-${pass}`}`;

/**
 * The commands of a proof, in order: [{ pass, step: "before" | "after" | "compare", label?, args }]. `shared`
 * goes to every capture (scheme, jobs, fresh, third-party), `pages` to every capture and compare, `sample`
 * to the static pass alone (the other passes pick their own pages); `build` builds the tree before the
 * first after capture.
 */
export function plan({ label = "proof", ref = "develop", passes = ["static"], build = false, shared = [], pages = [], sample = [] } = {}) {
  return passes.flatMap((pass, i) => {
    const before = labelOf(label, "before", pass), after = labelOf(label, "after", pass);
    const own = [...PASSES[pass], ...shared, ...pages, ...(pass === "static" ? sample : [])];
    return [
      { pass, step: "before", label: before, args: ["capture", before, "--ref", ref, ...own, "--json"] },
      { pass, step: "after", label: after, args: ["capture", after, ...own, ...(build && i === 0 ? ["--build"] : []), "--json"] },
      { pass, step: "compare", args: ["compare", before, after, ...pages, "--json"] },
    ];
  });
}

/**
 * Runs a plan with `run(args) → { status, stdout }`, one step after another; a capture that fails stops the
 * proof with its own exit code. { passes: [{ pass, before, after, report, seconds }], exit, failed? }: exit 0
 * when every compare is clean, 1 on any difference.
 */
export async function runProof(steps, { run, now = Date.now, log = () => {} }) {
  const passes = new Map();
  for (const step of steps) {
    log(step);
    const started = now();
    const result = await run(step.args);
    const entry = passes.get(step.pass) ?? { pass: step.pass, seconds: 0 };
    passes.set(step.pass, entry);
    entry.seconds = Math.round((entry.seconds + (now() - started) / 1000) * 10) / 10;
    const failed = step.step === "compare" ? result.status === 2 : result.status !== 0;
    if (failed) return { passes: [...passes.values()], exit: result.status || 1, failed: step };
    entry[step.step === "compare" ? "report" : step.step] = JSON.parse(result.stdout);
  }
  const done = [...passes.values()];
  return { passes: done, exit: done.some((p) => p.report.summary.exit !== 0) ? 1 : 0 };
}
