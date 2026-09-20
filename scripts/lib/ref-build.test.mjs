import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRef, refDirectory } from "./ref-build.mjs";

// A recorder in place of the shell: every command is logged, and rev-parse / log answer from a table.
function recorder({ answers = {}, existing = [] } = {}) {
  const calls = [];
  const exec = (command, args, options = {}) => {
    calls.push({ command, args, cwd: options.cwd });
    const key = `${command} ${args.join(" ")}`;
    if (key in answers) { if (answers[key] instanceof Error) throw answers[key]; return answers[key]; }
    return "";
  };
  return { calls, exec, exists: (p) => existing.includes(p), removed: [], rm: function (p) { this.removed.push(p); } };
}

const root = "/work/site";
const SHA = "0123456789abcdef0123456789abcdef01234567";

test("the worktree is a sibling of the site named by the sha", () => {
  assert.equal(refDirectory(root, SHA), "/work/site-ref-0123456789ab");
});

test("a fresh ref: fetch, resolve origin/<ref> first, add a detached worktree, install frozen, build", () => {
  const r = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": `${SHA}\n`, [`git log -1 --format=%h %ci %s ${SHA}`]: "0123456 2026-09-20 10:00:00 +0200 the subject\n" } });
  const result = buildRef("main", { root, exec: r.exec, exists: r.exists, rm: r.rm.bind(r), log: () => {} });
  assert.equal(result.sha, SHA);
  assert.equal(result.dir, "/work/site-ref-0123456789ab");
  assert.equal(result.subject, "0123456 2026-09-20 10:00:00 +0200 the subject");
  assert.equal(result.reused, false);
  const keys = r.calls.map((c) => `${c.command} ${c.args.join(" ")}`);
  assert.deepEqual(keys, [
    "git fetch origin --quiet",
    "git rev-parse --verify origin/main^{commit}",
    `git log -1 --format=%h %ci %s ${SHA}`,
    "git worktree list --porcelain",
    "git worktree prune",
    `git worktree add --detach /work/site-ref-0123456789ab ${SHA}`,
    "pnpm install --frozen-lockfile --prefer-offline",
    "pnpm build",
  ]);
  assert.equal(r.calls[6].cwd, "/work/site-ref-0123456789ab");
  assert.equal(r.calls[7].cwd, "/work/site-ref-0123456789ab");
});

test("a sha or a local ref that origin does not have resolves as given; a ref nobody has names the fix", () => {
  const r = recorder({ answers: { "git rev-parse --verify origin/abc^{commit}": new Error("unknown revision"), "git rev-parse --verify abc^{commit}": `${SHA}\n` } });
  assert.equal(buildRef("abc", { root, exec: r.exec, exists: r.exists, rm: r.rm.bind(r), log: () => {} }).sha, SHA);
  const none = recorder({ answers: { "git rev-parse --verify origin/nope^{commit}": new Error("x"), "git rev-parse --verify nope^{commit}": new Error("x") } });
  assert.throws(() => buildRef("nope", { root, exec: none.exec, exists: none.exists, rm: none.rm.bind(none), log: () => {} }), /nope: not a commit, branch or tag of this repository or its origin/);
});

test("a built sibling for the same sha is reused; older ref siblings are removed when a new one is made", () => {
  const dir = "/work/site-ref-0123456789ab";
  const reuse = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": SHA }, existing: [dir, `${dir}/.next/server/app`] });
  const result = buildRef("main", { root, exec: reuse.exec, exists: reuse.exists, rm: reuse.rm.bind(reuse), log: () => {} });
  assert.equal(result.reused, true);
  assert.ok(!reuse.calls.some((c) => c.command === "pnpm"), "nothing installed or built");

  const stale = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": SHA, "git worktree list --porcelain": `worktree /work/site\nHEAD abc\n\nworktree /work/site-ref-ffffffffffff\nHEAD fff\ndetached\n\n` }, existing: ["/work/site-ref-ffffffffffff"] });
  buildRef("main", { root, exec: stale.exec, exists: stale.exists, rm: stale.rm.bind(stale), log: () => {} });
  assert.ok(stale.calls.some((c) => c.command === "git" && c.args.join(" ") === "worktree remove --force /work/site-ref-ffffffffffff"), "the older sibling is removed as a worktree");
});

test("a failed fetch is a warning, not the end: the ref may exist locally", () => {
  const lines = [];
  const r = recorder({ answers: { "git fetch origin --quiet": new Error("no network"), "git rev-parse --verify origin/main^{commit}": SHA } });
  buildRef("main", { root, exec: r.exec, exists: r.exists, rm: r.rm.bind(r), log: (l) => lines.push(l) });
  assert.ok(lines.some((l) => /could not fetch origin/.test(l)));
});
