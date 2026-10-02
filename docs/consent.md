# Consent: the visitor's choice and the Google tag behind it

A site that measures its visitors asks first, and until the visitor answers
nothing about the visit leaves the page. `agentic-cms/consent` keeps the
visitor's answer in their own browser and tells whoever needs it what it now
may do; `agentic-cms/consent/google` is the Google tag (Google Analytics 4)
behind that answer, with Google's consent mode v2. Both are headless: the kit
carries the behaviour, the banner is the site's design.

The example wires it the way a site would, and leaves it off: with no
`GOOGLE_TAG_ID` in the build's environment it ships no tag and no banner.
Its pieces are the model — `src/config/analytics.ts` (the tag id and the
policy), `src/app/layout.tsx`, `ui/ConsentBanner`, `ui/CookieSettingsButton`
in the footer and `src/config/harness.ts`.

## What a site writes

```ts
// src/config/analytics.ts — data only
import type { ConsentPolicy } from "agentic-cms/consent";

export const analytics = {
  tagId: process.env.GOOGLE_TAG_ID ?? "",
  consent: { storageKey: "consent", version: 1, maxAgeDays: 365 } satisfies ConsentPolicy,
};
```

```tsx
// src/app/layout.tsx, inside <body>
{analytics.tagId && <script id="consent-default" dangerouslySetInnerHTML={{ __html: consentDefaultScript(analytics.consent) }} />}
{analytics.tagId && <ConsentBanner />}
…
{analytics.tagId && <GoogleTag tagId={analytics.tagId} policy={analytics.consent} />}
```

The default script goes near the top of `<body>`, before anything of the
page's own; the banner early in the page, so a keyboard meets it first; the
tag anywhere — it renders nothing. The banner is a client component built on
`useConsent`, and a "Cookie settings" button anywhere on the page calls
`openConsent()`. A cookie notice says what the banner asks about (below).

## The choice

The record lives in `localStorage` under the policy's `storageKey`:

```json
{ "analytics": "granted", "at": "2026-10-02T12:00:00.000Z", "version": 1 }
```

It is also the proof of consent the site keeps: when, and under which
version of the question, whose wording is in the site's history. Nothing is
logged on a server.

| Policy field | Meaning |
|---|---|
| `storageKey` | the `localStorage` key; the cookie notice names it |
| `version` | raise it when what the banner asks changes: every stored choice stops counting, and everyone is asked again |
| `maxAgeDays` | how long a choice counts before the visitor is asked again |

A choice counts while it is from this `version`, its `at` is a real time no
later than now, and it is younger than `maxAgeDays`; anything else — none
yet, unreadable, older, expired — is no choice, and the banner asks.
`isCurrent`, `readChoice(storage, policy)` and `writeChoice(storage, policy,
decision)` are the record's functions; they take the storage as an argument
(`browserStorage()` in a browser), so they run in a server component and in
plain Node. A browser that refuses storage (blocked site data) keeps the
choice for the page; the next page asks again. A choice made in another tab
reaches this one, and a storage cleared there counts as the choice
withdrawn.

There is one decision, `analytics`. The record has room for more: a later
category is another key and a `version` raise, which asks everyone again.

## The hooks

`useConsent(policy)` is a banner's state:

| Field | |
|---|---|
| `open` | true while there is no choice, and again after `openConsent()` |
| `reopened` | true when `openConsent()` opened it: the moment a banner takes focus |
| `decision` | `"granted"`, `"denied"`, `"none"` before a choice, `"unknown"` while the server renders |
| `choose(decision)` | records it, closes the banner, hands focus back to what opened it |

`useConsentDecision(policy)` is the decision alone. On the server both say
`"unknown"` and a banner renders nothing: the choice lives in the browser,
so the page is the same for everyone until it hydrates. `openConsent()` asks
the banner to open from anywhere — the footer's Cookie settings, a button on
the cookie notice. A visitor must be able to change or withdraw the choice as
easily as they made it, so the site keeps such a button on every page.

## Another tag

The Google tag is one adapter of the store; another tag follows the same two
functions:

- `currentDecision(policy)` — the decision in force, or `null` (no choice
  yet, or it was withdrawn or expired);
- `onConsentChange(policy, listener)` — called with the decision in force
  whenever it changes, on this page or in another tab; returns the
  unsubscribe.

A change made on the page reaches the listeners synchronously, before React
re-renders, so an adapter can act on it before anything that renders from
it. An adapter treats `null` after a choice as a refusal.

## Google: consent mode v2

