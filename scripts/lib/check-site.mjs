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
//     the tests, the build and the agent-file check; and, as warnings, its
//     preview job (docs/preview.md) can comment and diff, and no job uploads
//     a preview version without AGENTIC_CMS_PREVIEW=1;
//   - tools, the preferred tier's, so warnings that fail nothing: a script of
//     the site's own under scripts/ that drives Playwright (or another
//     headless browser), runs sharp over public/ or starts next dev, and a
//     machine's address in next.config.*; each names the kit's command, and
//     an `allow` entry of agentic-cms/site-tools with its reason quiets it;
//   - leftovers: what is left of the kit's example (./leftovers.mjs), its
//     brand by line and its sample content by path, by bytes and by entry;
//   - retired, a warning that fails nothing (docs/roadmap-0.9.0.md D13): a
//     page or a post the merge base published whose URL nothing answers now
//     (its file deleted, renamed, or its route changed) and no redirect in
//     content/redirects.yaml names — a post kept as a draft keeps its URL;
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
import { ROUTE_GROUP } from "./app-root.mjs";
import { CONFIG_FILE, componentsReport, DEMO_FOLDER, disablesIn, entryLines, formatReport, globRegex, isMap, isSource, plural, readConfig, resolveGuard, validAllow } from "./check-components.mjs";
import { MANIFEST as DEMO_MANIFEST } from "./demo.mjs";
import { baselineGrowth, countable, entryFindings, holdFindings, lintFindings, nextBaseline, validBaseline, withBaseline } from "./baseline.mjs";
import { buildGaps, buildScript, emailGuard, LINT, lintGaps } from "./gates.mjs";
import { exampleLeftovers } from "./leftovers.mjs";
import { KIT_NAME } from "./placeholders.mjs";
import { SITE_TOOLS } from "./preferred-rules.mjs";

/** The passes check-site adds to the components pass. */
export const SITE_PASSES = ["rounds", "exceptions", "scripts", "ci", "tools", "leftovers", "retired", "baseline"];
/** The lists that only shrink against the merge base. */
export const SHRINK_ONLY = ["inherited"];
/** The first line of the lab's throwaway route as `lab route` writes it (templates/lab-demo/page.tsx). */
export const LAB_HEADER = "// The lab on this site's theme — a throwaway route";
export const LAB_ROUTE = "lab-demo";
const PICTURES = "public/images";
const SITE_CONFIG = "src/config/site.ts";
const WORKFLOWS = ".github/workflows";
const NEXT_CONFIGS = ["next.config.ts", "next.config.mts", "next.config.mjs", "next.config.js", "next.config.cjs"];
const PAGES = "content/pages";
const POSTS = "content/blog";
const REDIRECTS = "content/redirects.yaml";
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

/** The folders a *-demo route sits in: the app folder, and each route group under it (the default language's tree, in a site in several languages). */
const demoBases = (site, app) => [app, ...folders(site, app).filter((name) => ROUTE_GROUP.test(name)).map((name) => `${app}/${name}`)];

