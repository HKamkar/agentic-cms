// Lets plain Node run the TypeScript under src/ the way Turbopack does:
//
//   node --import ./scripts/lib/load-ts.mjs --test "src/**/*.test.ts"
//   import "./lib/load-ts.mjs"; const { kit } = await import("@/kit");
//
// Node strips the types itself (22.18+); what it cannot do is resolve the
// `@/` alias from tsconfig.json or an extensionless relative import, so a
// resolve hook rewrites exactly those two forms and nothing else. Every
// other specifier (a bare package, a CommonJS `require` inside gray-matter)
// goes to Node's resolver untouched: rewriting a specifier that already
// resolves breaks those require chains. The load hook names the format of a
// `.ts` file up front, which is what stops Node's "module type is not
// specified" warning — the warning is emitted inside the default loader, so
// patching its result afterwards is too late. `.tsx` is not supported: Node
// has no JSX, and nothing that runs here needs it.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The site's src/: the directory the process started in, read once here, so
// a script that changes directory afterwards (content-check --root, the
// content lint) still resolves `@/` to the site it was run from.
const SRC = pathToFileURL(path.join(process.cwd(), "src") + path.sep).href;
const CANDIDATES = [".ts", "/index.ts"];

const isRelative = (specifier) => specifier.startsWith("./") || specifier.startsWith("../");
const hasExtension = (specifier) => /\.[a-z]+$/i.test(specifier);

/** The first `.ts` / `/index.ts` file the extensionless specifier could mean, or undefined. */
function typescriptCandidate(specifier, parentURL) {
  const base = specifier.startsWith("file:") ? specifier : new URL(specifier, parentURL).href;
  return CANDIDATES.map((ext) => base + ext).find((url) => existsSync(fileURLToPath(url)));
}

registerHooks({
  resolve(specifier, context, next) {
    let target = specifier;
    if (target.startsWith("@/")) target = SRC + target.slice(2);
    if ((isRelative(target) || target.startsWith("file:")) && !hasExtension(target)) {
      target = typescriptCandidate(target, context.parentURL) ?? target;
    }
    return next(target, context);
  },
  load(url, context, next) {
    if (url.startsWith("file:") && url.endsWith(".ts")) return next(url, { ...context, format: "module-typescript" });
    return next(url, context);
  },
});
