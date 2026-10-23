import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { Linter } from "eslint";
import { ANIMATION_ALTERNATIVES, componentRules, COPY_PROPS, copyPlaces, defaultElements, PREFERRED, preferredConfigs, REQUIRED, RENDERING_LIBRARIES, requiredConfigs, resolveOptions } from "./component-lint.mjs";
import { parseClasses } from "./preferred-rules.mjs";

// The rules run as a site runs them: the `react` plugin is the one
// eslint-config-next registers, the planted files are linted by their path.
const require = createRequire(import.meta.url);
const react = createRequire(require.resolve("eslint-config-next"))("eslint-plugin-react");
const BASE = { files: ["**/*.{js,jsx,mjs,ts,tsx}"], plugins: { react }, languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }, settings: { react: { version: "19" } } };
const EVERY_LAYER = { sections: ["home", "sections"] };
const EXAMPLE = { motion: null, patterns: null, sections: ["home", "sections"] };

/** The messages linting `code` as the site file `file` gives under componentRules(options), at one severity: 2 the errors, 1 the warnings. */
function messages(file, code, options = EVERY_LAYER, severity = 2) {
  const linter = new Linter({ cwd: "/site" });
  return linter.verify(code, [BASE, ...componentRules(options)], { filename: `/site/${file}` }).filter((m) => m.severity === severity || m.fatal).map((m) => `${m.ruleId}: ${m.message}`);
}
/** The errors: the engines and the library's shape. */
const lint = (file, code, options) => messages(file, code, options, 2);
/** The warnings: the preferred tier. */
const warned = (file, code, options) => messages(file, code, options, 1);
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

const COPY = /^agentic-cms\/copy: No copy in a section or a pattern: it goes in the page's file, content\/pages\/<slug>\.yaml → a field of the section \(its schema in src\/components\/sections\/schemas\.ts\) → a prop here/;
const COPY_PROP = /^agentic-cms\/copy: No copy in a prop \([\w-]+\) in a section or a pattern: it goes in the page's file, content\/pages\/<slug>\.yaml/;
const COPY_DATA = /^agentic-cms\/copy: No copy in data \(a [\w-]+ field\) in a section or a pattern: it goes in the page's file/;
const ui = (jsx, options) => lint("src/components/ui/Card.tsx", `export function Card() { return ${jsx}; }`, options);

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

test("no copy in a copy prop, on any element: the named props' strings with a letter or a digit, written straight, as {…}, in a template or a fallback", () => {
  for (const jsx of ['<Media alt="A dashboard" />', '<Section title="Why us" />', '<IconButton aria-label="Close menu" />', '<Field placeholder={"Your email"} />', "<Eyebrow label={`Step ${n}`} />", '<Button children="Go" />', '<Media alt={alt || "A dashboard"} />', '<Section heading="ok" />', '<div title="menu" />', '<img alt="x" />']) {
    const messages = section(jsx).filter((m) => m.startsWith("agentic-cms/copy"));
    assert.equal(messages.length, 1, `${jsx}: ${messages.join("\n")}`);
    assert.match(messages[0], COPY_PROP, jsx);
  }
  assert.ok(["children", "title", "alt", "aria-label", "placeholder", "label", "heading", "eyebrow", "text", "body", "description", "caption"].every((prop) => COPY_PROPS.includes(prop)), "the six of 0.8.1 and the copy-shaped names");
  assert.match(one("src/components/patterns/Split.tsx", 'export function Split() { return <Media alt="Team" />; }'), COPY_PROP, "a pattern too");
});

test("any other prop of a component is copy when its string reads as words — a space, a capital, a letter outside ASCII; a token passes, and so does every skipped prop", () => {
  for (const jsx of ['<Badge note="Since 2019" />', '<Card tagline="Fast" />', '<Quote by="Ada Lovelace" />', '<Badge note="café" />', "<Card caption2={`${n} items`} />"]) {
    assert.match(section(jsx).join("\n"), /^agentic-cms\/copy: No copy in a prop \(\w+\) in a section or a pattern/, jsx);
  }
  const tokens = ['<Button variant="primary" size="lg" as="li" tone="muted" ratio="aspect-video" icon="arrow-right" />', '<Section type="home-hero" headingAs="h1" />', "<Badge note={`size-${n}`} />", '<Card count="24/7" />'];
  for (const jsx of tokens) assert.deepEqual(section(jsx), [], jsx);
  const skipped = ['<Button href="/Pricing Page" rel="noopener noreferrer" target="_blank" className="p-4 lg:p-8" />', '<Media src="/images/Hero Shot.webp" srcSet="a.webp 1x, b.webp 2x" sizes="(width >= 992px) 50vw, 100vw" />', '<Panel id="Main Panel" headingClassName="p-4 text-muted" ctaHref="/Contact Us" data-note="Some note" aria-describedby="a b" />', '<Icon kind="stroke" d="M12 2L2 7l10 5" viewBox="0 0 24 24" />', '<Time dateTime="2026-10-19T10:00:00Z" />'];
  for (const jsx of skipped) assert.deepEqual(section(jsx), [], jsx);
  assert.deepEqual(section('<Badge tone="Loud and Clear" />', { ...EVERY_LAYER, copy: { skip: ["tone"] } }), [], "copy.skip adds a site's own props to the skipped ones");
  assert.match(section('<Badge href="/x" tone="Loud" />', { ...EVERY_LAYER, copy: { skip: ["tone2"] } }).join("\n"), /\(tone\)/, "the skip list adds, never replaces");
});

