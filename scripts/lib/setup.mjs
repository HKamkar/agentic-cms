// `agentic-cms setup`: a clone made ready to work on. The package lives in
// node_modules, so it cannot install Node, pnpm or itself; scripts/setup.sh
// (templates/site/setup.sh, which init copies) checks Node, gets pnpm at the
// version package.json pins, installs, then hands over to this. Each step
// keeps what is already there, so a re-run takes seconds: the browsers the
// kit drives (Chromium for every command, WebKit for the Safari-engine
// checks, whose Linux libraries need sudo, the owner's step), .env.local
// from .env.example, this machine's addresses in ALLOWED_DEV_ORIGINS, the
// lint and the tests (the build with `build`), then the URLs. `check` is the
// doctor: every step reported, nothing written, installed or run. The shell,
// the file system, the browsers and the network come in, so the plan is
// tested without installing anything; docs/setup.md is the procedure.
import path from "node:path";
import { ENGINES } from "./browser.mjs";
import { ENV_FILE, devPort, urlsReport } from "./hosts.mjs";
import { PLACEHOLDERS_ENV } from "./placeholders.mjs";

/** The Node the kit needs, as .nvmrc and package.json's engines say. */
export const MIN_NODE = [22, 18];
/** The line that installs WebKit's Linux libraries; `$(command -v node)` because sudo resets PATH and may not find a Node a version manager installed. */
export const DEPS_LINE = 'sudo "$(command -v node)" node_modules/playwright-core/cli.js install-deps webkit';

export class SetupError extends Error {}

const nodeOk = (version) => { const [major, minor] = version.split(".").map(Number); return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]); };
const pinned = (pkg) => pkg.packageManager?.match(/^pnpm@([^+]+)/)?.[1] ?? null;

/** The engines a flag asks for, in the kit's order; a SetupError for one it does not know. */
export function parseEngines(value) {
  const asked = value.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const unknown = asked.filter((e) => !ENGINES.includes(e));
  if (unknown.length || !asked.length) throw new SetupError(`--engines is a list of ${ENGINES.join(", ")}, not ${value}`);
  return ENGINES.filter((e) => asked.includes(e));
}

/**
 * Runs (or with `check`, reports) every step; resolves to { ready, check,
 * steps, todo, urls, exit }. A step is { step, status, detail, command? }:
 * ok (already there), done (done now), skipped, gap (--check: missing),
 * todo (left for the owner), failed. `exec(cmd, args, { capture, env })` returns
 * { status, stdout }; `browsers` is { path(engine), launches(engine), cli };
 * `net` is what urlsReport takes (interfaces, fetch, up, kill).
 */
export async function setup({ root, flags, exec, fs, browsers, net = {}, versions = process.versions, platform = process.platform, log = () => {} }) {
  const steps = [];
  const step = (name, status, detail, command) => { const s = { step: name, status, detail, ...(command ? { command } : {}) }; steps.push(s); log(s); return s; };
  const result = (exit, urls = null) => ({ ready: exit === 0 && !steps.some((s) => s.status === "todo" || s.status === "gap"), check: Boolean(flags.check), steps, todo: steps.filter((s) => s.command && (s.status === "todo" || s.status === "gap")).map((s) => s.command), urls, exit });
  const fail = (name, detail, command) => { step(name, "failed", detail, command); return result(2); };

  if (!nodeOk(versions.node)) return fail("node", `Node ${versions.node} is too old: the kit needs ${MIN_NODE.join(".")} or newer (the version .nvmrc names)`, "nvm install && nvm use");
  step("node", "ok", `Node ${versions.node}`);
  const pkgFile = path.join(root, "package.json");
  if (!fs.existsSync(pkgFile)) return fail("package.json", "no package.json here: run setup in the site's root");
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));

  const pnpm = exec("pnpm", ["--version"], { capture: true });
  if (pnpm.status !== 0) return fail("pnpm", "pnpm is not installed: bash scripts/setup.sh gets the version package.json pins", "bash scripts/setup.sh");
  const version = pnpm.stdout.trim();
  const want = pinned(pkg);
  step("pnpm", "ok", want && want !== version ? `pnpm ${version} (package.json pins ${want}; pnpm switches to it in this folder)` : `pnpm ${version}`);

  const browserFailure = await browserSteps({ flags, exec, browsers, platform, step });
  if (browserFailure) return fail(...browserFailure);

  envStep({ root, flags, fs, step });
  const urls = await urlsReport({ root, port: flags.port ?? devPort(pkg.scripts), labPort: flags.labPort, lookupPublic: flags.public, write: !flags.check, fs, ...net });
  originsStep(urls, { flags, step });
  if (flags.check) {
    step("verify", "skipped", "--check runs nothing: setup runs pnpm lint and pnpm test");
    return result(steps.some((s) => s.status === "gap" || s.status === "todo") ? 1 : 0, urls);
  }

  for (const script of ["lint", "test", ...(flags.build ? ["build"] : [])]) {
    // the build here proves the clone builds and deploys nothing: a new site's placeholders stay warnings, as in its CI
    if (exec("pnpm", [script], script === "build" ? { env: { [PLACEHOLDERS_ENV]: "warn" } } : {}).status !== 0) { step("verify", "failed", `pnpm ${script} failed: its output is above; fix the cause, then run setup again`, `pnpm ${script}`); return result(1, urls); }
    step("verify", "done", `pnpm ${script}`);
  }
  if (!flags.build) step("verify", "skipped", "pnpm build is the full gate (setup --build), about a minute");
  return result(0, urls);
}

