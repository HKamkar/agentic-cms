// The required tier of the kit's lint: the engines, as the rules of the
// `agentic-cms` ESLint plugin that componentRules() (./component-lint.mjs,
// `agentic-cms/eslint`) sets across a site's src/, design-round and lab
// routes included (docs/roadmap-0.8.2.md D1). A page whose copy, head, form
// or tag is in code is one the kit cannot edit as a file, lint for voice,
// audit or upgrade, so each of these fails the lint, its message naming the
// engine to use and its doc:
//   - copy: every word a reader sees comes from content/ or site.ts's chrome,
//     through props;
//   - head: no <head>, <title>, <meta>, canonical <link> or JSON-LD script of
//     a site's own, and a route's metadata comes from kit.seo;
//   - forms: <form> only in the form components, no server action, no
//     absolute-URL fetch in a component;
//   - tags: next/script and a third-party <script src> only in the consent
//     adapter that owns them;
//   - email: no mailto: literal, EmailLink instead.
// They are rules of their own rather than no-restricted-syntax entries: a
// block of the site's that sets no-restricted-syntax again does not replace
// them, a disable names the engine it goes around, and the guard
// (check-components) reads each one's resolved setting.

/** The plugin's name in a flat config's `plugins`, and its rules' prefix. */
export const PLUGIN = "agentic-cms";
/** The required rules, by their full names. */
export const REQUIRED = ["copy", "head", "forms", "tags", "email"].map((rule) => `${PLUGIN}/${rule}`);

const WORDS = /[\p{L}\p{N}]/u;
/** A token, never words: printable ASCII without a space or a capital (a variant, a size, a key, a path, a number). */
const TOKEN = /^[!-@[-~]*$/;
/** A camelCase name, never words: a preset, a key, an identifier (`slideInLeft`, `fadeIn`). */
const CAMEL = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/;
/** The utilities Tailwind writes with no value, which a class string may hold beside the valued ones. */
const BARE_UTILITIES = new Set(["flex", "grid", "block", "inline", "inline-block", "inline-flex", "inline-grid", "contents", "hidden", "table", "flow-root", "relative", "absolute", "fixed", "sticky", "static", "isolate", "italic", "underline", "overline", "line-through", "no-underline", "uppercase", "lowercase", "capitalize", "normal-case", "truncate", "container", "grow", "shrink", "border", "rounded", "shadow", "outline", "ring", "invisible", "visible", "collapse", "antialiased", "sr-only", "not-sr-only", "group", "peer", "prose", "transform", "filter", "blur", "transition"]);
const reads = (text) => WORDS.test(text);
/** A field named like copy, in data, judged by its value: copy unless the value is a camelCase name or a class string (a kebab-case name is one: `text-steel`). */
const readsAsCopy = (text) => reads(text) && !CAMEL.test(text) && !classString(text);
const readsAsWords = (text) => readsAsCopy(text) && !TOKEN.test(text);

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

/**
 * A string of utility classes, which holds no words: every class printable
 * ASCII with no capital outside its brackets, its utility a bare one
 * (BARE_UTILITIES) or one with a value (`gap-6`, `p-[3px]`, `w-1/2`,
 * `[mask-type:alpha]`), and at least one class with a value or a variant, so
 * lowercase prose (`free shipping`) never reads as one.
 */
export function classString(text) {
  const classes = parseClasses(text);
  const valued = (utility) => /^[a-z][a-z0-9]*(?:-\S|\[)/.test(utility) || /^\[[^\]]+\]$/.test(utility);
  const utility = ({ text: cls, utility: name }) => /^[!-~]+$/.test(cls) && !/[A-Z]/.test(cls.replace(/\[[^\]]*\]|\([^)]*\)/g, "")) && (BARE_UTILITIES.has(name) || valued(name));
  return classes.length > 0 && classes.every(utility) && classes.some(({ variants, utility: name }) => variants.length > 0 || valued(name));
}

