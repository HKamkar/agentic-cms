"use client";
// The one way an e-mail address reaches a page: as a token (src/lib/email.ts)
// the server encodes, rendered as the readable form (`hello [at] acme [dot]
// example`) until the component has hydrated and as a mailto: link after —
// so the address is never text in the served HTML or its RSC payload, and a
// visitor with a browser gets a link. A site passes the token from a server
// component: <EmailLink token={encodeEmail(address)} />; the address itself
// stays in server code.
import { type ReactNode, useSyncExternalStore } from "react";
import { decodeEmail, readableEmail } from "../email.ts";

const noop = () => () => {};
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export function EmailLink({ token, className, children }: { token: string; className?: string; children?: ReactNode }) {
  const hydrated = useHydrated();
  const address = decodeEmail(token);
  if (!hydrated) return <span className={className}>{children ?? readableEmail(address)}</span>;
  return (
    <a href={`mailto:${address}`} className={className}>
      {children ?? address}
    </a>
  );
}
