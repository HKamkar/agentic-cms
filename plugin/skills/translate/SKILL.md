---
name: translate
description: Draft the translation of a page, a post or a collection into another language the site serves (site.locales), next to the original and paired by its slug, for a native speaker to check before it ships; a legal text is translated sentence by sentence, never rewritten. Use when asked to translate, localise or add a language version of a page, a post, a FAQ set or a collection, or to bring a translation up to date with its original.
argument-hint: <file> <language tag>
---

# Translate

The repo is the current directory. A site in several languages declares
each in `site.locales` (`src/config/site.ts`): its tag, its prefix, its
words. A translation sits beside its original and pairs with it by slug,
and nothing is ever filled from the default language. This skill drafts
it; a native speaker of the language checks it before it is committed.
An agent's translation is a draft, never the last word.

## Read first

`docs/locales.md` (under `node_modules/agentic-cms/` on a site that
installs the package): where a translation goes and what the build
checks. The original file and its JSON Schema (`content/_schemas/`, the
path its first line names; a post's is `posts.json`). `content/VOICE.md`
and the language's own, `content/VOICE.<prefix>.md`. The language's entry
in `site.locales`: its prefix, and for a post its `faqHeading`. The
language's existing translations, for the terms they already use.

## Steps

1. **The language.** The tag must be one `site.locales` declares; one it
   does not is config, the user's call (an entry in `site.locales`, a
   block in `copy`, the routes `docs/locales.md` § Adding a language
   lists): stop and say so. Without `content/VOICE.<prefix>.md`, stop: the
   language's voice is the user's to set. Offer a draft of it,
   `VOICE.md`'s prose and block written for the language, for the
   native speaker to own.
2. **Where it goes.** A page `content/pages/<prefix>/<slug>.yaml`, a post
   `content/blog/<prefix>/<slug>.md`, a FAQ set
   `content/faqs/<prefix>/<key>.yaml`, a file collection
   `content/<stem>.<prefix>.<ext>` (`authors.de.json`, `reviews.de.yaml`)
   — the same slug, file name or key as the original. A YAML file's first
   line names its collection's schema from its own folder
   (`../../_schemas/pages.json`).
3. **The draft.** Translate the copy and nothing else: keys, section
   types, slugs, card counts, image paths, form names and dates stay as
   the original has them, but for these.
   - A page: `seo.path` is the original's under the prefix (`/de/about`,
     `/de` for the home page); `title` of 60 characters or fewer, unique
     across pages, and `description` of 70–160, written in the language
     for its readers, not word for word; `breadcrumb` in the language;
     `updated` today. A section that reads a collection (a FAQ set, the
     reviews, the use cases) needs that collection's translation too:
     list what the page reads and translate it in the same job. A form's
     words are its definition's in `src/config/forms.ts`: a page in the
     language names one written in it, which is code, the user's call.
   - A post: `draft: true` until the native speaker approves; its own
     `date` and, when it ships, its own `publishedAt`; its `author` and
     `category` keys must be in the language's registries
     (`authors.<prefix>.json`, `categories.<prefix>.json`): translate the
     entries that are missing. The FAQ heading is the language's
     `faqHeading`: without one, stop and ask, since the accordion and the
     FAQPage key off it. Alt texts are written for the language; the
     pictures stay the original's.
   - A collection file: every entry, in the original's order.
   - The brand is spelled as `VOICE.md` spells it, in every language.
4. **A legal text is translated, never rewritten.** A privacy policy,
   terms, an imprint, a notice — anything the user calls legal: sentence
   by sentence, its structure, numbering and defined terms kept, nothing
   added, nothing left out, no obligation softened or sharpened, no
   example localised. List every term with no settled equivalent in the
   language for the native speaker, and say that a lawyer for the
   language's market reads it before it ships.
5. **Bring a translation up to date.** When the original changed since
   (the lint's `translation-stale` names it: the original's `updated`, or
   a post's `updatedAt`, is later than the translation's), translate what
   changed, from `git log -p` on the original since the translation's
   date, and nothing else; set the translation's own `updated` /
   `updatedAt`.
6. **Lint until clean.** `pnpm content:check` (the page's place, the
   registries), then `pnpm content:lint`: the language's voice block, the
   SEO lengths, the post's structure. Fix every `FAIL`; read the `WARN`
   lines on the new file.
7. **For the native speaker.** Hand the user the file and a short list of
   what a native speaker must read first: the headings and the calls to
   action, every claim and figure, idioms, terms the language's existing
   pages translate differently, and for a legal text every listed term.
   Change nothing they did not ask for after their review.
8. **Verify** (below): the build's SEO audit holds the alternates between
   the two versions, both ways; then commit `Translate: <file> into <tag>`
   on the repo's working branch, on the user's word that a native speaker
   checked it.

## Verify

```bash
pnpm lint && pnpm test && pnpm content:lint && pnpm build   # 0 failures; read every WARN
pnpm preview                                                # pnpm start where the site has none; open the translation's URL and its original's; then stop it
git push                                                    # when the user says
```

## Stop for the user

A language `site.locales` does not declare, or one without its voice
file; a post's language without a `faqHeading`; a page whose form has no
definition in the language; before the commit, the native speaker's
review (a legal text: also the lawyer's); the push.
