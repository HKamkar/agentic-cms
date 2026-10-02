// Google consent mode v2: the inline default script, run as the browser runs it
// (node:vm, a fresh realm), agreeing with readChoice on every record; the
// update in both modes; the cookies; and connectGoogleTag's order — the choice
// on the dataLayer before the tag's config — on a fake window and document.
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import vm from "node:vm";
import { readChoice, type ConsentPolicy } from "../choice.ts";
import { recordDecision } from "../store.ts";
import { clearGoogleCookies, consentDefaultScript, updateGoogleConsent } from "./consent-mode.ts";
import { connectGoogleTag } from "./tag.ts";

const policy: ConsentPolicy = { storageKey: "consent", version: 2, maxAgeDays: 365 };
const TAG = "G-TEST000000";
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const record = (analytics: string, days = 1, version: unknown = 2) => JSON.stringify({ analytics, at: ago(days), version });

/** A cookie jar that records every write and drops a cookie written with Max-Age=0. */
function jar(names: string[]) {
  const cookies = new Map(names.map((name) => [name, "1"]));
  const writes: string[] = [];
  return {
    cookies,
    writes,
    get cookie() { return [...cookies].map(([name, value]) => `${name}=${value}`).join("; "); },
    set cookie(value: string) {
      writes.push(value);
      const [pair, ...attributes] = value.split(";");
      const name = pair.split("=")[0].trim();
      if (attributes.some((a) => a.trim().toLowerCase() === "max-age=0")) cookies.delete(name);
      else cookies.set(name, pair.split("=")[1]);
    },
  };
}

/** The dataLayer as plain arrays (it holds Arguments objects). */
const commands = (dataLayer: unknown) => JSON.parse(JSON.stringify(((dataLayer ?? []) as ArrayLike<unknown>[]).map((entry) => Array.from(entry)))) as unknown[][];
const updates = (dataLayer: unknown[][]) => dataLayer.filter(([command, type]) => command === "consent" && type === "update");

/** Runs the default script as a page's first script would; `item` is what localStorage holds (an Error: reading it throws). */
function runDefault(item: string | null | Error, cookies: string[] = [], forPolicy = policy) {
  const doc = jar(cookies);
  const keys: string[] = [];
  const getItem = (key: string) => { keys.push(key); if (item instanceof Error) throw item; return key === forPolicy.storageKey ? item : null; };
  const context: Record<string, unknown> = { location: { hostname: "www.example.com" }, document: doc, localStorage: { getItem } };
  context.window = context;
  vm.runInNewContext(consentDefaultScript(forPolicy), context);
  return { dataLayer: commands(context.dataLayer), doc, keys };
}

describe("the consent default script", () => {
  const DEFAULT = ["consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" }];

  test("every type starts denied and ad data redacted, before anything else, and Google's cookies go", () => {
    const { dataLayer, doc } = runDefault(null, ["_ga", "_ga_TEST000000", "session"]);
    assert.deepEqual(dataLayer, [DEFAULT, ["set", "ads_data_redaction", true]]);
    assert.deepEqual([...doc.cookies.keys()], ["session"]);
  });

  test("a current choice is sent as an update at once; a grant keeps the cookies, a refusal does not", () => {
    const granted = runDefault(record("granted"), ["_ga"]);
    assert.deepEqual(updates(granted.dataLayer), [["consent", "update", { analytics_storage: "granted" }]]);
    assert.deepEqual([...granted.doc.cookies.keys()], ["_ga"]);
    const denied = runDefault(record("denied"), ["_ga"]);
    assert.deepEqual(updates(denied.dataLayer), [["consent", "update", { analytics_storage: "denied" }]]);
    assert.deepEqual([...denied.doc.cookies.keys()], []);
  });

  test("an expired or older choice sends no update and the cookies go; a storage that throws still gets the default", () => {
    assert.deepEqual(updates(runDefault(record("granted", 366)).dataLayer), []);
    assert.deepEqual([...runDefault(record("granted", 1, 1), ["_ga"]).doc.cookies.keys()], []);
    assert.deepEqual(runDefault(new Error("blocked")).dataLayer, [DEFAULT, ["set", "ads_data_redaction", true]]);
  });

  test("a storage key cannot close the script element, and the script still reads it", () => {
    const odd: ConsentPolicy = { ...policy, storageKey: "</script>\u2028<!--" };
    const text = consentDefaultScript(odd);
    assert.ok(!text.includes("</script>") && !text.includes("\u2028") && !text.includes("<!--"), text);
    assert.deepEqual(runDefault(null, [], odd).keys, [odd.storageKey]);
  });

  test("the script and readChoice agree on every stored record", () => {
    for (const value of [record("granted"), record("denied", 300), record("granted", 366), record("granted", -2), record("granted", 1, "2"), record("yes"), JSON.stringify({ analytics: "granted", at: 5, version: 2 }), "5", "[]", "null"]) {
      const fromScript = updates(runDefault(value).dataLayer)[0]?.[2] ?? null;
      const fromChoice = readChoice({ getItem: () => value }, policy);
      assert.deepEqual(fromScript, fromChoice && { analytics_storage: fromChoice.analytics }, value);
    }
  });
});

test("Google's cookies are cleared on the host and each parent domain, and no other cookie", () => {
  const doc = jar(["_ga", "_ga_TEST000000", "session"]);
  clearGoogleCookies(doc, "www.example.com");
  assert.deepEqual([...doc.cookies.keys()], ["session"]);
  assert.deepEqual(doc.writes.filter((w) => w.startsWith("_ga=")), ["_ga=;Max-Age=0;path=/;domain=.www.example.com", "_ga=;Max-Age=0;path=/;domain=.example.com", "_ga=;Max-Age=0;path=/"]);
});

