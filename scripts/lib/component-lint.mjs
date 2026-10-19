// The component library's lint, exported as `agentic-cms/eslint`:
// `componentRules(options)` returns flat configs a site spreads into its
// eslint.config.mjs, after eslint-config-next (which registers the `react`
// plugin two of the rules come from). Two tiers, the rules of one
// `agentic-cms` plugin:
//   - required, the engines (./engine-rules.mjs), errors across all of src,
//     design-round and lab routes included: no copy in code — every word a
//     reader sees comes from content/ or site.ts's chrome, through props; no
//     head of the site's own; forms through the form engine; tags through
//     agentic-cms/consent; no mailto: link. The files that own a form or a
//     tag are named in `owners`;
//   - preferred, the libraries and the tools (./preferred-rules.mjs),
//     warnings across all of src: motion through agentic-cms/ix, graphics
//     from the lab, pictures through Media and EagerImage, icons through
//     Icon, values from the tokens. A site keeps its own choice with its
//     reason, in `allow` or an inline disable; the files that own a picture,
//     an icon or motion are named in `owners`, and the motion folder owns
//     motion;
//   - the library's shape, so nobody adds a one-off component to a page: the
//     layers import one way (motion ← ui ← patterns ← sections); only the
//     motion layer imports an animation library; a section or a pattern
//     composes primitives: one component per file, no raw buttons, links,
//     pictures, headings or form fields (and no svg in a section), no inline
//     style, no arbitrary value, no visual or motion class in its className
//     strings — each message naming what to use.
// The primitives themselves are the site's catalogue, src/components/README.md.
//
//   import { componentRules } from "agentic-cms/eslint";
//   export default defineConfig([...nextVitals, ...nextTs, ...componentRules({ sections: ["sections"] })]);
//
// A rule takes one setting per file in flat config: a later block of the
// site's that sets one of these rules again replaces the preset's setting for
// its files, and those files lose the kit's restrictions without a word. A
// site extends them through the options instead (`elements`,
// `restrictedImports`, `copy`, `owners`); the guard (check-components) fails
// a required rule whose resolved setting is not the one these options make.
//
// Loosening a rule is its own pull request, said so in its title (the
// components rule, .claude/rules/components.md).

import { COPY_PROPS, ENGINE_RULES, PLUGIN, REQUIRED, TOOLS } from "./engine-rules.mjs";
import { ALLOWABLE, ANIMATION_ALTERNATIVES, PREFERRED, PREFERRED_RULES, RENDERING_LIBRARIES, SITE_TOOLS } from "./preferred-rules.mjs";

export { ALLOWABLE, ANIMATION_ALTERNATIVES, COPY_PROPS, PREFERRED, REQUIRED, RENDERING_LIBRARIES, SITE_TOOLS, TOOLS };
/** The plugin, one object for every block that registers it: `plugins: { "agentic-cms": plugin }`, the required rules and the preferred ones. */
export const plugin = { meta: { name: PLUGIN }, rules: { ...ENGINE_RULES, ...PREFERRED_RULES } };

/** The animation libraries: only the motion layer imports them. */
export const ANIMATION_LIBRARIES = ["motion", "framer-motion"];
/** The kit's play-once layer: a site with a motion folder wraps it there; a site without one has it as its motion layer. */
export const KIT_MOTION = "agentic-cms/ix";

/** What a site that names nothing gets: the kit's folders, every layer present. */
export const DEFAULTS = {
  root: "src/components",
  src: "src",
  alias: "@/",
  motion: "motion",
  ui: "ui",
  patterns: "patterns",
  sections: ["sections"],
  registry: "sections/render.tsx",
  app: "src/app",
  elements: {},
  copy: { props: COPY_PROPS, skip: [], decorations: ["Placeholder", "TypeTag"], tools: TOOLS },
  owners: {},
  allow: [],
  restrictedImports: { paths: [], patterns: [] },
  ignores: [],
};
/** The parts a file can own in `owners`: the engines' forms (a <form>, a server action, a fetch of another origin) and tags (next/script, a <script src> of another origin), and the preferred tier's images (an eager <img>), icons (an <svg>) and motion. */
export const OWNED = ["forms", "tags", "images", "icons", "motion"];
const tierOf = (part) => (REQUIRED.includes(`${PLUGIN}/${part}`) ? "required" : "preferred");

const SCRIPTS = "**/*.{js,jsx,mjs,ts,tsx,mts}";
const COMPONENTS = "**/*.{jsx,tsx}";
const TEST_COMPONENTS = "**/*.test.{jsx,tsx}";
const TEST_SCRIPTS = "**/*.test.{js,jsx,mjs,ts,tsx,mts}";
const HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"];
const FORM_FIELDS = ["form", "input", "select", "textarea", "label"];