/** The props whose strings are copy whenever they have a letter or a digit in them, on any element. */
export const COPY_PROPS = ["children", "title", "alt", "aria-label", "aria-description", "aria-roledescription", "aria-valuetext", "aria-placeholder", "placeholder", "label", "heading", "eyebrow", "text", "body", "description", "caption", "subtitle", "summary", "quote"];
/** The props of a component whose strings are never copy, whatever they read like: class names, ids, routes and URLs, types and roles, the native attributes a primitive passes through, and an icon's path data. */
export const SKIPPED_PROPS = ["className", "class", "id", "key", "ref", "style", "href", "src", "srcSet", "sizes", "media", "type", "role", "rel", "target", "as", "lang", "dir", "name", "htmlFor", "form", "method", "action", "accept", "autoComplete", "inputMode", "enterKeyHint", "pattern", "loading", "decoding", "fetchPriority", "crossOrigin", "referrerPolicy", "integrity", "nonce", "width", "height", "dateTime", "tabIndex", "slot", "d", "viewBox", "points", "transform", "preserveAspectRatio", "fill", "stroke"];
/** The same by shape: data-* and the aria-* attributes that are not copy (ids, states), event handlers, and the props named as a class name, an id, a route or an element (`headingClassName`, `panelId`, `ctaHref`, `imageSrc`, `feedUrl`, `headingAs`). */
export const SKIPPED_PATTERN = /^(?:data-|aria-|on[A-Z])|(?:ClassName|Id|Href|Src|Url|As)$/;

const docs = (file) => `agentic-cms's ${file}`;
const tail = (doc) => ` (${doc})`;

// --- reading the tree -------------------------------------------------------

/** An element's name as written: `div`, `Button`, `Motion.div`, `svg:title`. */
export function elementName(name) {
  if (!name) return "";
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") return `${elementName(name.object)}.${elementName(name.property)}`;
  if (name.type === "JSXNamespacedName") return `${name.namespace.name}:${name.name.name}`;
  return "";
}
const attrName = (attr) => (attr.name.type === "JSXNamespacedName" ? `${attr.name.namespace.name}:${attr.name.name.name}` : attr.name.name);
const intrinsic = (name) => /^[a-z]/.test(name) && !name.includes(".");
export const attribute = (opening, name) => opening.attributes.find((attr) => attr.type === "JSXAttribute" && attrName(attr) === name);

/** The strings an expression can evaluate to as written: a literal, a template's pieces, both sides of a condition or a fallback. */
export function strings(node) {
  if (!node) return [];
  switch (node.type) {
    case "Literal": return typeof node.value === "string" ? [{ node, text: node.value }] : [];
    case "TemplateLiteral": return node.quasis.map((quasi) => ({ node: quasi, text: quasi.value.cooked ?? quasi.value.raw }));
    case "ConditionalExpression": return [...strings(node.consequent), ...strings(node.alternate)];
    case "LogicalExpression": return [...strings(node.left), ...strings(node.right)];
    case "AssignmentPattern": return strings(node.right);
    case "JSXExpressionContainer": case "TSAsExpression": case "TSSatisfiesExpression": case "TSNonNullExpression": case "ParenthesizedExpression": return strings(node.expression);
    default: return [];
  }
}

/** A string attribute's value as written (a literal, or a literal in braces); undefined otherwise. */
export function staticValue(attr) {
  const value = attr?.value;
  if (value?.type === "Literal") return value.value;
  if (value?.type === "JSXExpressionContainer" && value.expression.type === "Literal") return value.expression.value;
  if (value?.type === "JSXExpressionContainer" && value.expression.type === "TemplateLiteral" && !value.expression.expressions.length) return value.expression.quasis[0].value.cooked;
  return undefined;
}

/** Whether an opening element hides what it draws: aria-hidden (but `aria-hidden={false}`), or a primitive named in `decorations`. */
function hides(opening, decorations) {
  const hidden = attribute(opening, "aria-hidden");
  if (hidden && staticValue(hidden) !== "false" && !(hidden.value?.type === "JSXExpressionContainer" && hidden.value.expression.value === false)) return true;
  return decorations.includes(elementName(opening.name));
}

/** A function's name: its own, or the const it is assigned to. */
const functionName = (fn) => fn.id?.name ?? (fn.parent?.type === "VariableDeclarator" ? fn.parent.id.name : undefined);

/** Whether a node sits inside a decoration: under, or among the props of, an element that hides what it draws, or in the definition of a primitive named in `decorations` (what it draws is aria-hidden by its contract). */
function decorated(node, decorations) {
  for (let at = node.parent; at; at = at.parent) {
    if (at.type === "JSXOpeningElement" && hides(at, decorations)) return true;
    if (at.type === "JSXElement" && hides(at.openingElement, decorations)) return true;
    if (/Function/.test(at.type) && decorations.includes(functionName(at))) return true;
  }
  return false;
}

/** Every return of a function of its own (not of the functions inside it): the expressions it can return. */
function returns(fn, keys) {
  if (fn.body.type !== "BlockStatement") return [fn.body];
  const out = [];
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "ReturnStatement") { out.push(node.argument); return; }
    if (/Function/.test(node.type)) return;
    for (const key of keys[node.type] ?? []) [node[key]].flat().forEach(visit);
  };
  fn.body.body.forEach(visit);
  return out;
}

