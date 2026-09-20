#!/usr/bin/env node
// Audits the SEO surface of every prerendered page after `next build` and
// fails the build on a structural problem, so a page cannot ship without a
// title, a description, a canonical, its Open Graph tags, its structured
// data, a sitemap entry, or with a broken internal link. Length guidance
// (title length, description length) warns.
//
//   node scripts/check-seo.mjs [--strict] [--report]
//
// --strict turns warnings into failures; --report also writes the findings to
// .parity/seo-report.txt. Reads .next/server/app/**/*.html, the built
// sitemap.xml and robots.txt bodies, and the image files under public/.
// The contract it checks is src/lib/seo/README.md; the site's origin is
// its config, read from src/kit.ts through scripts/lib/load-ts.mjs (the
// hook must be registered before the TypeScript is imported, hence the
// dynamic import). Everything is read under the directory the audit runs
// in: the site's .next and public/.
import "./lib/load-ts.mjs";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseOrExit } from "./lib/args.mjs";
import { pageTitles } from "./lib/head.mjs";
import { SPECS } from "./lib/specs.mjs";

const { strict, report } = parseOrExit(SPECS.seo, process.argv.slice(2)).flags;

const { kit } = await import("@/kit");
const { site } = kit;
const ROOT = process.cwd();
const APP = path.join(ROOT, ".next/server/app");
const PUBLIC = path.join(ROOT, "public");
const SITE_URL = site.url;

const LIMITS = {
  title: { warnMax: 60, failMax: 70 },
  description: { failMin: 50, warnMin: 70, warnMax: 160, failMax: 200 },
  ogImage: { minWidth: 1200, minRatio: 1.6, maxRatio: 2.0 },
};

// ---------- html helpers ----------
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'");
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((m) => attrs(m[0]));
const head = (html) => html.slice(0, html.indexOf("</head>"));
const metas = (html, key, value) => tags(head(html), "meta").filter((a) => a[key] === value).map((a) => a.content);
const links = (html, rel) => tags(head(html), "link").filter((a) => a.rel === rel).map((a) => a.href);
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => m[1]);

// ---------- the pages ----------
function routes() {
  const out = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (f.endsWith(".html") && !f.startsWith("_global")) out.push({ route: "/" + path.relative(APP, full).replace(/\.html$/, "").replace(/^index$/, ""), html: fs.readFileSync(full, "utf8") });
    }
  };
  walk(APP);
  return out.sort((a, b) => a.route.localeCompare(b.route));
}
const readBuilt = (name) => (fs.existsSync(path.join(APP, name)) ? fs.readFileSync(path.join(APP, name), "utf8") : "");

const findings = [];
const fail = (route, rule, msg) => findings.push({ level: "FAIL", route, rule, msg });
const warn = (route, rule, msg) => findings.push({ level: strict ? "FAIL" : "WARN", route, rule, msg });

// ---------- per-page rules ----------
// Next writes the root canonical as the bare origin; both spellings are the same URL.
const sameUrl = (a, b) => a.replace(/\/$/, "") === b.replace(/\/$/, "");

async function checkPage({ route, html }, ctx) {
  const notFound = route === "/_not-found";
  checkTitle(route, html, notFound, ctx);
  checkDescription(route, html, notFound, ctx);
  const noindex = metas(html, "name", "robots").some((r) => /noindex/.test(r));
  if (notFound && !noindex) fail(route, "robots", "the 404 page must carry noindex");
  if (!notFound && noindex) fail(route, "robots", "carries noindex; drop it or leave the page out of the sitemap on purpose (see src/lib/seo/README.md)");
  if (notFound) return; // the 404 has no canonical, social tags or sitemap entry
  await checkSocial(route, html);
  checkContent(route, html);
  checkJsonLd(route, html, route.startsWith("/blog-post/"));
  checkLinks(route, html, ctx);
  ctx.indexable.push(route);
}

function checkTitle(route, html, notFound, ctx) {
  const titles = pageTitles(html).map(decode);
  if (titles.length !== 1) return fail(route, "title", titles.length ? `${titles.length} <title> tags` : "missing");
  const title = titles[0];
  if (!title.trim()) fail(route, "title", "empty");
  else if (title.length > LIMITS.title.failMax) fail(route, "title", `${title.length} characters (max ${LIMITS.title.failMax})`);
  else if (title.length > LIMITS.title.warnMax) warn(route, "title", `${title.length} characters; Google shows about ${LIMITS.title.warnMax}`);
  if (!notFound) ctx.titles.set(title, [...(ctx.titles.get(title) ?? []), route]);
}

