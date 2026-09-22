// demo new and demo clean through the bin, in a throwaway site: a registry,
// a page file and a component the way a site lays them out.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const BIN = path.resolve(import.meta.dirname, "../bin/agentic-cms.mjs");
const run = (root, args) => spawnSync(process.execPath, [BIN, "demo", ...args], { cwd: root, encoding: "utf8" });
const put = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };

function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "demo-"));
  put(root, "src/components/sections/render.tsx", `import { Hero as HomeHero } from "@/components/home/Hero";
import { Testimonials } from "@/components/home/Testimonials";
import { kit } from "@/kit";
const registry = {
  "home-hero": plain(HomeHero),
  reviews: withData(Testimonials, () => ({ reviews: kit.content.getReviews() })),
};
`);
  put(root, "src/components/home/Hero.tsx", `import { Section } from "@/components/ui/Section";\n\n/** The hero. */\nexport function Hero({ heading }: { heading: string }) {\n  return <Section type="home-hero"><h1>{heading}</h1></Section>;\n}\n`);
  put(root, "src/components/home/Testimonials.tsx", `export const Testimonials = () => null;\n`);
  put(root, "src/components/ui/Section.tsx", `export const Section = () => null;\n`);
  put(root, "content/pages/about.yaml", "seo: {}\nsections:\n  - type: about-hero\n");
  put(root, "content/pages/home.yaml", "seo: {}\nsections:\n  - type: home-hero\n    heading: Hi\n  - type: group\n    sections:\n      - type: reviews\n");
  return root;
}

