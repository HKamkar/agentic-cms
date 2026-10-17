import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { Linter } from "eslint";
import { componentRules, copySyntax, defaultElements, resolveOptions } from "./component-lint.mjs";

// The rules run as a site runs them: the `react` plugin is the one
// eslint-config-next registers, the planted files are linted by their path.
const require = createRequire(import.meta.url);
const react = createRequire(require.resolve("eslint-config-next"))("eslint-plugin-react");
const BASE = { files: ["**/*.{js,jsx,mjs,ts,tsx}"], plugins: { react }, languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }, settings: { react: { version: "19" } } };
const EVERY_LAYER = { sections: ["home", "sections"] };
const EXAMPLE = { motion: null, patterns: null, sections: ["home", "sections"] };

/** The messages linting `code` as the site file `file` gives, under componentRules(options). */
function lint(file, code, options = EVERY_LAYER) {
  const linter = new Linter({ cwd: "/site" });
  return linter.verify(code, [BASE, ...componentRules(options)], { filename: `/site/${file}` }).map((m) => `${m.ruleId}: ${m.message}`);
}
const one = (file, code, options) => {
  const messages = lint(file, code, options);
  assert.equal(messages.length, 1, messages.join("\n"));
  return messages[0];
};
const section = (jsx, options) => lint("src/components/home/Hero.tsx", `export function Hero() { return ${jsx}; }`, options);

test("the layers import one way: ui, patterns and motion each refuse what is built on them, by alias and relatively", () => {
  assert.match(one("src/components/ui/Card.tsx", 'import { Hero } from "@/components/home/Hero";'), /no-restricted-imports: .*A primitive cannot depend on what is built from it/);
  assert.match(one("src/components/ui/Card.tsx", 'import { Split } from "../patterns/Split";'), /A primitive cannot depend on what is built from it/);
  assert.match(one("src/components/ui/form/Field.tsx", 'import { render } from "../../sections/render";'), /A primitive cannot depend on/);
  assert.match(one("src/components/patterns/Split.tsx", 'import { Hero } from "@/components/home/Hero";'), /A pattern is shared by sections; it cannot depend on one/);
  assert.match(one("src/components/motion/Rise.tsx", 'import { Button } from "@/components/ui/Button";'), /The motion layer is the bottom one/);
});

test("the other direction is free: a section imports every layer, a pattern ui and motion, a primitive the motion layer", () => {
  const imports = ['import { Button } from "@/components/ui/Button";', 'import { Split } from "@/components/patterns/Split";', 'import { Rise } from "@/components/motion/Rise";'].join("\n");
  assert.deepEqual(lint("src/components/home/Hero.tsx", imports), []);
  assert.deepEqual(lint("src/components/patterns/Split.tsx", 'import { Button } from "../ui/Button";\nimport { Rise } from "../motion/Rise";'), []);
  assert.deepEqual(lint("src/components/ui/Heading.tsx", 'import { Rise } from "@/components/motion/Rise";'), []);
});

test("with a motion folder, only it imports an animation library or the kit's layer; everything else in src, the routes included, is refused", () => {
  for (const name of ["motion/react", "framer-motion", "agentic-cms/ix"]) {
    assert.match(one("src/components/home/Hero.tsx", `import x from "${name}";`), /Animate through the motion layer \(src\/components\/motion\): a new effect is a new motion primitive there/);
    assert.deepEqual(lint("src/components/motion/Rise.tsx", `import x from "${name}";`), [], `${name} in the motion layer`);
  }
  assert.match(one("src/app/page.tsx", 'import { motion } from "motion";'), /Animate through the motion layer/);
  assert.match(one("src/components/ui/Card.tsx", 'import { Reveal } from "agentic-cms/ix";'), /Animate through the motion layer/);
});

