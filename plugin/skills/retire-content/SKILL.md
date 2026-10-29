---
name: retire-content
description: Take a post or a page off the site without breaking an indexed URL - a post becomes a draft (its URL stays indexed) or goes with a redirect, a page goes with its redirect written into content/redirects.yaml - and prove it with the lint and the build. Use when asked to retire, unpublish, hide, take down, archive, move or delete a post or a page.
argument-hint: <post slug | page slug>
---

# Retire content

The repo is the current directory. Public URLs are indexed; deleting a
file makes its URL a 404. A redirect is content: an entry of
`content/redirects.yaml` (`from`, the old path; `to`, where its reader goes
now; `permanent`, true unless the user says the move is temporary), which
the site's Next config serves. A page never goes without one, and
`pnpm lint` warns about a page or post removed since the base branch whose
URL no redirect names.

## Read first

`content/redirects.yaml` and its schema (`content/_schemas/redirects.json`;
the entry's template, `content/_templates/redirect.yaml`), the file being
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

A post that should go for good, or that moved, goes as a page does (below):
its redirect from `<postPrefix>/<slug>` first, then the file, its images
and every link to it.

## Steps for a page

1. **Where its readers go.** Ask the user which page takes the retired
   one's readers (a page, a post or the blog index, or an `https://` URL);
   never guess it.
2. **The redirect.** Add an entry to `content/redirects.yaml` (in place of
   its `[]` while it has none): `from` the page's `seo.path`, `to` that
   target. Point every entry whose `to` was this path at the new target
   too: the lint fails a chain.
3. **The page.** Delete `content/pages/<slug>.yaml`, its entries in `links`,
   `nav` and `footer.quickLinks` in `src/config/site.ts`, every internal
   link to it (`check-seo`'s links rule catches the rest),
   `public/images/<slug>/` and its OG image. Then `pnpm content:check` and
   `pnpm content:lint`: a `from` a live page still has, a chain and a `to`
   that lands nowhere fail. `pnpm kit parity` before and after must differ
   only in that page and the chrome of the others.
4. Verify (the build's routes manifest, `.next/routes-manifest.json`,
   lists the redirect), commit `Retire: /<slug>`.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # 0 failures
pnpm preview                                                # pnpm start where the site has none; a retired post 404s, a redirected route answers 308 to its target; then stop it
git push                                                    # when the user says
```

## Stop for the user

Where a retired page's readers go (the redirect's `to`); before deleting
any file rather than drafting it; the push.