/** The const a name is bound to here, or null: its declarator. */
function binding(sourceCode, identifier) {
  for (let scope = sourceCode.getScope(identifier); scope; scope = scope.upper) {
    const variable = scope.set.get(identifier.name);
    if (variable) return variable.defs[0]?.type === "Variable" && variable.defs[0].parent.kind === "const" ? variable.defs[0].node : null;
  }
  return null;
}

// --- the rules --------------------------------------------------------------

const copySchema = [{
  type: "object",
  properties: {
    props: { type: "array", items: { type: "string" } },
    skip: { type: "array", items: { type: "string" } },
    decorations: { type: "array", items: { type: "string" } },
    tools: { type: "array", items: { type: "string" } },
    place: { type: "string" },
    route: { type: "string" },
  },
  additionalProperties: false,
}];

/** The modules whose components are the kit's design tools, which never ship: their props name a block for review (a study, a timeline) and are no copy. */
export const TOOLS = ["agentic-cms/lab"];
/** The kit's play-once layer (a site with a motion folder wraps it there; a site without one has it as its motion layer), whose components' `preset` names an effect (`slideInLeft`), never copy. */
export const KIT_MOTION = "agentic-cms/ix";

/**
 * Copy: text with a letter or a digit in it, where a reader sees it. JSX
 * text; a copy prop's string (COPY_PROPS, or `props`) on any element; a
 * data field of that name unless its value is a name or a class string
 * (`text: "text-steel"` in a class map); on a component, any other prop's
 * string that reads as words (a space or a capital in it, or a letter
 * outside ASCII) — but the props SKIPPED_PROPS and SKIPPED_PATTERN name,
 * `skip`, and `preset` on the play-once layer's components; on a native
 * element, `value` when it reads as words, and HTML handed to
 * dangerouslySetInnerHTML outside a <script> or a <style>. A symbol (→, ·)
 * has no letter; a token (`primary`, `aspect-video`, `24/7`), a camelCase
 * name (`slideInLeft`) and a string of utility classes (`flex flex-col
 * gap-6`) read as no words; anything under or among the props of an
 * aria-hidden element or a decoration (`decorations`) is a decoration; the
 * props of a component imported from a design tool's module (`tools`) are
 * the tool's words, what it wraps still copy. The message says where the
 * copy goes from this `place` (`route`).
 */
const copy = {
  meta: { type: "problem", docs: { description: "Every word a reader sees comes from content/ or site.ts's chrome, through props (the content engine)." }, schema: copySchema },
  create(context) {
    const { props = COPY_PROPS, skip = [], decorations = [], tools = TOOLS, place = "code", route = "every word a reader sees comes from content/ or the chrome in src/config/site.ts, through props." } = context.options[0] ?? {};
    const toolNames = new Set();
    const motionNames = new Set();
    const pass = `Symbols pass, and decorations: aria-hidden text${decorations.length ? ` and the props and children of ${decorations.join(", ")}` : ""}.${tail(`the content engine; the copy rule is ${docs("docs/primitives.md § Enforced")}`)}`;
    const report = (node, what) => context.report({ node, message: `No copy ${what}in ${place}: ${route} ${pass}` });
    const skipped = (name) => SKIPPED_PROPS.includes(name) || skip.includes(name) || SKIPPED_PATTERN.test(name);
    const each = (node, test, what) => { for (const piece of strings(node)) if (test(piece.text)) report(piece.node, what); };
    return {
      ImportDeclaration(node) {
        if (tools.includes(node.source.value)) for (const spec of node.specifiers) toolNames.add(spec.local.name);
        if (node.source.value === KIT_MOTION) for (const spec of node.specifiers) motionNames.add(spec.local.name);
      },
      JSXText(node) { if (reads(node.value) && !decorated(node, decorations)) report(node, ""); },
      JSXExpressionContainer(node) {
        if (["JSXElement", "JSXFragment"].includes(node.parent.type) && !decorated(node, decorations)) each(node.expression, reads, "");
      },
      JSXAttribute(node) {
        const name = attrName(node);
        const opening = node.parent;
        const element = elementName(opening.name);
        if (!node.value || decorated(node, decorations) || toolNames.has(element.split(".")[0])) return;
        if (props.includes(name)) return each(node.value, reads, `in a prop (${name}) `);
        if (name === "dangerouslySetInnerHTML") return element === "script" || element === "style" ? undefined : html(node.value);
        if (name === "preset" && motionNames.has(element.split(".")[0])) return;
        if (intrinsic(element) ? name === "value" : !skipped(name)) each(node.value, readsAsWords, `in a prop (${name}) `);
      },
      Property(node) {
        const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
        if (!node.computed && props.includes(key) && !decorated(node, decorations)) each(node.value, readsAsCopy, `in data (a ${key} field) `);
      },
    };
    function html(value) {
      const object = value.type === "JSXExpressionContainer" ? value.expression : null;
      const field = object?.type === "ObjectExpression" ? object.properties.find((p) => p.type === "Property" && (p.key.name ?? p.key.value) === "__html") : null;
      if (field) each(field.value, (text) => reads(text.replace(/<[^>]*>/g, "")), "in HTML (dangerouslySetInnerHTML) ");
    }
  },
};

