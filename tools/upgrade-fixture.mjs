// A site as 0.8.1 left it, which pack-smoke makes of the fresh site and then
// upgrades by docs/migrating-to-0.8.2.md § 1, so the guide's upgrade is run
// as it is written: the scripts, the ESLint config and the guard's config
// `init` wrote at 0.8.1, the root layout's head written by hand as 0.8.1's
// example had it, a primitive of the site's own with a mailto: link, one
// with its copy in it (what a design round made by hand left behind, its
// route gone: a round's route never passes a production build's SEO audit,
// so no green site has one), and the example's posts,
// author, logo and reviews, copied from the kit's checkout (the example is
// the same there as it was at 0.8.1, and the leftovers pass knows it by the
// list of every release's, scripts/lib/example-files.json). Its site.ts has
// no guardEmail, a key 0.8.2 adds and a site turns on when its owner chooses
// (the guide's § 5).
//
// `LEGACY` is what 0.8.1 left: `scripts` for package.json, `files` new to the
// site, `edit` of a file the site has, `example` copied from the kit, and
// `catalogued`, the components named in the catalogue. `UPGRADE` is § 1's
// edits: the gates in package.json, ESLint told the owners, the allow list
// and the baseline, the guard's config the owners. `EXPECTED` is what
// `check-site --baseline` must write, by rule: at least one entry of each.
//
// `UNGUARDED` is the guide's other start, a site that never took 0.8.0's
// § 3.7: no guard's config, an ESLint config of Next's rules alone and no
// ignore of the agent worktrees (one of which holds a copy ESLint cannot
// parse), and a registered section from before the composition rules — raw
// headings and a raw link, a style, an arbitrary value, a second component
// in its file — that builds as it is. `PATHS` are the two the guide works
// through on it: a site already on the content engine, and one whose page
// is a route written by hand, its copy and its head in it. Each takes § 1
// with § 3.7 inside it: the guard's config and the ESLint config as the
// package gives a site (the fresh site's own, put back: `"baseline": []`
// and the worktrees' ignore among them), the gates, the path's route
// exceptions; `expected` is what its baseline must hold, file → rule →
// count. `UNGUARDED.grow` is one more raw link in its section, past the
// count the baseline holds for it.

/** package.json's scripts as init wrote them at 0.8.1. */
const LEGACY_SCRIPTS = { lint: "eslint; s=$?; agentic-cms check-components || s=1; exit $s", build: "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo" };

/** eslint.config.mjs as init wrote it at 0.8.1. */
const LEGACY_ESLINT = `import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { componentRules } from "agentic-cms/eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Images are unoptimized plain <img> on purpose (a static Worker, no image service).
      "@next/next/no-img-element": "off",
    },
  },
  // The component library: the layers' imports, and what a section may contain.
  ...componentRules({
    // No motion folder: agentic-cms/ix is the motion layer. No patterns yet.
    motion: null,
    patterns: null,
    // The sections live in the folder of the page they belong to.
    sections: ["home", "about", "use-cases", "contact", "sections", "blog"],
    // In the kit's own checkout src/lib is the package's source, the motion library's included; a site has none.
    ignores: ["src/lib/**"],
  }),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenNext / wrangler build output:
    ".open-next/**",
    ".wrangler/**",
    // Agent worktrees checked out inside the repo (gitignored):
    ".claude/worktrees/**",
    // The compiled package:
    "dist/**",
  ]),
]);

export default eslintConfig;
`;

