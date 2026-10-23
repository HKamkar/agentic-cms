// The site check behind `agentic-cms check-site`, which a site's `pnpm lint`
// runs after ESLint (so `pnpm build` and CI do too): every pass of the
// component guard (./check-components.mjs, componentsReport() — the
// `check-components` command stays, the components pass alone), then what
// holds the site as a whole (docs/roadmap-0.8.2.md D6 (b)):
//   - rounds: a *-demo route is one `demo new` wrote (its demo.json) or the
//     lab's own (`lab route`'s lab-demo), and a round's pictures
//     (public/images/<name>-demo/) are there only while its route is;
//   - exceptions (D3): every exception added since the merge base is listed
//     with its reason — a route exception, an owner, an `allow` entry, an
//     `ignores` glob (its reason the `$ignores` comment beside it, which an
//     added one needs) and an inline disable — and the frozen lists only
//     shrink: a file added to `inherited` since the base is a finding. The
//     base is git's merge base of HEAD with --base, else the pull request's
//     base branch (GITHUB_BASE_REF), else origin/HEAD, origin/main or main; a
//     checkout without that history (no git, no commit, a shallow clone)
//     compares nothing and says why;
//   - scripts: package.json's `lint` and `build` hold the kit's gates
//     (./gates.mjs, which `init` writes and merges), `guard-email` among them
//     when src/config/site.ts turns `guardEmail` on; a `guardEmail` turned
//     off has its reason (`{ off: "<why>" }`), an exception the exceptions
//     pass lists once it is added;
//   - ci: a workflow that runs on pull requests (init's
//     .github/workflows/verify.yml) runs the lint (or a build that runs it),
//     the tests, the build and the agent-file check;
//   - tools, the preferred tier's, so warnings that fail nothing: a script of
//     the site's own under scripts/ that drives Playwright (or another
//     headless browser), runs sharp over public/ or starts next dev, and a
//     machine's address in next.config.*; each names the kit's command, and
//     an `allow` entry of agentic-cms/site-tools with its reason quiets it;
//   - leftovers: what is left of the kit's example (./leftovers.mjs), its
//     brand by line and its sample content by path, by bytes and by entry;
//   - baseline (job 7, ./baseline.mjs): the findings of the rules a
//     baseline holds (rounds, the leftovers) are held while their file's
//     count does; an entry that does not read, or holds more than its file
//     has, is a finding, and one added or raised since the merge base is the
//     exceptions pass's. `--baseline` (baselineSite()) writes the list.
// In the kit's own repository (its package.json is the kit's) scripts/ holds
// the kit's commands themselves and the example is the example, so the tools
// and the leftovers passes read nothing, and its CI checks its agent files
// through `pnpm hygiene`. The file system comes in as
// `fs` (existsSync, readFileSync, readdirSync with withFileTypes), git as
// `git(args)` → { status, stdout }, and the components pass as
// `components({ root, fs, config })`, so the tests need neither a checkout
// nor ESLint.
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { CONFIG_FILE, componentsReport, DEMO_FOLDER, disablesIn, entryLines, formatReport, globRegex, isSource, plural, readConfig, resolveGuard, validAllow } from "./check-components.mjs";
import { MANIFEST as DEMO_MANIFEST } from "./demo.mjs";
import { baselineGrowth, countable, engineFindings, entryFindings, holdFindings, nextBaseline, validBaseline, withBaseline } from "./baseline.mjs";
import { buildGaps, buildScript, emailGuard, LINT, lintGaps } from "./gates.mjs";
import { exampleLeftovers } from "./leftovers.mjs";
import { KIT_NAME } from "./placeholders.mjs";
import { SITE_TOOLS } from "./preferred-rules.mjs";

/** The passes check-site adds to the components pass. */
export const SITE_PASSES = ["rounds", "exceptions", "scripts", "ci", "tools", "leftovers", "baseline"];
/** The lists that only shrink against the merge base. */
export const SHRINK_ONLY = ["inherited"];
/** The first line of the lab's throwaway route as `lab route` writes it (templates/lab-demo/page.tsx). */
export const LAB_HEADER = "// The lab on this site's theme — a throwaway route";
export const LAB_ROUTE = "lab-demo";
const PICTURES = "public/images";
const SITE_CONFIG = "src/config/site.ts";
const WORKFLOWS = ".github/workflows";
const NEXT_CONFIGS = ["next.config.ts", "next.config.mts", "next.config.mjs", "next.config.js", "next.config.cjs"];
const TOOL_SCRIPT = /\.(?:[cm]?[jt]s|sh|py)$/;

