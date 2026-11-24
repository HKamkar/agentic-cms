#!/usr/bin/env node
// The package as npm will hold it, checked on the tarball itself (CI's test
// job runs it; the release's check job runs it on the tarball it publishes):
// its files are tools/pack-files.txt's (tools/pack-files.mjs), none of them
// a path hygiene or a package refuses, none naming a site, a machine path or
// an address (tools/hygiene.mjs's text rules, over the tarball's files as
// they are over the tracked ones); its packed manifest runs nothing on
// install; every bare import of a file that runs from it is declared; the
// hand-written declarations of ./loader and ./eslint compile
// (tsconfig.declarations.json); then publint --strict and Are the Types
// Wrong (attw, the esm-only profile: the package is ESM alone) on the
// tarball. Exit 1 with one line per finding, 2 when it cannot pack or read
// the tarball.
//
//   node tools/lint-pkg.mjs [--tarball <file>] [--brand <name>]…    (pnpm lint:pkg; packs into a temp folder unless --tarball names one)
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findings, showcasedBrands } from "./hygiene.mjs";
import { LIST, pack, refusedPaths, tarballFiles, undeclaredImports } from "./pack-files.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
/** The scripts a registry install would run from the packed manifest. */
export const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"];

/** What differs between the tarball's files and the committed list: "+ path" for a file the list lacks, "- path" for one the tarball lacks. */
export function listDrift(files, listed) {
  const have = new Set(files), want = new Set(listed);
  return [...files.filter((file) => !want.has(file)).map((file) => `+ ${file}`), ...listed.filter((file) => !have.has(file)).map((file) => `- ${file}`)];
}

/** Every finding the tarball's files and manifest give, before the tools run; [] when clean. */
export function tarballFindings({ files, listed, root, manifest, brands }) {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const drift = listDrift(files, listed);
  const out = drift.length ? [`${LIST} is stale (${drift.join(", ")}): check each file belongs in the package, then pnpm docs:pack and commit the list`] : [];
  out.push(...new Set([...refusedPaths(files), ...findings(root, files, { brands })]));
  const onInstall = INSTALL_SCRIPTS.filter((script) => manifest.scripts?.[script]);
  if (onInstall.length) out.push(`package.json: the packed manifest keeps ${onInstall.join(", ")}, which a registry install would run`);
  out.push(...undeclaredImports(files, read, manifest).map(({ file, specifier }) => `${file}: imports ${specifier}, which is no Node builtin and no dependency or peer of package.json`));
  return out;
}

/** The tools, each run on the tarball (or, for tsc, the declarations it ships); the label of each that failed. */
function toolFailures(tarball) {
  const bin = (name) => path.join(ROOT, "node_modules/.bin", name);
  const tools = [
    ["tsc -p tsconfig.declarations.json", bin("tsc"), ["-p", "tsconfig.declarations.json"]],
    ["publint --strict", bin("publint"), ["run", tarball, "--strict"]],
    ["attw --profile esm-only", bin("attw"), [tarball, "--profile", "esm-only"]],
  ];
  return tools.filter(([label, command, args]) => {
    console.log(`lint:pkg: ${label}`);
    return spawnSync(command, args, { cwd: ROOT, stdio: "inherit" }).status !== 0;
  }).map(([label]) => `${label} failed (its output is above)`);
}

/** Packs (unless `--tarball` names one), unpacks and lints; the exit code. */
function main(args) {
  const value = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-lint-pkg-"));
  try {
    const given = value("--tarball")[0];
    let tarball, root;
    try {
      tarball = given ? path.resolve(given) : pack(ROOT, scratch);
      execFileSync("tar", ["-xzf", tarball, "-C", scratch]);
      root = path.join(scratch, "package");
    } catch (error) {
      console.error(`lint:pkg: ${given ? `cannot read the tarball ${given}` : "pnpm pack failed"}: ${error.message.split("\n")[0]}`);
      return 2;
    }
    const files = tarballFiles(tarball);
    const found = tarballFindings({
      files,
      listed: fs.readFileSync(path.join(ROOT, LIST), "utf8").split("\n").filter(Boolean),
      root,
      manifest: JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")),
      brands: [...showcasedBrands(fs.readFileSync(path.join(ROOT, "README.md"), "utf8")), ...value("--brand")],
    });
    found.push(...toolFailures(tarball));
    for (const line of found) console.error(`lint:pkg: ${line}`);
    console.log(found.length ? `lint:pkg: ${found.length} finding(s) in ${path.basename(tarball)}` : `lint:pkg: ${path.basename(tarball)} is clean — ${files.length} files, as ${LIST} lists them`);
    return found.length ? 1 : 0;
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) process.exitCode = main(process.argv.slice(2));
