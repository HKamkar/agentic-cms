// `visual-parity proof`: the three steps of a proof — the baseline of a
// commit (`capture <label>-before --ref <ref>`), the tree as it stands
// (`capture <label>-after`) and the compare — for each pass asked for
// (static always; --motion and --states add theirs) and in each scheme the
// proof runs (the site's profile names one or two, lib/profile.mjs), run as
// the harness's own commands with --json, so their results are read, not
// scraped. The --ref build happens once: the passes after the first reuse
// its sibling. A shot that differs is retaken once on each side, fresh,
// before the pass reports (retakeSteps), so a difference that does not
// reproduce is told from one that does.
import { routeName } from "./browser.mjs";

/** The passes, and the flag that makes each. */
export const PASSES = { static: [], motion: ["--motion"], states: ["--states"] };

/**
 * The passes whose changed shots are retaken before they report: the static pass and --motion, whose retake of the
 * base is its noise floor (a frame that moves between two takes of one build); a --states capture has no --pages to
 * retake one state with.
 */
export const RETAKEN_PASSES = ["static", "motion"];

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
    // a retake takes every shot itself (--no-cache), so --fresh is not passed on to it
    const retake = RETAKEN_PASSES.includes(pass) ? { retake: { labels: { before: labelOf(label, "before-retake", pass, suffix), after: labelOf(label, "after-retake", pass, suffix) }, args: [...PASSES[pass], "--scheme", scheme, ...shared.filter((arg) => arg !== "--fresh")] } } : {};
    return [
      { pass: name, scheme, step: "before", label: before, args: ["capture", before, "--ref", ref, ...own, "--json"] },
      { pass: name, scheme, step: "after", label: after, args: ["capture", after, ...own, ...(build && i === 0 ? ["--build"] : []), "--json"] },
      { pass: name, scheme, step: "compare", args: ["compare", before, after, ...pages, "--json"], ...retake },
    ];
  });
}

/**
 * The steps that retake a pass's changed shots after its compare: the shots no retake judged (`report.unretaken`)
 * captured again on each side, at their pages and widths alone and with --no-cache — the baseline from the sha it was
 * built from, the after side from the tree — then the compare once more, judged against the two retakes; [] when no
 * shot differs, or for a pass that is not retaken.
 */
export function retakeSteps(step, { report, before, after }) {
  if (!step.retake || !report?.unretaken?.length || !before?.meta?.sha) return [];
  const routes = new Map([...(before.pages ?? []), ...(after?.pages ?? [])].map((route) => [routeName(route), route]));
  const shots = report.unretaken.map((name) => /^([^@]+)@(\d+)/.exec(name)).filter(Boolean);
  const pages = [...new Set(shots.map(([, page]) => routes.get(page)).filter(Boolean))];
  if (!pages.length) return [];
  const only = ["--pages", pages.join(","), "--widths", [...new Set(shots.map(([, , width]) => width))].join(",")];
  const { labels, args } = step.retake;
  const common = { pass: step.pass, scheme: step.scheme, shots: report.unretaken.length };
  return [
    { ...common, step: "retake-before", label: labels.before, args: ["capture", labels.before, "--ref", before.meta.sha, ...args, ...only, "--no-cache", "--json"] },
    { ...common, step: "retake-after", label: labels.after, args: ["capture", labels.after, ...args, ...only, "--no-cache", "--json"] },
    { ...common, step: "compare", args: [...step.args.filter((arg) => arg !== "--json"), "--retake-before", labels.before, "--retake-after", labels.after, "--json"] },
  ];
}

/**
 * Runs a plan with `run(args, { quiet }) → { status, stdout, stderr? }`, one step after another; a capture that fails
 * stops the proof with its own exit code. A compare that may be followed by retakes runs quiet, and its lines are
 * printed (`print`) only when none follow — the compare with the retakes then prints its own — or when a step after
 * it fails, so a failed retake does not lose them. { passes: [{ pass,
 * scheme, before, after, retakes?, report, seconds }], exit, failed? }: exit 0 when every compare is clean, 1 on any
 * line that is not ok.
 */
export async function runProof(steps, { run, now = Date.now, log = () => {}, print = () => {} }) {
  const passes = new Map();
  const held = new Map(); // a pass's quiet compare lines while its retakes run
  const queue = [...steps];
  while (queue.length) {
    const step = queue.shift();
    log(step);
    const started = now();
    const quiet = Boolean(step.retake);
    const result = await run(step.args, { quiet });
    const entry = passes.get(step.pass) ?? { pass: step.pass, scheme: step.scheme, seconds: 0 };
    passes.set(step.pass, entry);
    entry.seconds = Math.round((entry.seconds + (now() - started) / 1000) * 10) / 10;
    const failed = step.step === "compare" ? result.status === 2 : result.status !== 0;
    if (failed) { print(quiet ? result.stderr ?? "" : held.get(step.pass) ?? ""); return { passes: [...passes.values()], exit: result.status || 1, failed: step }; }
    const json = JSON.parse(result.stdout);
    if (step.step.startsWith("retake-")) entry.retakes = { ...entry.retakes, [step.step.slice("retake-".length)]: json };
    else entry[step.step === "compare" ? "report" : step.step] = json;
    if (!quiet) continue;
    const retakes = retakeSteps(step, { report: json, before: entry.before, after: entry.after });
    if (retakes.length) { held.set(step.pass, result.stderr ?? ""); queue.unshift(...retakes); } else print(result.stderr ?? "");
  }
  const done = [...passes.values()];
  return { passes: done, exit: done.some((p) => p.report.summary.exit !== 0) ? 1 : 0 };
}