/** A --base that names no commit here: exit 2. */
export class SiteCheckError extends Error {}

const finding = (check, file, problem, fix) => ({ check, file, problem, fix });

/** The site's files through `fs`, root-relative: exists, read (null when absent), the entries of a folder and every file under it (dotfiles and node_modules left out). */
function siteReader(root, fs) {
  const full = (file) => path.join(root, file);
  const exists = (file) => fs.existsSync(full(file));
  const read = (file) => (exists(file) ? fs.readFileSync(full(file), "utf8") : null);
  const entries = (dir) => { try { return fs.readdirSync(full(dir), { withFileTypes: true }).filter((e) => !e.name.startsWith(".") && e.name !== "node_modules"); } catch { return []; } };
  const walk = (dir) => entries(dir).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  return { exists, read, entries, walk };
}

const readJson = (text) => { try { return JSON.parse(text); } catch { return null; } };
const folders = (site, dir) => site.entries(dir).filter((e) => e.isDirectory()).map((e) => e.name);

/** A *-demo route is a round's (its demo.json) or the lab's; a round's pictures go with its route. */
function checkRounds(g, site) {
  const routes = folders(site, g.app).filter((name) => DEMO_FOLDER.test(name));
  const lab = (name) => name === LAB_ROUTE && (site.read(`${g.app}/${name}/page.tsx`) ?? "").startsWith(LAB_HEADER);
  const handMade = routes.filter((name) => !site.exists(`${g.app}/${name}/${DEMO_MANIFEST}`) && !lab(name));
  const leftover = folders(site, PICTURES).filter((name) => DEMO_FOLDER.test(name) && !routes.includes(name));
  return [
    ...handMade.map((name) => finding("rounds", `${g.app}/${name}`, `a *-demo route \`demo new\` did not write (no ${DEMO_MANIFEST}): a round made by hand, whose candidates no check knows`, `a design round is agentic-cms demo new ${name.slice(0, -"-demo".length)} --section <type> (its candidates in the section's real frame, the page's copy read from its file; --component, --showcase for the rest): remove this route and start the round with demo new`)),
    ...leftover.map((name) => finding("rounds", `${PICTURES}/${name}`, `a round's pictures with no round: ${g.app}/${name} is gone, and \`demo clean\` takes a round's pictures with it`, `remove the folder (agentic-cms demo clean <name> removes a round's route and pictures together); a picture a page keeps goes under ${PICTURES}/<page>/, named in the page's file`)),
  ];
}

/** git, as the checks ask it: a ref resolves, a command's output trimmed (null when it fails). */
function gitOf(git) {
  const out = (...args) => { const r = git(args); return r.status === 0 ? r.stdout.trim() : null; };
  return { out, resolves: (ref) => out("rev-parse", "--verify", "--quiet", `${ref}^{commit}`) !== null };
}

/**
 * The merge base the exceptions are compared with: { ref, commit }, or
 * { note } saying why there is none. With --base, there must be one: a base
 * that names no commit here, or a checkout without the history, throws a
 * SiteCheckError.
 */
export function mergeBase({ git, env = {}, base }) {
  const { out, resolves } = gitOf(git);
  const without = (why) => {
    if (base) throw new SiteCheckError(`--base ${base}: ${why}`);
    return { note: `${why}, so the exceptions added since the merge base are not compared` };
  };
  if (out("rev-parse", "--is-inside-work-tree") !== "true") return without("not a git checkout");
  if (!resolves("HEAD")) return without("no commit yet");
  const shallow = out("rev-parse", "--is-shallow-repository") === "true" ? "a shallow checkout (CI's checkout takes the history with fetch-depth: 0)" : null;
  if (base && !resolves(base)) return without(shallow ? `no such commit in ${shallow}` : "no commit or branch of that name here");
  const candidates = base ? [base] : [env.GITHUB_BASE_REF && `origin/${env.GITHUB_BASE_REF}`, "origin/HEAD", "origin/main", "main"].filter(Boolean);
  const ref = candidates.find(resolves);
  if (!ref) return { note: `${shallow ?? `no base branch here (${candidates.join(", ")})`}, so the exceptions added since the merge base are not compared — --base <ref> names one` };
  const commit = out("merge-base", "HEAD", ref);
  return commit ? { ref, commit } : without(shallow ?? `HEAD shares no history with ${ref}`);
}

