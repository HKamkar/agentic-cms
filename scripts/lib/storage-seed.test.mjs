import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SEED_STORAGE, SeedError, expand, mergeSeed, parsePairs, readSiteSeed, resolveSeed, sameSeed, seedLine, seedRecord, validateSiteSeed } from "./storage-seed.mjs";

const NOW = new Date("2026-10-02T12:00:00.000Z");
const CONSENT = '{"analytics":"denied","at":"{now}","version":1}';

test("a pair splits at its first =, so a value may hold more; an empty value is kept", () => {
  assert.deepEqual(parsePairs(["consent=" + CONSENT, "q=a=b", "empty="], "storage"), { consent: CONSENT, q: "a=b", empty: "" });
  assert.deepEqual(parsePairs([], "storage"), {});
});

test("a pair without = or without a key is a SeedError that names the flag and its form", () => {
  assert.throws(() => parsePairs(["consent"], "storage"), (error) => error instanceof SeedError && /--storage takes <key>=<value>, not consent/.test(error.message));
  assert.throws(() => parsePairs(["=x"], "session-storage"), (error) => error instanceof SeedError && /--session-storage =x: the key before the = is empty/.test(error.message));
});

test("the site's map, then each flag over it key by key; --no-storage drops the site's; nothing seeded is null", () => {
  const site = { storage: { consent: "site", theme: "dark" }, sessionStorage: { tab: "2" } };
  assert.deepEqual(mergeSeed(site, { storage: ["consent=flag"] }), { storage: { consent: "flag", theme: "dark" }, sessionStorage: { tab: "2" } });
  assert.deepEqual(mergeSeed(site, { "no-storage": true, "session-storage": ["x=1"] }), { storage: {}, sessionStorage: { x: "1" } });
  assert.equal(mergeSeed(site, { "no-storage": true }), null);
  assert.equal(mergeSeed(null, {}), null);
  assert.deepEqual(Object.keys(mergeSeed(null, { storage: ["b=1", "a=2"] }).storage), ["a", "b"], "keys sorted, so the record does not depend on their order");
});

test("{now} is the ISO time and {now:ms} its epoch milliseconds, every occurrence; other braces stay", () => {
  assert.equal(expand(CONSENT, NOW), '{"analytics":"denied","at":"2026-10-02T12:00:00.000Z","version":1}');
  assert.equal(expand("{now:ms}|{now}|{later}", NOW), `${NOW.getTime()}|2026-10-02T12:00:00.000Z|{later}`);
});