function checkDescription(route, html, notFound, ctx) {
  const descriptions = metas(html, "name", "description");
  if (descriptions.length !== 1) return fail(route, "description", descriptions.length ? `${descriptions.length} meta descriptions` : "missing");
  const description = descriptions[0];
  const n = description.trim().length;
  const { failMin, warnMin, warnMax, failMax } = LIMITS.description;
  if (!n) fail(route, "description", "empty");
  else if (n < failMin || n > failMax) fail(route, "description", `${n} characters (${failMin}–${failMax})`);
  else if (n < warnMin || n > warnMax) warn(route, "description", `${n} characters; aim for ${warnMin}–${warnMax}`);
  if (!notFound) ctx.descriptions.set(description, [...(ctx.descriptions.get(description) ?? []), route]);
}

/** Canonical, Open Graph and Twitter card. */
async function checkSocial(route, html) {
  const canonicalUrl = SITE_URL + (route === "/" ? "/" : route);
  const canonicals = links(html, "canonical");
  if (canonicals.length !== 1) fail(route, "canonical", canonicals.length ? `${canonicals.length} canonical links` : "missing");
  else if (!sameUrl(canonicals[0], canonicalUrl)) fail(route, "canonical", `${canonicals[0]} (expected ${canonicalUrl})`);
  const og = Object.fromEntries(["og:title", "og:description", "og:url", "og:image", "og:type"].map((k) => [k, metas(html, "property", k)[0]]));
  for (const [k, v] of Object.entries(og)) if (!v) fail(route, "open-graph", `${k} missing`);
  if (og["og:url"] && !sameUrl(og["og:url"], canonicalUrl)) fail(route, "open-graph", `og:url ${og["og:url"]} differs from the canonical`);
  if (og["og:image"]) await checkImage(route, og["og:image"]);
  if (!metas(html, "name", "twitter:card").length) fail(route, "twitter", "twitter:card missing");
}

