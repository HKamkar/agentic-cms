// What the kit copied into a site up to 0.8 — its rules whole and its skills in
// both trees — and the record of every release's text of each
// (agent-file-releases.json, written from the tags by
// tools/agent-file-releases.mjs). Since 0.9.0 a site gets thin rules, stubs
// and the kit's plugins instead (lib/agent-files.mjs); the record is how
// lib/agent-files-move.mjs tells a copy the site never touched from one it
// edited, and keeps the site's own lines of an edited rule.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** The trees the kit copied, each with where it landed in a site: the site's rules and the two skills trees. */
export const AGENT_DIRS = { "templates/site/rules": ".claude/rules", ".claude/skills": ".claude/skills", ".agents/skills": ".agents/skills" };
/** The kit's agent files at every release: { versions: { <version>: { <file>: <hash> } }, texts: { <hash>: <text> } }, the versions oldest first. */
export const RELEASES = "scripts/lib/agent-file-releases.json";
/** A text as the manifest and the record hash it. */
export const sha = (text) => `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
/** Every file under a folder, as a path from it with forward slashes; none when it is not there. */
export const walk = (dir, base = dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")])) : []);

/** Every file of the trees as the kit holds them now, by the path it had in a site: { file, text }. */
export function renderAgentFiles(kitRoot) {
  const out = [];
  for (const [from, to] of Object.entries(AGENT_DIRS)) {
    for (const rel of walk(path.join(kitRoot, from))) out.push({ file: `${to}/${rel}`, text: fs.readFileSync(path.join(kitRoot, from, rel), "utf8") });
  }
  return out;
}

/** The kit's record (RELEASES); an empty one for a kit without it. */
export const readReleases = (kitRoot) => { try { return JSON.parse(fs.readFileSync(path.join(kitRoot, RELEASES), "utf8")); } catch { return { versions: {}, texts: {} }; } };
