# Voice and claims

How Acme writes, on every page and in every post, and what it never claims.
This file is the site's copy rules; the fenced block at the end is what
`agentic-cms lint` enforces on every build, and the prose above it
must say the same thing. `pnpm content:lint` runs the block in a second.

## Who reads this site

Someone who is about to build a site on this kit: a developer who will run
the build and write the section components, or the content owner who will
live in `content/` afterwards and wants to know what a page file costs them
to change. They came from a README or a search for a way to keep marketing
copy under review instead of inside a CMS. They expect documentation
register: signal-dense, declarative, specific about what the build does and
what it does not. No marketing voice, no thought leadership, never "we are
excited to announce". The critic reads a draft as this person.

## Non-negotiables

- **The brand is `Acme`**: capitalized, no mark, one spelling. The only
  exceptions are the e-mail address (`hello@acme.example`), the domain
  (`acme.example`), URLs and file paths, which are lowercase. Never `ACME`.
  The block below carries the name (`brand.name`) and no `mark`, so the mark
  rule is off and only a miscased spelling is reported.
- **The category is `a content engine`**, or `a site kit` where the whole
  thing is meant: the engine, the editorial plugin and the example site
  together. Not a CMS, not a platform, not a framework.
- **The offer is the kit itself.** It is open source under the MIT license.
  There is nothing to buy, no tier and no edition, so no copy invents one.
- **There is no incumbent.** This site does not argue against a named tool.
  Where a comparison helps, describe the shape of the alternative (a
  database-backed CMS, a hosted page builder) and what it costs, never a
  competitor by name.
- **Words the site never uses** are in `banned` below, each with a `why` and
  an `instead`: the AI-tic openers and closers, the hype verbs, the
  consultant filler. Prefer the concrete noun and the plain verb.
- **US English** (organize, license, behavior). Sentence case in every
  heading, eyebrow and button. No em dashes anywhere: a period, a comma, a
  colon, or a shorter sentence. No emoji, no exclamation marks.
- **Calls to action.** The site's button is `Get in touch` (`site.cta` in
  `src/config/site.ts`), linking to the contact form on the landing page. A
  post ends with a line linking `Get in touch` to `/#contact-form`
  (`content/blog/_template.md` shows it).

## Claims: what is true, said exactly

- **Compliance language.** No regulation applies to this kit and no
  certification is held, so none is named and none is claimed. The `claims`
  block below carries an empty `regulations` list for that reason: a fork
  that does sell into a regulated market fills it in and the heuristic starts
  working. "Compliant", "certified" and "guaranteed" stay out of the copy.
- **Customers.** There are none to name. The review on the home page is an
  obvious slot and says so in `content/reviews.yaml`; no logo, quote or case
  study appears until a real one is approved in writing.
- **No invented numbers.** Only figures that are true of this repository and
  checkable in it: the number of collections, the number of section types,
  the number of skills and review agents in the editorial plugin, the fact
  that the content lint runs in about a second and that the Worker does no
  request-time reads. No benchmark, no adoption figure, no time saved.
- **No roadmap.** Nothing "coming soon", "in beta" or "on our roadmap"; what
  is in the repository is what the copy describes.
- **Honest fit.** This kit prerenders everything and reads no files at
  request time. When a site needs content that changes without a deploy, a
  search index over thousands of entries, or non-technical authors who will
  never open a pull request, a CMS with a request-time database is the better
  tool. Say so plainly rather than talking around it.

## Writing that does not read as generated

- State the point. No correlative contrasts ("not only X but also Y"), no
  rhetorical question to open a section, no "Imagine if".
- No hype titles ("The ultimate guide to", "N ways to"). A title says what
  the piece is.
- Vary sentence length on purpose; the alternating short-long-short-long
  cadence is the generated default.
- Cut consultant filler: the words in the block below are banned outright.
- Alt text says what an informative image shows, in a sentence; never the
  file name, never "image of". The pictures on this site are wireframe
  placeholders, so their alt text says what the placeholder stands in for.
  Empty alt only for a decorative image.
- Eyebrows are the design's uppercase; the YAML carries them in sentence
  case and the brand-case rule leaves eyebrows and labels alone.

## What the build checks, and what it cannot

`agentic-cms lint` reads the block below and every content file:
banned words and patterns fail, as do a model name, the brand without its
mark or miscased, an em dash, a missing or slot-naming alt, a keyword count
or excerpt length outside its range, a heading that breaks the post
structure, a missing, misplaced or heavy image, a date that is not a day. A
claim word near a regulation with the brand as the subject, and a cloud
named as what the stack runs on, warn (heuristics); so do the soft ranges (a
title over 60, a description outside 70-160, a future date, a stale draft,
an orphaned image, a stray file). `pnpm content:lint --strict` makes every
warning a failure, and the content reports 0 of each: a new warning is
yours to retire, not to accumulate.

It cannot judge rhythm, a rhetorical question, an unsupported number or a
misattributed date. Those are the `review-voice` and `critic` passes of the
editorial plugin.

## The rules the lint reads

