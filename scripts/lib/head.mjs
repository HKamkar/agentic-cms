// What the SEO audit reads from a page's <head>: the document's <title>s
// (there must be exactly one) — never an inline <svg>'s <title>, which names
// an icon, not the page.
export const headOf = (html) => html.match(/<head[\s>][\s\S]*?<\/head>/)?.[0] ?? html;

/** The <title> texts inside <head>, undecoded. */
export const pageTitles = (html) => [...headOf(html).matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