/** The config's exceptions added since the base's: route exceptions, owners, allow entries' files, ignores globs; [{ kind, name, reason }]. */
export function configAdded(before, now) {
  const has = (map, key) => Boolean(map) && Object.hasOwn(map, key);
  const files = (entry) => (Array.isArray(entry?.files) ? entry.files.filter((file) => typeof file === "string") : []);
  const allowed = new Set((before.allow ?? []).flatMap((entry) => files(entry).map((file) => `${entry.rule} ${file}`)));
  return [
    ...Object.entries(now.exceptions ?? {}).filter(([folder]) => !has(before.exceptions, folder)).map(([folder, reason]) => ({ kind: "exceptions", name: folder, reason })),
    ...Object.entries(now.owners ?? {}).flatMap(([part, owned]) => Object.entries(owned ?? {}).filter(([file]) => !has(before.owners?.[part], file)).map(([file, reason]) => ({ kind: `owners.${part}`, name: file, reason }))),
    ...(Array.isArray(now.allow) ? now.allow : []).flatMap((entry) => files(entry).filter((file) => !allowed.has(`${entry.rule} ${file}`)).map((file) => ({ kind: `allow ${entry.rule}`, name: file, reason: entry.reason }))),
    ...(now.ignores ?? []).filter((glob) => !(before.ignores ?? []).includes(glob)).map((glob) => ({ kind: "ignores", name: glob, reason: now.$ignores ?? "" })),
  ];
}

/** The inline disables in the site's source that its text at the base did not have, matched by rule and reason (lines move); [{ kind, name, rules, reason }]. */
function disablesAdded(g, site, show) {
  const ignored = g.ignores.map(globRegex);
  const trees = [g.src, g.root, g.app].filter((dir, at, all) => !all.some((other, i) => i !== at && dir.startsWith(`${other}/`)));
  const files = [...new Set(trees.flatMap(site.walk))].filter((file) => isSource(file) && !ignored.some((re) => re.test(file))).sort();
  const key = ({ rules, reason }) => `${rules.join(",")}\0${reason}`;
  return files.flatMap((file) => {
    const now = disablesIn(site.read(file));
    if (!now.length) return [];
    const then = disablesIn(show(file) ?? "").map(key);
    return now.filter((entry) => { const at = then.indexOf(key(entry)); if (at === -1) return true; then.splice(at, 1); return false; })
      .map((entry) => ({ kind: "inline disable", name: `${file}:${entry.line}`, rules: entry.rules.length ? entry.rules : ["every rule"], reason: entry.reason }));
  });
}

/** The baseline against the base's: each entry added or raised since, a finding (the first list, which the pull request that takes 0.8.2 adds, is listed as added). */
function baselineFindings({ ref }, before, config) {
  return baselineGrowth(before, config).grown.map((entry) => finding("exceptions", entry.file, entry.was ? `the baseline's ${entry.rule} here was raised from ${entry.was} to ${entry.count} since ${ref}: the baseline only shrinks` : `added to the baseline (${entry.rule} ×${entry.count}) since ${ref}: the baseline only shrinks, and takes no new bypass`, `move it onto its engine as the rule's message says, and give the entry back the count ${ref} has (agentic-cms check-site --baseline shrinks, never grows)`));
}

/** The baseline's entries the base had none of, the pull request that takes 0.8.2: each listed as added, with its rule, count and reason. */
const baselineAdded = (before, config) => (baselineGrowth(before, config).first ? validBaseline(config.baseline).map(({ file, rule, count, reason }) => ({ kind: "baseline", name: file, rules: [`${rule} ×${count}`], reason })) : []);