/** The raw elements a section or a pattern may not write, each with the primitive to use instead; `ui` is the primitives' folder. */
export function defaultElements(ui) {
  const form = `A form is a definition in src/config/forms.ts that Form renders (${ui}/form); a new field is a field type there.`;
  const heading = `Headings are Heading from ${ui} (its level apart from its size); Section renders the section's own.`;
  return {
    button: `A call to action is Button (a link), a choice OutlineButton, an icon alone IconButton, from ${ui}; a new look is a variant there.`,
    a: `Links are TextLink (in copy), Button (looks like a button) or NavLink (the chrome), from ${ui}.`,
    img: `A picture is Media from ${ui} (eager above the fold), or Placeholder while it is not drawn.`,
    picture: `A picture is Media from ${ui}; a new need is a new option there.`,
    video: `Video goes through a primitive in ${ui}: add one there, with its entry in the catalogue.`,
    ...Object.fromEntries(FORM_FIELDS.map((name) => [name, form])),
    ...Object.fromEntries(HEADINGS.map((name) => [name, heading])),
  };
}
/** The one element a section may not draw that a pattern may. */
export const SECTION_SVG = "Graphics are library pieces: Icon (agentic-cms/components), Placeholder, a motion primitive, or a file rendered in the lab.";

// Class strings, wherever they appear inside a className attribute or a cx() call.
const CLASS_HOLDER = ":matches(JSXAttribute[name.name='className'], CallExpression[callee.name='cx'])";
const inClasses = (regex) => [`${CLASS_HOLDER} Literal[value=${regex}]`, `${CLASS_HOLDER} TemplateElement[value.raw=${regex}]`];
/** `[…]` and `(…)` are Tailwind's arbitrary values, variants and properties. */
export const ARBITRARY = "/[[(]/";
/** A box's look: a fill, a border, a radius, a ring, an outline, a shadow, a divider — after any variant prefix. */
export const VISUAL = "/(^|[\\s:!])(bg-|border|rounded|shadow|ring|outline|divide)/";
export const MOTION = "/(^|[\\s:!])(transition|animate-|duration-|delay-|ease-)/";

/** The no-restricted-syntax entries every section and pattern file gets: no style, no arbitrary value, no visual or motion class. */
export function compositionSyntax({ ui, motion }) {
  const animate = motion ? `the motion layer's primitives (${motion})` : `the play-once layer (${KIT_MOTION})`;
  return [
    { selector: "JSXAttribute[name.name='style']", message: `No inline styles: a token, a utility, or a variant of a primitive in ${ui}.` },
    ...inClasses(ARBITRARY).map((selector) => ({ selector, message: "No arbitrary values ([…], (…)): add a token to src/app/globals.css, or a variant to a primitive." })),
    ...inClasses(VISUAL).map((selector) => ({ selector, message: `A section lays pieces out: fills, borders, radii, rings, outlines and shadows belong to a primitive (Panel, Media, a variant in ${ui}).` })),
    ...inClasses(MOTION).map((selector) => ({ selector, message: `Motion is ${animate}, never a transition or animation class.` })),
  ];
}

/** The options with the defaults filled in, every folder resolved under `root` (a layer the site lacks stays null). */
export function resolveOptions(options = {}) {
  const merged = { ...DEFAULTS, ...options };
  const under = (folder) => (folder ? `${merged.root}/${folder}` : null);
  if (!merged.copy || typeof merged.copy !== "object" || Array.isArray(merged.copy)) throw new TypeError("componentRules(): copy is { props, skip, decorations, tools }, and the copy rule is required: a file that needs words of its own says why in an inline disable (// eslint-disable-next-line agentic-cms/copy -- <the reason>).");
  if (!merged.owners || typeof merged.owners !== "object" || Array.isArray(merged.owners) || Object.keys(merged.owners).some((part) => !OWNED.includes(part))) throw new TypeError(`componentRules(): owners is { ${OWNED.map((part) => `${part}: { "<file>": "<reason>" }`).join(", ")} } — the files that own a part, each with its reason (or a list of the files).`);
  checkAllow(merged.allow);
  return {
    ...merged,
    copy: { ...DEFAULTS.copy, ...merged.copy },
    motion: under(merged.motion),
    ui: under(merged.ui),
    patterns: under(merged.patterns),
    sections: (merged.sections ?? []).map(under),
    registry: under(merged.registry),
  };
}

