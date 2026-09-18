#!/usr/bin/env node
// Proves the package as a site sees it, which the checkout never does (the
// example resolves the package's name to the source): packs the package, builds
// a scratch site out of the example's own files with the tarball as its one
// engine dependency and no path alias, installs it, and runs its build —
// the content lint, the field-table check, next build and the SEO audit —
// through the installed command line. Exit 1 on the first failure.
//
//   pnpm test:pack           (a few minutes: an install and a build)
//   pnpm test:pack --keep    leaves the scratch site behind and prints where
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const keep = process.argv.includes("--keep");
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

// 2. The scratch site: the example's files, none of the package's source.
fs.mkdirSync(site, { recursive: true });
for (const entry of ["content", "public", "src/app", "src/components", "src/config", "src/styles", "src/kit.ts", "next.config.ts", "postcss.config.mjs", ".env.example"]) {
  fs.cpSync(path.join(ROOT, entry), path.join(site, entry), { recursive: true });
}
const kit = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const dev = kit.devDependencies;
const consumer = {
  name: "agentic-cms-smoke",
  private: true,
  type: "module",
  scripts: { build: "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo" },
  dependencies: { "agentic-cms": `file:${tarball}`, motion: dev.motion, next: dev.next, react: dev.react, "react-dom": dev["react-dom"], zod: dev.zod },
  devDependencies: { "@opennextjs/cloudflare": dev["@opennextjs/cloudflare"], "@tailwindcss/postcss": dev["@tailwindcss/postcss"], "@types/node": dev["@types/node"], "@types/react": dev["@types/react"], "@types/react-dom": dev["@types/react-dom"], postcss: dev.postcss, tailwindcss: dev.tailwindcss, typescript: dev.typescript },
  pnpm: { onlyBuiltDependencies: ["sharp"] },
};
fs.writeFileSync(path.join(site, "package.json"), JSON.stringify(consumer, null, 2));
// The example's tsconfig minus the alias that points the package's name at the source.
const tsconfig = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.json"), "utf8"));
tsconfig.compilerOptions.paths = { "@/*": ["./src/*"] };
fs.writeFileSync(path.join(site, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
fs.writeFileSync(path.join(site, "pnpm-workspace.yaml"), "allowBuilds:\n  sharp: true\n  esbuild: true\n  unrs-resolver: true\n  workerd: true\n");

// 3. Install and build through the installed command line.
run("pnpm", ["install", "--prefer-offline"], site);
run("pnpm", ["build"], site);
console.log(`pack-smoke: the package builds a site from the tarball (${path.basename(tarball)})`);
if (keep) console.log(`pack-smoke: scratch site kept at ${site}`);
else fs.rmSync(scratch, { recursive: true, force: true });
