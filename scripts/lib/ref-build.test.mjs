import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRef, refDirectory } from "./ref-build.mjs";

// A recorder in place of the shell and the file system: every command, removal and write is logged in order, rev-parse / log answer from a table, files and folders from `existing` and `listings`.
function recorder({ answers = {}, existing = [], listings = {}, files = {} } = {}) {
  const calls = [];
  const exec = (command, args, options = {}) => {
    calls.push({ command, args, cwd: options.cwd });
    const key = `${command} ${args.join(" ")}`;
    if (key in answers) { if (answers[key] instanceof Error) throw answers[key]; return answers[key]; }
    return "";
  };
  const written = {};
  const io = {
    exec,
    exists: (p) => existing.includes(p) || p in files,
    rm: (p) => calls.push({ command: "rm", args: [p] }),
    readdir: (dir) => listings[dir] ?? [],
    read: (file) => files[file],
    write: (file, text) => { calls.push({ command: "write", args: [file] }); written[file] = text; },
  };
  return { calls, io, written, keys: () => calls.map((c) => `${c.command} ${c.args.join(" ")}`) };
}

const root = "/work/site";
const SHA = "0123456789abcdef0123456789abcdef01234567";

test("the worktree is a sibling of the site named by the sha", () => {
  assert.equal(refDirectory(root, SHA), "/work/site-ref-0123456789ab");
});

test("a fresh ref: fetch, resolve origin/<ref> first, add a detached worktree, install frozen, build, stamp", () => {
  const r = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": `${SHA}\n`, [`git log -1 --format=%h %ci %s ${SHA}`]: "0123456 2026-09-20 10:00:00 +0200 the subject\n" } });
  const result = buildRef("main", { root, ...r.io, log: () => {} });
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
    "write /work/site-ref-0123456789ab/.parity/ref-build.json",
  ]);
  assert.equal(r.calls[6].cwd, "/work/site-ref-0123456789ab");
  assert.equal(r.calls[7].cwd, "/work/site-ref-0123456789ab");
  assert.deepEqual(JSON.parse(r.written["/work/site-ref-0123456789ab/.parity/ref-build.json"]), { sha: SHA, demos: [] }, "the stamp is written only after the build succeeded");
  assert.deepEqual(result.demos, []);
});

test("a build that fails leaves no stamp", () => {
  const r = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": SHA, "pnpm build": new Error("the SEO audit failed") } });
  assert.throws(() => buildRef("main", { root, ...r.io, log: () => {} }), /the SEO audit failed/);
  assert.deepEqual(r.written, {});
});

test("the commit's demo routes are removed after checkout, before install and build, and named", () => {
  const dir = "/work/site-ref-0123456789ab";
  const lines = [];
  const r = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": SHA }, listings: { [`${dir}/src/app`]: ["layout.tsx", "lab-demo", "blog", "hero-demo", "[[...slug]]"] } });
  const result = buildRef("main", { root, ...r.io, log: (l) => lines.push(l) });
  assert.deepEqual(result.demos, ["/hero-demo", "/lab-demo"]);
  const keys = r.keys();
  const at = (key) => keys.indexOf(key);
  assert.ok(at(`git worktree add --detach ${dir} ${SHA}`) < at(`rm ${dir}/src/app/hero-demo`));
  assert.ok(at(`rm ${dir}/src/app/lab-demo`) < at("pnpm install --frozen-lockfile --prefer-offline"));
  assert.ok(!keys.includes(`rm ${dir}/src/app/blog`));
  assert.ok(lines.includes("visual-parity: baseline without its demo routes: /hero-demo, /lab-demo (never production)"));
  assert.deepEqual(JSON.parse(r.written[`${dir}/.parity/ref-build.json`]).demos, ["/hero-demo", "/lab-demo"]);
});

test("a sha or a local ref that origin does not have resolves as given; a ref nobody has names the fix", () => {
  const r = recorder({ answers: { "git rev-parse --verify origin/abc^{commit}": new Error("unknown revision"), "git rev-parse --verify abc^{commit}": `${SHA}\n` } });
  assert.equal(buildRef("abc", { root, ...r.io, log: () => {} }).sha, SHA);
  const none = recorder({ answers: { "git rev-parse --verify origin/nope^{commit}": new Error("x"), "git rev-parse --verify nope^{commit}": new Error("x") } });
  assert.throws(() => buildRef("nope", { root, ...none.io, log: () => {} }), /nope: not a commit, branch or tag of this repository or its origin/);
});

test("a stamped sibling for the same sha is reused; older ref siblings are removed when a new one is made", () => {
  const dir = "/work/site-ref-0123456789ab";
  const reuse = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": SHA }, existing: [dir, `${dir}/.next/server/app`], files: { [`${dir}/.parity/ref-build.json`]: JSON.stringify({ sha: SHA, demos: ["/hero-demo"] }) } });
  const result = buildRef("main", { root, ...reuse.io, log: () => {} });
  assert.equal(result.reused, true);
  assert.deepEqual(result.demos, ["/hero-demo"]);
  assert.ok(!reuse.calls.some((c) => c.command === "pnpm"), "nothing installed or built");

  const stale = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": SHA, "git worktree list --porcelain": `worktree /work/site\nHEAD abc\n\nworktree /work/site-ref-ffffffffffff\nHEAD fff\ndetached\n\n` }, existing: ["/work/site-ref-ffffffffffff"] });
  buildRef("main", { root, ...stale.io, log: () => {} });
  assert.ok(stale.calls.some((c) => c.command === "git" && c.args.join(" ") === "worktree remove --force /work/site-ref-ffffffffffff"), "the older sibling is removed as a worktree");
});

test("a sibling for the same sha without a stamp (its build failed) is removed as a worktree before the prune, then rebuilt", () => {
  const dir = "/work/site-ref-0123456789ab";
  const r = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": SHA }, existing: [dir, `${dir}/.next/server/app`] });
  const result = buildRef("main", { root, ...r.io, log: () => {} });
  assert.equal(result.reused, false);
  const keys = r.keys();
  assert.ok(keys.indexOf(`git worktree remove --force ${dir}`) < keys.indexOf("git worktree prune"), "removed while git still lists it, not deleted and then pruned");
  assert.ok(keys.indexOf("git worktree prune") < keys.indexOf(`git worktree add --detach ${dir} ${SHA}`));
  assert.ok(keys.includes("pnpm build"));

  const other = recorder({ answers: { "git rev-parse --verify origin/main^{commit}": SHA }, existing: [dir], files: { [`${dir}/.parity/ref-build.json`]: JSON.stringify({ sha: "f".repeat(40) }) } });
  assert.equal(buildRef("main", { root, ...other.io, log: () => {} }).reused, false, "a stamp for another sha is not this build");
});

test("a failed fetch is a warning, not the end: the ref may exist locally", () => {
  const lines = [];
  const r = recorder({ answers: { "git fetch origin --quiet": new Error("no network"), "git rev-parse --verify origin/main^{commit}": SHA } });
  buildRef("main", { root, ...r.io, log: (l) => lines.push(l) });
  assert.ok(lines.some((l) => /could not fetch origin/.test(l)));
});
