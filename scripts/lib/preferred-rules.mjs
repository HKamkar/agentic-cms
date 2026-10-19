// The preferred tier of the kit's lint: the libraries and the tools, as the
// rules of the `agentic-cms` ESLint plugin that componentRules()
// (./component-lint.mjs, `agentic-cms/eslint`) sets to warn across a site's
// src/ (docs/roadmap-0.8.2.md D1 (b)). A site may animate with a library of
// its own, draw on a canvas, ship a picture through next/image or paste an
// <svg>: each warns, naming the kit's part and its doc, and the build passes.
// The site keeps its choice with one line of reason — an `allow` entry in
// src/config/components.json, or an inline disable with its description —
// and the warning is quiet; one without a reason stays in the lint's output,
// where the review sees it:
//   - motion: an animation library other than agentic-cms/ix, a site's own
//     requestAnimationFrame loop, IntersectionObserver reveal or
//     el.animate(), a transition or animation class or inline style — all
//     outside the motion layer;
//   - graphics: a rendering library, a <canvas>;
//   - images: next/image, an eager <img> in a server component;
//   - icons: an <svg> outside Icon;
//   - styling: an arbitrary value, an arbitrary breakpoint or a style colour
//     outside the tokens (componentRules() sets it outside the sections and
//     the patterns, which fail these already).
// The required tier, the engines, is ./engine-rules.mjs.

import { attribute, elementName, PLUGIN, staticValue, strings } from "./engine-rules.mjs";

/** The preferred rules, by their full names. */
export const PREFERRED = ["motion", "graphics", "images", "icons", "styling"].map((rule) => `${PLUGIN}/${rule}`);

/**
 * The preferred rule `agentic-cms check-site` holds outside ESLint, over the
 * site's own tools where the kit has a command: a script that drives
 * Playwright, runs sharp over public/ or starts next dev, and a machine
 * address in next.config.*. An `allow` entry takes it like the others, with
 * its reason; no ESLint block sets it.
 */
export const SITE_TOOLS = `${PLUGIN}/site-tools`;
/** Every rule an `allow` entry may name: the preferred rules and the site check's. */
export const ALLOWABLE = [...PREFERRED, SITE_TOOLS];

/**
 * The animation libraries the motion rule names, beside agentic-cms/ix (motion
 * and framer-motion are the motion layer's, and fail outside it): a name, or
 * a prefix ending in `/` (a scope) or `-`.
 */
export const ANIMATION_ALTERNATIVES = ["gsap", "@gsap/", "react-spring", "@react-spring/", "animejs", "lottie-web", "lottie-react", "@lottiefiles/", "popmotion", "velocity-animate", "@formkit/auto-animate", "react-transition-group", "@motionone/", "@theatre/", "@mojs/core", "aos", "scrollreveal"];
/** The libraries that draw in the reader's browser, which the graphics rule names, in the same form. */
export const RENDERING_LIBRARIES = ["three", "@react-three/", "d3", "d3-", "pixi.js", "@pixi/", "p5", "react-p5", "babylonjs", "@babylonjs/", "konva", "react-konva", "fabric", "paper", "two.js", "ogl", "regl", "chart.js", "echarts", "plotly.js", "@antv/"];
/** The calls whose string arguments are class lists: the kit's helpers (agentic-cms/cx). */
export const CLASS_CALLS = ["cx", "variants"];

const KEEP = 'A site keeps its own with its reason: an "allow" entry in src/config/components.json, or an inline disable with -- <why> (agentic-cms\'s docs/primitives.md § Enforced).';
const MOTION = "the kit's motion is agentic-cms/ix — the play-once layer (Reveal, RevealGroup, Sequence, part()) or the reveals that replay (Fx, OnView) — timed by the --ease-* / --motion-* tokens with its start states in src/styles/motion.css, or a motion folder of the site's own that owns its library (STANDARD.md §7)";
const GRAPHICS = "graphics ship pre-rendered from the lab — agentic-cms lab new, lab serve, lab render — as a file a page embeds, inline Icon data or an InlineAnimation loop (agentic-cms's docs/lab.md)";
const IMAGES = "a picture is a plain <img> with its width and height: Media, lazy below the fold, and above it in a server component EagerImage (agentic-cms/components), which keeps it out of other pages' prefetches; the static host has no image service (STANDARD.md §4)";
const ICONS = "an icon is Icon from agentic-cms/components, its paths in src/config/icons.ts (agentic-cms icons add lucide:<name>, si:<slug>, file:<name>); a mark or an illustration is drawn in the lab and ships as a file (agentic-cms's docs/icons.md, docs/lab.md)";
const TOKENS = "a value the scale lacks is a token first, in the @theme static block of src/app/globals.css, used as its utility (the uneven grid lg:grid-cols-2-1 is --grid-template-columns-2-1) (STANDARD.md §1)";

