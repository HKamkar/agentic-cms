#!/usr/bin/env node
// The design canvas for the site's own graphics, opened when a drawing is
// needed and removed when its files are rendered: `new` writes a scene to
// start from under .parity/lab, `serve` shows every scene on the site's
// tokens (light and dark, inline and as an <img>, at its sizes and enlarged,
// with a scrubber, a replay and its still) to the owner's browser and phone, `render` writes the file a page ships, `clean`
// removes the lab. Nothing of it lives under src/ or in package.json;
// docs/lab.md has the recipe and the design-graphics skill the procedure.
// The scene functions are the package's (TypeScript in this checkout), so
// the loader hook comes first and the lab's modules after it.
import "./lib/load-ts.mjs";
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { relative } from "./lib/page-command.mjs";
import { SPECS } from "./lib/specs.mjs";

const { LAB_DIR, ROUTE_DIR, ROUTE_FILE, isSceneName, parseSizes, removeStaleTypes, routeTemplate, sceneTemplate } = await import("./lib/lab.mjs");
const { startLabServer } = await import("./lib/lab-server.mjs");

const { subcommand, positionals, flags } = parseOrExit(SPECS.lab, process.argv.slice(2));
const root = process.cwd();
const fail = (message, code = 2) => { console.error(`lab ${subcommand}: ${message}`); process.exit(code); };

if (subcommand === "new") {
  const [name] = positionals;
  if (!isSceneName(name)) fail(`${name}: a scene name is lowercase letters, digits and hyphens`);
  const file = path.join(root, LAB_DIR, `${name}.svg`);
  if (fs.existsSync(file)) fail(`${relative(root, file)} exists; pick another name, or edit it`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, sceneTemplate(flags.kind, name));
  const summary = { scene: name, file: relative(root, file), kind: flags.kind };
  if (flags.json) console.log(JSON.stringify(summary, null, 1));
  else console.log(`${summary.file}  ${flags.kind}; pnpm kit lab serve to look at it, pnpm kit lab render ${name} --out <file> to ship it`);
} else if (subcommand === "serve") {
  let sizes;
  try { sizes = flags.sizes === undefined ? null : parseSizes(flags.sizes); } catch (error) { fail(`--sizes: ${error.message}`); }
  let server;
  try { server = await startLabServer({ root, extra: flags.scenes, host: flags.host, port: flags.port, watch: true, sizes }); } catch (error) { fail(error.message); }
  console.log(`lab: ${server.urls.join("  ")}\n     scenes under ${LAB_DIR}/${flags.scenes.length ? ` and ${flags.scenes.join(", ")}` : ""}; a saved file reloads the page; Ctrl-C stops`);
  const stop = () => { server.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} else if (subcommand === "route") {
  const file = path.join(root, ROUTE_FILE);
  if (fs.existsSync(file) && !flags.force) fail(`${ROUTE_FILE} exists; edit it, or pass --force to write the template over it`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, routeTemplate());
  if (flags.json) console.log(JSON.stringify({ file: ROUTE_FILE, path: "/lab-demo" }, null, 1));
  else console.log(`${ROUTE_FILE} written: pnpm dev and open /lab-demo; add the site's surfaces to GROUNDS; pnpm kit lab clean removes it (it never merges: the SEO audit fails it)`);
} else if (subcommand === "render") {
  if (!flags.out) fail("--out names the file to write; its extension picks the format");
  const { renderScene } = await import("./lib/lab-render.mjs");
  let report;
  try { report = await renderScene(root, positionals[0], flags); } catch (error) { fail(error.message); }
  const line = `${report.file}  ${report.width}x${report.height}  ${report.frames} frame${report.frames === 1 ? "" : "s"}${report.fps ? ` at ${report.fps} fps` : ""}  ${(report.bytes / 1024).toFixed(1)}KB${report.still ? `; still ${report.still}` : ""}${report.source ? `; source ${report.source}` : ""}`;
  if (flags.json) { console.error(line); console.log(JSON.stringify(report, null, 1)); } else console.log(line);
  if (report.note) console.error(`note: ${report.note}`);
  for (const entry of report.console) console.error(`${entry.type}: ${entry.text}`);
} else if (subcommand === "clean") {
  const removed = [], kept = [];
  const lab = path.join(root, LAB_DIR);
  if (fs.existsSync(lab)) { fs.rmSync(lab, { recursive: true, force: true }); removed.push(LAB_DIR); }
  const route = path.join(root, ROUTE_FILE);
  // Only the kit's route goes: a site's own page at that path is left and named.
  if (fs.existsSync(route)) {
    if (/from "agentic-cms\/lab"/.test(fs.readFileSync(route, "utf8"))) { fs.rmSync(path.join(root, ROUTE_DIR), { recursive: true, force: true }); removed.push(ROUTE_DIR); }
    else kept.push(ROUTE_FILE);
  }
  // next dev's generated route types keep naming a removed route, and the
  // production build's type check reads them; the stale file goes (demo.mjs).
  const stale = fs.existsSync(route) ? null : removeStaleTypes(root, ROUTE_DIR);
  if (stale) removed.push(stale);
  if (flags.json) console.log(JSON.stringify({ removed, kept }, null, 1));
  else console.log(`${removed.length ? `${removed.join(" and ")} removed` : "nothing to remove"}${kept.length ? `; ${kept.join(", ")} kept (not the kit's route: it does not import agentic-cms/lab)` : ""}`);
}
