// The stored choice and the store: the record's checks, a storage that refuses,
// and the changes an adapter follows — this tab's, another tab's, a cleared
// storage — on a window made of an EventTarget.
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isCurrent, readChoice, writeChoice, type ConsentPolicy, type Decision } from "./choice.ts";
import { useConsent } from "./hooks.ts";
import { currentDecision, onConsentChange, onConsentOpen, openConsent, recordDecision } from "./store.ts";

const policy: ConsentPolicy = { storageKey: "consent", version: 2, maxAgeDays: 365 };
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const stored = (value: unknown) => ({ getItem: () => JSON.stringify(value) });

describe("the stored choice", () => {
  test("a choice under this version, inside its age, is current", () => {
    assert.equal(readChoice(stored({ analytics: "granted", at: ago(1), version: 2 }), policy)?.analytics, "granted");
    assert.equal(readChoice(stored({ analytics: "denied", at: ago(364), version: 2 }), policy)?.analytics, "denied");
  });

  test("an older version, an expired, future or malformed record, or none, is no choice", () => {
    for (const value of [
      { analytics: "granted", at: ago(1), version: 1 },
      { analytics: "granted", at: ago(1), version: "2" },
      { analytics: "granted", at: ago(366), version: 2 },
      { analytics: "granted", at: ago(-1), version: 2 },
      { analytics: "maybe", at: ago(1), version: 2 },
      { analytics: "denied", version: 2 },
      { analytics: "denied", at: "not a date", version: 2 },
      null,
      5,
    ]) assert.equal(isCurrent(value, policy, Date.now()), false, JSON.stringify(value));
    assert.equal(readChoice({ getItem: () => "{not json" }, policy), null);
    assert.equal(readChoice(undefined, policy), null);
    assert.equal(readChoice({ getItem: () => { throw new Error("blocked"); } }, policy), null);
  });

  test("writing stores the decision, the time and the version, in that order, and survives a storage that refuses", () => {
    let written = "";
    const now = new Date("2026-10-02T12:00:00.000Z");
    writeChoice({ setItem: (key, value) => { assert.equal(key, "consent"); written = value; } }, policy, "denied", now);
    assert.equal(written, '{"analytics":"denied","at":"2026-10-02T12:00:00.000Z","version":2}');
    assert.deepEqual(writeChoice({ setItem: () => { throw new Error("full"); } }, policy, "granted", now), { analytics: "granted", at: now.toISOString(), version: 2 });
  });
});

/** A browser window as the store sees it: an EventTarget with a localStorage that may refuse writes. */
function fakeWindow({ refuse = false } = {}) {
  const items = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { if (refuse) throw new Error("blocked"); items.set(key, value); },
    clear: () => items.clear(),
  };
  return Object.assign(new EventTarget(), { localStorage, items });
}
/** Another tab's write, as the storage event delivers it: the key, or null for a cleared storage. */
const storageEvent = (key: string | null) => Object.assign(new Event("storage"), { key });

describe("the store", () => {
  afterEach(() => { delete (globalThis as Record<string, unknown>).window; });

  test("a recorded decision is stored, in force, and announced to this tab before recordDecision returns", () => {
    const win = fakeWindow();
    Object.assign(globalThis, { window: win });
    const seen: (Decision | null)[] = [];
    const stop = onConsentChange(policy, (decision) => seen.push(decision));
    assert.equal(currentDecision(policy), null);
    recordDecision(policy, "granted");
    assert.deepEqual(seen, ["granted"]);
    assert.equal(JSON.parse(win.items.get("consent") ?? "{}").analytics, "granted");
    stop();
    recordDecision(policy, "denied");
    assert.deepEqual(seen, ["granted"], "unsubscribed");
  });

  test("a decision the browser will not store holds for the page", () => {
    Object.assign(globalThis, { window: fakeWindow({ refuse: true }) });
    // a key of its own: the memory lasts as long as the module, which is the page in a browser and this file here
    const refused = { ...policy, storageKey: "refused" };
    recordDecision(refused, "denied");
    assert.equal(currentDecision(refused), "denied");
  });

  test("another tab's change and a storage cleared there reach the listener; other keys do not", () => {
    const win = fakeWindow();
    Object.assign(globalThis, { window: win });
    const seen: (Decision | null)[] = [];
    onConsentChange(policy, (decision) => seen.push(decision));
    win.items.set("consent", JSON.stringify({ analytics: "granted", at: ago(0), version: 2 }));
    win.dispatchEvent(storageEvent("consent"));
    win.dispatchEvent(storageEvent("theme"));
    win.localStorage.clear();
    win.dispatchEvent(storageEvent(null));
    assert.deepEqual(seen, ["granted", null], "a cleared storage withdraws the choice");
  });

  test("openConsent reaches every listener until it unsubscribes", () => {
    Object.assign(globalThis, { window: fakeWindow() });
    let opened = 0;
    const stop = onConsentOpen(() => opened++);
    openConsent();
    stop();
    openConsent();
    assert.equal(opened, 1);
  });
});

test("on the server a banner is closed and the decision unknown: a choice lives in the browser alone", () => {
  const Probe = () => { const { open, decision } = useConsent(policy); return h("p", null, `${open} ${decision}`); };
  assert.equal(renderToStaticMarkup(h(Probe)), "<p>false unknown</p>");
});
