// `agentic-cms upgrade`: a site moved to the release whose code runs it
// (`pnpm dlx agentic-cms@<version> upgrade`), docs/upgrading.md made
// executable (docs/roadmap.md job 5):
// 1. the version the site is on: node_modules/agentic-cms's, the manifest's
//    when that is older (a pin moved by hand), or --from;
// 2. `pnpm add agentic-cms@<spec>`: the site's own form of spec at this
//    version (a git tag, or a range from a registry), or --kit's;
// 3. each migration this release carries newer than that version
//    (scripts/migrations/<version>.mjs), oldest first: detect() what it
//    would change, then apply() it — idempotent, so a second run finds
//    nothing to do but the manual steps still left;
// 4. `init --agent-files`: the kit's lines rewritten, the site's own kept;
// 5. the manual steps the migrations found, each with its section of
//    docs/upgrading.md;
// 6. the verify, `pnpm lint` and `pnpm test`.
// --dry-run reads, detects and checks, and changes nothing. The shell is
// passed in (`exec`), so the tests run it on fixture sites.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MANIFEST } from "./agent-file-format.mjs";
import { agentFiles } from "./agent-files.mjs";

/** The migrations a release carries, one file per version. */
export const MIGRATIONS = path.resolve(import.meta.dirname, "../migrations");
/** A site upgrade cannot read or move: no package.json, no dependency, no version, a pin it does not move, an install that failed. Exit 2. */
export class UpgradeError extends Error {}

/** A version's x.y.z as numbers, a pre-release's included (0.9.0-rc.1 is 0.9.0's); null for none. */
export const coreOf = (version) => version?.match(/^(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number) ?? null;
/** a against b by x.y.z: negative, 0 or positive. */
export const compareVersions = (a, b) => coreOf(a).reduce((order, n, i) => order || n - coreOf(b)[i], 0);

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } };

/** The version the site is on: the installed kit's, or the manifest's when it is older; throws an UpgradeError when neither says. */
export function siteVersion(site) {
  const installed = readJson(path.join(site, "node_modules/agentic-cms/package.json"))?.version;
  const recorded = readJson(path.join(site, MANIFEST))?.version;
  const known = [installed, recorded].filter(coreOf);
  if (!known.length) throw new UpgradeError("no agentic-cms in node_modules and no .agentic-cms.json to say what the site is on: run pnpm install, or name the version with --from <version>");
  return known.sort(compareVersions)[0];
}

/** The spec `pnpm add` takes for this version, in the site's own form: a git tag moved to `v<version>`, a range to `^<version>`; throws an UpgradeError for a pin of another form. */
export function specFor(pkg, version) {
  const current = pkg.dependencies?.["agentic-cms"] ?? pkg.devDependencies?.["agentic-cms"];
  if (!current) throw new UpgradeError("package.json names no agentic-cms dependency: agentic-cms init lays a site out");
  if (/#v\d+\.\d+\.\d+[\w.-]*$/.test(current)) return current.replace(/#v[\w.-]+$/, `#v${version}`);
  if (/^[\^~]?\d+\.\d+\.\d+/.test(current)) return `^${version}`;
  throw new UpgradeError(`package.json pins agentic-cms at ${current}, which upgrade does not move by itself: name the spec with --kit <spec>`);
}

/** Every migration in `dir`, oldest first: { version, detect, apply }, each file named for its version. */
export async function loadMigrations(dir = MIGRATIONS) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => /^\d+\.\d+\.\d+\.mjs$/.test(file)) : [];
  const loaded = await Promise.all(files.map(async (file) => ({ file, migration: await import(pathToFileURL(path.join(dir, file)).href) })));
  return loaded.map(({ file, migration }) => ({ version: file.slice(0, -4), detect: migration.detect, apply: migration.apply })).sort((a, b) => compareVersions(a.version, b.version));
}

/** Each due migration's findings, applied unless `dryRun`: [{ version, found, changed, manual }]. */
function runMigrations(site, due, { dryRun, context }) {
  return due.map(({ version, detect, apply }) => {
    const found = detect(site, context);
    if (dryRun || !found.length) return { version, found, changed: [], manual: [] };
    const { changed = [], manual = [] } = apply(site, context);
    return { version, found, changed, manual };
  });
}

/**
 * Moves the site to `version`, the release running: { from, to, spec,
 * dryRun, migrations, agentFiles, manual, verify, exit }, `exit` 1 when a
 * manual step is left or the verify failed. Throws an UpgradeError (exit 2)
 * before anything changes when the site cannot be read, and when the
 * install fails.
 */
export async function upgrade(site, { kitRoot, version, kit, from, dryRun = false, exec, log = () => {}, migrations }) {
  const pkg = readJson(path.join(site, "package.json"));
  if (!pkg) throw new UpgradeError("no package.json here: run it in the site's root");
  if (from !== undefined && !coreOf(from)) throw new UpgradeError(`--from ${from} is not a version (x.y.z)`);
  const was = from ?? siteVersion(site);
  const spec = kit ?? specFor(pkg, version);
  const due = (migrations ?? (await loadMigrations())).filter((m) => compareVersions(m.version, was) > 0);
  const report = { from: was, to: version, spec, dryRun, migrations: [], agentFiles: [], manual: [], verify: [] };
  if (!dryRun) {
    log(`pnpm add agentic-cms@${spec}`);
    if (exec("pnpm", ["add", `agentic-cms@${spec}`]).status !== 0) throw new UpgradeError(`pnpm add agentic-cms@${spec} failed: nothing else was changed`);
  }
  report.migrations = runMigrations(site, due, { dryRun, context: { kitRoot, log } });
  report.manual = report.migrations.flatMap((m) => m.manual);
  report.agentFiles = agentFiles(site, { kitRoot, version, check: dryRun, log });
  if (!dryRun) report.verify = ["lint", "test"].map((script) => { log(`pnpm ${script}`); return { script, status: exec("pnpm", [script]).status }; });
  report.exit = report.manual.length || report.verify.some((v) => v.status !== 0) ? 1 : 0;
  return report;
}