test("a missing layer is allowed: with no motion folder agentic-cms/ix is the motion layer, the libraries stay out, and no config names the absent folders", () => {
  assert.deepEqual(lint("src/components/ui/Heading.tsx", 'import { Reveal } from "agentic-cms/ix";', EXAMPLE), []);
  assert.deepEqual(lint("src/components/home/Hero.tsx", 'import { Reveal } from "agentic-cms/ix";\nimport { Button } from "@/components/ui/Button";', EXAMPLE), []);
  assert.match(one("src/components/ui/Heading.tsx", 'import { animate } from "motion";', EXAMPLE), /Animate through agentic-cms\/ix, the kit's play-once layer/);
  const files = componentRules(EXAMPLE).flatMap((config) => [...config.files, ...(config.ignores ?? [])]);
  assert.ok(files.every((glob) => !/null|undefined|patterns|motion\//.test(glob)), files.join("\n"));
});

const SITE_IMPORTS = { ...EVERY_LAYER, restrictedImports: { paths: [{ name: "lodash", message: "Use the platform." }], patterns: [{ group: ["@/lib/db", "@/lib/db/**"], message: "A component reads no database." }] } };

test("restrictedImports: a site's own restrictions are reported in every layer and in the routes, in the rule's own form", () => {
  for (const file of ["src/components/home/Hero.tsx", "src/components/ui/Card.tsx", "src/components/patterns/Split.tsx", "src/components/motion/Rise.tsx", "src/app/page.tsx"]) {
    assert.match(one(file, 'import { chunk } from "lodash";', SITE_IMPORTS), /^no-restricted-imports: .*Use the platform\./, file);
    assert.match(one(file, 'import { posts } from "@/lib/db/posts";', SITE_IMPORTS), /^no-restricted-imports: .*A component reads no database\./, file);
  }
  const strings = { ...EXAMPLE, restrictedImports: { paths: ["lodash"], patterns: ["lodash/*", "!lodash/pick"] } };
  assert.equal(lint("src/components/home/Hero.tsx", 'import chunk from "lodash/chunk";\nimport pick from "lodash/pick";\nimport x from "lodash";', strings).length, 2, "string patterns are one group, as the rule reads them");
  assert.deepEqual(lint("src/components/home/Hero.tsx", 'import chunk from "lodash";', { ...EVERY_LAYER, restrictedImports: null }), [], "null is none");
  for (const restrictedImports of [["lodash"], { paths: "lodash" }, { name: "lodash" }]) {
    assert.throws(() => componentRules({ restrictedImports }), /restrictedImports is \{ paths, patterns \}/, JSON.stringify(restrictedImports));
  }
});

test("restrictedImports extends the kit's restrictions in the same files, where a block of the site's own would replace them", () => {
  assert.match(one("src/components/ui/Card.tsx", 'import { Hero } from "@/components/home/Hero";', SITE_IMPORTS), /A primitive cannot depend on what is built from it/);
  assert.match(one("src/components/patterns/Split.tsx", 'import { Hero } from "@/components/home/Hero";', SITE_IMPORTS), /A pattern is shared by sections/);
  assert.match(one("src/components/motion/Rise.tsx", 'import { Button } from "@/components/ui/Button";', SITE_IMPORTS), /The motion layer is the bottom one/);
  assert.match(one("src/components/home/Hero.tsx", 'import { animate } from "motion";', SITE_IMPORTS), /Animate through the motion layer/);
  assert.deepEqual(lint("src/components/motion/Rise.tsx", 'import { animate } from "motion";', SITE_IMPORTS), [], "the motion layer still imports a library");
  // The trap the option replaces: flat config keeps one setting of a rule per file, the last.
  const block = { files: ["src/components/**"], rules: { "no-restricted-imports": ["error", { paths: [{ name: "lodash", message: "Use the platform." }] }] } };
  const own = new Linter({ cwd: "/site" }).verify('import { Hero } from "@/components/home/Hero";', [BASE, ...componentRules(EVERY_LAYER), block], { filename: "/site/src/components/ui/Card.tsx" });
  assert.deepEqual(own, [], "a site's own block drops the layers' restrictions");
});

test("a section holds one component per file", () => {
  const messages = lint("src/components/home/Hero.tsx", "function Card() { return <li />; }\nexport function Hero() { return <ul><Card /></ul>; }");
  assert.deepEqual(messages, ["react/no-multi-comp: Declare only one React component per file"]);
});

test("no raw element in a section, each message naming the primitive to use", () => {
  const cases = { button: /Button \(a link\), a choice OutlineButton, an icon alone IconButton/, a: /TextLink \(in copy\)/, img: /Media from src\/components\/ui/, picture: /Media from/, video: /a primitive in src\/components\/ui/, input: /Form renders/, label: /Form renders/, h2: /Heading from src\/components\/ui/, h6: /Heading from/ };
  for (const [element, message] of Object.entries(cases)) {
    const [problem, ...rest] = section(`<div><${element} /></div>`);
    assert.equal(rest.length, 0, rest.join("\n"));
    assert.match(problem, new RegExp(`^react/forbid-elements: <${element}> is forbidden, .*${message.source}`));
  }
});

test("svg is refused in a section and allowed in a pattern; a pattern refuses the other elements", () => {
  assert.match(section("<svg />")[0], /Graphics are library pieces: Icon \(agentic-cms\/components\), Placeholder/);
  assert.deepEqual(lint("src/components/patterns/Mark.tsx", "export function Mark() { return <svg />; }"), []);
  assert.match(one("src/components/patterns/Mark.tsx", "export function Mark() { return <h3 />; }"), /Heading from/);
});

test("no style attribute and no arbitrary value", () => {
  assert.deepEqual(section('<div style={{ color: "red" }} />'), ["no-restricted-syntax: No inline styles: a token, a utility, or a variant of a primitive in src/components/ui."]);
  for (const classes of ["grid lg:grid-cols-[2fr_1fr]", "w-(--sidebar)", "data-[open]:block"]) {
    assert.match(section(`<div className="${classes}" />`).join("\n"), /No arbitrary values \(\[…\], \(…\)\): add a token to src\/app\/globals.css/, classes);
  }
});

test("no visual class, in a className literal, a template literal or a cx() literal, after any variant prefix", () => {
  const visual = /A section lays pieces out: fills, borders, radii, rings, outlines and shadows belong to a primitive/;
  for (const value of ['"p-4 border border-line"', '"hover:bg-fill"', '"lg:rounded-panel"', '{`p-4 ${gap} shadow-panel`}', '{cx("p-4", open && "ring-2")}', '{cx("p-4", "outline-none")}', '{"divide-y"}']) {
    const messages = section(`<div className=${value} />`);
    assert.equal(messages.length, 1, `${value}: ${messages.join("\n")}`);
    assert.match(messages[0], visual, value);
  }
  assert.match(lint("src/components/home/Hero.tsx", 'const box = cx("bg-fill");\nexport function Hero() { return <div className={box} />; }').join("\n"), visual, "cx() outside a className");
});

test("no motion class; layout, spacing and type classes pass", () => {
  for (const classes of ["transition-opacity", "animate-spin", "duration-300", "delay-150", "ease-out", "hover:transition"]) {
    assert.match(section(`<div className="${classes}" />`).join("\n"), /Motion is the motion layer's primitives \(src\/components\/motion\), never a transition or animation class/, classes);
  }
  assert.match(section('<div className="transition" />', EXAMPLE)[0], /Motion is the play-once layer \(agentic-cms\/ix\)/);
  assert.deepEqual(section('<ul className={cx("grid gap-4 lg:grid-cols-3", "mb-6 max-w-prose p-4 text-muted font-medium text-h1 list-disc pl-5")} />'), []);
});

test("the registry is left out of the section rules, and so are the files `ignores` names", () => {
  const two = "function A() { return <h2 />; }\nexport function B() { return <A />; }";
  assert.deepEqual(lint("src/components/sections/render.tsx", two), []);
  assert.equal(lint("src/components/sections/Group.tsx", two).length, 2);
  assert.deepEqual(lint("src/components/home/Legacy.tsx", two, { ...EVERY_LAYER, ignores: ["src/components/home/Legacy.tsx"] }), []);
  assert.deepEqual(lint("src/lib/ix/Reveal.tsx", 'import { animate } from "motion";', { ...EXAMPLE, ignores: ["src/lib/**"] }), []);
});

test("options: the elements map overrides a message or allows an element, and the folders move with `root`", () => {
  const options = { ...EVERY_LAYER, elements: { a: false, video: "Video is the site's Player." } };
  assert.deepEqual(section("<a />", options), []);
  assert.deepEqual(section("<video />", options), ["react/forbid-elements: <video> is forbidden, Video is the site's Player."]);
  const moved = { root: "app/ui-kit", src: "app", sections: ["blocks"], motion: null, patterns: null };
  assert.match(one("app/ui-kit/blocks/Hero.tsx", "export function Hero() { return <button />; }", moved), /Button \(a link\).*from app\/ui-kit\/ui/);
  assert.match(one("app/ui-kit/ui/Card.tsx", 'import { Hero } from "../blocks/Hero";', moved), /A primitive cannot depend on/);
  assert.equal(defaultElements("x/ui").h1, "Headings are Heading from x/ui (its level apart from its size); Section renders the section's own.");
});

const COPY = /^no-restricted-syntax: No copy in a section or a pattern: it goes in the page's file, content\/pages\/<slug>\.yaml → a field of the section \(its schema in src\/components\/sections\/schemas\.ts\) → a prop here/;
const COPY_PROP = /^no-restricted-syntax: No copy in a string prop \(title, alt, aria-label, placeholder, label, children\): it goes in the page's file, content\/pages\/<slug>\.yaml/;

test("no copy in a section: JSX text with a letter or a digit, written straight, as {…}, in a template or a fallback, in an element or a fragment", () => {
  for (const jsx of ["<p>Get started</p>", "<p>{heading} today</p>", "<p>{\"Read more\"}</p>", "<p>{`${count} customers`}</p>", "<p>{label ?? \"Untitled\"}</p>", "<><b>{n}</b> years</>", "<p>24/7</p>"]) {
    const messages = section(jsx);
    assert.equal(messages.length, 1, `${jsx}: ${messages.join("\n")}`);
    assert.match(messages[0], COPY, jsx);
  }
  const both = section('<p>{open ? "Close" : "Open"}</p>');
  assert.equal(both.length, 2, "one finding per string");
  assert.ok(both.every((message) => COPY.test(message)), both.join("\n"));
});

test("no copy in a copy-bearing prop: title, alt, aria-label, placeholder, label and children, written straight or as {…}", () => {
  for (const jsx of ['<Media alt="A dashboard" />', '<Section title="Why us" />', '<IconButton aria-label="Close menu" />', '<Field placeholder={"Your email"} />', "<Eyebrow label={`Step ${n}`} />", '<Button children="Go" />', '<Media alt={alt || "A dashboard"} />']) {
    const messages = section(jsx);
    assert.equal(messages.length, 1, `${jsx}: ${messages.join("\n")}`);
    assert.match(messages[0], COPY_PROP, jsx);
  }
  assert.match(one("src/components/patterns/Split.tsx", 'export function Split() { return <Media alt="Team" />; }'), COPY_PROP, "a pattern too");
});

test("no copy in a section's data: a field named as a copy prop, in an array at the top of the file or inline; keys and other fields pass", () => {
  const cards = 'const CARDS = [{ key: "fast", title: "Fast", "aria-label": `Read ${n}`, icon: "bolt" }];\nexport function Hero() { return <ul>{CARDS.map((c) => <li key={c.key}>{c.title}</li>)}</ul>; }';
  const messages = lint("src/components/home/Hero.tsx", cards);
  assert.equal(messages.length, 2, messages.join("\n"));
  assert.ok(messages.every((m) => /^no-restricted-syntax: No copy in a section's data \(a title, alt, aria-label, placeholder, label, children field\): it goes in the page's file/.test(m)), messages.join("\n"));
  assert.deepEqual(lint("src/components/home/Hero.tsx", 'const CARDS = ["first", "second"];\nconst SIZES = { title: 4, label: "" };\nexport function Hero() { return <ul>{CARDS.map((c) => <li key={c} />)}</ul>; }'), []);
});

test("copy from props passes, and so do symbols, whitespace, keys, class strings, other props and an aria-hidden decoration", () => {
  const clean = [
    "<Section heading={heading} eyebrow={eyebrow}><p>{body}</p><Media alt={image.alt} /></Section>",
    "<ul>{items.map((item) => <li key={item.id}>{item.title} · {item.text}</li>)}</ul>",
    '<p> → {" "} &amp; &nbsp; × </p>',
    '<p className="p-4 text-muted" id="intro" data-section="hero">{fn("key")}{String(i).padStart(2, "0")}</p>',
    '<Media alt="" href="/blog" type="button" />',
    '<span aria-hidden="true">01</span>',
    '<IconButton aria-hidden label="Decorative" />',
    '<Placeholder ratio="aspect-video" label="hero board" />',
    "<TypeTag label={`group · ${variant}`} />",
  ];
  for (const jsx of clean) assert.deepEqual(section(jsx), [], jsx);
  assert.match(section('<p><Icon aria-hidden="true" />Get started</p>')[0], COPY, "an aria-hidden child does not hide its parent's text");
});

test("a decoration's children are decoration, as its props are; the same text in anything else is copy", () => {
  const options = { ...EVERY_LAYER, copy: { decorations: ["Placeholder", "Backdrop"] } };
  for (const jsx of ["<Backdrop>Since 2019</Backdrop>", '<Backdrop>{"Since 2019"}</Backdrop>', "<Backdrop>{`Since ${year}`}</Backdrop>", "<Placeholder>hero board</Placeholder>"]) {
    assert.deepEqual(section(jsx, options), [], jsx);
  }
  for (const jsx of ["<Badge>Since 2019</Badge>", "<p><Backdrop />Since 2019</p>"]) {
    const messages = section(jsx, options);
    assert.equal(messages.length, 1, `${jsx}: ${messages.join("\n")}`);
    assert.match(messages[0], COPY, jsx);
  }
  assert.match(section("<p>Get started</p>", options)[0], /Symbols pass, and decorations: aria-hidden text and the props and children of Placeholder, Backdrop\.$/);
});

test("the copy rule is configurable: other props, other decorations, or off; the message names the registry's schemas", () => {
  assert.match(section('<Card caption="Hi" />', { ...EVERY_LAYER, copy: { props: ["caption"] } })[0], /No copy in a string prop \(caption\)/);
  assert.deepEqual(section('<Section title="Why us" />', { ...EVERY_LAYER, copy: { props: ["caption"] } }), [], "the props list replaces the default");
  assert.deepEqual(section('<Badge label="new" />', { ...EVERY_LAYER, copy: { decorations: ["Badge"] } }), []);
  assert.match(section('<Placeholder label="hero board" />', { ...EVERY_LAYER, copy: { decorations: [] } })[0], COPY_PROP, "no decorations: Placeholder's label is copy");
  assert.match(section("<Placeholder>hero board</Placeholder>", { ...EVERY_LAYER, copy: { decorations: [] } })[0], COPY, "no decorations: Placeholder's children are copy");
  assert.deepEqual(section("<p>Get started</p>", { ...EVERY_LAYER, copy: false }), []);
  assert.deepEqual(lint("src/components/home/Hero.tsx", 'const A = [{ title: "Fast" }];\nexport function Hero() { return <p>{A[0].title}</p>; }', { ...EVERY_LAYER, copy: false }), []);
  assert.deepEqual(lint("src/components/ui/Button.tsx", "export function Button() { return <button>Go</button>; }"), [], "a primitive is not a section");
  assert.match(copySyntax(resolveOptions({ root: "app/ui-kit", registry: "blocks/registry.tsx" }))[0].message, /its schema in app\/ui-kit\/blocks\/schemas\.ts/);
});