const meta = (description) => ({ type: "suggestion", docs: { description }, schema: [] });
const warn = (context, node, what, part) => context.report({ node, message: `${what}: ${part}. ${KEEP}` });
const named = (source, names) => names.some((name) => (/[/-]$/.test(name) ? source.startsWith(name) : source === name || source.startsWith(`${name}/`)));

/** Visitors that hand every module a file imports — import, export … from, import(), require() — to `check(node, source)`; a type-only import brings no code. */
function imports(check) {
  const literal = (node) => (node?.type === "Literal" && typeof node.value === "string" ? node.value : null);
  const from = (node) => { if (node.importKind !== "type" && node.exportKind !== "type" && literal(node.source)) check(node, node.source.value); };
  return {
    ImportDeclaration: from,
    ExportNamedDeclaration: from,
    ExportAllDeclaration: from,
    ImportExpression(node) { if (literal(node.source)) check(node, node.source.value); },
    "CallExpression[callee.name='require']"(node) { if (literal(node.arguments[0])) check(node, node.arguments[0].value); },
  };
}

/** A class list's classes, each as { text, variants, utility }: split on whitespace, then on the colons outside brackets and parentheses; the utility without its `!` and its leading `-`. */
export function parseClasses(text) {
  return text.split(/\s+/).filter(Boolean).map((cls) => {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < cls.length; i++) {
      if ("[(".includes(cls[i])) depth++;
      else if ("])".includes(cls[i])) depth = Math.max(0, depth - 1);
      else if (cls[i] === ":" && depth === 0) { parts.push(cls.slice(start, i)); start = i + 1; }
    }
    const utility = cls.slice(start).replace(/^!|!$/g, "").replace(/^-/, "");
    return { text: cls, variants: parts, utility };
  });
}

/** Visitors that hand every class list — a className's strings, a cx() or variants() call's — to `check(node, text)`, each string once. */
function classLists(check) {
  const holder = `:matches(JSXAttribute[name.name='className'], ${CLASS_CALLS.map((name) => `CallExpression[callee.name='${name}']`).join(", ")})`;
  return {
    [`${holder} Literal`](node) { if (typeof node.value === "string") check(node, node.value); },
    [`${holder} TemplateElement`](node) { check(node, node.value.cooked ?? node.value.raw); },
  };
}

/** Each property of a `style={{ … }}` object, as (property, name): a spread or a computed key is left out. */
function styleProperties(check) {
  return {
    "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property"(node) {
      if (node.computed) return;
      const name = node.key.type === "Identifier" ? node.key.name : node.key.value;
      if (typeof name === "string" && !name.startsWith("--")) check(node, name);
    },
  };
}

const MOTION_CLASS = /^(?:transition|animate-|duration-|delay-|ease-)/;
const STILL = /^(?:transition-none|animate-none)$/;
const RESTING = (text) => /^\s*(?:none|0(?:\.0*1)?m?s)\s*$/i.test(text);

/**
 * Motion outside the motion layer (componentRules() leaves the layer's folder
 * out): an animation library other than agentic-cms/ix
 * (ANIMATION_ALTERNATIVES), a requestAnimationFrame loop, an
 * IntersectionObserver, el.animate(), a transition or animation class
 * (`transition-none` and `animate-none` rest), or a transition or animation
 * in a style (`none` rests).
 */
const motion = {
  meta: meta("Motion is agentic-cms/ix, or the site's own motion layer."),
  create(context) {
    const frame = (callee) => (callee.type === "Identifier" && callee.name === "requestAnimationFrame") || (callee.type === "MemberExpression" && !callee.computed && callee.property.name === "requestAnimationFrame");
    return {
      ...imports((node, source) => { if (named(source, ANIMATION_ALTERNATIVES)) warn(context, node, `An animation library of the site's own, ${source}`, MOTION); }),
      ...classLists((node, text) => { for (const { text: cls, utility } of parseClasses(text)) if (MOTION_CLASS.test(utility) && !STILL.test(utility)) warn(context, node, `A transition or animation class, "${cls}"`, MOTION); }),
      ...styleProperties((node, name) => {
        if (!/^(?:transition|animation)/i.test(name)) return;
        const values = strings(node.value);
        if (!values.length || !values.every((piece) => RESTING(piece.text))) warn(context, node, `A transition or animation in a style (${name})`, MOTION);
      }),
      CallExpression(node) {
        if (frame(node.callee)) warn(context, node, "A requestAnimationFrame loop of the site's own", MOTION);
        else if (node.callee.type === "MemberExpression" && !node.callee.computed && node.callee.property.name === "animate" && node.arguments.length) warn(context, node, "An animation of the site's own, el.animate()", MOTION);
      },
      NewExpression(node) { if (node.callee.type === "Identifier" && node.callee.name === "IntersectionObserver") warn(context, node, "A reveal of the site's own, an IntersectionObserver", MOTION); },
    };
  },
};

