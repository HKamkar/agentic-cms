---
title: The voice file and the lint
excerpt: >-
  One file holds the rules this site's copy follows, and one script enforces the
  half of them a machine can judge. What fails, what only warns, and which two
  reviewers read the rest.
date: '2026-09-14'
category: notes
author: acme-editorial
image: /images/blog/the-voice-file-and-the-lint/the-voice-file-and-the-lint-hero.webp
imageAlt: A wide grey placeholder standing in for the hero illustration of this post
thumbnail: /images/blog/the-voice-file-and-the-lint/the-voice-file-and-the-lint-card.webp
thumbnailAlt: A grey placeholder standing in for the card image of this post
seoTitle: The voice file and the lint | Acme
seoDescription: One file holds the rules this site's copy follows and one script enforces them. What fails, what warns, and which two reviewers read the rest.
keywords: [voice guide, content lint, editorial review, style rules, build checks]
related: [how-a-post-is-built, pages-are-files]
publishedAt: '2026-09-14T09:00:00.000Z'
---

`content/VOICE.md` is prose with a machine-readable block bolted to the end of
it. The prose is what a writer reads. The block between the two `voice-rules`
markers is what `scripts/content-lint.mjs` reads, and the two are edited
together, because a rule that only exists in the prose is a rule nobody enforces.

## What the block carries

The block is YAML. `brand` is how the name is spelled and whether a mark follows
it. `banned` is a list of literal phrases, each with a reason and a replacement,
matched at word boundaries so `robustness` survives while `robust` does not.
`patterns` is a list of regular expressions for the shapes that no word list
catches, such as a paragraph opening with "Furthermore," or the correlative
contrast that gives generated prose away.

Three more sections describe the claims a site is allowed to make. `claims` names
the words that read as certification and the regulations near which they count.
`models` and `clouds` name the products the copy must not attribute to itself. On
this site all three lists are empty, since nothing here is regulated and nothing
is claimed, and a fork fills them in on its first day.

## What fails and what warns

The exact rules fail the build. A banned word, a banned pattern, a miscased
brand, an em dash, a missing alt, an alt that names the slot instead of the
picture, a keyword count outside three to eight, an excerpt outside thirty to
forty words, a heading that starts at `#` or skips a level, a FAQ question with
no answer under it, an image that does not exist on disk or weighs more than 250
kilobytes, a date that parses but is not a calendar day.

> "A rule that only exists in the prose is a rule nobody enforces."

The heuristics and the soft ranges only warn. A claim word standing near a
regulation, a cloud named as what the stack runs on, a title over sixty
characters, a description outside seventy to a hundred and sixty, a date in the
future, a draft older than a month, an image in a post folder no post uses. Each
warning is either fixed or explained, and `pnpm content:lint --strict` turns them
all into failures for a run.

![A wide grey placeholder standing in for a figure inside this post](/images/blog/the-voice-file-and-the-lint/the-voice-file-and-the-lint-mid.webp)

Every finding prints as one line, `LEVEL file rule: path problem`, which is
enough to find the cause without opening anything. The whole pass takes about a
second, and it runs first in `pnpm build`, before the framework does any work at
all.

## What a lint cannot see

A word list cannot tell you that a paragraph says nothing, that a transition is
dead, that the second half of a post repeats the first, or that a date has been
attributed to the wrong document. Those are the jobs of the two review agents in
the editorial plugin. The voice-reviewer reads a file against `VOICE.md` and
reports what the rules imply but cannot match. The critic reads the same draft
for prose quality and checks every externally verifiable claim against a source.

Both run in isolation from whoever wrote the draft, which is the point. A writer
who has just argued themselves into a sentence is the worst judge of it. The
agents see the file and the rules, and nothing else.

A post is finished when the lint is silent, both reviewers have had their say,
and the build is green. [Get in touch](/#contact-form) if you want the rules
themselves reviewed, and read [pages are files](/blog-post/pages-are-files) or
the rest of the [blog](/blog) for how the copy around them is organized.

## Frequently asked questions

### Where do I add a new rule?

In the fenced block, and in the prose above it that explains why. A rule that
today's copy breaks ships as a warning first, so the build stays green while the
copy is fixed.

### Does the lint read the whole file?

It reads every string the schemas validated, which is every eyebrow, heading,
paragraph, card title, alt text and label in the tree, plus every line of every
post body outside a fenced code block.

### Why is the brand rule case-sensitive?

Because a brand is spelled one way. The lint derives the wrong spellings from the
right one and reports them, and it leaves eyebrows and labels alone, since the
design sets those in capitals on its own.

### Can I run it without building?

Yes. `pnpm content:lint` is the whole pass on its own, and `pnpm content:check`
is the schema-only loop under a second when all you changed is a field.
