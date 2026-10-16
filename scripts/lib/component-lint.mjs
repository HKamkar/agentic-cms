// The component library's lint, exported as `agentic-cms/eslint`:
// `componentRules(options)` returns flat configs a site spreads into its
// eslint.config.mjs, after eslint-config-next (which registers the `react`
// plugin two of the rules come from). With them nobody adds a one-off
// component to a page:
//   - the layers import one way: motion ← ui ← patterns ← sections;
//   - only the motion layer imports an animation library;
//   - a section or a pattern composes primitives: one component per file, no
//     raw buttons, links, pictures, headings or form fields (and no svg in a
//     section), no inline style, no arbitrary value, no visual or motion
//     class in its className strings — each message naming what to use;
//   - and it holds no copy: its words come from the page's content file.
// The primitives themselves are the site's catalogue, src/components/README.md.
//
//   import { componentRules } from "agentic-cms/eslint";
//   export default defineConfig([...nextVitals, ...nextTs, ...componentRules({ sections: ["sections"] })]);
//
// Loosening a rule is its own pull request, said so in its title (the
// components rule, .claude/rules/components.md).

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
  elements: {},
  copy: { props: ["title", "alt", "aria-label", "placeholder", "label", "children"], decorations: ["Placeholder", "TypeTag"] },
  ignores: [],
};

const SCRIPTS = "**/*.{js,jsx,mjs,ts,tsx,mts}";
const COMPONENTS = "**/*.{jsx,tsx}";
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

// Copy: text with a letter or a digit in it. A symbol (→, ·, ×) has neither;
// the text of an aria-hidden element, and the props of a primitive that draws
// them aria-hidden (`copy.decorations`), are decorations, not something read.
const WORDS = "/[\\p{L}\\p{N}]/u";
const HIDDEN = ":has(> JSXAttribute[name.name='aria-hidden'])";
const WORDED = [`Literal[value=${WORDS}]`, `TemplateLiteral > TemplateElement[value.raw=${WORDS}]`, `:matches(ConditionalExpression, LogicalExpression) > Literal[value=${WORDS}]`];

/** The no-restricted-syntax entries that keep copy out: JSX text, and strings in the copy-bearing props (`copy.props`), written straight, as `{…}` or as a data array's field of that name; none when `copy` is false. */
export function copySyntax({ copy, registry }) {
  if (!copy) return [];
  const { props, decorations } = { ...DEFAULTS.copy, ...copy };
  const schemas = registry ? `${registry.slice(0, registry.lastIndexOf("/"))}/schemas.ts` : "the sections' schemas";
  const route = `it goes in the page's file, content/pages/<slug>.yaml → a field of the section (its schema in ${schemas}) → a prop here (a pattern gets it from its section). Symbols pass, and decorations: aria-hidden text${decorations.length ? ` and the props of ${decorations.join(", ")}` : ""}.`;
  const text = `:matches(JSXElement:not(:has(> JSXOpeningElement${HIDDEN})), JSXFragment)`;
  const decorated = decorations.length ? `, [name.name=/^(?:${decorations.join("|")})$/]` : "";
  const names = `/^(?:${props.join("|")})$/`;
  const prop = props.length ? `JSXOpeningElement:not(${HIDDEN}${decorated}) > JSXAttribute[name.name=${names}]` : null;
  const field = props.length ? `Property:matches([key.name=${names}], [key.value=${names}]) > :matches(Literal[value=${WORDS}], TemplateLiteral > TemplateElement[value.raw=${WORDS}])` : null;
  const expressions = (parent) => WORDED.map((part) => `${parent} > JSXExpressionContainer > ${part}`);
  const inText = [`${text} > JSXText[value=${WORDS}]`, ...expressions(text)];
  const inProps = prop ? [`${prop} > Literal[value=${WORDS}]`, ...expressions(prop)] : [];
  return [
    ...inText.map((selector) => ({ selector, message: `No copy in a section or a pattern: ${route}` })),
    ...inProps.map((selector) => ({ selector, message: `No copy in a string prop (${props.join(", ")}): ${route}` })),
    ...(field ? [{ selector: field, message: `No copy in a section's data (a ${props.join(", ")} field): ${route}` }] : []),
  ];
}

/** The options with the defaults filled in, every folder resolved under `root` (a layer the site lacks stays null). */
export function resolveOptions(options = {}) {
  const merged = { ...DEFAULTS, ...options };
  const under = (folder) => (folder ? `${merged.root}/${folder}` : null);
  return {
    ...merged,
    motion: under(merged.motion),
    ui: under(merged.ui),
    patterns: under(merged.patterns),
    sections: (merged.sections ?? []).map(under),
    registry: under(merged.registry),
  };
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

/** One no-restricted-imports setting: the animation bans (unless `animation` is false) plus a group per forbidden folder. */
function restrictImports(opts, forbidden, { animation = true } = {}) {
  const bans = animation ? animationBans(opts) : { paths: [], patterns: [] };
  const layers = forbidden.filter(([folder]) => folder).map(([folder, message]) => ({ group: reach(folder, opts), message }));
  return ["error", { paths: bans.paths, patterns: [...bans.patterns, ...layers] }];
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

/** What a section or a pattern may contain: one component per file, no forbidden element, nothing composition forbids, no copy. */
function compositionConfig(files, opts, elements) {
  const forbid = Object.entries(elements).filter(([, message]) => message).map(([element, message]) => ({ element, message }));
  return {
    files,
    ignores: [opts.registry, ...opts.ignores].filter(Boolean),
    rules: {
      "react/no-multi-comp": ["error", { ignoreStateless: false }],
      "react/forbid-elements": ["error", { forbid }],
      "no-restricted-syntax": ["error", ...compositionSyntax(opts), ...copySyntax(opts)],
    },
  };
}

/**
 * The component library's flat configs. Options (each optional, the
 * defaults in DEFAULTS): `root` (where the layers' folders are), `src` (the
 * tree the animation ban covers), `alias` (the tsconfig alias for `src/`),
 * `motion`, `ui`, `patterns` (a folder under `root`, or null for a layer the
 * site does not have), `sections` (the section folders under `root`),
 * `registry` (the section registry under `root`, left out of the section
 * rules: it imports every section), `elements` ({ element: message } over
 * defaultElements(); false allows one), `copy` ({ props, decorations }: the
 * props whose strings are copy, and the primitives that draw theirs
 * aria-hidden; false turns the copy rule off) and `ignores` (globs left out
 * of every rule).
 */
export function componentRules(options = {}) {
  const opts = resolveOptions(options);
  const elements = { ...defaultElements(opts.ui ?? `${opts.root}/ui`), svg: SECTION_SVG, ...opts.elements };
  const configs = layerConfigs(opts);
  const sectionFiles = opts.sections.map((folder) => `${folder}/${COMPONENTS}`);
  if (sectionFiles.length) configs.push(compositionConfig(sectionFiles, opts, elements));
  if (opts.patterns) configs.push(compositionConfig([`${opts.patterns}/${COMPONENTS}`], opts, { ...elements, svg: false }));
  return configs;
}
