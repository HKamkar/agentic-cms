"use client";

import { openConsent } from "agentic-cms/consent";

/** Opens the consent banner again, so a visitor can change or withdraw their choice at any time: a real button, in the look it is given, labelled by the server component that renders it (consentBanner.settings). */
export function CookieSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={openConsent} className={className}>
      {label}
    </button>
  );
}
