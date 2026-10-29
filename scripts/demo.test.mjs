// demo new and demo clean through the bin, in a throwaway site: a registry,
// a page file and a component the way a site lays them out.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const BIN = path.resolve(import.meta.dirname, "../bin/agentic-cms.mjs");
const run = (root, args) => spawnSync(process.execPath, [BIN, "demo", ...args], { cwd: root, encoding: "utf8" });
/** The bin without blocking this process, so a server the test runs can answer it. */
const runAsync = (root, args) => new Promise((resolve) => {
  const child = spawn(process.execPath, [BIN, "demo", ...args], { cwd: root });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("exit", (status) => resolve({ status, stdout, stderr }));
});
/** A stand-in for next dev on a free loopback port: each path answered by `answer(path, nth)`; what it was asked, in order. */
async function stubServer(answer) {
  const asked = [];
  const server = http.createServer((req, res) => { asked.push(req.url); const { status, body = "" } = answer(req.url, asked.filter((u) => u === req.url).length); res.writeHead(status, { "content-type": "text/html" }); res.end(body); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, port, asked, close: () => new Promise((resolve) => server.close(resolve)) };
}
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
    assert.deepEqual(report, { route: "src/app/hero-card-demo/page.tsx", path: "/hero-card-demo", kind: "candidates", section: "home-hero", page: "home", component: "src/components/home/Hero.tsx", candidates: [{ letter: "A", file: "src/components/home/HeroA.tsx" }, { letter: "B", file: "src/components/home/HeroB.tsx" }], data: false, copy: { placeholders: [], brand: [] }, urls: [], ready: false, status: null }, "no dev server (no package.json here): nothing asked, nothing to hand over yet");
    const route = fs.readFileSync(path.join(root, report.route), "utf8");
    assert.match(route, /export const metadata = kit\.seo\.unlistedMetadata\(\);/);
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

test("demo new on a registry that hands a round what it reads for a section (sectionData()): the route passes the copy and that to every candidate, typed by the current version's props, and no note", () => {
  const root = site();
  try {
    const registry = path.join(root, "src/components/sections/render.tsx");
    fs.writeFileSync(registry, fs.readFileSync(registry, "utf8").replace('"home-hero": plain(HomeHero)', '"home-hero": toContact(HomeHero)') + "export function sectionData() { return {}; }\n");
    const linked = run(root, ["new", "hero-link", "--section", "home-hero", "--candidates", "1", "--json"]);
    assert.equal(linked.status, 0, linked.stderr);
    assert.equal(JSON.parse(linked.stdout).data, true, "a section the registry reads a link for is one the page reads more for");
    assert.doesNotMatch(linked.stderr, /note:/, "a registry that hands it over needs no note");
    const passed = fs.readFileSync(path.join(root, "src/app/hero-link-demo/page.tsx"), "utf8");
    assert.match(passed, /import \{ sectionData \} from "@\/components\/sections\/render";/);
    assert.match(passed, /type Props = Parameters<typeof Hero>\[0\];/);
    assert.match(passed, /const props = \{ \.\.\.copy, \.\.\.sectionData\("home-hero", copy\) \} as Props;/);
    assert.match(passed, /data-candidate="now"[\s\S]*<Hero \{\.\.\.props\} \/>/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo new on a page that still holds the starter's placeholder copy, or the kit example's brand, says so first, naming the fields; then writes the round", () => {
  const root = site();
  try {
    put(root, "content/pages/home.yaml", 'seo: {}\nsections:\n  - type: home-hero\n    heading: "(placeholder) The promise, in one line."\n    text: Built by Acme.\n    cards:\n      - value: hello@my-site.example\n');
    const r = run(root, ["new", "hero-card", "--section", "home-hero", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const [placeholders, brand] = r.stderr.trim().split("\n");
    assert.match(placeholders, /^demo new: content\/pages\/home\.yaml still holds the starter's placeholder copy \(sections\[0\]\.heading, sections\[0\]\.cards\[0\]\.value\): a round designs around the site's real copy — write it first \(\/editorial:new-page/);
    assert.match(brand, /^demo new: content\/pages\/home\.yaml still carries the kit example's brand \(sections\[0\]\.text\): a round never designs around it/);
    assert.deepEqual(JSON.parse(r.stdout).copy, { placeholders: ["sections[0].heading", "sections[0].cards[0].value"], brand: ["sections[0].text"] });
    assert.ok(fs.existsSync(path.join(root, "src/app/hero-card-demo/page.tsx")), "the round is written all the same");
    put(root, "package.json", JSON.stringify({ name: "agentic-cms" }));
    fs.rmSync(path.join(root, "src/app/hero-card-demo"), { recursive: true });
    for (const letter of "AB") fs.rmSync(path.join(root, `src/components/home/Hero${letter}.tsx`));
    const kit = run(root, ["new", "hero-card", "--section", "home-hero", "--json"]);
    assert.deepEqual(JSON.parse(kit.stdout).copy, { placeholders: ["sections[0].heading"], brand: [] }, "in the kit's own repository the example is the example: its brand and its domain are no finding, the marker still is");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("demo new --component alone: a props-free route for a piece of the chrome, no page file read", () => {
  const root = site();
  try {
    put(root, "src/components/ui/Footer.tsx", `import { site } from "@/config/site";\n\n/** The site's footer. */\nexport function Footer() {\n  return <footer>{site.name}</footer>;\n}\n`);
    const r = run(root, ["new", "footer", "--component", "src/components/ui/Footer.tsx", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    assert.deepEqual(report, { route: "src/app/footer-demo/page.tsx", path: "/footer-demo", kind: "candidates", section: null, page: null, component: "src/components/ui/Footer.tsx", candidates: [{ letter: "A", file: "src/components/ui/FooterA.tsx" }, { letter: "B", file: "src/components/ui/FooterB.tsx" }], data: false, copy: null, urls: [], ready: false, status: null });
    const route = fs.readFileSync(path.join(root, report.route), "utf8");
    assert.match(route, /candidates for Footer, a piece of the site's chrome — its copy comes\n\/\/ from the site's config \(src\/config\/site\.ts\), not a page file/);
    assert.match(route, /import type { ComponentType } from "react";\nimport { kit } from "@\/kit";\nimport { Footer } from "@\/components\/ui\/Footer";\nimport { FooterA }/);
    assert.ok(route.includes("const CANDIDATES: { letter: string; note: string; Candidate: ComponentType }[] = ["), "the candidates are typed as bare components");
    assert.ok(route.includes("<Candidate />"), "every candidate rendered with no props");
    assert.match(route, /data-candidate="now"[\s\S]*<Footer \/>/, "the current version, last, with no props");
    assert.doesNotMatch(route, /kit\.content|SectionProps|copyOf|content\/pages/, "no page-file plumbing");
    assert.match(route, /export const metadata = kit\.seo\.unlistedMetadata\(\);/);
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

test("demo clean in a git checkout: what the round created goes with it — a stage only a candidate uses, the round's assets — and what the promoted section now uses stays; --dry-run removes nothing", () => {
  const root = site();
  const git = (...args) => spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: root, encoding: "utf8" });
  try {
    assert.equal(git("init", "-q").status, 0);
    assert.equal(git("add", "src", "content").status, 0);
    assert.equal(git("commit", "-q", "-m", "base").status, 0);
    put(root, "notes-before.tsx", "export const untrackedBeforeTheRound = 1;\n");
    put(root, "src/components/ui/Loose.tsx", "export const Loose = 1;\n");
    // src/components/ui/Loose.tsx was untracked when the round began: never the round's to remove
    assert.equal(run(root, ["new", "hero-card", "--section", "home-hero", "--candidates", "2"]).status, 0);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "src/app/hero-card-demo/demo.json"), "utf8"));
    assert.deepEqual(manifest.created, ["src/components/home/HeroA.tsx", "src/components/home/HeroB.tsx"]);
    assert.equal(manifest.component, "src/components/home/Hero.tsx");
    assert.match(manifest.base, /^[0-9a-f]{40}$/);
    assert.ok(manifest.untracked.includes("src/components/ui/Loose.tsx"));
    // the round: a stage and a card face for the candidates, a stylesheet, an asset; B wins, its card face promoted into the real hero
    put(root, "src/components/home/HeroStage.tsx", 'import s from "./HeroStage.module.css";\nexport const HeroStage = () => s;\n');
    put(root, "src/components/home/HeroStage.module.css", ".stage { display: grid }\n");
    put(root, "src/components/ui/CardFace.tsx", 'import { Loose } from "@/components/ui/Loose";\nexport const CardFace = () => Loose;\n');
    put(root, "src/components/home/HeroA.tsx", 'import { HeroStage } from "./HeroStage";\nexport function HeroA() { return HeroStage(); }\n');
    put(root, "src/components/home/HeroB.tsx", 'import { CardFace } from "@/components/ui/CardFace";\nimport type { Section } from "@/components/ui/Section";\nexport function HeroB() { return CardFace(); }\n');
    put(root, "src/components/home/Hero.tsx", 'import { CardFace } from "@/components/ui/CardFace";\nexport function Hero() { return CardFace(); }\n');
    put(root, "public/images/hero-card-demo/b-face.svg", "<svg/>");
    assert.equal(git("add", "src/components/home/HeroStage.tsx").status, 0);
    assert.equal(git("commit", "-q", "-m", "a stage, committed mid-round").status, 0);

    const expected = {
      removed: ["src/app/hero-card-demo", "src/components/home/HeroA.tsx", "src/components/home/HeroB.tsx", "src/components/home/HeroStage.tsx", "src/components/home/HeroStage.module.css", "public/images/hero-card-demo"],
      kept: ["src/components/home/Hero.tsx (the component the candidates started from)", "src/components/ui/CardFace.tsx (imported by src/components/home/Hero.tsx)"],
    };
    const dry = run(root, ["clean", "hero-card", "--dry-run", "--json"]);
    assert.equal(dry.status, 0, dry.stderr);
    assert.deepEqual(JSON.parse(dry.stdout), { ...expected, dryRun: true });
    for (const file of expected.removed) assert.ok(fs.existsSync(path.join(root, file)), `--dry-run left ${file}`);
    assert.match(run(root, ["clean", "hero-card", "--dry-run"]).stdout, /^would remove: src\/app\/hero-card-demo, /);

    const r = run(root, ["clean", "hero-card", "--json"]);
    assert.deepEqual(JSON.parse(r.stdout), expected);
    for (const file of expected.removed) assert.ok(!fs.existsSync(path.join(root, file)), `${file} removed`);
    for (const file of ["src/components/home/Hero.tsx", "src/components/ui/CardFace.tsx", "src/components/ui/Loose.tsx", "src/components/ui/Section.tsx", "notes-before.tsx"]) assert.ok(fs.existsSync(path.join(root, file)), `${file} kept`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo clean without a name takes only the routes demo new wrote: a site's own gallery in a *-demo folder is kept and named, and goes only by its name", () => {
  const root = site();
  try {
    assert.equal(run(root, ["new", "hero-card", "--section", "home-hero"]).status, 0);
    put(root, "src/app/gallery-demo/page.demo.tsx", "export default function Gallery() { return null; }\n");
    put(root, "src/app/lab-demo/page.tsx", 'import { LabScenes } from "agentic-cms/lab";\nexport default LabScenes;\n');
    // a demo from before the manifest: the route demo new wrote then, and no demo.json
    assert.equal(run(root, ["new", "old", "--component", "src/components/home/Testimonials.tsx"]).status, 0);
    fs.rmSync(path.join(root, "src/app/old-demo/demo.json"));
    const r = JSON.parse(run(root, ["clean", "--json"]).stdout);
    assert.ok(r.removed.includes("src/app/hero-card-demo") && r.removed.includes("src/app/old-demo"), JSON.stringify(r.removed));
    assert.deepEqual(r.kept.filter((k) => k.startsWith("src/app/")), ["src/app/gallery-demo (not a route demo new wrote: demo clean gallery removes it)", "src/app/lab-demo (not a route demo new wrote: demo clean lab removes it)"]);
    assert.ok(fs.existsSync(path.join(root, "src/app/gallery-demo/page.demo.tsx")), "the site's gallery stays");
    assert.deepEqual(JSON.parse(run(root, ["clean", "gallery", "--json"]).stdout).removed, ["src/app/gallery-demo"], "named, it goes");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo new waits for its route on the running dev server: asked until it stops answering 404, then its URLs; a 5xx prints its tail and exits 1; none running says pnpm kit serve", async () => {
  const root = site();
  const server = await stubServer((url, nth) => (url === "/broken-demo" ? { status: 500, body: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ err: { message: "Error: boom in the route\n  at Page" } })}</script>` } : { status: nth < 3 ? 404 : 200 }));
  try {
    const r = await runAsync(root, ["new", "hero-card", "--section", "home-hero", "--url", server.url, "--no-public", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    assert.deepEqual([report.ready, report.status], [true, 200]);
    assert.deepEqual(report.urls[0], { where: "localhost", url: `http://localhost:${server.port}/hero-card-demo` });
    assert.ok(report.urls.every((u) => u.url.endsWith(`:${server.port}/hero-card-demo`) && u.where !== "public"), "the same port on every host; no public address with --no-public");
    assert.deepEqual(server.asked.filter((u) => u === "/hero-card-demo").length, 3, "asked until it answered");
    assert.equal(run(root, ["clean", "hero-card"]).status, 0);

    const text = await runAsync(root, ["new", "hero-card", "--section", "home-hero", "--url", server.url, "--no-public"]);
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, new RegExp(`\n/hero-card-demo answers 200 on the dev server; hand over:\n {2}localhost {2}http://localhost:${server.port}/hero-card-demo\n`));
    assert.match(text.stdout, /edit each candidate into one idea and its note in the route; demo clean hero-card removes it all\n$/);
    assert.equal(run(root, ["clean", "hero-card"]).status, 0);

    const broken = await runAsync(root, ["new", "broken", "--section", "home-hero", "--url", server.url, "--no-public"]);
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, new RegExp(`^/broken-demo answered 500 on ${server.url.replaceAll(".", "\\.")}:\n {2}Error: boom in the route\n {4}at Page\n`));
    assert.ok(fs.existsSync(path.join(root, "src/app/broken-demo/page.tsx")), "the route stays written, to be fixed");
    assert.equal(run(root, ["clean", "broken"]).status, 0);

    const unasked = JSON.parse((await runAsync(root, ["new", "hero-card", "--section", "home-hero", "--url", server.url, "--no-wait", "--no-public", "--json"])).stdout);
    assert.deepEqual([unasked.ready, unasked.status, unasked.urls[0].url], [null, null, `http://localhost:${server.port}/hero-card-demo`]);
    assert.equal(server.asked.filter((u) => u === "/hero-card-demo").length, 4, "--no-wait asked nothing");
    assert.equal(run(root, ["clean", "hero-card"]).status, 0);
  } finally { await server.close(); }
  try {
    const none = await runAsync(root, ["new", "hero-card", "--section", "home-hero", "--url", server.url, "--no-public"]);
    assert.equal(none.status, 0, none.stderr);
    assert.match(none.stdout, new RegExp(`\nno dev server answers on port ${server.port}: pnpm kit serve starts it, waits for /hero-card-demo and prints the URLs to hand over\n`));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo new without --url: another server on the port of scripts.dev is named at once and asked nothing (exit 1); this clone's, by its lock, is waited on", async () => {
  const root = site();
  const server = await stubServer((url, nth) => ({ status: nth < 2 ? 404 : 200 }));
  put(root, "package.json", JSON.stringify({ scripts: { dev: `next dev -p ${server.port}` } }));
  try {
    const started = Date.now();
    const other = await runAsync(root, ["new", "hero-card", "--section", "home-hero", "--no-public"]);
    assert.equal(other.status, 1, other.stderr);
    assert.ok(Date.now() - started < 30000, "no wait for --timeout");
    assert.equal(other.stderr, `port ${server.port} answers, but not as this clone's next dev (.next/dev/lock names none running), so /hero-card-demo is not served there: stop what holds the port (docs/dev-server.md § Stopping a server), or serve this clone on another port (pnpm kit serve --port <n> waits for /hero-card-demo and prints its URLs)\n`);
    assert.deepEqual(server.asked, [], "the route is not asked of another server");
    assert.ok(fs.existsSync(path.join(root, "src/app/hero-card-demo/page.tsx")), "the route stays written");
    assert.equal(run(root, ["clean", "hero-card"]).status, 0);

    // next dev's lock, naming a live pid (this test's) on the stand-in's port: this clone's own server
    put(root, ".next/dev/lock", JSON.stringify({ pid: process.pid, port: server.port, hostname: "localhost", appUrl: `http://localhost:${server.port}` }));
    const own = await runAsync(root, ["new", "hero-card", "--section", "home-hero", "--no-public", "--json"]);
    assert.equal(own.status, 0, own.stderr);
    const report = JSON.parse(own.stdout);
    assert.deepEqual([report.ready, report.status, report.urls[0]], [true, 200, { where: "localhost", url: `http://localhost:${server.port}/hero-card-demo` }]);
    assert.equal(server.asked.filter((u) => u === "/hero-card-demo").length, 2, "asked until it answered");
    assert.equal(run(root, ["clean", "hero-card"]).status, 0);
  } finally { await server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo new --showcase: a review page of the pieces named, each in a block of its own; its manifest; the errors name the fix", () => {
  const root = site();
  try {
    put(root, "src/components/ui/Button.tsx", "export function Button() {\n  return <button />;\n}\n");
    put(root, "src/components/ui/Panel.tsx", "export const Panel = () => null;\n");
    put(root, "src/components/ui/Bare.tsx", "export default function Bare() { return null; }\n");
    const r = run(root, ["new", "library", "--showcase", "--component", "src/components/ui/Button.tsx", "--component", "src/components/ui/Panel.tsx", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), { route: "src/app/library-demo/page.tsx", path: "/library-demo", kind: "showcase", section: null, page: null, component: null, components: ["src/components/ui/Button.tsx", "src/components/ui/Panel.tsx"], candidates: [], data: false, copy: null, urls: [], ready: false, status: null });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "src/app/library-demo/demo.json"), "utf8"));
    assert.deepEqual({ ...manifest, base: undefined, untracked: undefined }, { demo: "library", kind: "showcase", component: null, components: ["src/components/ui/Button.tsx", "src/components/ui/Panel.tsx"], base: undefined, untracked: undefined, created: [] });
    const route = fs.readFileSync(path.join(root, "src/app/library-demo/page.tsx"), "utf8");
    assert.match(route, /^\/\/ Throwaway showcase route \(agentic-cms demo new --showcase\)/);
    assert.match(route, /import \{ Button \} from "@\/components\/ui\/Button";\nimport \{ Panel \} from "@\/components\/ui\/Panel";/);
    assert.match(route, /export const metadata = kit\.seo\.unlistedMetadata\(\);/);
    assert.match(route, /<div data-showcase="Button">\n {8}<p style=\{chip\} aria-hidden="true"><span style=\{letterStyle\}>Button<\/span> src\/components\/ui\/Button\.tsx: each look and state it has, with real copy from a content file<\/p>\n {8}<div style=\{column\}><Button \/><\/div>/);
    assert.ok(route.indexOf('data-showcase="Button"') < route.indexOf('data-showcase="Panel"'), "in the order named");
    assert.match(route, /export default function LibraryDemo\(\)/);
    assert.match(route, /^\/\/ `agentic-cms demo new library --showcase`, removed with every file only it uses \(the pieces it shows stay\) by$/m);
    assert.doesNotMatch(route, /^import \{ LabTimeline|<div data-lab-drive>|CANDIDATES|data-candidate=/m, "no timeline without --timeline, nothing of a candidates route");
    assert.match(run(root, ["new", "library", "--showcase"]).stderr, /src\/app\/library-demo\/page\.tsx exists/);

    const fails = (args, re) => { const f = run(root, ["new", "x", ...args]); assert.equal(f.status, 2); assert.match(f.stderr, re); assert.ok(!fs.existsSync(path.join(root, "src/app/x-demo")), "nothing written"); };
    fails(["--showcase", "--section", "home-hero"], /--showcase is a review page of its own and --section a section's candidates: pass one of them/);
    fails(["--showcase", "--candidates", "3"], /--candidates is for a section's or a piece's candidates; a showcase has a block per --component instead/);
    fails(["--showcase", "--page", "home"], /--page names the page file a section's copy is read from; a showcase reads none/);
    fails(["--showcase", "--component", "src/components/ui/Nope.tsx"], /src\/components\/ui\/Nope\.tsx: no such file \(a piece the showcase shows\)/);
    fails(["--showcase", "--component", "src/components/ui/Bare.tsx"], /src\/components\/ui\/Bare\.tsx has no `export function Bare` \(or `export const Bare`\) for the showcase to render/);
    fails(["--showcase", "--component", "src/components/ui/Panel.tsx", "--component", "src/components/ui/Panel.tsx"], /Panel is named twice/);
    fails(["--component", "src/components/ui/Button.tsx", "--component", "src/components/ui/Panel.tsx"], /--component names one file, the component the candidates are copied from; several are the pieces of a --showcase/);

    const empty = run(root, ["new", "states", "--showcase", "--timeline"]);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /\/states-demo: a showcase, one block to fill/);
    const timed = fs.readFileSync(path.join(root, "src/app/states-demo/page.tsx"), "utf8");
    assert.match(timed, /import \{ kit \} from "@\/kit";\nimport \{ LabTimeline \} from "agentic-cms\/lab";\n\nexport const metadata/);
    assert.match(timed, /<div data-showcase="1">[\s\S]*<div style=\{column\}><LabTimeline label="1"><div data-lab-drive>\{\/\* the piece under review/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo new --timeline: every candidate and the current version under its own LabTimeline, driving data-lab-drive", () => {
  const root = site();
  try {
    assert.equal(run(root, ["new", "hero-card", "--section", "home-hero", "--timeline"]).status, 0);
    const route = fs.readFileSync(path.join(root, "src/app/hero-card-demo/page.tsx"), "utf8");
    assert.match(route, /import type \{ ReactNode \} from "react";[\s\S]*import \{ LabTimeline \} from "agentic-cms\/lab";\nimport \{ Hero \} from "@\/components\/home\/Hero";/);
    assert.ok(route.includes("<LabTimeline label={letter}><div data-lab-drive><Candidate {...props} /></div></LabTimeline>"), route);
    assert.ok(route.includes('<LabTimeline label="now"><div data-lab-drive><Hero {...props} /></div></LabTimeline>'));
    put(root, "src/components/ui/Footer.tsx", "export function Footer() {\n  return <footer />;\n}\n");
    assert.equal(run(root, ["new", "footer", "--component", "src/components/ui/Footer.tsx", "--timeline"]).status, 0);
    const chrome = fs.readFileSync(path.join(root, "src/app/footer-demo/page.tsx"), "utf8");
    assert.ok(chrome.includes("<LabTimeline label={letter}><div data-lab-drive><Candidate /></div></LabTimeline>") && chrome.includes('<LabTimeline label="now"><div data-lab-drive><Footer /></div></LabTimeline>'));
    assert.doesNotMatch(fs.readFileSync(path.join(root, "src/components/home/HeroA.tsx"), "utf8"), /LabTimeline/, "the candidates themselves stay copies of the component");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("demo clean of a showcase: the route and the files only it uses go; the pieces it shows stay, a new one named before the round included", () => {
  const root = site();
  const git = (...args) => spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: root, encoding: "utf8" });
  try {
    put(root, "src/components/ui/Button.tsx", "export function Button() {\n  return <button />;\n}\n");
    assert.equal(git("init", "-q").status, 0);
    assert.equal(git("add", "src", "content").status, 0);
    assert.equal(git("commit", "-q", "-m", "base").status, 0);
    put(root, "src/components/ui/Panel.tsx", "export const Panel = () => null;\n");
    assert.equal(run(root, ["new", "library", "--showcase", "--component", "src/components/ui/Button.tsx", "--component", "src/components/ui/Panel.tsx"]).status, 0);
    // the round: a grid of states the showcase alone uses, with its stylesheet
    put(root, "src/components/ui/StateGrid.tsx", 'import s from "./StateGrid.module.css";\nexport const StateGrid = () => s;\n');
    put(root, "src/components/ui/StateGrid.module.css", ".grid { display: grid }\n");
    const file = path.join(root, "src/app/library-demo/page.tsx");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('import { Button }', 'import { StateGrid } from "@/components/ui/StateGrid";\nimport { Button }'));
    const r = run(root, ["clean", "library", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), {
      removed: ["src/app/library-demo", "src/components/ui/StateGrid.tsx", "src/components/ui/StateGrid.module.css"],
      kept: ["src/components/ui/Button.tsx (a piece the showcase shows)", "src/components/ui/Panel.tsx (a piece the showcase shows)"],
    });
    assert.ok(fs.existsSync(path.join(root, "src/components/ui/Button.tsx")) && fs.existsSync(path.join(root, "src/components/ui/Panel.tsx")));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
