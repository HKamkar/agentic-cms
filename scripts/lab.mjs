#!/usr/bin/env node
// The design canvas for the site's own graphics, opened when a drawing is
// needed and removed when its files are rendered: `new` writes a scene to
// start from under .parity/lab, `serve` shows every scene on the site's
// tokens (light and dark, inline and as an <img>, with a scrubber) to the
// owner's browser and phone, `render` writes the file a page ships, `clean`
// removes the lab. Nothing of it lives under src/ or in package.json;
// docs/lab.md has the recipe and the design-graphics skill the procedure.
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { KINDS, LAB_DIR, isSceneName, parseSizes, sceneTemplate } from "./lib/lab.mjs";
import { startLabServer } from "./lib/lab-server.mjs";
import { relative } from "./lib/page-command.mjs";
import { SPECS } from "./lib/specs.mjs";

const { subcommand, positionals, flags } = parseOrExit(SPECS.lab, process.argv.slice(2));
const root = process.cwd();
const fail = (message, code = 2) => { console.error(`lab ${subcommand}: ${message}`); process.exit(code); };

if (subcommand === "new") {
  const [name] = positionals;
  if (!isSceneName(name)) fail(`${name}: a scene name is lowercase letters, digits and hyphens`);
  if (!KINDS.includes(flags.kind)) fail(`--kind must be one of ${KINDS.join(", ")}, not ${flags.kind}`);
  const file = path.join(root, LAB_DIR, `${name}.svg`);
  if (fs.existsSync(file)) fail(`${relative(root, file)} exists; pick another name, or edit it`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, sceneTemplate(flags.kind, name));
  const summary = { scene: name, file: relative(root, file), kind: flags.kind };
  if (flags.json) console.log(JSON.stringify(summary, null, 1));
  else console.log(`${summary.file}  ${flags.kind}; pnpm kit lab serve to look at it, pnpm kit lab render ${name} --out <file> to ship it`);
} else if (subcommand === "serve") {
  let sizes;
  try { sizes = parseSizes(flags.sizes); } catch (error) { fail(`--sizes: ${error.message}`); }
  let server;
  try { server = await startLabServer({ root, extra: flags.scenes, host: flags.host, port: flags.port, watch: true, sizes }); } catch (error) { fail(error.message); }
  console.log(`lab: ${server.urls.join("  ")}\n     scenes under ${LAB_DIR}/${flags.scenes.length ? ` and ${flags.scenes.join(", ")}` : ""}; a saved file reloads the page; Ctrl-C stops`);
  const stop = () => { server.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} else if (subcommand === "clean") {
  const dir = path.join(root, LAB_DIR);
  const removed = fs.existsSync(dir);
  if (removed) fs.rmSync(dir, { recursive: true, force: true });
  if (flags.json) console.log(JSON.stringify({ removed: removed ? LAB_DIR : null }, null, 1));
  else console.log(removed ? `${LAB_DIR} removed` : `nothing to remove: no ${LAB_DIR}`);
}
