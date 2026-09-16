---
name: retire-content
description: Take a post or a page off the site without breaking an indexed URL - a post becomes a draft (its URL stays indexed), a page is removed only once a redirect is in place - and prove it with the lint and the build. Use when asked to retire, unpublish, hide, take down, archive or delete a post or a page.
argument-hint: <post slug | page slug>
---

# Retire content

The repo is the current directory. Public URLs are indexed; deleting a
file makes its URL a 404. Redirects live on the host, in whatever list
the repo's `CLAUDE.md` or `README.md` documents; until one exists,
retiring means hiding, not deleting.

## Read first

The repo's notes on redirects (`CLAUDE.md`, `README.md`), the file being
retired, and `grep -rn "<slug>" content src` for everything that points
at it.

## Steps for a post

1. Set `draft: true` in `content/blog/<slug>.md`; keep the file, the dates
   and the images (a draft still counts as a post for the lint's orphan
   rule, and the URL comes back the day the post does).
2. Remove the slug from every other post's `related` list (a draft is a
   valid reference, but "Read next" must not point at a hidden post).
3. Add a row with status `retired` to `content/editorial/calendar.md`: the
   status report shows it, and the lint's `draft-stale` rule leaves a
   retired draft alone (any other draft older than 30 days is nagged).
4. `pnpm content:lint`, then **verify** (below): the sitemap and the feed
   lose the entry; `check-seo` confirms nothing links to it.
5. Commit `Retire: <slug>` on the repo's working branch.

## Steps for a page

Only once a redirect for its route exists (stop and say so otherwise):
delete `content/pages/<slug>.yaml`, its entries in `links`, `nav` and
`footer.quickLinks` in `src/config/site.ts`, every internal link to it
(`check-seo`'s links rule catches the rest), `public/images/<slug>/` and
its OG image. `scripts/parity.sh` before and after must differ only in
that page and the chrome of the others. Verify, commit `Retire: /<slug>`.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # 0 failures
pnpm preview                                                # the route is gone (a retired post 404s); then stop it
git push                                                    # when the user says
```

## Stop for the user

Before touching a page at all (unless a redirect exists); before deleting
any file rather than drafting it; the push.
