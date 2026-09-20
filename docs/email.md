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

The kit gives a site four pieces; a site opts in by using them.

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
// a server component; the address never leaves server code
import { EmailLink } from "agentic-cms/components";
import { encodeEmail } from "agentic-cms/email";
import { contact } from "@/config/contact";

<EmailLink token={encodeEmail(contact.email)} className="…" />
```

Renders the readable form in a `<span>` until hydration and the `mailto:`
link after. It takes `children` for a label other than the address. Every
place the address renders goes through it — the footer, the contact page,
the mobile menu, and a Markdown post's `mailto:` links through the site's
`a` mapping (`mdx.tsx`: a `href` starting with `mailto:` becomes an
`EmailLink` with the address encoded).

## The form — `withEmailToken`

```tsx
// the server component that renders the form
import { withEmailToken } from "agentic-cms/forms";
<Form definition={withEmailToken(forms.contact)} />
```

A `mailto` form's recipient crosses to the client as a token; the mailto
backend resolves it at submit (`resolveRecipient`), a plain address as it
is. Other backends are untouched.

## The address itself

The address lives in a server-only module a client component never imports
(`src/config/contact.ts`, say) — not in `site.ts`, which the structured
data reads: with `SiteConfig.email` left out, the Organization carries no
`email` and a ContactPoint carries the page's URL instead.

## The guard — `agentic-cms guard-email`

```bash
agentic-cms guard-email                    # the host of site.url; exit 1 naming each served file that carries an address
agentic-cms guard-email --domain acme.example --domain acme.co.uk --json
```

Scans every file the build serves — the pages and RSC payloads under
`.next/server/app`, the `.body` routes (feed, sitemap, robots), the static
chunks — for an address at the site's domain, and fails naming each file.
The documented place is the last step of the site's build:

```json
"build": "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo && agentic-cms guard-email"
```

The wireframe example keeps `hello@acme.example` visible in its config on
purpose (a wireframe shows its address); a site that guards its address
takes the four steps above and adds the guard to its build.
