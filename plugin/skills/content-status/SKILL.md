---
name: content-status
description: Report the state of the site's content from the files, read-only, with nothing invented - posts by date with drafts and stale drafts, pages and when their copy changed, FAQ sets, reviews, use cases, the editorial calendar and backlog, the workshop's briefs in flight, recent changes, and the content lint's warnings by rule. Use when asked what is live, what is in draft, what is planned, what changed recently, or for a content status, blog status or editorial snapshot.
argument-hint: [--since 30.days]
---

# Content status

The repo is the current directory. Read-only. Three commands print
everything; the report repeats what they printed and adds nothing.

## Steps

1. `pnpm content:lint`: keep the summary line and count the `WARN` lines by
   rule (`awk '{print $3}'` on the `WARN` lines).
2. `pnpm content:status [--since <window>]`: the posts (with `draft (N days)`
   where a draft is older than the lint's 30-day rule), the pages and their
   `updated`, the FAQ sets, reviews and use cases, the calendar's upcoming
   rows, the backlog, the workshop (`content/editorial/workshop.yaml`:
   present in this checkout or not; its briefs and newest research when it
   is), the commits under `content/` in the window.
3. Read `content/editorial/calendar.md` and `content/editorial/backlog.md`
   for the context the rows abbreviate.
4. **Report**, in this order: what is live (posts, pages); what is in draft
   and for how long; what is planned next (the calendar rows), the briefs
   in flight in the workshop, the backlog size; what changed recently; the
   lint's warning count by rule and the one or two rules a content pass
   should start with. Numbers and slugs come from the output, never from
   memory; nothing is edited.

## Verify

Nothing runs but the three read-only commands; no file changes, no build.
