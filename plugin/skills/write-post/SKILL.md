---
name: write-post
description: Write a blog post from a brief in four stages with an approval gate after each - outline, body written straight into content/blog/<slug>.md as a draft, an independent critique by the voice-reviewer and critic agents, the SEO fields - or rewrite an existing post the same way. Use when asked to write, draft, author, compose or rewrite a post from a topic, a keyword, a brief or a calendar row; to import a finished draft, new-post is enough.
argument-hint: <slug> [brief path, topic or keyword]
---

# Write post

The repo is the current directory. The deliverable is
`content/blog/<slug>.md` as `draft: true`, lint-clean, written under the
site's rules and handed to `new-post` for images, the verify block and
the commit. One stage per turn; a gate is a stop, not a summary.

## Read first

`content/VOICE.md` in full (who reads the site is the reader every stage
writes for; the non-negotiables and claims are the rules), `content/blog/_template.md`
(the frontmatter, the body conventions, the closing call to action),
`src/lib/blog/README.md` § Body pipeline, the keys of
`content/categories.json` and `content/authors.json`, the titles and
slugs in `content/blog/` (the internal-link candidates), the row for
this slug in `content/editorial/calendar.md` or `backlog.md` if there is
one, and `content/editorial/workshop.yaml` if it exists.

## Mode

**New** when `content/blog/<slug>.md` does not exist. **Revise** when it
does: Stage 1 is then a plan marking every section KEEP / TIGHTEN /
REWRITE / CUT / ADD with a one-line reason, Stage 2 rewrites the file with
unchanged sections verbatim, and the dates follow `update-post` step 2.
A title that matches an existing post while the user says "new" is a
question, not a guess.

## Stage 0 — the inputs

With a workshop: read `briefs/<slug>.md` (the `briefs` role) as the
brief; the keyword row from `keywords`; the newest `research` file whose
name carries the keyword (a SERP read); the piece and pillar from
`strategy`. Without one, or for what the workshop lacks, ask the user for
the same block in one message: working title, the reader (default: who
`VOICE.md` describes), primary keyword, the angle in a sentence, the
must-include facts (dates, article numbers, names: each one the user's
or a source's, never invented), 2–3 internal links from the existing
posts, the word target. Present the resolved block; an empty field
stops. Then a TodoList with one task per stage.

## Stage 1 — the outline (gate)

H2 and H3 headings in order, one sentence and a word count per section,
the concrete example each section carries, the 3–5 FAQ questions, the
line proposed as the pull quote, where each internal link lands. Stop.

## Stage 2 — the body

One Write to `content/blog/<slug>.md`: the template's frontmatter with
`title`, `excerpt`, `date` (today, quoted), `category`, `author`, `draft:
true`, and no image fields or figure paragraph yet (images are `new-post`
step 3); the body under `VOICE.md` and the template's conventions:
headings from `##`, never jumping a level; the pull quote as `> "…"`
lifted verbatim from the text; the closing paragraph before the FAQ with
the site's call to action as the template shows it; the FAQ heading as
the template has it with the `###` questions and one paragraph each;
internal links site-relative. Hold the outline's word counts. One line in
chat (the path, the word count); no body in chat. Go on to Stage 3.

## Stage 3 — the critique (gate)

The two reviews run in isolation from this conversation; that is what
makes them worth having. On a client with subagents (Claude Code), run
the `editorial:voice-reviewer` and `editorial:critic` agents in parallel
(one message, two Agent calls), each told the file path. On a client
without them (Codex), ask the user to run `editorial:review-voice` and
`editorial:critic` on the file in a fresh session each and paste the two
reports back; running the two skills in this session is the fallback,
and the aggregate then says so, because the reviewer saw the draft being
written. Aggregate the two reports into one:
the voice findings by severity, the prose cuts, every fact-check verdict
with its sources. The user chooses; apply the chosen cuts and rewrites in
the file; a FALSE or UNVERIFIED claim is rewritten or removed, never
kept on trust. Stop.

## Stage 4 — the SEO fields (gate)

`seoTitle` (60 characters or fewer, the keyword first, ` | ` + the
site's name last), `seoDescription` (70–160, the keyword in it),
`keywords` (3–8), `related` (the internal-link targets), the `excerpt`
re-read against the body (30–40 words, not the title again). `pnpm
content:lint`: fix every `FAIL` on the file, read every `WARN`. Stop.

## Hand-off

`new-post` steps 3 (the images: the user's, or made from the workshop's
`prompts` role), 5, 6 and 7 (lint, verify, commit). Publishing is the
user's flip of `draft` and `publishedAt`.

## Stop for the user

The resolved inputs (Stage 0); the outline (1); the critique (3); the
SEO fields (4); the images; the push. Never a date, an article number or
a named entity the inputs did not carry: ask.
