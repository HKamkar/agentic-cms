#!/usr/bin/env node
// What the content is right now, read from the files (never guessed): the
// posts by date with their drafts, the pages and when their copy last
// changed, the FAQ sets, reviews and use cases, the editorial calendar's
// upcoming rows and the backlog, the workshop the site names (whether it is
// present in this checkout, its briefs, its newest research), and what
// changed under content/ recently. Read-only; the content-status skill runs
// it and reports what it printed.
//
//   node scripts/content-status.mjs                    (pnpm content:status)
//   node scripts/content-status.mjs --since 90.days    the git window (default 30.days)
//
// The engine is TypeScript under src/, loaded through scripts/lib/load-ts.mjs
// after the hook is registered, hence the dynamic imports. NODE_ENV is unset
// here, so drafts are listed like any other post.
import "./lib/load-ts.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const sinceIndex = args.indexOf("--since");
const since = sinceIndex === -1 ? "30.days" : args[sinceIndex + 1];
const ROOT = path.resolve(import.meta.dirname, "..");
const DAY = 24 * 60 * 60 * 1000;
const today = new Date().toISOString().slice(0, 10);

const { getAllPosts } = await import("../src/lib/blog/posts.ts");
const { collections, readCollection } = await import("../src/lib/content/index.ts");
const { readWorkshop } = await import("./lib/content-lint.mjs");

/** Left-aligned columns; a heading line, the rows, a blank line. */
function table(title, header, rows) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => String(row[i] ?? "").length)));
  const line = (cells) => cells.map((cell, i) => String(cell ?? "").padEnd(widths[i])).join("  ").trimEnd();
  console.log(`## ${title} (${rows.length})`);
  console.log(line(header));
  for (const row of rows) console.log(line(row));
  console.log();
}

const posts = getAllPosts();
table(
  "Posts",
  ["date", "slug", "status", "updatedAt", "category", "title"],
  posts.map((post) => [post.date, post.slug, post.draft ? `draft (${Math.floor((Date.now() - new Date(`${post.date}T00:00:00Z`)) / DAY)} days)` : "live", post.updatedAt?.slice(0, 10) ?? "", post.category.slug, post.title]),
);

const pages = readCollection(collections.pages);
table("Pages", ["path", "updated", "title"], pages.map(({ data }) => [data.seo.path, data.seo.updated, data.seo.title]));
table("FAQ sets", ["key", "items"], readCollection(collections.faqs).map((set) => [set.slug, set.data.items.length]));
table("Reviews", ["name", "role"], readCollection(collections.reviews).map(({ data }) => [data.name, data.role]));
table("Use cases", ["sector", "title"], readCollection(collections.useCases).map(({ data }) => [data.sector, data.title]));

/** The calendar's rows are the table lines whose first cell is a date; the backlog's items are the lines starting with "- ". */
function editorial(file) {
  const full = path.join(ROOT, "content/editorial", file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8").split("\n") : null;
}
const calendar = editorial("calendar.md");
const rows = (calendar ?? []).map((line) => line.split("|").map((cell) => cell.trim())).filter((cells) => cells.length > 2 && /^\d{4}-\d{2}-\d{2}$/.test(cells[1])).map((cells) => cells.slice(1, -1));
const upcoming = rows.filter((row) => row[0] >= today && row[2] !== "published");
console.log(`## Calendar: ${calendar ? `${upcoming.length} upcoming of ${rows.length} rows (content/editorial/calendar.md)` : "none (content/editorial/calendar.md is missing)"}`);
for (const row of upcoming) console.log(row.join("  "));
console.log();
const backlog = editorial("backlog.md");
const ideas = (backlog ?? []).filter((line) => line.startsWith("- "));
console.log(`## Backlog: ${backlog ? `${ideas.length} ideas (content/editorial/backlog.md)` : "none (content/editorial/backlog.md is missing)"}`);
for (const idea of ideas) console.log(idea.slice(2));
console.log();

// The workshop: named by content/editorial/workshop.yaml, outside the repo, optional; read for what is in flight there.
const { workshop, problems } = readWorkshop(ROOT);
if (problems.length) console.log(`## Workshop: content/editorial/workshop.yaml has ${problems.length} problem(s) (pnpm content:lint names them)`);
else if (!workshop) console.log("## Workshop: none named (content/editorial/workshop.yaml is absent)");
else {
  const base = path.resolve(ROOT, workshop.path);
  if (!fs.existsSync(base)) console.log(`## Workshop: ${workshop.path} is not present in this checkout`);
  else {
    const role = (name) => (workshop.roles?.[name] ? path.join(base, workshop.roles[name]) : null);
    const files = (dir, ext) => (dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(ext) && f !== "README.md").sort() : []);
    const briefs = files(role("briefs"), ".md");
    const research = files(role("research"), ".md").filter((f) => /\d{4}-\d{2}-\d{2}/.test(f));
    const newest = research.sort((a, b) => a.match(/\d{4}-\d{2}-\d{2}/)[0].localeCompare(b.match(/\d{4}-\d{2}-\d{2}/)[0])).at(-1);
    console.log(`## Workshop: ${workshop.path} (roles: ${Object.keys(workshop.roles ?? {}).join(", ") || "none"})`);
    console.log(`briefs: ${briefs.length ? briefs.map((f) => f.replace(/\.md$/, "")).join(", ") : "none"}`);
    console.log(`newest research: ${newest ?? "none"}`);
  }
}
console.log();

console.log(`## Changes under content/ since ${since}`);
const log = execFileSync("git", ["log", `--since=${since}`, "--date=short", "--format=%ad %h %s", "--", "content/"], { cwd: ROOT, encoding: "utf8" }).trim();
console.log(log || "(none)");
