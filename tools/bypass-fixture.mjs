// One example of each way around the kit that the 0.8.2 plan's survey found
// (docs/roadmap-0.8.2.md § What gets around the kit today), as files and
// edits pack-smoke lays over the fresh site from the starter for one run of
// its checks, then takes back. Each required bypass must fail its check
// with its own message, naming the part to use. Each preferred one must
// warn, naming the kit's part, and fail nothing. The fresh site is a git
// checkout with one commit when the fixture goes on, so the site check
// compares the exceptions with it.
//
// A bypass names its row (`part`), its tier and what it writes: `files` new
// to the site, `append` to a file the site has, `json` edits of a JSON
// file. It also names what must answer it: `eslint` ({ file, rule, message })
// is a line of the lint's ESLint report at that severity, `report` a pattern
// in the lint's output, `content` one in the content lint's, and `agentFiles`
// one in `init --agent-files --check`'s.

/** The fixture's components, named in the catalogue so the guard's catalogue pass stays out of the way. */
export const CATALOGUED = ["Promo", "Signup", "Analytics", "Contact", "Hero", "Legacy", "Motion", "Chart", "Photo", "Logo", "Swatch"];

export const BYPASSES = [
  {
    part: "Content in a design round", tier: "required",
    files: { "src/app/promo-demo/page.tsx": 'export default function Page() {\n  return <main><h1>Our spring promotion</h1></main>;\n}\n' },
    eslint: [{ file: "src/app/promo-demo/page.tsx", rule: "agentic-cms/copy", severity: "error" }],
    report: [/✗ src\/app\/promo-demo {2}\[rounds\]\n {4}a \*-demo route `demo new` did not write \(no demo\.json\)/],
  },
  {
    part: "Content in pages", tier: "required",
    files: { "src/components/ui/Promo.tsx": "export function Promo() {\n  return <p>Free shipping on every order</p>;\n}\n" },
    eslint: [{ file: "src/components/ui/Promo.tsx", rule: "agentic-cms/copy", severity: "error", message: /content/ }],
  },
  {
    part: "SEO", tier: "required",
    files: { "src/app/promo-demo/layout.tsx": 'import type { ReactNode } from "react";\n\nexport const metadata = { title: "Spring promotion" };\n\nexport default function Layout({ children }: { children: ReactNode }) {\n  return children;\n}\n' },
    eslint: [{ file: "src/app/promo-demo/layout.tsx", rule: "agentic-cms/head", severity: "error", message: /kit\.seo/ }],
  },
  {
    part: "Forms", tier: "required",
    files: { "src/components/ui/Signup.tsx": 'export function Signup({ label }: { label: string }) {\n  return (\n    <form action="https://forms.example.net/subscribe" method="post">\n      <button type="submit">{label}</button>\n    </form>\n  );\n}\n' },
    eslint: [{ file: "src/components/ui/Signup.tsx", rule: "agentic-cms/forms", severity: "error", message: /form/i }],
  },
  {
    part: "Consent and analytics", tier: "required",
    files: { "src/components/ui/Analytics.tsx": 'import Script from "next/script";\n\nexport function Analytics() {\n  return <Script src="https://www.googletagmanager.com/gtag/js?id=G-TEST" strategy="afterInteractive" />;\n}\n' },
    eslint: [{ file: "src/components/ui/Analytics.tsx", rule: "agentic-cms/tags", severity: "error", message: /consent/ }],
  },
  {
    part: "E-mail", tier: "required",
    files: { "src/components/ui/Contact.tsx": 'export function Contact({ label }: { label: string }) {\n  return <a href="mailto:team@ours.dev">{label}</a>;\n}\n' },
    eslint: [{ file: "src/components/ui/Contact.tsx", rule: "agentic-cms/email", severity: "error", message: /EmailLink/ }],
  },
  {
    part: "The starter", tier: "required",
    append: { "src/config/site.ts": "// copied from the Acme example\n" },
    content: [/^FAIL src\/config\/site\.ts example-brand: /m],
  },
  {
    part: "The gates themselves: a build that runs no lint", tier: "required",
    json: { "package.json": (pkg) => ({ ...pkg, scripts: { ...pkg.scripts, build: "next build" } }) },
    report: [/✗ package\.json {2}\[scripts\]\n {4}"build" runs no pnpm lint, agentic-cms lint --production, agentic-cms docs --check, agentic-cms seo/],
  },
  {
    part: "The gates themselves: an inline disable with no reason", tier: "required",
    files: { "src/components/ui/Hero.tsx": "export function Hero() {\n  // eslint-disable-next-line agentic-cms/copy\n  return <h2>Built for teams</h2>;\n}\n" },
    report: [/✗ src\/components\/ui\/Hero\.tsx:2 {2}\[disables\]\n {4}turns off agentic-cms\/copy with no reason/],
  },
  {
    part: "The gates themselves: exceptions that grow", tier: "required",
    files: { "src/components/ui/Legacy.tsx": "export function Legacy() {\n  return null;\n}\n" },
    json: { "src/config/components.json": (config) => ({ ...config, exceptions: { ...config.exceptions, "src/app/old-landing": "the campaign page, until it moves to content/pages" }, inherited: [...(config.inherited ?? []), "src/components/ui/Legacy.tsx"] }) },
    report: [/✗ src\/components\/ui\/Legacy\.tsx {2}\[exceptions\]\n {4}added to the frozen "inherited" list since main: the list only shrinks/, /\+ exceptions src\/app\/old-landing — the campaign page, until it moves to content\/pages/],
  },
  {
    part: "Agent files", tier: "required",
    edit: { ".claude/rules/components.md": (text) => text.split("\n").filter((line) => !line.startsWith("- **Tier:**")).join("\n") },
    agentFiles: [/^modified, required gone +\.claude\/rules\/components\.md/m],
  },
  {
    part: "Motion", tier: "preferred",
    files: { "src/components/ui/Motion.tsx": 'import { gsap } from "gsap";\n\nexport function Motion() {\n  gsap.to(".x", { opacity: 1 });\n  return null;\n}\n' },
    eslint: [{ file: "src/components/ui/Motion.tsx", rule: "agentic-cms/motion", severity: "warning", message: /agentic-cms\/ix/ }],
  },
  {
    part: "Graphics, images, icons", tier: "preferred",
    files: {
      "src/components/ui/Chart.tsx": 'export function Chart() {\n  return <canvas width={10} height={10} aria-hidden="true" />;\n}\n',
      "src/components/ui/Photo.tsx": 'import Image from "next/image";\n\nexport function Photo({ alt }: { alt: string }) {\n  return <Image src="/images/a.webp" alt={alt} width={10} height={10} />;\n}\n',
      "src/components/ui/Logo.tsx": 'export function Logo() {\n  return (\n    <svg viewBox="0 0 10 10" aria-hidden="true">\n      <path d="M0 0h10v10z" />\n    </svg>\n  );\n}\n',
    },
    eslint: [
      { file: "src/components/ui/Chart.tsx", rule: "agentic-cms/graphics", severity: "warning", message: /lab/ },
      { file: "src/components/ui/Photo.tsx", rule: "agentic-cms/images", severity: "warning" },
      { file: "src/components/ui/Logo.tsx", rule: "agentic-cms/icons", severity: "warning", message: /Icon/ },
    ],
  },
  {
    part: "Styling", tier: "preferred",
    files: { "src/components/ui/Swatch.tsx": 'export function Swatch() {\n  return <span className="block bg-[#c0ffee]" aria-hidden="true" />;\n}\n' },
    eslint: [{ file: "src/components/ui/Swatch.tsx", rule: "agentic-cms/styling", severity: "warning", message: /token/ }],
  },
  {
    part: "Screenshots, dev server, setup", tier: "preferred",
    files: {
      "scripts/shots.mjs": 'import { chromium } from "playwright";\n\nconst browser = await chromium.launch();\nawait browser.close();\n',
      "scripts/serve.sh": "#!/bin/sh\nnext dev -H 0.0.0.0 -p 8000\n",
    },
    append: { "next.config.ts": 'export const devHost = "192.0.2.10";\n' },
    report: [/⚠ scripts\/serve\.sh {2}\[tools\]\n {4}a script of the site's own that starts next dev\n {4}→ agentic-cms serve/, /⚠ scripts\/shots\.mjs {2}\[tools\]\n {4}a script of the site's own that drives a headless browser of its own \(Playwright\)\n {4}→ agentic-cms shot, probe and sheet/, /⚠ next\.config\.ts:\d+ {2}\[tools\]\n {4}names a machine's address \(192\.0\.2\.10\)/],
  },
];

/**
 * The lint's ESLint report (the stylish formatter's) as { file → [{ line,
 * severity, message, rule }] }, each file relative to the site's root.
 */
export function eslintEntries(output, root) {
  const out = new Map();
  let file = null;
  for (const line of output.split("\n")) {
    if (line.startsWith(`${root}/`)) { file = line.slice(root.length + 1).trim(); out.set(file, []); continue; }
    const entry = line.match(/^\s+(\d+):\d+\s+(error|warning)\s+(.*?)\s{2,}(\S+)$/);
    if (entry && file) out.get(file).push({ line: Number(entry[1]), severity: entry[2], message: entry[3], rule: entry[4] });
  }
  return out;
}

/** What a run of the checks lacks of the fixture's answers: one line per bypass whose check did not answer as its tier says. */
export function unanswered({ lint, content, agentFiles, entries }) {
  const missing = [];
  for (const bypass of BYPASSES) {
    const at = `${bypass.part} (${bypass.tier})`;
    for (const want of bypass.eslint ?? []) {
      const found = (entries.get(want.file) ?? []).find((e) => e.rule === want.rule && e.severity === want.severity && (!want.message || want.message.test(e.message)));
      if (!found) missing.push(`${at}: no ${want.severity} of ${want.rule} in ${want.file}${want.message ? ` naming ${want.message}` : ""}`);
    }
    for (const [text, patterns, name] of [[lint, bypass.report, "the lint"], [content, bypass.content, "the content lint"], [agentFiles, bypass.agentFiles, "init --agent-files --check"]]) {
      for (const pattern of patterns ?? []) if (!pattern.test(text)) missing.push(`${at}: ${name} printed nothing matching ${pattern}`);
    }
  }
  return missing;
}
