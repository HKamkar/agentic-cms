// A second language laid over a fresh site, as docs/locales.md § Adding a
// language says a site adds its first one, for the pack smoke: the default
// language's routes moved into src/app/(default)/, the guide's
// global-not-found and the Next config's flag, a German root layout and
// catch-all copied from the default's with LOCALE its tag, site.locales and
// the chrome's German words, the German home page — the translation of the
// starter's — and its voice block. The guide's own code is what is laid:
// global-not-found is read from its block in docs/locales.md.
import fs from "node:fs";
import path from "node:path";

export const GERMAN = { locale: "de", prefix: "de", ogLocale: "de_DE" };

const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
const move = (root, from, to) => { fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true }); fs.renameSync(path.join(root, from), path.join(root, to)); };

/** `from` replaced in a text that must hold it once, or throws naming the file: the fixture follows the starter's files. */
function swap(file, text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`locale fixture: ${file} does not hold ${JSON.stringify(String(from).slice(0, 60))} once`);
  return text.replace(from, to);
}

/** A file as the guide writes it: the fenced block after `<!-- locales: <file> -->` in the kit's docs/locales.md. */
export function guideFile(kitRoot, file) {
  const doc = read(kitRoot, "docs/locales.md");
  const at = doc.indexOf(`<!-- locales: ${file} -->`);
  const block = at === -1 ? null : doc.slice(at).match(/```\w*\n([\s\S]*?)```/);
  if (!block) throw new Error(`locale fixture: docs/locales.md has no block for ${file}`);
  return block[1];
}

/** site.locales' German entry, its links under /de; the sign-in link the site's own. */
const localeEntry = (signIn) => `  locales: [
    {
      locale: "de",
      prefix: "de",
      ogLocale: "de_DE",
      tagline: "Was die Website tut, in einem Satz.",
      description: "Was ein Leser im Blog der Website findet.",
      links: { home: "/de", blog: "/blog", contact: "/de#contact-form" },
      nav: [
        { label: "Startseite", href: "/de" },
        { label: "Kontakt", href: "/de#contact-form" },
      ],
      signIn: { label: "Anmelden", href: "${signIn}" },
      cta: { label: "Kontakt", href: "/de#contact-form" },
      footer: { quickLinks: [{ label: "Startseite", href: "/de" }], social: [] },
    },
  ],
`;

/** The chrome's and the consent banner's German words, copy's block for de. */
const GERMAN_WORDS = `  de: {
    chrome: {
      skipLink: "Zum Inhalt springen",
      navbar: { label: "Hauptmenü", menu: "Menü" },
      themeToggle: { system: "Farbschema: System", light: "Farbschema: hell", dark: "Farbschema: dunkel" },
      footer: { quickLinks: "Schnellzugriff", social: "Folgen Sie uns" },
      notFound: { label: "404", title: "Diese Seite gibt es nicht.", text: ["Zurück zur ", { label: "Startseite", href: "/de" }, "."] },
      post: { eyebrow: "Beitrag", readingTime: (minutes: number) => \`\${minutes} Min. Lesezeit\`, related: "Weiterlesen" },
    },
    consentBanner: { title: "Analyse-Cookies", text: "Dürfen wir Besuche mit Google Analytics messen?", decline: "Ablehnen", allow: "Erlauben", settings: "Cookie-Einstellungen" },
  },
`;

/** The starter's home page in German: its seo block in the language, its path under the prefix, its schema line from its folder. */
function germanHome(text) {
  let page = swap("content/pages/home.yaml", text, "# yaml-language-server: $schema=../_schemas/pages.json", "# yaml-language-server: $schema=../../_schemas/pages.json");
  page = swap("content/pages/home.yaml", page, "\n  path: /\n", "\n  path: /de\n");
  page = page.replace(/^ {2}title: .*$/m, '  title: "Die Startseite auf Deutsch"');
  page = page.replace(/^ {2}description: .*$/m, '  description: "Was ein Leser auf der deutschen Startseite findet, in einem Satz, der in den Suchergebnissen steht."');
  return swap("content/pages/home.yaml", page, "\n  breadcrumb: Home\n", "\n  breadcrumb: Startseite\n");
}

/** Lays German over the site at `site`, the guide read from the kit at `kitRoot`. */
export function layLocale(site, kitRoot) {
  for (const entry of ["layout.tsx", "[[...slug]]", "blog-post", "not-found.tsx"]) move(site, `src/app/${entry}`, `src/app/(default)/${entry}`);
  write(site, "src/app/(default)/layout.tsx", swap("layout.tsx", read(site, "src/app/(default)/layout.tsx"), 'import "./globals.css";', 'import "../globals.css";'));
  write(site, "src/app/global-not-found.tsx", guideFile(kitRoot, "src/app/global-not-found.tsx"));
  write(site, "next.config.ts", swap("next.config.ts", read(site, "next.config.ts"), "  images: { unoptimized: true },\n", "  images: { unoptimized: true },\n  // A root layout per language: a path no page answers gets src/app/global-not-found.tsx (docs/locales.md).\n  experimental: { globalNotFound: true },\n"));
  const inGerman = (file) => swap(file, read(site, file), "const LOCALE = kit.locales.default.locale;", 'const LOCALE = "de";');
  write(site, "src/app/de/layout.tsx", inGerman("src/app/(default)/layout.tsx"));
  write(site, "src/app/de/[[...slug]]/page.tsx", inGerman("src/app/(default)/[[...slug]]/page.tsx"));
  const config = read(site, "src/config/site.ts");
  const signIn = config.match(/signIn: \{ label: "[^"]*", href: "([^"]+)" \}/)?.[1];
  if (!signIn) throw new Error("locale fixture: src/config/site.ts names no signIn link");
  const withLocales = swap("src/config/site.ts", config, "} as const satisfies SiteConfig;", `${localeEntry(signIn)}} as const satisfies SiteConfig;`);
  write(site, "src/config/site.ts", swap("src/config/site.ts", withLocales, "  [site.locale]: { chrome, consentBanner },\n", `  [site.locale]: { chrome, consentBanner },\n${GERMAN_WORDS}`));
  write(site, "content/pages/de/home.yaml", germanHome(read(site, "content/pages/home.yaml")));
  write(site, "content/VOICE.de.md", read(site, "content/VOICE.md"));
}
