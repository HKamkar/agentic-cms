// A form's e-mail addresses as tokens, so a site that keeps its address out
// of served files (src/lib/email.ts) can pass a definition to its client-side
// <Form> without the address crossing as text: the server component wraps
// the definition with withEmailToken(), the mailto backend resolves the
// recipient at submit time, and the messages render `{email}` through
// EmailLink (messageParts), token or plain address alike.
import { decodeEmail, encodeEmail, isEmailToken } from "../email.ts";
import type { FormDefinition } from "./types.ts";

/** What a message writes where the address goes. */
export const EMAIL_SLOT = "{email}";

/** The definition with its mailto recipient and its messages' address encoded, for any backend; the rest is untouched and a token is not encoded twice. */
export function withEmailToken(definition: FormDefinition): FormDefinition {
  const { backend, messages } = definition;
  const guardedBackend = backend.kind === "mailto" && !isEmailToken(backend.to) ? { ...backend, to: encodeEmail(backend.to) } : backend;
  const guardedMessages = messages.email !== undefined && !isEmailToken(messages.email) ? { ...messages, email: encodeEmail(messages.email) } : messages;
  return guardedBackend === backend && guardedMessages === messages ? definition : { ...definition, backend: guardedBackend, messages: guardedMessages };
}

/** The address a mailto backend sends to: a token decoded, an address as it is. */
export const resolveRecipient = (to: string): string => (isEmailToken(to) ? decodeEmail(to) : to);

/**
 * A message split at each `{email}`: its text, and the address as a token
 * for EmailLink (a plain address is encoded here). Without an address the
 * slot stays as written, so the mistake shows on the page.
 */
export function messageParts(message: string, email?: string): (string | { token: string })[] {
  if (!email || !message.includes(EMAIL_SLOT)) return [message];
  const token = isEmailToken(email) ? email : encodeEmail(email);
  return message
    .split(EMAIL_SLOT)
    .flatMap((text, i) => (i === 0 ? [text] : [{ token }, text]))
    .filter((part) => part !== "");
}