const HEAD = `the head is the SEO engine's: a route's metadata or generateMetadata returns a kit.seo helper (pageMetadata, postMetadata, rootMetadata, unlistedMetadata), its structured data is <JsonLd data={kit.seo.…} /> from agentic-cms/components${tail(docs("src/lib/seo/README.md"))}`;
const HEAD_ELEMENTS = { head: "<head>", title: "<title>", meta: "<meta>" };

/**
 * The head: no <head>, <title> (but an svg's), <meta>, canonical <link> or
 * application/ld+json <script>, and no next/head; an exported `metadata` is
 * a kit.seo call, and every return of `generateMetadata` one too (or `{}`,
 * the page that is not there): a call of `seo.…` or `….seo.…`, of a helper
 * imported from agentic-cms/seo or destructured from kit.seo, directly or
 * through a const, behind a condition, `await` or `satisfies`.
 */
const head = {
  meta: { type: "problem", docs: { description: "The head, the metadata and the structured data come through kit.seo (the SEO engine)." }, schema: [] },
  create(context) {
    const { sourceCode } = context;
    const fromSeoModule = new Set();
    const report = (node, what) => context.report({ node, message: `No ${what} of the site's own: ${HEAD}.` });
    const seoObject = (node) => (node.type === "Identifier" && (node.name === "seo" || fromSeoModule.has(node.name))) || (node.type === "MemberExpression" && !node.computed && node.property.name === "seo");
    const seoCallee = (callee) => {
      if (callee.type === "MemberExpression") return seoObject(callee.object);
      if (callee.type !== "Identifier") return false;
      if (fromSeoModule.has(callee.name)) return true;
      const declarator = binding(sourceCode, callee);
      return Boolean(declarator && declarator.id.type === "ObjectPattern" && declarator.init && seoObject(declarator.init));
    };
    const fromSeo = (node) => {
      if (!node) return false;
      switch (node.type) {
        case "AwaitExpression": case "TSAsExpression": case "TSSatisfiesExpression": case "TSNonNullExpression": case "ParenthesizedExpression": return fromSeo(node.argument ?? node.expression);
        case "ConditionalExpression": return fromSeo(node.consequent) && fromSeo(node.alternate);
        case "LogicalExpression": return fromSeo(node.left) && fromSeo(node.right);
        case "ObjectExpression": return node.properties.length === 0;
        case "CallExpression": return seoCallee(node.callee);
        case "Identifier": { const declarator = binding(sourceCode, node); return Boolean(declarator && declarator.id.type === "Identifier" && fromSeo(declarator.init)); }
        default: return false;
      }
    };
    const checkReturns = (fn) => { for (const value of returns(fn, sourceCode.visitorKeys)) if (!fromSeo(value)) report(value ?? fn, "metadata from generateMetadata"); };
    const isFunction = (node) => node && /Function/.test(node.type);
    return {
      ImportDeclaration(node) {
        if (node.source.value === "next/head") report(node, "next/head");
        if (node.source.value === "agentic-cms/seo") for (const spec of node.specifiers) fromSeoModule.add(spec.local.name);
      },
      JSXOpeningElement(node) {
        const name = elementName(node.name);
        if (name === "title" && context.sourceCode.getAncestors(node).some((at) => at.type === "JSXElement" && elementName(at.openingElement.name) === "svg")) return;
        if (Object.hasOwn(HEAD_ELEMENTS, name)) report(node, HEAD_ELEMENTS[name]);
        if (name === "link" && /(^|\s)canonical(\s|$)/i.test(staticValue(attribute(node, "rel")) ?? "")) report(node, "canonical <link>");
        if (name === "script" && staticValue(attribute(node, "type")) === "application/ld+json") report(node, "JSON-LD <script>");
      },
      ExportNamedDeclaration(node) {
        const { declaration } = node;
        if (declaration?.type === "FunctionDeclaration" && declaration.id?.name === "generateMetadata") checkReturns(declaration);
        if (declaration?.type !== "VariableDeclaration") return;
        for (const declarator of declaration.declarations) {
          if (declarator.id.name === "metadata" && !fromSeo(declarator.init)) report(declarator, "metadata");
          if (declarator.id.name === "generateMetadata" && isFunction(declarator.init)) checkReturns(declarator.init);
        }
      },
    };
  },
};

