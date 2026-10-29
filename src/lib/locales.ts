// The site's languages: the default one (`site.locale`) at the root, and
// each of `site.locales` under its prefix with the default's slugs
// (/about → /de/about). A locale's words and links are its entry in the
// config; its content sits beside the default's — a folder collection's
// under content/<dir>/<prefix>/, a file collection's in
// content/<stem>.<prefix>.<ext> — and pairs with it by slug, with no
// fallback to the default language: a translation a page reads and nobody
// wrote fails the build naming the file. Nothing here reads a file when the
// kit is made. The guide is docs/locales.md; experimental
// (docs/stability.md).

import { ContentError } from "./content/errors.ts";
import type { CollectionDef, Entry } from "./content/define.ts";
import type { SiteConfig } from "./site.ts";

/** One language of the site: its tag, its URL prefix ("" for the default one) and its Open Graph locale. */
export type Locale = { readonly locale: string; readonly prefix: string; readonly ogLocale?: string; readonly isDefault: boolean };

// A prefix is a lowercase language tag, so it is never one of the site's own folders (`images`, `_next`); `api` is the form endpoint's.
const PREFIX = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/;
const RESERVED = ["api"];

/** Throws, naming the entry and the field, on a locale the kit cannot serve. */
export function checkLocales(site: SiteConfig): void {
  const tags = new Set([site.locale]);
  const prefixes = new Set<string>();
  const postSegment = site.postPrefix.split("/")[1];
  (site.locales ?? []).forEach((entry, index) => {
    const at = `site.locales[${index}]`;
    if (!entry.locale?.trim()) throw new Error(`${at}.locale is required: the language tag, e.g. "de"`);
    if (tags.has(entry.locale)) throw new Error(`${at}.locale "${entry.locale}" is ${entry.locale === site.locale ? "the default language, site.locale" : "listed twice"}`);
    if (!PREFIX.test(entry.prefix ?? "")) throw new Error(`${at}.prefix "${entry.prefix}" must be a lowercase language tag such as "de" or "pt-br": the first segment of the language's URLs`);
    if (prefixes.has(entry.prefix)) throw new Error(`${at}.prefix "${entry.prefix}" is listed twice`);
    if (RESERVED.includes(entry.prefix) || entry.prefix === postSegment) throw new Error(`${at}.prefix "${entry.prefix}" is a route of the site's own`);
    if (!entry.ogLocale?.trim()) throw new Error(`${at}.ogLocale is required: the Open Graph locale, e.g. "de_DE"`);
    tags.add(entry.locale);
    prefixes.add(entry.prefix);
  });
}

