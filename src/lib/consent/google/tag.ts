// Loads the Google tag behind the visitor's choice, outside React. One function
// owns the order a page's signals reach the dataLayer — the choice first, the
// tag's config after — whatever set it off: this tab's choice, another tab's,
// a tag connected after a choice. A component's effects cannot promise that
// order, since another tab's storage event lets React re-render between two
// listeners. Once connected a page stays connected: a refusal has to reach a
// tag that is already running even when the component that loaded it is gone,
// so the subscription is never undone, and a second connect (React's double
// effects in development, a second component) does nothing.
import type { ConsentPolicy, Decision } from "../choice.ts";
import { currentDecision, onConsentChange } from "../store.ts";
import { gtag, updateGoogleConsent, type GoogleTagMode } from "./consent-mode.ts";

export type GoogleTagOptions = { tagId: string; policy: ConsentPolicy; mode?: GoogleTagMode };

const TAG_SRC = "https://www.googletagmanager.com/gtag/js?id=";

type TagWindow = Window & { dataLayer?: ArrayLike<unknown>[]; agenticCmsGoogleTags?: Set<string> };

/** Connects the page to the tag once per tag id: sends the choice in force, loads the tag when allowed, and follows every later change in that order. */
export function connectGoogleTag({ tagId, policy, mode = "basic" }: GoogleTagOptions): void {
  const w = window as TagWindow;
  const connected = (w.agenticCmsGoogleTags ??= new Set());
  if (connected.has(tagId)) return;
  connected.add(tagId);
  const follow = (decision: Decision | null, withdrawn: boolean) => {
    // A choice withdrawn (cleared in another tab, or expired) is a refusal; no choice yet is the default's.
    const analytics = decision ?? (withdrawn ? "denied" : null);
    if (analytics) updateGoogleConsent(analytics, tagId, mode);
    if (analytics === "granted" || mode === "advanced") loadTag(tagId);
  };
  follow(currentDecision(policy), false);
  onConsentChange(policy, (decision) => follow(decision, true));
}

/** Whether the page's consent default is on the dataLayer: without it the tag would read every type granted. */
const hasConsentDefault = (w: TagWindow) => Array.from(w.dataLayer ?? []).some((entry) => entry[0] === "consent" && entry[1] === "default");

/**
 * Puts the tag on the page once: its two commands on the dataLayer, then
 * gtag.js — what @next/third-parties' GoogleAnalytics does. It refuses, and
 * says so, when the consent default is missing.
 */
function loadTag(tagId: string, doc: Document = document): void {
  if (Array.from(doc.scripts).some((script) => script.dataset.gtag === tagId)) return;
  if (!hasConsentDefault(window as TagWindow)) {
    console.error(`agentic-cms/consent/google: no consent default on the dataLayer, so the tag ${tagId} is not loaded; render consentDefaultScript(policy) as an inline script near the top of <body> (docs/consent.md)`);
    return;
  }
  gtag("js", new Date());
  gtag("config", tagId);
  const script = doc.createElement("script");
  script.async = true;
  script.src = TAG_SRC + encodeURIComponent(tagId);
  script.dataset.gtag = tagId;
  doc.head.appendChild(script);
}
