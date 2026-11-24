// The site's redirects as Next serves them: next.config.ts's redirects()
// returns redirectsFor(), read from content/redirects.yaml when Next loads
// its config at build time (docs/roadmap-0.9.0.md D12), so the Worker and a
// Node server answer the same and no host's format reaches the content. The
// content lint holds the list (a `from` that is a live page, a chain, a
// `to` that lands nowhere); a page file removed without one is check-site's
// `retired` warning.

import { redirectsCollection, type Redirect } from "./collections.ts";
import { readCollection } from "./read.ts";

/** One entry of next.config's redirects(): a literal path, its target, 308 when permanent, else 307. */
export type NextRedirect = { source: string; destination: string; permanent: boolean };

/** A redirect as Next takes it: permanent unless the entry says false. */
export const toNextRedirect = ({ from, to, permanent }: Redirect): NextRedirect => ({ source: from, destination: to, permanent: permanent ?? true });

/** Every redirect of content/redirects.yaml (or of `def`), as next.config.ts's redirects() returns them. Throws a ContentError for a file its schema refuses, as the build would. */
export function redirectsFor(def = redirectsCollection()): NextRedirect[] {
  return readCollection(def).map((entry) => toNextRedirect(entry.data));
}
