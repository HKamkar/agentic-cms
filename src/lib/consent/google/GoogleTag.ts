"use client";
// The Google tag as a component a server layout renders with plain data: it
// connects the page once (tag.ts) and renders nothing.
import { useEffect } from "react";
import type { ConsentPolicy } from "../choice.ts";
import type { GoogleTagMode } from "./consent-mode.ts";
import { connectGoogleTag } from "./tag.ts";

export type GoogleTagProps = {
  /** The Google tag id ("G-…", a GA4 web data stream's measurement id). */
  tagId: string;
  /** The same policy the page's consent default script was built from. */
  policy: ConsentPolicy;
  /** "basic" (the default): nothing reaches Google before the visitor grants analytics. */
  mode?: GoogleTagMode;
};

export function GoogleTag({ tagId, policy, mode = "basic" }: GoogleTagProps) {
  const { storageKey, version, maxAgeDays } = policy;
  useEffect(() => connectGoogleTag({ tagId, policy: { storageKey, version, maxAgeDays }, mode }), [tagId, storageKey, version, maxAgeDays, mode]);
  return null;
}