**The default.** `consentDefaultScript(policy)` is the inline script every
page starts with. It sets Google's consent default — `ad_storage`,
`ad_user_data`, `ad_personalization` and `analytics_storage` all denied, for
every visitor — and redacts ad data; then it reads the stored choice with the
same rules as `isCurrent` and sends a current one at once as an update, so a
returning visitor's first hit already carries it; and until analytics is
granted it deletes any `_ga` cookie left from before. A choice only ever
moves `analytics_storage`: the three ad types stay denied for good.

It is a plain inline `<script>` near the top of `<body>`, not `next/script`
with `beforeInteractive`. Next queues an inline `beforeInteractive` script
for its bootstrap, which reads that queue once, when its entry chunk runs; a
visitor with the chunk cached and the stylesheet not can get the chunk first,
and the default never runs. A plain inline script runs while the HTML is
parsed — before the first paint and before the data hydration needs — which
is where the example's theme script already sits.

**The tag.** `<GoogleTag tagId policy mode? />` connects the page to the tag
once and renders nothing:

| Mode | Before a choice | Allow | Decline, or a choice withdrawn |
|---|---|---|---|
| `"basic"` (default) | no tag on the page: nothing reaches Google | the update, then the tag | the update; `ga-disable-<id>` set, so a tag already running sends nothing; the `_ga` cookies deleted |
| `"advanced"` | the tag, reading every type denied: cookieless pings | the update | the update; the `_ga` cookies deleted; the tag keeps sending cookieless pings |

Advanced mode sends Google a ping without cookies — still the visitor's IP
address and browser — before and after a refusal; a site that promises
"nothing reaches Google before you agree" uses basic mode.

Whatever sets a change off — Allow on this page, a choice in another tab, a
tag connected after a choice — the update reaches the dataLayer before the
tag's `config`, and the tag (`https://www.googletagmanager.com/gtag/js`) is
put on the page once. A page stays connected: a refusal reaches a tag that is
already running even after the component is gone. Without the consent default
on the dataLayer the tag is not loaded, and the console says why — without
it the tag would read every type granted.

There is no `regions` option: in basic mode the tag waits for a choice
anywhere, and a default limited to some regions would start everyone else
granted, against what the banner says.

**The tag id stays out of development.** The example reads it from
`GOOGLE_TAG_ID` at build time; set it where the production build runs, not
in `.env.local`, or the dev server loads the tag too.

## GA4's own settings

Google's admin can override what a page says: the Google tag's consent
settings ("Override consent mode defaults") apply to the tag wherever it
runs. Keep them in step with the page — every type denied by default, for
every region — or leave them off; never let them grant what the page
denies.

## What the cookie notice says

The kit does the mechanics; the notice's wording is the site's, and its
lawyer's. It names:

- what the site stores itself: the choice, under its `storageKey` in
  `localStorage` — the decision, the time and the version — for
  `maxAgeDays`;
- what the tag sets once allowed: Google Analytics' `_ga` and `_ga_<id>`
  cookies (two years by Google's default);
- what is sent, and to whom: page views and the device and browser that made
  them, to Google, with the address it arrives from;
- that nothing is sent before the visitor allows it, and what declining
  changes (nothing else on the site);
- how to change the choice at any time: the Cookie settings button, on every
  page;
- the version of the question, so a stored choice can be read against the
  wording it answered.

## Content-Security-Policy

The default script is inline: a site with a CSP allows it by its hash (the
script is the same for every page of a given policy) or the way it allows
the theme script. The tag needs `script-src https://*.googletagmanager.com`,
`connect-src https://*.google-analytics.com https://*.analytics.google.com
https://*.googletagmanager.com` and `img-src https://*.google-analytics.com
https://*.googletagmanager.com`.

## Screenshots

The harness photographs a first visit unless told otherwise, and a banner
fixed over the page covers what it sits on. `src/config/harness.ts` seeds
every capture, shot and probe with a refused choice built from the policy —
so a `version` raise reaches the seed too — and the banner stays closed;
`--no-storage` shows it ([visual-parity.md](visual-parity.md#a-visitors-choice-seeded)).

## Testing a site's own wiring

Both entries load in plain Node, so a site's `node --test` suite imports
them: `readChoice` against a stub storage, and the default script run with
`node:vm` against the records it must accept and refuse. In a browser, route
Google's hosts to an empty answer and read `window.dataLayer`: the default
first, nothing of Google's before a choice, the update before the `config`.
The kit's own suite (`scripts/browser/dev-routes.test.mjs`) does exactly
that on the example.