Between the two markers, one YAML block. `brand.name` is the brand as it
is spelled and `brand.mark` the mark that follows every mention (leave it
out for a brand without one). `banned` entries are literal text matched
case-insensitively at word boundaries (a trailing comma is part of the
match); `patterns` are JavaScript regular expressions; `where` limits an
entry to collections (`posts`, `pages`, `faqs`, `reviews`, `useCases`,
`authors`), `except` lists files, or `file#field.path` prefixes, it does
not apply to; `why` and `instead` only feed the message. `claims.words`
are claims when a regulation from `claims.regulations` is named nearby
and `claims.subject` matches the sentence (structured data and card copy
speak for the brand by construction); `claims.phrases` always are;
`negation` is what excuses a claim word. `models.names` are never named;
`clouds.names` are fine unless the sentence matches `clouds.stack`. The
entries below are the generic starting point; a fork adds its own.

<!-- voice-rules:start -->
```yaml
brand:
  name: Acme
  # mark: "®"                       # leave out for a brand without a mark
banned:
  - { match: "Indeed,", why: AI-tic opener, instead: delete it }
  - { match: "It's worth noting", why: AI-tic opener, instead: say the thing }
  - { match: "Truly,", why: AI-tic intensifier }
  - { match: "Genuinely,", why: AI-tic intensifier }
  - { match: "Honestly,", why: AI-tic intensifier }
  - { match: "In today's", why: AI-tic opener, instead: name the year or drop it }
  - { match: "In conclusion,", why: AI-tic closer }
  - { match: "To summarize,", why: AI-tic closer }
  - { match: "In summary,", why: AI-tic closer }
  - { match: "Whether you're", why: AI-tic frame, instead: address one reader }
  - { match: "Imagine if", why: AI-tic opener }
  - { match: "Picture this", why: AI-tic opener }
  - { match: game-changer, why: hype, instead: say what changed }
  - { match: robust, why: filler, instead: say what it withstands }
  - { match: cutting-edge, why: hype }
  - { match: seamless, why: hype, instead: say what the reader does not have to do }
  - { match: may potentially, why: double hedge, instead: may }
  - { match: could possibly, why: double hedge, instead: could }
  - { match: delve, why: filler }
  - { match: dive into, why: filler }
  - { match: unlock, why: hype }
  - { match: unleash, why: hype }
  - { match: harness, why: hype, instead: use }
  - { match: elevate, why: hype }
  - { match: empower, why: hype }
  - { match: supercharge, why: hype }
  - { match: revolutionize, why: hype }
  - { match: navigating, why: filler }
  - { match: realm, why: filler }
  - { match: landscape, why: filler }
  - { match: tapestry, why: filler }
  - { match: testament to, why: filler }
  - { match: at the forefront, why: filler }
  - { match: pivotal, why: filler intensifier }
  - { match: crucial, why: filler intensifier }
  - { match: vital, why: filler intensifier }
  - { match: "notably,", why: filler }
  - { match: "importantly,", why: filler }
  - { match: ever-evolving, why: filler }
  - { match: fast-paced, why: filler }
  - { match: when it comes to, why: filler, instead: for }
  - { match: needless to say, why: filler, instead: delete it and keep the sentence }
  - { match: rest assured, why: filler }
patterns:
  - { regex: "^\\s*(Furthermore|Moreover|Additionally),", flags: m, why: AI-tic paragraph opener, instead: start with the point }
  - { regex: "\\b(?:to leverage|leverages|leveraged|leveraging)\\b|\\bleverage (?:the|your|our|its|their|a|an)\\b", flags: i, why: hype verb (the noun is fine), instead: use }
  - { regex: "\\btransform(s|ed|ing)? (the way|how|your business|everything)\\b", flags: i, why: hype, instead: say what changes }
  - { regex: "\\bnot (?:just|only) [^.;]{0,80}\\b(?:but|it's|it is|they're|they are)\\b", flags: i, why: correlative-contrast frame, instead: state the point plainly }
  - { regex: "\\bisn't just\\b[^.;]{0,80};\\s*it's\\b", flags: i, why: correlative-contrast frame, instead: state the point plainly }
  - { regex: "\\bfrom \\w+ to \\w+ to \\w+\\b", flags: i, why: the reflexive three-item rhythm }
  - { regex: "\\bthat's where [^.;]{1,40} comes in\\b", flags: i, why: AI-tic frame, instead: say what it does }
  - { regex: "\\b(?:the ultimate guide to|a comprehensive guide|unlocking the power of|navigating the world of|the future of|\\d+ (?:ways|tips|secrets) to|why \\w+ matters more than ever)\\b", flags: i, why: AI-tic title, where: [posts] }
claims:
  words: [compliant, certified, certification, guarantee, guarantees, guaranteed]
  phrases: [compliance-ready, compliance ready]
  regulations: []                   # the names near which a claim word counts, e.g. GDPR, the EU AI Act, HIPAA
  subject: "\\b(?:Acme|we|we're|our|us|the platform)\\b"
  negation: "not|no|never|isn't|aren't|without|instead of"
  instead: designed to support <the regulation>
models:
  names: []                         # model names the copy never uses, if any
  instead: open-weight models
clouds:
  names: []                         # cloud names allowed only for the customer's environment, if any
  stack: "\\b(?:Acme|we|our (?:stack|platform|infrastructure|servers)|the platform)\\b[^.;]{0,50}\\b(?:runs?|running|hosted|hosts|built|deployed|lives)\\b[^.;]{0,20}\\b(?:on|in)\\b"
  instead: name a cloud for the customer's environment, never as what the stack runs on
```
<!-- voice-rules:end -->
