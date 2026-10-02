// The choice in force on this page and its changes: what the hooks render from
// and what an adapter (a tag) follows. The choice is read from storage each
// time, since another tab may have written it; one the browser refused to
// store (blocked site data) is kept in memory for this page. A change made here
// is announced to this tab at once and synchronously, so an adapter acts on it
// before React re-renders; another tab's arrives through the storage event,
// a storage cleared there (key null) included. Touches window only when called.
import { browserStorage, readChoice, writeChoice, type ConsentPolicy, type Decision } from "./choice.ts";

const CHANGE = "agentic-cms:consent-change";
const OPEN = "agentic-cms:consent-open";

// A choice made on this page that the browser did not store, by storage key: it holds until the next load.
const unstored = new Map<string, Decision>();

/** The decision in force: the stored choice, else one made on this page that could not be stored, else null (no choice yet, or it expired). */
export function currentDecision(policy: ConsentPolicy): Decision | null {
  return readChoice(browserStorage(), policy)?.analytics ?? unstored.get(policy.storageKey) ?? null;
}

/** Calls the listener with the decision in force whenever it changes, on this page or in another tab; returns the unsubscribe. */
export function onConsentChange(policy: ConsentPolicy, listener: (decision: Decision | null) => void): () => void {
  const onChange = (event: Event) => {
    if ((event as CustomEvent<string>).detail === policy.storageKey) listener(currentDecision(policy));
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === policy.storageKey) listener(currentDecision(policy));
  };
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stores a decision, in memory when the browser will not, and announces it to this tab's listeners before returning. */
export function recordDecision(policy: ConsentPolicy, decision: Decision): void {
  const storage = browserStorage();
  writeChoice(storage, policy, decision);
  if (readChoice(storage, policy)?.analytics === decision) unstored.delete(policy.storageKey);
  else unstored.set(policy.storageKey, decision);
  window.dispatchEvent(new CustomEvent(CHANGE, { detail: policy.storageKey }));
}

/** Asks the site's consent banner to open again, from anywhere on the page (a "Cookie settings" button). */
export function openConsent(): void {
  window.dispatchEvent(new Event(OPEN));
}

/** Calls the listener whenever openConsent() is called; returns the unsubscribe. */
export function onConsentOpen(listener: () => void): () => void {
  window.addEventListener(OPEN, listener);
  return () => window.removeEventListener(OPEN, listener);
}
