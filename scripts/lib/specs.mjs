// The command line's contract, one spec per command (scripts/lib/args.mjs
// says the shape). bin/agentic-cms.mjs dispatches and prints `--help` from
// it, every script parses its arguments through it, and
// tools/commands-doc.mjs writes docs/commands.md from it — one source, so the
// parser, the help and the docs cannot disagree. Exit codes: 0 clean, 1
// findings or differences, 2 usage or environment.
const root = { type: "string", value: "<dir>", help: "another site tree (its content/ and public/) instead of the current directory" };
const report = (file) => ({ type: "boolean", help: `also write the findings to ${file}` });
const strict = { type: "boolean", help: "every WARN counts as a FAIL" };
const dryRun = { type: "boolean", help: "print what would change; write nothing" };

export const SPECS = {
  lint: {
    command: "lint", script: "content-lint", summary: "the content rules: every collection read as the build reads it, then the voice, SEO, body, image and date rules",
    usage: "agentic-cms lint [--root <dir>] [--strict] [--report]",
    flags: { root, strict, report: report(".parity/content-lint-report.txt") },
    exit: { 0: "no FAIL", 1: "a FAIL (a WARN is read, not failed, unless --strict)" },
  },
  check: {
    command: "check", script: "content-check", summary: "the schemas alone: every collection read, one row each, in a fraction of a second",
    usage: "agentic-cms check [--root <dir>]",
    flags: { root },
    exit: { 0: "every collection reads", 1: "a ContentError (its lines printed, one per issue)" },
  },
  status: {
    command: "status", script: "content-status", summary: "what is live, in draft and planned, read from the files: posts, pages, FAQ sets, reviews, use cases, the calendar, the backlog, recent changes",
    usage: "agentic-cms status [--since 30.days]",
    flags: { since: { type: "string", default: "30.days", value: "<git window>", help: "how far back the recent-changes list looks" } },
    exit: { 0: "printed" },
  },
  docs: {
    command: "docs", script: "content-docs", summary: "the field tables of every collection, from the schemas, into content/README.md between its markers",
    usage: "agentic-cms docs [--check]",
    flags: { check: { type: "boolean", help: "exit 1 when the tables are out of date instead of writing them (pnpm build runs this)" } },
    exit: { 0: "written, or up to date", 1: "out of date (--check)", 2: "content/README.md has no markers" },
  },
  seo: {
    command: "seo", script: "check-seo", summary: "the audit of every prerendered page after next build: title, description, canonical, Open Graph, headings, images, JSON-LD, robots, sitemap, internal links",
    usage: "agentic-cms seo [--strict] [--report]",
    flags: { strict, report: report(".parity/seo-report.txt") },
    exit: { 0: "no FAIL", 1: "a FAIL", 2: "no build under .next/server/app" },
  },
  placeholder: {
    command: "placeholder", script: "placeholder", summary: "one wireframe placeholder image: a grey field, a hairline border, a corner-to-corner cross; the format follows the extension (.svg, .webp, .jpg, .png)",
    usage: "agentic-cms placeholder <out> <width> <height>",
    positionals: [{ name: "out", required: true, help: "the file to write" }, { name: "width", required: true, help: "pixels" }, { name: "height", required: true, help: "pixels" }],
    exit: { 0: "written", 2: "usage, or an extension that is not .svg/.webp/.jpg/.jpeg/.png" },
  },
  "optimize-webp": {
    command: "optimize-webp", script: "optimize-webp", summary: "re-encodes WebP files as lossy WebP in place when that saves enough (design exports are usually lossless)",
    usage: "agentic-cms optimize-webp [--quality 80] [--max-width <n>] [--min-saving 30] [--dry-run] <files-or-dirs...>",
    positionals: [{ name: "files", required: true, variadic: true, help: "files, or directories walked for .webp" }],
    flags: { quality: { type: "number", default: 80, help: "WebP quality" }, "max-width": { type: "number", default: 0, help: "also downscale pictures wider than this (0: never)" }, "min-saving": { type: "number", default: 30, help: "rewrite only when the saving is at least this percent" }, "dry-run": dryRun },
    exit: { 0: "done (a file that would not save enough is kept and says so)" },
  },
  "optimize-svg-rasters": {
    command: "optimize-svg-rasters", script: "optimize-svg-rasters", summary: "re-encodes the PNGs that design-tool SVG exports embed as base64 into WebP, in place; the drawing is untouched",
    usage: "agentic-cms optimize-svg-rasters [--lossy] [--dry-run] [files...]",
    positionals: [{ name: "files", variadic: true, help: "SVG files; without any, every SVG under public/images" }],
    flags: { lossy: { type: "boolean", help: "allow quality-80 WebP where it is smaller (for bitmaps used as alpha masks only)" }, "dry-run": dryRun },
    exit: { 0: "done" },
  },
  parity: {
    command: "parity", script: "parity", summary: "builds, then stores every prerendered page (scripts and hashed links stripped), its JSON-LD and the non-HTML routes under .parity/<label>/ for a diff -r",
    usage: "agentic-cms parity <label>",
    positionals: [{ name: "label", required: true, help: "the capture's name under .parity/" }],
    exit: { 0: "stored", 1: "the build failed (see .parity/<label>.build.log)" },
  },
  "visual-parity": {
    command: "visual-parity", script: "visual-parity", summary: "the screenshot harness: every page of the build at several widths, frozen or in motion, and a pixel diff of two captures",
    usage: "agentic-cms visual-parity <capture | compare> …",
    subcommands: {
      capture: {
        command: "visual-parity capture", summary: "screenshots of the build (or of a served site) into .parity/visual/<label>/",
        usage: "agentic-cms visual-parity capture <label> [--motion | --states] [--scheme light|dark] [--url <base>] [--widths w,w] [--pages /a,/b]",
        positionals: [{ name: "label", required: true, help: "the capture's name under .parity/visual/" }],
        flags: {
          motion: { type: "boolean", help: "play the animations: viewport frames 150, 500 and 2000 ms after each scroll step, plus an inventory of every animation" },
          states: { type: "boolean", help: "hover, focus, checked and open states, located by role and text" },
          scheme: { type: "string", default: "light", value: "light|dark", help: "prefers-color-scheme for the capture" },
          url: { type: "string", value: "<base>", help: "capture a served site instead of serving .next (print its git log -1 first)" },
          widths: { type: "string", value: "w,w", help: "viewport widths; default 1920,1440,1280,1100,992,800,767,390 (1440,390 with --motion)" },
          pages: { type: "string", value: "/a,/b", help: "only these routes (a partial capture; pass the same to compare)" },
        },
        exit: { 0: "captured", 1: "a page failed twice (no shot is taken of a stalled page)", 2: "usage, no build, or no browser (playwright-core and a Chromium)" },
      },
      compare: {
        command: "visual-parity compare", summary: "diffs two captures pixel by pixel; diff images under .parity/visual/<before>-vs-<after>/",
        usage: "agentic-cms visual-parity compare <before> <after> [--threshold 0.02] [--threshold-mid 20] [--pages /a,/b]",
        positionals: [{ name: "before", required: true, help: "the baseline's label" }, { name: "after", required: true, help: "the label to judge" }],
        flags: {
          threshold: { type: "number", default: 0.02, help: "percent of pixels a static or settled frame may differ by" },
          "threshold-mid": { type: "number", default: 20, help: "the same for the mid-flight motion frames (150 and 500 ms)" },
          pages: { type: "string", value: "/a,/b", help: "judge only the after capture's files (a partial capture)" },
        },
        exit: { 0: "identical within the thresholds", 1: "a difference, a size change or a missing file", 2: "usage, or captures of two schemes" },
      },
    },
  },
};