/**
 * `allow`, the preferred rules a site keeps its own choice of: a list of
 * { rule, files, reason }, each a preferred rule (PREFERRED, or SITE_TOOLS,
 * which check-site holds outside ESLint), the files it is kept in (globs)
 * and the reason, which is never empty. A required rule is never allowed:
 * its owner, or an inline disable with its reason. Throws naming the entry.
 */
export function checkAllow(allow) {
  const shape = 'allow is a list of { rule: "agentic-cms/<rule>", files: ["<glob>", …], reason: "<why the site keeps its own>" }';
  if (!Array.isArray(allow)) throw new TypeError(`componentRules(): ${shape}.`);
  allow.forEach((entry, at) => {
    const { rule, files, reason } = entry ?? {};
    const which = `allow[${at}]${typeof rule === "string" ? ` (${rule})` : ""}`;
    if (REQUIRED.includes(rule)) throw new TypeError(`componentRules(): ${which}: a required rule is never allowed — a file that owns its part is named in owners, and a line that needs its own says why in an inline disable (// eslint-disable-next-line ${rule} -- <the reason>).`);
    if (!ALLOWABLE.includes(rule)) throw new TypeError(`componentRules(): ${which}: ${shape}, the rule one of ${ALLOWABLE.join(", ")}.`);
    if (!Array.isArray(files) || !files.length || !files.every((file) => typeof file === "string" && file)) throw new TypeError(`componentRules(): ${which}: its files are a list of globs, the files that keep their own.`);
    if (typeof reason !== "string" || !reason.trim()) throw new TypeError(`componentRules(): ${which}: no reason — a site keeps its own choice with one line of why, which the review reads.`);
  });
}

/** The specifiers that reach a folder: by the tsconfig alias (`@/components/ui`) or relatively from a sibling folder. */
export function reach(folder, { src, alias }) {
  const forms = [`../${base(folder)}`, `../../${base(folder)}`, `../../../${base(folder)}`];
  if (alias && folder.startsWith(`${src}/`)) forms.unshift(`${alias}${folder.slice(src.length + 1)}`);
  return forms.flatMap((form) => [form, `${form}/**`]);
}
const base = (folder) => folder.slice(folder.lastIndexOf("/") + 1);

/** The animation imports a file outside the motion layer may not make: every library, and the kit's layer too when the site wraps it in a motion folder. */
function animationBans(opts) {
  const names = opts.motion ? [...ANIMATION_LIBRARIES, KIT_MOTION] : ANIMATION_LIBRARIES;
  const message = opts.motion ? `Animate through the motion layer (${opts.motion}): a new effect is a new motion primitive there.` : `Animate through ${KIT_MOTION}, the kit's play-once layer: a site with no motion folder has it as its motion layer, and a library of its own goes into a motion folder.`;
  return { paths: names.map((name) => ({ name, message })), patterns: [{ group: names.map((name) => `${name}/*`), message }] };
}

/** The site's own restricted imports, in the rule's `{ paths, patterns }` form (null for none); string patterns become one group, as the rule reads them. */
function siteRestrictions(restricted) {
  const { paths = [], patterns = [], ...unknown } = restricted ?? {};
  const shape = typeof (restricted ?? {}) === "object" && !Array.isArray(restricted) && !Object.keys(unknown).length && Array.isArray(paths) && Array.isArray(patterns);
  if (!shape) throw new TypeError("componentRules(): restrictedImports is { paths, patterns }, the object form of no-restricted-imports' options, each a list.");
  const strings = patterns.filter((pattern) => typeof pattern === "string");
  return { paths, patterns: [...patterns.filter((pattern) => typeof pattern !== "string"), ...(strings.length ? [{ group: strings }] : [])] };
}

/** One no-restricted-imports setting: the animation bans (unless `animation` is false), a group per forbidden folder, then the site's own (`restrictedImports`). */
function restrictImports(opts, forbidden, { animation = true } = {}) {
  const bans = animation ? animationBans(opts) : { paths: [], patterns: [] };
  const layers = forbidden.filter(([folder]) => folder).map(([folder, message]) => ({ group: reach(folder, opts), message }));
  const site = siteRestrictions(opts.restrictedImports);
  return ["error", { paths: [...bans.paths, ...site.paths], patterns: [...bans.patterns, ...layers, ...site.patterns] }];
}