/** src/config/components.json as init wrote it at 0.8.1: no owners, no allow list, no baseline. */
const LEGACY_COMPONENTS = `{
  "$comment": "The component guard's config: agentic-cms check-components reads it, and pnpm lint runs it after ESLint.",
  "motion": null,
  "patterns": null,
  "sections": ["home", "about", "use-cases", "contact", "sections", "blog"],
  "routes": ["src/app", "src/app/[[...slug]]"],
  "exceptions": {
    "src/app/blog-post/[slug]": "the blog engine: a post is content/blog/<slug>.md, rendered by the post template",
    "src/app/api/forms/[id]": "the form endpoint, POST /api/forms/[id], the one route that runs at request time",
    "src/app/feed.xml": "the RSS feed, written from the posts"
  },
  "$ignores": "In the kit's own checkout src/lib is the package's source; a site has none.",
  "ignores": ["src/lib/**"],
  "inherited": [
    "src/components/blog/BlogCard.tsx",
    "src/components/blog/BlogHero.tsx",
    "src/components/blog/PostBody.module.css",
    "src/components/blog/PostBody.tsx",
    "src/components/blog/mdx.tsx"
  ]
}
`;

/** The root layout's head as 0.8.1's example wrote it, by hand. */
const HAND_HEAD = `const home = () => kit.content.getPage("home");

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: home().seo.title, template: \`%s | \${site.name}\` },
  description: home().seo.description,
  openGraph: { type: "website", siteName: site.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": \`\${site.url}/feed.xml\` } },
};`;
export const KIT_HEAD = "export const metadata = kit.seo.rootMetadata();";

/** Replaces `from` in a text that must hold it once, or throws naming the file: the fixture follows the starter's files. */
const swap = (file, from, to) => (text) => {
  if (text.split(from).length !== 2) throw new Error(`upgrade fixture: ${file} does not hold ${JSON.stringify(from.slice(0, 60))} once`);
  return text.replace(from, to);
};

export const LEGACY = {
  scripts: LEGACY_SCRIPTS,
  files: {
    "eslint.config.mjs": LEGACY_ESLINT,
    "src/config/components.json": LEGACY_COMPONENTS,
    "src/components/ui/MailLink.tsx": 'export function MailLink({ address, className }: { address: string; className?: string }) {\n  return (\n    <a href={`mailto:${address}`} className={className}>\n      {address}\n    </a>\n  );\n}\n',
    "src/components/ui/Notice.tsx": 'export function Notice() {\n  return (\n    <p className="font-label">\n      Free shipping on every order this month.\n    </p>\n  );\n}\n',
  },
  edit: {
    "src/app/layout.tsx": (text) => swap("src/app/layout.tsx", KIT_HEAD, HAND_HEAD)(swap("src/app/layout.tsx", 'import type { Viewport } from "next";', 'import type { Metadata, Viewport } from "next";')(text)),
    "src/config/site.ts": swap("src/config/site.ts", "  guardEmail: true,\n", ""),
  },
  example: [
    "content/blog/how-a-post-is-built.md", "content/blog/pages-are-files.md", "content/blog/the-voice-file-and-the-lint.md",
    "public/images/blog/how-a-post-is-built", "public/images/blog/pages-are-files", "public/images/blog/the-voice-file-and-the-lint",
    "content/authors.json", "content/categories.json", "public/images/authors",
    "content/reviews.yaml", "public/images/home/review-1.webp",
    "public/images/brand/logo.svg",
  ],
  catalogued: ["MailLink", "Notice"],
};

/** The owners a new site's config names, with their reasons (§ 1: the engines' own files are owners, never bypasses). */
const OWNERS = {
  forms: { "src/components/ui/form/Form.tsx": "the form engine's renderer: the one <form>, posting each definition of src/config/forms.ts through its backend" },
  images: { "src/components/ui/Media.tsx": "the picture primitive: every <img> a section shows, lazy, or eager through EagerImage above the fold" },
};