test("demo new: the route and a candidate per letter from the registry's component and the first page carrying the section; refused twice; the errors name the fix", () => {
  const root = site();
  try {
    const r = run(root, ["new", "hero-card", "--section", "home-hero", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    assert.deepEqual(report, { route: "src/app/hero-card-demo/page.tsx", path: "/hero-card-demo", section: "home-hero", page: "home", component: "src/components/home/Hero.tsx", candidates: [{ letter: "A", file: "src/components/home/HeroA.tsx" }, { letter: "B", file: "src/components/home/HeroB.tsx" }], data: false });
    const route = fs.readFileSync(path.join(root, report.route), "utf8");
    assert.match(route, /export const metadata = \{ robots: \{ index: false \} \};/);
    assert.match(route, /import \{ Hero \} from "@\/components\/home\/Hero";\nimport \{ HeroA \} from "@\/components\/home\/HeroA";\nimport \{ HeroB \} from "@\/components\/home\/HeroB";/);
    assert.match(route, /kit\.content\.getPage\("home"\)/);
    assert.match(route, /section\.type === "home-hero"/);
    assert.match(route, /\{ letter: "A", note: "what differs, in one line", Candidate: HeroA \},\n {2}\{ letter: "B"/);
    assert.match(route, /data-candidate="now"[\s\S]*<Hero \{\.\.\.props\} \/>/, "the current version, last");
    assert.ok(route.indexOf('data-candidate={letter}') < route.indexOf('data-candidate="now"'));
    assert.doesNotMatch(route, /force-dynamic|<main/);
    assert.match(route, /export default function HeroCardDemo\(\)/);
    const a = fs.readFileSync(path.join(root, "src/components/home/HeroA.tsx"), "utf8");
    assert.match(a, /^\/\/ Candidate A of hero-card-demo \(agentic-cms demo new\)/);
    assert.match(a, /export function HeroA\(\{ heading \}/);
    assert.match(a, /\/\*\* The hero\. \*\//, "the rest of the source as it was");
    assert.match(fs.readFileSync(path.join(root, "src/components/home/HeroB.tsx"), "utf8"), /export function HeroB\(/);
    assert.match(run(root, ["new", "hero-card", "--section", "home-hero"]).stderr, /src\/app\/hero-card-demo\/page\.tsx exists; edit it, or remove it with demo clean hero-card/);
    assert.match(run(root, ["new", "Bad", "--section", "home-hero"]).stderr, /Bad: a demo's name is lowercase/);
    assert.match(run(root, ["new", "x", "--section", "nope"]).stderr, /nope: no such section in src\/components\/sections\/render\.tsx \(home-hero, reviews\); pass --component/);
    assert.match(run(root, ["new", "x", "--section", "home-hero", "--page", "about"]).stderr, /content\/pages\/about\.yaml carries no "home-hero" section/);
    assert.match(run(root, ["new", "x", "--section", "home-hero", "--candidates", "9"]).stderr, /--candidates is 1 to 8, not 9/);
    assert.match(run(root, ["new", "x"]).stderr, /name what the candidates are for/);
    const data = run(root, ["new", "quotes", "--section", "reviews", "--candidates", "1", "--json"]);
    assert.equal(data.status, 0, data.stderr);
    assert.equal(JSON.parse(data.stdout).page, "home", "a section inside a group is found");
    assert.match(data.stderr, /note: "reviews" is a withData section/);
    assert.match(fs.readFileSync(path.join(root, "src/app/quotes-demo/page.tsx"), "utf8"), /withData entry of the registry/);
    assert.match(fs.readFileSync(path.join(root, "src/components/home/TestimonialsA.tsx"), "utf8"), /export const TestimonialsA = /);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo new --component alone: a props-free route for a piece of the chrome, no page file read", () => {
  const root = site();
  try {
    put(root, "src/components/ui/Footer.tsx", `import { site } from "@/config/site";\n\n/** The site's footer. */\nexport function Footer() {\n  return <footer>{site.name}</footer>;\n}\n`);
    const r = run(root, ["new", "footer", "--component", "src/components/ui/Footer.tsx", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    assert.deepEqual(report, { route: "src/app/footer-demo/page.tsx", path: "/footer-demo", section: null, page: null, component: "src/components/ui/Footer.tsx", candidates: [{ letter: "A", file: "src/components/ui/FooterA.tsx" }, { letter: "B", file: "src/components/ui/FooterB.tsx" }], data: false });
    const route = fs.readFileSync(path.join(root, report.route), "utf8");
    assert.match(route, /candidates for Footer, a piece of the site's chrome — its copy comes\n\/\/ from the site's config \(src\/config\/site\.ts\), not a page file/);
    assert.match(route, /import type { ComponentType } from "react";\nimport { Footer } from "@\/components\/ui\/Footer";\nimport { FooterA }/);
    assert.ok(route.includes("const CANDIDATES: { letter: string; note: string; Candidate: ComponentType }[] = ["), "the candidates are typed as bare components");
    assert.ok(route.includes("<Candidate />"), "every candidate rendered with no props");
    assert.match(route, /data-candidate="now"[\s\S]*<Footer \/>/, "the current version, last, with no props");
    assert.doesNotMatch(route, /kit\.content|SectionProps|copyOf|content\/pages/, "no page-file plumbing");
    assert.match(route, /export const metadata = { robots: { index: false } };/);
    assert.match(fs.readFileSync(path.join(root, "src/components/ui/FooterA.tsx"), "utf8"), /^\/\/ Candidate A of footer-demo[\s\S]*export function FooterA\(\)/);

    const cleaned = JSON.parse(run(root, ["clean", "footer", "--json"]).stdout);
    assert.deepEqual(cleaned.removed, ["src/app/footer-demo", "src/components/ui/FooterA.tsx", "src/components/ui/FooterB.tsx"], "exactly the route and the candidates");
    assert.deepEqual(cleaned.kept, ["src/components/ui/Footer.tsx (the component the candidates started from)"]);
    assert.ok(fs.existsSync(path.join(root, "src/components/ui/Footer.tsx")), "the site's own component stays, whatever imports it");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo new: one of --section and --component is needed; --page belongs to a section; --component with --section keeps the section route", () => {
  const root = site();
  try {
    put(root, "src/components/ui/Footer.tsx", "export function Footer() {\n  return <footer />;\n}\n");
    assert.match(run(root, ["new", "x"]).stderr, /name what the candidates are for: --section <type> for a section \(the route reads the page's copy\), or --component <file> for a piece of the chrome \(no page copy\)/);
    assert.match(run(root, ["new", "x", "--page", "home"]).stderr, /name what the candidates are for/);
    assert.match(run(root, ["new", "x", "--component", "src/components/ui/Footer.tsx", "--page", "home"]).stderr, /--page names the page file a section's copy is read from; without --section there is no page copy to read/);
    assert.match(run(root, ["new", "x", "--component", "src/components/ui/Nope.tsx"]).stderr, /src\/components\/ui\/Nope\.tsx: no such file \(the component the candidates start from\)/);
    const both = run(root, ["new", "hero", "--section", "home-hero", "--component", "src/components/ui/Footer.tsx", "--json"]);
    assert.equal(both.status, 0, both.stderr);
    assert.equal(JSON.parse(both.stdout).page, "home", "--section with --component still reads the page's copy");
    assert.match(fs.readFileSync(path.join(root, "src/app/hero-demo/page.tsx"), "utf8"), /kit\.content\.getPage\("home"\)[\s\S]*<Footer \{\.\.\.props\} \/>/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo clean: the route, the candidates it alone imported (and their module.css), the stale dev types; a candidate imported elsewhere and the section's component stay; no name means every demo", () => {
  const root = site();
  try {
    assert.equal(run(root, ["new", "hero-card", "--section", "home-hero", "--candidates", "3"]).status, 0);
    put(root, "src/components/home/HeroB.module.css", ".b { color: red }");
    put(root, "src/components/home/_keeps-c.ts", 'import { HeroC } from "./HeroC";\nexport const c = HeroC;\n');
    put(root, ".next/dev/types/validator.ts", '// Validate ../../../src/app/hero-card-demo/page.tsx\n');
    const r = run(root, ["clean", "hero-card", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), {
      removed: ["src/app/hero-card-demo", "src/components/home/HeroA.tsx", "src/components/home/HeroB.tsx", "src/components/home/HeroB.module.css", ".next/dev/types/validator.ts"],
      kept: ["src/components/home/Hero.tsx (the component the candidates started from)", "src/components/home/HeroC.tsx (imported by src/components/home/_keeps-c.ts)"],
    });
    assert.ok(fs.existsSync(path.join(root, "src/components/home/Hero.tsx")) && fs.existsSync(path.join(root, "src/components/home/HeroC.tsx")));
    assert.ok(!fs.existsSync(path.join(root, "src/app/hero-card-demo")) && !fs.existsSync(path.join(root, "src/components/home/HeroA.tsx")));
    assert.match(run(root, ["clean", "hero-card"]).stdout, /nothing to remove: no src\/app\/hero-card-demo/);
    assert.equal(run(root, ["new", "one", "--section", "home-hero", "--candidates", "1"]).status, 0);
    fs.rmSync(path.join(root, "src/components/home/HeroC.tsx"));
    assert.equal(run(root, ["new", "two", "--section", "reviews", "--candidates", "1"]).status, 0);
    const all = JSON.parse(run(root, ["clean", "--json"]).stdout);
    assert.deepEqual(all.removed, ["src/app/one-demo", "src/components/home/HeroA.tsx", "src/app/two-demo", "src/components/home/TestimonialsA.tsx"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
