// The content lint: the rules on top of the content engine that a schema
// cannot carry — the voice and claim rules of content/VOICE.md, the SEO
// limits at the source, the post body's structure, the images on disk, the
// dates that parse but are not days, the starter's placeholders and the kit
// example's brand (lib/placeholders.mjs). `lint({ root, collections, site })`
// reads every collection of the site's registry exactly as a build would (an engine error is reported first, verbatim, and
// that collection is skipped), then walks every validated entry and returns
// findings; `scripts/content-lint.mjs` prints them, `scripts/content-lint.test.mjs`
// asserts them on scratch trees. A finding is `{ level, file, rule, path,
// problem }` and prints as `LEVEL file rule: path problem` (the SEO audit's
// grammar with the engine's `file: path problem` shape). The exact rules
// (the banned list, the patterns, the model names, the mark, the em dash,
// the alt pairs, the counts, the dates, the structure, the images, the
// workshop file's shape, the redirects against the pages and posts, the
// example's brand in a site) FAIL; the
// heuristics (voice-claim, voice-cloud) and the soft ranges (a title over 60,
// a description outside 70–160, a future date, a stale draft, an orphan, a
// stray file) WARN — the CLI's --strict promotes those too. Placeholder copy
// and a placeholder address WARN, and FAIL with `production` (`lint
// --production`, the first step of a site's `pnpm build`). The example's
// brand in a file the site's baseline holds (lib/baseline.mjs: what a site
// had when it took 0.8.2) passes while the file has no more than its count.
// A site in several languages (`locales`, kit.locales; docs/locales.md) has
// each language's translations linted with its own voice block,
// content/VOICE.<prefix>.md, and every rule that is not a voice rule; the
// alt-weak heuristic, which reads English, holds the default language alone.
//
// Loaded through scripts/lib/load-ts.mjs: the tests via `node --import`, the
// CLI via a dynamic import after the hook (in the package's own checkout the
// engine is the TypeScript source; on a site it is the package).
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ContentError, formatPath, readCollection, sourceOf } from "agentic-cms/content";
import { baselineCounts } from "./baseline.mjs";
import { checkPagePaths } from "agentic-cms/locales";
import { exampleBrandIn, exampleBrandLeftovers, hasPlaceholder, isKit, NOT_CONTENT, onReservedDomain, placeholderLines, REPLACE } from "./placeholders.mjs";
import { translations } from "./translations.mjs";

export const LIMITS = {
  title: { warnMax: 60, failMax: 70 }, // = check-seo
  description: { failMin: 50, warnMin: 70, warnMax: 160, failMax: 200 }, // = check-seo
  excerptWords: { min: 30, max: 40 },
  keywords: { min: 3, max: 8 },
  imageBytes: 250 * 1024,
  draftDays: 30,
  claimWindow: 60, // characters either side of a claim word in which a regulation name makes it a claim
};

/** The layout's title template is `%s | <site.name>`: a post without seoTitle renders this much longer. */
const titleSuffix = (site) => ` | ${site.name}`;
const VOICE_FILE = "content/VOICE.md";
const VOICE_START = "<!-- voice-rules:start -->";
const VOICE_END = "<!-- voice-rules:end -->";
const IMAGE_KEYS = new Set(["image", "thumbnail", "ogImage", "icon", "photo"]);
const ALT_OF = { image: "imageAlt", thumbnail: "thumbnailAlt", photo: "photoAlt" };
/** Strings that are identifiers, not prose: the voice rules skip them. */
const SKIP_KEYS = new Set(["type", "variant", "kind", "set", "form", "category", "author", "related", "changeFrequency", "path", "source", "country", "email", "operatingSystem", "keywords"]);
/** The same test as faqHeading() in src/lib/blog/faq.ts: the H2 that starts the accordion — one containing the language's `faqHeading` (site.ts), else "frequently asked" or "faq". */
const FAQ_HEADING = /frequently asked|faq/i;
const faqHeadingOf = (text) => (text ? new RegExp(escape(text), "i") : FAQ_HEADING);
const WEAK_ALT = /^(?:(?:an? )?(?:image|picture|photo|illustration|graphic|icon|screenshot)(?: of| for)?\b|(?:supporting|header) illustration\b|index card image\b)/i;
const BLOG_IMAGES = "/images/blog/";
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*([^)\s]+)[^)]*\)/g;
const HTML_IMAGE = /<img\b[^>]*>/gi;
const DAY = 24 * 60 * 60 * 1000;
const CALENDAR = "content/editorial/calendar.md";
/** Where the site names its marketing workshop outside the repo (optional); what the editorial plugin may read there, by role. */
const WORKSHOP = "content/editorial/workshop.yaml";
const WORKSHOP_ROLES = ["strategy", "keywords", "research", "briefs", "drafts", "prompts", "glossary", "history"];
export const workshopSchema = z.strictObject({
  path: z.string({ error: (issue) => (issue.input == null ? "is required: where the workshop is, relative to the repo root or absolute" : "must be a string") }).min(1, { error: "must be a non-empty string" }),
  roles: z.strictObject(Object.fromEntries(WORKSHOP_ROLES.map((role) => [role, z.string({ error: "must be a string" }).min(1, { error: "must be a non-empty string" }).optional()]))).optional(),
});

