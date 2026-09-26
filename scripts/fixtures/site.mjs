// A throwaway site root for the browser tests: the fixture pages laid out the
// way a Next build leaves them (.next/server/app/<route>.html) beside a
// public/ folder, so serveStatic() and the commands read it like a real site.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FIXTURES = import.meta.dirname;

/** Creates the tmp site and returns its root; the caller removes it. */
export function fixtureSite() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cms-fixture-"));
  fs.cpSync(path.join(FIXTURES, "pages"), path.join(root, ".next/server/app"), { recursive: true });
  fs.cpSync(path.join(FIXTURES, "public"), path.join(root, "public"), { recursive: true });
  return root;
}

// A page with an inline SMIL loop: a disc crossing a 200-wide box every 2 s,
// at rest (data-rest) 1.2 s in. Added by the tests that need it, so the
// fixture's own page list stays the two routes the other tests expect.
export const LOOP_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Loop</title><style>body { margin: 0; font: 16px/1.4 sans-serif; } section { padding: 2rem; }</style></head>
<body><main><section id="loop" data-section="loop"><h1>A loop</h1>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100" data-duration="2" data-rest="1.2"><rect width="200" height="100" fill="#ddd"/><circle cx="20" cy="50" r="15" fill="#000"><animate attributeName="cx" values="20;180;20" dur="2s" repeatCount="indefinite"/></circle></svg>
</section></main></body></html>`;

/** Adds a prerendered page to a fixture site: .next/server/app/<route>.html. */
export function addPage(root, route, html) {
  const file = path.join(root, ".next/server/app", `${route.replace(/^\//, "")}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