/** What an added exception lacks: an ignores glob with no `$ignores` reason; a file on a frozen list. */
function exceptionFindings({ ref }, before, config, added) {
  const out = added.filter((entry) => entry.kind === "ignores" && !String(entry.reason).trim()).map((entry) => finding("exceptions", entry.name, `an ignores glob added since ${ref} with no reason: ignores leaves its files out of every rule`, `say why in "$ignores" beside it in ${CONFIG_FILE}; better, the rule's own exception, with its reason (an owner, an allow entry, an inline disable with its description)`));
  for (const key of before ? SHRINK_ONLY : []) {
    const frozen = new Set(before[key] ?? []);
    for (const file of (config[key] ?? []).filter((entry) => !frozen.has(entry))) out.push(finding("exceptions", file, `added to the frozen "${key}" list since ${ref}: the list only shrinks`, `take it out of "${key}" in ${CONFIG_FILE}, and put the file where the library keeps it (the components rule)`));
  }
  return out;
}

/** The e-mail guard turned off since the base, with its reason: site.ts's `guardEmail: { off: "<why>" }`, which its text at the base did not have; [{ kind, name, reason }]. */
function emailGuardAdded(site, show) {
  const now = emailGuard(site.read(SITE_CONFIG) ?? "");
  return now.off && !emailGuard(show(SITE_CONFIG) ?? "").off ? [{ kind: "guardEmail off", name: SITE_CONFIG, reason: now.off }] : [];
}

/** The exceptions pass: the merge base, what was added since it, and its findings; with no base, the note why and nothing compared. */
function checkExceptions({ git, env, base }, g, site, config) {
  const found = mergeBase({ git, env, base });
  if (!found.commit) return { base: null, note: found.note, added: [], findings: [] };
  const show = (file) => { const r = git(["show", `${found.commit}:./${file}`]); return r.status === 0 ? r.stdout : null; };
  const text = show(CONFIG_FILE);
  const before = text === null ? null : readJson(text);
  const added = [...configAdded(before ?? {}, config), ...baselineAdded(before, config), ...disablesAdded(g, site, show), ...emailGuardAdded(site, show)];
  return { base: { ref: found.ref, commit: found.commit }, note: null, added, findings: [...exceptionFindings(found, before, config, added), ...baselineFindings(found, before, config)] };
}

/** package.json's lint and build hold the gates (./gates.mjs); site.ts's `guardEmail`, when off, says why. */
function checkScripts(site, pkg) {
  const email = emailGuard(site.read(SITE_CONFIG) ?? "");
  const bare = email.bare && finding("scripts", SITE_CONFIG, "turns guardEmail off with no reason, so the build lets the address into served files as text and no review reads why", `guardEmail: true keeps it out of every served file, guard-email in the build (docs/email.md); an address public on purpose says why: guardEmail: { off: "<why>" }`);
  if (!pkg) return [bare, finding("scripts", "package.json", "no package.json here that reads as JSON, so nothing says what the lint and the build run", "agentic-cms init writes one, its lint and build holding the gates")].filter(Boolean);
  const guard = email.on;
  const { lint, build } = pkg.scripts ?? {};
  const lintFix = `"lint": ${JSON.stringify(LINT)}, the site's own commands beside them`;
  const buildFix = `"build": ${JSON.stringify(buildScript({ guard }))}, the gates joined by && around the site's own steps (agentic-cms init merges them)`;
  const lintGap = lintGaps(lint);
  const buildGap = buildGaps(build, { guard });
  const named = (gates) => gates.map((gate) => gate.command).join(", ");
  const why = buildGap.missing.some((gate) => gate.id === "guard-email") ? ` (${SITE_CONFIG} turns guardEmail on: guard-email keeps the address out of every served file)` : "";
  return [
    bare,
    lintGap.missing.length && finding("scripts", "package.json", `"lint" runs no ${named(lintGap.missing)}: the lint is ESLint, then the site check, failing on either while both report`, lintFix),
    lintGap.masked && finding("scripts", "package.json", `"lint" turns a failure into a pass`, lintFix),
    buildGap.missing.length && finding("scripts", "package.json", `"build" runs no ${named(buildGap.missing)} as a step of its && chain${why}`, buildFix),
    buildGap.misplaced.length && finding("scripts", "package.json", `"build" runs ${named(buildGap.misplaced)} on the wrong side of next build`, buildFix),
    buildGap.masked && finding("scripts", "package.json", `"build" turns a failure into a pass`, buildFix),
  ].filter(Boolean);
}

