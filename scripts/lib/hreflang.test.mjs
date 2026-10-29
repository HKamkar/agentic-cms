import assert from "node:assert/strict";
import { test } from "node:test";
import { languageFindings, localeOf, sitemapLanguageFindings, versionsOf } from "./hreflang.mjs";

const LOCALES = [
  { locale: "en", prefix: "", ogLocale: "en_US", isDefault: true },
  { locale: "de", prefix: "de", ogLocale: "de_DE", isDefault: false },
];
const SITE = "https://brand.example";
const ROUTES = new Set(["/", "/about", "/blog", "/de", "/de/about"]);
const both = (tag) => [{ hreflang: "en", href: `${SITE}/about` }, { hreflang: "de", href: `${SITE}/de/about` }, { hreflang: "x-default", href: `${SITE}/about` }].filter((link) => link.hreflang !== tag);
const HEADS = new Map([["/about", both()], ["/de/about", both()]]);
const findings = (route, page = {}, heads = HEADS) => languageFindings({ route, lang: localeOf(route, LOCALES).locale, ogLocale: localeOf(route, LOCALES).ogLocale, alternates: heads.get(route) ?? [], routes: ROUTES, locales: LOCALES, siteUrl: SITE, alternatesOf: (target) => heads.get(target), ...page }).map(({ rule, msg }) => `${rule}: ${msg}`);

test("a route's language is its prefix's, and its versions the built routes at its path in each language", () => {
  assert.deepEqual(["/", "/about", "/de", "/de/about", "/design"].map((route) => localeOf(route, LOCALES).locale), ["en", "en", "de", "de", "en"]);
  assert.deepEqual([...versionsOf("/de/about", ROUTES, LOCALES)], [["en", "/about"], ["de", "/de/about"]]);
  assert.deepEqual([...versionsOf("/blog", ROUTES, LOCALES)], [["en", "/blog"]]);
});

test("a page in two languages that names both and x-default, named back by its version, passes; so does one in one language that names none", () => {
  assert.deepEqual(findings("/about"), []);
  assert.deepEqual(findings("/de/about"), []);
  assert.deepEqual(findings("/blog"), []);
  assert.deepEqual(findings("/", { alternates: [] }, new Map([["/de", []]])), ["hreflang: no hreflang en for the page itself", "hreflang: no hreflang de: its version /de is built", "hreflang: no hreflang x-default: the default language's version is https://brand.example/"]);
});

test("the page's lang and og:locale are its language's", () => {
  assert.deepEqual(findings("/de/about", { lang: "en" }), ['html: <html lang="en"> is not de, the language of /de/about']);
  assert.deepEqual(findings("/de/about", { ogLocale: "en_US" }), ["open-graph: og:locale en_US is not de_DE, the ogLocale of de in site.locales"]);
  assert.deepEqual(findings("/about", { ogLocale: undefined }), ["open-graph: og:locale missing: site.ogLocale is en_US"]);
});

test("each wrong hreflang is named: a missing version or self-reference, a wrong URL, a tag the site has not, a version not built, a one-way link, a page in one language that names some", () => {
  const with_ = (alternates) => findings("/about", { alternates });
  assert.deepEqual(with_(both("de")), ["hreflang: no hreflang de: its version /de/about is built"]);
  assert.deepEqual(with_(both("en")), ["hreflang: no hreflang en for the page itself"]);
  assert.deepEqual(with_(both("x-default")), ["hreflang: no hreflang x-default: the default language's version is https://brand.example/about"]);
  assert.deepEqual(with_([...both("de"), { hreflang: "de", href: `${SITE}/de` }]), ["hreflang: hreflang de → https://brand.example/de, not its version https://brand.example/de/about"]);
  assert.deepEqual(with_([...both(), { hreflang: "fr", href: `${SITE}/fr/about` }]), ["hreflang: hreflang fr is no language of the site (en, de)"]);
  assert.deepEqual(with_([...both(), { hreflang: "de", href: `${SITE}/de/about` }]), ["hreflang: hreflang de twice"]);
  assert.deepEqual(findings("/about", {}, new Map([["/about", both()], ["/de/about", []]])), ["hreflang: one-way: /de/about does not name /about back as hreflang en"]);
  assert.deepEqual(findings("/blog", { alternates: [{ hreflang: "de", href: `${SITE}/de/blog` }] }), ["hreflang: hreflang de → https://brand.example/de/blog, and /blog is built in one language: a page names its versions when it has another"]);
});

test("the sitemap's alternates are the head's, whatever their order", () => {
  const entries = [{ loc: `${SITE}/about`, alternates: both().reverse() }, { loc: `${SITE}/blog`, alternates: [] }];
  assert.deepEqual(sitemapLanguageFindings(entries, (route) => HEADS.get(route) ?? [], SITE), []);
  const stale = [{ loc: `${SITE}/de/about`, alternates: both("de") }];
  assert.deepEqual(sitemapLanguageFindings(stale, (route) => HEADS.get(route), SITE), ["https://brand.example/de/about: the sitemap's alternates (en https://brand.example/about, x-default https://brand.example/about) are not the page's (de https://brand.example/de/about, en https://brand.example/about, x-default https://brand.example/about)"].map((msg) => ({ rule: "sitemap", msg })));
});
