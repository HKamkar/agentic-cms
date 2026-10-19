import { defineConfig, globalIgnores } from "eslint/config";
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
  // The engines (copy, head, forms, tags, e-mail) across src, then the component library: the layers' imports, and what a section may contain.
  ...componentRules({
    // No motion folder: agentic-cms/ix is the motion layer. No patterns yet.
    motion: null,
    patterns: null,
    // The sections live in the folder of the page they belong to.
    sections: ["home", "about", "use-cases", "contact", "sections", "blog"],
    // The form engine's renderer owns the one <form>; its reason is in src/config/components.json.
    owners: { forms: ["src/components/ui/form/Form.tsx"] },
    // In the kit's own checkout src/lib is the package's source, the motion library's included: init leaves this line out of a site, whose src/lib is its own and linted.
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