/** The layer configs: the animation ban over all of `src`, then each layer's one-way imports (a later config's setting replaces an earlier one's, so each repeats the ban). */
function layerConfigs(opts) {
  const above = (layers, message) => layers.map((folder) => [folder, message]);
  const sections = above(opts.sections, "A primitive cannot depend on what is built from it.");
  const configs = [{ files: [`${opts.src}/${SCRIPTS}`], ignores: [opts.motion && `${opts.motion}/**`, ...opts.ignores].filter(Boolean), rules: { "no-restricted-imports": restrictImports(opts, []) } }];
  if (opts.motion) {
    const bottom = "The motion layer is the bottom one: it imports nothing from the other layers.";
    configs.push({ files: [`${opts.motion}/${SCRIPTS}`], ignores: opts.ignores, rules: { "no-restricted-imports": restrictImports(opts, above([opts.ui, opts.patterns, ...opts.sections], bottom), { animation: false }) } });
  }
  if (opts.ui) configs.push({ files: [`${opts.ui}/${SCRIPTS}`], ignores: opts.ignores, rules: { "no-restricted-imports": restrictImports(opts, [[opts.patterns, "A primitive cannot depend on what is built from it."], ...sections]) } });
  if (opts.patterns) configs.push({ files: [`${opts.patterns}/${SCRIPTS}`], ignores: opts.ignores, rules: { "no-restricted-imports": restrictImports(opts, above(opts.sections, "A pattern is shared by sections; it cannot depend on one.")) } });
  return configs;
}

/** What a section or a pattern may contain: one component per file, no forbidden element, nothing composition forbids. */
function compositionConfig(files, opts, elements) {
  const forbid = Object.entries(elements).filter(([, message]) => message).map(([element, message]) => ({ element, message }));
  return {
    files,
    ignores: [opts.registry, ...opts.ignores].filter(Boolean),
    rules: {
      "react/no-multi-comp": ["error", { ignoreStateless: false }],
      "react/forbid-elements": ["error", { forbid }],
      "no-restricted-syntax": ["error", ...compositionSyntax(opts)],
    },
  };
}

/** The files a part's owners name: `owners[part]` as { "<glob>": "<reason>" } (the config's form, each with its reason) or a list of globs. */
export const ownerFiles = (owners, part) => { const value = owners?.[part]; return Array.isArray(value) ? value : Object.keys(value ?? {}); };

/** Where copy goes from each place the copy rule covers: { place, route } for its message. */
export function copyPlaces(opts) {
  const chrome = `the chrome in ${opts.src}/config/site.ts`;
  const schemas = opts.registry ? `${opts.registry.slice(0, opts.registry.lastIndexOf("/"))}/schemas.ts` : "the sections' schemas";
  return {
    code: { place: "code", route: `every word a reader sees comes from content/ or ${chrome}, through props.` },
    primitive: { place: "a primitive", route: `its words come in as props, from the section that uses it, or from ${chrome}.` },
    section: { place: "a section or a pattern", route: `it goes in the page's file, content/pages/<slug>.yaml → a field of the section (its schema in ${schemas}) → a prop here (a pattern gets it from its section).` },
    route: { place: "a route", route: `a page's words are its file, content/pages/<slug>.yaml, which the catch-all renders through the sections; a layout's and not-found's are ${chrome}.` },
    round: { place: "a design round's route", route: "it reads the page's copy from content/pages/<slug>.yaml and hands it to the candidates as props, as `agentic-cms demo new --section` writes it; a showcase reads its copy from a content file too, and the chip that names a candidate is aria-hidden." },
  };
}

/**
 * The required tier, the engines (./engine-rules.mjs): head, forms, tags and
 * e-mail over every script under `src` (and the app folder), copy over every
 * component there with the message of its place — code, a primitive, a
 * section or a pattern, a route, a design round's route (a `*-demo` folder,
 * the lab's among them) — test files left out; then each part turned off in
 * the files its `owners` name.
 */
export function requiredConfigs(opts) {
  const plugins = { [PLUGIN]: plugin };
  const trees = opts.app === opts.src || opts.app.startsWith(`${opts.src}/`) ? [opts.src] : [opts.src, opts.app];
  const rounds = `${opts.app}/*-demo`;
  const places = copyPlaces(opts);
  const block = (files, rules, ignores = []) => ({ files, ignores: [...opts.ignores, ...ignores], plugins, rules });
  const { props, skip, decorations, tools } = opts.copy;
  const copy = (folders, where, ignores = []) => block(folders.filter(Boolean).map((folder) => `${folder}/${COMPONENTS}`), { [`${PLUGIN}/copy`]: ["error", { props, skip, decorations, tools, ...places[where] }] }, [TEST_COMPONENTS, ...ignores]);
  const configs = [
    block(trees.map((tree) => `${tree}/${SCRIPTS}`), Object.fromEntries(REQUIRED.filter((rule) => rule !== `${PLUGIN}/copy`).map((rule) => [rule, "error"]))),
    copy(trees, "code"),
    copy([opts.motion, opts.ui], "primitive"),
    copy([opts.patterns, ...opts.sections], "section"),
    copy([opts.app], "route", [`${rounds}/**`]),
    copy([rounds], "round"),
    ...OWNED.filter((part) => tierOf(part) === "required").map((part) => block(ownerFiles(opts.owners, part), { [`${PLUGIN}/${part}`]: "off" })),
  ];
  return configs.filter((config) => config.files.length);
}

