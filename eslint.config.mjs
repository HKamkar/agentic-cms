import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Images are unoptimized plain <img> on purpose (a static Worker, no image service).
      "@next/next/no-img-element": "off",
    },
  },
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
  ]),
]);

export default eslintConfig;