/** A *-demo route is a round's (its demo.json) or the lab's; a round's pictures go with its route. */
function checkRounds(g, site) {
  const routes = demoBases(site, g.app).flatMap((base) => folders(site, base).filter((name) => DEMO_FOLDER.test(name)).map((name) => ({ base, name })));
  const lab = ({ base, name }) => name === LAB_ROUTE && (site.read(`${base}/${name}/page.tsx`) ?? "").startsWith(LAB_HEADER);
  const handMade = routes.filter((route) => !site.exists(`${route.base}/${route.name}/${DEMO_MANIFEST}`) && !lab(route));
  const leftover = folders(site, PICTURES).filter((name) => DEMO_FOLDER.test(name) && !routes.some((route) => route.name === name));
  return [
    ...handMade.map(({ base, name }) => finding("rounds", `${base}/${name}`, `a *-demo route \`demo new\` did not write (no ${DEMO_MANIFEST}): a round made by hand, whose candidates no check knows`, `a design round is agentic-cms demo new ${name.slice(0, -"-demo".length)} --section <type> (its candidates in the section's real frame, the page's copy read from its file; --component, --showcase for the rest): remove this route and start the round with demo new`)),
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
 * { why, note }: why there is none, and the report's line on it. With
 * --base, there must be one: a base that names no commit here, or a
 * checkout without the history, throws a SiteCheckError.
 */
export function mergeBase({ git, env = {}, base }) {
  const { out, resolves } = gitOf(git);
  const without = (why) => {
    if (base) throw new SiteCheckError(`--base ${base}: ${why}`);
    return { why, note: `${why}, so the exceptions added since the merge base are not compared` };
  };
  if (out("rev-parse", "--is-inside-work-tree") !== "true") return without("not a git checkout");
  if (!resolves("HEAD")) return without("no commit yet");
  const shallow = out("rev-parse", "--is-shallow-repository") === "true" ? "a shallow checkout (CI's checkout takes the history with fetch-depth: 0)" : null;
  if (base && !resolves(base)) return without(shallow ? `no such commit in ${shallow}` : "no commit or branch of that name here");
  const candidates = base ? [base] : [env.GITHUB_BASE_REF && `origin/${env.GITHUB_BASE_REF}`, "origin/HEAD", "origin/main", "main"].filter(Boolean);
  const ref = candidates.find(resolves);
  const why = shallow ?? `no base branch here (${candidates.join(", ")})`;
  if (!ref) return { why, note: `${why}, so the exceptions added since the merge base are not compared — --base <ref> names one` };
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

/** The merge base and the guard's config there: { found, show, before } — `found` mergeBase()'s answer, `show(file)` a file's text at the base, `before` the config (null when the base has none, or no base was found). */
function atBase({ git, env, base }) {
  const found = mergeBase({ git, env, base });
  if (!found.commit) return { found, show: () => null, before: null };
  const show = (file) => { const r = git(["show", `${found.commit}:./${file}`]); return r.status === 0 ? r.stdout : null; };
  const text = show(CONFIG_FILE);
  return { found, show, before: text === null ? null : readJson(text) };
}

/** The exceptions pass: the merge base (atBase()'s answer), what was added since it, and its findings; with no base, the note why and nothing compared. */
function checkExceptions({ found, show, before }, g, site, config) {
  if (!found.commit) return { base: null, note: found.note, added: [], findings: [] };
  const added = [...configAdded(before ?? {}, config), ...baselineAdded(before, config), ...disablesAdded(g, site, show), ...emailGuardAdded(site, show)];
  return { base: { ref: found.ref, commit: found.commit }, note: null, added, findings: [...exceptionFindings(found, before, config, added), ...baselineFindings(found, before, config)] };
}

/** The posts' URL prefix as site.ts writes it (the starter's when it names none). */
const postPrefix = (text) => text.match(/^\s*postPrefix:\s*["'`]([^"'`\n]+)["'`]/m)?.[1] ?? "/blog-post";
/** A page or post file of the engine's: in its folder or a language's under it (docs/locales.md), not `_`-prefixed. */
const pageFile = (file) => new RegExp(`^${PAGES}/(?:[a-z0-9-]+/)?[^/_][^/]*\\.ya?ml$`).test(file);
const postFile = (file) => new RegExp(`^${POSTS}/(?:[a-z0-9-]+/)?[^/_][^/]*\\.mdx?$`).test(file);
/** A post's URL: the prefix and its slug, under its language's prefix when it sits in that language's folder (content/blog/de/x.md → /de/blog-post/x). */
const postRoute = (file, prefix) => {
  const language = path.posix.dirname(file).slice(POSTS.length + 1);
  return `${language ? `/${language}` : ""}${prefix}/${path.basename(file).replace(/\.mdx?$/, "")}`;
};
const parsed = (text) => { try { return parseYaml(text); } catch { return null; } };
/** A post's frontmatter says draft: true. */
const draftPost = (text) => parsed(text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "")?.draft === true;

/** The routes page and post files answer: route → file; a page's its seo.path, a post's the prefix and its slug, a draft's only with `drafts` (a draft keeps its URL; one was never indexed). */
function routesOf(files, read, prefix, { drafts }) {
  const routes = new Map();
  for (const file of files) {
    const text = read(file);
    if (text === null) continue;
    if (pageFile(file)) { const route = parsed(text)?.seo?.path; if (typeof route === "string") routes.set(route, file); }
    if (postFile(file) && (drafts || !draftPost(text))) routes.set(postRoute(file, prefix), file);
  }
  return routes;
}

/** The `from` of every redirect content/redirects.yaml holds (none when it does not read). */
function redirectedPaths(site) {
  const list = parsed(site.read(REDIRECTS) ?? "");
  return new Set((Array.isArray(list) ? list : []).map((entry) => entry?.from).filter((from) => typeof from === "string"));
}

/** The retired pass: each URL a page or a published post answered at the merge base that nothing answers now and no redirect names — warnings, with the fix; none without a base. */
function checkRetired({ found, show }, { git }, site) {
  if (!found.commit) return [];
  const listed = git(["ls-tree", "-r", "--name-only", found.commit, "--", PAGES, POSTS]);
  if (listed.status !== 0) return [];
  const prefix = postPrefix(site.read(SITE_CONFIG) ?? "");
  const then = routesOf(listed.stdout.split("\n").filter(Boolean), show, prefix, { drafts: false });
  const now = routesOf([...site.walk(PAGES), ...site.walk(POSTS)], site.read, prefix, { drafts: true });
  const redirected = redirectedPaths(site);
  return [...then].filter(([route]) => !now.has(route) && !redirected.has(route)).map(([route, file]) => {
    const moved = site.exists(file) ? `its route was ${route} at ${found.ref} and is no longer` : `gone since ${found.ref}`;
    const keep = postFile(file) ? ", or keep the post as a draft (draft: true), which keeps its URL" : "";
    return finding("retired", file, `${moved}: ${route} answers 404 now, and no redirect in ${REDIRECTS} names it — an indexed URL never changes without one`, `add "- from: ${route}" with "to: <the page that has its content now>" to ${REDIRECTS} (/editorial:retire-content writes it)${keep}`);
  });
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

/** What CI runs: every workflow that runs on pull requests, its commands and its branch filter; { flows: [{ file, commands, branches, ignore }], unreadable }. */
/** The site's workflows that run on pull requests, parsed: { flows: [{ file, flow }], unreadable }. */
function pullRequestFlows(site) {
  const files = site.walk(WORKFLOWS).filter((file) => /\.ya?ml$/.test(file)).sort();
  const onPullRequests = (on) => on === "pull_request" || (Array.isArray(on) && on.includes("pull_request")) || (isMap(on) && "pull_request" in on);
  const out = { flows: [], unreadable: [] };
  for (const file of files) {
    let flow;
    try { flow = parseYaml(site.read(file)); } catch { out.unreadable.push(file); continue; }
    if (onPullRequests(flow?.on)) out.flows.push({ file, flow });
  }
  return out;
}

/** A job's steps, and the commands its `run:` lines hold. */
const stepsOf = (job) => (Array.isArray(job?.steps) ? job.steps : []);
const commandsOf = (steps) => steps.map((step) => step?.run).filter((run) => typeof run === "string").flatMap((run) => run.split(/\n|;|&&|\|\|/)).map((command) => command.trim()).filter(Boolean);

function workflowCommands(site) {
  const { flows, unreadable } = pullRequestFlows(site);
  return {
    unreadable,
    flows: flows.map(({ file, flow }) => {
      const trigger = isMap(flow.on) ? flow.on.pull_request : null;
      return { file, commands: commandsOf(Object.values(flow.jobs ?? {}).flatMap(stepsOf)), branches: listOf(trigger?.branches), ignore: listOf(trigger?.["branches-ignore"]) };
    }),
  };
}

const PR_PREVIEW = /^(?:(?:pnpm (?:exec )?|npx )?agentic-cms|pnpm kit) pr-preview(?:\s|$)/;
const HAND_PREVIEW = /\b(?:opennextjs-cloudflare upload|wrangler versions upload)\b.*--preview-alias\b/;
const TEMPLATE_PREVIEW = "node_modules/agentic-cms/templates/site/verify.yml's preview job";
/** The token may write pull request comments: the job's permissions, else the workflow's; none set is the repository's default, which the check cannot see. */
const writesComments = (permissions) => permissions === undefined || permissions === "write-all" || (isMap(permissions) && permissions["pull-requests"] === "write");
const flagged = (...envs) => envs.some((env) => String(env?.AGENTIC_CMS_PREVIEW ?? "") === "1");

/**
 * The preview job (docs/preview.md), warnings that fail nothing: one that
 * runs pr-preview without the permission to comment or the history it
 * diffs, and one that uploads a preview version by hand without
 * AGENTIC_CMS_PREVIEW=1, which would be indexable and deliver its forms.
 */
function previewWarnings(site) {
  return pullRequestFlows(site).flows.flatMap(({ file, flow }) => Object.entries(flow.jobs ?? {}).flatMap(([name, job]) => {
    const steps = stepsOf(job);
    const commands = commandsOf(steps);
    if (commands.some((command) => PR_PREVIEW.test(command))) {
      const checkout = steps.find((step) => /^actions\/checkout@/.test(step?.uses ?? ""));
      return [
        ...(writesComments(job.permissions ?? flow.permissions) ? [] : [finding("ci", file, `its ${name} job runs agentic-cms pr-preview without permissions: pull-requests: write, so the preview's comment cannot be posted`, `give the job permissions: { contents: read, pull-requests: write }, as ${TEMPLATE_PREVIEW} has`)]),
        ...(checkout && Number(checkout.with?.["fetch-depth"] ?? 1) !== 0 ? [finding("ci", file, `its ${name} job checks out without the history, so pr-preview cannot list the pages the change touches`, `fetch-depth: 0 on its checkout step, as ${TEMPLATE_PREVIEW} has`)] : []),
      ];
    }
    const hand = steps.find((step) => typeof step?.run === "string" && HAND_PREVIEW.test(step.run));
    return hand && !flagged(flow.env, job.env, ...steps.map((step) => step?.env)) ? [finding("ci", file, `its ${name} job uploads a preview version without AGENTIC_CMS_PREVIEW=1: that preview is indexable, and its forms deliver to the site's destination`, `run agentic-cms pr-preview in the job instead, which builds and uploads with the flag (${TEMPLATE_PREVIEW})`)] : [];
  }));
}

