#!/usr/bin/env node
// The icon commands: `add` and `remove` keep the site's icon map
// (src/config/icons.json, the ids; src/config/icons.ts, generated from the
// sets the site installs — Lucide for line icons, Simple Icons for other
// companies' marks — with each set's licence in the header), `family`
// renders a family of marks from primitives in a spec, `audit` lists
// every icon on the built pages beside the copy it sits with, as JSON and
// as a sheet, and `round` runs a design round for a set of the site's own
// icons in the lab (lib/icons-round.mjs). docs/icons.md is the guide.
import "./lib/load-ts.mjs";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { parseOrExit } from "./lib/args.mjs";
import { FREEZE_CSS, HOLD_SMIL, NO_ANCHORING_CSS, fontsReady, launch, listPages, revealed, serveStatic, settle, withPage } from "./lib/browser.mjs";
import { AUDIT_PAGE, auditToSheet, byFile } from "./lib/icons-audit.mjs";
import { renderFamily } from "./lib/icons-family.mjs";
import { updateIcons } from "./lib/icons-source.mjs";
import { relative } from "./lib/page-command.mjs";
import { SPECS } from "./lib/specs.mjs";

// lib/sheet.mjs reads agentic-cms/lab: imported once the loader is in place, so a checkout of the kit reads its source.
const { renderSheet } = await import("./lib/sheet.mjs");

const { subcommand, positionals, flags } = parseOrExit(SPECS.icons, process.argv.slice(2));
const root = process.cwd();
const fail = (message, code = 2) => { console.error(`icons ${subcommand}: ${message}`); process.exit(code); };

if (subcommand === "add" || subcommand === "remove") {
  let result;
  try { result = updateIcons(root, positionals, { manifest: flags.manifest, remove: subcommand === "remove" }); } catch (error) { fail(error.message); }
  const { changed, ...rest } = result;
  const summary = { ...rest, [subcommand === "add" ? "added" : "removed"]: changed };
  if (flags.json) console.log(JSON.stringify(summary, null, 1));
  else console.log(`icons ${subcommand}: ${changed.length ? changed.join(", ") : "nothing to change"}; ${summary.ids.length} icon(s) in ${summary.manifest}, ${summary.map} regenerated`);
} else if (subcommand === "family") {
  const specFile = path.resolve(root, positionals[0]);
  if (!fs.existsSync(specFile)) fail(`${positionals[0]}: no such file`);
  const text = fs.readFileSync(specFile, "utf8");
  let files;
  try { files = renderFamily(specFile.endsWith(".json") ? JSON.parse(text) : parseYaml(text), { from: relative(root, specFile) }); } catch (error) { fail(error.message); }
  const drift = [];
  for (const [file, svg] of files) {
    const full = path.resolve(root, file);
    const same = fs.existsSync(full) && fs.readFileSync(full, "utf8") === svg;
    if (flags.check) { if (!same) drift.push(file); continue; }
    if (same) continue;
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, svg);
    drift.push(file);
  }
  if (flags.check) {
    if (flags.json) console.log(JSON.stringify({ marks: files.size, drift }, null, 1));
    else console.log(drift.length ? `icons family: ${drift.length} of ${files.size} files differ from the spec — run agentic-cms icons family ${positionals[0]}:\n${drift.map((f) => `  ${f}`).join("\n")}` : `icons family: ${files.size} files as the spec renders them`);
    process.exit(drift.length ? 1 : 0);
  }
  if (flags.json) console.log(JSON.stringify({ marks: files.size, written: drift }, null, 1));
  else console.log(`icons family: ${files.size} marks, ${drift.length} written`);
} else if (subcommand.startsWith("round ")) {
  // lib/icons-round.mjs reads agentic-cms/lab: imported here, after the loader
  const { newRound, publishRound, retireRound } = await import("./lib/icons-round.mjs");
  const action = subcommand.slice("round ".length);
  const round = positionals[0];
  let report;
  try {
    if (action === "new") report = newRound(root, { round, roles: (flags.roles ?? "").split(",").map((r) => r.trim()).filter(Boolean), candidates: flags.candidates, kind: flags.kind, sizes: flags.sizes.split(",").map(Number) });
    else if (action === "publish") report = await publishRound(root, round, flags.pick, { to: flags.to, scheme: flags.scheme });
    else report = retireRound(root, round, { dryRun: flags["dry-run"], force: flags.force });
  } catch (error) { fail(error.message); }
  if (flags.json) console.log(JSON.stringify(report, null, 1));
  else if (action === "new") console.log(`icons round new: ${report.scenes.length} scenes in ${report.dir} — draw each into a candidate; the owner looks with pnpm kit lab serve --sizes ${flags.sizes} or pnpm kit sheet ${report.sheet} and picks a letter per role; then icons round publish ${round} --pick role=letter,…`);
  else if (action === "publish") console.log(report.published.map((p) => `icons round publish: ${p.role}=${p.letter} → ${p.files.join(", ")}`).join("\n"));
  else console.log(`${report.dryRun ? "would remove" : "removed"}: ${report.removed.join(", ")}${report.kept.length ? `; kept: ${report.kept.join(", ")}` : ""}`);
} else {
  // audit
  const server = flags.url ? null : await serveStatic({ root });
  const base = (flags.url ?? server.url).replace(/\/$/, "");
  const pages = flags.pages ? flags.pages.split(",").filter(Boolean) : listPages(root).filter((r) => r !== "/_not-found");
  const { context, close } = await launch({ scheme: flags.scheme, width: flags.width });
  const icons = [];
  try {
    for (const route of pages) {
      const found = await withPage(context, flags.width, base + route, async (page) => {
        await fontsReady(page);
        await page.addStyleTag({ content: NO_ANCHORING_CSS });
        await page.addStyleTag({ content: FREEZE_CSS });
        await revealed(page);
        await settle(page);
        await page.evaluate(HOLD_SMIL, { rest: true });
        return page.evaluate(AUDIT_PAGE, flags.max);
      });
      icons.push(...found.map((i) => ({ page: route, ...i })));
      if (!flags.json) process.stdout.write(`${route} `);
    }
  } finally { await close(); }
  const report = { pages, count: icons.length, icons, files: byFile(icons) };
  const outFile = path.resolve(root, flags.out ?? ".parity/icons/audit.png");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  if (icons.length) {
    const server2 = flags.url ? null : await serveStatic({ root, requireBuild: false });
    try { await renderSheet(auditToSheet(report, { background: flags.background, color: flags.color }), { root, base: (flags.url ?? server2.url).replace(/\/$/, ""), out: outFile, scale: 2, scheme: flags.scheme }); } finally { server2?.close(); }
    report.sheet = relative(root, outFile);
  }
  server?.close();
  fs.writeFileSync(outFile.replace(/\.png$/, ".json"), JSON.stringify(report, null, 1));
  if (flags.json) console.log(JSON.stringify(report, null, 1));
  else console.log(`\nicons audit: ${icons.length} icons on ${pages.length} pages, ${Object.keys(report.files).length} files${report.sheet ? `; sheet ${report.sheet}` : ""}; ${relative(root, outFile.replace(/\.png$/, ".json"))}`);
}
