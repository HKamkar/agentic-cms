// A page's versions in the site's languages, and what the head and the
// sitemap say about them: an hreflang alternate for each version, the page's
// own among them, x-default for the default language's, and Open Graph's
// other locales. A page in one language names none, so a site without
// locales writes what it did. No redirect by the visitor's language: a
// search engine picks the version, the reader keeps the URL they followed.

import type { Metadata } from "next";
import type { Locale, Locales } from "../locales.ts";

export type Version = { locale: Locale; path: string };

/** `pathsIn(tag)` is every path the language has a page at. */
export function createVersions(locales: Locales, pathsIn: (tag: string) => ReadonlySet<string>) {
  /** The page's versions, the default language's first: its path in each language that has one. */
  function versions(path: string): Version[] {
    const base = locales.unprefixed(path);
    return locales.all.flatMap((locale) => {
      const candidate = locales.path(locale.locale, base);
      return pathsIn(locale.locale).has(candidate) ? [{ locale, path: candidate }] : [];
    });
  }

  /** hreflang → path for every version and x-default for the default language's; undefined for a page in one language. */
  function languages(path: string): Record<string, string> | undefined {
    const found = versions(path);
    if (found.length < 2) return undefined;
    const fallback = found.find((version) => version.locale.isDefault);
    return Object.fromEntries([...found.map((version) => [version.locale.locale, version.path]), ...(fallback ? [["x-default", fallback.path]] : [])]);
  }

  /** The head with the page's other versions: its hreflang alternates and Open Graph's other locales. */
  function withVersions(metadata: Metadata, path: string): Metadata {
    const alternates = languages(path);
    if (!alternates) return metadata;
    const self = locales.of(path);
    const others = versions(path).flatMap((version) => (version.locale === self || !version.locale.ogLocale ? [] : [version.locale.ogLocale]));
    return { ...metadata, alternates: { ...metadata.alternates, languages: alternates }, openGraph: { ...metadata.openGraph, ...(others.length ? { alternateLocale: others } : {}) } };
  }

  return { versions, languages, withVersions };
}
