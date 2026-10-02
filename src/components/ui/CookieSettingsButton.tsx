"use client";

import { openConsent } from "agentic-cms/consent";
import { consentBanner } from "@/config/site";

/** Opens the consent banner again, so a visitor can change or withdraw their choice at any time: a real button, in the look it is given. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openConsent} className={className}>
      {consentBanner.settings}
    </button>
  );
}
