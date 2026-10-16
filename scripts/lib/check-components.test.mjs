import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { Linter } from "eslint";
import { catalogued, checkComponents, componentExports, CONFIG_FILE, formatReport, globRegex, GuardConfigError, readConfig } from "./check-components.mjs";
import { componentRules } from "./component-lint.mjs";

const KIT = path.resolve(import.meta.dirname, "../..");

/** A site tree in memory, `{ path: text }`, behind the three calls the guard makes. */
function memfs(files) {
  const dirs = new Set(Object.keys(files).flatMap((file) => file.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
  const rel = (p) => path.relative("/site", p).split(path.sep).join("/");
  const entries = (dir) => [...new Set([...Object.keys(files), ...dirs].filter((p) => path.posix.dirname(p) === dir).map((p) => p.slice(dir.length + 1)))];
  return {
    existsSync: (p) => rel(p) in files || dirs.has(rel(p)),
    readFileSync: (p) => { if (!(rel(p) in files)) throw Object.assign(new Error(`ENOENT: ${rel(p)}`), { code: "ENOENT" }); return files[rel(p)]; },
    readdirSync: (p, opts) => {
      const dir = rel(p);
      if (!dirs.has(dir)) throw Object.assign(new Error(`ENOTDIR: ${dir}`), { code: dir in files ? "ENOTDIR" : "ENOENT" });
      const names = entries(dir).sort();
      return opts?.withFileTypes ? names.map((name) => ({ name, isDirectory: () => dirs.has(`${dir}/${name}`) })) : names;
    },
  };
}

/** A site where every layer is present and every file is where the library keeps it. */
const CLEAN = {
  [CONFIG_FILE]: JSON.stringify({ routes: ["src/app", "src/app/[[...slug]]"] }),
  "src/components/README.md": "# Library\n\n## `Button`\n\nThe sizes are `BUTTON_SIZES`.\n\n## Motion (`motion/FadeIn.tsx`)\n\n```tsx\n<Stack gap>\n```\n\n`<Stack gap=\"md\" />` lays children out.\n",
  "src/components/motion/FadeIn.tsx": "export function FadeIn() { return null; }\n",
  "src/components/motion/FadeIn.module.css": "@keyframes fade { to { opacity: 1; } }\n",
  "src/components/ui/Button.tsx": "export type ButtonProps = { href: string };\nexport function Button() { return null; }\nexport const BUTTON_SIZES = [\"md\", \"lg\"];\n",
  "src/components/ui/Button.module.css": ".button { color: red; }\n",
  "src/components/ui/text.test.ts": "export const Fixture = 1;\n",
  "src/components/patterns/Stack.tsx": "export const Stack = () => null;\n",
  "src/components/sections/render.tsx": 'import { Hero } from "@/components/sections/Hero";\nimport { Faq } from "./Faq";\nimport type { Section } from "@/components/sections/schemas";\n',
  "src/components/sections/Hero.tsx": "export function Hero() { return null; }\n",
  "src/components/sections/Faq.tsx": "export function Faq() { return null; }\n",
  "src/components/sections/schemas.ts": "export const sectionSchema = {};\n",
  "src/app/layout.tsx": "export default function Layout() { return null; }\n",
  "src/app/globals.css": "@import \"tailwindcss\";\n",
  "src/app/robots.ts": "export default function robots() { return {}; }\n",
  "src/app/[[...slug]]/page.tsx": "export default function Page() { return null; }\n",
  "src/app/[[...slug]]/opengraph-image.png": "png",
  "src/styles/motion.css": "@keyframes rise { to { opacity: 1; } }\n",
  "src/config/site.ts": "export const site = {};\n",
  "src/kit.ts": "export const kit = {};\n",
};
const guard = (files, config) => checkComponents({ root: "/site", fs: memfs(files), ...(config ? { config } : {}) });
const planted = (extra, config) => guard({ ...CLEAN, ...extra }, config).findings;
/** The one finding a planted file causes. */
const only = (extra, config) => {
  const findings = planted(extra, config);
  assert.equal(findings.length, 1, JSON.stringify(findings, null, 1));
  return findings[0];
};

test("a site with every file where the library keeps it passes, an ALL_CAPS export and a type export among them", () => {
  const report = guard(CLEAN);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.layers, { motion: 2, ui: 3, patterns: 1, sections: 4, sectionFolders: 1 });
  assert.deepEqual(formatReport(report), ["check-components: ok (motion 2, ui 3, patterns 1, sections 4 in 1 folder; 0 inherited)"]);
});

test("components are PascalCase names with a lowercase letter: constants, types and lowercase helpers are not", () => {
  const source = [
    "export function Button() {}",
    "export default async function Gallery() {}",
    "export const Card = () => null;",
    "export const BUTTON_SIZES = [];",
    "export const MAX_W = 4;",
    "export const buttonClass = () => '';",
    "export type CardProps = {};",
    "export interface PanelProps {}",
    "export { Pill as Chip, Tag, type TagProps, IDS };",
    "export type { Hidden };",
    "// export function Commented() {}",
  ].join("\n");
  assert.deepEqual(componentExports(source), ["Button", "Gallery", "Card", "Chip", "Tag"]);
  assert.ok(catalogued("see `ui/Faq.tsx`", "Faq") && catalogued("`<Faq items />`", "Faq") && catalogued("## `Faq`", "Faq"));
  assert.ok(!catalogued("`FaqItem`", "Faq") && !catalogued("Faq, in prose", "Faq") && !catalogued("`OutlineButton`", "Button"));
});

test("layers: a layer the config names must be there, a null one is a layer the site does not have, and every file sits in one", () => {
  const noMotion = Object.fromEntries(Object.entries(CLEAN).filter(([file]) => !file.startsWith("src/components/motion/")));
  const gone = guard(noMotion).findings;
  assert.equal(gone.length, 1);
  assert.equal(gone[0].check, "layers");
  assert.equal(gone[0].file, "src/components/motion");
  assert.match(gone[0].fix, /set "motion": null in src\/config\/components\.json/);
  assert.deepEqual(guard(noMotion, { motion: null, routes: ["src/app", "src/app/[[...slug]]"] }).findings, [], "motion: null — the site has none");
  const stray = only({ "src/components/widgets/Promo.tsx": "export function Promo() { return null; }\n" });
  assert.equal(stray.check, "layers");
  assert.match(stray.problem, /src\/components\/widgets\/ is none of motion, ui, patterns, sections/);
  assert.match(stray.fix, /reuse or extend a primitive in src\/components\/ui\/.*a new section folder goes into "sections"/);
  const noRegistry = Object.fromEntries(Object.entries(CLEAN).filter(([file]) => file !== "src/components/sections/render.tsx"));
  assert.match(guard(noRegistry).findings.find((f) => f.file === "src/components/sections/render.tsx").problem, /the section registry is not there/);
});

test("catalogue: a component ui, patterns or the motion layer exports that the catalogue does not name is caught, by name", () => {
  const badge = only({ "src/components/ui/Badge.tsx": "export function Badge() { return null; }\nexport const BADGE_TONES = [];\n" });
  assert.equal(badge.check, "catalogue");
  assert.equal(badge.file, "src/components/ui/Badge.tsx");
  assert.match(badge.problem, /exports `Badge`, which the catalogue does not name/);
  assert.match(badge.fix, /add an entry for `Badge` to src\/components\/README\.md/);
  assert.match(only({ "src/components/patterns/Split.tsx": "export { SplitView as Split };\n" }).problem, /`Split`/);
  assert.equal(only({ "src/components/motion/Pop.tsx": "export const Pop = () => null;\n" }).check, "catalogue");
  assert.deepEqual(planted({ "src/components/ui/tokens.ts": "export const RADII = {};\nexport const TONES = [];\n" }), [], "ALL_CAPS constants are not components");
  assert.deepEqual(planted({ "src/components/sections/Promo.tsx": "export function Promo() {}\n" }).map((f) => f.check), ["registry"], "a section is the registry's, not the catalogue's");
});

test("registry: a component in a section folder the registry does not import is caught; the registry's own imports, by alias and relatively, pass", () => {
  const promo = only({ "src/components/sections/Promo.tsx": "export function Promo() { return null; }\n" });
  assert.equal(promo.check, "registry");
  assert.match(promo.problem, /a component in a section folder that the registry does not import/);
  assert.match(promo.fix, /register it in src\/components\/sections\/render\.tsx .* or move a piece sections share to src\/components\/patterns\//);
  assert.deepEqual(planted({ "src/components/sections/Hero.test.tsx": "test" }), [], "a test is no section");
  const pages = { routes: ["src/app", "src/app/[[...slug]]"], sections: ["home", "sections"] };
  const home = { "src/components/home/Hero.tsx": "export function Hero() {}\n", "src/components/sections/render.tsx": 'import { Hero } from "../home/Hero";\nimport { Faq } from "@/components/sections/Faq";\nimport { Hero as H } from "@/components/sections/Hero";\n' };
  assert.deepEqual(planted(home, pages), [], "a page folder is a section folder, imported relatively");
});

test("routes: src/app holds route files in the known route folders; a *-demo folder (a round's, the lab's) is free", () => {
  const helper = only({ "src/app/[[...slug]]/Promo.tsx": "export function Promo() {}\n" });
  assert.equal(helper.check, "routes");
  assert.match(helper.problem, /not a route file/);
  assert.match(helper.fix, /content\/pages\/<slug>\.yaml.* "routes" in src\/config\/components\.json, in its own pull request/);
  const pricing = only({ "src/app/pricing/page.tsx": "export default function Page() {}\n" });
  assert.match(pricing.problem, /in src\/app\/pricing\/, which is not a known route folder/);
  assert.deepEqual(planted({ "src/app/hero-demo/page.tsx": "x", "src/app/hero-demo/HeroA.tsx": "x", "src/app/lab-demo/page.tsx": "x", "src/app/not-found.tsx": "x", "src/app/sitemap.ts": "x", "src/app/icon.svg": "x" }), []);
});

test("components: a .tsx outside src/components and src/app is caught; an ignored folder is left out of every check", () => {
  const stray = only({ "src/widgets/Thing.tsx": "export function Thing() {}\n" });
  assert.equal(stray.check, "components");
  assert.match(stray.fix, /move it into the library — src\/components\/ui\//);
  assert.deepEqual(planted({ "src/lib/ix/Fx.tsx": "export function Fx() {}\n", "src/lib/lab/scenes.ts": "@keyframes x {}" }, { routes: ["src/app", "src/app/[[...slug]]"], ignores: ["src/lib/**"] }), []);
  assert.ok(globRegex("src/lib/**").test("src/lib/a/b.tsx") && globRegex("**/*.test.tsx").test("src/x/a.test.tsx") && !globRegex("src/*.tsx").test("src/a/b.tsx"));
});

test("styles: a CSS module outside ui and the motion layer is caught; @keyframes outside the motion layer and src/styles/motion.css too", () => {
  const cssModule = only({ "src/components/sections/Hero.module.css": ".hero { color: red; }\n" });
  assert.equal(cssModule.check, "styles");
  assert.match(cssModule.problem, /a CSS module outside src\/components\/ui and src\/components\/motion/);
  assert.match(cssModule.fix, /move the rule into the primitive it styles/);
  const keyframes = only({ "src/components/ui/Spin.module.css": "@keyframes spin { to { rotate: 1turn; } }\n" });
  assert.equal(keyframes.check, "keyframes");
  assert.match(keyframes.fix, /a new effect is a new motion primitive/);
  assert.equal(only({ "src/app/globals.css": "@keyframes pulse {}\n" }).check, "keyframes");
  assert.equal(only({ "src/components/sections/Hero.tsx": "export function Hero() { return <style>{'@keyframes x {}'}</style>; }\n" }).check, "keyframes");
});

test("inherited: a frozen file passes every check, and a listed file that is gone is caught", () => {
  const config = { routes: ["src/app", "src/app/[[...slug]]"], inherited: ["src/components/widgets/Old.tsx", "src/components/widgets/Old.module.css", "src/legacy/Banner.tsx"] };
  const frozen = { "src/components/widgets/Old.tsx": "export function Old() {}\n", "src/components/widgets/Old.module.css": "@keyframes old {}\n", "src/legacy/Banner.tsx": "x" };
  assert.deepEqual(planted(frozen, config), []);
  const gone = only({ "src/components/widgets/Old.tsx": "x", "src/components/widgets/Old.module.css": "x" }, config);
  assert.equal(gone.check, "inherited");
  assert.equal(gone.file, "src/legacy/Banner.tsx");
  assert.match(gone.fix, /take it out of "inherited" in src\/config\/components\.json: the list only shrinks/);
});

test("a running round's candidates pass, with their module.css, while its demo.json names them", () => {
  const round = {
    "src/app/hero-demo/page.tsx": "x",
    "src/app/hero-demo/demo.json": JSON.stringify({ demo: "hero", component: "src/components/sections/Hero.tsx", created: ["src/components/sections/HeroA.tsx", "src/components/ui/ButtonA.tsx"] }),
    "src/components/sections/HeroA.tsx": "export function HeroA() {}\n",
    "src/components/sections/HeroA.module.css": "@keyframes a {}\n",
    "src/components/ui/ButtonA.tsx": "export function ButtonA() {}\n",
  };
  const report = guard({ ...CLEAN, ...round });
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.candidates.sort(), ["src/components/sections/HeroA.module.css", "src/components/sections/HeroA.tsx", "src/components/ui/ButtonA.tsx"]);
  assert.match(formatReport(report)[0], /; 3 round candidates\)$/);
  const { "src/app/hero-demo/demo.json": _manifest, ...ended } = round;
  void _manifest;
  assert.deepEqual(planted(ended).map((f) => `${f.check} ${f.file}`).sort(), ["catalogue src/components/ui/ButtonA.tsx", "keyframes src/components/sections/HeroA.module.css", "registry src/components/sections/HeroA.tsx", "styles src/components/sections/HeroA.module.css"]);
});

test("the config: absent, unreadable, an unknown key named with the nearest one, a list that is not one — each a GuardConfigError", () => {
  const read = (text) => readConfig("/site", memfs(text === undefined ? {} : { [CONFIG_FILE]: text }));
  assert.throws(() => read(), (e) => e instanceof GuardConfigError && /no src\/config\/components\.json here/.test(e.message));
  assert.throws(() => read("{ nope"), GuardConfigError);
  assert.throws(() => read("[]"), /an object of options/);
  assert.throws(() => read('{ "inherted": [] }'), /no option inherted — did you mean inherited\?/);
  assert.throws(() => read('{ "sections": "home" }'), /sections is a list of paths/);
  assert.deepEqual(read('{ "$comment": "ok", "elements": {}, "motion": null }'), { $comment: "ok", elements: {}, motion: null }, "$ keys are comments; componentRules()'s own keys are accepted");
});

test("the report names each finding's file, check, problem and fix, then where the library is", () => {
  const lines = formatReport(guard({ ...CLEAN, "src/components/sections/Promo.tsx": "x", "src/widgets/Thing.tsx": "x" }));
  assert.equal(lines[0], "check-components: 2 problems");
  assert.ok(lines.includes("  ✗ src/components/sections/Promo.tsx  [registry]"));
  assert.ok(lines.some((line) => line.startsWith("    → move it into the library")));
  assert.match(lines.at(-1), /^The library is src\/components\/README\.md/);
});

// The two tools split the work: ESLint judges what a file contains, the guard where it is and what declares it.
const require = createRequire(import.meta.url);
const react = createRequire(require.resolve("eslint-config-next"))("eslint-plugin-react");
const ESLINT_BASE = { files: ["**/*.{js,jsx,mjs,ts,tsx}"], plugins: { react }, languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }, settings: { react: { version: "19" } } };
const eslint = (file, code) => new Linter({ cwd: "/site" }).verify(code, [ESLINT_BASE, ...componentRules()], { filename: `/site/${file}` }).map((m) => m.ruleId);

test("each planted violation is caught by the tool meant for it: a raw element by ESLint, a stray file by the guard", () => {
  const rawButton = 'export function Hero() { return <button type="button">Go</button>; }\n';
  assert.deepEqual(eslint("src/components/sections/Hero.tsx", rawButton), ["react/forbid-elements"]);
  assert.deepEqual(planted({ "src/components/sections/Hero.tsx": rawButton }), [], "the guard does not judge markup");
  const promo = 'import { Button } from "@/components/ui/Button";\nexport function Promo() { return <Button href="/">Go</Button>; }\n';
  assert.deepEqual(eslint("src/components/sections/Promo.tsx", promo), [], "ESLint finds nothing wrong inside it");
  assert.deepEqual(planted({ "src/components/sections/Promo.tsx": promo }).map((f) => f.check), ["registry"]);
});

test("the kit's example passes the guard with its own config", () => {
  const report = checkComponents({ root: KIT, fs });
  assert.deepEqual(report.findings, [], formatReport(report).join("\n"));
  assert.equal(report.layers.motion, null);
  assert.equal(report.layers.sectionFolders, 6);
  assert.ok(report.inherited <= 5, "the example's inherited list stays minimal: the blog's post template");
});
