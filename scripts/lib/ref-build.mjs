// A baseline build of another commit for `visual-parity capture --ref`: the
// ref resolved on origin first (a branch name means the branch as pushed),
// checked out as a detached worktree in a sibling directory of the site —
// never inside it, where the site's tsconfig would include it — its demo
// routes removed (a design round's src/app/<name>-demo, never production,
// which the build's SEO audit rejects by design), installed with the
// lockfile as it was and built there. A cache of one: a sibling whose build
// succeeded for the same sha (its stamp says so) is reused, and older ref
// siblings are removed when a new one is made. The shell and the file system
// are injected so the sequence is tested without git.
import fs from "node:fs";
import path from "node:path";

/** Written in the sibling once its build succeeded; a sibling without it (a failed build) is rebuilt, never reused. */
export const STAMP = ".parity/ref-build.json";
const DEFAULTS = {
  readdir: (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []),
  read: (file) => fs.readFileSync(file, "utf8"),
  write: (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); },
};

/** The sibling directory a sha is built in: ../<site>-ref-<sha12>. */
export const refDirectory = (root, sha) => path.join(path.dirname(root), `${path.basename(root)}-ref-${sha.slice(0, 12)}`);

const git = (exec, root, args) => String(exec("git", args, { cwd: root })).trim();

function resolve(exec, root, ref) {
  for (const candidate of [`origin/${ref}`, ref]) {
    try { const sha = git(exec, root, ["rev-parse", "--verify", `${candidate}^{commit}`]); if (/^[0-9a-f]{40}$/.test(sha)) return sha; } catch { /* the next candidate */ }
  }
  throw new Error(`${ref}: not a commit, branch or tag of this repository or its origin`);
}

/** Worktrees of the repository that are ref siblings of the site, other than `keep`. */
function staleSiblings(exec, root, keep) {
  const prefix = `${path.basename(root)}-ref-`;
  let listing = "";
  try { listing = git(exec, root, ["worktree", "list", "--porcelain"]); } catch { return []; }
  return listing.split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice(9)).filter((dir) => path.basename(dir).startsWith(prefix) && dir !== keep);
}

/** The stamp of a sibling, or null when it has none (never built, or its build failed). */
function readStamp(dir, { exists, read }) {
  const file = path.join(dir, STAMP);
  if (!exists(file)) return null;
  try { return JSON.parse(read(file)); } catch { return null; }
}

/** Removes the worktree's demo routes (src/app/<name>-demo); their routes, e.g. ["/hero-demo"]. */
function removeDemos(dir, { readdir, rm, log }) {
  const demos = readdir(path.join(dir, "src/app")).filter((name) => /^[a-z0-9][a-z0-9-]*-demo$/.test(name)).sort();
  for (const name of demos) rm(path.join(dir, "src/app", name));
  if (demos.length) log(`visual-parity: baseline without its demo routes: ${demos.map((d) => `/${d}`).join(", ")} (never production)`);
  return demos.map((d) => `/${d}`);
}

/** Clears the way for a fresh worktree at dir: the same sha's unstamped sibling, then older ref siblings, then git's records of them. */
function clearSiblings(dir, { root, exec, exists, rm, log }) {
  // `worktree remove` before `prune`: a folder deleted while git still lists it makes the next `worktree add` fail ("missing but already registered")
  if (exists(dir)) {
    log(`visual-parity: rebuilding ${dir} (no stamp: its build did not finish)`);
    try { exec("git", ["worktree", "remove", "--force", dir], { cwd: root }); } catch { /* not a worktree any more */ }
    if (exists(dir)) rm(dir);
  }
  for (const stale of staleSiblings(exec, root, dir)) {
    log(`visual-parity: removing the older baseline ${stale}`);
    try { exec("git", ["worktree", "remove", "--force", stale], { cwd: root }); } catch { /* not a worktree any more */ }
    if (exists(stale)) rm(stale);
  }
  exec("git", ["worktree", "prune"], { cwd: root });
}

/** Resolves, checks out, strips the demo routes of, installs and builds the ref; { dir, sha, subject, reused, demos }. */
export function buildRef(ref, { root, exec, exists, rm, log = console.error, ...io }) {
  const { readdir, read, write } = { ...DEFAULTS, ...io };
  try { exec("git", ["fetch", "origin", "--quiet"], { cwd: root }); } catch { log(`visual-parity: could not fetch origin; resolving ${ref} from what is here`); }
  const sha = resolve(exec, root, ref);
  let subject = sha.slice(0, 7);
  try { subject = git(exec, root, ["log", "-1", "--format=%h %ci %s", sha]); } catch { /* a sha with no log line */ }
  const dir = refDirectory(root, sha);
  log(`visual-parity: baseline ${ref} = ${subject}`);
  const stamp = readStamp(dir, { exists, read });
  if (stamp?.sha === sha) { log(`visual-parity: reusing the build in ${dir}`); return { dir, sha, subject, reused: true, demos: stamp.demos ?? [] }; }
  clearSiblings(dir, { root, exec, exists, rm, log });
  exec("git", ["worktree", "add", "--detach", dir, sha], { cwd: root });
  const demos = removeDemos(dir, { readdir, rm, log });
  log(`visual-parity: installing and building ${dir} (minutes)`);
  exec("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: dir });
  exec("pnpm", ["build"], { cwd: dir });
  write(path.join(dir, STAMP), JSON.stringify({ sha, demos }));
  return { dir, sha, subject, reused: false, demos };
}
