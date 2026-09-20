// A baseline build of another commit for `visual-parity capture --ref`: the
// ref resolved on origin first (a branch name means the branch as pushed),
// checked out as a detached worktree in a sibling directory of the site —
// never inside it, where the site's tsconfig would include it — installed
// with the lockfile as it was and built there. A cache of one: a sibling
// already built for the same sha is reused, and older ref siblings are
// removed when a new one is made. The shell is injected so the sequence is
// tested without git.
import path from "node:path";

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

/** Resolves, checks out, installs and builds the ref; { dir, sha, subject, reused }. */
export function buildRef(ref, { root, exec, exists, rm, log = console.error }) {
  try { exec("git", ["fetch", "origin", "--quiet"], { cwd: root }); } catch { log(`visual-parity: could not fetch origin; resolving ${ref} from what is here`); }
  const sha = resolve(exec, root, ref);
  let subject = sha.slice(0, 7);
  try { subject = git(exec, root, ["log", "-1", "--format=%h %ci %s", sha]); } catch { /* a sha with no log line */ }
  const dir = refDirectory(root, sha);
  log(`visual-parity: baseline ${ref} = ${subject}`);
  if (exists(path.join(dir, ".next/server/app"))) { log(`visual-parity: reusing the build in ${dir}`); return { dir, sha, subject, reused: true }; }
  for (const stale of staleSiblings(exec, root, dir)) {
    log(`visual-parity: removing the older baseline ${stale}`);
    try { exec("git", ["worktree", "remove", "--force", stale], { cwd: root }); } catch { /* not a worktree any more */ }
    if (exists(stale)) rm(stale);
  }
  exec("git", ["worktree", "prune"], { cwd: root });
  if (exists(dir)) rm(dir);
  exec("git", ["worktree", "add", "--detach", dir, sha], { cwd: root });
  log(`visual-parity: installing and building ${dir} (minutes)`);
  exec("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: dir });
  exec("pnpm", ["build"], { cwd: dir });
  return { dir, sha, subject, reused: false };
}
