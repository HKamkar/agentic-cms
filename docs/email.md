# Keeping the e-mail address out of served files

Harvesters read HTML, not scripts. A site whose address is text in a page,
an RSC payload, the feed or a bundle feeds its inbox's spam; a site whose
address reaches the browser only as a token, rendered into a `mailto:` link
once the page has hydrated, keeps the link for visitors and the text from
the harvesters. Not secrecy — a scraper that runs scripts still sees it —
but the address is out of the reach of the ones that do not, which is where
the volume comes from. Where a law wants the address findable (a business
contact requirement), the script-rendered link satisfies it; the alias
behind the address and its filtering are the real guard.

The kit gives a site four pieces — the token, the link, the form's tokens,
the guard — and one key in `src/config/site.ts` that puts them to work:
`guardEmail: true`, which `agentic-cms init` writes for a new site and the
kit's own example has on.

## The key — `guardEmail`

```ts
// src/config/site.ts
export const site = {
  // …
  email: "hello@acme.example",
  guardEmail: true,
  // …
} as const satisfies SiteConfig;
```

| `guardEmail` | The structured data | The build | `check-site` |
|---|---|---|---|
| `true` | no `email` as text: a `ContactPoint` with the contact page's URL in its place | `agentic-cms guard-email` after the SEO audit | fails a `build` without the guard |
| `{ off: "<why>" }` | `email` as text | no guard asked for | lists it, with its reason, among the exceptions added since the merge base |
| left out | `email` as text, as before 0.8.2 | no guard asked for | — |

A site whose address is public on purpose — a contact a law wants
findable as text, say — turns it off with its reason, which the review of
the pull request that does it reads:

```ts
guardEmail: { off: "the address our trade register requires on every page, as text" },
```

`false` alone, or an `off` without a reason, fails `check-site`. Left out,
the key changes nothing: a site from before it builds byte for byte as it
did, and adds the key when its owner chooses
([upgrading.md](upgrading.md)).

## The three ways in, and how each is closed

An address in `site.ts` reaches a served file three ways, and the key's
site closes each:

1. **The structured data.** The Organization's `email` — the blocks
   `organizationLd()` writes, the Blog's publisher, the About and the
   Contact page's organisation — is text in every page that carries one.
   With the key on, the engine writes
   `"contactPoint": { "@type": "ContactPoint", "url": "<site.url><links.contact>" }`
   where the `email` was, and a ContactPage's contact points carry the
   page's URL, a contact's own `email` left out
   ([the SEO contract](../src/lib/seo/README.md)). Google needs no e-mail
   for any rich result.
2. **A form.** A message written with the address in it, and a `mailto`
   backend's `to`, are text in the prerendered page and its payload. The
   form writes `{email}` where the address goes, with `messages.email`,
   and the server component that renders it passes the definition through
   `withEmailToken()` ([The form](#the-form--withemailtoken)).
3. **A client bundle.** A client component that imports `site.ts` ships
   the whole `site` object, the address included, in a JavaScript chunk.
   No client component imports it: the layout and the footer, server
   components, hand the chrome's client components what they show as
   props — the navbar its brand, links and words, the theme switch as its
   child; the consent banner its copy; the Cookie settings button its
   label. `site.ts` stays the one place for the config, and the address
   in it stays on the server.

`guard-email`, the build's last step, catches whatever slips past these:
it names each file, and the fix for a page and for a bundle.

## The token — `agentic-cms/email`

```ts
import { encodeEmail, decodeEmail, isEmailToken, readableEmail } from "agentic-cms/email";
```

`encodeEmail(address)` is the address reversed and base64-encoded:
trivially reversible on purpose, and never containing an `@`, which is how
a token is told from an address (`isEmailToken`). `readableEmail(address)`
spells it for a page before hydration: `hello [at] acme [dot] example`.
Plain TypeScript, usable from server code, the command line and a client
component alike.

## The link — `EmailLink`

```tsx
// a server component (the footer); the address never leaves server code
import { EmailLink } from "agentic-cms/components";
import { encodeEmail } from "agentic-cms/email";
import { site } from "@/config/site";

<EmailLink token={encodeEmail(site.email)} className="…" />
```

Renders the readable form in a `<span>` until hydration and the `mailto:`
link after. It takes `children` for a label other than the address. Every
place the address renders goes through it — the footer, the contact page,
the mobile menu, and a Markdown post's `mailto:` links through the site's
`a` mapping (`mdx.tsx`: a `href` starting with `mailto:` becomes an
`EmailLink` with the address encoded).

The lint holds it everywhere in `src/`: `agentic-cms/email`
(`agentic-cms/eslint`, `docs/primitives.md` § Enforced) fails a `mailto:`
link built in code — a string with an address after `mailto:`, a template
with `mailto:` in it, a `"mailto:"` added to something — and names
`EmailLink`. The bare `"mailto:"` a mapping tests an href against builds
no link, and passes.

## The form — `withEmailToken`

```tsx
// the server component that renders the form (the example's contact/ContactForm)
import { withEmailToken } from "agentic-cms/forms";
<Form definition={withEmailToken(forms.contact)} />
```

A `mailto` form's recipient crosses to the client as a token; the mailto
backend resolves it at submit (`resolveRecipient`), a plain address as it
is. An `endpoint` form carries no recipient to the browser at all: its
destination is in the server's environment ([forms.md](forms.md)).

A form's messages may name the address, for either backend:

```ts
// src/config/forms.ts
messages: {
  success: "Thank you.",
  error: "Something went wrong. Please email us directly at {email}.",
  email: site.email,
},
backend: { kind: "mailto", to: site.email, subject: "Contact form" },
```

`withEmailToken` encodes `messages.email` too, and the site's `FormShell`
renders each `{email}` through `EmailLink` (`messageParts` from
`agentic-cms/forms` splits the message). The messages are in the
prerendered page, hidden until a submit; the address in them is a token.

## The address itself

The address lives in `site.ts`, beside the rest of the config, and
`site.ts` is server-only: no `"use client"` module imports it. A client
component that needs a link, a label or a list from it takes it as props
from the server component that renders it. A site whose address is not in
`site.ts` at all (`SiteConfig.email` left out) gets no `email` and no
contact point in its Organization; its address lives in a server-only
module of its own, under the same rule.

## The guard — `agentic-cms guard-email`

```bash
agentic-cms guard-email                    # the host of site.url; exit 1 naming each served file that carries an address
agentic-cms guard-email --domain acme.example --domain acme.co.uk --json
```

Scans every file the build serves — the pages and RSC payloads under
`.next/server/app`, the `.body` routes (feed, sitemap, robots), the static
chunks — for an address at the site's domain, and fails naming each file
and the fix: for a page or its payload the link, the form's tokens and the
key; for a chunk the client component that imports the address. Its place
is the last step of the site's build, where `init` puts it for a site with
`guardEmail: true` and `check-site` holds it:

```json
"build": "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email"
```

It watches the domain of `site.url`; an address on another domain is
named to it with `--domain` in the build's step, the site's own domain
beside it. A site without the key may add the step itself; it scans the
same files.