/** A page for the tag: window (an EventTarget with storage and a dataLayer), document (scripts, cookies), location. */
function page({ stored = null as string | null, withDefault = true, cookies = ["_ga"], refuse = false } = {}) {
  const items = new Map<string, string>(stored ? [[policy.storageKey, stored]] : []);
  const localStorage = { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { if (refuse) throw new Error("blocked"); items.set(key, value); }, clear: () => items.clear() };
  const win = Object.assign(new EventTarget(), { localStorage, dataLayer: [] as unknown[] }) as unknown as EventTarget & Record<string, unknown>;
  if (withDefault) vm.runInNewContext(consentDefaultScript(policy), { window: win, localStorage, location: { hostname: "example.com" }, document: { cookie: "" } });
  const scripts: Record<string, unknown>[] = [];
  const doc = Object.assign(jar(cookies), { scripts, createElement: () => ({ dataset: {} }), head: { appendChild: (el: Record<string, unknown>) => { scripts.push(el); win.dataLayer = [...(win.dataLayer as unknown[]), ["(gtag.js loaded)"]]; } } });
  Object.assign(globalThis, { window: win, document: doc, location: { hostname: "example.com" } });
  return { win, doc, items, sent: () => commands(win.dataLayer).map(label) };
}
/** A dataLayer command in a word or three: "consent update granted", "set ads_data_redaction", "js", "config". */
const label = ([command, what, value]: unknown[]) => (command === "consent" ? `consent ${what}${what === "update" ? ` ${(value as Record<string, string>).analytics_storage}` : ""}` : command === "set" ? `set ${what}` : String(command));
const storageEvent = (key: string | null) => Object.assign(new Event("storage"), { key });

describe("connectGoogleTag", () => {
  afterEach(() => { for (const key of ["window", "document", "location"]) delete (globalThis as Record<string, unknown>)[key]; });

  test("before a choice, basic mode loads nothing; a grant sends the update, then the tag's config, then gtag.js; connecting twice changes nothing", () => {
    const { doc, sent } = page();
    connectGoogleTag({ tagId: TAG, policy });
    connectGoogleTag({ tagId: TAG, policy });
    assert.deepEqual(sent(), ["consent default", "set ads_data_redaction"]);
    recordDecision(policy, "granted");
    assert.deepEqual(sent(), ["consent default", "set ads_data_redaction", "consent update granted", "js", "config", "(gtag.js loaded)"]);
    assert.equal(doc.scripts.length, 1);
    assert.equal(doc.scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${TAG}`);
  });

  test("another tab's grant: the update before the config; that tab's clear() later: a refusal that switches the tag off and clears the cookies", () => {
    const { win, doc, items, sent } = page();
    connectGoogleTag({ tagId: TAG, policy });
    items.set(policy.storageKey, record("granted", 0));
    win.dispatchEvent(storageEvent(policy.storageKey));
    assert.deepEqual(sent().slice(2), ["consent update granted", "js", "config", "(gtag.js loaded)"]);
    items.clear();
    win.dispatchEvent(storageEvent(null));
    assert.equal(win[`ga-disable-${TAG}`], true);
    assert.equal(sent().at(-1), "consent update denied");
    assert.deepEqual([...doc.cookies.keys()], []);
  });

  test("a choice already in force is sent before the tag loads: a returning visitor, and one held in memory", () => {
    const returning = page({ stored: record("granted") });
    connectGoogleTag({ tagId: TAG, policy });
    assert.deepEqual(returning.sent(), ["consent default", "set ads_data_redaction", "consent update granted", "consent update granted", "js", "config", "(gtag.js loaded)"], "the script's replay, then connect's");
    // a browser that refused to store the grant made on this page: the default script could not replay it, connect does
    const unstored = page({ refuse: true });
    const memory = { ...policy, storageKey: "held-in-memory" };
    recordDecision(memory, "granted");
    connectGoogleTag({ tagId: TAG, policy: memory });
    assert.deepEqual(unstored.sent(), ["consent default", "set ads_data_redaction", "consent update granted", "js", "config", "(gtag.js loaded)"]);
  });

  test("advanced mode loads at once, after the default; a refusal clears the cookies but leaves the tag on", () => {
    const { win, doc, sent } = page();
    connectGoogleTag({ tagId: TAG, policy, mode: "advanced" });
    assert.deepEqual(sent(), ["consent default", "set ads_data_redaction", "js", "config", "(gtag.js loaded)"]);
    recordDecision(policy, "denied");
    assert.equal(win[`ga-disable-${TAG}`], undefined);
    assert.equal(sent().at(-1), "consent update denied");
    assert.deepEqual([...doc.cookies.keys()], []);
  });

  test("without the consent default the tag is not loaded, and the console says why", () => {
    const { doc } = page({ withDefault: false });
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { errors.push(args.join(" ")); };
    try { connectGoogleTag({ tagId: TAG, policy, mode: "advanced" }); } finally { console.error = original; }
    assert.equal(doc.scripts.length, 0);
    assert.match(String(errors[0]), /no consent default on the dataLayer/);
  });
});

test("updateGoogleConsent: basic mode switches a loaded tag off on refusal and on again on grant; the cookies go on refusal", () => {
  const { win, doc, sent } = page();
  updateGoogleConsent("denied", TAG);
  assert.equal(win[`ga-disable-${TAG}`], true);
  assert.deepEqual([...doc.cookies.keys()], []);
  updateGoogleConsent("granted", TAG);
  assert.equal(win[`ga-disable-${TAG}`], false);
  assert.deepEqual(sent().slice(-2), ["consent update denied", "consent update granted"]);
  for (const key of ["window", "document", "location"]) delete (globalThis as Record<string, unknown>)[key];
});
