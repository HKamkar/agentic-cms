// A form's mailto recipient as a token, so a site that keeps its address out
// of served files (src/lib/email.ts) can pass a definition to its client-side
// <Form> without the address crossing as text: the server component wraps
// the definition with withEmailToken(), and the mailto backend resolves the
// recipient at submit time, token or plain address alike.
import { decodeEmail, encodeEmail, isEmailToken } from "../email.ts";
import type { FormDefinition } from "./types.ts";

/** The definition with its mailto recipient encoded; other backends are untouched; a token is not encoded twice. */
export function withEmailToken(definition: FormDefinition): FormDefinition {
  if (definition.backend.kind !== "mailto" || isEmailToken(definition.backend.to)) return definition;
  return { ...definition, backend: { ...definition.backend, to: encodeEmail(definition.backend.to) } };
}

/** The address a mailto backend sends to: a token decoded, an address as it is. */
export const resolveRecipient = (to: string): string => (isEmailToken(to) ? decodeEmail(to) : to);