const rule = { why: z.string().optional(), instead: z.string().optional(), note: z.string().optional(), where: z.array(z.string()).optional(), except: z.array(z.string()).optional() };
const voiceSchema = z.strictObject({
  brand: z.strictObject({ name: z.string().min(1), mark: z.string().optional() }),
  banned: z.array(z.strictObject({ match: z.string().min(1), ...rule })),
  patterns: z.array(z.strictObject({ regex: z.string().min(1), flags: z.string().optional(), ...rule })),
  claims: z.strictObject({ words: z.array(z.string()), phrases: z.array(z.string()).default([]), regulations: z.array(z.string()), subject: z.string(), negation: z.string(), instead: z.string() }),
  models: z.strictObject({ names: z.array(z.string()), instead: z.string(), except: rule.except }),
  clouds: z.strictObject({ names: z.array(z.string()), stack: z.string(), instead: z.string() }),
});

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A literal phrase at word boundaries; a hyphen counts as part of a word so "private-ai-for-startups" is not "private-AI". */
const phrase = (text, flags = "i") => new RegExp(`(?<![\\w-])${escape(text)}(?![\\w-])`, flags);
const q = (text) => `"${text}"`;

/** `content/VOICE.md` → `{ voice }`, or `{ problems }` naming what is wrong with it (one line each, the engine's style). */
export function readVoice(file) {
  if (!fs.existsSync(file)) return { problems: [{ path: "", problem: "does not exist; the voice rules live there" }] };
  const text = fs.readFileSync(file, "utf8");
  const start = text.indexOf(VOICE_START);
  const end = text.indexOf(VOICE_END);
  if (start === -1 || end === -1 || end < start) return { problems: [{ path: "", problem: `no block between ${VOICE_START} and ${VOICE_END}` }] };
  const fence = text.slice(start, end).match(/```ya?ml\n([\s\S]*?)```/);
  if (!fence) return { problems: [{ path: "", problem: "no ```yaml fence between the voice-rules markers" }] };
  let data;
  try {
    data = parseYaml(fence[1]);
  } catch (error) {
    return { problems: [{ path: "", problem: `invalid YAML in the voice-rules block: ${String(error.message).split("\n")[0]}` }] };
  }
  const result = voiceSchema.safeParse(data);
  if (!result.success) return { problems: result.error.issues.map((issue) => ({ path: formatPath(issue.path), problem: issue.code === "unrecognized_keys" ? `unknown key(s) ${issue.keys.join(", ")}` : issue.message })) };
  return { voice: result.data };
}

function compile(voice) {
  const { name, mark = "" } = voice.brand;
  // The spellings that are not the brand's own: "Acme" is right for Acme; for a lowercase brand "acme", "Acme" and "ACME" are wrong.
  const miscased = [...new Set([name[0].toUpperCase() + name.slice(1), name.toUpperCase()])].filter((variant) => variant !== name);
  return {
    name,
    mark,
    banned: voice.banned.map((entry) => ({ ...entry, re: phrase(entry.match) })),
    patterns: voice.patterns.map((entry) => ({ ...entry, re: new RegExp(entry.regex, (entry.flags ?? "").replace("g", "")) })),
    claimWords: voice.claims.words.map((word) => ({ word, re: phrase(word, "ig") })),
    claimPhrases: voice.claims.phrases.map((text) => ({ text, re: phrase(text) })),
    regulations: voice.claims.regulations.map((text) => ({ text, re: phrase(text) })),
    subject: new RegExp(voice.claims.subject, "i"),
    negation: new RegExp(`(?:${voice.claims.negation})\\s+(?:\\S+\\s+){0,3}$`, "i"),
    claimsInstead: voice.claims.instead,
    models: voice.models.names.map((text) => ({ text, re: phrase(text, "") })),
    modelsInstead: voice.models.instead,
    modelsScope: { except: voice.models.except },
    clouds: voice.clouds.names.map((text) => ({ text, re: phrase(text, "g") })),
    stack: new RegExp(voice.clouds.stack, "i"),
    cloudsInstead: voice.clouds.instead,
    // the bare name: not preceded by a word character, @, . or / (an e-mail, a domain, a path), not followed by the mark or a domain suffix
    bare: mark ? new RegExp(`(?<![\\w@./-])${escape(name)}(?!${escape(mark)})(?![\\w-])(?!\\.[a-z]{2,}\\b)`) : null,
    miscased: miscased.length ? new RegExp(`(?<![\\w@./-])(?:${miscased.map(escape).join("|")})(?![\\w-])(?!\\.[a-z]{2,}\\b)`) : null,
  };
}

/** Keys whose value the design uppercases (ui/Eyebrow): their case is not the brand's. */
const UPPERCASED_KEYS = new Set(["eyebrow", "label", "listEyebrow"]);
/** Fields that speak for the brand by construction, so a claim word needs no first-person subject to be a claim. */
const FIRST_PERSON = /^(?:jsonld\.|seo\.description$|sections\[.*\]\.(?:cards|points|left|right|items)\[\d+\]\.(?:title|text)$)/;

