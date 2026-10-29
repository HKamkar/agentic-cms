// The languages of a built site, as the SEO audit (scripts/check-seo.mjs)
// holds them (docs/locales.md): every page's `lang` and og:locale are its
// language's, and a page built in more than one language names each
// version — itself among them — and x-default, the default language's, in
// its head and in its sitemap entry, and is named back by each version it
// names. All of it is read from the build: a page's versions are the built
// routes at its path in each language. `locales` is kit.locales.all.

/** The language of a route: the locale whose prefix is its first segment, else the default one. */
export function localeOf(route, locales) {
  return locales.find(({ prefix }) => prefix && (route === `/${prefix}` || route.startsWith(`/${prefix}/`))) ?? locales.find((locale) => locale.isDefault);
}

const unprefixed = (route, locales) => {
  const { prefix } = localeOf(route, locales);
  return prefix ? route.slice(prefix.length + 1) || "/" : route;
};
const inLocale = ({ prefix }, base) => (!prefix ? base : base === "/" ? `/${prefix}` : `/${prefix}${base}`);
// Next writes the root's URL as the bare origin; both spellings are the same URL.
const sameUrl = (a, b) => a.replace(/\/$/, "") === b.replace(/\/$/, "");

/** The built versions of a route, tag → route, the default language's first. */
export function versionsOf(route, routes, locales) {
  const base = unprefixed(route, locales);
  return new Map(locales.flatMap((locale) => (routes.has(inLocale(locale, base)) ? [[locale.locale, inLocale(locale, base)]] : [])));
}

/**
 * What is wrong with a page's languages: its `lang` and og:locale, then its
 * hreflang links (`alternates`, [{ hreflang, href }]) against its built
 * versions and, for the way back, the links of each version
 * (`alternatesOf(route)`). Each finding is { rule, msg }.
 */
export function languageFindings({ route, lang, ogLocale, alternates, routes, locales, siteUrl, alternatesOf }) {
  const locale = localeOf(route, locales);
  const findings = [];
  // A page with no lang at all is the audit's `html` rule already.
  if (lang !== undefined && lang !== locale.locale) findings.push({ rule: "html", msg: `<html lang="${lang ?? ""}"> is not ${locale.locale}, the language of ${route}` });
  const source = locale.isDefault ? "site.ogLocale" : `the ogLocale of ${locale.locale} in site.locales`;
  if (locale.ogLocale && ogLocale !== locale.ogLocale) findings.push({ rule: "open-graph", msg: ogLocale ? `og:locale ${ogLocale} is not ${locale.ogLocale}, ${source}` : `og:locale missing: ${source} is ${locale.ogLocale}` });
  const fail = (msg) => findings.push({ rule: "hreflang", msg });
  const url = (target) => siteUrl + target;
  const named = new Map();
  for (const { hreflang, href } of alternates) {
    if (named.has(hreflang)) fail(`hreflang ${hreflang} twice`);
    else named.set(hreflang, href);
  }
  const versions = versionsOf(route, routes, locales);
  if (versions.size < 2) {
    for (const [tag, href] of named) fail(`hreflang ${tag} → ${href}, and ${route} is built in one language: a page names its versions when it has another`);
    return findings;
  }
  for (const [tag, target] of versions) {
    const href = named.get(tag);
    if (!href) fail(tag === locale.locale ? `no hreflang ${tag} for the page itself` : `no hreflang ${tag}: its version ${target} is built`);
    else if (!sameUrl(href, url(target))) fail(`hreflang ${tag} → ${href}, not its version ${url(target)}`);
  }
  const fallback = versions.get(locales.find((candidate) => candidate.isDefault).locale);
  const xDefault = named.get("x-default");
  if (fallback && !xDefault) fail(`no hreflang x-default: the default language's version is ${url(fallback)}`);
  else if (fallback && !sameUrl(xDefault, url(fallback))) fail(`hreflang x-default → ${xDefault}, not the default language's version ${url(fallback)}`);
  const tags = locales.map((candidate) => candidate.locale);
  for (const [tag, href] of named) {
    if (tag === "x-default") continue;
    if (!tags.includes(tag)) fail(`hreflang ${tag} is no language of the site (${tags.join(", ")})`);
    else if (!versions.has(tag)) fail(`hreflang ${tag} → ${href}: ${route} has no version built in ${tag}`);
    else if (versions.get(tag) !== route && sameUrl(href, url(versions.get(tag))) && !(alternatesOf(versions.get(tag)) ?? []).some((back) => back.hreflang === locale.locale && sameUrl(back.href, url(route)))) {
      fail(`one-way: ${versions.get(tag)} does not name ${route} back as hreflang ${locale.locale}`);
    }
  }
  return findings;
}

/**
 * What is wrong with the sitemap's alternates: each entry's
 * (`entries`, [{ loc, alternates }]) must be its page's head's
 * (`alternatesOf(route)`), the same tags at the same URLs.
 */
export function sitemapLanguageFindings(entries, alternatesOf, siteUrl) {
  const key = (list) => list.map(({ hreflang, href }) => `${hreflang} ${href.replace(/\/$/, "")}`).sort().join(", ") || "none";
  return entries.flatMap(({ loc, alternates }) => {
    const head = alternatesOf(loc.slice(siteUrl.length).replace(/\/$/, "") || "/");
    if (!head || key(head) === key(alternates)) return [];
    return [{ rule: "sitemap", msg: `${loc}: the sitemap's alternates (${key(alternates)}) are not the page's (${key(head)})` }];
  });
}
