// The types of `agentic-cms/loader` (./load-ts.mjs), written by hand beside
// it: importing it registers the hooks that let plain Node run a site's
// TypeScript (`node --import agentic-cms/loader`, or `import
// "agentic-cms/loader"` before a dynamic import of `@/kit`), and it exports
// nothing. `pnpm lint:pkg` compiles this file (tsconfig.declarations.json);
// tools/declarations.test.mjs holds its names to the module's.
export {};