/** A possessive right before a claim word makes it someone else's certification, not the brand's. */
const THIRD_PARTY = /\b(?:their|its|your|his|her|the \w+'s)\s+(?:\S+\s+){0,3}$/i;
/** Inside straight double quotes = someone else's words (an odd number of quotes before the position). */
const inQuotes = (before) => (before.match(/"/g) ?? []).length % 2 === 1;

/** URLs, e-mail addresses and site paths are never prose: blanked before the text rules run. */
const mask = (text) => text.replace(/https?:\/\/\S+/g, " ").replace(/\S+@\S+\.\S+/g, " ").replace(/(?<!\S)\/[\w./-]+/g, " ");

const applies = (entry, ctx) => (!entry.where || entry.where.includes(ctx.collection)) && !(entry.except ?? []).some((prefix) => ctx.file === prefix || `${ctx.file}#${ctx.path}`.startsWith(prefix));
const sentenceAround = (text, index) => {
  const before = text.slice(0, index).search(/[^.;!?]*$/);
  const after = text.slice(index).search(/[.;!?]/);
  return text.slice(before, after === -1 ? text.length : index + after);
};
const withHint = (entry, base) => `${base}${entry.why ? ` (${entry.why})` : ""}${entry.instead ? `; write ${q(entry.instead)}` : ""}`;

/** The voice, claim and brand rules on one string; `ctx` = { file, path, collection }. */
function textRules(m, ctx, raw) {
  const out = [];
  const text = mask(raw);
  const add = (level, rule, problem) => out.push({ level, file: ctx.file, rule, path: ctx.path, problem });
  for (const entry of m.banned) {
    if (!applies(entry, ctx)) continue;
    const hit = text.match(entry.re);
    if (hit) add("FAIL", "voice-banned", withHint(entry, `${q(hit[0])} is banned`));
  }
  for (const entry of m.patterns) {
    if (!applies(entry, ctx)) continue;
    const hit = text.match(entry.re);
    if (hit) add("FAIL", "voice-pattern", withHint(entry, `${q(hit[0].trim())} matches a banned pattern`));
  }
  for (const { text: claim, re } of m.claimPhrases) {
    const hit = text.match(re);
    if (hit && !inQuotes(text.slice(0, hit.index))) add("WARN", "voice-claim", `${q(claim)} reads as a compliance claim; write ${q(m.claimsInstead)}`);
  }
  // A claim word is a claim when a regulation is named nearby, the brand is the subject (or the field speaks for it), and the
  // word is not negated, not someone else's (their certified perimeter) and not inside quotation marks (someone else's words).
  for (const { re } of m.claimWords) {
    for (const hit of text.matchAll(re)) {
      const window = text.slice(Math.max(0, hit.index - LIMITS.claimWindow), hit.index + hit[0].length + LIMITS.claimWindow);
      const regulation = m.regulations.find(({ re: r }) => r.test(window));
      if (!regulation) continue;
      const before = text.slice(0, hit.index);
      const firstPerson = FIRST_PERSON.test(ctx.path) || m.subject.test(sentenceAround(text, hit.index));
      if (!firstPerson || m.negation.test(before) || THIRD_PARTY.test(before) || inQuotes(before)) continue;
      add("WARN", "voice-claim", `${q(hit[0])} near ${q(regulation.text)} reads as a certification claim; write "designed to support ${regulation.text}"`);
      break;
    }
  }
  if (applies(m.modelsScope, ctx)) for (const { text: model, re } of m.models) if (re.test(text)) add("FAIL", "voice-model", `names the model ${q(model)}; write ${q(m.modelsInstead)}`);
  // A cloud name is fine (the customer's account, the installer's variants) unless the sentence says the brand's stack runs on it.
  for (const { re } of m.clouds) {
    const hit = [...text.matchAll(re)].find((match) => m.stack.test(sentenceAround(text, match.index)));
    if (hit) add("WARN", "voice-cloud", `${q(hit[0])} as part of the ${m.name}${m.mark} stack; ${m.cloudsInstead}`);
  }
  if (m.bare?.test(text)) add("FAIL", "brand-mark", `${q(m.name)} without the ${m.mark} mark; write ${q(m.name + m.mark)}`);
  const cased = UPPERCASED_KEYS.has(ctx.key) || !m.miscased ? null : text.match(m.miscased);
  if (cased) add("FAIL", "brand-case", `${q(cased[0])} is not how the brand is spelled; write ${q(m.name + m.mark)}`);
  if (raw.includes("—")) add("FAIL", "em-dash", "contains an em dash; use a period, a comma, or restructure the sentence");
  return out;
}

/** Every string in a validated entry with its field path: `sections[2].cards[0].text`, `[1].quote`, `h-kamkar.bio`. */
function* leaves(value, segments = []) {
  if (typeof value === "string") yield { segments, key: String(segments.at(-1) ?? ""), value };
  else if (Array.isArray(value)) for (const [index, item] of value.entries()) yield* leaves(item, [...segments, index]);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) yield* leaves(item, [...segments, key]);
}
const isProse = (key, value) => !SKIP_KEYS.has(key) && !IMAGE_KEYS.has(key) && !/^(?:https?:|mailto:|\/|\d{4}-\d{2}-\d{2})/.test(value) && !/^\S+@\S+\.\S+$/.test(value);
const isCalendarDay = (day) => new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * `collections` is the site's registry (kit.collections), `site` its config
 * (kit.site), `locales` its languages (kit.locales, left out for a site in
 * one): the lint reads the site it is given, never a module of its own.
 * `production`: placeholders FAIL.
 */
export function lint({ root = process.cwd(), collections, site, locales, voice, now = new Date(), production = false }) {
  if (!collections || !site) throw new Error("lint(): collections and site are required");
  const previous = process.cwd();
  process.chdir(root);
  try {
    return lintTree({ root, collections, site, locales, given: voice, now, marks: { level: production ? "FAIL" : "WARN", kit: isKit(root) } });
  } finally {
    process.chdir(previous);
  }
}

/** The voice block of `file` compiled, or null with its problems added as FAILs; `given` (a test's) in place of the file. */
function voiceMatchers(root, file, given, add, missing) {
  if (given) return compile(voiceSchema.parse(given));
  const read = readVoice(path.join(root, file));
  if (read.voice) return compile(read.voice);
  for (const { path: p, problem } of read.problems) add("FAIL", file, "voice", p, missing && /does not exist/.test(problem) ? missing : problem);
  return null;
}

function lintTree({ root, collections, site, locales, given, now, marks }) {
  const findings = [];
  const rows = [];
  const add = (level, file, rule, path, problem) => findings.push({ level, file, rule, path, problem });
  // posts and pages: { entry, route } — every language's, for the redirects
  const tree = { root, now, marks, site, locales, images: [], posts: [], pages: [], redirects: [], retired: retiredSlugs(root), findings, rows, add };
  const matchers = voiceMatchers(root, VOICE_FILE, given, add);
  for (const [key, def] of Object.entries(collections)) lintCollection(def, def.name, tree, { matchers, locale: null, key });
  const languages = translations({ collections, locales, root });
  for (const locale of (locales?.all ?? []).filter((candidate) => !candidate.isDefault)) {
    const file = `content/VOICE.${locale.prefix}.md`;
    const voice = voiceMatchers(root, file, given, add, `does not exist: the voice rules of ${locale.locale}, VOICE.md's block written for the language (docs/locales.md)`);
    for (const { key, original, def } of languages.filter((translation) => translation.locale === locale)) lintCollection(def, original.name, tree, { matchers: voice, locale, key });
  }
  if (locales && locales.all.length > 1) findings.push(...pagePathRules(locales, tree.pages));
  const { images, posts, pages, redirects } = tree;
  findings.push(...imageRules(root, images));
  findings.push(...orphanRules(root, posts.map(({ entry }) => entry), images));
  findings.push(...redirectRules(redirects, { pages, posts }));
  findings.push(...strayRules(root, collections, locales));
  findings.push(...workshopRules(root));
  findings.push(...configPlaceholders(root, marks));
  if (!marks.kit) findings.push(...brandRules(root, site));
  return { findings, collections: rows };
}

/**
 * One collection of one language: read as a build reads it (an engine error
 * is its FAILs), then every rule on each entry. `name` is the collection's
 * own (its translation's is `posts.de`), `locale` null for the default
 * language.
 */
function lintCollection(def, name, tree, { matchers, locale }) {
  const { root, now, marks, site, findings, rows, add } = tree;
  let entries;
  try {
    entries = readCollection(def);
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    for (const issue of error.issues) add("FAIL", error.file, "schema", issue.path, issue.problem);
    rows.push({ name: def.name, source: sourceOf(def), entries: 0 });
    return;
  }
  rows.push({ name: def.name, source: sourceOf(def), entries: entries.length });
  for (const entry of entries) {
    const base = def.kind === "list" ? [Number(entry.slug)] : def.kind === "map" ? [entry.slug] : [];
    const ctx = { file: entry.file, collection: name };
    for (const leaf of leaves(entry.data, base)) {
      const p = formatPath(leaf.segments);
      findings.push(...placeholderRules(marks, { file: entry.file, path: p, value: leaf.value }));
      if (name === "redirects") continue; // paths, not prose or pictures: redirectRules() reads them
      if (IMAGE_KEYS.has(leaf.key) || leaf.value.startsWith("/images/")) tree.images.push({ file: entry.file, path: p, value: leaf.value });
      else if (matchers && isProse(leaf.key, leaf.value)) findings.push(...textRules(matchers, { ...ctx, path: p, key: leaf.key }, leaf.value));
    }
    if (name === "posts") {
      tree.posts.push({ entry, route: `${locale ? `/${locale.prefix}` : ""}${site.postPrefix}/${entry.slug}`, locale });
      const faq = faqHeadingOf((locale ? tree.locales.site(locale.locale) : site).faqHeading);
      findings.push(...postRules(root, entry, now, matchers, tree.images, tree.retired, titleSuffix(site), marks, !locale, faq));
    }
    if (name === "pages") { tree.pages.push({ entry, route: entry.data.seo.path, locale }); findings.push(...pageRules(entry, now)); }
    if (name === "redirects") tree.redirects.push(entry);
    if (name === "authors" || name === "reviews") findings.push(...altRules(entry, base, !locale));
  }
}

/** Every page file where the engine wants it (checkPagePaths): no default page under a prefix, a translation at its page's path under its own. */
function pagePathRules(locales, pages) {
  const defaults = pages.filter(({ locale }) => !locale).map(({ entry }) => entry);
  return locales.all.flatMap((language) => {
    try {
      checkPagePaths(locales, language.locale, pages.filter(({ locale }) => (locale?.locale ?? locales.default.locale) === language.locale).map(({ entry }) => entry), () => defaults);
      return [];
    } catch (error) {
      if (!(error instanceof ContentError)) throw error;
      return error.issues.map((issue) => ({ level: "FAIL", file: error.file, rule: "schema", path: issue.path, problem: issue.problem }));
    }
  });
}

/** The starter's marker in a string, or a stand-in address on a reserved domain (outside the kit, whose example is on one by design). */
function placeholderRules(marks, { file, path: p, value }) {
  if (hasPlaceholder(value)) return [{ level: marks.level, file, rule: "placeholder", path: p, problem: `is placeholder copy${shipsNone(marks)}: ${REPLACE}` }];
  if (!marks.kit && onReservedDomain(value) && !exampleBrandIn(value)) return [domainFinding(marks, file, p, value)];
  return [];
}

const shipsNone = (marks) => (marks.level === "FAIL" ? ", which a production build never ships" : "");
const domainFinding = (marks, file, p, value) => ({ level: marks.level, file, rule: "placeholder", path: p, problem: `${q(value)} is a stand-in on a domain reserved for examples${shipsNone(marks)}: set the site's own (init --url and --email, or by hand)` });

/** The config under src/config/ by line: the marker anywhere, a reserved domain in site.ts (lib/placeholders.mjs). */
function configPlaceholders(root, marks) {
  return placeholderLines(root, { content: false }).map(({ file, path: p, value, domain }) => (domain ? domainFinding(marks, file, p, value) : { level: marks.level, file, rule: "placeholder", path: p, problem: `holds placeholder copy${shipsNone(marks)}: ${REPLACE}` }));
}

/**
 * The kit example's brand, its domain or its author left in a site: FAIL at
 * any time (never run in the kit's own repository), but in a file the site's
 * baseline holds for example-brand while the file has no more than its
 * count; past it, each FAILs, saying so.
 */
function brandRules(root, site) {
  const found = exampleBrandLeftovers(root, { siteName: `${site.name} ${site.shortName}` });
  const held = baselineCounts(root, "example-brand");
  const inFile = (file) => found.filter((entry) => entry.file === file).length;
  return found.filter(({ file }) => !(held.get(file) >= inFile(file))).map(({ file, path: p, found: what }) => ({ level: "FAIL", file, rule: "example-brand", path: p, problem: `${q(what)} is the kit example's ${/editorial/i.test(what) ? "author" : /\./.test(what) ? "domain" : "brand"}, which a site never keeps: write the site's own${p ? "" : " (rename or delete the file)"}, or delete what came from the example${held.has(file) ? ` (${inFile(file)} in this file, and the baseline holds ${held.get(file)}: it only shrinks)` : ""}` }));
}

/** `content/editorial/workshop.yaml`, when it exists, has the shape the plugin reads; whether the folder is present is no finding (a fresh clone has no workshop). */
export function readWorkshop(root) {
  const file = path.join(root, WORKSHOP);
  if (!fs.existsSync(file)) return { problems: [] };
  let data;
  try {
    data = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { problems: [{ path: "", problem: `invalid YAML: ${String(error.message).split("\n")[0]}` }] };
  }
  const result = workshopSchema.safeParse(data);
  if (!result.success) return { problems: result.error.issues.map((issue) => ({ path: formatPath(issue.path), problem: issue.code === "unrecognized_keys" ? `unknown key(s) ${issue.keys.join(", ")}; the roles are ${WORKSHOP_ROLES.join(", ")}` : issue.message })) };
  return { workshop: result.data, problems: [] };
}

function workshopRules(root) {
  return readWorkshop(root).problems.map(({ path: p, problem }) => ({ level: "FAIL", file: WORKSHOP, rule: "workshop", path: p, problem }));
}

const lengthRule = (file, path, value, limits) => {
  const n = value.length;
  const problem = `is ${n} characters`;
  if (n > limits.failMax) return { level: "FAIL", file, rule: "seo-title", path, problem: `${problem} (${limits.failMax} at most)` };
  if (n > limits.warnMax) return { level: "WARN", file, rule: "seo-title", path, problem: `${problem}; Google shows about ${limits.warnMax}` };
  return null;
};
const descriptionRule = (file, path, value, label = "") => {
  const { failMin, warnMin, warnMax, failMax } = LIMITS.description;
  const n = value.length;
  if (n < failMin || n > failMax) return { level: "FAIL", file, rule: "seo-description", path, problem: `is ${n} characters (${failMin}–${failMax})${label}` };
  if (n < warnMin || n > warnMax) return { level: "WARN", file, rule: "seo-description", path, problem: `is ${n} characters; ${warnMin}–${warnMax}${label}` };
  return null;
};
const dayRules = (file, path, day, now) => {
  if (!isCalendarDay(day)) return [{ level: "FAIL", file, rule: "date-rollover", path, problem: `${q(day)} is not a calendar day (Date.parse rolls it to ${new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10)})` }];
  if (new Date(`${day}T00:00:00Z`) > now) return [{ level: "WARN", file, rule: "date-future", path, problem: `${q(day)} is in the future (today is ${now.toISOString().slice(0, 10)})` }];
  return [];
};

/** `weak`: the alt-weak heuristic, which reads English, runs (the default language's files). */
function altRules(entry, base, weak = true) {
  const out = [];
  const data = entry.data;
  for (const [key, altKey] of Object.entries(ALT_OF)) {
    if (!(key in data)) continue;
    const p = (name) => formatPath([...base, name]);
    if (data[key] && !data[altKey] && key !== "photo") out.push({ level: "FAIL", file: entry.file, rule: "alt-pair", path: p(altKey), problem: `is missing while ${key} is set; say what the picture shows, in a sentence` });
    if (weak && data[altKey] && WEAK_ALT.test(data[altKey])) out.push({ level: "FAIL", file: entry.file, rule: "alt-weak", path: p(altKey), problem: `${q(data[altKey])} names the slot, not the picture` });
  }
  return out;
}

/** The slugs the editorial calendar marks `retired`: a draft kept for its indexed URL, which the stale-draft rule leaves alone. */
function retiredSlugs(root) {
  const file = path.join(root, CALENDAR);
  if (!fs.existsSync(file)) return new Set();
  const rows = fs.readFileSync(file, "utf8").split("\n").map((line) => line.split("|").map((cell) => cell.trim()));
  return new Set(rows.filter((cells) => cells.length > 3 && /^\d{4}-\d{2}-\d{2}$/.test(cells[1]) && cells[3] === "retired").map((cells) => cells[2]));
}

function postRules(root, entry, now, matchers, images, retired, suffix, marks, weak, faqHeading) {
  const { file, data } = entry;
  const out = [];
  out.push(...altRules(entry, [], weak));
  if (!data.keywords) out.push({ level: "FAIL", file, rule: "keywords-count", path: "keywords", problem: `is missing; ${LIMITS.keywords.min}–${LIMITS.keywords.max} keywords` });
  else if (data.keywords.length < LIMITS.keywords.min || data.keywords.length > LIMITS.keywords.max) out.push({ level: "FAIL", file, rule: "keywords-count", path: "keywords", problem: `has ${data.keywords.length} entries; ${LIMITS.keywords.min}–${LIMITS.keywords.max}` });
  if (data.seoTitle) out.push(lengthRule(file, "seoTitle", data.seoTitle, LIMITS.title));
  else {
    const rendered = data.title + suffix;
    const hit = lengthRule(file, "title", rendered, LIMITS.title);
    if (hit) out.push({ ...hit, problem: `renders as ${q(rendered)}, ${rendered.length} characters; set a seoTitle of ${LIMITS.title.warnMax} or fewer` });
  }
  out.push(data.seoDescription ? descriptionRule(file, "seoDescription", data.seoDescription) : descriptionRule(file, "excerpt", data.excerpt, " (it is the meta description; or set seoDescription)"));
  if (data.excerpt) {
    const n = words(data.excerpt);
    if (n < LIMITS.excerptWords.min || n > LIMITS.excerptWords.max) out.push({ level: "FAIL", file, rule: "excerpt-words", path: "excerpt", problem: `has ${n} words; ${LIMITS.excerptWords.min}–${LIMITS.excerptWords.max}` });
  }
  out.push(...dayRules(file, "date", data.date, now));
  if (data.publishedAt && data.updatedAt && Date.parse(data.updatedAt) < Date.parse(data.publishedAt)) out.push({ level: "FAIL", file, rule: "date-order", path: "updatedAt", problem: `${data.updatedAt} is before publishedAt ${data.publishedAt}; drop it or set the real edit time (posts.ts clamps it)` });
  if (data.draft && isCalendarDay(data.date) && !retired.has(entry.slug)) {
    const days = Math.floor((now - new Date(`${data.date}T00:00:00Z`)) / DAY);
    if (days > LIMITS.draftDays) out.push({ level: "WARN", file, rule: "draft-stale", path: "draft", problem: `for ${days} days (date ${data.date}); publish it, or retire it with a "retired" row in ${CALENDAR}` });
  }
  out.push(...bodyRules(root, entry, matchers, images, marks, faqHeading));
  return out.filter(Boolean);
}

function pageRules(entry, now) {
  const { file, data } = entry;
  return [lengthRule(file, "seo.title", data.seo.title, LIMITS.title), descriptionRule(file, "seo.description", data.seo.description), ...dayRules(file, "seo.updated", data.seo.updated, now)].filter(Boolean);
}

/** The routes a reader gets today, in every language: every page's path and every published post's URL (a draft's answers 404 in production), each with its file. */
const liveRoutes = ({ pages, posts }) => new Map([...pages.map(({ entry, route }) => [route, entry.file]), ...posts.filter(({ entry }) => !entry.data.draft).map(({ entry, route }) => [route, entry.file])]);

/** Where a redirect's `to` ends up once the entries it lands on are followed: { route, via } — `via` the entries passed, `loop` when it comes back. */
function follow(start, byFrom, redirects) {
  const via = [];
  let route = start;
  while (byFrom.has(route)) {
    if (via.includes(byFrom.get(route))) return { route, via, loop: true };
    via.push(byFrom.get(route));
    route = redirects[byFrom.get(route)].data.to.split(/[?#]/)[0];
  }
  return { route, via, loop: false };
}

/**
 * content/redirects.yaml against the pages and the posts (FAIL each): a
 * `from` listed once and no live page's path or published post's URL (it
 * would hide what is there); no chain (a `to` that is another entry's
 * `from`, which costs a hop) and no loop; a `to` path that a page, a
 * published post or the blog index answers. An https:// `to` is the host's.
 */
function redirectRules(redirects, ctx) {
  const live = liveRoutes(ctx);
  const byFrom = new Map();
  const out = [];
  const where = (at, key) => ({ level: "FAIL", file: redirects[at].file, path: formatPath([at, key]) });
  const entries = (via) => via.map((i) => formatPath([i])).join(" → ");
  redirects.forEach(({ data: { from } }, at) => {
    if (byFrom.has(from)) out.push({ ...where(at, "from"), rule: "redirect-from", problem: `${q(from)} is listed already at ${formatPath([byFrom.get(from)])}: one entry per path` });
    else byFrom.set(from, at);
    if (live.has(from)) out.push({ ...where(at, "from"), rule: "redirect-from", problem: `${q(from)} is a live page's or post's (${live.get(from)}): the redirect would hide it — take the page off first (/editorial:retire-content), or drop the entry` });
  });
  redirects.forEach(({ data: { from, to } }, at) => {
    if (/^https:\/\//.test(to)) return;
    const route = to.split(/[?#]/)[0];
    const end = route === from ? { loop: true, via: [] } : follow(route, byFrom, redirects);
    if (end.loop) out.push({ ...where(at, "to"), rule: "redirect-chain", problem: `${q(to)} leads back to ${q(from)} (${entries([at, ...end.via])}): a loop, which no browser follows — point it at a page that exists` });
    else if (end.via.length) out.push({ ...where(at, "to"), rule: "redirect-chain", problem: `${q(to)} is itself redirected (${entries(end.via)}): a chain — point it at ${q(end.route)} directly` });
    else if (!live.has(route)) out.push({ ...where(at, "to"), rule: "redirect-to", problem: `${q(to)} is no page, no published post and not the blog index: the redirect would land on a 404 — point it at a page that exists, or at an https:// URL` });
  });
  return out;
}

/** The lines of the body with their file line numbers, fenced code blanked so nothing inside it is read as a heading, an image or prose. */
function bodyLines(root, entry) {
  const raw = fs.readFileSync(path.join(root, entry.file), "utf8");
  const at = raw.indexOf(entry.body);
  const offset = at > 0 ? raw.slice(0, at).split("\n").length - 1 : 0;
  let fenced = false;
  return entry.body.split("\n").map((text, index) => {
    if (/^\s*(```|~~~)/.test(text)) {
      fenced = !fenced;
      return { line: offset + index + 1, text: "" };
    }
    return { line: offset + index + 1, text: fenced ? "" : text };
  });
}

const plainText = (text) => text.replace(/`[^`]*`/g, " ").replace(MARKDOWN_IMAGE, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, " ");
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));

function bodyRules(root, entry, matchers, images, marks, faqHeading = FAQ_HEADING) {
  const out = [];
  const { file, slug } = entry;
  const add = (level, rule, line, problem) => out.push({ level, file, rule, path: `line ${line}`, problem });
  const lines = bodyLines(root, entry);
  let level = 1; // the title is the page's H1
  let faq = null; // { line, questions: [{ line, answered }] } once the FAQ heading is seen
  for (const { line, text } of lines) {
    const heading = text.match(/^(#{1,6})\s+(.*\S)/);
    if (heading) {
      const depth = heading[1].length;
      if (depth === 1) add("FAIL", "heading-level", line, `${q(text)} is an H1; the title is the H1, body headings start at ##`);
      else if (depth > level + 1) add("FAIL", "heading-level", line, `${q(text)} jumps from ${level === 1 ? "the title" : "#".repeat(level)} to ${heading[1]}`);
      level = depth;
      if (depth === 2) {
        if (faq) out.push(...faqFindings(file, faq));
        faq = faqHeading.test(heading[2]) ? { line, text, questions: [] } : null;
      } else if (faq) {
        if (depth === 3) faq.questions.push({ line, text, answered: false });
        else add("FAIL", "faq-structure", line, `${q(text)} under the FAQ heading; questions are ###`);
      }
      continue;
    }
    if (faq && text.trim() && faq.questions.length) faq.questions.at(-1).answered = true;
    for (const image of bodyImages(text)) out.push(...bodyImageRules(root, file, slug, line, image, images));
    if (hasPlaceholder(text)) out.push(...placeholderRules(marks, { file, path: `line ${line}`, value: text }));
    if (matchers && text.trim()) out.push(...textRules(matchers, { file, path: `line ${line}`, collection: "posts" }, plainText(text)));
  }
  if (faq) out.push(...faqFindings(file, faq));
  return out;
}

const faqFindings = (file, faq) => {
  if (!faq.questions.length) return [{ level: "FAIL", file, rule: "faq-structure", path: `line ${faq.line}`, problem: `${q(faq.text)} has no ### question under it (the accordion would be empty)` }];
  return faq.questions.filter((question) => !question.answered).map((question) => ({ level: "FAIL", file, rule: "faq-structure", path: `line ${question.line}`, problem: `${q(question.text)} has no answer paragraph` }));
};

/** Markdown and raw-HTML images on a body line: { src, alt } with alt undefined when the <img> has no alt attribute at all. */
function bodyImages(text) {
  const found = [];
  for (const hit of text.matchAll(MARKDOWN_IMAGE)) found.push({ src: hit[2], alt: hit[1] });
  for (const [tag] of text.matchAll(HTML_IMAGE)) {
    const src = attribute(tag, "src");
    const alt = attribute(tag, "alt");
    found.push({ src: src ? (src[1] ?? src[2]) : "", alt: alt ? (alt[1] ?? alt[2]) : undefined });
  }
  return found;
}

function bodyImageRules(root, file, slug, line, image, images) {
  const out = [];
  const add = (level, problem) => out.push({ level, file, rule: "body-image", path: `line ${line}`, problem });
  const src = q(image.src);
  if (image.alt === undefined) add("FAIL", `image ${src} has no alt attribute`);
  else if (!image.alt.trim()) add("FAIL", `image ${src} has an empty alt; describe the figure (empty is only for a decorative image)`);
  else if (WEAK_ALT.test(image.alt)) add("FAIL", `image ${src} has the alt ${q(image.alt)}, which names the slot, not the picture`);
  if (!image.src.startsWith("/")) add("FAIL", `image ${src} is not self-hosted; put it under public${BLOG_IMAGES}${slug}/`);
  else {
    images.push({ file, path: `line ${line}`, value: image.src });
    if (!image.src.startsWith(`${BLOG_IMAGES}${slug}/`) && !image.src.startsWith(`${BLOG_IMAGES}ui/`)) add("FAIL", `image ${src} is outside public${BLOG_IMAGES}${slug}/`);
  }
  return out;
}

/** Every site-absolute image reference exists under public/ and is not heavier than the limit. */
function imageRules(root, images) {
  const out = [];
  for (const { file, path: p, value } of images) {
    if (!value.startsWith("/")) {
      out.push({ level: "FAIL", file, rule: "image-exists", path: p, problem: `${q(value)} is not self-hosted; put it under public/images/` });
      continue;
    }
    const target = path.join(root, "public", decodeURIComponent(value));
    if (!fs.existsSync(target)) {
      out.push({ level: "FAIL", file, rule: "image-exists", path: p, problem: `${q(value)} does not exist under public/` });
      continue;
    }
    const bytes = fs.statSync(target).size;
    if (bytes > LIMITS.imageBytes) out.push({ level: "FAIL", file, rule: "image-weight", path: p, problem: `${q(value)} is ${Math.round(bytes / 1024)} KB (over ${Math.round(LIMITS.imageBytes / 1024)} KB; node scripts/optimize-webp.mjs public${path.posix.dirname(value)})` });
  }
  return out;
}

/** public/images/blog/<slug>/ folders without a post, and files in them no post references. */
function orphanRules(root, posts, images) {
  const out = [];
  const dir = path.join(root, "public", BLOG_IMAGES);
  if (!fs.existsSync(dir)) return out;
  const slugs = new Set(posts.map((post) => post.slug));
  const referenced = new Set(images.map((image) => image.value));
  for (const folder of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!folder.isDirectory() || folder.name === "ui") continue;
    const logical = `public${BLOG_IMAGES}${folder.name}`;
    if (!slugs.has(folder.name)) {
      out.push({ level: "WARN", file: logical, rule: "image-orphan", path: "", problem: `no post content/blog/${folder.name}.md for this folder` });
      continue;
    }
    for (const name of fs.readdirSync(path.join(dir, folder.name))) {
      if (!referenced.has(`${BLOG_IMAGES}${folder.name}/${name}`)) out.push({ level: "WARN", file: `${logical}/${name}`, rule: "image-orphan", path: "", problem: "not referenced by any post" });
    }
  }
  return out;
}

const EXTENSIONS = { markdown: [".md", ".mdx"], yaml: [".yaml", ".yml"], json: [".json"] };

// A file collection's translation, content/<stem>.<prefix>.<ext>, by its parts.
const TRANSLATED_FILE = /^(.+)\.([a-z]{2,3}(?:-[a-z0-9]{2,8})*)(\.[a-z]+)$/;

/**
 * Files the loader silently ignores: a wrong extension or a folder inside a
 * collection, an unknown file next to the collections. A declared
 * language's (`locales`) translations, its folder in a folder collection and
 * its VOICE.<prefix>.md are the loader's; another language's are named so.
 */
function strayRules(root, collections, locales) {
  const out = [];
  const content = path.join(root, "content");
  if (!fs.existsSync(content)) return out;
  const defs = Object.entries(collections).map(([, def]) => def);
  const others = (locales?.all ?? []).filter((locale) => !locale.isDefault);
  const prefixes = new Set(others.map((locale) => locale.prefix));
  const files = new Set(defs.filter((def) => def.kind !== "folder").map((def) => def.file));
  const known = new Set([...NOT_CONTENT, ...defs.map((def) => (def.kind === "folder" ? def.dir : def.file)), ...others.flatMap((locale) => [`VOICE.${locale.prefix}.md`, ...defs.filter((def) => def.kind !== "folder").map((def) => locales.collection(def, locale.locale).file)])]);
  const stray = (file, problem) => out.push({ level: "WARN", file, rule: "stray-file", path: "", problem });
  const undeclared = "a translation into a language site.locales does not declare; nothing reads it (docs/locales.md)";
  for (const entry of fs.readdirSync(content, { withFileTypes: true })) {
    if (entry.name.startsWith("_") || known.has(entry.name)) continue;
    const [, stem, , ext] = entry.name.match(TRANSLATED_FILE) ?? [];
    if (entry.isFile() && (files.has(`${stem}${ext}`) || entry.name.startsWith("VOICE."))) stray(`content/${entry.name}`, `is ${undeclared}`);
    else stray(`content/${entry.name}`, entry.isDirectory() ? "is not a collection folder; nothing reads it" : "is not a collection file; nothing reads it");
  }
  for (const def of defs) {
    if (def.kind !== "folder" || !fs.existsSync(path.join(content, def.dir))) continue;
    const extensions = EXTENSIONS[def.format];
    const walk = (dir, language) => {
      for (const entry of fs.readdirSync(path.join(content, dir), { withFileTypes: true })) {
        if (entry.name.startsWith("_")) continue;
        const file = `content/${dir}/${entry.name}`;
        if (entry.isDirectory() && !language && prefixes.has(entry.name)) walk(`${dir}/${entry.name}`, entry.name);
        else if (entry.isDirectory()) stray(file, language || !others.length ? "is a folder; the loader reads only files" : `is a folder; the loader reads only files, and a language's translations, in a folder named its prefix, are site.locales' (${[...prefixes].join(", ")})`);
        else if (!extensions.includes(path.extname(entry.name))) stray(file, `is not a ${extensions.join("/")} file; the loader ignores it`);
      }
    };
    walk(def.dir, null);
  }
  return out;
}

/** `LEVEL file rule: path problem` — one line, greppable back to its cause. */
export const format = ({ level, file, rule, path: p, problem }) => `${level} ${file} ${rule}: ${p ? `${p} ` : ""}${problem}`;
