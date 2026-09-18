// Lets plain Node run the TypeScript under src/ the way Turbopack does:
//
//   node --import ./scripts/lib/load-ts.mjs --test "src/**/*.test.ts"
//   import "./lib/load-ts.mjs"; const { kit } = await import("@/kit");
//
// Node strips the types itself (22.18+); what it cannot do is resolve the
// aliases of tsconfig.json (`@/*`, and in the kit's own checkout the
// package's name to its source) or an extensionless relative import, so a
// resolve hook rewrites exactly those forms and nothing else. Every other
// specifier (a bare package, a CommonJS `require` inside gray-matter) goes
// to Node's resolver untouched: rewriting a specifier that already resolves
// breaks those require chains. The load hook names the format of a `.ts`
// file up front, which is what stops Node's "module type is not specified"
// warning — the warning is emitted inside the default loader, so patching
// its result afterwards is too late; it never touches node_modules, where
// Node refuses to strip types and a package ships JavaScript. `.tsx` is not
// supported: Node has no JSX, and nothing that runs here needs it.
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The site is the directory the process started in, read once here, so a
// script that changes directory afterwards (content-check --root, the
// content lint) still resolves the site's aliases to the site it was run from.
const ROOT = process.cwd();
const CANDIDATES = [".ts", "/index.ts"];

/** The `paths` of the site's tsconfig.json (plain JSON), as prefix rules: `@/*` → `./src/*`, `agentic-cms` → `./src/lib/index.ts`. */
function aliases(root) {
  const file = path.join(root, "tsconfig.json");
  if (!existsSync(file)) return [];
  const paths = JSON.parse(readFileSync(file, "utf8")).compilerOptions?.paths ?? {};
  return Object.entries(paths).map(([pattern, [target]]) => ({ prefix: pattern.replace(/\*$/, ""), exact: !pattern.endsWith("*"), target: path.resolve(root, target.replace(/\*$/, "")) }));
}
const ALIASES = aliases(ROOT);

const isRelative = (specifier) => specifier.startsWith("./") || specifier.startsWith("../");
const hasExtension = (specifier) => /\.[a-z]+$/i.test(specifier);

/** The alias's target as a file URL, or undefined when no alias matches. */
function aliased(specifier) {
  const alias = ALIASES.find((a) => (a.exact ? specifier === a.prefix : specifier.startsWith(a.prefix)));
  if (!alias) return undefined;
  return pathToFileURL(alias.exact ? alias.target : path.join(alias.target, specifier.slice(alias.prefix.length))).href;
}

/** The first `.ts` / `/index.ts` file the extensionless specifier could mean, or undefined. */
function typescriptCandidate(specifier, parentURL) {
  const base = specifier.startsWith("file:") ? specifier : new URL(specifier, parentURL).href;
  return CANDIDATES.map((ext) => base + ext).find((url) => existsSync(fileURLToPath(url)));
}

registerHooks({
  resolve(specifier, context, next) {
    let target = aliased(specifier) ?? specifier;
    if ((isRelative(target) || target.startsWith("file:")) && !hasExtension(target)) {
      target = typescriptCandidate(target, context.parentURL) ?? target;
    }
    return next(target, context);
  },
  load(url, context, next) {
    if (url.startsWith("file:") && url.endsWith(".ts") && !url.includes("/node_modules/")) return next(url, { ...context, format: "module-typescript" });
    return next(url, context);
  },
});
