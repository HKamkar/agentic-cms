import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { Linter } from "eslint";
import { catalogued, checkComponents, checkPreset, componentExports, CONFIG_FILE, EXCEPTIONS, formatReport, globRegex, GuardConfigError, presetSamples, readConfig, resolveGuard, ROUTES } from "./check-components.mjs";
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

test("routes: src/app holds route files in the content engine's folders and the named exceptions'; a *-demo folder (a round's, the lab's) is free", () => {
  const helper = only({ "src/app/[[...slug]]/Promo.tsx": "export function Promo() {}\n" });
  assert.equal(helper.check, "routes");
  assert.match(helper.problem, /not a route file/);
  assert.match(helper.fix, /^a page is a file, content\/pages\/<slug>\.yaml, .* a component belongs in the library$/);
  const pricing = only({ "src/app/pricing/page.tsx": "export default function Page() {}\n" });
  assert.match(pricing.problem, /in src\/app\/pricing\/, which is neither the content engine's route nor a named exception/);
  assert.match(pricing.fix, /content\/pages\/<slug>\.yaml.*; a route outside the content engine is a named exception, "exceptions": \{ "src\/app\/pricing": "<why it is not a content\/pages file>" \} in src\/config\/components\.json, in its own pull request$/);
  assert.deepEqual(planted({ "src/app/hero-demo/page.tsx": "x", "src/app/hero-demo/HeroA.tsx": "x", "src/app/lab-demo/page.tsx": "x", "src/app/not-found.tsx": "x", "src/app/sitemap.ts": "x", "src/app/icon.svg": "x" }), []);
});

test("exceptions: a route outside the content engine passes with its reason; a bare one, in routes or with an empty reason, is a finding naming the fix", () => {
  const feed = { "src/app/feed.xml/route.ts": "export function GET() {}\n" };
  const named = { routes: ROUTES, exceptions: { "src/app/feed.xml": "the RSS feed, written from the posts" } };
  assert.deepEqual(planted(feed, named), [], "named, with its reason");
  const bare = only(feed, { routes: [...ROUTES, "src/app/feed.xml"], exceptions: {} });
  assert.equal(bare.check, "routes");
  assert.equal(bare.file, "src/app/feed.xml");
  assert.match(bare.problem, /in "routes" with no reason: "routes" holds the content engine's folders \(the app folder, its catch-all\), and this is neither/);
  assert.match(bare.fix, /^a route outside the content engine is a named exception, "exceptions": \{ "src\/app\/feed\.xml": "<why it is not a content\/pages file>" \} in src\/config\/components\.json, out of "routes"$/);
  for (const reason of ["", "  ", null, true]) {
    const blank = only(feed, { routes: ROUTES, exceptions: { "src/app/feed.xml": reason } });
    assert.equal(blank.problem, "a named exception with no reason", JSON.stringify(reason));
    assert.match(blank.fix, /"exceptions": \{ "src\/app\/feed\.xml": "<why/);
  }
  assert.deepEqual(planted({ "src/app/[locale]/[[...slug]]/page.tsx": "x", "src/app/docs/[...path]/page.tsx": "x" }, { routes: [...ROUTES, "src/app/[locale]/[[...slug]]", "src/app/docs/[...path]"] }), [], "a catch-all is the engine's, bare");
  assert.throws(() => readConfig("/site", memfs({ [CONFIG_FILE]: '{ "exceptions": ["src/app/feed.xml"] }' })), (e) => e instanceof GuardConfigError && /exceptions is \{ "<route folder>": "<reason>" \}/.test(e.message), "a list of bare folders does not read");
});

test("an older config, its five routes bare, still loads: the kit's own reasons cover its three, a folder of the site's own is a finding", () => {
  const old = { routes: ["src/app", "src/app/[[...slug]]", "src/app/blog-post/[slug]", "src/app/api/forms/[id]", "src/app/feed.xml"] };
  assert.deepEqual(Object.keys(EXCEPTIONS).sort(), old.routes.slice(2).sort());
  assert.ok(Object.values(EXCEPTIONS).every((reason) => reason.length > 10), "the defaults carry their reasons");
  const files = { "src/app/blog-post/[slug]/page.tsx": "x", "src/app/api/forms/[id]/route.ts": "x", "src/app/feed.xml/route.ts": "x" };
  assert.deepEqual(planted(files, old), []);
  const own = only({ ...files, "src/app/pricing/page.tsx": "x" }, { routes: [...old.routes, "src/app/pricing"] });
  assert.equal(own.file, "src/app/pricing");
  assert.match(own.problem, /in "routes" with no reason/);
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
  for (const owners of ['{ "forms": ["src/components/ui/form/Form.tsx"] }', '{ "form": {} }', "[]"]) {
    assert.throws(() => read(`{ "owners": ${owners} }`), /owners is \{ "forms": \{ "<file>": "<reason>" \}, "tags": \{ "<file>": "<reason>" \}, "images": \{ "<file>": "<reason>" \}, "icons": \{ "<file>": "<reason>" \}, "motion": \{ "<file>": "<reason>" \} \} — the files that own a part, each with the reason it does/, owners);
  }
  for (const allow of ['{ "rule": "agentic-cms/icons" }', '["agentic-cms/icons"]']) {
    assert.throws(() => read(`{ "allow": ${allow} }`), /allow is a list of \{ "rule": "agentic-cms\/<rule>", "files": \["<glob>", …\], "reason": "<why the site keeps its own>" \} — the preferred rules a file keeps its own choice of/, allow);
  }
});

test("owners: each file that owns a part has its reason and is there", () => {
  const form = { "src/components/ui/form/Form.tsx": "export function Form() { return null; }\n" };
  const owned = (reason, files = form) => planted({ ...files, "src/components/README.md": `${CLEAN["src/components/README.md"]}\n\`Form\`\n` }, { routes: ROUTES, owners: { forms: { "src/components/ui/form/Form.tsx": reason } } });
  assert.deepEqual(owned("the form engine's renderer"), []);
  const blank = owned(" ");
  assert.deepEqual(blank.map((f) => [f.check, f.file, f.problem]), [["owners", "src/components/ui/form/Form.tsx", "an owner of forms with no reason"]]);
  assert.match(blank[0].fix, /"owners": \{ "forms": \{ "src\/components\/ui\/form\/Form\.tsx": "<why this file owns it>" \} \} in src\/config\/components\.json/);
  assert.deepEqual(owned("the renderer", {}).map((f) => f.problem), ["an owner of forms that names no file here"]);
});

test("disables: an inline disable of a required rule, or of every rule, says why after --; the report lists each reason; another rule's with no reason is a warning", () => {
  const files = {
    "src/components/sections/Hero.tsx": "// eslint-disable-next-line agentic-cms/copy -- the legal name, as registered\nexport function Hero() { return null; }\n",
    "src/components/sections/Faq.tsx": "export function Faq() {\n  return null; // eslint-disable-line no-console\n}\n/* eslint-disable agentic-cms/head, no-console */\n",
    "src/app/layout.tsx": "export default function Layout() {\n  // eslint-disable-next-line\n  return null;\n}\n",
    "src/components/ui/Button.tsx": `${CLEAN["src/components/ui/Button.tsx"]}{/* eslint-disable-next-line agentic-cms/email, agentic-cms/copy -- the address is the registrar's, printed by law */}\n`,
  };
  const report = guard({ ...CLEAN, ...files });
  assert.deepEqual(report.findings.map((f) => [f.check, f.file, f.problem]), [
    ["disables", "src/app/layout.tsx:2", "turns off every rule with no reason"],
    ["disables", "src/components/sections/Faq.tsx:4", "turns off agentic-cms/head with no reason"],
  ]);
  assert.match(report.findings[1].fix, /says why after --: \/\/ eslint-disable-next-line agentic-cms\/head -- <the reason>/);
  assert.deepEqual(report.disables, [
    { file: "src/components/sections/Hero.tsx", line: 1, rules: ["agentic-cms/copy"], reason: "the legal name, as registered" },
    { file: "src/components/ui/Button.tsx", line: 4, rules: ["agentic-cms/email", "agentic-cms/copy"], reason: "the address is the registrar's, printed by law" },
  ]);
  assert.deepEqual(report.warnings.map((f) => [f.check, f.file, f.problem]), [["disables", "src/components/sections/Faq.tsx:2", "turns off no-console with no reason"]]);
  assert.equal(report.warnings[0].fix, "say why after --: // eslint-disable-next-line no-console -- <the reason>");
  const lines = formatReport(report);
  assert.ok(lines.includes("The inline disables of a required rule, each with its reason:") && lines.includes("  disabled agentic-cms/copy at src/components/sections/Hero.tsx:1 — the legal name, as registered"), lines.join("\n"));
  const clean = guard({ ...CLEAN, "src/components/sections/Hero.tsx": files["src/components/sections/Hero.tsx"] });
  assert.deepEqual(formatReport(clean), ["check-components: ok (motion 2, ui 3, patterns 1, sections 4 in 1 folder; 0 inherited; 1 inline disable of a required rule, each with its reason)", "  disabled agentic-cms/copy at src/components/sections/Hero.tsx:1 — the legal name, as registered"]);
});

const LINT_URL = pathToFileURL(path.join(KIT, "scripts/lib/component-lint.mjs")).href;
/** The react plugin eslint-config-next registers, which two of the preset's composition rules come from. */
const REACT_URL = pathToFileURL(createRequire(createRequire(import.meta.url).resolve("eslint-config-next")).resolve("eslint-plugin-react")).href;
const PRESET_CONFIG = { motion: null, patterns: null, owners: { forms: { "src/components/ui/form/Form.tsx": "the form engine's renderer" } } };
const PRESET_OPTIONS = '{ motion: null, patterns: null, owners: { forms: ["src/components/ui/form/Form.tsx"] } }';

/** checkPreset over a scratch site whose eslint.config.mjs spreads the preset with `options`, then `after` (more config objects), or holds `text` alone: its { findings, warnings }. */
async function presetReport({ options = PRESET_OPTIONS, after = "", text, config = PRESET_CONFIG } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guard-preset-"));
  try {
    fs.writeFileSync(path.join(dir, "package.json"), '{ "type": "module" }\n');
    if (text !== null) fs.writeFileSync(path.join(dir, "eslint.config.mjs"), text ?? `import react from ${JSON.stringify(REACT_URL)};\nimport { componentRules } from ${JSON.stringify(LINT_URL)};\nexport default [{ plugins: { react } }, ...componentRules(${options}), ${after}];\n`);
    return await checkPreset({ root: dir, config });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
/** The preset check's findings, the required rules'. */
const preset = async (opts) => (await presetReport(opts)).findings;

test("preset: one sample file per layer, a route, a round's route, src/lib, and each owner's file", () => {
  assert.deepEqual(presetSamples(resolveGuard({ ...PRESET_CONFIG, sections: ["home", "sections"] })).map(([what, file]) => `${what}: ${file}`), [
    "the ui layer: src/components/ui/Sample.tsx",
    "the section folder src/components/home: src/components/home/Sample.tsx",
    "the section folder src/components/sections: src/components/sections/Sample.tsx",
    "the routes: src/app/page.tsx",
    "a design round's route: src/app/sample-demo/page.tsx",
    "src/lib: src/lib/sample.tsx",
    "an owner of forms: src/components/ui/form/Form.tsx",
  ]);
});

test("preset: the required rules' settings ESLint resolves are the ones componentRules() makes of the config; a later block, other options, an ignore or no preset is a finding", async () => {
  assert.deepEqual(await preset(), []);
  const replaced = await preset({ after: '{ files: ["src/components/**"], rules: { "agentic-cms/copy": "off" } }' });
  assert.deepEqual(replaced.map((f) => [f.check, f.file]), [["preset", "src/components/ui/Sample.tsx"], ["preset", "src/components/sections/Sample.tsx"], ["preset", "src/components/ui/form/Form.tsx"]]);
  assert.equal(replaced[0].problem, "agentic-cms/copy is off here (the ui layer), where componentRules() makes of src/config/components.json that it is an error");
  assert.match(replaced[0].fix, /^eslint\.config\.mjs spreads \.\.\.componentRules\(\) with the options of src\/config\/components\.json \(its layers, copy, owners and ignores\), and no block after it sets the rule again/);
  const warned = await preset({ after: '{ files: ["src/app/**"], rules: { "agentic-cms/head": "warn" } }' });
  assert.deepEqual(warned.map((f) => f.problem), ["agentic-cms/head is a warning here (the routes), where componentRules() makes of src/config/components.json that it is an error", "agentic-cms/head is a warning here (a design round's route), where componentRules() makes of src/config/components.json that it is an error"]);
  const unowned = await preset({ options: "{ motion: null, patterns: null }" });
  assert.deepEqual(unowned.map((f) => f.problem), ["agentic-cms/forms is an error here (an owner of forms), where componentRules() makes of src/config/components.json that it is off"], "eslint.config.mjs and the config name the same owners");
  const decorated = await preset({ options: '{ motion: null, patterns: null, owners: { forms: ["src/components/ui/form/Form.tsx"] }, copy: { decorations: ["Badge"] } }' });
  assert.ok(decorated.length > 0 && decorated.every((f) => /^agentic-cms\/copy has other options here \(/.test(f.problem)), decorated.map((f) => f.problem).join("\n"));
  const ignored = await preset({ after: '{ ignores: ["src/components/ui/**"] }' });
  assert.ok(ignored.some((f) => f.problem === "agentic-cms/copy is not linted (no block of the config covers the file, or one ignores it) here (the ui layer), where componentRules() makes of src/config/components.json that it is an error"), ignored.map((f) => f.problem).join("\n"));
  const none = await preset({ text: 'export default [{ files: ["**/*.tsx"] }];\n' });
  assert.equal(none[0].problem, "agentic-cms/copy is not set here (the ui layer), where componentRules() makes of src/config/components.json that it is an error");
  const missing = await preset({ text: null });
  assert.deepEqual(missing.map((f) => [f.check, f.file]), [["preset", "eslint.config.mjs"]]);
  assert.match(missing[0].problem, /^ESLint cannot read the site's config, so the required rules are not set: /);
});

test("preset: a baselined file's counts reach ESLint, the engines' in its settings and the composition's in the processor that holds them; a list not passed, or a later processor, is a finding", async () => {
  const baseline = [{ file: "src/components/home/Hero.tsx", rule: "agentic-cms/copy", count: 1, reason: "" }, { file: "src/components/home/Hero.tsx", rule: "react/forbid-elements", count: 2, reason: "" }];
  const config = { ...PRESET_CONFIG, sections: ["home"], baseline };
  const options = `{ motion: null, patterns: null, sections: ["home"], owners: { forms: ["src/components/ui/form/Form.tsx"] }, baseline: ${JSON.stringify(baseline)} }`;
  assert.deepEqual(await preset({ config, options }), []);
  const untold = await preset({ config, options: options.replace(/, baseline: .*\] \}$/, " }") });
  assert.deepEqual(untold.map((f) => f.problem), ["the baseline holds 1 of agentic-cms/copy here, and ESLint is told none: the rule fails every one", "the baseline holds 2 of react/forbid-elements here, and ESLint is told none: the rule fails every one"]);
  const replaced = await preset({ config, options, after: '{ files: ["src/components/home/Hero.tsx"], processor: { preprocess: (text) => [text], postprocess: (lists) => lists.flat() } }' });
  assert.deepEqual(replaced.map((f) => f.problem), ["the baseline holds 2 of react/forbid-elements here, and no processor holds it: a block after componentRules() sets another processor on the file, so the rule fails every one"]);
});

test("preset: a preferred rule turned off by a later block, or an allow eslint.config.mjs does not pass, is a warning that fails nothing; the same allow in both is quiet", async () => {
  assert.deepEqual(await presetReport(), { findings: [], warnings: [] });
  const silenced = await presetReport({ after: '{ files: ["src/components/ui/**"], rules: { "agentic-cms/icons": "off" } }' });
  assert.deepEqual(silenced.findings, []);
  assert.deepEqual(silenced.warnings.map((f) => [f.check, f.file, f.problem]), [["preset", "src/components/ui/Sample.tsx", "agentic-cms/icons is off here (the ui layer), where componentRules() makes of src/config/components.json that it is a warning"], ["preset", "src/components/ui/form/Form.tsx", "agentic-cms/icons is off here (an owner of forms), where componentRules() makes of src/config/components.json that it is a warning"]]);
  assert.match(silenced.warnings[0].fix, /^a preferred rule a site keeps its own choice of is an "allow" entry in src\/config\/components\.json, with its reason, which eslint\.config\.mjs passes to componentRules\(\)/);
  const allow = [{ rule: "agentic-cms/styling", files: ["src/app/**"], reason: "the routes' own grids" }];
  const config = { ...PRESET_CONFIG, allow };
  assert.equal((await presetReport({ config })).warnings.length, 2, "the config's allow, which eslint.config.mjs does not pass: the routes and a round's route");
  assert.deepEqual(await presetReport({ config, options: `{ motion: null, patterns: null, owners: { forms: ["src/components/ui/form/Form.tsx"] }, allow: ${JSON.stringify(allow)} }` }), { findings: [], warnings: [] });
});

test("allow: each entry names a preferred rule and files that are there, with its reason; a bad one is a finding, the good ones are counted", () => {
  const placeholder = { "src/components/ui/Placeholder.tsx": "export function Placeholder() { return null; }\n", "src/components/README.md": `${CLEAN["src/components/README.md"]}\n\`Placeholder\`\n` };
  const entry = (fields) => ({ rule: "agentic-cms/icons", files: ["src/components/ui/Placeholder.tsx"], reason: "the wireframe's crossed box", ...fields });
  const allowed = (...entries) => guard({ ...CLEAN, ...placeholder }, { routes: ROUTES, allow: entries });
  const good = allowed(entry());
  assert.deepEqual(good.findings, []);
  assert.deepEqual(good.allowed, [entry()]);
  assert.match(formatReport(good)[0], /; 1 allowed, each with its reason\)$/);
  const bad = allowed(entry({ rule: "agentic-cms/copy" }), entry({ rule: "agentic-cms/icon" }), entry({ reason: " " }), entry({ files: [] }), entry({ files: ["src/components/ui/Gone.tsx"] }));
  assert.deepEqual(bad.findings.map((f) => [f.check, f.file, f.problem]), [
    ["allow", "agentic-cms/copy", "a required rule is never allowed"],
    ["allow", "agentic-cms/icon", 'no preferred rule "agentic-cms/icon" — did you mean agentic-cms/icons?'],
    ["allow", "agentic-cms/icons", "an allow entry with no reason"],
    ["allow", "agentic-cms/icons", "an allow entry that names no files"],
    ["allow", "src/components/ui/Gone.tsx", "an allow entry of agentic-cms/icons that names no file here"],
  ]);
  assert.match(bad.findings[0].fix, /a file that owns its part is named in "owners", a line that needs its own says why in an inline disable \(\/\/ eslint-disable-next-line agentic-cms\/copy -- <the reason>\)/);
  assert.deepEqual(bad.allowed, [entry({ files: ["src/components/ui/Gone.tsx"] })], "the entries componentRules() takes");
  const tools = allowed(entry({ rule: "agentic-cms/site-tools", files: ["scripts/shots.mjs"] }), entry({ rule: "agentic-cms/site-tools", files: ["scripts/og.mjs"], reason: "" }));
  assert.deepEqual(tools.findings.map((f) => [f.check, f.file, f.problem]), [["allow", "agentic-cms/site-tools", "an allow entry with no reason"]], "the site's own tools are outside src/: check-site looks for their files, and the reason is needed here as anywhere");
});

test("transitions: a transition or animation declared in CSS outside the motion layer and src/styles/motion.css warns, naming the line; none rests, and an allow of agentic-cms/motion quiets it", () => {
  const drawer = { "src/components/ui/Button.module.css": "/* transition: opacity — a note */\n.button {\n  color: red;\n  transition: transform 200ms;\n  animation-name: none;\n  animation: pop 1s;\n}\n" };
  const report = guard({ ...CLEAN, ...drawer });
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.warnings.map((f) => [f.check, f.file, f.problem]), [["transitions", "src/components/ui/Button.module.css:4", "declares transition, animation outside the motion layer"]]);
  assert.match(report.warnings[0].fix, /^motion is the motion layer, src\/components\/motion\/ \(STANDARD\.md §7\); a site that keeps its own says why: "allow": \[\{ "rule": "agentic-cms\/motion", "files": \["src\/components\/ui\/Button\.module\.css"\], "reason": "<why>" \}\]/);
  const lines = formatReport(report);
  assert.equal(lines[2], "check-components: 1 warning, which fail nothing: the kit's part, or the site's own choice with its reason");
  assert.ok(lines.includes("  ⚠ src/components/ui/Button.module.css:4  [transitions]"), lines.join("\n"));
  const still = { "src/app/globals.css": ":root { --transition-x: 1s; }\n.a { transition: none; animation-duration: 0.01ms !important; }\n.transition:hover { color: red; }\n" };
  assert.deepEqual(guard({ ...CLEAN, ...still }).warnings, [], "a custom property, none, a zero duration, a selector");
  assert.deepEqual(guard({ ...CLEAN, "src/components/motion/Pop.module.css": ".pop { transition: scale 1s; }\n", "src/styles/motion.css": ".rise { transition: opacity 1s; }\n" }).warnings.map((f) => f.file), [], "the motion layer and motion.css");
  assert.deepEqual(guard({ ...CLEAN, ...drawer }, { routes: ROUTES, allow: [{ rule: "agentic-cms/motion", files: ["src/components/ui/*.module.css"], reason: "the drawer slides, as the brand book draws it" }] }).warnings, []);
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
  const rawButton = 'export function Hero({ label }) { return <button type="button">{label}</button>; }\n';
  assert.deepEqual(eslint("src/components/sections/Hero.tsx", rawButton), ["react/forbid-elements"]);
  assert.deepEqual(planted({ "src/components/sections/Hero.tsx": rawButton }), [], "the guard does not judge markup");
  const promo = 'import { Button } from "@/components/ui/Button";\nexport function Promo({ cta }) { return <Button href="/">{cta}</Button>; }\n';
  assert.deepEqual(eslint("src/components/sections/Promo.tsx", promo), [], "ESLint finds nothing wrong inside it");
  assert.deepEqual(planted({ "src/components/sections/Promo.tsx": promo }).map((f) => f.check), ["registry"]);
  const copy = 'export function Hero() { return <Heading>Get started</Heading>; }\n';
  assert.deepEqual(eslint("src/components/sections/Hero.tsx", copy), ["agentic-cms/copy"], "copy in a section, by ESLint");
  assert.deepEqual(planted({ "src/app/pricing/page.tsx": "x" }, { routes: ROUTES }).map((f) => f.check), ["routes"], "a hand-written page route, by the guard");
});

test("the kit's example passes the guard with its own config, with no warning", () => {
  const report = checkComponents({ root: KIT, fs });
  assert.deepEqual(report.findings, [], formatReport(report).join("\n"));
  assert.deepEqual(report.warnings, [], formatReport(report).join("\n"));
  assert.ok(report.allowed.every((entry) => entry.reason.length > 20), "each of the example's own choices says why");
  assert.equal(report.layers.motion, null);
  assert.equal(report.layers.sectionFolders, 6);
  assert.ok(report.inherited <= 5, "the example's inherited list stays minimal: the blog's post template");
});
