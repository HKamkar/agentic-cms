// Google's side of the choice, consent mode v2: the default every page starts
// from, the update a choice sends, and Google Analytics' cookies. Every
// consent type is denied by default for every visitor; a choice moves
// analytics_storage alone, so the three ad types stay denied for good. The
// default must reach the dataLayer before the tag reads it: a site renders
// consentDefaultScript(policy) as an inline script near the top of <body>
// (docs/consent.md says why not next/script's beforeInteractive).
import type { ConsentPolicy, Decision } from "../choice.ts";

/** basic: the tag loads only once analytics is granted; advanced: it loads at once and sends cookieless pings until then. */
export type GoogleTagMode = "basic" | "advanced";

const DENIED = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" } as const;

const DAY = 24 * 60 * 60 * 1000;

/** JSON safe inside an inline script: `<` escaped so the text can never close the element, and the two line separators older parsers reject in strings. */
const inlineJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/**
 * The inline script that sets the consent default before any tag loads. It
 * pushes the default first, so nothing after it can skip it; then, repeating
 * isCurrent()'s check in plain JavaScript (it runs before any bundle), sends a
 * current stored choice as an update, so a returning visitor's first hit
 * carries it; and until analytics is granted it deletes any `_ga` cookie left
 * from before. Reading storage and cookies is each wrapped: blocked site data
 * throws, and a throw must not cost the default.
 */
export function consentDefaultScript(policy: ConsentPolicy): string {
  return `(function(){
var w=window,l=w.dataLayer=w.dataLayer||[];function gtag(){l.push(arguments)}
gtag("consent","default",${inlineJson(DENIED)});
gtag("set","ads_data_redaction",true);
var c=null;try{c=JSON.parse(w.localStorage.getItem(${inlineJson(policy.storageKey)}))}catch(e){}
var a=c&&c.version===${inlineJson(policy.version)}&&typeof c.at==="string"?Date.now()-Date.parse(c.at):-1;
if(a>=0&&a<${inlineJson(policy.maxAgeDays * DAY)}&&(c.analytics==="granted"||c.analytics==="denied"))gtag("consent","update",{analytics_storage:c.analytics});else c=null;
if(!c||c.analytics!=="granted"){try{var h=w.location.hostname.split(".");w.document.cookie.split(";").forEach(function(p){var n=p.split("=")[0].trim();if(!/^_ga/.test(n))return;for(var i=0;i<h.length-1;i++)w.document.cookie=n+"=;Max-Age=0;path=/;domain=."+h.slice(i).join(".");w.document.cookie=n+"=;Max-Age=0;path=/"})}catch(e){}}
})();`;
}

type DataLayerWindow = Window & { dataLayer?: unknown[] };

/** Pushes a command onto the dataLayer the way gtag.js reads it: as an Arguments object (an array is ignored). */
export const gtag: (...args: unknown[]) => void = function () {
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params -- gtag.js reads Arguments objects off the dataLayer, never arrays
  w.dataLayer.push(arguments);
};

/**
 * Deletes Google Analytics' cookies (`_ga`, `_ga_<id>`). GA sets them on the
 * widest domain it may, so each parent domain of the host is tried, and the
 * host itself; a browser ignores the ones it would not have accepted.
 */
export function clearGoogleCookies(doc: Pick<Document, "cookie"> = document, hostname = location.hostname): void {
  const labels = hostname.split(".");
  const domains = [...labels.slice(0, -1).map((_, i) => `;domain=.${labels.slice(i).join(".")}`), ""];
  const names = doc.cookie.split(";").map((pair) => pair.split("=")[0].trim()).filter((name) => /^_ga/.test(name));
  for (const name of names) for (const domain of domains) doc.cookie = `${name}=;Max-Age=0;path=/${domain}`;
}

/**
 * Sends a choice to the Google tag. A refusal deletes the cookies an earlier
 * acceptance left; in basic mode it also switches a tag already loaded on
 * this page off (`ga-disable-<id>`, Google's own opt-out: no hit at all until
 * the page is left), and an acceptance switches it back on. Advanced mode
 * leaves the switch alone: its cookieless pings are the point of it.
 */
export function updateGoogleConsent(analytics: Decision, tagId: string, mode: GoogleTagMode = "basic"): void {
  if (mode === "basic") (window as unknown as Record<string, unknown>)[`ga-disable-${tagId}`] = analytics === "denied";
  gtag("consent", "update", { analytics_storage: analytics });
  if (analytics === "denied") clearGoogleCookies();
}
