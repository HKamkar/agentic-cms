// The site's analytics, as data. The Google tag id (GA4's "G-…" measurement
// id of a web data stream) comes from the build's environment: unset, the
// site ships no tag, no consent default and no consent banner. Server
// components read it (the layout, the footer); a client component reads the
// policy, never the id. Set it where the production build runs, not in
// .env.local: the dev server would load the tag too.
//
// The visitor's choice is kept in localStorage under `storageKey` (the cookie
// notice names it), asked for again after `maxAgeDays`, and asked of everyone
// again when `version` goes up: raise it when what the banner asks changes.
// GA4's own consent settings for the tag must say what the page says, every
// type denied by default (docs/consent.md). Data only: the screenshot
// harness reads this file through src/config/harness.ts.
import type { ConsentPolicy } from "agentic-cms/consent";

export const analytics = {
  tagId: process.env.GOOGLE_TAG_ID ?? "",
  consent: { storageKey: "consent", version: 1, maxAgeDays: 365 } satisfies ConsentPolicy,
};