/** Graphics drawn in the reader's browser: a rendering library (RENDERING_LIBRARIES), a <canvas>, a canvas made in code. */
const graphics = {
  meta: meta("Graphics ship pre-rendered from the lab."),
  create(context) {
    const canvas = (node) => node?.type === "Literal" && node.value === "canvas";
    return {
      ...imports((node, source) => { if (named(source, RENDERING_LIBRARIES)) warn(context, node, `A rendering library, ${source}, draws in the reader's browser`, GRAPHICS); }),
      JSXOpeningElement(node) { if (elementName(node.name) === "canvas") warn(context, node, "A <canvas> draws in the reader's browser", GRAPHICS); },
      "CallExpression[callee.property.name='createElement']"(node) { if (canvas(node.arguments[0])) warn(context, node, "A canvas made in code draws in the reader's browser", GRAPHICS); },
      NewExpression(node) { if (node.callee.type === "Identifier" && node.callee.name === "OffscreenCanvas") warn(context, node, "An OffscreenCanvas draws in the reader's browser", GRAPHICS); },
    };
  },
};

/** Whether an <img> loads at once: no `loading` (the browser's default), or one that can be other than "lazy"; a `loading` the lint cannot read, or a spread that may carry one, is not known to. */
function eager(opening) {
  const loading = attribute(opening, "loading");
  if (!loading) return !opening.attributes.some((attr) => attr.type === "JSXSpreadAttribute");
  const value = staticValue(loading);
  if (value !== undefined) return value !== "lazy";
  const pieces = strings(loading.value);
  return pieces.length > 0 && pieces.some((piece) => piece.text !== "lazy");
}

/** Pictures: next/image, and an eager <img> in a server component (a file without "use client"), which becomes a preload hint every page that prefetches a link to it downloads. */
const images = {
  meta: meta("Pictures are Media and EagerImage, plain <img> with their size."),
  create(context) {
    const client = () => context.sourceCode.ast.body.some((statement) => statement.directive === "use client");
    return {
      ...imports((node, source) => { if (source === "next/image" || source === "next/legacy/image") warn(context, node, `The image service's ${source}`, IMAGES); }),
      JSXOpeningElement(node) { if (elementName(node.name) === "img" && eager(node) && !client()) warn(context, node, "An eager <img> in a server component", IMAGES); },
    };
  },
};

/** Icons: an <svg> of the site's own, outside Icon (whose owner, `owners.icons`, turns this off). */
const icons = {
  meta: meta("An icon is Icon; a drawing ships from the lab."),
  create(context) {
    return { JSXOpeningElement(node) { if (elementName(node.name) === "svg") warn(context, node, "An <svg> of the site's own", ICONS); } };
  },
};

const BREAKPOINT = /^(?:@?(?:min|max)-|@)[[(]/;
const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|light-dark)\(/i;
const COLOUR_PROPERTY = /color$|^(?:background|fill|stroke)$/i;
const KEYWORD = /^(?:transparent|currentcolor|inherit|initial|unset|revert|revert-layer|none)$/i;
/** Whether a style value is a colour outside the tokens: a hex or a colour function anywhere, or a named colour on a colour property; var(--…) is a token. */
const ownColour = (name, text) => !/var\(/.test(text) && (COLOUR.test(text) || (COLOUR_PROPERTY.test(name) && /^\s*[a-z]+\s*$/i.test(text) && !KEYWORD.test(text.trim())));

/** Styling outside the tokens: an arbitrary value or property (`[…]`, `(…)`) in a class, an arbitrary breakpoint (`min-[…]:`), a style colour; a state variant (`has-[…]:`, `data-[…]:`) selects, and passes. */
const styling = {
  meta: meta("Values come from the tokens."),
  create(context) {
    return {
      ...classLists((node, text) => {
        for (const { text: cls, variants, utility } of parseClasses(text)) {
          if (/[[(]/.test(utility)) warn(context, node, `An arbitrary value, "${cls}"`, TOKENS);
          else if (variants.some((variant) => BREAKPOINT.test(variant))) warn(context, node, `A breakpoint outside the scale (max-sm … 3xl), "${cls}"`, TOKENS);
        }
      }),
      ...styleProperties((node, name) => { for (const piece of strings(node.value)) if (ownColour(name, piece.text)) warn(context, piece.node, `A colour outside the tokens in a style (${name}: "${piece.text}")`, TOKENS); }),
    };
  },
};

/** The preferred rules, by their short names: the `agentic-cms` plugin componentRules() registers holds them beside the required ones. */
export const PREFERRED_RULES = { motion, graphics, images, icons, styling };