/** What CI runs: the commands of every workflow that runs on pull requests; { files, commands, unreadable }. */
function workflowCommands(site) {
  const files = site.walk(WORKFLOWS).filter((file) => /\.ya?ml$/.test(file)).sort();
  const onPullRequests = (on) => on === "pull_request" || (Array.isArray(on) && on.includes("pull_request")) || (Boolean(on) && typeof on === "object" && "pull_request" in on);
  const out = { files: [], commands: [], unreadable: [] };
  for (const file of files) {
    let flow;
    try { flow = parseYaml(site.read(file)); } catch { out.unreadable.push(file); continue; }
    if (!onPullRequests(flow?.on)) continue;
    out.files.push(file);
    const runs = Object.values(flow.jobs ?? {}).flatMap((job) => (Array.isArray(job?.steps) ? job.steps : [])).map((step) => step?.run).filter((run) => typeof run === "string");
    out.commands.push(...runs.flatMap((run) => run.split(/\n|;|&&|\|\|/)).map((command) => command.trim()).filter(Boolean));
  }
  return out;
}

/** The steps CI must run: the lint (or a build that runs it), the tests, the build, the agent-file check (in the kit's repository, its hygiene). */
const CI_STEPS = [
  { what: "the lint", test: /^pnpm (?:run )?lint(?:\s|$)/, viaBuild: true },
  { what: "the tests", test: /^pnpm (?:run )?test(?:\s|$)/ },
  { what: "the build", test: /^pnpm (?:run )?build(?:\s|$)/ },
  { what: "the agent-file check", test: /^(?:pnpm (?:exec )?|npx )?agentic-cms init \S+ --agent-files --check(?:\s|$)/, kit: /^pnpm (?:run )?hygiene(?:\s|$)/ },
];

/** A workflow on pull requests runs the gates. */
function checkCi(site, pkg, kit) {
  const { files, commands, unreadable } = workflowCommands(site);
  const template = "node_modules/agentic-cms/templates/site/verify.yml";
  const out = unreadable.map((file) => finding("ci", file, "a workflow that does not read as YAML", "fix its YAML: GitHub runs none of it"));
  if (!files.length) return [...out, finding("ci", `${WORKFLOWS}/verify.yml`, "no workflow runs on pull requests, so nothing holds the gates before a merge", `agentic-cms init writes ${WORKFLOWS}/verify.yml; a site from before it copies ${template}`)];
  const buildRunsLint = !buildGaps(pkg?.scripts?.build, { guard: false }).missing.some((gate) => gate.id === "lint");
  const ran = (step) => commands.some((command) => (kit && step.kit ? step.kit : step.test).test(command)) || (step.viaBuild && buildRunsLint && commands.some((command) => CI_STEPS[2].test.test(command)));
  const missing = CI_STEPS.filter((step) => !ran(step));
  const file = files.find((f) => f.endsWith("/verify.yml")) ?? files[0];
  if (missing.length) out.push(finding("ci", file, `CI runs no ${missing.map((step) => step.what).join(", ")} on pull requests`, `a step each: pnpm lint, pnpm test, pnpm build, pnpm exec agentic-cms init . --agent-files --check, as ${template} runs them`));
  return out;
}

