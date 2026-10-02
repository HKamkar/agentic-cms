// agentic-cms/consent/google: Google consent mode v2 behind the visitor's
// choice. The default script, the update and the cookie clearing are plain
// functions, safe in a server component and in plain Node; GoogleTag is a
// "use client" module that loads the tag only as the choice allows.
// docs/consent.md is the contract.
export { clearGoogleCookies, consentDefaultScript, updateGoogleConsent, type GoogleTagMode } from "./consent-mode.ts";
export { GoogleTag, type GoogleTagProps } from "./GoogleTag.ts";
