#!/usr/bin/env node
// The kit's command line: one command per script under scripts/, run against
// the site in the current directory — its src/kit.ts for the registry and the
// config, its content/, public/, .next and .parity. A site's package.json
// names them: "content:lint": "agentic-cms lint", and so on.
//
//   agentic-cms lint [--root <dir>] [--strict] [--report]   the content rules (scripts/content-lint.mjs)
//   agentic-cms check [--root <dir>]                        the schemas alone (scripts/content-check.mjs)
//   agentic-cms status [--since 30.days]                    what is live, in draft and planned (scripts/content-status.mjs)
//   agentic-cms docs [--check]                              the field tables into content/README.md (scripts/content-docs.mjs)
//   agentic-cms seo [--strict] [--report]                   the audit of every prerendered page (scripts/check-seo.mjs)
//   agentic-cms placeholder <out> <width> <height>          a wireframe placeholder image (scripts/placeholder.mjs)
//   agentic-cms optimize-webp <files-or-dirs>               (scripts/optimize-webp.mjs)
//   agentic-cms optimize-svg-rasters [files]                (scripts/optimize-svg-rasters.mjs)
//   agentic-cms parity <label>                              the prerendered markup stored for a diff (scripts/parity.mjs)
//   agentic-cms visual-parity capture|compare …             the screenshot harness (scripts/visual-parity.mjs)
const COMMANDS = {
  lint: "content-lint",
  check: "content-check",
  status: "content-status",
  docs: "content-docs",
  seo: "check-seo",
  placeholder: "placeholder",
  "optimize-webp": "optimize-webp",
  "optimize-svg-rasters": "optimize-svg-rasters",
  parity: "parity",
  "visual-parity": "visual-parity",
};

const command = process.argv[2];
if (!COMMANDS[command]) {
  console.error(`usage: agentic-cms <${Object.keys(COMMANDS).join(" | ")}> [options]`);
  process.exit(2);
}
// The scripts read their own arguments from process.argv.slice(2).
process.argv.splice(2, 1);
await import(`../scripts/${COMMANDS[command]}.mjs`);