/** The browsers: installed when missing, WebKit's Linux libraries checked by a launch. A failure as [step, detail, command], else null. */
async function browserSteps({ flags, exec, browsers, platform, step }) {
  if (!flags.browsers) { step("browsers", "skipped", "--no-browsers: shot, probe, sheet, visual-parity and lab render need Chromium"); return null; }
  if (!browsers.cli) return ["browsers", "playwright-core is not installed (an optional peer of agentic-cms)", "pnpm add -D playwright-core"];
  const missing = flags.engines.filter((e) => !browsers.path(e));
  const install = `pnpm exec playwright-core install ${missing.join(" ")}`;
  if (!missing.length) step("browsers", "ok", `${flags.engines.join(", ")} installed`);
  else if (flags.check) step("browsers", "gap", `${missing.join(", ")} not installed`, install);
  else {
    if (exec("pnpm", ["exec", "playwright-core", "install", ...missing]).status !== 0) return ["browsers", "the browser install failed: its output is above (the network, or the disk)", install];
    const still = missing.filter((e) => !browsers.path(e));
    if (still.length) return ["browsers", `${still.join(", ")} still not found after the install`, install];
    step("browsers", "done", `installed ${missing.join(", ")}`);
  }
  if (platform === "linux" && flags.engines.includes("webkit") && browsers.path("webkit")) await webkitLibraries({ flags, exec, browsers, step });
  return null;
}

/** WebKit on Linux needs system libraries the first time: a launch tells; --deps installs them with sudo, else the line is left for the owner. */
async function webkitLibraries({ flags, exec, browsers, step }) {
  if (await browsers.launches("webkit")) { step("webkit libraries", "ok", "WebKit launches"); return; }
  const missing = "WebKit does not launch: it needs system libraries, which take sudo (Chromium works without them)";
  if (flags.check || !flags.deps) { step("webkit libraries", "todo", `${missing}: run the line, or setup --deps`, DEPS_LINE); return; }
  const ran = exec("sudo", [process.execPath, browsers.cli, "install-deps", "webkit"]);
  if (ran.status === 0 && (await browsers.launches("webkit"))) { step("webkit libraries", "done", "installed; WebKit launches"); return; }
  step("webkit libraries", "todo", "sudo could not install them here: run the line yourself", DEPS_LINE);
}

/** .env.local from .env.example when it is absent: gitignored, per machine. */
function envStep({ root, flags, fs, step }) {
  const local = path.join(root, ENV_FILE), example = path.join(root, ".env.example");
  if (fs.existsSync(local)) { step("env", "ok", `kept the existing ${ENV_FILE}`); return; }
  if (!fs.existsSync(example)) { step("env", "skipped", `no .env.example; the origins step writes ${ENV_FILE} if an address needs it`); return; }
  if (flags.check) { step("env", "gap", `no ${ENV_FILE} (setup copies .env.example)`, "cp .env.example .env.local"); return; }
  fs.copyFileSync(example, local);
  step("env", "done", `${ENV_FILE} created from .env.example`);
}

/** ALLOWED_DEV_ORIGINS against this machine's addresses, and what holds the dev port: this clone's next dev (its lock), something else, or nothing. */
function originsStep(urls, { flags, step }) {
  const { origins, addresses, dev } = urls;
  const hosts = [...addresses.lan, ...(addresses.public ? [addresses.public] : [])];
  if (origins.written.length) step("origins", "done", `added ${origins.written.join(", ")} to ALLOWED_DEV_ORIGINS${dev.ownPort ? "; restart the dev server to apply it" : ""}`);
  else if (origins.missing.length) step("origins", "gap", `ALLOWED_DEV_ORIGINS lacks ${origins.missing.join(", ")}`, "pnpm urls --write");
  else step("origins", "ok", hosts.length ? `ALLOWED_DEV_ORIGINS covers ${hosts.join(", ")}` : "no address but localhost to cover");
  if (flags.check && dev.port) step("dev port", "ok", dev.own ? `this clone's next dev runs on ${dev.port}`
    : dev.up ? `${dev.port} answers, but not as this clone's next dev: pnpm dev needs the port, so stop what holds it first (docs/dev-server.md § Stopping a server)`
    : `${dev.port} is free for pnpm dev`);
}