/** A trigger's branch filter as a list of patterns (null when it sets none). */
const listOf = (value) => (Array.isArray(value) ? value.map(String) : typeof value === "string" ? [value] : null);

/** Whether a pull request into `branch` runs a workflow its filter is: `branches` matched in order (a `!` pattern taking one back, the last match winning), `branches-ignore` leaving out each it matches, as GitHub reads them. */
export function runsInto(branch, { branches, ignore }) {
  if (ignore?.some((pattern) => globRegex(pattern).test(branch))) return false;
  if (!branches) return true;
  let runs = false;
  for (const pattern of branches) if (globRegex(pattern.replace(/^!/, "")).test(branch)) runs = !pattern.startsWith("!");
  return runs;
}

/**
 * The branches a site's pull requests go into, which its workflow on pull
 * requests must run for: in CI the pull request's own base (GITHUB_BASE_REF);
 * else the default branch (origin/HEAD's, else main) and develop where the
 * site has one, as the kit's git workflow has it.
 */
export function pullRequestTargets({ git, env = {} }) {
  if (env.GITHUB_BASE_REF) return [env.GITHUB_BASE_REF];
  const { out, resolves } = gitOf(git);
  if (out("rev-parse", "--is-inside-work-tree") !== "true") return [];
  const origin = out("rev-parse", "--abbrev-ref", "origin/HEAD");
  const main = origin && origin !== "origin/HEAD" ? origin.replace(/^origin\//, "") : ["main", "master"].find((name) => resolves(name) || resolves(`origin/${name}`));
  return [main, (resolves("develop") || resolves("origin/develop")) && "develop"].filter(Boolean).filter((name, at, all) => all.indexOf(name) === at);
}

/** The steps CI must run: the lint (or a build that runs it), the tests, the build, the agent-file check (in the kit's repository, its hygiene). */
const LINT_STEP = { what: "the lint", test: /^pnpm (?:run )?lint(?:\s|$)/, viaBuild: true };
const BUILD_STEP = { what: "the build", test: /^pnpm (?:run )?build(?:\s|$)/ };
const CI_STEPS = [
  LINT_STEP,
  { what: "the tests", test: /^pnpm (?:run )?test(?:\s|$)/ },
  BUILD_STEP,
  { what: "the agent-file check", test: /^(?:pnpm (?:exec )?|npx )?agentic-cms init \S+ --agent-files --check(?:\s|$)/, kit: /^pnpm (?:run )?hygiene(?:\s|$)/ },
];

/**
 * A workflow on pull requests runs the gates; a warning when the one that
 * runs the lint leaves out, in its branch filter, a branch the site's pull
 * requests go into (`targets()`, asked only then), whose pull requests then
 * get none of its checks; and the preview job's warnings (previewWarnings()).
 * { findings, warnings }.
 */
function checkCi(site, pkg, kit, targets = () => []) {
  const workflows = workflowCommands(site);
  const linting = workflows.flows.filter((flow) => flow.commands.some((command) => LINT_STEP.test.test(command) || BUILD_STEP.test.test(command)));
  const left = linting.length ? targets().filter((branch) => !linting.some((flow) => runsInto(branch, flow))) : [];
  const warnings = [...(left.length ? [finding("ci", linting[0].file, `the workflow that runs the lint on pull requests (${linting.map((flow) => flow.file).join(", ")}) runs on none into ${left.join(" or ")}, so such a pull request gets none of its checks`, `add ${left.join(" and ")} to its on.pull_request.branches, or drop the filter as node_modules/agentic-cms/templates/site/verify.yml does (its pull_request takes every branch)`)] : []), ...previewWarnings(site)];
  return { findings: ciGates(site, pkg, kit, workflows), warnings };
}

/** A workflow on pull requests runs the gates. */
function ciGates(site, pkg, kit, { flows, unreadable }) {
  const files = flows.map((flow) => flow.file);
  const commands = flows.flatMap((flow) => flow.commands);
  const template = "node_modules/agentic-cms/templates/site/verify.yml";
  const out = unreadable.map((file) => finding("ci", file, "a workflow that does not read as YAML", "fix its YAML: GitHub runs none of it"));
  if (!files.length) return [...out, finding("ci", `${WORKFLOWS}/verify.yml`, "no workflow runs on pull requests, so nothing holds the gates before a merge", `agentic-cms init writes ${WORKFLOWS}/verify.yml; a site from before it copies ${template}`)];
  const buildRunsLint = !buildGaps(pkg?.scripts?.build, { guard: false }).missing.some((gate) => gate.id === "lint");
  const ran = (step) => commands.some((command) => (kit && step.kit ? step.kit : step.test).test(command)) || (step.viaBuild && buildRunsLint && commands.some((command) => BUILD_STEP.test.test(command)));
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
  const at = atBase({ git, env, base });
  const exceptions = checkExceptions(at, g, site, config);
  const retired = checkRetired(at, { git }, site);
  const tools = checkTools(site, config, kit);
  const ci = checkCi(site, pkg, kit, () => pullRequestTargets({ git, env }));
  const own = [...checkRounds(g, site), ...exceptions.findings, ...checkScripts(site, pkg), ...ci.findings, ...tools.findings, ...checkLeftovers({ root, fs }, site, kit)];
  const baseline = hold ? baselinePass(config, [...componentFindings, ...own], site) : { findings: [...componentFindings, ...own], held: [], warnings: [] };
  const rounds = demoBases(site, g.app).flatMap((base) => folders(site, base).filter((name) => DEMO_FOLDER.test(name))).length;
  return { config: CONFIG_FILE, kit, components: summary, rounds, base: exceptions.base, history: exceptions.note, added: exceptions.added, baseline: { entries: validBaseline(config.baseline).length, held: baseline.held.length }, findings: baseline.findings, warnings: [...componentWarnings, ...ci.warnings, ...tools.warnings, ...retired, ...baseline.warnings] };
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
 * Whether `--baseline` writes the first list: the config has none, or the
 * merge base has none — the pull request that takes the rules, whose list
 * is its own until it merges, however many times it is written (an empty
 * `"baseline": []` copied with the guard's config, or one an earlier run
 * wrote) — as the exceptions pass reads it (baselineGrowth()). A list the
 * base has, a new site's empty one too, only shrinks; so does one with no
 * base to compare, which `note` says. { first, note }.
 */
export function firstBaseline(config, { found, before }) {
  if (!Object.hasOwn(config, "baseline")) return { first: true, note: null };
  if (!Array.isArray(config.baseline)) return { first: false, note: null };
  if (!found.commit) return { first: false, note: `${CONFIG_FILE}'s baseline takes new entries only while the merge base has no list, and there is no base here to compare (${found.why}): --base <ref> names the branch the pull request goes into` };
  return { first: !Array.isArray(before?.baseline), note: null };
}

/**
 * `check-site --baseline`: what the site holds now of the rules a baseline
 * holds — the findings of the engines' and the composition's rules as its
 * ESLint reads them, the baseline ignored (`lint`, ./baseline.mjs
 * lintFindings()), and the site check's own (rounds, the leftovers) —
 * written into the config's `baseline`: the whole list on the first run
 * (firstBaseline()), each entry keeping the reason the pull request's own
 * list gave it; else the list shrunk to it (an entry gone or lowered),
 * growth refused. The config's other bytes stay as they are. Then the site
 * check again, as the lint will run it (`recheck`: the CLI runs it in a
 * process of its own, which reads eslint.config.mjs afresh — this one's
 * import of it holds the list as it was). { config, written, first, rerun,
 * note, baseline, found, added, raised, shrunk, removed, refused,
 * remaining, warnings } — `remaining` the findings no baseline takes (the
 * gates, the config's own), which fail until they are fixed.
 */
export async function baselineSite({ root, fs, git, env = {}, base, components = componentsReport, lint = lintFindings, recheck = () => checkSite({ root, fs, git, env, base, components }) }) {
  const config = readConfig(root, fs);
  const file = path.join(root, CONFIG_FILE);
  const text = fs.readFileSync(file, "utf8");
  const raw = await checkSite({ root, fs, git, env, base, components, hold: false });
  const found = [...countable([...raw.findings, ...await lint({ root, baseline: config.baseline })]).values()].map(({ file: at, rule, findings }) => ({ file: at, rule, count: findings.length, findings: findings.map((entry) => ({ at: entry.file, problem: entry.problem })) }));
  const { first, note } = firstBaseline(config, atBase({ git, env, base }));
  const next = nextBaseline(config.baseline, found, { first });
  const out = withBaseline(text, next.baseline);
  if (out !== text) fs.writeFileSync(file, out);
  const after = await recheck();
  return { config: CONFIG_FILE, written: out !== text, note, found, ...next, remaining: after.findings, warnings: after.warnings };
}

/** Findings as `--baseline` found them, one line each, under their entry's own line. */
const findingLines = (findings) => findings.map(({ at, problem }) => `    ${at}  ${problem}`);
/** An entry's findings, by its file and rule. */
const foundLines = (result, { file, rule }) => findingLines(result.found.find((entry) => entry.file === file && entry.rule === rule)?.findings ?? []);

/** The entries an entry list lost or lowered, one line each. */
const shrinkLines = (result) => [...result.removed.map((entry) => `  − ${entry.file}  ${entry.rule}: none left, the entry is gone`), ...result.shrunk.map((entry) => `  ↓ ${entry.file}  ${entry.rule}: ${entry.count} → ${entry.to}`)];

/** The pull request's own list written again: what came in or rose, with its findings, what went or fell, and how many reasons it kept. */
function rerunLines(result, size) {
  const said = result.baseline.filter((entry) => String(entry.reason).trim()).length;
  const silent = result.baseline.length - said;
  return [
    `check-site --baseline: wrote ${result.config} again from what the site holds — ${size}: the merge base has no list, so this pull request's follows the site until it merges, and from then on only shrinks`,
    ...result.added.flatMap((entry) => [`  + ${entry.file}  ${entry.rule} ×${entry.count}`, ...foundLines(result, entry)]),
    ...result.raised.flatMap((entry) => [`  ↑ ${entry.file}  ${entry.rule}: ${entry.count} → ${entry.to}`, ...foundLines(result, entry)]),
    ...shrinkLines(result),
    `${entryCount(said)} kept ${said === 1 ? "its" : "their"} reason${silent ? `; ${entryCount(silent)} ${silent === 1 ? "says" : "say"} none yet, for the owner to fill: why it is still here` : ""}.`,
  ];
}

/** What `--baseline` wrote, as lines: the first list with each entry's findings, the pull request's own written again, or the list shrunk. */
function writtenLines(result) {
  const total = (entries) => entries.reduce((n, entry) => n + entry.count, 0);
  const size = `${entryCount(result.baseline.length)}, ${plural(total(result.baseline), "finding")}`;
  if (!result.written) return [`check-site --baseline: ${result.config} unchanged — ${size}`];
  if (result.rerun) return rerunLines(result, size);
  if (!result.first) return [`check-site --baseline: wrote ${result.config} — ${size}`, ...shrinkLines(result)];
  const lines = [`check-site --baseline: wrote the first baseline into ${result.config}: ${size}, each to be fixed in a pull request of its own; the list only shrinks`];
  for (const entry of result.found) lines.push(`  ${entry.file}  ${entry.rule} ×${entry.count}`, ...findingLines(entry.findings));
  if (result.baseline.length) lines.push(`Each entry's "reason" is empty for the owner to fill: why it is still here.`);
  return lines;
}

/** What `--baseline` did, as lines: what it wrote (writtenLines()), what it refused, and what no baseline takes. */
export function formatBaselineReport(result) {
  const lines = writtenLines(result);
  if (result.refused.length) lines.push("", `check-site --baseline: refused ${entryCount(result.refused.length)}: the baseline only shrinks, and takes nothing new`, ...(result.note ? [result.note] : []), "", ...result.refused.map((entry) => `  ✗ ${entry.file}  ${entry.rule}: ${entry.found} here, and the baseline holds ${entry.count}${entry.count ? "" : " (no entry)"}\n    → fix ${entry.found - entry.count === 1 ? "it" : `${entry.found - entry.count} of them`} as the lint's message says`));
  if (result.remaining.length) lines.push("", `check-site: ${plural(result.remaining.length, "problem")} no baseline takes, which fail until fixed (docs/migrating-to-0.8.2.md § 1):`, "", ...entryLines(result.remaining, "✗"));
  if (result.warnings.length) lines.push("", `check-site: ${plural(result.warnings.length, "warning")}, which fail nothing and no baseline takes: each goes quiet with its reason (docs/migrating-to-0.8.2.md § 4)`);
  return lines;
}
