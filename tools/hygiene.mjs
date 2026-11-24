#!/usr/bin/env node
// The public repo's hygiene, checked over the tracked files before a pull
// request (CI runs it too): nothing of any one site in the kit — the sites
// the README's "Built on agentic-cms" section shows are the names that may
// appear nowhere else — no machine paths or addresses, no scratch files,
// captures or screenshots committed, the two skills trees in step, the
// CHANGELOG carrying an entry, docs/commands.md current, docs/parts.md naming
// every export, command and rule (tools/parts-doc.mjs), the scoped-rules
// tables of AGENTS.md and the site template current and both files within
// what Codex reads (tools/rules-table.mjs), the record of the agent files at
// every release current (tools/agent-file-releases.mjs, which needs the
// tags). Exit 1 with one line per finding.
//
//   node tools/hygiene.mjs [--brand <name>]…     (pnpm hygiene; --brand adds a name to guard)
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TEXT = /\.(mjs|mts|js|ts|tsx|css|md|json|yaml|yml|txt|html|svg|sh|py)$/;
const SHOWCASE_FILES = ["README.md"];

/** The sites the README shows: the hosts linked in its "Built on" section, as the names to guard (nimbus.example → nimbus). */
export function showcasedBrands(readme) {
  const section = readme.split(/^## /m).find((part) => part.startsWith("Built on")) ?? "";
  return [...new Set([...section.matchAll(/https?:\/\/(?:www\.)?([a-z0-9-]+)\.[a-z.]+/gi)].map((m) => m[1].toLowerCase()))];
}
const SCRATCH = /(^|\/)(notes?|scratch|tmp|todo)\.[a-z]+$|\.(tmp|bak|orig|rej|log)$/i;

/** What a path alone makes a finding of: a capture, a scratch file, a picture outside the places pictures live; [] when none. */
export function pathFindings(file) {
  const out = [];
  if (file.startsWith(".parity/")) out.push(`${file}: a capture; .parity/ stays out of git and the package`);
  if (SCRATCH.test(file)) out.push(`${file}: a scratch file`);
  if (/\.(png|jpe?g|webp)$/.test(file) && !/^(docs|public|templates\/starter\/public)\/|^src\/app\/(apple-)?icon\.png$/.test(file)) out.push(`${file}: a picture outside docs/, public/ (the example's, the starter's) and the app icons`);
  return out;
}

/** Every finding over the given tracked files under root (or the files of a tarball, unpacked there); [] when clean. */
export function findings(root, files, { brands }) {
  const out = [];
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const brandRe = brands.length ? new RegExp(brands.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i") : /$^/;
  for (const file of files) {
    out.push(...pathFindings(file));
    // a test needs counterexamples, so the line rules skip test files
    if (!TEXT.test(file) || /\.test\.(mjs|ts)$/.test(file) || !fs.existsSync(path.join(root, file))) continue;
    const text = read(file);
    text.split("\n").forEach((line, i) => {
      const at = `${file}:${i + 1}`;
      const named = line.match(brandRe);
      if (named && !SHOWCASE_FILES.includes(file)) out.push(`${at}: names ${named[0]}, which belongs to one site, not the kit`);
      const machinePath = line.match(/\/home\/[a-z][\w.-]*\/|\/Users\/[A-Za-z][\w.-]*\/|[A-Z]:\\Users\\/);
      if (machinePath) out.push(`${at}: a machine path (${machinePath[0]})`);
      const address = line.match(/\b(?!0\.0\.0\.0|127\.0\.0\.1)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}\b|\b20\.56\.\d+\.\d+/);
      if (address) out.push(`${at}: a machine's address (${address[0]})`);
    });
  }
  const claude = files.filter((f) => f.startsWith(".claude/skills/"));
  const agents = new Set(files.filter((f) => f.startsWith(".agents/skills/")));
  for (const file of claude) {
    const twin = file.replace(/^\.claude\//, ".agents/");
    if (!agents.has(twin)) out.push(`${twin}: missing; the skills are committed twice (pnpm skills:sync)`);
    else if (read(file) !== read(twin)) out.push(`${twin}: differs from ${file}; the skills are committed twice (pnpm skills:sync)`);
    agents.delete(twin);
  }
  for (const orphan of agents) out.push(`${orphan}: has no twin under .claude/skills/`);
  if (files.includes("CHANGELOG.md") && !/^## \[(Unreleased|\d+\.\d+\.\d+)\]/m.test(read("CHANGELOG.md"))) out.push("CHANGELOG.md: no ## [Unreleased] or ## [x.y.z] entry");
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const root = process.cwd();
  const extra = process.argv.flatMap((a, i, all) => (a === "--brand" && all[i + 1] ? [all[i + 1]] : []));
  const brands = [...showcasedBrands(fs.readFileSync(path.join(root, "README.md"), "utf8")), ...extra];
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const found = findings(root, files, { brands });
  const docs = spawnSync(process.execPath, [path.join(import.meta.dirname, "commands-doc.mjs"), "--check"], { cwd: root, encoding: "utf8" });
  if (docs.status !== 0) found.push(`docs/commands.md: ${docs.stderr.trim() || "out of date"}`);
  const parts = spawnSync(process.execPath, [path.join(import.meta.dirname, "parts-doc.mjs")], { cwd: root, encoding: "utf8" });
  if (parts.status !== 0) found.push(...(parts.stderr.trim() || "docs/parts.md: incomplete").split("\n").filter(Boolean));
  const rules = spawnSync(process.execPath, [path.join(import.meta.dirname, "rules-table.mjs"), "--check"], { cwd: root, encoding: "utf8" });
  if (rules.status !== 0) found.push(...rules.stderr.trim().split("\n").filter(Boolean));
  const releases = spawnSync(process.execPath, [path.join(import.meta.dirname, "agent-file-releases.mjs"), "--check"], { cwd: root, encoding: "utf8" });
  if (releases.status !== 0) found.push(releases.stderr.trim() || "scripts/lib/agent-file-releases.json: out of date");
  for (const line of found) console.error(`hygiene: ${line}`);
  console.log(found.length ? `hygiene: ${found.length} finding(s)` : `hygiene: ${files.length} tracked files, clean`);
  process.exit(found.length ? 1 : 0);
}
