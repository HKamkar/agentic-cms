import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { Linter } from "eslint";
import { componentRules, defaultElements } from "./component-lint.mjs";

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
