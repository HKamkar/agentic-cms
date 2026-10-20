"use client";

import { useEffect, useId, useRef } from "react";
import { useConsent } from "agentic-cms/consent";
import { cx } from "agentic-cms/cx";
import { analytics } from "@/config/analytics";
import { OutlineButton } from "./OutlineButton";
import { panel } from "./Panel";

/**
 * The consent banner, the wireframe's look on agentic-cms/consent: shown
 * until the visitor has chosen, and again when Cookie settings asks. A
 * non-modal dialog fixed at the foot of the viewport — the one overlay the
 * site has, under the skip link — and early in the page, so a keyboard meets
 * it first. The two answers are the same `OutlineButton`, side by side. A
 * first visit's banner leaves focus where it is; a reopened one takes it to
 * the first answer, and a choice hands it back. Nothing renders on the
 * server: the choice lives in the browser. Its words come in as props
 * (consentBanner, from the layout): a client component imports nothing from
 * site.ts, which would ship all of it, the address included, in a bundle.
 */
export function ConsentBanner({ copy }: { copy: { readonly title: string; readonly text: string; readonly decline: string; readonly allow: string } }) {
  const { open, reopened, choose } = useConsent(analytics.consent);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const textId = useId();
  useEffect(() => {
    if (open && reopened) ref.current?.querySelector("button")?.focus();
  }, [open, reopened]);
  if (!open) return null;
  return (
    <div ref={ref} role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={textId} className={cx(panel(), "fixed inset-x-4 bottom-4 z-40 bg-panel p-6 lg:right-auto lg:max-w-md")}>
      <p id={titleId} className="font-label uppercase">
        {copy.title}
      </p>
      <p id={textId} className="mt-2">
        {copy.text}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <OutlineButton label={copy.decline} onClick={() => choose("denied")} />
        <OutlineButton label={copy.allow} onClick={() => choose("granted")} />
      </div>
    </div>
  );
}