test("on a native element only the copy props are read, `value` when it reads as words, and HTML handed to dangerouslySetInnerHTML outside a script or a style", () => {
  assert.deepEqual(ui('<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet"><path d="M12 2L2 7" fill="none" strokeLinecap="round" /></svg>'), []);
  assert.deepEqual(ui('<input type="hidden" value="de" name="Lang" />'), []);
  assert.match(ui('<input type="submit" value="Send it" />')[0], /No copy in a prop \(value\) in a primitive/);
  assert.match(ui('<div dangerouslySetInnerHTML={{ __html: "<h2>Our story</h2>" }} />')[0], /No copy in HTML \(dangerouslySetInnerHTML\) in a primitive/);
  assert.deepEqual(ui('<script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem(\'theme\')}catch(e){}" }} />'), [], "a script's text is code");
  assert.deepEqual(ui('<div dangerouslySetInnerHTML={{ __html: "<br/>" }} />'), [], "markup with no text");
});

test("no copy in data: a field named as a copy prop, in an array at the top of the file or inline, or a prop's default; keys and other fields pass", () => {
  const cards = 'const CARDS = [{ key: "fast", title: "Fast", "aria-label": `Read ${n}`, icon: "bolt" }];\nexport function Hero() { return <ul>{CARDS.map((c) => <li key={c.key}>{c.title}</li>)}</ul>; }';
  const messages = lint("src/components/home/Hero.tsx", cards);
  assert.equal(messages.length, 2, messages.join("\n"));
  assert.ok(messages.every((m) => COPY_DATA.test(m)), messages.join("\n"));
  assert.deepEqual(lint("src/components/home/Hero.tsx", 'const CARDS = ["first", "second"];\nconst SIZES = { title: 4, label: "" };\nexport function Hero() { return <ul>{CARDS.map((c) => <li key={c} />)}</ul>; }'), []);
  assert.match(lint("src/components/ui/Menu.tsx", 'export function Menu({ label = "Open the menu" }) { return <button aria-label={label} />; }')[0], /No copy in data \(a label field\) in a primitive/, "a default is copy in code");
  assert.match(lint("src/components/ui/Nav.tsx", 'const LINKS = [{ href: "/", label: "Home" }];\nexport function Nav() { return <ul>{LINKS.map((l) => <li key={l.href}>{l.label}</li>)}</ul>; }')[0], /No copy in data \(a label field\) in a primitive/);
});

test("copy from props passes, and so do symbols, whitespace, keys, class strings, other props and an aria-hidden decoration with everything under it", () => {
  const clean = [
    "<Section heading={heading} eyebrow={eyebrow}><p>{body}</p><Media alt={image.alt} /></Section>",
    "<ul>{items.map((item) => <li key={item.id}>{item.title} · {item.text}</li>)}</ul>",
    '<p> → {" "} &amp; &nbsp; × </p>',
    '<p className="p-4 text-muted" id="intro" data-section="hero">{fn("key")}{String(i).padStart(2, "0")}</p>',
    '<Media alt="" href="/blog" type="button" />',
    '<span aria-hidden="true">01</span>',
    '<p aria-hidden="true"><span>now</span> the current version</p>',
    '<IconButton aria-hidden label="Decorative" />',
    '<Placeholder ratio="aspect-video" label="hero board" />',
    "<TypeTag label={`group · ${variant}`} />",
  ];
  for (const jsx of clean) assert.deepEqual(section(jsx), [], jsx);
  assert.match(section('<p><Icon aria-hidden="true" />Get started</p>')[0], COPY, "an aria-hidden child does not hide its parent's text");
  assert.match(section('<p aria-hidden={false}>Get started</p>')[0], COPY, "aria-hidden={false} hides nothing");
});