/** Headings, images and the html element. */
function checkContent(route, html) {
  const h1s = html.match(/<h1\b/g) ?? [];
  if (h1s.length !== 1) fail(route, "headings", `${h1s.length} <h1> elements (exactly one)`);
  const firstH2 = html.search(/<h2\b/), firstH3 = html.search(/<h3\b/);
  if (firstH3 !== -1 && (firstH2 === -1 || firstH3 < firstH2)) fail(route, "headings", "an <h3> comes before any <h2>");
  for (const img of tags(html, "img")) {
    if (!("alt" in img)) fail(route, "images", `<img src="${img.src}"> has no alt attribute (empty alt for a decorative image)`);
    if (!img.width || !img.height) fail(route, "images", `<img src="${img.src}"> has no width/height`);
  }
  if (!/<html\b[^>]*\blang="/.test(html)) fail(route, "html", "<html> has no lang");
}

async function checkImage(route, url) {
  if (!url.startsWith(SITE_URL + "/")) return fail(route, "open-graph", `og:image is not an absolute site URL: ${url}`);
  const file = path.join(PUBLIC, decodeURIComponent(url.slice(SITE_URL.length)));
  if (!fs.existsSync(file)) return fail(route, "open-graph", `og:image file missing: public${url.slice(SITE_URL.length)}`);
  const { width, height } = await sharp(file).metadata();
  const ratio = width / height;
  if (width < LIMITS.ogImage.minWidth) fail(route, "open-graph", `og:image is ${width}×${height}; at least ${LIMITS.ogImage.minWidth} px wide`);
  else if (ratio < LIMITS.ogImage.minRatio || ratio > LIMITS.ogImage.maxRatio) fail(route, "open-graph", `og:image ratio ${ratio.toFixed(2)} (${width}×${height}); previews want ${LIMITS.ogImage.minRatio}–${LIMITS.ogImage.maxRatio}, ideally 1200×630`);
}

function checkJsonLd(route, html, isPost) {
  const blocks = [];
  for (const raw of jsonLd(html)) {
    try { blocks.push(JSON.parse(raw)); } catch (e) { fail(route, "json-ld", `a block does not parse: ${e.message.slice(0, 60)}`); }
  }
  const types = blocks.map((b) => b["@type"]);
  for (const b of blocks) if (b["@context"] !== "https://schema.org") fail(route, "json-ld", `${b["@type"] ?? "a block"} has no @context https://schema.org`);
  const walk = (node, at) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${at}[${i}]`));
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (["url", "item", "sameAs"].includes(k) && typeof v === "string" && !/^https?:\/\//.test(v)) fail(route, "json-ld", `${at}.${k} is not an absolute URL: ${v}`);
      walk(v, `${at}.${k}`);
    }
  };
  blocks.forEach((b, i) => walk(b, types[i] ?? `block ${i}`));
  if (route !== "/" && !types.includes("BreadcrumbList")) fail(route, "json-ld", "no BreadcrumbList (pageBreadcrumb() / postBreadcrumb())");
  if (isPost) {
    const post = blocks.find((b) => b["@type"] === "BlogPosting");
    if (!post) return fail(route, "json-ld", "no BlogPosting block");
    for (const k of ["headline", "datePublished", "author", "publisher", "image"]) if (!post[k]) fail(route, "json-ld", `BlogPosting.${k} missing`);
  } else if (!blocks.length) fail(route, "json-ld", "no structured data at all");
}

function checkLinks(route, html, ctx) {
  for (const a of tags(html, "a")) {
    const href = a.href ?? "";
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const target = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
    if (target.startsWith("/_next/")) continue;
    if (ctx.routes.has(target) || fs.existsSync(path.join(PUBLIC, decodeURIComponent(target)))) continue;
    fail(route, "links", `internal link to ${href} matches no page or file`);
  }
}

// ---------- site-wide rules ----------
function checkSitemap(ctx) {
  const xml = readBuilt("sitemap.xml.body");
  if (!xml) return fail("/sitemap.xml", "sitemap", "no built sitemap (src/app/sitemap.ts)");
  const entries = [...xml.matchAll(/<url>(.*?)<\/url>/gs)].map((m) => ({
    loc: (m[1].match(/<loc>([^<]*)<\/loc>/) ?? [])[1],
    lastmod: (m[1].match(/<lastmod>([^<]*)<\/lastmod>/) ?? [])[1],
  }));
  const seen = new Map();
  for (const { loc, lastmod } of entries) {
    if (!loc?.startsWith(SITE_URL)) { fail("/sitemap.xml", "sitemap", `${loc} is not under ${SITE_URL}`); continue; }
    const route = loc.slice(SITE_URL.length).replace(/\/$/, "") || "/";
    seen.set(route, (seen.get(route) ?? 0) + 1);
    if (!ctx.routes.has(route)) fail("/sitemap.xml", "sitemap", `${loc} has no built page`);
    if (lastmod && (Number.isNaN(Date.parse(lastmod)) || Date.parse(lastmod) > Date.now() + 86400e3)) fail("/sitemap.xml", "sitemap", `${loc} lastmod ${lastmod} is invalid or in the future`);
  }
  for (const [route, n] of seen) if (n > 1) fail("/sitemap.xml", "sitemap", `${route} listed ${n} times`);
  for (const route of ctx.indexable) if (!seen.has(route)) fail(route, "sitemap", "indexable page missing from the sitemap: a page is content/pages/<slug>.yaml (its seo block is the sitemap entry); a post is listed once published");
  if (!/Sitemap:\s*https?:\/\//.test(readBuilt("robots.txt.body"))) fail("/robots.txt", "robots", "robots.txt does not name the sitemap");
}

function checkUniqueness(ctx) {
  for (const [title, rs] of ctx.titles) if (rs.length > 1) fail(rs.join(", "), "title", `the same <title> on ${rs.length} pages: "${title}"`);
  for (const rs of ctx.descriptions.values()) if (rs.length > 1) fail(rs.join(", "), "description", `the same description on ${rs.length} pages`);
}

// ---------- run ----------
const pages = routes();
if (!pages.length) { console.error("check-seo: no prerendered pages under .next/server/app — run `next build` first"); process.exit(2); }
const ctx = { routes: new Set(pages.map((p) => p.route)), indexable: [], titles: new Map(), descriptions: new Map() };
for (const page of pages) await checkPage(page, ctx);
checkSitemap(ctx);
checkUniqueness(ctx);

const lines = findings.map((f) => `${f.level} ${f.route} ${f.rule}: ${f.msg}`);
const fails = findings.filter((f) => f.level === "FAIL").length;
const warns = findings.length - fails;
for (const l of lines) console.log(l);
console.log(`check-seo: ${pages.length} pages, ${fails} failure${fails === 1 ? "" : "s"}, ${warns} warning${warns === 1 ? "" : "s"}${strict ? " (strict)" : ""}`);
if (report) { fs.mkdirSync(path.join(ROOT, ".parity"), { recursive: true }); fs.writeFileSync(path.join(ROOT, ".parity/seo-report.txt"), lines.join("\n") + "\n"); }
process.exit(fails ? 1 : 0);
