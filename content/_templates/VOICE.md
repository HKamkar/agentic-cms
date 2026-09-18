# Voice and claims

<!-- Copy this file to content/VOICE.md and write the site's rules in it. The
prose is what a writer reads; the fenced block at the end is what
`agentic-cms lint` enforces on every build (pnpm content:lint runs it
in a second), and the two must say the same thing. Keep the headings: the
editorial plugin's skills read them by name. Delete these comments. -->

How <the brand> writes, on every page and in every post, and what it never
claims.

## Who reads this site

One paragraph on the reader: who they are, what they came for, what
register they expect (documentation? a founder's note? a newsroom?). The
critic reads a draft as this person.

## Non-negotiables

- **The brand is `<the brand>`**: how it is spelled, with or without a
  mark, and the exceptions (e-mail addresses, the domain, URLs, paths).
  The block below carries `brand.name` and, if there is one, `brand.mark`.
- **The category**: the one or two words the product belongs to, and how
  they are written.
- **The offers, named precisely**: what is sold and what each thing is
  called, so no post invents a name.
- **The incumbent**: what the product replaces, in the words the site uses.
- **Words the site never uses**, and what it says instead (they go in
  `banned` below with a `why` and an `instead`).
- **Spelling and punctuation**: US or UK English, sentence case or title
  case in headings, em dashes or not, emoji or not.
- **Calls to action**: the label and link of the site's button
  (`site.cta` in `src/config/site.ts`) and the closing line of a post
  (`content/blog/_template.md` shows it).

## Claims: what is true, said exactly

- **Compliance language**: what may be said about regulations and
  certifications (the `claims` block below names the words that are claims
  and the regulations near which they count).
- **Customers**: whether names, logos, quotes and case studies may appear,
  and on whose approval.
- **No invented numbers**: no figure without a documented measurement; an
  external number carries its source.
- **No roadmap**: nothing that is not shipped.
- **Honest fit**: when the product is not the right answer, and how to say
  so.

## Writing that does not read as generated

- State the point. No correlative contrasts ("not only X but also Y"), no
  rhetorical question to open a section, no "Imagine if".
- No hype titles ("The ultimate guide to", "N ways to"). A title says what
  the piece is.
- Vary sentence length on purpose.
- Cut consultant filler: the words in the block below are banned outright.
- Alt text says what an informative image shows, in a sentence; never the
  file name, never "image of". Empty alt only for a decorative image.

## What the build checks, and what it cannot

`agentic-cms lint` reads the block below and every content file:
banned words and patterns fail, as do a model name, the brand without its
mark or miscased, an em dash, a missing or slot-naming alt, a keyword
count or excerpt length outside its range, a heading that breaks the post
structure, a missing, misplaced or heavy image, a date that is not a day.
A claim word near a regulation with the brand as the subject, and a cloud
named as what the stack runs on, warn (heuristics); so do the soft ranges
(a title over 60, a description outside 70–160, a future date, a stale
draft, an orphaned image, a stray file). It cannot judge rhythm, a
rhetorical question, an unsupported number or a misattributed date: those
are the `review-voice` and `critic` passes of the editorial plugin.

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
entries below are the generic starting point; add the site's own.

<!-- voice-rules:start -->
```yaml
brand:
  name: <the brand>
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
  subject: "\\b(?:<the brand>|we|we're|our|us|the platform)\\b"
  negation: "not|no|never|isn't|aren't|without|instead of"
  instead: designed to support <the regulation>
models:
  names: []                         # model names the copy never uses, if any
  instead: open-weight models
clouds:
  names: []                         # cloud names allowed only for the customer's environment, if any
  stack: "\\b(?:<the brand>|we|our (?:stack|platform|infrastructure|servers)|the platform)\\b[^.;]{0,50}\\b(?:runs?|running|hosted|hosts|built|deployed|lives)\\b[^.;]{0,20}\\b(?:on|in)\\b"
  instead: name a cloud for the customer's environment, never as what the stack runs on
```
<!-- voice-rules:end -->