const FORMS = `a form is a definition in src/config/forms.ts that the form engine's Form renders and posts, through its backend or its endpoint POST /api/forms/[id]; the form component is named in "owners" in src/config/components.json${tail(`the form engine, ${docs("docs/forms.md")}`)}`;
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/** Forms: no <form> outside the form components (the `owners` block turns this off there), no "use server" anywhere, no fetch() of an absolute URL in a component (.jsx, .tsx). */
const forms = {
  meta: { type: "problem", docs: { description: "Forms go through the form engine and its endpoint." }, schema: [] },
  create(context) {
    const component = /\.[jt]sx$/.test(context.filename);
    const fetchCall = (callee) => (callee.type === "Identifier" && callee.name === "fetch") || (callee.type === "MemberExpression" && !callee.computed && callee.property.name === "fetch" && callee.object.type === "Identifier" && ["window", "globalThis", "self"].includes(callee.object.name));
    return {
      JSXOpeningElement(node) { if (elementName(node.name) === "form") context.report({ node, message: `No <form> of the site's own: ${FORMS}.` }); },
      ExpressionStatement(node) { if (node.directive === "use server") context.report({ node, message: `No server action: ${FORMS}.` }); },
      CallExpression(node) {
        if (!component || !fetchCall(node.callee)) return;
        const [first] = strings(node.arguments[0]);
        if (first && ABSOLUTE.test(first.text)) context.report({ node, message: `No fetch() of another origin in a component: ${FORMS}.` });
      },
    };
  },
};

const TAGS = `a tag loads through agentic-cms/consent: its adapter (GoogleTag, from agentic-cms/consent/google, for Google's) follows the visitor's choice, and an adapter of the site's own is named in "owners" in src/config/components.json${tail(docs("docs/consent.md"))}`;

/** Tags: no next/script, and no <script src> of another origin (or of one the lint cannot read), outside the consent adapter that owns them (the `owners` block turns this off there). */
const tags = {
  meta: { type: "problem", docs: { description: "A tag that needs consent loads through agentic-cms/consent." }, schema: [] },
  create(context) {
    const report = (node, what) => context.report({ node, message: `No ${what} outside the consent adapter: ${TAGS}.` });
    const nextScript = (node) => node?.type === "Literal" && node.value === "next/script";
    return {
      ImportDeclaration(node) { if (nextScript(node.source)) report(node, "next/script"); },
      ImportExpression(node) { if (nextScript(node.source)) report(node, "next/script"); },
      CallExpression(node) { if (node.callee.type === "Identifier" && node.callee.name === "require" && nextScript(node.arguments[0])) report(node, "next/script"); },
      JSXOpeningElement(node) {
        const src = elementName(node.name) === "script" ? attribute(node, "src") : null;
        if (!src?.value) return;
        const [first] = strings(src.value);
        if (!first || ABSOLUTE.test(first.text) || !/^[./]/.test(first.text)) report(node, "<script src> of another origin");
      },
    };
  },
};

const EMAIL = `an address reaches a page as <EmailLink token={encodeEmail(address)} /> (agentic-cms/components, agentic-cms/email), which keeps it out of the served HTML${tail(docs("docs/email.md"))}`;

/** E-mail: no mailto: link built in code — a string with an address after mailto:, a template with mailto: in it, a mailto: added to something; a bare "mailto:" an href is tested against (a post body's link mapping) builds none. */
const email = {
  meta: { type: "problem", docs: { description: "An e-mail address reaches a page through EmailLink." }, schema: [] },
  create(context) {
    const report = (node) => context.report({ node, message: `No mailto: link: ${EMAIL}.` });
    const added = (node) => node.parent.type === "BinaryExpression" && node.parent.operator === "+";
    return {
      Literal(node) { if (typeof node.value === "string" && /mailto:/i.test(node.value) && (/mailto:\S/i.test(node.value) || added(node))) report(node); },
      TemplateElement(node) { if (/mailto:/i.test(node.value.raw)) report(node); },
    };
  },
};

/** The required rules, by their short names: the `agentic-cms` plugin componentRules() registers holds them beside the preferred ones (./preferred-rules.mjs). */
export const ENGINE_RULES = { copy, head, forms, tags, email };