/**
 * The preferred tier (./preferred-rules.mjs), warnings: graphics, images and
 * icons over every script under `src` (and the app folder), motion there but
 * in the motion layer, styling there but in the sections and the patterns
 * (whose composition fails an arbitrary value already) — test files left
 * out; then each part turned off in the files its `owners` name, and each
 * `allow` entry's rule in its files (an entry of SITE_TOOLS is check-site's,
 * which no ESLint block sets).
 */
export function preferredConfigs(opts) {
  const plugins = { [PLUGIN]: plugin };
  const trees = opts.app === opts.src || opts.app.startsWith(`${opts.src}/`) ? [opts.src] : [opts.src, opts.app];
  const scripts = trees.map((tree) => `${tree}/${SCRIPTS}`);
  const block = (files, rules, ignores = []) => ({ files, ignores: [...opts.ignores, ...ignores], plugins, rules });
  const warn = (...rules) => Object.fromEntries(rules.map((rule) => [`${PLUGIN}/${rule}`, "warn"]));
  const composed = [opts.patterns, ...opts.sections].filter(Boolean).map((folder) => `${folder}/**`);
  const configs = [
    block(scripts, warn("graphics", "images", "icons"), [TEST_SCRIPTS]),
    block(scripts, warn("motion"), [TEST_SCRIPTS, opts.motion && `${opts.motion}/**`].filter(Boolean)),
    block(scripts, warn("styling"), [TEST_SCRIPTS, ...composed]),
    ...OWNED.filter((part) => tierOf(part) === "preferred").map((part) => block(ownerFiles(opts.owners, part), { [`${PLUGIN}/${part}`]: "off" })),
    ...opts.allow.filter(({ rule }) => rule !== SITE_TOOLS).map(({ rule, files }) => block(files, { [rule]: "off" })),
  ];
  return configs.filter((config) => config.files.length);
}

/**
 * The component library's flat configs. Options (each optional, the
 * defaults in DEFAULTS): `root` (where the layers' folders are), `src` (the
 * tree the animation ban and the required rules cover), `alias` (the
 * tsconfig alias for `src/`), `app` (the routes' folder), `motion`, `ui`,
 * `patterns` (a folder under `root`, or null for a layer the site does not
 * have), `sections` (the section folders under `root`), `registry` (the
 * section registry under `root`, left out of the section rules: it imports
 * every section), `elements` ({ element: message } over defaultElements();
 * false allows one), `copy` ({ props, skip, decorations, tools }: the props whose
 * strings are copy, replacing COPY_PROPS; the props of the site's own whose
 * strings are never copy, added to the rule's own; the primitives that draw
 * their props and children aria-hidden; the design tools' modules, whose
 * components' props are no copy), `owners` ({ forms, tags, images, icons,
 * motion }: the files that own a <form>, a tag, an eager <img>, an <svg> or
 * motion, as { "<glob>": "<reason>" } or a list of globs), `allow` (a list
 * of { rule, files, reason }: a preferred rule a site keeps its own choice of
 * in those files, with the reason — checkAllow()), `restrictedImports`
 * ({ paths, patterns } in no-restricted-imports'
 * own form: the site's own restrictions, added to every setting of that rule
 * here, so they hold wherever the kit's do, all of `src` but `ignores`) and
 * `ignores` (globs left out of every rule).
 */
export function componentRules(options = {}) {
  const opts = resolveOptions(options);
  const elements = { ...defaultElements(opts.ui ?? `${opts.root}/ui`), svg: SECTION_SVG, ...opts.elements };
  const configs = layerConfigs(opts);
  const sectionFiles = opts.sections.map((folder) => `${folder}/${COMPONENTS}`);
  if (sectionFiles.length) configs.push(compositionConfig(sectionFiles, opts, elements));
  if (opts.patterns) configs.push(compositionConfig([`${opts.patterns}/${COMPONENTS}`], opts, { ...elements, svg: false }));
  return [...configs, ...requiredConfigs(opts), ...preferredConfigs(opts)];
}