test("a resolved seed keeps the templates, gives the page the values and records the time once", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "seed-none-"));
  try {
    const seed = await resolveSeed({ storage: ["consent=" + CONSENT], "session-storage": ["at={now:ms}"] }, { root, now: NOW });
    assert.deepEqual(seed.templates, { storage: { consent: CONSENT }, sessionStorage: { at: "{now:ms}" } });
    assert.deepEqual(seed.values, { storage: { consent: expand(CONSENT, NOW) }, sessionStorage: { at: String(NOW.getTime()) } });
    assert.equal(seed.at, NOW.toISOString());
    assert.deepEqual(seedRecord(seed), { storage: { consent: CONSENT }, sessionStorage: { at: "{now:ms}" }, at: NOW.toISOString() });
    assert.equal(seedRecord(null), null);
    assert.equal(await resolveSeed({}, { root, now: NOW }), null, "no site file and no flag: no seed");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("the site's src/config/harness.ts is read: an object value is stored as its JSON, a string as it is; --no-storage never reads it", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "seed-site-"));
  try {
    fs.mkdirSync(path.join(root, "src/config"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/config/harness.ts"), `// a comment the harness skips\ntype Seed = Record<string, unknown>;\nexport const harness: { storage: Seed } = { storage: { consent: { analytics: "denied", at: "{now}", version: 1 }, theme: "dark" } };\n`);
    assert.deepEqual(await readSiteSeed(root), { storage: { consent: CONSENT, theme: "dark" }, sessionStorage: {} });
    const seed = await resolveSeed({ storage: ["theme=light"] }, { root, now: NOW });
    assert.deepEqual(seed.templates.storage, { consent: CONSENT, theme: "light" });
    fs.writeFileSync(path.join(root, "src/config/harness.ts"), "this is not TypeScript (");
    assert.equal(await resolveSeed({ "no-storage": true }, { root, now: NOW }), null, "a broken file is not even read under --no-storage");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a site file that exports no harness, or a harness of the wrong shape, is a SeedError naming the file and the fix", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "seed-bad-"));
  try {
    fs.mkdirSync(path.join(root, "src/config"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/config/harness.ts"), "export const other = 1;\n");
    await assert.rejects(readSiteSeed(root), (error) => error instanceof SeedError && /src\/config\/harness\.ts exports no harness/.test(error.message));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  assert.throws(() => validateSiteSeed({ localStorage: {} }), (error) => error instanceof SeedError && /harness\.localStorage is not a setting \(storage, sessionStorage\)/.test(error.message));
  assert.throws(() => validateSiteSeed({ storag: {} }), (error) => /harness\.storag is not a setting — did you mean storage\?/.test(error.message));
  assert.throws(() => validateSiteSeed({ storage: ["a"] }), (error) => /harness\.storage is a map of keys to values/.test(error.message));
  assert.throws(() => validateSiteSeed({ storage: { a: () => 1 } }), (error) => /harness\.storage\.a is a string or a JSON value, not a function/.test(error.message));
  assert.throws(() => validateSiteSeed([]), (error) => /export const harness = /.test(error.message));
  assert.deepEqual(validateSiteSeed({ storage: { n: 1, b: false, o: null } }), { storage: { n: "1", b: "false", o: "null" }, sessionStorage: {} });
});

test("two records seed alike when their keys and templates agree, whatever the time and the order; absent is no seed", () => {
  const a = { storage: { consent: CONSENT, theme: "dark" }, sessionStorage: {}, at: "2026-10-01T00:00:00.000Z" };
  const b = { storage: { theme: "dark", consent: CONSENT }, at: "2026-10-02T00:00:00.000Z" };
  assert.ok(sameSeed(a, b));
  assert.ok(sameSeed(undefined, null), "two unseeded captures, one taken before seeds existed");
  assert.ok(sameSeed(undefined, { storage: {}, sessionStorage: {} }));
  assert.ok(!sameSeed(a, undefined));
  assert.ok(!sameSeed(a, { storage: { consent: CONSENT, theme: "light" } }));
  assert.ok(!sameSeed({ storage: { k: "v" } }, { sessionStorage: { k: "v" } }), "the area counts");
  assert.equal(seedLine(a), `storage consent=${CONSENT}, theme=dark`);
  assert.equal(seedLine({ storage: { a: "1" }, sessionStorage: { b: "2" } }), "storage a=1; sessionStorage b=2");
  assert.equal(seedLine(undefined), "no seed");
});

/** A window as the init script sees it: its storage areas, and whether it is the top frame or opaque. */
function fakeWindow({ top = true, opaque = false } = {}) {
  const area = () => { const items = new Map(); return { setItem: (k, v) => items.set(k, v), items }; };
  const areas = { localStorage: area(), sessionStorage: area() };
  const win = {};
  for (const name of Object.keys(areas)) Object.defineProperty(win, name, { get: () => { if (opaque) throw new Error("SecurityError"); return areas[name]; } });
  win.top = top ? win : {};
  return { win, areas };
}
const inWindow = (win, fn) => { const saved = globalThis.window; globalThis.window = win; try { fn(); } finally { if (saved === undefined) delete globalThis.window; else globalThis.window = saved; } };

test("the init script writes both areas in the top frame, overwriting what a page wrote; passes over a frame and an opaque origin", () => {
  const values = { storage: { consent: "x" }, sessionStorage: { tab: "1" } };
  const top = fakeWindow();
  top.areas.localStorage.items.set("consent", "written by a page");
  inWindow(top.win, () => SEED_STORAGE(values));
  assert.equal(top.areas.localStorage.items.get("consent"), "x");
  assert.equal(top.areas.sessionStorage.items.get("tab"), "1");
  const frame = fakeWindow({ top: false });
  inWindow(frame.win, () => SEED_STORAGE(values));
  assert.equal(frame.areas.localStorage.items.size, 0, "another frame is left as it is");
  const opaque = fakeWindow({ opaque: true });
  assert.doesNotThrow(() => inWindow(opaque.win, () => SEED_STORAGE(values)));
});
