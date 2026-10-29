// The types of `agentic-cms/eslint` (./component-lint.mjs), written by hand
// beside it: what a site's eslint.config.mjs (or a .ts one) imports, with the
// options componentRules() takes. `pnpm lint:pkg` compiles this file
// (tsconfig.declarations.json); tools/declarations.test.mjs holds its names
// to the module's exports, so neither changes without the other.
import type { ESLint, Linter } from "eslint";

/** The parts a file can own in `owners`. */
export type OwnedPart = "forms" | "tags" | "images" | "icons" | "motion";
/** The files that own a part: { "<glob>": "<reason>" } (the config's form, each with its reason) or a list of globs. */
export type OwnerFiles = Record<string, string> | string[];
/** A preferred rule a site keeps its own choice of, in those files, with the reason (never empty). */
export interface AllowEntry {
  rule: string;
  files: string[];
  reason: string;
}
/** An existing site's bypass, as `agentic-cms check-site --baseline` writes it: the file, the rule, how many findings of it the file holds, and the reason. */
export interface BaselineEntry {
  file: string;
  rule: string;
  count: number;
  reason: string;
}
/** The copy rule's settings: the props whose strings are copy, the site's props that never are, the primitives that draw theirs aria-hidden, the design tools' modules. */
export interface CopyOptions {
  props?: string[];
  skip?: string[];
  decorations?: string[];
  tools?: string[];
}
/** no-restricted-imports' own `{ paths, patterns }` form; a string pattern joins one group. */
export interface RestrictedImports {
  paths?: Array<string | { name: string; message?: string; importNames?: string[] }>;
  patterns?: Array<string | Record<string, unknown>>;
}

/** componentRules()'s options, each optional: the defaults are DEFAULTS. */
export interface ComponentRulesOptions {
  /** Where the layers' folders are. */
  root?: string;
  /** The tree the animation ban and the required rules cover. */
  src?: string;
  /** The tsconfig alias for `src/`. */
  alias?: string;
  /** The routes' folder. */
  app?: string;
  /** A layer's folder under `root`, or null for a layer the site does not have. */
  motion?: string | null;
  ui?: string | null;
  patterns?: string | null;
  /** The section folders under `root`. */
  sections?: string[];
  /** The section registry under `root`, left out of the section rules. */
  registry?: string | null;
  /** { element: message } over defaultElements(); false allows one. */
  elements?: Record<string, string | false>;
  copy?: CopyOptions;
  owners?: Partial<Record<OwnedPart, OwnerFiles>>;
  allow?: AllowEntry[];
  baseline?: BaselineEntry[];
  restrictedImports?: RestrictedImports;
  /** Globs left out of every rule. */
  ignores?: string[];
}
/** The options with the defaults filled in, every folder resolved under `root`. */
export interface ResolvedOptions extends Required<Omit<ComponentRulesOptions, "copy">> {
  copy: Required<CopyOptions>;
}

/** The kit's flat configs, to spread into a site's eslint.config after eslint-config-next. */
export function componentRules(options?: ComponentRulesOptions): Linter.Config[];
/** The `agentic-cms` plugin every block registers: the required rules and the preferred ones. */
export const plugin: ESLint.Plugin;
/** What a site that names nothing gets. */
export const DEFAULTS: Required<ComponentRulesOptions>;
/** The options with the defaults filled in; throws a TypeError naming a malformed option. */
export function resolveOptions(options?: ComponentRulesOptions): ResolvedOptions;
/** The required tier's configs, the engines. */
export function requiredConfigs(options: ResolvedOptions): Linter.Config[];
/** The preferred tier's configs, warnings. */
export function preferredConfigs(options: ResolvedOptions): Linter.Config[];
/** Throws a TypeError naming the `allow` entry that is not { rule, files, reason } with a preferred rule. */
export function checkAllow(allow: unknown): void;
/** The raw elements a section or a pattern may not write, each with the primitive to use; `ui` is the primitives' folder. */
export function defaultElements(ui: string): Record<string, string>;
/** The no-restricted-syntax entries every section and pattern file gets. */
export function compositionSyntax(layers: { ui: string | null; motion: string | null }): Array<{ selector: string; message: string }>;
/** The specifiers that reach a folder: by the alias or relatively from a sibling folder. */
export function reach(folder: string, where: { src: string; alias?: string | null }): string[];
/** The files a part's owners name. */
export function ownerFiles(owners: Partial<Record<OwnedPart, OwnerFiles>> | undefined, part: OwnedPart): string[];
/** Where copy goes from each place the copy rule covers, for its message. */
export function copyPlaces(options: Pick<ResolvedOptions, "src" | "registry">): Record<"code" | "primitive" | "section" | "route" | "round", { place: string; route: string }>;

/** The parts a file can own. */
export const OWNED: OwnedPart[];
/** The required rules, by their full names (`agentic-cms/copy`, …). */
export const REQUIRED: string[];
/** The preferred rules ESLint holds, by their full names. */
export const PREFERRED: string[];
/** The preferred rule `agentic-cms check-site` holds outside ESLint. */
export const SITE_TOOLS: string;
/** Every rule an `allow` entry may name. */
export const ALLOWABLE: string[];
/** The props whose strings are copy. */
export const COPY_PROPS: string[];
/** The design tools' modules, whose components' props are no copy. */
export const TOOLS: string[];
/** The kit's play-once layer, `agentic-cms/ix`. */
export const KIT_MOTION: string;
/** The animation libraries only the motion layer imports. */
export const ANIMATION_LIBRARIES: string[];
/** The other animation libraries the motion rule names. */
export const ANIMATION_ALTERNATIVES: string[];
/** The libraries that draw in the reader's browser, which the graphics rule names. */
export const RENDERING_LIBRARIES: string[];
/** The one element a section may not draw that a pattern may. */
export const SECTION_SVG: string;
/** The selectors' regular expressions, as ESLint's selector syntax writes them: an arbitrary value, a box's look, a motion class. */
export const ARBITRARY: string;
export const VISUAL: string;
export const MOTION: string;