/** The site's own tools the kit has a command for: what each looks like in a script, and the command to use. */
export const TOOL_KINDS = [
  { problem: "drives a headless browser of its own (Playwright)", match: (text) => /["'](?:playwright|playwright-core|@playwright\/test|puppeteer|puppeteer-core)["']|\b(?:from|import)\s+playwright\b|\b(?:npx|pnpm exec|pnpm dlx)\s+playwright\s/.test(text), use: "agentic-cms shot, probe and sheet (docs/shot-probe-sheet.md) and agentic-cms visual-parity (docs/visual-parity.md): the kit's harness, every page prepared and seeded as its proofs are" },
  { problem: "runs sharp over public/", match: (text) => /["']sharp["']/.test(text) && /["'`](?:\.{1,2}\/)*public(?:["'`/])|\/public\//.test(text), use: "agentic-cms placeholder for a placeholder picture, agentic-cms optimize-webp and optimize-svg-rasters for a real one (scripts/README.md)" },
  { problem: "starts next dev", match: (text) => /\bnext\s+dev\b|["']next["']\s*,\s*\[\s*["']dev["']/.test(text), use: "agentic-cms serve: the dev server and the lab, the origins checked first and every URL handed over once each route answers (docs/dev-server.md)" },
];

/** A machine's address in a config's code (a comment line left out): an IPv4 address but loopback and 0.0.0.0; [{ line, address }]. */
export function machineAddresses(text) {
  const out = [];
  text.split("\n").forEach((line, at) => {
    if (/^\s*(?:\/\/|\/?\*)/.test(line)) return;
    for (const [address] of line.matchAll(/\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g)) if (!/^(?:127\.|0\.0\.0\.0$)/.test(address)) out.push({ line: at + 1, address });
  });
  return out;
}

const allowFix = (file) => `a site that keeps its own says why: "allow": [{ "rule": "${SITE_TOOLS}", "files": ["${file}"], "reason": "<why>" }] in ${CONFIG_FILE}`;

/** The files the tools pass reads: the site's scripts and its Next config. */
const toolFiles = (site) => [...site.walk("scripts").filter((file) => TOOL_SCRIPT.test(file)), ...NEXT_CONFIGS.filter(site.exists)];

/** The site's own tools where the kit has a command: warnings, each quiet where an allow entry of agentic-cms/site-tools names its file; an allow entry of it that names no file the pass reads is a finding. */
function checkTools(site, config, kit) {
  if (kit) return { findings: [], warnings: [] };
  const entries = validAllow(config.allow).filter((entry) => entry.rule === SITE_TOOLS);
  const allowed = entries.flatMap((entry) => entry.files.map(globRegex));
  const files = toolFiles(site);
  const quiet = (file) => allowed.some((re) => re.test(file));
  const warnings = files.filter((file) => !quiet(file)).flatMap((file) => {
    const text = site.read(file) ?? "";
    if (NEXT_CONFIGS.includes(file)) return machineAddresses(text).slice(0, 1).map(({ line, address }) => finding("tools", `${file}:${line}`, `names a machine's address (${address}): the origins the dev server allows are each machine's, not the site's`, `agentic-cms urls --write puts this machine's addresses in ALLOWED_DEV_ORIGINS in .env.local, which next.config reads (docs/dev-server.md); ${allowFix(file)}`));
    return TOOL_KINDS.filter((kind) => kind.match(text)).map((kind) => finding("tools", file, `a script of the site's own that ${kind.problem}`, `${kind.use}; ${allowFix(file)}`));
  });
  const findings = entries.flatMap((entry) => entry.files).filter((glob) => !files.some((file) => globRegex(glob).test(file))).map((glob) => finding("tools", glob, `an allow entry of ${SITE_TOOLS} that names no file the site check reads (scripts/, next.config.*)`, `take it out of "allow" in ${CONFIG_FILE}, or point it at the script that keeps its own`));
  return { findings, warnings };
}

/** A count of entries, "entry" the noun plural() cannot make. */
const entryCount = (n, kind = "") => `${n} ${kind}${n === 1 ? "entry" : "entries"}`;

/** The site's name and short name from its site.ts, as the brand rule spares them (a site named like the example keeps its name). */
const siteNames = (text = "") => ["name", "shortName"].map((field) => text.match(new RegExp(`^\\s*${field}:\\s*["'\`]([^"'\`\\n]+)["'\`]`, "m"))?.[1] ?? "").join(" ");

/** What is left of the kit's example in the site (./leftovers.mjs); none in the kit, whose example is the example. */
const checkLeftovers = ({ root, fs }, site, kit) => (kit ? [] : exampleLeftovers({ root, fs, siteName: siteNames(site.read(SITE_CONFIG) ?? "") }).map(({ check, rule, file, problem, fix }) => ({ check, rule, file, problem, fix })));

/** The baseline over every finding: the site check's rules held while their file's count does, the entries that do not read or hold too much; { findings, held, warnings }. */
function baselinePass(config, findings, site) {
  if (!Object.hasOwn(config, "baseline")) return { findings, held: [], warnings: [] };
  const holding = holdFindings(findings, config.baseline, site.exists);
  const silent = validBaseline(config.baseline).filter((entry) => !String(entry.reason ?? "").trim());
  const warnings = silent.length ? [finding("baseline", CONFIG_FILE, `${entryCount(silent.length, "baseline ")} ${silent.length === 1 ? "says" : "say"} no reason yet: ${silent.slice(0, 3).map((entry) => `${entry.file} (${entry.rule})`).join(", ")}${silent.length > 3 ? ", …" : ""}`, "say in each entry's \"reason\" why it is still here — the review reads it — or move its findings onto their engine and take it out")] : [];
  return { findings: [...holding.findings, ...entryFindings(config.baseline)], held: holding.held, warnings };
}

/**
 * The site check: { config, kit, components, rounds, base, history, added,
 * baseline, findings, warnings } — `components` the components pass's
 * summary (its layers, inherited, candidates, disables, allowed), `base` the
 * merge base ({ ref, commit }) or null with `history` saying why, `added`
 * the exceptions added since it, `baseline` the list's entries and the
 * findings it held, and the findings and the warnings of every pass, the
 * components pass's first, each { check, file, problem, fix } (a leftover's
 * with its `rule`). `hold: false` holds nothing to the baseline (what
 * `--baseline` counts). Throws a GuardConfigError for a config it cannot
 * read, a SiteCheckError for a --base that names no commit.
 */
export async function checkSite({ root, fs, git, env = {}, base, components = componentsReport, hold = true }) {
  const config = readConfig(root, fs);
  const { findings: componentFindings, warnings: componentWarnings, ...summary } = await components({ root, fs, config });
  const site = siteReader(root, fs);
  const g = resolveGuard(config);
  const pkg = readJson(site.read("package.json"));
  const kit = pkg?.name === KIT_NAME;
  const exceptions = checkExceptions({ git, env, base }, g, site, config);
  const tools = checkTools(site, config, kit);
  const own = [...checkRounds(g, site), ...exceptions.findings, ...checkScripts(site, pkg), ...checkCi(site, pkg, kit), ...tools.findings, ...checkLeftovers({ root, fs }, site, kit)];
  const baseline = hold ? baselinePass(config, [...componentFindings, ...own], site) : { findings: [...componentFindings, ...own], held: [], warnings: [] };
  const rounds = folders(site, g.app).filter((name) => DEMO_FOLDER.test(name)).length;
  return { config: CONFIG_FILE, kit, components: summary, rounds, base: exceptions.base, history: exceptions.note, added: exceptions.added, baseline: { entries: validBaseline(config.baseline).length, held: baseline.held.length }, findings: baseline.findings, warnings: [...componentWarnings, ...tools.warnings, ...baseline.warnings] };
}

/** Each exception added since the base, with its reason. */
const addedLines = (added) => added.map(({ kind, name, rules, reason }) => `  + ${kind} ${name}${rules ? ` (${rules.join(", ")})` : ""} — ${String(reason ?? "").trim() || "no reason"}`);

/** The exceptions pass in one clause: how many were added since the base, or why nothing was compared. */
const sinceClause = ({ base, history, added }) => (base ? `${plural(added.length, "exception")} added since ${base.ref} (${base.commit.slice(0, 7)})` : `exceptions not compared: ${history}`);

/** The baseline in one clause, when the site has one. */
const baselineClause = ({ baseline }) => (baseline?.entries ? `; the baseline: ${entryCount(baseline.entries)}, ${plural(baseline.held, "finding")} of the site check's held` : "");

/** The report as lines: the components pass as check-components prints it, then the site's passes — one line when clean, else each finding — the exceptions added since the base with their reasons, and the warnings last. */
export function formatSiteReport(report) {
  const site = new Set(SITE_PASSES);
  const ofSite = (entries) => entries.filter((entry) => site.has(entry.check));
  const ofComponents = (entries) => entries.filter((entry) => !site.has(entry.check));
  const lines = formatReport({ ...report.components, findings: ofComponents(report.findings), warnings: ofComponents(report.warnings) });
  const [findings, warnings] = [ofSite(report.findings), ofSite(report.warnings)];
  const held = [`package.json's gates, CI on pull requests${report.kit ? "" : ", the site's own tools, the example's leftovers"}`, plural(report.rounds, "round route"), sinceClause(report)];
  if (findings.length) lines.push(`check-site: ${plural(findings.length, "problem")} (${sinceClause(report)}${baselineClause(report)})`, "", ...entryLines(findings, "✗"));
  else lines.push(`check-site: ok (${held.join("; ")}${baselineClause(report)})`);
  if (report.added.length) lines.push(`The exceptions added since ${report.base.ref}, each with its reason:`, ...addedLines(report.added));
  if (warnings.length) lines.push("", `check-site: ${plural(warnings.length, "warning")}, which fail nothing: the kit's command, or the site's own with its reason`, "", ...entryLines(warnings, "⚠"));
  return lines;
}

/**
 * `check-site --baseline`: what the site holds now of the rules a baseline
 * holds — the engines' findings as its ESLint reads them, the baseline
 * ignored (`engines`, ./baseline.mjs engineFindings()), and the site check's
 * own (rounds, the leftovers) — written into the config's `baseline`: the
 * whole list, each reason empty, when the config has none; else the list
 * shrunk to it (an entry gone or lowered), growth refused. The config's
 * other bytes stay as they are. Then the site check again, as the lint will
 * run it (`recheck`: the CLI runs it in a process of its own, which reads
 * eslint.config.mjs afresh — this one's import of it holds the list as it
 * was). { config, written, first, baseline, found, shrunk, removed,
 * refused, remaining, warnings } — `remaining` the findings no baseline
 * takes (the gates, the config's own), which fail until they are fixed.
 */
export async function baselineSite({ root, fs, git, env = {}, base, components = componentsReport, engines = engineFindings, recheck = () => checkSite({ root, fs, git, env, base, components }) }) {
  const config = readConfig(root, fs);
  const file = path.join(root, CONFIG_FILE);
  const text = fs.readFileSync(file, "utf8");
  const raw = await checkSite({ root, fs, git, env, base, components, hold: false });
  const found = [...countable([...raw.findings, ...await engines({ root })]).values()].map(({ file: at, rule, findings }) => ({ file: at, rule, count: findings.length, findings: findings.map((entry) => ({ at: entry.file, problem: entry.problem })) }));
  const next = nextBaseline(Object.hasOwn(config, "baseline") ? config.baseline : undefined, found);
  const out = withBaseline(text, next.baseline);
  if (out !== text) fs.writeFileSync(file, out);
  const after = await recheck();
  return { config: CONFIG_FILE, written: out !== text, first: next.first, baseline: next.baseline, found, shrunk: next.shrunk, removed: next.removed, refused: next.refused, remaining: after.findings, warnings: after.warnings };
}

/** What `--baseline` did, as lines: what it wrote (each entry with its findings, the first time), what it shrank, what it refused, and what no baseline takes. */
export function formatBaselineReport(result) {
  const total = (entries) => entries.reduce((n, entry) => n + entry.count, 0);
  const size = `${entryCount(result.baseline.length)}, ${plural(total(result.baseline), "finding")}`;
  const lines = [];
  if (result.first) {
    lines.push(`check-site --baseline: wrote the first baseline into ${result.config}: ${size}, each to move onto its engine in a pull request of its own; the list only shrinks`);
    for (const entry of result.found) lines.push(`  ${entry.file}  ${entry.rule} ×${entry.count}`, ...entry.findings.map(({ at, problem }) => `    ${at}  ${problem}`));
    if (result.baseline.length) lines.push(`Each entry's "reason" is empty for the owner to fill: why it is still here.`);
  } else {
    lines.push(`check-site --baseline: ${result.written ? `wrote ${result.config}` : `${result.config} unchanged`} — ${size}`);
    lines.push(...result.removed.map((entry) => `  − ${entry.file}  ${entry.rule}: none left, the entry is gone`), ...result.shrunk.map((entry) => `  ↓ ${entry.file}  ${entry.rule}: ${entry.count} → ${entry.to}`));
  }
  if (result.refused.length) lines.push("", `check-site --baseline: refused ${entryCount(result.refused.length)}: the baseline only shrinks, and takes nothing new`, "", ...result.refused.map((entry) => `  ✗ ${entry.file}  ${entry.rule}: ${entry.found} here, and the baseline holds ${entry.count}${entry.count ? "" : " (no entry)"}\n    → move ${entry.found - entry.count === 1 ? "it" : `${entry.found - entry.count} of them`} onto the engine, as the lint's message says`));
  if (result.remaining.length) lines.push("", `check-site: ${plural(result.remaining.length, "problem")} no baseline takes, which fail until fixed (docs/migrating-to-0.8.2.md § 1):`, "", ...entryLines(result.remaining, "✗"));
  if (result.warnings.length) lines.push("", `check-site: ${plural(result.warnings.length, "warning")}, which fail nothing and no baseline takes: each goes quiet with its reason (docs/migrating-to-0.8.2.md § 4)`);
  return lines;
}
