---
name: review-voice
description: Review a content file against content/VOICE.md for what the lint cannot judge - claims, numbers, regulation naming, rhythm, structure - after quoting the lint's own findings on it, and report HIGH / MEDIUM / LOW with a verdict. Use when asked to brand-review, voice-check, lint, audit or read a draft or a page for voice, claims, AI-tic prose or readiness, or "is this on-brand" / "is this ready to publish".
argument-hint: <path under content/>
---

# Review voice

The repo is the current directory. The file is the one the user named
(`content/blog/<slug>.md`, `content/pages/<slug>.yaml`, a FAQ set); if
none, ask. One file per run: a report on every draft at once is too long
to act on.

## Read first

`content/VOICE.md` in full: the reader, the non-negotiables, the claims,
the writing rules, and the fenced block (the exact rules the lint runs).
`content/blog/_template.md` for a post's structural fields. Then the file.

## Passes

1. **The lint's lines.** Run `pnpm content:lint` and quote every line
   for this file verbatim: those are the exact rules (banned words and
   patterns, the brand's spelling and mark, model and cloud names, em
   dashes, alts, counts, headings, images, dates) and are not re-judged;
   a `FAIL` is a HIGH finding as it stands. If the command cannot run
   (no permission in this session), say so on the `Lint:` line and check
   the block's exact rules by hand, marked as a hand-check.
2. **Claims** (HIGH): compliance or certification language `VOICE.md`
   forbids, however phrased; numbers without a documented source; a
   customer, logo, quote or case study without approval; a roadmap
   promise; anything `VOICE.md` says is never said (offers named wrongly,
   the incumbent framed wrongly, entities it never names).
3. **Naming** (MEDIUM): a regulation or standard abbreviated before its
   full name; the offers and the category spelled as `VOICE.md` spells
   them; the calls to action as it prescribes them.
4. **Voice** (LOW): the generated cadence (short-long-short-long), a
   rhetorical question opening a section, hedging chains, three-item
   rhythms, abstract value statements that fit any vendor, a paragraph
   that restates the previous one, title case where the rules say
   sentence case.
5. **Structure** (MEDIUM, posts): the closing call to action, the pull
   quote, the FAQ heading with 3–5 questions and answers, the excerpt's
   30–40 words, an alt per image, headings from `##`.

## Report

```
VOICE REVIEW — <file> — <YYYY-MM-DD>
Lint: <its lines for this file, or "clean">
HIGH: <n>  MEDIUM: <n>  LOW: <n>
Verdict: READY | FIX HIGH FIRST | NOT SHIPPABLE

[H1] <where> <category>
Found: "<verbatim>"
Issue: <one line>
Fix:   "<the rewrite>"
… (MEDIUM, LOW the same)
```

NOT SHIPPABLE on any lint `FAIL`, any claim the rules forbid, or five or
more HIGH; FIX HIGH FIRST on one to four HIGH; READY otherwise. Quote
verbatim; no preamble, no closing summary.

## Then

Only with the user's approval, apply the chosen fixes in the file and
run `pnpm content:lint` again; a post that has `publishedAt` follows
`update-post` step 2 for its date. On Claude Code the `voice-reviewer`
agent runs this same procedure in isolation and stops at the report; on
a client without subagents, a fresh session running this skill is the
isolated pass.
