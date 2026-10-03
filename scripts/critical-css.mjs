#!/usr/bin/env node
// Critical CSS for a prerendered Next build: each page's own rules inlined,
// its stylesheets loaded without blocking the first paint
// (scripts/lib/critical-css.mjs says how and why). The documented place is
// right after next build in a site's `pnpm build`, before the SEO audit and
// assemble (docs/deploy.md); a page done once is left alone, and --check
// only checks. Pages regenerated at request time are not covered.
import fs from "node:fs";
import path from "node:path";
import { parseOrExit } from "./lib/args.mjs";
import { blocking, inlineCritical, pageDirs, pagesIn } from "./lib/critical-css.mjs";
import { SPECS } from "./lib/specs.mjs";

const { flags } = parseOrExit(SPECS["critical-css"], process.argv.slice(2));
const root = process.cwd();
const dirs = pageDirs(root);
if (!dirs.length) {
  console.error("critical-css: no prerendered pages (no .next/server/app) — run next build first");
  process.exit(2);
}
const report = { dirs: dirs.map((d) => path.relative(root, d)), pages: 0, inlined: 0, skipped: 0, bytes: { inlined: 0, before: 0, after: 0 }, blocking: [] };
for (const dir of dirs) {
  for (const page of pagesIn(dir)) {
    const file = path.join(dir, page), html = fs.readFileSync(file, "utf8");
    report.pages++;
    let result = html;
    if (!flags.check) {
      const done = await inlineCritical(html, root);
      if (done.skipped) report.skipped++;
      else { report.inlined++; report.bytes.inlined += done.inlined; fs.writeFileSync(file, done.html); }
      result = done.html;
    }
    report.bytes.before += Buffer.byteLength(html); report.bytes.after += Buffer.byteLength(result);
    const sheets = blocking(result);
    if (sheets.length) report.blocking.push({ page: path.relative(root, file), sheets });
  }
}
if (flags.json) console.log(JSON.stringify(report, null, 1));
if (report.blocking.length) {
  console.error(`critical-css: ${report.blocking.length} page(s) wait for a stylesheet before they paint${flags.check ? " — run agentic-cms critical-css" : ""}:\n${report.blocking.map((b) => `  ${b.page}: ${b.sheets.join(", ")}`).join("\n")}`);
  process.exit(1);
}
if (!flags.json) {
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const per = report.inlined ? `, ${kb(report.bytes.inlined / report.inlined)} inlined a page on average` : "";
  console.log(`critical-css: ${report.pages} pages in ${report.dirs.join(" and ")} — ${flags.check ? "checked" : `${report.inlined} inlined, ${report.skipped} already done or without a stylesheet${per}`}; none waits for a stylesheet to paint`);
}
