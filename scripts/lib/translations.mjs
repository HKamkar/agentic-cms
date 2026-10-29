// The translations of a site's collections that are on disk, for the
// commands that read every content file — the content lint, `agentic-cms
// check`, `agentic-cms schema --lines` (docs/locales.md). A translation
// nobody wrote is no finding here: a page that reads one fails the build,
// naming the file. `locales` is kit.locales; a site without other
// languages has none.
import fs from "node:fs";
import path from "node:path";

/** [{ locale, key, original, def }]: each other language's translation of each collection but the redirects, one list for every language, when it is under `root`. */
export function translations({ collections, locales, root = process.cwd(), fsys = fs }) {
  if (!locales) return [];
  return locales.all
    .filter((locale) => !locale.isDefault)
    .flatMap((locale) => Object.entries(collections).filter(([key]) => key !== "redirects").map(([key, original]) => ({ locale, key, original, def: locales.collection(original, locale.locale) })))
    .filter(({ def }) => fsys.existsSync(path.join(root, "content", def.kind === "folder" ? def.dir : def.file)));
}