/** The site's languages and where each one's pages, words and content are (`kit.locales`). */
export function createLocales(site: SiteConfig) {
  checkLocales(site);
  const all: readonly Locale[] = [
    { locale: site.locale, prefix: "", ogLocale: site.ogLocale, isDefault: true },
    ...(site.locales ?? []).map(({ locale, prefix, ogLocale }) => ({ locale, prefix, ogLocale, isDefault: false })),
  ];
  const sites = new Map<string, SiteConfig>();
  const translations = new Map<CollectionDef, Map<string, CollectionDef>>();

  /** The locale with the tag, or throws naming the ones the site has. */
  function get(tag: string): Locale {
    const found = all.find((candidate) => candidate.locale === tag);
    if (!found) throw new Error(`no locale "${tag}": the site has ${all.map((candidate) => candidate.locale).join(", ")} (site.locale, site.locales)`);
    return found;
  }

  /** The locale of a site-relative path: the one whose prefix is its first segment, else the default one. */
  const of = (path: string): Locale => all.find(({ prefix }) => prefix && new RegExp(`^/${prefix}(?:[/?#]|$)`).test(path)) ?? all[0];

  /** A default page's path in the locale: "/" → "/de", "/about" → "/de/about"; in the default locale, the path itself. */
  function path(tag: string, defaultPath: string): string {
    const { prefix } = get(tag);
    if (!prefix) return defaultPath;
    return defaultPath === "/" ? `/${prefix}` : `/${prefix}${defaultPath}`;
  }

  /** The default path of a page's path in any locale: "/de/about" → "/about", "/de" → "/". */
  function unprefixed(pagePath: string): string {
    const { prefix } = of(pagePath);
    return prefix ? pagePath.slice(prefix.length + 1) || "/" : pagePath;
  }

  /** The site's config as the locale reads it: its tag, Open Graph locale, words and links in place of the default's. */
  function siteIn(tag: string): SiteConfig {
    if (get(tag).isDefault) return site;
    const known = sites.get(tag);
    if (known) return known;
    const { locale, ogLocale, tagline, description, links, nav, signIn, cta, footer, faqHeading = site.faqHeading } = site.locales!.find((entry) => entry.locale === tag)!;
    const scoped = { ...site, locale, ogLocale, tagline, description, links, nav, signIn, cta, footer, faqHeading };
    sites.set(tag, scoped);
    return scoped;
  }

  /**
   * The collection's translation into the locale: a folder's entries under
   * <dir>/<prefix>/, a file's in <stem>.<prefix>.<ext>; in the default
   * locale, the collection itself. One definition per collection and
   * locale, so the engine's cache holds.
   */
  function collection<D extends CollectionDef>(def: D, tag: string): D {
    const { prefix } = get(tag);
    if (!prefix) return def;
    const byPrefix = translations.get(def) ?? new Map<string, CollectionDef>();
    translations.set(def, byPrefix);
    const translated = byPrefix.get(prefix) ?? (def.kind === "folder" ? { ...def, name: `${def.name}.${prefix}`, dir: `${def.dir}/${prefix}` } : { ...def, name: `${def.name}.${prefix}`, file: def.file.replace(/(\.[^./]+)$/, `.${prefix}$1`) });
    byPrefix.set(prefix, translated);
    return translated as D;
  }

  return { default: all[0], all, get, of, path, unprefixed, site: siteIn, collection };
}

export type Locales = ReturnType<typeof createLocales>;

/** Every collection translated into the locale but the redirects, one list for every language. */
export function collectionsIn<C extends Record<string, CollectionDef>>(locales: Locales, collections: C, tag: string): C {
  return Object.fromEntries(Object.entries(collections).map(([key, def]) => [key, key === "redirects" ? def : locales.collection(def, tag)])) as C;
}

type PageEntry = Entry<{ seo: { path: string } }>;

/**
 * Throws a ContentError for a page file out of place: a default page under
 * a locale's prefix, or a page in another language that translates no
 * default page of its file name or sits anywhere but at that page's path
 * under its prefix.
 */
export function checkPagePaths(locales: Locales, tag: string, pages: readonly PageEntry[], defaults: () => readonly PageEntry[]): void {
  const locale = locales.get(tag);
  if (locale.isDefault) {
    for (const { file, data } of pages) {
      const { prefix } = locales.of(data.seo.path);
      if (prefix) throw new ContentError(file, "seo.path", `"${data.seo.path}" is under /${prefix}, the prefix of ${locales.of(data.seo.path).locale}: a page in that language is content/pages/${prefix}/<slug>.yaml`);
    }
    return;
  }
  const byFile = new Map(defaults().map((entry) => [entry.slug, entry.data.seo.path]));
  for (const { slug, file, data } of pages) {
    const original = byFile.get(slug);
    if (original === undefined) throw new ContentError(file, "", `translates no page: content/pages/${slug}.yaml does not exist, and a page in ${tag} is the translation of the default page with its file name`);
    const expected = locales.path(tag, original);
    if (data.seo.path !== expected) throw new ContentError(file, "seo.path", `"${data.seo.path}" must be "${expected}", the path of content/pages/${slug}.yaml under /${locale.prefix}`);
  }
}
