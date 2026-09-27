# Forms that deliver: the endpoint and a provider

A form ships on the `mailto` backend: it opens the visitor's mail client with
a draft, and nothing arrives unless they press send. The `endpoint` backend
delivers: the browser posts the submission to a route of the site, the route
checks it against the form's own definition, drops what a bot sent, and hands
the rest to a **sink** — the site's destination. Every page stays
prerendered; the route is the one thing that runs at request time.

The kit names no provider. It ships a signed **webhook** sink, which any
service that accepts a webhook takes as it is, and a **log** sink for
development; a provider with an API of its own is a `FormSink` of a few
lines in the site. So the choice of service is a site's, made in its
environment, and changing it later touches no form. The contract — every
status, the wire format, the signature — is `src/lib/forms/README.md`.

## What a form can ask

A form is a definition in `src/config/forms.ts`; every item is config, so a
new landing-page form is an entry there and no component code. The items
(the contract, with an example of every one, is `src/lib/forms/README.md`):

| Item | For |
|---|---|
| `text`, `email`, `tel`, `url` | a line of text; `minLength`, `maxLength`, `pattern`, `inputMode` |
| `number`, `date` | a quantity (`min`, `max`, `step`), a day (`min`, `max`) |
| `textarea` | a message; `rows`, `minLength`, `maxLength` |
| `select`, `radios` | one choice of several; a select's `placeholder` makes `required` mean a real choice |
| `checkboxes` | any of several |
| `checkbox` | one box: consent (its label may end in a link to the privacy notice) or an opt-in |
| `hidden` | a fixed value the submission carries: a campaign, an offer, a variant of the form |
| `{ row: [...] }`, `{ note }`, `{ group }` | two fields side by side; a line of text with a link; a fieldset with a legend |

Every field takes a `hint`, and where the control has them `autocomplete`,
a default value and `fromQuery`: a link to `/sections/contact?topic=design`
chooses that option of a field with `fromQuery: "topic"`, read in the
browser after hydration, so the page stays prerendered. A form that mixes
required and optional fields sets `optionalMarker` (`"(optional)"`), shown
after each optional field's label. `{email}` in a message is the address
(`messages.email`) as a link.

Every one of them validates natively in the browser and again on the
server, never stricter (`rules.ts`), and reads the same on both backends:
the mailto body shows each option's label, the wire format each value.
Not in the set, with the reasons in the contract: file upload, conditional
fields, multi-step forms, a multiple select, password, range and colour.

## Switching a form over

1. **The form.** In `src/config/forms.ts`, set its backend to the route:

   ```ts
   backend: { kind: "endpoint", url: "/api/forms/contact" },   // the form's id
   ```

   A `withEmailToken` wrapper can stay; it leaves an endpoint form alone.

2. **The route and the delivery config.** A site made with `init` from 0.6.0
   has them: `src/app/api/forms/[id]/route.ts` and
   `src/config/form-delivery.ts`. An older site copies both from the kit
   ([upgrading.md](upgrading.md)). `forms.ts` never imports
   `form-delivery.ts`: the definitions reach the browser, the destination
   must not.

3. **The honeypot.** `<Form>` (`src/components/ui/form/Form.tsx`) renders a
   hidden input named `TRAP_FIELD` and sends the time the form was on screen
   — for endpoint forms only, so a `mailto` form's markup does not change. A
   site whose `Form.tsx` predates 0.6.0 takes those lines from the kit's; until
   it does, its submissions still deliver, unscreened.

4. **The destination**, in the environment (below). Without one,
   development prints each submission to the server's log and production
   answers 503, so the form shows its error message rather than a success
   nobody receives.

5. **The privacy notice.** What people type now goes to the site's server
   and on to the provider: name the provider as a processor, what is kept
   and for how long. The endpoint sets no cookie and the page loads nothing
   new, so a cookie notice stays as it is.

## Where submissions go

