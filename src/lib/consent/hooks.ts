"use client";
// The React side of the consent store (store.ts): the decision in force and a
// banner's state. The store does the work; these bind it to rendering. The
// policy is plain data, so a component rendered from a server layout passes
// it as a prop; its fields, not its identity, decide when to resubscribe.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ConsentPolicy, Decision } from "./choice.ts";
import { currentDecision, onConsentChange, onConsentOpen, recordDecision } from "./store.ts";

/** The decision in force; "none" before a choice; "unknown" while the server renders (a choice lives in the browser alone). */
export type ConsentState = Decision | "none" | "unknown";

const onServer = (): ConsentState => "unknown";

/** The decision in force, kept in step with this tab's choices and other tabs'. */
export function useConsentDecision(policy: ConsentPolicy): ConsentState {
  const { storageKey, version, maxAgeDays } = policy;
  const subscribe = useCallback((onChange: () => void) => onConsentChange({ storageKey, version, maxAgeDays }, onChange), [storageKey, version, maxAgeDays]);
  const read = useCallback((): ConsentState => currentDecision({ storageKey, version, maxAgeDays }) ?? "none", [storageKey, version, maxAgeDays]);
  return useSyncExternalStore(subscribe, read, onServer);
}

/**
 * A consent banner's state: `open` while there is no choice in force, and
 * again when openConsent() asks (`reopened`, which is when a banner takes
 * focus). `choose` records the decision — adapters act on it before this
 * returns — closes the banner and hands focus back to what opened it.
 */
export function useConsent(policy: ConsentPolicy) {
  const decision = useConsentDecision(policy);
  const [reopened, setReopened] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => onConsentOpen(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setReopened(true);
  }), []);

  const choose = (choice: Decision) => {
    recordDecision(policy, choice);
    setReopened(false);
    opener.current?.focus();
    opener.current = null;
  };

  return { open: decision === "none" || reopened, reopened, decision, choose };
}