test("a decoration's children are decoration, as its props are, and so is what its own definition draws; the same text in anything else is copy", () => {
  const options = { ...EVERY_LAYER, copy: { decorations: ["Placeholder", "Backdrop"] } };
  for (const jsx of ["<Backdrop>Since 2019</Backdrop>", '<Backdrop>{"Since 2019"}</Backdrop>', "<Backdrop>{`Since ${year}`}</Backdrop>", "<Placeholder>hero board</Placeholder>"]) {
    assert.deepEqual(section(jsx, options), [], jsx);
  }
  for (const jsx of ["<Badge>Since 2019</Badge>", "<p><Backdrop />Since 2019</p>"]) {
    const messages = section(jsx, options);
    assert.equal(messages.length, 1, `${jsx}: ${messages.join("\n")}`);
    assert.match(messages[0], COPY, jsx);
  }
  assert.match(section("<p>Get started</p>", options)[0], /Symbols pass, and decorations: aria-hidden text and the props and children of Placeholder, Backdrop\. \(the content engine; the copy rule is agentic-cms's docs\/primitives\.md § Enforced\)$/);
  assert.deepEqual(lint("src/components/ui/Placeholder.tsx", 'export function Placeholder({ label = "illustration" }) { return <div aria-hidden="true"><span>{label}</span></div>; }'), [], "the decoration's own default label");
});

test("the design tools' components (agentic-cms/lab) take labels of their own: their props are no copy, what they wrap still is", () => {
  const route = (body) => lint("src/app/hero-demo/page.tsx", `import { LabStudy, LabTimeline } from "agentic-cms/lab";\nexport default function Demo() { return ${body}; }`);
  assert.deepEqual(route('<><LabStudy file="public/images/mark-a.svg" label="A" /><LabTimeline label="now"><div data-lab-drive /></LabTimeline></>'), []);
  assert.match(route('<LabTimeline label="now"><h2>Our story</h2></LabTimeline>')[0], /No copy in a design round's route/);
  assert.match(lint("src/app/hero-demo/page.tsx", 'import { LabStudy } from "./lab";\nexport default function Demo() { return <LabStudy label="A" />; }')[0], /No copy in a prop \(label\)/, "a component of the same name from elsewhere is not the tool");
});

test("copy is required across src, each place with the message of its own: code, a primitive, a section or a pattern, a route, a design round's route; tests and ignored files left out", () => {
  const places = {
    "src/components/ui/Card.tsx": /No copy in a primitive: its words come in as props, from the section that uses it, or from the chrome in src\/config\/site\.ts\./,
    "src/components/motion/Rise.tsx": /No copy in a primitive/,
    "src/components/home/Hero.tsx": /No copy in a section or a pattern/,
    "src/app/not-found.tsx": /No copy in a route: a page's words are its file, content\/pages\/<slug>\.yaml, which the catch-all renders through the sections; a layout's and not-found's are the chrome in src\/config\/site\.ts\./,
    "src/app/layout.tsx": /No copy in a route/,
    "src/app/hero-demo/page.tsx": /No copy in a design round's route: it reads the page's copy from content\/pages\/<slug>\.yaml and hands it to the candidates as props, as `agentic-cms demo new --section` writes it; a showcase reads its copy from a content file too/,
    "src/app/lab-demo/page.tsx": /No copy in a design round's route/,
    "src/lib/Banner.tsx": /No copy in code: every word a reader sees comes from content\/ or the chrome in src\/config\/site\.ts, through props\./,
  };
  for (const [file, message] of Object.entries(places)) {
    const [found, ...rest] = lint(file, "export default function X() { return <p>Get started</p>; }");
    assert.equal(rest.length, 0, `${file}: ${rest.join("\n")}`);
    assert.match(found, message, file);
    assert.match(found, /^agentic-cms\/copy: /, file);
  }
  assert.deepEqual(lint("src/components/ui/Card.test.tsx", "export function T() { return <p>Get started</p>; }"), [], "a test's fixtures");
  assert.deepEqual(lint("src/lib/Banner.tsx", "export function B() { return <p>Get started</p>; }", { ...EVERY_LAYER, ignores: ["src/lib/**"] }), [], "the kit's own package source, by its ignore");
  assert.deepEqual(lint("src/config/site.ts", 'export const site = { name: "Acme", nav: [{ label: "Home", href: "/" }] };'), [], "site.ts is the chrome: a .ts file holds no JSX and is not read for data");
  assert.match(copyPlaces(resolveOptions({ root: "app/ui-kit", registry: "blocks/registry.tsx" })).section.route, /its schema in app\/ui-kit\/blocks\/schemas\.ts/);
});

test("the copy rule is configurable but required: other props, other decorations, never off", () => {
  assert.match(section('<Card caption="Hi" />', { ...EVERY_LAYER, copy: { props: ["caption"] } })[0], /No copy in a prop \(caption\)/);
  assert.deepEqual(section('<Section title="ok" />', { ...EVERY_LAYER, copy: { props: ["caption"] } }), [], "the props list replaces the default; another prop's token passes");
  assert.deepEqual(section('<Badge label="new" />', { ...EVERY_LAYER, copy: { decorations: ["Badge"] } }), []);
  assert.match(section('<Placeholder label="hero board" />', { ...EVERY_LAYER, copy: { decorations: [] } })[0], COPY_PROP, "no decorations: Placeholder's label is copy");
  assert.match(section("<Placeholder>hero board</Placeholder>", { ...EVERY_LAYER, copy: { decorations: [] } })[0], COPY, "no decorations: Placeholder's children are copy");
  assert.throws(() => componentRules({ copy: false }), /copy is \{ props, skip, decorations, tools \}, and the copy rule is required: a file that needs words of its own says why in an inline disable \(\/\/ eslint-disable-next-line agentic-cms\/copy -- <the reason>\)/);
  assert.match(lint("src/components/home/Hero.tsx", "// eslint-disable-next-line agentic-cms/copy -- the legal name, as registered\nexport function Hero() { return <p>Acme B.V.</p>; }").join("\n"), /^$/, "an inline disable turns it off for its line (the guard asks for the reason)");
});

const route = (code) => lint("src/app/pricing/page.tsx", code);

test("head: no <head>, <title>, <meta>, canonical <link>, JSON-LD script or next/head of the site's own, each message naming kit.seo and its README", () => {
  const head = /^agentic-cms\/head: No .* of the site's own: the head is the SEO engine's: a route's metadata or generateMetadata returns a kit\.seo helper \(pageMetadata, postMetadata, rootMetadata, unlistedMetadata\), its structured data is <JsonLd data=\{kit\.seo\.…\} \/> from agentic-cms\/components \(agentic-cms's src\/lib\/seo\/README\.md\)\.$/;
  for (const jsx of ["<head />", "<meta name=\"robots\" content=\"noindex\" />", '<link rel="canonical" href="/pricing" />', '<script type="application/ld+json">{json}</script>', "<title>{t}</title>"]) {
    const messages = route(`export default function P({ t, json }) { return ${jsx}; }`).filter((m) => m.startsWith("agentic-cms/head"));
    assert.equal(messages.length, 1, `${jsx}: ${messages.join("\n")}`);
    assert.match(messages[0], head, jsx);
  }
  assert.match(route('import Head from "next/head";')[0], /No next\/head of the site's own/);
  assert.deepEqual(lint("src/components/ui/Logo.tsx", "export function Logo({ name }) { return <svg role=\"img\"><title>{name}</title></svg>; }"), [], "an svg's <title> is its name, not the page's");
  assert.deepEqual(route('export default function P() { return <link rel="stylesheet" href="/x.css" />; }'), [], "a stylesheet link is no head of SEO's");
});

test("head: a route's metadata and generateMetadata come from kit.seo — a call of seo.… or ….seo.…, a helper from agentic-cms/seo or destructured from kit.seo, through a const, behind a condition or await, or {} for no page", () => {
  const clean = [
    "export const metadata = kit.seo.rootMetadata();",
    "export async function generateMetadata({ params }) { const page = pageAt((await params).slug); return page ? kit.seo.pageMetadata(page.seo) : {}; }",
    "const { seo } = kit;\nexport async function generateMetadata() { const post = get(); if (!post) return {}; return seo.postMetadata(post); }",
    'import { pageMetadata } from "agentic-cms/seo";\nexport function generateMetadata() { return pageMetadata(page.seo); }',
    "const { pageMetadata } = kit.seo;\nexport const generateMetadata = async () => pageMetadata(page.seo);",
    "export async function generateMetadata() { const meta = kit.seo.pageMetadata(page.seo); return meta; }",
    "export async function generateMetadata() { const list = items.map(() => { return { title: 1 }; }); return kit.seo.pageMetadata(list[0]); }",
  ];
  for (const code of clean) assert.deepEqual(route(code), [], code);
  // A site's routes are TypeScript: satisfies, as and ! pass through to the call.
  const ts = { files: ["**/*.tsx"], languageOptions: { parser: createRequire(require.resolve("eslint-config-next"))("@typescript-eslint/parser") } };
  const tsRoute = (code) => new Linter({ cwd: "/site" }).verify(code, [BASE, ts, ...componentRules(EVERY_LAYER)], { filename: "/site/src/app/pricing/page.tsx" }).map((m) => `${m.ruleId}: ${m.message}`);
  for (const code of ["export const metadata = kit.seo.unlistedMetadata() satisfies Metadata;", "export const metadata: Metadata = kit.seo.rootMetadata() as Metadata;", "export async function generateMetadata(): Promise<Metadata> { return kit.seo.pageMetadata(page!.seo); }"]) assert.deepEqual(tsRoute(code), [], code);
  assert.match(tsRoute('export const metadata = { title: "Pricing" } satisfies Metadata;').join("\n"), /^agentic-cms\/head: No metadata of the site's own/m);
  const own = [
    ['export const metadata = { title: "Pricing", description: "Plans" };', "metadata"],
    ["export const metadata = { ...kit.seo.pageMetadata(seo), robots: { index: false } };", "metadata"],
    ["export const metadata = buildMeta();", "metadata"],
    ["export async function generateMetadata() { return { title: post.title }; }", "metadata from generateMetadata"],
    ["export async function generateMetadata() { return post ? kit.seo.postMetadata(post) : { title: \"x\" }; }", "metadata from generateMetadata"],
    ["export const generateMetadata = () => ({ title: name });", "metadata from generateMetadata"],
  ];
  for (const [code, what] of own) {
    const messages = route(code).filter((m) => m.startsWith("agentic-cms/head"));
    assert.equal(messages.length, 1, `${code}: ${messages.join("\n")}`);
    assert.match(messages[0], new RegExp(`^agentic-cms/head: No ${what} of the site's own: `), code);
  }
});

test("forms: <form> only in the files `owners.forms` names; no server action anywhere; no fetch() of another origin in a component — a script elsewhere may", () => {
  const forms = /the form engine's Form renders and posts, through its backend or its endpoint POST \/api\/forms\/\[id\]; the form component is named in "owners" in src\/config\/components\.json \(the form engine, agentic-cms's docs\/forms\.md\)\.$/;
  const [form] = ui("<form />");
  assert.match(form, /^agentic-cms\/forms: No <form> of the site's own: a form is a definition in src\/config\/forms\.ts/);
  assert.match(form, forms);
  assert.match(lint("src/app/actions.ts", '"use server";\nexport async function send() {}')[0], /^agentic-cms\/forms: No server action: /);
  assert.match(lint("src/components/ui/Box.tsx", 'export function Box() { async function go() { "use server"; } return <button formAction={go} />; }')[0], /No server action/);
  for (const call of ['fetch("https://api.example.com/subscribe", { method: "POST" })', "fetch(`https://hooks.example.com/${id}`)", 'window.fetch("//cdn.example.com/x")']) {
    assert.match(lint("src/components/ui/Signup.tsx", `export function Signup() { const go = () => ${call}; return <button onClick={go} />; }`)[0], /^agentic-cms\/forms: No fetch\(\) of another origin in a component: /, call);
  }
  assert.deepEqual(lint("src/components/ui/Signup.tsx", 'export function Signup() { const go = () => fetch("/api/forms/signup"); return <button onClick={go} />; }'), [], "the site's own endpoint");
  assert.deepEqual(lint("src/lib/cms.ts", 'export const load = () => fetch("https://cms.example.com/entries");'), [], "a script that is no component");
  const owned = { ...EVERY_LAYER, owners: { forms: { "src/components/ui/form/Form.tsx": "the form engine's renderer" } } };
  assert.deepEqual(lint("src/components/ui/form/Form.tsx", "export function Form() { return <form />; }", owned), []);
  assert.deepEqual(lint("src/components/ui/form/Form.tsx", "export function Form() { return <form />; }", { ...EVERY_LAYER, owners: { forms: ["src/components/ui/form/Form.tsx"] } }), [], "a list of files too");
  assert.match(lint("src/components/ui/form/Field.tsx", "export function Field() { return <form />; }", owned)[0], /No <form>/, "only the file named");
});

test("tags: next/script and a <script src> of another origin only in the consent adapter `owners.tags` names; an inline script and the site's own file pass", () => {
  const tags = /outside the consent adapter: a tag loads through agentic-cms\/consent: its adapter \(GoogleTag, from agentic-cms\/consent\/google, for Google's\) follows the visitor's choice, and an adapter of the site's own is named in "owners" in src\/config\/components\.json \(agentic-cms's docs\/consent\.md\)\.$/;
  for (const code of ['import Script from "next/script";', 'const Script = require("next/script");', 'const load = () => import("next/script");']) {
    const [message] = lint("src/components/ui/Analytics.tsx", code);
    assert.match(message, /^agentic-cms\/tags: No next\/script outside the consent adapter/, code);
    assert.match(message, tags, code);
  }
  for (const jsx of ['<script src="https://www.googletagmanager.com/gtag/js?id=G-1" />', '<script async src="//cdn.example.com/a.js" />', "<script src={url} />", "<script src={`${CDN}/a.js`} />"]) {
    assert.match(lint("src/app/layout.tsx", `export default function L({ url }) { return ${jsx}; }`)[0], /^agentic-cms\/tags: No <script src> of another origin outside the consent adapter/, jsx);
  }
  for (const jsx of ['<script dangerouslySetInnerHTML={{ __html: THEME }} />', '<script src="/scripts/theme.js" />', "<script src={`/js/${name}.js`} />"]) {
    assert.deepEqual(lint("src/app/layout.tsx", `export default function L({ name }) { return ${jsx}; }`), [], jsx);
  }
  const owned = { ...EVERY_LAYER, owners: { tags: { "src/components/ui/PlausibleTag.tsx": "the consent adapter of the site's analytics" } } };
  assert.deepEqual(lint("src/components/ui/PlausibleTag.tsx", 'import Script from "next/script";', owned), []);
});

test("e-mail: no mailto: link built anywhere in src — an address after mailto:, a template, a concatenation — each message naming EmailLink and its doc", () => {
  for (const code of ['export function F({ a }) { return <a href={`mailto:${a}`}>{a}</a>; }', 'export const href = "mailto:hello@example.com";', 'export function F({ a }) { return <TextLink href={"MAILTO:" + a}>{a}</TextLink>; }']) {
    const messages = lint("src/components/ui/Footer.tsx", code).filter((m) => m.startsWith("agentic-cms/email"));
    assert.equal(messages.length, 1, code);
    assert.match(messages[0], /^agentic-cms\/email: No mailto: link: an address reaches a page as <EmailLink token=\{encodeEmail\(address\)\} \/> \(agentic-cms\/components, agentic-cms\/email\), which keeps it out of the served HTML \(agentic-cms's docs\/email\.md\)\.$/);
  }
  assert.deepEqual(lint("src/config/forms.ts", 'export const forms = { contact: { backend: { kind: "mailto", to: site.email } } };'), [], "the mailto backend's kind is no link");
  assert.deepEqual(lint("src/components/blog/mdx.tsx", 'export const a = ({ href, children }) => (href.startsWith("mailto:") ? <EmailLink token={encodeEmail(href.slice(7))} /> : <TextLink href={href}>{children}</TextLink>);'), [], "a post body's mapping tests an href against a bare mailto: and builds no link");
});

test("the required rules are the agentic-cms plugin's, set over src (and an app folder outside it), each owner block turning its part off; a bad owners or copy option throws", () => {
  assert.deepEqual(REQUIRED, ["agentic-cms/copy", "agentic-cms/head", "agentic-cms/forms", "agentic-cms/tags", "agentic-cms/email"]);
  const configs = requiredConfigs(resolveOptions({ ...EXAMPLE, owners: { forms: { "src/components/ui/form/Form.tsx": "r" } } }));
  assert.deepEqual(configs[0].files, ["src/**/*.{js,jsx,mjs,ts,tsx,mts}"]);
  assert.deepEqual(configs.at(-1), { files: ["src/components/ui/form/Form.tsx"], ignores: [], plugins: configs[0].plugins, rules: { "agentic-cms/forms": "off" } });
  assert.ok(configs.every((config) => config.plugins["agentic-cms"] === configs[0].plugins["agentic-cms"]), "one plugin object, so flat config never sees it redefined");
  assert.deepEqual(requiredConfigs(resolveOptions({ src: "src", app: "app" }))[0].files, ["src/**/*.{js,jsx,mjs,ts,tsx,mts}", "app/**/*.{js,jsx,mjs,ts,tsx,mts}"]);
  for (const owners of [{ form: ["x"] }, ["x"], null]) assert.throws(() => componentRules({ owners }), /owners is \{ forms: \{ "<file>": "<reason>" \}, tags: \{ "<file>": "<reason>" \}, images: \{ "<file>": "<reason>" \}, icons: \{ "<file>": "<reason>" \}, motion: \{ "<file>": "<reason>" \} \}/, JSON.stringify(owners));
  // The trap the guard closes: a later block that sets one of the required rules replaces it for its files.
  const block = { files: ["src/components/**"], rules: { "agentic-cms/copy": "off" } };
  assert.deepEqual(new Linter({ cwd: "/site" }).verify("export function Card() { return <p>Get started</p>; }", [BASE, ...componentRules(EVERY_LAYER), block], { filename: "/site/src/components/ui/Card.tsx" }), [], "a site's own block drops the rule; check-components fails it");
});

// The preferred tier: warnings that name the kit's part, which a reason quiets and the build never fails on.
const KEEP = / A site keeps its own with its reason: an "allow" entry in src\/config\/components\.json, or an inline disable with -- <why> \(agentic-cms's docs\/primitives\.md § Enforced\)\.$/;
/** The one warning linting `code` as `file` gives, and no error. */
const oneWarning = (file, code, options) => {
  assert.deepEqual(lint(file, code, options), [], "no error");
  const found = warned(file, code, options);
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], KEEP);
  return found[0];
};

test("the preferred rules are the same plugin's, set to warn across src: graphics, images, icons and motion everywhere, styling outside the sections and the patterns, tests left out", () => {
  assert.deepEqual(PREFERRED, ["agentic-cms/motion", "agentic-cms/graphics", "agentic-cms/images", "agentic-cms/icons", "agentic-cms/styling"]);
  const configs = preferredConfigs(resolveOptions(EVERY_LAYER));
  assert.ok(configs.every((config) => Object.values(config.rules).every((setting) => setting === "warn" || setting === "off")), "a warning, never an error");
  assert.ok(configs.every((config) => config.plugins["agentic-cms"] === requiredConfigs(resolveOptions(EVERY_LAYER))[0].plugins["agentic-cms"]), "one plugin object for both tiers");
  assert.deepEqual(configs.find((config) => config.rules["agentic-cms/motion"]).ignores, ["**/*.test.{js,jsx,mjs,ts,tsx,mts}", "src/components/motion/**"], "the motion layer owns motion");
  assert.deepEqual(configs.find((config) => config.rules["agentic-cms/styling"]).ignores, ["**/*.test.{js,jsx,mjs,ts,tsx,mts}", "src/components/patterns/**", "src/components/home/**", "src/components/sections/**"], "the composition holds the sections and the patterns");
  assert.deepEqual(warned("src/components/ui/Mark.test.tsx", "export function T() { return <svg />; }"), [], "a test's fixtures");
});

test("motion: another animation library, a requestAnimationFrame loop, an IntersectionObserver, el.animate(), a transition class or style, each naming agentic-cms/ix; the motion layer owns motion", () => {
  const ix = /: the kit's motion is agentic-cms\/ix — the play-once layer \(Reveal, RevealGroup, Sequence, part\(\)\) or the reveals that replay \(Fx, OnView\) — timed by the --ease-\* \/ --motion-\* tokens with its start states in src\/styles\/motion\.css, or a motion folder of the site's own that owns its library \(STANDARD\.md §7\)\./;
  const cases = {
    'import { gsap } from "gsap";': /^agentic-cms\/motion: An animation library of the site's own, gsap/,
    'import { ScrollTrigger } from "gsap/ScrollTrigger";': /, gsap\/ScrollTrigger/,
    'import { useSpring } from "@react-spring/web";': /, @react-spring\/web/,
    'const lottie = require("lottie-web");': /, lottie-web/,
    'const load = () => import("animejs");': /, animejs/,
    "export function tick() { requestAnimationFrame(tick); }": /A requestAnimationFrame loop of the site's own/,
    "export function tick() { window.requestAnimationFrame(tick); }": /A requestAnimationFrame loop/,
    "export const watch = () => new IntersectionObserver(() => {});": /A reveal of the site's own, an IntersectionObserver/,
    "export const fade = (el) => el.animate([{ opacity: 0 }, { opacity: 1 }], 300);": /An animation of the site's own, el\.animate\(\)/,
    'export function Card() { return <div className="p-4 transition-opacity" />; }': /A transition or animation class, "transition-opacity"/,
    'export function Card() { return <div className={cx("p-4", open && "hover:duration-300")} />; }': /, "hover:duration-300"/,
    'export const card = variants({ base: "p-4 animate-spin" });': /, "animate-spin"/,
    'export function Card() { return <div style={{ transition: "opacity 200ms" }} />; }': /A transition or animation in a style \(transition\)/,
    "export function Card({ ms }) { return <div style={{ animationDuration: ms }} />; }": /\(animationDuration\)/,
  };
  for (const [code, message] of Object.entries(cases)) {
    const found = oneWarning("src/components/ui/Card.tsx", code);
    assert.match(found, message, code);
    assert.match(found, ix, code);
  }
  const ts = { files: ["**/*.tsx"], languageOptions: { parser: createRequire(require.resolve("eslint-config-next"))("@typescript-eslint/parser") } };
  const typed = new Linter({ cwd: "/site" }).verify('import type { Tween } from "gsap";\nexport type T = Tween;', [BASE, ts, ...componentRules(EVERY_LAYER)], { filename: "/site/src/components/ui/Card.tsx" });
  assert.deepEqual(typed, [], "a type-only import brings no code");
  for (const code of ['export function Card() { return <div className="transition-none animate-none" style={{ transition: "none" }} />; }', "export const keys = (el) => el.animate();", 'import { Reveal } from "agentic-cms/ix";']) {
    assert.deepEqual(warned("src/components/ui/Card.tsx", code, EXAMPLE), [], code);
  }
  assert.deepEqual(warned("src/components/motion/Rise.tsx", 'import { gsap } from "gsap";\nexport function Rise() { requestAnimationFrame(() => {}); return <div className="transition-transform" />; }'), [], "the motion layer");
  assert.match(lint("src/components/ui/Card.tsx", 'import { animate } from "motion";').join("\n"), /no-restricted-imports/, "motion and framer-motion still fail outside the motion layer, with no second warning");
  assert.deepEqual(warned("src/components/ui/Card.tsx", 'import { animate } from "motion";'), []);
  assert.ok(["gsap", "@react-spring/", "animejs", "lottie-web", "popmotion"].every((name) => ANIMATION_ALTERNATIVES.includes(name)), "the libraries the preset keeps and documents");
});

test("graphics: a rendering library, a <canvas> or a canvas made in code, each naming the lab", () => {
  const lab = /draws in the reader's browser: graphics ship pre-rendered from the lab — agentic-cms lab new, lab serve, lab render — as a file a page embeds, inline Icon data or an InlineAnimation loop \(agentic-cms's docs\/lab\.md\)\./;
  for (const code of ['import * as THREE from "three";', 'import { Canvas } from "@react-three/fiber";', 'import { scaleLinear } from "d3-scale";', 'import * as d3 from "d3";', 'import { Application } from "pixi.js";', "export function Chart() { return <canvas />; }", 'export const make = () => document.createElement("canvas");', "export const off = () => new OffscreenCanvas(1, 1);"]) {
    const found = oneWarning("src/app/page.tsx", code);
    assert.match(found, /^agentic-cms\/graphics: /, code);
    assert.match(found, lab, code);
  }
  assert.deepEqual(warned("src/app/page.tsx", 'import { scale } from "d3fancy";\nexport const make = () => document.createElement("div");'), []);
  assert.ok(["three", "d3", "pixi.js", "p5"].every((name) => RENDERING_LIBRARIES.includes(name)));
});

test("images: next/image, and an eager <img> in a server component, each naming Media and EagerImage; a lazy one, a client component's, an unknown loading and the owner pass", () => {
  const media = /: a picture is a plain <img> with its width and height: Media, lazy below the fold, and above it in a server component EagerImage \(agentic-cms\/components\), which keeps it out of other pages' prefetches; the static host has no image service \(STANDARD\.md §4\)\./;
  const cases = { 'import Image from "next/image";': /The image service's next\/image/, 'export function Logo() { return <img src="/logo.svg" alt="" width={1} height={1} />; }': /An eager <img> in a server component/, 'export function Logo({ above }) { return <img src="/a.png" alt="" loading={above ? "eager" : "lazy"} />; }': /An eager <img>/, 'export function Logo() { return <img src="/a.png" alt="" loading="eager" />; }': /An eager <img>/ };
  for (const [code, message] of Object.entries(cases)) {
    const found = oneWarning("src/components/ui/Logo.tsx", code);
    assert.match(found, message, code);
    assert.match(found, media, code);
  }
  for (const code of ['export function Logo() { return <img src="/a.png" alt="" loading="lazy" />; }', '"use client";\nexport function Logo() { return <img src="/a.png" alt="" />; }', "export function Logo({ loading }) { return <img src=\"/a.png\" alt=\"\" loading={loading} />; }", 'export function Logo(props) { return <img alt="" {...props} />; }', 'import { EagerImage } from "agentic-cms/components";\nexport function Logo() { return <EagerImage src="/a.png" alt="" width={1} height={1} />; }']) {
    assert.deepEqual(warned("src/components/ui/Logo.tsx", code), [], code);
  }
  const owned = { ...EVERY_LAYER, owners: { images: { "src/components/ui/Media.tsx": "the picture primitive" } } };
  assert.deepEqual(warned("src/components/ui/Media.tsx", 'export function Media({ eager }) { return <img src="/a.png" alt="" loading={eager ? "eager" : "lazy"} />; }', owned), [], "the owner");
});

test("icons: an <svg> outside Icon, in a primitive, a route or a pattern, names Icon and the lab; its owner passes, and a section's fails as before", () => {
  const icon = /^agentic-cms\/icons: An <svg> of the site's own: an icon is Icon from agentic-cms\/components, its paths in src\/config\/icons\.ts \(agentic-cms icons add lucide:<name>, si:<slug>, file:<name>\); a mark or an illustration is drawn in the lab and ships as a file \(agentic-cms's docs\/icons\.md, docs\/lab\.md\)\./;
  for (const file of ["src/components/ui/Logo.tsx", "src/app/layout.tsx", "src/components/patterns/Mark.tsx"]) {
    assert.match(oneWarning(file, 'export default function L() { return <svg viewBox="0 0 24 24"><path d="M0 0h24" /></svg>; }'), icon, file);
  }
  assert.deepEqual(warned("src/components/ui/Icon.tsx", "export function Icon() { return <svg />; }", { ...EVERY_LAYER, owners: { icons: ["src/components/ui/Icon.tsx"] } }), [], "the owner");
  assert.match(section("<svg />")[0], /react\/forbid-elements: <svg> is forbidden, Graphics are library pieces/, "a section still fails it");
});

test("styling: an arbitrary value or property, an arbitrary breakpoint and a style colour outside the tokens warn in ui/ and src/app; a state variant and a token pass; a section fails them as before", () => {
  const tokens = /: a value the scale lacks is a token first, in the @theme static block of src\/app\/globals\.css, used as its utility \(the uneven grid lg:grid-cols-2-1 is --grid-template-columns-2-1\) \(STANDARD\.md §1\)\./;
  const cases = {
    '<div className="grid lg:grid-cols-[2fr_1fr_1fr]" />': /An arbitrary value, "lg:grid-cols-\[2fr_1fr_1fr\]"/,
    '<div className={cx("p-4", "bg-[#fafafa]")} />': /, "bg-\[#fafafa\]"/,
    '<div className="rounded-[6px]" />': /, "rounded-\[6px\]"/,
    '<div className="shadow-[0_1px_2px_black]" />': /, "shadow-\[0_1px_2px_black\]"/,
    '<div className="w-(--sidebar)" />': /, "w-\(--sidebar\)"/,
    '<div className="[mask-type:luminance]" />': /, "\[mask-type:luminance\]"/,
    '<div className="min-[900px]:flex" />': /A breakpoint outside the scale \(max-sm … 3xl\), "min-\[900px\]:flex"/,
    '<div style={{ color: "#ff0000" }} />': /A colour outside the tokens in a style \(color: "#ff0000"\)/,
    '<div style={{ background: "rgb(0 0 0 / 50%)" }} />': /\(background: "rgb\(0 0 0 \/ 50%\)"\)/,
    '<div style={{ borderColor: "rebeccapurple" }} />': /\(borderColor: "rebeccapurple"\)/,
  };
  for (const [jsx, message] of Object.entries(cases)) {
    for (const file of ["src/components/ui/Card.tsx", "src/app/page.tsx"]) {
      const found = oneWarning(file, `export default function C({ open }) { return ${jsx}; }`);
      assert.match(found, /^agentic-cms\/styling: /, jsx);
      assert.match(found, message, jsx);
      assert.match(found, tokens, jsx);
    }
  }
  assert.match(oneWarning("src/components/ui/card.ts", 'export const card = variants({ base: "p-4", variants: { tone: { loud: "text-[#f00]" } } });'), /"text-\[#f00\]"/, "a variants() map");
  const clean = ['<select className="pr-10 has-[option[value=\'\']:checked]:text-muted data-[open]:block group-hover:underline [&_p]:mt-2" />', '<div className="grid lg:grid-cols-2-1 text-h1 bg-fill" />', '<div style={{ color: "var(--color-ink)", background: "transparent", fill: "currentColor", "--d": "120ms" }} />'];
  for (const jsx of clean) assert.deepEqual(warned("src/components/ui/Card.tsx", `export function C() { return ${jsx}; }`), [], jsx);
  const sectionFile = lint("src/components/home/Hero.tsx", 'export function Hero() { return <div className="lg:grid-cols-[2fr_1fr]" />; }');
  assert.match(sectionFile.join("\n"), /no-restricted-syntax: No arbitrary values/, "a section fails it");
  assert.deepEqual(warned("src/components/home/Hero.tsx", 'export function Hero() { return <div className="lg:grid-cols-[2fr_1fr]" />; }'), [], "with no second warning");
});

test("a class list reads as its classes: variants split at the colons outside brackets, the utility without its ! and its leading -", () => {
  assert.deepEqual(parseClasses(" lg:hover:-mt-2  has-[option[value='']:checked]:text-muted !p-4 [&_p]:mt-2"), [
    { text: "lg:hover:-mt-2", variants: ["lg", "hover"], utility: "mt-2" },
    { text: "has-[option[value='']:checked]:text-muted", variants: ["has-[option[value='']:checked]"], utility: "text-muted" },
    { text: "!p-4", variants: [], utility: "p-4" },
    { text: "[&_p]:mt-2", variants: ["[&_p]"], utility: "mt-2" },
  ]);
});

test("allow: an entry keeps a preferred rule's warning quiet in its files, and nowhere else; an entry with a required rule, no rule, no files or no reason throws", () => {
  const options = { ...EVERY_LAYER, allow: [{ rule: "agentic-cms/icons", files: ["src/components/ui/Placeholder.tsx"], reason: "the wireframe's crossed box" }] };
  const svg = "export function P() { return <svg />; }";
  assert.deepEqual(warned("src/components/ui/Placeholder.tsx", svg, options), []);
  assert.equal(warned("src/components/ui/Logo.tsx", svg, options).length, 1, "only its files");
  assert.match(warned("src/components/ui/Placeholder.tsx", 'export function P() { return <div className="w-[3px]" />; }', options)[0], /agentic-cms\/styling/, "only its rule");
  const throws = {
    "agentic-cms/copy": /allow\[0\] \(agentic-cms\/copy\): a required rule is never allowed — a file that owns its part is named in owners, and a line that needs its own says why in an inline disable \(\/\/ eslint-disable-next-line agentic-cms\/copy -- <the reason>\)/,
    "agentic-cms/icon": /allow\[0\] \(agentic-cms\/icon\): allow is a list of \{ rule: "agentic-cms\/<rule>", files: \["<glob>", …\], reason: "<why the site keeps its own>" \}, the rule one of agentic-cms\/motion, agentic-cms\/graphics, agentic-cms\/images, agentic-cms\/icons, agentic-cms\/styling, agentic-cms\/site-tools/,
  };
  for (const [rule, message] of Object.entries(throws)) assert.throws(() => componentRules({ allow: [{ rule, files: ["x.tsx"], reason: "r" }] }), message, rule);
  assert.throws(() => componentRules({ allow: [{ rule: "agentic-cms/icons", files: [], reason: "r" }] }), /allow\[0\] \(agentic-cms\/icons\): its files are a list of globs/);
  for (const reason of [undefined, "", "  "]) assert.throws(() => componentRules({ allow: [{ rule: "agentic-cms/icons", files: ["x.tsx"], reason }] }), /allow\[0\] \(agentic-cms\/icons\): no reason — a site keeps its own choice with one line of why, which the review reads/, JSON.stringify(reason));
  assert.throws(() => componentRules({ allow: { rule: "agentic-cms/icons" } }), /^TypeError: componentRules\(\): allow is a list of/);
});

test("an allow entry of agentic-cms/site-tools is check-site's: componentRules() takes it with its reason and sets it in no ESLint block", () => {
  const allow = [{ rule: "agentic-cms/site-tools", files: ["scripts/shots.mjs"], reason: "the OG cards, rendered from the posts" }];
  const configs = componentRules({ ...EVERY_LAYER, allow });
  assert.ok(configs.every((config) => !("agentic-cms/site-tools" in (config.rules ?? {}))), "ESLint has no such rule to set");
  assert.deepEqual(new Linter({ cwd: "/site" }).verify("export const a = 1;", [BASE, ...configs], { filename: "/site/scripts/shots.mjs" }), []);
  assert.throws(() => componentRules({ allow: [{ ...allow[0], reason: "" }] }), /allow\[0\] \(agentic-cms\/site-tools\): no reason/);
});

test("an inline disable with its reason quiets a preferred rule for its line; the warnings never fail the lint", () => {
  assert.deepEqual(warned("src/components/ui/Logo.tsx", "// eslint-disable-next-line agentic-cms/icons -- the registered mark, drawn by its owner\nexport function Logo() { return <svg />; }"), []);
  const linter = new Linter({ cwd: "/site" });
  const all = linter.verify('import { gsap } from "gsap";\nexport function C() { return <canvas className="w-[3px]" />; }', [BASE, ...componentRules(EVERY_LAYER)], { filename: "/site/src/components/ui/C.tsx" });
  assert.deepEqual(all.map((m) => [m.ruleId, m.severity]), [["agentic-cms/motion", 1], ["agentic-cms/graphics", 1], ["agentic-cms/styling", 1]]);
});
