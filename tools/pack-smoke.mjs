#!/usr/bin/env node
// Proves the package as a site sees it, which the checkout never does (the
// example resolves the package's name to the source): packs the package,
// installs the tarball in a scratch directory as a site's one engine
// dependency, lays the site out with `agentic-cms init` from that install,
// installs its dependencies and runs its build — the content lint, the
// field-table check, next build and the SEO audit — through the installed
// command line; then checks the agent files are as shipped and the tarball's
// size. Exit 1 on the first failure.
//
//   pnpm test:pack           (a few minutes: two installs and a build)
//   pnpm test:pack --keep    leaves the scratch site behind and prints where
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const keep = process.argv.includes("--keep");
const MAX_TARBALL = 1024 * 1024;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-smoke-"));
const site = path.join(scratch, "site");
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, CI: "1" } });
  if (result.status !== 0) {
    console.error(`pack-smoke: ${command} ${args.join(" ")} failed in ${cwd}`);
    process.exit(1);
  }
};

// 1. The tarball: what a consumer installs, dist/ included (prepare runs first).
const packed = execFileSync("pnpm", ["pack", "--pack-destination", scratch, "--json"], { cwd: ROOT, encoding: "utf8" });
const tarball = path.join(scratch, path.basename(JSON.parse(packed.slice(packed.indexOf("{"))).filename));
const size = fs.statSync(tarball).size;
if (size > MAX_TARBALL) { console.error(`pack-smoke: the tarball is ${(size / 1024).toFixed(0)} KB, over the ${MAX_TARBALL / 1024} KB the files list is meant to stay under`); process.exit(1); }

// 2. A scratch site with the tarball as its engine, laid out by the installed init.
fs.mkdirSync(site, { recursive: true });
fs.writeFileSync(path.join(site, "package.json"), JSON.stringify({ name: "agentic-cms-smoke", private: true, type: "module", dependencies: { "agentic-cms": `file:${tarball}` } }, null, 2));
fs.writeFileSync(path.join(site, "pnpm-workspace.yaml"), "allowBuilds:\n  sharp: true\n  unrs-resolver: true\n");
run("pnpm", ["install", "--prefer-offline"], site);
for (const shipped of ["templates/site/AGENTS.md", ".claude/skills/design/SKILL.md", ".agents/skills/design/SKILL.md", "content/pages/home.yaml", "docs/commands.md"]) {
  if (!fs.existsSync(path.join(site, "node_modules/agentic-cms", shipped))) { console.error(`pack-smoke: the tarball lacks ${shipped} (package.json files)`); process.exit(1); }
}
run("pnpm", ["exec", "agentic-cms", "init", "."], site);
// init pins the dependency to the kit's tag; the smoke keeps the tarball
const pkg = JSON.parse(fs.readFileSync(path.join(site, "package.json"), "utf8"));
pkg.dependencies["agentic-cms"] = `file:${tarball}`;
fs.writeFileSync(path.join(site, "package.json"), JSON.stringify(pkg, null, 2));

// 3. Install the site's dependencies (the lockfile moves: init added them) and build through the installed command line.
run("pnpm", ["install", "--prefer-offline", "--no-frozen-lockfile"], site);
run("pnpm", ["build"], site);
run("pnpm", ["exec", "agentic-cms", "init", ".", "--agent-files", "--check"], site);
// The standalone packaging step ships and dispatches: the example is not standalone, so it says how to make one (exit 2).
const assemble = spawnSync("pnpm", ["exec", "agentic-cms", "assemble"], { cwd: site, encoding: "utf8" });
if (assemble.status !== 2 || !/output: "standalone"/.test(assemble.stderr)) { console.error(`pack-smoke: agentic-cms assemble answered ${assemble.status}: ${assemble.stderr.trim()}`); process.exit(1); }
// The inline-loop pieces ship: readInlineSvg runs from the installed agentic-cms/content, InlineAnimation is compiled into the ix entry.
fs.writeFileSync(path.join(site, "public/smoke-loop.svg"), '<svg xmlns="http://www.w3.org/2000/svg" data-rest="1"><circle id="c" r="1"/><use href="#c"/></svg>');
const inline = spawnSync(process.execPath, ["--input-type=module", "-e", 'const { readInlineSvg } = await import("agentic-cms/content"); console.log(readInlineSvg("public/smoke-loop.svg", { prefix: "smoke" }));'], { cwd: site, encoding: "utf8" });
if (inline.status !== 0 || !/id="smoke-c"[\s\S]*href="#smoke-c"/.test(inline.stdout)) { console.error(`pack-smoke: readInlineSvg from the tarball answered ${inline.status}: ${(inline.stderr || inline.stdout).trim()}`); process.exit(1); }
const ix = path.join(site, "node_modules/agentic-cms/dist/ix");
if (!fs.existsSync(path.join(ix, "InlineAnimation.js")) || !/InlineAnimation/.test(fs.readFileSync(path.join(ix, "index.js"), "utf8")) || !/InlineAnimation/.test(fs.readFileSync(path.join(ix, "index.d.ts"), "utf8"))) { console.error("pack-smoke: the tarball's agentic-cms/ix lacks InlineAnimation"); process.exit(1); }
console.log(`pack-smoke: the package builds a site from the tarball (${path.basename(tarball)}, ${(size / 1024).toFixed(0)} KB)`);
if (keep) console.log(`pack-smoke: scratch site kept at ${site}`);
else fs.rmSync(scratch, { recursive: true, force: true });
