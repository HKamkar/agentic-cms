// A capture photographs a copy of the build, not the working tree. The
// prerendered pages and payloads (.next/server/app), the static chunks
// (.next/static) and public/ are copied into .parity/snapshots/<label>/ in
// the layout serveStatic() reads, so a build, an asset edit or a moved file
// during the minutes a capture runs cannot change what it photographs.
// BUILD_ID is read before and after the copy: a build that ran while the
// copy was made fails the capture instead of mixing two builds.
import fs from "node:fs";
import path from "node:path";

export const SNAPSHOTS = ".parity/snapshots";
// the prerender manifest names each page's template, which --sample reads
const PARTS = [".next/server/app", ".next/static", "public", ".next/prerender-manifest.json"];

/** The build id Next wrote into <root>/.next/BUILD_ID, or null. */
export const buildId = (root) => { try { return fs.readFileSync(path.join(root, ".next/BUILD_ID"), "utf8").trim(); } catch { return null; } };
const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []);

/** Copies the build and public/ of root into dest; { dir, files, bytes }. Throws with the fix when there is no build, or when the build changed during the copy. */
export function snapshotBuild(root, dest) {
  if (!fs.existsSync(path.join(root, ".next/server/app"))) throw new Error("no production build: run `pnpm build` first (or pass --url)");
  const before = buildId(root);
  fs.rmSync(dest, { recursive: true, force: true });
  for (const part of PARTS) if (fs.existsSync(path.join(root, part))) fs.cpSync(path.join(root, part), path.join(dest, part), { recursive: true });
  if (buildId(root) !== before) {
    fs.rmSync(dest, { recursive: true, force: true });
    throw new Error("the build changed while it was being copied: let it finish, then capture again");
  }
  const files = walk(dest);
  return { dir: dest, files: files.length, bytes: files.reduce((sum, f) => sum + fs.statSync(f).size, 0), buildId: before };
}

/** The checkout a capture photographs: { head, dirty } from git, or null outside a git checkout. The shell is injected so a test needs no git. */
export function treeState(root, exec) {
  try {
    const head = String(exec("git", ["rev-parse", "HEAD"], { cwd: root })).trim();
    const dirty = String(exec("git", ["status", "--porcelain"], { cwd: root })).trim().length > 0;
    return /^[0-9a-f]{40}$/.test(head) ? { head, dirty } : null;
  } catch { return null; }
}
