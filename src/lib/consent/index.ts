// agentic-cms/consent: the visitor's consent choice, provider-neutral. The
// record and its policy (choice.ts) and the store (store.ts) are plain
// functions, safe in a server component and in plain Node; the hooks are a
// "use client" module. An adapter for a tag follows currentDecision() and
// onConsentChange() (agentic-cms/consent/google is one). docs/consent.md is
// the contract.
export { browserStorage, isCurrent, readChoice, writeChoice, type ConsentChoice, type ConsentPolicy, type Decision } from "./choice.ts";
export { currentDecision, onConsentChange, onConsentOpen, openConsent } from "./store.ts";
export { useConsent, useConsentDecision, type ConsentState } from "./hooks.ts";