**A service that takes a webhook** (an automation platform, a CRM's inbound
hook, a function of the site's): set its URL, and a secret to sign with.

```bash
FORM_WEBHOOK_URL=https://hooks.provider.example/in/…
FORM_WEBHOOK_SECRET=<a long random string>      # openssl rand -hex 32
```

A receiver that wants an API key in a header gets it through the sink's
`headers` — one line in `form-delivery.ts`:

```ts
createFormSink({ kind: "webhook", url, secret, headers: { Authorization: `Bearer ${process.env.FORM_WEBHOOK_TOKEN}` } })
```

**A service with an API of its own** is a class implementing `FormSink`,
mapping the wire format onto the provider's fields, in a server module of
the site's; `formSink()` returns it.

```ts
// src/server/crm-sink.ts
import type { FormSink, FormSubmission } from "agentic-cms/forms/server";

export class CrmSink implements FormSink {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  async deliver(submission: FormSubmission): Promise<void> {
    const response = await fetch("https://api.crm.example/v1/leads", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: submission.values.email, message: submission.values.message, source: submission.page.utm.source, reference: submission.id }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`the CRM answered ${response.status}`);   // the route answers 502; the visitor sees the error message
  }
}
```

**Different forms, different places**: one sink branching on
`submission.form.id`. **Two places at once** (a CRM and a notification):
one sink that awaits both and throws if either failed.

## The environment, per host

| Host | Where the variables go |
|---|---|
| `pnpm dev` | `.env.local` (gitignored; `.env.example` lists them). None set: the log sink. |
| A Node server ([deploy.md](deploy.md)) | The host's app settings, on every slot or environment that runs the site. The standalone server runs with `NODE_ENV=production`, so none set means 503. |
| Cloudflare Workers | `wrangler secret put FORM_WEBHOOK_URL`, the same for the secret. OpenNext hands them to the app as `process.env` while a request is served, which is why `formSink()` is read per request. The example's `global_fetch_strictly_public` flag lets a Worker reach public addresses only. |

A preview or staging deployment points at a test destination of its own, or
at none: a 503 there is the form's error message, not a lost lead.

## Receiving the webhook

Each delivery is a `POST` of the submission as JSON (wire format version 1:
`id`, `form`, `submittedAt`, `fields` with their labels, `values`, `page`
with its UTM tags), with these headers:

| Header | |
|---|---|
| `X-Form-Submission-Id` | The submission's `id`. A visitor may resend after a slow answer; drop an `id` you already have. |
| `X-Form-Timestamp` | Unix seconds, when a secret is set. |
| `X-Form-Signature` | `sha256=` + the hex HMAC-SHA256 of `` `${timestamp}.${body}` `` under the secret. |

A receiver answers 2xx once it has the submission; anything else, a
redirect included, counts as a failed delivery. It checks the signature over
the raw body before parsing it, in constant time, and refuses a timestamp
more than five minutes from its clock. A receiver in JavaScript uses the
kit's check:

```ts
import { verifyFormSignature } from "agentic-cms/forms/server";

export async function POST(request: Request) {
  const body = await request.text();
  const valid = await verifyFormSignature(process.env.FORM_WEBHOOK_SECRET ?? "", {
    body,
    timestamp: request.headers.get("x-form-timestamp"),
    signature: request.headers.get("x-form-signature"),
  });
  if (!valid) return new Response(null, { status: 401 });
  const submission = JSON.parse(body);
  // …store it, unless submission.id is already stored
  return new Response(null, { status: 204 });
}
```

A receiver that cannot check a signature (many no-code hooks) is guarded by
its URL alone: keep `FORM_WEBHOOK_URL` as secret as the secret.

## Spam, limits, failures

- **Bots.** A filled honeypot, or a form sent less than 1.5 s after it
  appeared, is answered 200 and delivered nowhere — a bot learns nothing. A
  submission that carries neither signal (an old `Form.tsx`) is delivered.
- **Volume.** Five submissions per form and address in ten minutes, counted
  in the server's memory: per instance, and per isolate on Workers, so it
  slows a script rather than enforcing a quota. A hard limit is a
  `RateLimiter` over a shared store, passed to `createFormHandler`. A
  challenge widget (a CAPTCHA) is not in the kit: it loads a third party on
  the page, which the cookie notice would have to name.
- **Failures.** A provider that is down or answers an error makes the route
  answer 502, and the visitor sees the form's error message — which should
  say how else to reach the site: "Please email us directly at {email}."
  with `messages.email` set renders the address as a link, a token on a site
  that guards it ([email.md](email.md)). The server log names the form and
  the submission's `id`, never what was written.

## Checking it

With `pnpm dev` running and no destination set:

```bash
curl -si http://localhost:8000/api/forms/contact -H 'content-type: application/json' \
  -d '{"values":{"firstName":"Ada","lastName":"L","organisation":"Acme","email":"ada@acme.example","message":"Hello"}}'
```

answers `{"ok":true}` and prints the submission in the dev server's
terminal (the example's contact form must be on `endpoint` first). A field
it refuses comes back by name: `{"ok":false,"error":"invalid","fields":["email"]}`.