/** docs/migrating-to-0.8.2.md § 1, as edits: the gates, ESLint reading the guard's config, the owners. */
export const UPGRADE = {
  scripts: { lint: "eslint; s=$?; agentic-cms check-site || s=1; exit $s", build: "pnpm lint && agentic-cms lint --production && agentic-cms docs --check && next build && agentic-cms seo" },
  edit: {
    "eslint.config.mjs": (text) => [
      swap("eslint.config.mjs", 'import { defineConfig, globalIgnores } from "eslint/config";', 'import { readFileSync } from "node:fs";\nimport { defineConfig, globalIgnores } from "eslint/config";'),
      swap("eslint.config.mjs", 'import { componentRules } from "agentic-cms/eslint";\n', 'import { componentRules } from "agentic-cms/eslint";\n\n// The preferred rules a file keeps its own choice of, and the baseline the site took 0.8.2 with: written once, in the guard\'s config.\nconst { allow = [], baseline = [] } = JSON.parse(readFileSync(new URL("./src/config/components.json", import.meta.url), "utf8"));\n'),
      swap("eslint.config.mjs", '    sections: ["home", "about", "use-cases", "contact", "sections", "blog"],\n', '    sections: ["home", "about", "use-cases", "contact", "sections", "blog"],\n    // The engine\'s own files: the form renderer owns the one <form>, the picture primitive the <img>; their reasons are in src/config/components.json.\n    owners: { forms: ["src/components/ui/form/Form.tsx"], images: ["src/components/ui/Media.tsx"] },\n    allow,\n    baseline,\n'),
    ].reduce((out, edit) => edit(out), text),
  },
  json: { "src/config/components.json": (config) => ({ ...config, owners: OWNERS }) },
};

/** What `check-site --baseline` must write for the fixture: per rule, the files it must hold (each at least once). */
export const EXPECTED = {
  "agentic-cms/head": ["src/app/layout.tsx"],
  "agentic-cms/email": ["src/components/ui/MailLink.tsx"],
  "agentic-cms/copy": ["src/components/ui/Notice.tsx"],
  "example-brand": ["content/authors.json", "public/images/brand/logo.svg"],
  "example-content": ["content/blog/pages-are-files.md", "content/reviews.yaml", "public/images/brand/logo.svg"],
};

/** What a written baseline lacks of EXPECTED: one line per file a rule should hold and does not. */
export function unexpected(baseline) {
  const held = new Set(baseline.map(({ file, rule }) => `${rule} ${file}`));
  return Object.entries(EXPECTED).flatMap(([rule, files]) => files.filter((file) => !held.has(`${rule} ${file}`)).map((file) => `no ${rule} entry for ${file}`));
}

/** eslint.config.mjs as a site that never took 0.8.0's § 3.7 has it: Next's rules alone, and no ignore of the agent worktrees. */
const UNGUARDED_ESLINT = `import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Images are unoptimized plain <img> on purpose.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".open-next/**", ".wrangler/**", "dist/**"]),
]);
`;

/** The home page's service section as a site wrote it before the composition rules: raw headings and a raw link, a style, an arbitrary value, a second component in the file. */
export const SECTION_BEFORE = `import type { SectionProps } from "@/components/sections/schemas";
import { Media } from "@/components/ui/Media";
import { Panel } from "@/components/ui/Panel";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";

function Card({ title, text }: { title: string; text: string }) {
  return (
    <Panel className="flex flex-col gap-2 p-[18px]">
      <h3 className="text-h5">{title}</h3>
      <p>{text}</p>
    </Panel>
  );
}

export function Service({ eyebrow, heading, text, feature, cta, dashboard }: SectionProps<"home-service">) {
  return (
    <Section type="home-service" eyebrow={eyebrow} heading={heading}>
      <p className="mb-6 max-w-prose">{text}</p>
      <div className="grid gap-4 lg:grid-cols-2" style={{ alignItems: "start" }}>
        <Panel className="grid gap-2 p-4">
          <h3 className="text-h5">{dashboard.title}</h3>
          <p>{dashboard.text}</p>
          <Media src={dashboard.image} width={1200} height={750} alt={dashboard.imageAlt} />
        </Panel>
        <div>
          <Card title={feature.title} text={feature.text} />
          <a href={site.links.contact} className="mt-4 inline-block underline">
            {cta}
          </a>
        </div>
      </div>
    </Section>
  );
}
`;
const SECTION_FILE = "src/components/home/Service.tsx";

