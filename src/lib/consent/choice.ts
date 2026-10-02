// The visitor's consent choice, kept in their own browser: a decision, when it
// was made, and under which version of the site's question. Provider-neutral:
// what a tag does with it is an adapter's (agentic-cms/consent/google). The
// record is also the proof of consent a site keeps — the time and the version,
// whose wording is in the site's history — so nothing is logged on a server.
// Server-safe: storage and the clock are parameters.

export type Decision = "granted" | "denied";

export type ConsentChoice = {
  readonly analytics: Decision;
  /** When the choice was made, ISO 8601. */
  readonly at: string;
  /** The policy version it was made under. */
  readonly version: number;
};

export type ConsentPolicy = {
  /** The localStorage key the choice is kept under; the site's cookie notice names it. */
  readonly storageKey: string;
  /** Raised when what the site asks changes: every stored choice stops counting and everyone is asked again. */
  readonly version: number;
  /** How long a choice counts before the visitor is asked again. */
  readonly maxAgeDays: number;
};

const DAY = 24 * 60 * 60 * 1000;

const isDecision = (value: unknown): value is Decision => value === "granted" || value === "denied";

/** Whether a stored value is a choice made under this policy's version, inside its age (a time in the future is not). */
export function isCurrent(value: unknown, policy: ConsentPolicy, now: number): value is ConsentChoice {
  if (typeof value !== "object" || value === null) return false;
  const { analytics, at, version } = value as Record<string, unknown>;
  if (!isDecision(analytics) || version !== policy.version || typeof at !== "string") return false;
  const age = now - Date.parse(at);
  return age >= 0 && age < policy.maxAgeDays * DAY;
}

/** The stored choice, or null: none yet, unreadable, from an older version or expired — the site asks again. */
export function readChoice(storage: Pick<Storage, "getItem"> | undefined, policy: ConsentPolicy, now = Date.now()): ConsentChoice | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(policy.storageKey) ?? "null");
    return isCurrent(value, policy, now) ? value : null;
  } catch {
    return null;
  }
}

/** Stores a choice and returns it; a browser that refuses storage leaves it unstored (the caller keeps it for the page). */
export function writeChoice(storage: Pick<Storage, "setItem"> | undefined, policy: ConsentPolicy, analytics: Decision, now = new Date()): ConsentChoice {
  const choice: ConsentChoice = { analytics, at: now.toISOString(), version: policy.version };
  try {
    storage?.setItem(policy.storageKey, JSON.stringify(choice));
  } catch {
    // Storage disabled or full: the choice still applies to this page.
  }
  return choice;
}

/** The browser's localStorage, or undefined where reading it throws (blocked site data) or there is no browser. */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
