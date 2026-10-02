// A visitor's choice, seeded: localStorage and sessionStorage keys written
// into every page before any of its scripts runs, so a capture, a shot, a
// probe or a sheet shows the site as it looks after that choice (a consent
// banner closed) rather than on a first visit. A fresh browser context has
// empty storage, so whatever a site renders until a choice is stored shows on
// every shot, over whatever lies under it.
//
// The seed is the site's default, src/config/harness.ts (read from the
// directory the command runs in, never from a --ref worktree, so a baseline
// is seeded like the tree it is compared with), then each --storage and
// --session-storage pair over it, key by key; --no-storage drops the site's.
// {now} in a value is the ISO time of the run and {now:ms} its epoch
// milliseconds, replaced once per run so every page sees the same record; the
// template is what a capture records and what a compare checks, so two runs
// at different times are still seeded alike. docs/visual-parity.md has the
// contract.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { suggest } from "./args.mjs";

/** The site's default seed, a file the harness alone reads: the app never imports it, so it never ships and never moves a build file. */
export const SITE_SEED = "src/config/harness.ts";

/** Each storage area, by its key in the site's file, with the flag that adds to it. */
const AREAS = { storage: "storage", sessionStorage: "session-storage" };

export class SeedError extends Error {}

/** A flag's repeated `key=value` pairs as a map, split at the first `=` so a value may hold more. */
export function parsePairs(pairs, flag) {
  const map = {};
  for (const pair of pairs) {
    const at = pair.indexOf("=");
    if (at === -1) throw new SeedError(`--${flag} takes <key>=<value>, not ${pair} (--${flag} consent='{"analytics":"denied"}')`);
    if (at === 0) throw new SeedError(`--${flag} ${pair}: the key before the = is empty`);
    map[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return map;
}

/** One area of the site's file as strings: a string is stored as it is, any other JSON value as its JSON. */
function areaOf(value, area, file) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SeedError(`${file}: harness.${area} is a map of keys to values ({ consent: { analytics: "denied" } })`);
  return Object.fromEntries(Object.entries(value).map(([key, v]) => {
    if (typeof v === "string") return [key, v];
    const json = JSON.stringify(v);
    if (json === undefined) throw new SeedError(`${file}: harness.${area}.${key} is a string or a JSON value, not a ${typeof v}`);
    return [key, json];
  }));
}

/** The site's `harness` export checked: only the areas the harness knows, each a map. */
export function validateSiteSeed(harness, file = SITE_SEED) {
  if (!harness || typeof harness !== "object" || Array.isArray(harness)) throw new SeedError(`${file}: export const harness = { storage: { <key>: <value> }, sessionStorage: { … } }`);
  for (const key of Object.keys(harness)) if (!(key in AREAS)) throw new SeedError(`${file}: harness.${key} is not a setting${suggest(key, Object.keys(AREAS))} (${Object.keys(AREAS).join(", ")})`);
  return Object.fromEntries(Object.keys(AREAS).map((area) => [area, areaOf(harness[area], area, file)]));
}

/** The site's default seed from <root>/src/config/harness.ts, or null when the site has none. */
export async function readSiteSeed(root = process.cwd()) {
  const file = path.join(root, SITE_SEED);
  if (!fs.existsSync(file)) return null;
  await import("./load-ts.mjs");
  let exported;
  try { exported = await import(pathToFileURL(file).href); } catch (error) { throw new SeedError(`${SITE_SEED}: ${error.message}`); }
  if (!("harness" in exported)) throw new SeedError(`${SITE_SEED} exports no harness: export const harness = { storage: { … } }`);
  return validateSiteSeed(exported.harness);
}

const sorted = (map) => Object.fromEntries(Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** The templates a command seeds: the site's maps (unless no-storage), each flag's pairs over them; null when nothing is seeded. */
export function mergeSeed(site, flags = {}) {
  const base = flags["no-storage"] ? null : site;
  const templates = Object.fromEntries(Object.entries(AREAS).map(([area, flag]) => [area, sorted({ ...(base?.[area] ?? {}), ...parsePairs(flags[flag] ?? [], flag) })]));
  return Object.values(templates).some((map) => Object.keys(map).length) ? templates : null;
}

const TOKENS = { "{now}": (now) => now.toISOString(), "{now:ms}": (now) => String(now.getTime()) };
/** A value with its tokens replaced: {now} → the ISO time, {now:ms} → epoch milliseconds. */
export const expand = (text, now) => text.replace(/\{now(?::ms)?\}/g, (token) => TOKENS[token](now));

/** A command's seed: { templates, values, at } — the maps as written, as the page gets them, and the time {now} stands for — or null. */
export async function resolveSeed(flags, { root = process.cwd(), now = new Date() } = {}) {
  const templates = mergeSeed(flags["no-storage"] ? null : await readSiteSeed(root), flags);
  if (!templates) return null;
  const values = Object.fromEntries(Object.entries(templates).map(([area, map]) => [area, Object.fromEntries(Object.entries(map).map(([key, value]) => [key, expand(value, now)]))]));
  return { templates, values, at: now.toISOString() };
}

/** resolveSeed for a script: a SeedError is printed under the command's name and exits 2. */
export async function seedOrExit(flags, command) {
  try { return await resolveSeed(flags); } catch (error) {
    if (!(error instanceof SeedError)) throw error;
    console.error(`${command}: ${error.message}`);
    process.exit(2);
  }
}

/** What a capture's meta.json and a command's --json record: the templates and the time, or null. */
export const seedRecord = (seed) => (seed ? { ...seed.templates, at: seed.at } : null);

/** The templates of a record (absent: an unseeded capture, or one taken before seeds existed), in one comparable form. */
const comparable = (record) => JSON.stringify(Object.keys(AREAS).map((area) => sorted(record?.[area] ?? {})));

/** Whether two records seed alike: the same keys and templates; when {now} was replaced does not count. */
export const sameSeed = (a, b) => comparable(a) === comparable(b);

/** A record in a line: "storage consent=…; sessionStorage x=…", or "no seed". */
export function seedLine(record) {
  const parts = Object.keys(AREAS).map((area) => [area, Object.entries(record?.[area] ?? {})]).filter(([, entries]) => entries.length).map(([area, entries]) => `${area} ${entries.map(([k, v]) => `${k}=${v}`).join(", ")}`);
  return parts.length ? parts.join("; ") : "no seed";
}

/**
 * In the page (context.addInitScript), before any of its scripts: the seed's values written into the top
 * document's storage. At every document start, so every page of a run begins from the same storage whatever
 * the one before it wrote; the top frame alone, so another origin's frame is left as it is; an opaque origin
 * (about:blank), which has no storage, is passed over.
 */
export const SEED_STORAGE = ({ storage, sessionStorage }) => {
  if (window.top !== window) return;
  const write = (area, map) => { try { for (const [key, value] of Object.entries(map)) window[area].setItem(key, value); } catch { /* no storage on this origin */ } };
  write("localStorage", storage);
  write("sessionStorage", sessionStorage);
};