/** A route written by hand, as a site had one before its pages were content files: its copy in JSX and in its metadata, its head and its breadcrumb its own — complete, so the SEO audit passes it. */
const HAND_PAGE = `import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Our story",
  description: "How the studio began, who works in it today and what it makes for the people who come back to it every week.",
  alternates: { canonical: "/our-story" },
  openGraph: { type: "website", url: "/our-story", title: "Our story", description: "How the studio began, who works in it today and what it makes for the people who come back to it every week.", images: [{ url: "/images/our-story-og.jpg", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" },
};

const crumbs = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: \`\${site.url}/\` },
    { "@type": "ListItem", position: 2, name: "Our story", item: \`\${site.url}/our-story\` },
  ],
};

export default function Page() {
  return (
    <main className="mx-auto max-w-prose p-8">
      <h1 className="text-h1">Our story</h1>
      <p>The studio began in a single room, with two people and one press.</p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
    </main>
  );
}
`;

export const UNGUARDED = {
  scripts: { lint: "eslint", build: "agentic-cms lint && agentic-cms docs --check && next build && agentic-cms seo" },
  files: { "eslint.config.mjs": UNGUARDED_ESLINT, [SECTION_FILE]: SECTION_BEFORE },
  remove: ["src/config/components.json"],
  // An agent's worktree inside the repo, gitignored: a copy of the site, one file of it mid-edit.
  worktree: { ".claude/worktrees/stale-copy/src/components/home/Draft.tsx": "export function Draft( {\n" },
  grow: { [SECTION_FILE]: swap(SECTION_FILE, "            {cta}\n          </a>", "            {cta}\n          </a>\n          <a href={site.links.contact}>{cta}</a>") },
};

/** The composition findings SECTION_BEFORE holds, as --baseline must write them. */
const SECTION_HELD = { "react/forbid-elements": 3, "no-restricted-syntax": 2, "react/no-multi-comp": 1 };

export const PATHS = [
  { name: "a site on the content engine that never took 0.8.0's § 3.7", files: {}, edit: {}, copies: {}, exceptions: {}, expected: { [SECTION_FILE]: SECTION_HELD } },
  {
    name: "a site whose page is a route written by hand",
    files: { "src/app/our-story/page.tsx": HAND_PAGE },
    // The route listed by hand, as such a site lists it: the SEO audit fails an indexable page the sitemap leaves out.
    edit: { "src/app/sitemap.ts": (text) => swap("src/app/sitemap.ts", "  return kit.seo.sitemap();", "  return [...kit.seo.sitemap(), { url: `${site.url}/our-story`, changeFrequency: \"yearly\", priority: 0.5 }];")(swap("src/app/sitemap.ts", 'import { kit } from "@/kit";', 'import { site } from "@/config/site";\nimport { kit } from "@/kit";')(text)) },
    copies: { "public/images/our-story-og.jpg": "public/images/home-og.jpg" },
    exceptions: { "src/app/our-story": "a hand-written page, until it is a content file" },
    expected: { [SECTION_FILE]: SECTION_HELD, "src/app/our-story/page.tsx": { "agentic-cms/head": 2, "agentic-cms/copy": 6 } },
  },
];

/** What a written baseline holds otherwise than a path's `expected`: one line per file and rule whose count differs, an entry it lacks or one it should not have. */
export function heldOtherwise(baseline, expected) {
  const held = new Map(baseline.map(({ file, rule, count }) => [`${file} ${rule}`, count]));
  const differ = Object.entries(expected).flatMap(([file, rules]) => Object.entries(rules).filter(([rule, count]) => held.get(`${file} ${rule}`) !== count).map(([rule, count]) => `${file} ${rule}: ${held.get(`${file} ${rule}`) ?? "no entry"}, expected ${count}`));
  const extra = baseline.filter(({ file, rule }) => expected[file]?.[rule] === undefined).map(({ file, rule, count }) => `${file} ${rule}: ${count}, expected no entry`);
  return [...differ, ...extra];
}
